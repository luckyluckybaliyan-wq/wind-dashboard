const $ = id => document.getElementById(id);
const BEAUFORT = [[1,'Calm'],[5,'Light air'],[11,'Light breeze'],[19,'Gentle breeze'],[28,'Moderate breeze'],[38,'Fresh breeze'],[49,'Strong breeze'],[61,'Near gale'],[74,'Gale'],[88,'Strong gale'],[102,'Storm'],[117,'Violent storm'],[Infinity,'Hurricane']];
const DIRS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const TO_KMH = { kmh: 1, mph: 1.609, ms: 3.6 };

let chart, state = { lat: 28.6139, lon: 77.209, name: 'New Delhi, India' };

const cardinal = d => DIRS[Math.round(d / 22.5) % 16];
const beaufort = (v, unit) => BEAUFORT.find(b => v * TO_KMH[unit] < b[0])[1];
const unitText = u => ({ kmh: 'km/h', mph: 'mph', ms: 'm/s' })[u];

async function load() {
  const unit = $('unit').value;
  $('place').textContent = state.name;
  try {
    const r = await fetch(`/api/wind?lat=${state.lat}&lon=${state.lon}&unit=${unit}`);
    if (!r.ok) throw new Error((await r.json()).error || 'Request failed');
    render(await r.json(), unit);
  } catch (e) {
    $('notice').hidden = false;
    $('notice').textContent = 'Error: ' + e.message;
  }
}

function render(d, unit) {
  unit = d.unit || unit;
  $('notice').hidden = !d.simulated;
  if (d.simulated) $('notice').textContent = 'Live data unavailable — showing simulated demo data.';
  $('speed').textContent = d.current.speed.toFixed(1);
  $('gust').textContent = d.current.gust.toFixed(1);
  $('deg').textContent = Math.round(d.current.direction);
  $('cardinal').textContent = cardinal(d.current.direction);
  $('beaufort').textContent = beaufort(d.current.speed, unit);
  $('peak').textContent = Math.max(...d.hourly.gust).toFixed(1) + ' ' + unitText(unit);
  $('unitLabel').textContent = unitText(unit);
  document.querySelectorAll('.unitLabel').forEach(e => e.textContent = unitText(unit));
  // wind direction = where wind comes FROM; arrow points where it blows TO
  $('arrow').style.transform = `rotate(${d.current.direction + 180}deg)`;

  const labels = d.hourly.time.map(t => t.slice(5, 10) + ' ' + t.slice(11, 16));
  if (chart) chart.destroy();
  chart = new Chart($('chart'), {
    type: 'line',
    data: { labels, datasets: [
      { label: 'Speed', data: d.hourly.speed, borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,.15)', fill: true, tension: .35, pointRadius: 0 },
      { label: 'Gusts', data: d.hourly.gust, borderColor: '#f97316', borderDash: [5, 4], tension: .35, pointRadius: 0 }
    ]},
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      scales: {
        x: { ticks: { color: '#94a3b8', maxTicksLimit: 8 }, grid: { color: '#33415555' } },
        y: { title: { display: true, text: unitText(unit), color: '#94a3b8' }, ticks: { color: '#94a3b8' }, grid: { color: '#33415555' }, beginAtZero: true }
      },
      plugins: { legend: { labels: { color: '#e2e8f0' } } }
    }
  });
}

$('searchForm').addEventListener('submit', async e => {
  e.preventDefault();
  const q = $('searchInput').value.trim();
  const list = $('results');
  try {
    const r = await fetch('/api/geocode?q=' + encodeURIComponent(q));
    const places = await r.json();
    list.innerHTML = '';
    if (!Array.isArray(places) || !places.length) { list.innerHTML = '<li>No results</li>'; list.hidden = false; return; }
    places.forEach(p => {
      const li = document.createElement('li');
      li.textContent = [p.name, p.region, p.country].filter(Boolean).join(', ');
      li.onclick = () => { state = { lat: p.lat, lon: p.lon, name: li.textContent }; list.hidden = true; load(); };
      list.appendChild(li);
    });
    list.hidden = false;
  } catch { list.innerHTML = '<li>Search failed</li>'; list.hidden = false; }
});

$('unit').addEventListener('change', load);
document.addEventListener('click', e => { if (!e.target.closest('header')) $('results').hidden = true; });
load();
setInterval(load, 10 * 60 * 1000);
