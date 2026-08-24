# Humify

AI-powered text humanization platform that rewrites AI-generated text to sound naturally human while preserving meaning. Supports controllable style, tone, language, and formality -- unlike one-size-fits-all humanizers.

## Features

- **Text humanization** with 4 style presets (professional, casual, academic, friendly)
- **Custom writing profiles** with tone, formality slider, and custom instructions
- **15-language support** with auto-detect
- **Document humanization** for HTML and DOCX files with formatting preservation
- **AI-likelihood scoring** -- deterministic, local estimator with before/after comparison
- **Iterative refinement** -- multi-pass humanization with signal-targeted guidance and regression protection
- **Writing analysis dashboard** -- readability, formality, emotion, complexity via Gemini
- **Feedback learning** -- positive examples feed into future prompts
- **Rewrite history** with search and restore
- **REST API** with Bearer token authentication
- **Monitoring dashboard** with request counts, latency, error rates
- **Dark mode** with system preference detection

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Frontend | React 19, Tailwind CSS 4 |
| Language | TypeScript 5 |
| AI | Google Gemini (`gemini-2.5-flash` with fallback chain) |
| Database | PostgreSQL via Prisma 7 + Neon serverless adapter |
| Document parsing | parse5 (HTML), jszip + xmldom (DOCX) |
| Testing | Node test runner via tsx |
| Deployment | Docker (multi-stage, node:22-alpine) |

## Getting Started

### Prerequisites

- Node.js 22+
- A [Google AI Studio](https://aistudio.google.com/) API key
- A [Neon](https://neon.tech/) PostgreSQL database

### Installation

```bash
git clone <repo-url>
cd humify
npm install
```

### Environment Setup

Create a `.env.local` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key

# Pooled connection (for the app at runtime)
DATABASE_URL="postgresql://user:password@endpoint-pooler.region.aws.neon.tech/dbname?sslmode=require"

# Direct connection (for Prisma CLI -- migrations, db push)
DATABASE_URL_UNPOOLED="postgresql://user:password@endpoint.region.aws.neon.tech/dbname?sslmode=require"
```

### Database Setup

```bash
npx prisma generate    # Generate the Prisma client
npx prisma db push     # Create tables on Neon
```

### Run

```bash
npm run dev            # Development server at http://localhost:3000
```

## Project Structure

```
src/
  app/
    page.tsx                         # Landing page
    app/page.tsx                     # Main editor (text + document modes)
    settings/page.tsx                # API keys + monitoring dashboard
    api/
      rewrite/route.ts               # POST -- Core text humanization
      analyze/route.ts               # POST -- Text analysis + AI-likelihood
      documents/humanize/route.ts    # POST/GET -- Document upload + humanization
      history/route.ts               # GET -- List all rewrites
      history/[id]/route.ts          # DELETE -- Remove a rewrite
      feedback/route.ts              # POST/GET -- Thumbs up/down ratings
      profiles/route.ts              # GET/POST/DELETE -- Writing profiles
      keys/route.ts                  # GET/POST/DELETE -- API key management
      metrics/route.ts               # GET -- Monitoring metrics
      v1/rewrite/route.ts            # POST -- Public REST API (Bearer auth)

  components/
    Header.tsx                       # App header + navigation
    TextInput.tsx                    # Main textarea
    StyleSelector.tsx                # 4 style presets
    LanguageSelector.tsx             # 15-language dropdown
    ProfileManager.tsx               # Custom writing profile CRUD
    RewriteButton.tsx                # Humanize button
    ComparisonView.tsx               # Side-by-side original vs humanized
    HistoryPanel.tsx                 # Rewrite history sidebar
    AnalysisDashboard.tsx            # Readability/formality/emotion scores
    DocumentPanel.tsx                # Document mode (upload + humanize)
    DocumentUpload.tsx               # Drag-and-drop file upload
    FormattingReport.tsx             # Document preservation report
    FeedbackButtons.tsx              # Thumbs up/down
    ScoreBar.tsx                     # Visual score bar
    ApiKeyManager.tsx                # API key management UI
    ThemeToggle.tsx                  # Dark/light mode toggle
    analysis/
      AILikelihoodComparison.tsx     # Before/after AI-likelihood display
      scale.ts                       # Score scale utilities

  lib/
    gemini.ts                        # Gemini API client + fallback model chain
    db.ts                            # Prisma client + all DB operations
    prompts.ts                       # Style prompts, language/profile/refinement builders
    logger.ts                        # Structured JSON logger with timing
    draft.ts                         # sessionStorage hand-off (landing -> app)
    analysis/
      ai-likelihood.ts               # Deterministic 5-signal AI-likelihood estimator
      evaluator.ts                   # Before/after comparison + refinement acceptance
      config.ts                      # Tunable weights and thresholds
      readability.ts                 # Flesch Reading Ease / Flesch-Kincaid
      formality.ts                   # Register/formality measurement
      complexity.ts                  # Sentence/paragraph shape analysis
      phrases.ts                     # Formulaic phrase and word lists
    documents/
      process.ts                     # Main pipeline: extract -> humanize -> replace -> validate
      report.ts                      # Formatting preservation report
      common/                        # Shared types, errors, limits, segment humanizer
      html/                          # HTML parse/extract/replace/validate/sanitize
      docx/                          # DOCX parse/extract/replace/validate

  types/index.ts                     # All shared TypeScript types
```

## Architecture

### Text Humanization Flow

```
User input -> /api/rewrite -> Gemini API (with style prompt + language + profile + feedback examples)
                            -> AI-likelihood scoring (local, deterministic)
                            -> Save to history (Prisma/Neon)
                            -> Return rewritten text + analysis
```

### Document Humanization Flow

```
File upload -> /api/documents/humanize -> Parse (HTML via parse5 / DOCX via jszip+xmldom)
                                       -> Extract text blocks (preserving formatting markers)
                                       -> Batch blocks (~6000 chars each) for Gemini
                                       -> Replace text in original DOM/XML
                                       -> Validate preservation (fingerprint before/after)
                                       -> Return base64 file + preservation report
```

### Gemini Model Fallback

When a model returns 429/503/404, the system automatically tries the next model in the chain:

```
gemini-2.5-flash -> gemini-2.0-flash -> gemini-flash-lite-latest
```

Auth errors (401/403) are thrown immediately without fallback.

### AI-Likelihood Estimator

A fully deterministic, local scorer (no LLM calls) using 5 weighted signals:

| Signal | Weight |
|---|---|
| Predictability / formulaic phrases | 0.30 |
| Sentence uniformity | 0.27 |
| Structural patterns | 0.18 |
| Repetition | 0.13 |
| Lexical diversity | 0.12 |

### Refinement System

Multi-pass humanization with regression protection:

1. User clicks "Refine" after initial humanization
2. System re-runs with signal-targeted guidance (based on which signals scored highest)
3. New result is accepted only if `candidateScore < currentScore`
4. Rejected passes show an amber banner with "Try again" / "Use this anyway" options

## Database Schema

5 tables on Neon PostgreSQL via Prisma:

| Table | Purpose |
|---|---|
| `rewrites` | Stored rewrites with AI-likelihood scores |
| `feedback` | Thumbs up/down ratings (FK to rewrites, cascade delete) |
| `writing_profiles` | Custom profiles (tone, formality 0-100, instructions) |
| `api_keys` | Bearer tokens for the REST API |
| `metrics` | Request-level monitoring (endpoint, latency, status, errors) |

## API

### Public REST API

```bash
curl -X POST http://localhost:3000/api/v1/rewrite \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "Your AI-generated text here", "style": "professional", "language": "auto"}'
```

**Response:**
```json
{
  "original": "Your AI-generated text here",
  "rewritten": "The humanized version",
  "style": "professional",
  "language": "auto"
}
```

Styles: `professional`, `casual`, `academic`, `friendly`

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes | -- | Google AI Studio API key |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Override primary Gemini model |
| `DATABASE_URL` | Yes | -- | Neon pooled connection string |
| `DATABASE_URL_UNPOOLED` | Yes | -- | Neon direct connection (for Prisma CLI) |
| `DOCUMENT_MAX_FILE_BYTES` | No | 10485760 | Max document upload size (bytes) |
| `DOCUMENT_MAX_TEXT_CHARS` | No | 400000 | Max text characters per document |
| `DOCUMENT_BATCH_CHARS` | No | 6000 | Target batch size for Gemini requests |
| `DOCUMENT_BATCH_CONCURRENCY` | No | 2 | Concurrent Gemini batches |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint |
| `npm test` | Document pipeline tests (offline, no API key needed) |
| `npm run evaluate` | Automated rewrite quality evaluation (requires dev server + API key) |
| `npm run evaluate:documents` | Document fixtures through real Gemini API |

## Docker

```bash
docker compose up --build
```

The Dockerfile uses a 3-stage build (deps -> builder -> runner) with `node:22-alpine` and runs as a non-root user. Port 3000 is exposed. Pass `GEMINI_API_KEY` via environment.
