# DNS AI Agent

Query your AI assistant from anywhere via DNS TXT records.

## Quick Start

```bash
# 1. Set up dumbdns
./scripts/setup-dumbdns.sh

# 2. Set your API key
export GEMINI_API_KEY=your-key

# 3. Run the agent
./run-dns-agent.sh
```

## Usage

### Local Queries

```bash
# Basic query
dig @127.0.0.1 "hello" TXT

# Ask a question
dig @127.0.0.1 "what is the capital of france" TXT

# Get a joke
dig @127.0.0.1 "tell me a joke" TXT
```

### Remote Queries

From any device on your network:
```bash
dig @192.168.1.X "your question" TXT
```

From anywhere (requires port forwarding):
```bash
dig @your-public-ip "your question" TXT
```

## How It Works

```
┌─────────────┐     UDP/53      ┌──────────┐     HTTP      ┌───────────┐
│   dig CLI   │ ──────────────> │ dumbdns  │ ────────────> │ TGI Proxy │
│ (any device)│ <────────────── │ (Go)     │ <──────────── │ (Gemini)  │
└─────────────┘   TXT record    └──────────┘    JSON       └───────────┘
```

1. **dig** sends a DNS TXT query to dumbdns
2. **dumbdns** forwards the query to the TGI proxy as HTTP POST
3. **TGI proxy** translates to Gemini API and gets response
4. Response flows back as a DNS TXT record

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | (required) | Your Gemini API key |
| `TGI_PROXY_PORT` | 8080 | Port for TGI proxy |
| `DNS_PORT` | 53 | DNS server port |
| `DNS_DOMAIN` | ai.local | Domain for DNS queries |

## Port Forwarding

To access from anywhere:

1. Forward UDP port 53 on your router to your Mac
2. Note your public IP (or use dynamic DNS)
3. Query: `dig @your-public-ip "question" TXT`

**Security note**: This exposes your AI to the internet. Consider:
- Using a non-standard port (requires `dig -p PORT`)
- Setting up firewall rules to limit source IPs
- Running behind a VPN

## Auto-Start (Optional)

To start the DNS agent on login:

```bash
launchctl load ~/Library/LaunchAgents/com.mino.dns-agent.plist
```

To stop auto-start:

```bash
launchctl unload ~/Library/LaunchAgents/com.mino.dns-agent.plist
```

## Limitations

- **255 character limit**: DNS TXT records are limited to 255 chars
- **No conversation history**: Each query is independent
- **UDP only**: Standard DNS transport

## Troubleshooting

### "Port 53 requires sudo"

Port 53 is privileged. The script will prompt for sudo, or use a higher port:

```bash
DNS_PORT=5353 ./run-dns-agent.sh
dig @127.0.0.1 -p 5353 "hello" TXT
```

### "dumbdns: command not found"

Add Go bin to your PATH:

```bash
export PATH="$PATH:$HOME/go/bin"
```

### Check if services are running

```bash
# Check TGI proxy
curl -X POST http://localhost:8080 \
  -H "Content-Type: application/json" \
  -d '{"inputs": "hello"}'

# Check DNS
dig @127.0.0.1 "test" TXT
```
