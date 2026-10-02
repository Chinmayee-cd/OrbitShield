# 🛰️ OrbitShield: Real-Time Satellite Overpass & Climate Disaster Telemetry

**Live Application (AWS CloudFront):** https://d3odkk0yy3ozt5.cloudfront.net  
**Serverless Telemetry Endpoint (AWS Lambda Function URL):** https://ynlycumuzoysbioe4htpnqgaz40lhuwa.lambda-url.us-east-1.on.aws/  
**Category:** `#social-good` (Climate Resilience)  
**Lane:** `#community`

---

## 🌍 The Problem & Story
When wildfires, severe storms, and flash floods strike vulnerable communities, emergency responders and local civic groups face a critical information blind spot: **when will the next Earth-observation satellite pass overhead, and what sensor mode is needed to map the hazard?**

**OrbitShield** bridges real-time SGP4 orbital mechanics (`satellite.js`) and live NASA EONET climate disaster feeds into a 3D Mission Control dashboard on AWS—allowing anyone to click an active climate hazard on Earth and immediately compute satellite intercept windows and sensor tasking briefs.

---

## ⚙️ AWS Architecture & Technical Innovation
* **Frontend (`Amazon S3` + `Amazon CloudFront` OAC):** React + Vite + `react-globe.gl` (Three.js WebGL) + `satellite.js` hosted in a private S3 bucket (`orbitshield-frontend-05826453`) secured via CloudFront Origin Access Control (`E1NNKF3QMOBB4C`) at `https://d3odkk0yy3ozt5.cloudfront.net`.
* **Serverless Overpass Engine (`AWS Lambda` Python 3.12):** `orbitshield-overpass-analyzer` deployed in `us-east-1` with a public Lambda Function URL. Computes spherical Haversine ground distance, LEO orbital intercept ETA (~7.5 km/s), swath lock status, priority score, and hazard-specific sensor modes (SWIR+Thermal for wildfires, SAR for storms).
* **Live Data Feeds:** Real-time NASA EONET v3 open natural disaster events + SGP4 Two-Line Element (TLE) propagation for **Sentinel-2A**, **Landsat 9**, **Terra**, and **ISS**.

---

## 📸 Documented Proof: Coding Agent Connected to AWS (Zero to Shipped)

We connected **Kiro** to our AWS account via the **AWS CLI v2.37.7 Agent Toolkit (`aws configure agent-toolkit`)**, installing the 24 default AWS skills and configuring the **AWS MCP Server**.

### 1. Live OrbitShield 3D Mission Control Dashboard on AWS CloudFront
<img width="960" height="516" alt="Screenshot 2026-10-02 151539" src="https://github.com/user-attachments/assets/71a7e4d6-92aa-467b-bf9f-4e1d8d76b15c" />



### 2. Loading the `aws-serverless` Skill in Kiro
<img width="321" height="420" alt="Screenshot 2026-10-02 131654" src="https://github.com/user-attachments/assets/48f2514a-4fac-48de-9f98-92632235c2f1" />


### 3. Kiro Deploying `orbitshield-overpass-analyzer` to AWS Lambda
<img width="536" height="402" alt="Screenshot 2026-10-02 134204" src="https://github.com/user-attachments/assets/cb25019e-9758-4653-8d68-f78da893fc40" />



### 4. Kiro Provisioning S3 + CloudFront OAC & Verifying Live HTTP 200 Deployment
<img width="734" height="392" alt="Screenshot 2026-10-02 150149" src="https://github.com/user-attachments/assets/ae64d760-2c7b-45af-8bc8-09c6ad71249d" />
