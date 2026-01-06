#!/bin/bash
# Post-compaction hook to recall relevant memory from memvid
set -e
cd "$CLAUDE_PROJECT_DIR/.claude/hooks"
cat | npx tsx post-compact-memory.ts
