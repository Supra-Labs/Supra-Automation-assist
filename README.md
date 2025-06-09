# Supra Automation Assist

## ✨ Features:

- Real-time epoch countdown with live updates

- Auto-calculated expiry times using the exact formula you provided

- Automation fee estimation using the Supra API

- One-click copy for all values

- CLI Command generation for Automation registry by Selecting Deployed Module and Entry Function!

- Fetches live data from Supra RPC endpoints

- Calculates expiry time using your exact formula: 
`last_reconfiguration_time/1000000 + 7200(EPOCH Intervel) + 300(buffer)`

- Auto-updates every 30 seconds

- Countdown timer updates every second

## 📋 Ready-to-Use Values:

- `--task-expiry-time-secs` (calculated automatically)
- `--task-automation-fee-cap` (fetched from API)
- Complete CLI command template