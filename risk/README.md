# Risk Guardian

This module controls all trading risk.

## Initial Risk Rules

- Risk per trade: 0.25%
- Maximum daily loss: 1%
- Maximum drawdown: 5%
- Mandatory Stop Loss: Yes
- Duplicate trades: Rejected
- Invalid position size: Rejected
- High spread: Rejected
- Major news risk: Rejected

## Risk Flow

Signal
↓
Risk Guardian
↓
Validation
↓
Approve / Reject
↓
Execution

## Important

The AI model cannot bypass the Risk Guardian.

The Risk Guardian has final authority over trade execution.

## Status

BUILD 04 - Risk Guardian