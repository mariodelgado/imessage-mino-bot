# MIRA Integration Plan

## Overview

Integrate [MIRA OSS](https://github.com/taylorsatula/mira-OSS) - a persistent AI entity with memory decay and self-directed tools - into the Mino iMessage bot.

---

## What MIRA Brings

### Core Concepts

1. **Persistent Memory with Decay** - Memories fade unless reinforced (like human memory)
2. **Self-Directed Tools** - Tools auto-register and expire when unused
3. **Event-Driven Architecture** - "Sleep" cycles for memory consolidation
4. **Single Eternal Thread** - One conversation forever, not sessions

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MINO + MIRA INTEGRATION                               │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │    iMessage     │
                              │   (User Input)  │
                              └────────┬────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           MINO BOT (index.ts)                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Security    │  │  Guardrails  │  │ Rate Limit   │  │ User Model   │     │
│  │  Module      │  │  Content     │  │ Per-phone    │  │ Personalize  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘     │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    ▼                  ▼                  ▼
         ┌─────────────────┐  ┌───────────────┐  ┌───────────────────┐
         │  Gemini Router  │  │    MIRA CNS   │  │   Mino Browser    │
         │  (Intent/Chat)  │  │  (NEW LAYER)  │  │   Automation      │
         └─────────────────┘  └───────┬───────┘  └───────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
              ▼                       ▼                       ▼
    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
    │  WORKING MEMORY │    │   LT MEMORY     │    │   TOOL MANAGER  │
    │  (In-Memory)    │    │  (SQLite)       │    │  (Self-Direct)  │
    │                 │    │                 │    │                 │
    │ • Current ctx   │    │ • Decaying mem  │    │ • Auto-register │
    │ • Session state │    │ • Domain docs   │    │ • Auto-expire   │
    │ • Recent msgs   │    │ • Relationships │    │ • On-demand     │
    └─────────────────┘    └─────────────────┘    └─────────────────┘
              │                       │                       │
              └───────────────────────┼───────────────────────┘
                                      │
                                      ▼
                          ┌─────────────────────┐
                          │   EVENT PROCESSOR   │
                          │                     │
                          │ • SegmentCollapse   │
                          │   (120 min idle)    │
                          │ • MemoryDecay       │
                          │   (daily cycle)     │
                          │ • DreamConsolidate  │
                          │   (pattern extract) │
                          └─────────────────────┘
```

---

## Memory Decay Model

```
        Strength
           │
      1.0 ─┤  ★ New memory created
           │   \
      0.8 ─┤    \
           │     \  ← Natural decay (half-life: 7 days)
      0.6 ─┤      \
           │       ★ Referenced! (boost +0.3)
      0.4 ─┤      /\
           │     /  \
      0.2 ─┤    /    \
           │   /      \
      0.0 ─┤──/────────★─── Memory forgotten (threshold: 0.1)
           └──┴──┴──┴──┴──┴──► Time (days)
              1  3  7  14 30
```

### Decay Formula

```
strength = initial_strength * (0.5 ^ (days_since_last_access / half_life))
```

- **Half-life**: 7 days (configurable per memory type)
- **Boost on access**: +0.3 (capped at 1.0)
- **Forget threshold**: 0.1 (below this, memory is pruned)

---

## Tool Self-Management

```
┌──────────────────────────────────────────────────────────────────┐
│                      TOOL REPOSITORY                              │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐         │
│  │ Mino   │ │ Maps   │ │ Voice  │ │Weather │ │Calendar│  ...    │
│  │Browser │ │        │ │        │ │        │ │        │         │
│  └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘         │
│      │ Always   │ On      │ On      │ On      │ On              │
│      │ Active   │ Demand  │ Demand  │ Demand  │ Demand          │
└──────┼──────────┴─────────┴─────────┴─────────┴─────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│                      ACTIVE TOOLS (Token Budget)                  │
│                                                                   │
│  Turn 1: [Mino] ─────────────────────────────────────────        │
│  Turn 2: [Mino, Weather] ────────────────────────────────        │
│  Turn 3: [Mino, Weather, Maps] ──────────────────────────        │
│  Turn 4: [Mino, Maps] ─────────────────── Weather expires        │
│  Turn 5: [Mino] ─────────────────────────── Maps expires         │
│                                                                   │
│  Rule: Tool expires after 5 turns of non-use                     │
└──────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Phase 1: Memory System
- [ ] Create `mira/memory.ts` - Long-term memory with decay
- [ ] Create `mira/working-memory.ts` - Session/context management
- [ ] Add memory tables to SQLite schema
- [ ] Implement decay algorithm with half-life

### Phase 2: Event Processor
- [ ] Create `mira/events.ts` - Event-driven processing
- [ ] Implement SegmentCollapse (idle timeout → consolidate)
- [ ] Implement MemoryDecay (periodic pruning)
- [ ] Add background processing loop

### Phase 3: Tool Manager
- [ ] Create `mira/tools.ts` - Self-registering tools
- [ ] Implement tool activation/deactivation
- [ ] Add TTL (time-to-live) for unused tools
- [ ] Integrate with existing Mino tools

### Phase 4: Integration
- [ ] Connect MIRA memory to Gemini context
- [ ] Add memory recall to chat responses
- [ ] Update user model to use MIRA memories
- [ ] Add "remember" and "forget" capabilities

---

## Database Schema

```sql
-- Long-term memories with decay
CREATE TABLE mira_memories (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  content TEXT NOT NULL,
  memory_type TEXT DEFAULT 'episodic',  -- episodic, semantic, procedural
  strength REAL DEFAULT 1.0,
  importance REAL DEFAULT 0.5,
  embedding BLOB,  -- for semantic search
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_accessed TEXT DEFAULT CURRENT_TIMESTAMP,
  access_count INTEGER DEFAULT 1,
  related_memories JSON DEFAULT '[]',
  metadata JSON DEFAULT '{}'
);

-- Memory relationships (for association)
CREATE TABLE mira_memory_links (
  source_id TEXT,
  target_id TEXT,
  link_type TEXT,  -- 'related', 'caused_by', 'leads_to'
  strength REAL DEFAULT 0.5,
  PRIMARY KEY (source_id, target_id)
);

-- Domain documents (permanent, no decay)
CREATE TABLE mira_domaindocs (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  doc_type TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

-- Tool state tracking
CREATE TABLE mira_tool_state (
  tool_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  last_used TEXT,
  use_count INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 0,
  PRIMARY KEY (tool_name, phone)
);
```

---

## Key Integration Points

| Mino Feature | MIRA Enhancement |
|--------------|------------------|
| User Model (user-model.ts) | Augment with MIRA's decaying LT memory |
| Conversation History | Add memory recall from past conversations |
| Gemini Router | Memory-aware context injection |
| Scheduler/Alerts | MIRA event processor for timing |
| Security Module | Keep as-is, works alongside MIRA |

---

## Benefits

1. **True Persistence** - "Remember you asked about Philz 3 weeks ago"
2. **Organic Forgetting** - Unused info fades naturally
3. **Token Efficiency** - Only load relevant memories
4. **Sleep Cycles** - Background memory consolidation
5. **Relationship Mapping** - Connect related memories
6. **Natural Recall** - "Last time we talked about..." patterns

---

## References

- [MIRA OSS Repository](https://github.com/taylorsatula/mira-OSS)
- [MIRA Philosophy](https://miraos.org)
