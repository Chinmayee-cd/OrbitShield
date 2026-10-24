# 🛰️ OrbitShield: Real-Time Satellite Overpass & Climate Disaster Telemetry
---

## 🌍 The Problem & Story
When wildfires, severe storms, and flash floods strike vulnerable communities, emergency responders and local civic groups face a critical information blind spot: **when will the next Earth-observation satellite pass overhead, and what sensor mode is needed to map the hazard?**

**OrbitShield** bridges real-time SGP4 orbital mechanics (`satellite.js`) and live NASA EONET climate disaster feeds into a 3D Mission Control dashboard on AWS—allowing anyone to click an active climate hazard on Earth and immediately compute satellite intercept windows and sensor tasking briefs.

---

## ⚙️ AWS Architecture & Technical Innovation
* **Frontend (`Amazon S3` + `Amazon CloudFront` OAC):** React + Vite + `react-globe.gl` (Three.js WebGL) + `satellite.js` hosted in a private S3 bucket (`orbitshield-frontend-05826453`) secured via CloudFront Origin Access Control (`E1NNKF3QMOBB4C`) at `https://d3odkk0yy3ozt5.cloudfront.net`.
* **Serverless Overpass Engine (`AWS Lambda` Python 3.12):** `orbitshield-overpass-analyzer` deployed in `us-east-1` with a public Lambda Function URL. Computes spherical Haversine ground distance, LEO orbital intercept ETA (~7.5 km/s), swath lock status, priority score, and hazard-specific sensor modes (SWIR+Thermal for wildfires, SAR for storms).
* **Live Data Feeds:** Real-time NASA EONET v3 open natural disaster events + SGP4 Two-Line Element (TLE) propagation for **Sentinel-2A**, **Landsat 9**, **Terra**, and **ISS**.
