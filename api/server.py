from fastapi import FastAPI
from datetime import datetime

app = FastAPI(
    title="Autonomous AI Trading API",
    version="0.1.0"
)


@app.get("/")
def root():
    return {
        "system": "Autonomous AI Trading",
        "status": "online",
        "mode": "research/paper",
        "live_trading": False
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/status")
def status():
    return {
        "system": "Autonomous AI Trading",
        "api": "operational",
        "risk_engine": "not_connected",
        "execution_engine": "disabled",
        "live_trading": False
    }


@app.post("/webhook/tradingview")
def tradingview_webhook(signal: dict):

    return {
        "received": True,
        "message": "TradingView signal received",
        "signal": signal,
        "live_execution": False
    }