# ⚛️ OpenPhysics

**AI Agent for Physics Research** — Telegram Bot powered by GPD (Get Physics Done) methodology.

Inspired by [get-physics-done](https://github.com/psi-oss/get-physics-done) by Physical Superintelligence PBC (PSI).

## 🧬 Architecture

Built on the same modular TypeScript architecture as **OpenGravity**, adapted for physics research:

```
OpenPhysics/
├── src/
│   ├── index.ts              # Entry point (Express + Telegram)
│   ├── agent/
│   │   └── loop.ts           # Agentic loop with GPD methodology
│   ├── bot/
│   │   └── telegram.ts       # Telegram handlers
│   ├── config/
│   │   ├── env.ts            # Environment variables
│   │   ├── googleAuth.ts     # Google OAuth
│   │   └── persona.md        # Agent persona & physics identity
│   ├── llm/
│   │   ├── provider.ts       # LLM cascade (Groq → OpenRouter)
│   │   └── tts.ts            # Text-to-Speech
│   ├── memory/
│   │   └── firebase.ts       # Firestore memory + research sessions
│   └── tools/
│       ├── index.ts           # Tool registry
│       ├── getCurrentTime.ts  # Time utility
│       ├── arxivTools.ts      # 🔍 arXiv paper search
│       ├── physicsTools.ts    # 🔬 Constants, units, expressions
│       ├── wolframTools.ts    # 🐺 Wolfram Alpha integration
│       └── monitoringTools.ts # 📊 LLM performance metrics
├── package.json
├── tsconfig.json
├── .env.example
└── .gitignore
```

## 🔬 Physics-Specific Tools

| Tool | Description |
|------|-------------|
| `search_arxiv` | Search arXiv for physics papers by query |
| `get_arxiv_paper` | Get full details of a paper by arXiv ID |
| `get_physics_constant` | CODATA constants lookup (c, ℏ, G, kB, e, mₑ, etc.) |
| `evaluate_expression` | Evaluate math expressions with physics constants |
| `convert_units` | Convert between SI and derived units |
| `query_wolfram` | Quick Wolfram Alpha computation |
| `query_wolfram_full` | Detailed Wolfram Alpha results |

## 🧪 GPD Research Methodology

The agent follows a structured 5-phase workflow for every research question:

1. **SCOPE** — Clarify the question, identify knowns/unknowns
2. **PLAN** — Break into analytical steps, identify required data
3. **DERIVE** — Execute steps with dimensional consistency
4. **VERIFY** — Cross-check against limiting cases
5. **PACKAGE** — Summarize, provide LaTeX-ready equations

## 🚀 Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your keys

# 3. Run locally
npm run dev

# 4. Build for production
npm run build
npm start
```

## 🔑 Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ | Telegram Bot API token |
| `TELEGRAM_ALLOWED_USER_IDS` | ✅ | Comma-separated authorized user IDs |
| `GROQ_API_KEY` | ✅ | Groq API key(s), comma-separated for rotation |
| `OPENROUTER_API_KEY` | ⚡ | OpenRouter fallback key(s) |
| `WOLFRAM_APP_ID` | 📐 | Wolfram Alpha App ID (optional but recommended) |
| `GEMINI_API_KEY` | 📐 | Google Gemini API key (optional) |
| `GOOGLE_OAUTH_*` | 📐 | Google Workspace integration (optional) |

## 📡 Deployment (Render)

Same deployment pattern as OpenGravity:
1. Push to GitHub
2. Create a Web Service on Render
3. Set environment variables
4. Build command: `npm install && npm run build`
5. Start command: `npm start`

## 📜 License

Apache-2.0 — Inspired by the open-source Get Physics Done project.
