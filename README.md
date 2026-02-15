# QonaqAI

**QonaqAI** is an AI-powered revenue intelligence platform designed for independent hotels (20–150 rooms).  
The system replaces static pricing strategies with dynamic, data-driven optimization based on real-time market signals.

---

## 🚀 Overview

QonaqAI calculates a structured **Demand Score (0–100)** using weighted forecasting components and transforms it into an optimized daily room price.

The platform includes:

- 📊 Dynamic price recommendation engine  
- 📈 Revenue simulator (AI vs static pricing comparison)  
- 🔁 Backtest mode with MAE & MAPE evaluation  
- 📅 30-day occupancy & revenue forecasting  
- 🔐 Secure SaaS architecture  

---

## 🧠 Demand Score Model

All components are normalized to a 0–1 scale.

```math
Demand Score =
w1·Historical +
w2·Trend +
w3·Seasonality +
w4·Event +
w5·BookingPace
```

Where:

- `Historical` — weekday structural demand  
- `Trend` — 7-day demand momentum  
- `Seasonality` — 30-day seasonal pattern  
- `Event` — local event impact  
- `BookingPace` — booking velocity vs historical pickup  

**Constraint:**

```math
\sum wi = 1
```

Weights are calibrated via backtesting to minimize prediction error (MAPE).

---

## 💰 Pricing Logic

After calculating the Demand Score, QonaqAI applies a non-linear pricing transformation:

- Low Demand (0–40) → Defensive pricing  
- Medium Demand (40–70) → Balanced optimization  
- High Demand (70–100) → Profit maximization  

This ensures smooth adaptation to market conditions.

---

## 📊 Revenue Simulator

The simulator compares:

- Static room rate  
- AI-optimized room rate  

And calculates:

- Occupancy %
- Revenue
- Underpricing / Overpricing loss
- Revenue uplift

---

## 🔁 Backtest Mode

Upload historical CSV data:

```
date, rooms_available, rooms_sold, average_daily_rate, cancellations
```

The system evaluates:

- AI vs Actual revenue  
- Revenue uplift  
- MAE  
- MAPE  
- Model accuracy  

---

## 🛠 Tech Stack

### Frontend
- React
- Vite
- TypeScript

### Backend
- Supabase (Auth & Database)
- PostgreSQL
- AI-based forecasting logic

### External APIs
- Ticketmaster API (event signals)
- OpenWeather API (weather signals)

---

## 🎯 Mission

To make advanced AI-driven revenue optimization accessible to every independent hotel.

---

## 📌 Status

Early-stage SaaS prototype with working backtest validation and revenue simulation.

