#!/bin/bash
# Mino Bot Watchdog
# Monitors the bot and restarts if not running or unresponsive

BOT_DIR="/Users/marioelysian/imessage-mino-bot"
LOG_FILE="$BOT_DIR/bot.log"
WATCHDOG_LOG="$BOT_DIR/watchdog.log"
PID_FILE="$BOT_DIR/bot.pid"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$WATCHDOG_LOG"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

is_running() {
  pgrep -f "tsx.*index.ts" > /dev/null 2>&1
}

check_responsive() {
  # Check if log file was modified in the last 5 minutes
  if [ -f "$LOG_FILE" ]; then
    local last_modified=$(stat -f %m "$LOG_FILE" 2>/dev/null || stat -c %Y "$LOG_FILE" 2>/dev/null)
    local now=$(date +%s)
    local diff=$((now - last_modified))

    # If log hasn't been updated in 5 minutes and there are no recent "Watching" messages
    # it might be stuck, but this is a soft check
    if [ $diff -gt 300 ]; then
      return 1
    fi
  fi
  return 0
}

start_bot() {
  log "Starting bot..."
  cd "$BOT_DIR"

  # Kill any zombie processes
  pkill -f "tsx.*index.ts" 2>/dev/null
  sleep 2

  # Start the bot
  nohup npx tsx --env-file=.env index.ts > "$LOG_FILE" 2>&1 &
  local pid=$!
  echo $pid > "$PID_FILE"

  sleep 3

  if is_running; then
    log "Bot started successfully (PID: $pid)"
    return 0
  else
    log "ERROR: Failed to start bot"
    return 1
  fi
}

check_for_errors() {
  # Check last 20 lines for fatal errors
  if [ -f "$LOG_FILE" ]; then
    if tail -20 "$LOG_FILE" | grep -q "FATAL\|Unhandled\|ECONNREFUSED\|SyntaxError\|Cannot find module"; then
      return 1
    fi
  fi
  return 0
}

# Main check
main() {
  if ! is_running; then
    log "Bot not running - restarting..."
    start_bot
  elif ! check_for_errors; then
    log "Bot has errors in log - restarting..."
    start_bot
  else
    # Silently running OK
    :
  fi
}

# Run with optional verbose flag
if [ "$1" = "-v" ] || [ "$1" = "--verbose" ]; then
  log "Watchdog check - Bot is $(is_running && echo 'running' || echo 'NOT running')"
fi

main
