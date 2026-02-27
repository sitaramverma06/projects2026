# SENTRIX — Sentiment Intelligence Platform

Real-Time Social Media Sentiment Analysis & Trend Prediction
Built with React + FastAPI + BiLSTM + Multi-Head Attention

---

## SETUP INSTRUCTIONS (Do these in order)

### STEP 1 — Open in VS Code
Double-click `sentrix.code-workspace` to open the full project in VS Code.

---

### STEP 2 — Run the Frontend

Open a terminal in VS Code (Ctrl + ` ) and run:

    cd frontend
    npm install
    npm start

The dashboard opens at → http://localhost:3000

> NOTE: The dashboard works fully WITHOUT the backend running.
> The mock data layer inside React simulates all live data.

---

### STEP 3 — Run the Backend (optional)

Open a SECOND terminal (click the + icon in the terminal panel):

    cd backend
    pip install -r requirements.txt
    python main.py

The API runs at → http://localhost:8000
Interactive API docs → http://localhost:8000/docs

---

## Project Structure

    sentrix/
    ├── frontend/
    │   ├── src/
    │   │   ├── App.js          ← Full React dashboard (all 4 tabs)
    │   │   └── index.js        ← Entry point
    │   ├── public/
    │   │   └── index.html
    │   └── package.json
    │
    ├── backend/
    │   ├── main.py             ← FastAPI server (all endpoints)
    │   └── requirements.txt
    │
    └── sentrix.code-workspace  ← Open this in VS Code

---

## Features

  Dashboard Tab    — Live area chart, pie chart, bar chart, stat cards
  Data Input Tab   — Keyword tracker, streaming jobs, pipeline health
  Model Engine Tab — BiLSTM architecture, radar metrics, inference pipeline
  Trend Insights   — AI signals, compound score chart, heatmap

---

## API Endpoints (when backend is running)

  GET  /                              Health check
  POST /api/v1/track                  Start tracking a keyword
  GET  /api/v1/sentiment/timeseries   24h sentiment data
  GET  /api/v1/sentiment/distribution Pos/Neg/Neutral breakdown
  POST /api/v1/sentiment/predict      Analyze a single text
  GET  /api/v1/trends/insights        AI-generated insights
  GET  /api/v1/model/metadata         Model architecture info
  WS   /ws/sentiment/{keyword}        Live WebSocket stream

---

## Tech Stack

  Frontend  : React 18, Recharts, CSS-in-JS
  Backend   : Python, FastAPI, Uvicorn
  Model     : BiLSTM + Multi-Head Attention (placeholder)
  Streaming : WebSocket (mocks Kafka + Spark pipeline)
  Storage   : Mock store (mirrors HDFS / S3 interface)
