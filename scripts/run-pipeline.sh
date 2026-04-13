#!/bin/bash
# ClimatePulse daily pipeline trigger
# Runs at 5am Sydney time via local crontab
# Requires the dev server to be running on port 3030

LOG_DIR="/Users/sa/Desktop/climatepulse/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/pipeline-$(date +%Y-%m-%d).log"

echo "=== Pipeline run $(date) ===" >> "$LOG_FILE"

# Check if dev server is running
if ! curl -s -o /dev/null -w "" http://localhost:3030/ 2>/dev/null; then
  echo "ERROR: Dev server not running on port 3030, skipping" >> "$LOG_FILE"
  exit 1
fi

# Trigger pipeline
curl -s -X POST http://localhost:3030/api/pipeline/run \
  -H "Content-Type: application/json" \
  >> "$LOG_FILE" 2>&1

echo "" >> "$LOG_FILE"
echo "=== Done $(date) ===" >> "$LOG_FILE"
