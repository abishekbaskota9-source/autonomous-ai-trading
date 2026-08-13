from pydantic import BaseModel
from typing import Optional


class TradingSignal(BaseModel):
    symbol: str
    direction: str
    entry: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    timeframe: Optional[str] = None
    strategy: Optional[str] = None