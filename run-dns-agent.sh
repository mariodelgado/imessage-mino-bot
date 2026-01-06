#!/bin/bash
#
# Run the DNS-based AI agent
#
# This starts both the TGI proxy and dumbdns.
# Query your AI from anywhere: dig @<your-ip> "what is 2+2" TXT
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Configuration
TGI_PORT="${TGI_PROXY_PORT:-8080}"
DNS_PORT="${DNS_PORT:-53}"
DOMAIN="${DNS_DOMAIN:-ai.local}"

# Check for GEMINI_API_KEY
if [ -z "$GEMINI_API_KEY" ]; then
    echo "❌ GEMINI_API_KEY not set"
    echo "   export GEMINI_API_KEY=your-key"
    exit 1
fi

echo "╔═══════════════════════════════════════════╗"
echo "║     DNS AI Agent                          ║"
echo "╚═══════════════════════════════════════════╝"
echo
echo "🌐 TGI Proxy: http://localhost:$TGI_PORT"
echo "📡 DNS Server: port $DNS_PORT"
echo "🔗 Domain: $DOMAIN"
echo

# Function to cleanup on exit
cleanup() {
    echo
    echo "⏹️  Shutting down..."
    kill $TGI_PID 2>/dev/null || true
    kill $DNS_PID 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM

# Start TGI proxy in background
echo "Starting TGI proxy..."
npx tsx "$SCRIPT_DIR/tgi-proxy.ts" &
TGI_PID=$!

# Wait for TGI proxy to start
sleep 2

if ! kill -0 $TGI_PID 2>/dev/null; then
    echo "❌ TGI proxy failed to start"
    exit 1
fi

echo "✓ TGI proxy running (PID: $TGI_PID)"
echo

# Start dumbdns
echo "Starting dumbdns..."

# Check if we need sudo for port 53
if [ "$DNS_PORT" -lt 1024 ]; then
    echo "⚠️  Port $DNS_PORT requires sudo"
    sudo dumbdns -llm-endpoint "http://localhost:$TGI_PORT" -dns-listening-address ":$DNS_PORT" -llm-max-new-tokens 100 -verbose &
else
    dumbdns -llm-endpoint "http://localhost:$TGI_PORT" -dns-listening-address ":$DNS_PORT" -llm-max-new-tokens 100 -verbose &
fi
DNS_PID=$!

sleep 1

if ! kill -0 $DNS_PID 2>/dev/null; then
    echo "❌ dumbdns failed to start"
    kill $TGI_PID 2>/dev/null || true
    exit 1
fi

echo "✓ dumbdns running (PID: $DNS_PID)"
echo

# Get local IP for instructions
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || echo "your-ip")

echo "═══════════════════════════════════════════"
echo "🎉 DNS AI Agent is running!"
echo
echo "Query examples:"
echo "  dig @$LOCAL_IP \"hello\" TXT"
echo "  dig @$LOCAL_IP \"what is the capital of france\" TXT"
echo "  dig @127.0.0.1 \"tell me a joke\" TXT"
echo
echo "From anywhere (if port forwarded):"
echo "  dig @<your-public-ip> \"your question\" TXT"
echo
echo "Press Ctrl+C to stop"
echo "═══════════════════════════════════════════"

# Wait for processes
wait $DNS_PID $TGI_PID
