#!/bin/bash
#
# Setup dumbdns for DNS-based AI access
#
# This script installs dumbdns and configures it to work with the TGI proxy.
# After setup, you can query your AI from anywhere via DNS TXT records.
#
# Usage: ./scripts/setup-dumbdns.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "╔═══════════════════════════════════════════╗"
echo "║     dumbdns Setup for Mino                ║"
echo "╚═══════════════════════════════════════════╝"
echo

# Check for Go
if ! command -v go &> /dev/null; then
    echo "❌ Go is required but not installed."
    echo
    echo "Install Go:"
    echo "  brew install go"
    echo
    echo "Or download from: https://go.dev/dl/"
    exit 1
fi

echo "✓ Go $(go version | awk '{print $3}')"

# Install dumbdns
echo
echo "📦 Installing dumbdns..."
if command -v dumbdns &> /dev/null; then
    echo "✓ dumbdns already installed"
else
    go install github.com/Shell-Company/dumbdns@latest

    # Check if GOPATH/bin is in PATH
    GOBIN="${GOPATH:-$HOME/go}/bin"
    if [[ ":$PATH:" != *":$GOBIN:"* ]]; then
        echo
        echo "⚠️  Add Go bin to your PATH:"
        echo "    export PATH=\"\$PATH:$GOBIN\""
        echo
        echo "Add this to your ~/.zshrc or ~/.bashrc"
    fi

    echo "✓ dumbdns installed"
fi

# Create run script
cat > "$PROJECT_DIR/run-dns-agent.sh" << 'EOF'
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
    sudo dumbdns -tgi-url "http://localhost:$TGI_PORT" -port "$DNS_PORT" -domain "$DOMAIN" &
else
    dumbdns -tgi-url "http://localhost:$TGI_PORT" -port "$DNS_PORT" -domain "$DOMAIN" &
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
EOF

chmod +x "$PROJECT_DIR/run-dns-agent.sh"

echo
echo "✓ Created run-dns-agent.sh"
echo

# Create launchd plist for auto-start (optional)
PLIST_PATH="$HOME/Library/LaunchAgents/com.mino.dns-agent.plist"
cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.mino.dns-agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>$PROJECT_DIR/run-dns-agent.sh</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$PROJECT_DIR</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:${GOPATH:-$HOME/go}/bin</string>
    </dict>
    <key>RunAtLoad</key>
    <false/>
    <key>KeepAlive</key>
    <false/>
    <key>StandardOutPath</key>
    <string>$PROJECT_DIR/logs/dns-agent.log</string>
    <key>StandardErrorPath</key>
    <string>$PROJECT_DIR/logs/dns-agent.error.log</string>
</dict>
</plist>
EOF

echo "✓ Created launchd plist (optional auto-start)"
echo

# Summary
echo "═══════════════════════════════════════════"
echo "✅ Setup complete!"
echo
echo "To start the DNS AI agent:"
echo "  cd $PROJECT_DIR"
echo "  export GEMINI_API_KEY=your-key"
echo "  ./run-dns-agent.sh"
echo
echo "To auto-start on login (optional):"
echo "  launchctl load ~/Library/LaunchAgents/com.mino.dns-agent.plist"
echo
echo "To query from anywhere:"
echo "  dig @<your-ip> \"your question here\" TXT"
echo
echo "For remote access, port forward UDP 53 on your router."
echo "═══════════════════════════════════════════"
