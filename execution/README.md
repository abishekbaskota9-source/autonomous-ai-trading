# Execution Engine

This module will handle trade execution after all safety checks pass.

## Execution Flow

TradingView Signal
↓
Webhook
↓
Signal Validation
↓
ML Validation
↓
Risk Guardian
↓
Position Size Calculation
↓
Paper Execution
↓
Trade Journal

## Initial Mode

PAPER TRADING ONLY

## Future Execution

- MT5
- Broker API
- Order Management
- Stop Loss
- Take Profit
- Position Monitoring

## Safety Rules

- No direct AI-to-broker execution
- Risk Guardian approval required
- Stop Loss required
- Duplicate orders rejected
- Invalid orders rejected

## Status

BUILD 06 - Execution Engine