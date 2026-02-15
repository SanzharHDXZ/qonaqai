QonaqAI
QonaqAI is an AI-powered revenue intelligence platform designed for independent hotels (20–150 rooms).
The system replaces static pricing strategies with dynamic, data-driven optimization based on real-time market signals.
🚀 What It Does
QonaqAI calculates a structured Demand Score (0–100) using weighted forecasting components:
Historical weekday performance
7-day demand trend
30-day seasonality patterns
Local event impact
Booking pace velocity
All components are normalized and combined using calibrated weights to generate an optimized daily room price.
The platform includes:
📊 Dynamic price recommendation engine
📈 Revenue simulator (AI vs static pricing comparison)
🔁 Backtest mode with MAE & MAPE evaluation
📅 30-day occupancy & revenue forecasting
🔐 Secure SaaS architecture with Supabase
🧠 How It Works
Demand Score Model:
Demand Score =
w1·Historical +
w2·Trend +
w3·Seasonality +
w4·Event +
w5·Booking Pace
Weights are calibrated via backtesting to minimize prediction error.
The demand score is transformed into price using a non-linear pricing model to ensure smooth adaptation to market conditions.
🛠 Tech Stack
Frontend:
React
Vite
TypeScript
Modular dashboard architecture
Backend:
Supabase (authentication & database)
PostgreSQL
AI-based forecasting logic
APIs:
Ticketmaster API (event data)
OpenWeather API (weather signals)
🎯 Mission
To make advanced AI-driven revenue optimization accessible to every independent hotel.
📌 Project Status
Early-stage SaaS prototype with working backtest validation and revenue simulation.
