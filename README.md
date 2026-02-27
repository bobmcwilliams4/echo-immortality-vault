# Echo Immortality Vault

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/bobmcwilliams4/echo-immortality-vault)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)](https://echo-immortality-vault.bmcii1976.workers.dev)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

> **Preserve consciousness forever.** A digital legacy platform that captures memories, stories, wisdom, and personality — then lets future generations have real conversations with your preserved consciousness.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Echo Immortality Vault                       │
│               Cloudflare Worker (Hono + D1)                  │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│ Conscious│ Interview│  Family  │  Voice   │  Gamification   │
│   Chat   │  Engine  │   Tree   │  Clone   │    System       │
├──────────┴──────────┴──────────┴──────────┴─────────────────┤
│                    Service Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ AI Service   │  │ Memory Svc   │  │ Voice Svc    │      │
│  │ (Orchestrator│  │ (Shared Brain│  │ (ElevenLabs) │      │
│  │  29 LLMs)   │  │  Vectorize)  │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
├──────────────────────────────────────────────────────────────┤
│  D1 Database (7 tables) │ Service Bindings (3 Workers)      │
└──────────────────────────────────────────────────────────────┘
```

## Features

### Consciousness Preservation
- **AI Chat** — Converse with a preserved consciousness built from interview answers, memories, and personality patterns
- **Emotion Detection** — Automatic keyword-based emotion analysis (joy, sadness, love, nostalgia, pride, wisdom, humor, concern, excitement)
- **Session Management** — Persistent chat sessions with full message history

### Intelligent Interview Engine
- **216 Questions** across 12 life categories (childhood, family, career, love, hardship, wisdom, values, achievements, daily life, dreams, legacy, humor)
- **6 Session Types** — Morning Brief (quick), Afternoon Deep (exploratory), Evening Story (narrative), Quick Capture, Legacy Session (comprehensive), Emergency Mode (critical)
- **Adaptive Selection** — Prioritizes coverage gaps, avoids repeats
- **AI Follow-ups** — LLM-generated follow-up questions based on answers

### Family Tree
- Full CRUD for family members (name, relationship, birth/death dates, bio, photos)
- Linked to vault user for cross-generational connections

### Voice Cloning
- **ElevenLabs Integration** — Upload voice samples, clone a voice, synthesize speech
- **Emotion-Aware TTS** — 8 emotion presets (joy, sadness, love, nostalgia, pride, wisdom, humor, excitement) with tuned stability/similarity/style settings
- **Voice Profile Management** — Track clone status, sample count, quality scores

### Gamification
- **12 Achievements** — Unlock milestones (First Memory, Storyteller, Voice Clone, Digital Immortal, etc.)
- **Consciousness Score** — Weighted composite (interviews 40% + memories 30% + voice 20% + achievements 10%)
- **5 Levels** — Newcomer → Seeker → Keeper → Guardian → Immortal
- **Auto-check** — POST to check and unlock new achievements

## API Reference

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/users` | List all users |
| `GET` | `/users/:id` | Get user by ID |
| `POST` | `/users` | Create user (`name`, `email?`, `tier?`) |

### Consciousness Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/chat` | Chat with preserved consciousness |
| `GET` | `/sessions/:userId` | List chat sessions |
| `POST` | `/memories` | Store a memory |
| `GET` | `/memories/:userId` | List memories (optional `?category=`) |

### Interviews
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/interview/questions/select` | Select questions by session type |
| `POST` | `/interview/questions/answer` | Record answer + get follow-ups |
| `GET` | `/interview/questions/coverage/:userId` | Coverage per category |
| `GET` | `/interview/questions/gaps/:userId` | Find weakest areas |
| `GET` | `/interview/interviews/:userId` | List recorded interviews |

### Family Tree
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/family/:vaultUserId` | List family members |
| `POST` | `/family` | Add family member |
| `PUT` | `/family/:id` | Update family member |
| `DELETE` | `/family/:id` | Remove family member |

### Voice
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/voice/synthesize` | Text-to-speech with emotion |
| `GET` | `/voice/profiles/:userId` | List voice profiles |
| `POST` | `/voice/profiles` | Create voice profile |
| `GET` | `/voice/clone-status/:voiceId` | Check clone progress |

### Gamification
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/gamification/stats/:userId` | Consciousness score + level |
| `POST` | `/gamification/check/:userId` | Check & unlock achievements |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Service info |
| `GET` | `/health` | Health check + DB status |
| `GET` | `/stats` | Global counts |
| `POST` | `/init-schema` | Initialize database tables |

## Setup

### Prerequisites
- Node.js 18+
- Wrangler CLI (`npm i -g wrangler`)
- Cloudflare account

### Install
```bash
git clone https://github.com/bobmcwilliams4/echo-immortality-vault.git
cd echo-immortality-vault
npm install
```

### Configure
1. Create D1 database:
```bash
npx wrangler d1 create echo-immortality-vault
```
2. Update `wrangler.toml` with your database ID
3. Initialize schema:
```bash
npx wrangler d1 execute echo-immortality-vault --remote --file=schema.sql
```
4. Set secrets:
```bash
npx wrangler secret put ECHO_API_KEY
npx wrangler secret put ELEVENLABS_API_KEY
```

### Deploy
```bash
npx wrangler deploy
```

### Local Development
```bash
npx wrangler dev
```

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: [Hono](https://hono.dev) (ultra-fast, TypeScript-first)
- **Database**: Cloudflare D1 (SQLite at edge)
- **AI**: Echo AI Orchestrator (29 LLM workers — GPT-4.1, DeepSeek, Grok, etc.)
- **Memory**: Echo Shared Brain (D1 + KV + R2 + Vectorize)
- **Voice**: ElevenLabs v3 (TTS + voice cloning)
- **Service Bindings**: AI Orchestrator, Shared Brain, Echo Chat (zero-latency inter-Worker calls)

## Database Schema

7 tables with indexes:
- `users` — User profiles, tier, consciousness score
- `memories` — Stored memories with category, emotion, importance
- `interviews` — Question-answer pairs with follow-ups
- `family_members` — Family tree nodes
- `voice_profiles` — Voice clone profiles and quality scores
- `achievements` — Unlocked milestones
- `chat_sessions` — Conversation session tracking

## License

MIT

---

Built by [Echo Prime Technologies](https://echo-ept.com) | Part of the [ECHO OMEGA PRIME](https://echo-op.com) ecosystem
