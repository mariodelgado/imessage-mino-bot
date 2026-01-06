#!/bin/bash
# Setup cron job for daily investor briefing at 6:00 AM PT

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PIPELINE_SCRIPT="$PROJECT_DIR/scripts/investor-briefing-pipeline.ts"
LOG_FILE="$PROJECT_DIR/logs/briefing-pipeline.log"

# Create logs directory
mkdir -p "$PROJECT_DIR/logs"

# Cron job entry
# 0 6 = 6:00 AM
# Runs Monday-Friday (1-5)
CRON_ENTRY="0 6 * * 1-5 cd $PROJECT_DIR && /usr/local/bin/npx ts-node $PIPELINE_SCRIPT >> $LOG_FILE 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "investor-briefing-pipeline"; then
    echo "Cron job already exists. Updating..."
    # Remove existing entry
    crontab -l | grep -v "investor-briefing-pipeline" | crontab -
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -

echo "✅ Cron job installed!"
echo ""
echo "Schedule: Every weekday at 6:00 AM PT"
echo "Script: $PIPELINE_SCRIPT"
echo "Log: $LOG_FILE"
echo ""
echo "To verify: crontab -l"
echo "To remove: crontab -l | grep -v investor-briefing-pipeline | crontab -"
