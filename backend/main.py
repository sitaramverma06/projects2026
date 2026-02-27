"""
SENTRIX — Real-Time Social Media Sentiment Analysis Platform
Backend: FastAPI + Python
"""

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import asyncio, random, time, uuid

app = FastAPI(title="SENTRIX Sentiment API", version="2.4.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Schemas ──────────────────────────────────
class TrackRequest(BaseModel):
    keyword: str
    language: str = "en"
    sources: List[str] = ["twitter", "reddit", "news"]

# ── Mock Data Store (mirrors HDFS / S3) ──────
class MockDataStore:
    @staticmethod
    def get_timeseries(keyword: str, hours: int = 24):
        import math
        now = time.time()
        result = []
        for i in range(hours):
            base = 40 + math.sin(i * 0.4) * 15
            pos = max(5, min(85, base + random.uniform(0, 20)))
            neg = max(5, min(50, 100 - pos - random.uniform(20, 40)))
            neu = max(5, 100 - pos - neg)
            result.append({
                "time": time.strftime("%H:%M", time.localtime(now - (hours - i) * 3600)),
                "positive": round(pos, 1), "negative": round(neg, 1),
                "neutral": round(neu, 1), "volume": random.randint(500, 5000),
                "compound": round(pos - neg, 2),
            })
        return result

    @staticmethod
    def get_distribution(keyword: str):
        pos = random.uniform(35, 60)
        neg = random.uniform(15, 35)
        return [
            {"name": "Positive", "value": round(pos, 1), "color": "#00ffa3"},
            {"name": "Neutral",  "value": round(max(5, 100-pos-neg), 1), "color": "#00d4ff"},
            {"name": "Negative", "value": round(neg, 1), "color": "#ff4d6d"},
        ]

    @staticmethod
    def get_insights(keyword: str):
        return [
            {"type": "spike",    "icon": "↑", "label": "Positive Spike Detected",
             "detail": f'Sentiment for "{keyword}" surged +34% in last 2 hours.', "severity": "success"},
            {"type": "anomaly",  "icon": "⚡", "label": "Anomaly Identified",
             "detail": "12% of posts flagged by LSTM anomaly classifier.", "severity": "warning"},
            {"type": "forecast", "icon": "◉", "label": "24h Forecast",
             "detail": "68% probability of sustained positive sentiment (confidence: 0.81).", "severity": "info"},
        ]

store = MockDataStore()

# ── Sentiment Engine Placeholder ──────────────
class SentimentEngine:
    """
    BiLSTM + Multi-Head Attention inference stub.
    Replace predict() body with TorchServe call in production.
    Architecture: Embedding(768) → BiLSTM×2(512) → Attention(8h) → Softmax(3)
    """
    MODEL_META = {
        "architecture": "BiLSTM + Multi-Head Attention",
        "layers": [
            {"name": "Embedding",        "params": "768-dim, GloVe + fine-tuned"},
            {"name": "BiLSTM × 2",       "params": "512 hidden units, dropout 0.3"},
            {"name": "Attention",         "params": "8 heads, 64-dim key/value"},
            {"name": "Dense Classifier", "params": "3-class softmax"},
        ],
        "metrics": {"accuracy": 0.923, "f1": 0.918, "auc": 0.971, "latency_ms": 18},
        "pipeline": ["Tokenize → BPE", "LSTM Encode", "Attend", "Classify", "Stream to Kafka"],
    }

    @staticmethod
    def predict(text: str):
        pos = max(0.05, min(0.95, 0.5 + random.gauss(0.05, 0.25)))
        neg = max(0.05, min(0.90, (1 - pos) * random.uniform(0.2, 0.6)))
        neu = max(0.05, 1 - pos - neg)
        label = max([("positive", pos), ("negative", neg), ("neutral", neu)], key=lambda x: x[1])[0]
        return {"label": label, "scores": {"positive": round(pos, 4), "negative": round(neg, 4), "neutral": round(neu, 4)},
                "confidence": round(max(pos, neg, neu), 4), "latency_ms": round(random.uniform(12, 28), 1)}

engine = SentimentEngine()

# ── REST Endpoints ────────────────────────────
@app.get("/")
def root():
    return {"service": "SENTRIX API", "version": "2.4.1", "status": "online"}

@app.post("/api/v1/track")
async def track_keyword(req: TrackRequest):
    job_id = f"job_{uuid.uuid4().hex[:8]}"
    slug   = req.keyword.lower().replace(" ", "_").replace("#", "")
    return {"job_id": job_id, "keyword": req.keyword, "status": "streaming",
            "stream_url": f"/ws/sentiment/{slug}",
            "estimated_posts_per_min": random.randint(120, 1000)}

@app.get("/api/v1/sentiment/timeseries")
def get_timeseries(keyword: str = "AI", hours: int = 24):
    return {"keyword": keyword, "data": store.get_timeseries(keyword, hours)}

@app.get("/api/v1/sentiment/distribution")
def get_distribution(keyword: str = "AI"):
    return {"keyword": keyword, "distribution": store.get_distribution(keyword)}

@app.get("/api/v1/trends/insights")
def get_insights(keyword: str = "AI"):
    return {"keyword": keyword, "insights": store.get_insights(keyword)}

@app.get("/api/v1/model/metadata")
def get_model_metadata():
    return SentimentEngine.MODEL_META

@app.post("/api/v1/sentiment/predict")
def predict(payload: dict):
    text = payload.get("text", "")
    if not text:
        raise HTTPException(400, "text field required")
    return engine.predict(text)

@app.get("/api/v1/platform/breakdown")
def get_platform_breakdown(keyword: str = "AI"):
    return {"keyword": keyword, "platforms": [
        {"platform": "Twitter/X", "posts": 42300, "positive": 48, "negative": 22, "neutral": 30},
        {"platform": "Reddit",    "posts": 18700, "positive": 35, "negative": 38, "neutral": 27},
        {"platform": "News",      "posts":  9100, "positive": 40, "negative": 28, "neutral": 32},
        {"platform": "Blogs",     "posts":  5400, "positive": 55, "negative": 18, "neutral": 27},
    ]}

# ── WebSocket Stream ──────────────────────────
@app.websocket("/ws/sentiment/{slug}")
async def websocket_stream(ws: WebSocket, slug: str):
    """Simulates Spark Structured Streaming micro-batches every 3 seconds."""
    await ws.accept()
    prev_pos = 50.0
    try:
        while True:
            pos = max(5, min(85, prev_pos + random.gauss(0, 4)))
            neg = max(5, min(50, random.uniform(15, 35)))
            prev_pos = pos
            await ws.send_json({
                "keyword": slug, "timestamp": time.strftime("%H:%M:%S"),
                "positive": round(pos, 1), "negative": round(neg, 1),
                "neutral": round(max(5, 100-pos-neg), 1),
                "volume": random.randint(500, 5000), "compound": round(pos-neg, 2),
            })
            await asyncio.sleep(3)
    except WebSocketDisconnect:
        pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
