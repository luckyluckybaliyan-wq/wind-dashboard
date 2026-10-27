# 🌬️ Wind Dashboard

A full-stack wind dashboard: **Node.js + Express** backend and a **vanilla HTML/CSS/JS** frontend with Chart.js.

## Features
- Search any city worldwide (geocoding)
- Current wind speed, gusts, direction (animated compass) and Beaufort description
- 48-hour speed & gust forecast chart
- Units: km/h, mph, m/s
- Backend proxy with in-memory caching (default 10 min), input validation
- Auto-refresh every 10 minutes
- Falls back to simulated demo data if the weather API is unreachable

## Tech
Backend: Node 18+, Express, cors, dotenv · Frontend: HTML, CSS, JS, Chart.js (CDN) · Data: Open-Meteo (free, no API key)

## Run
```bash
npm install
cp .env.example .env   # optional
npm start
```
Open http://localhost:3000

## Structure
```
wind-dashboard/
├── server.js          # Express API + static hosting
├── package.json
├── .env.example
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```

## API
| Endpoint | Description |
|---|---|
| `GET /api/wind?lat=&lon=&unit=kmh\|mph\|ms` | Current + 48h hourly wind data |
| `GET /api/geocode?q=city` | City search results |
| `GET /api/health` | Health check |

## Ideas to extend
Add a database for favourite locations, user login, wind-rose chart, or deploy on Render/Railway.
