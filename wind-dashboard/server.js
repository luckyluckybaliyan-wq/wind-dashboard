require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const TTL = (parseInt(process.env.CACHE_TTL_MINUTES, 10) || 10) * 60 * 1000;
const cache = new Map();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function cached(key, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  const v = await loader();
  cache.set(key, { v, t: Date.now() });
  return v;
}

const num = (v, min, max) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

// Offline fallback so the UI still works without internet
function simulate(lat, lon) {
  const now = new Date(); now.setMinutes(0, 0, 0);
  const time = [], speed = [], gust = [], dir = [];
  for (let i = 0; i < 48; i++) {
    const t = new Date(now.getTime() + i * 3600e3);
    time.push(t.toISOString().slice(0, 16));
    const s = 12 + 8 * Math.sin(i / 5 + lat) + 3 * Math.sin(i / 1.7);
    speed.push(+Math.max(s, 1).toFixed(1));
    gust.push(+(Math.max(s, 1) * 1.45).toFixed(1));
    dir.push(Math.round((180 + 60 * Math.sin(i / 9 + lon) + 360) % 360));
  }
  return {
    simulated: true,
    current: { speed: speed[0], gust: gust[0], direction: dir[0] },
    hourly: { time, speed, gust, direction: dir }
  };
}

app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.get('/api/geocode', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (q.length < 2) return res.status(400).json({ error: 'Query too short' });
  try {
    const data = await cached('geo:' + q.toLowerCase(), async () => {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en`);
      if (!r.ok) throw new Error('Geocoding failed');
      return r.json();
    });
    res.json((data.results || []).map(p => ({
      name: p.name, region: p.admin1 || '', country: p.country || '',
      lat: p.latitude, lon: p.longitude
    })));
  } catch (e) {
    res.status(502).json({ error: 'Could not reach geocoding service' });
  }
});

app.get('/api/wind', async (req, res) => {
  const lat = num(req.query.lat, -90, 90), lon = num(req.query.lon, -180, 180);
  if (lat === null || lon === null) return res.status(400).json({ error: 'Valid lat and lon required' });
  const unit = req.query.unit === 'mph' ? 'mph' : req.query.unit === 'ms' ? 'ms' : 'kmh';
  const key = `wind:${lat.toFixed(2)}:${lon.toFixed(2)}:${unit}`;
  try {
    const out = await cached(key, async () => {
      const url = 'https://api.open-meteo.com/v1/forecast' +
        `?latitude=${lat}&longitude=${lon}` +
        '&current=wind_speed_10m,wind_gusts_10m,wind_direction_10m' +
        '&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m' +
        `&forecast_days=2&timezone=auto&wind_speed_unit=${unit}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('Upstream error');
      const d = await r.json();
      return {
        simulated: false, timezone: d.timezone, unit,
        current: { speed: d.current.wind_speed_10m, gust: d.current.wind_gusts_10m, direction: d.current.wind_direction_10m },
        hourly: { time: d.hourly.time, speed: d.hourly.wind_speed_10m, gust: d.hourly.wind_gusts_10m, direction: d.hourly.wind_direction_10m }
      };
    });
    res.json(out);
  } catch (e) {
    console.warn('Upstream failed, serving simulated data:', e.message);
    res.json({ ...simulate(lat, lon), unit: 'kmh' });
  }
});

app.listen(PORT, () => console.log(`Wind Dashboard running at http://localhost:${PORT}`));
