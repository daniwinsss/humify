# Humify - Complete Feature Guide

## What is Humify?

Humify is an AI-powered text humanization platform that rewrites AI-generated text to sound naturally human while preserving the original meaning. Unlike other humanizers that offer a single "rewrite" button with no control, Humify gives you full control over writing style, language, tone, and formality.

---

## How It's Better Than Other Humanizers

| Problem with existing tools | How Humify solves it |
|---|---|
| One-size-fits-all rewriting | 4 built-in style presets + fully custom writing profiles |
| No visibility into what changed | Side-by-side comparison with word counts |
| Can't control tone or formality | Custom profiles with tone selector and formality slider |
| English only | 15 languages supported |
| No quality feedback | Readability, formality, emotion, and complexity scores |
| No way to improve over time | Feedback learning — thumbs up/down teaches the model your preferences |
| No programmatic access | Full REST API with key authentication |
| Black box — no suggestions | AI-powered suggestions before you even rewrite |
| No history | Persistent rewrite history with search and restore |

---

## Features

### 1. Text Rewriting (Core)

**How to use:** Paste your text into the input area and click **Humanize Text**.

The AI rewrites your text to sound natural and human while keeping the original meaning intact. Every rewrite is powered by Google's Gemini Flash for fast, high-quality results.

### 2. Style Presets

**How to use:** Select a style before clicking Humanize.

| Style | Best for |
|---|---|
| **Professional** | Business emails, reports, LinkedIn posts |
| **Casual** | Blog posts, social media, informal messages |
| **Academic** | Research papers, essays, scholarly writing |
| **Friendly** | Customer support, newsletters, community posts |

### 3. Custom Writing Profiles

**How to use:** Click **+ New profile** above the style presets.

Create personalized profiles when the built-in presets don't fit. Each profile lets you configure:

- **Name** — Give it a label (e.g., "My Blog Voice")
- **Tone** — Neutral, Confident, Empathetic, Enthusiastic, Authoritative, Witty, or Humble
- **Formality** — Slider from 0 (very informal) to 100 (very formal)
- **Custom instructions** — Free-text instructions like "Use short sentences" or "Avoid jargon"

When a custom profile is selected, it replaces the style presets. Profiles are saved permanently and persist across sessions.

### 4. Multi-Language Support

**How to use:** Select a language from the **Output language** dropdown before rewriting.

Supported languages: Auto-detect, English, Spanish, French, German, Portuguese, Italian, Dutch, Russian, Chinese, Japanese, Korean, Arabic, Hindi, and Turkish.

Set to **Auto-detect** (default) to keep the same language as your input, or pick a specific language to translate and humanize simultaneously.

### 5. Side-by-Side Comparison

After rewriting, both the original and humanized text are displayed side by side with word counts for each. This lets you quickly verify that the meaning is preserved and see exactly what changed.

### 6. Copy & Download

**How to use:** After a rewrite, use the **Copy** or **Download** buttons above the humanized text.

- **Copy** — Copies to clipboard with visual "Copied!" confirmation
- **Download** — Saves as a `.txt` file named `humified-text.txt`

### 7. Feedback Learning

**How to use:** After a rewrite, click the thumbs up or thumbs down button next to the result.

When you rate a rewrite positively, Humify remembers it. Future rewrites in the same style will use your liked examples as reference, so the output quality improves over time based on your preferences.

### 8. Writing Analysis Dashboard

**How to use:** Click the **Analyze** button to analyze your input text before rewriting. After a rewrite, both texts are automatically analyzed.

The dashboard shows:

- **Readability Score** (0-100) — How easy the text is to read, with grade level (e.g., "8th grade", "College")
- **Formality Score** (0-100) — How formal or informal the writing is
- **Sentence Complexity** (0-100) — Average sentence length and complexity level
- **Emotional Tone** — Primary emotion detected plus a breakdown of all detected tones with confidence scores
- **Suggestions** — Actionable tips for improving naturalness

When both original and humanized texts are analyzed, you'll see delta indicators showing how much each score improved.

### 9. Rewrite History

All rewrites are automatically saved. The history panel shows:

- Style badge (color-coded)
- Relative timestamp
- Text preview

Click any history entry to restore it into the input and output areas. Delete entries you no longer need with the trash icon.

On desktop, history appears as a sticky sidebar. On mobile, tap the **History** button to open a bottom sheet.

### 10. Dark Mode

**How to use:** Click the sun/moon toggle in the header.

Automatically detects your system preference on first visit. Your choice is saved to localStorage.

### 11. API Access

**How to use:** Go to **Settings** (gear icon in header) to generate API keys.

Integrate Humify into your own apps with the REST API:

```bash
curl -X POST http://localhost:3000/api/v1/rewrite \
  -H "Authorization: Bearer hum_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your AI-generated text here",
    "style": "professional",
    "language": "en"
  }'
```

**Parameters:**
- `text` (required) — The text to humanize
- `style` (optional, default: "professional") — One of: professional, casual, academic, friendly
- `language` (optional, default: "auto") — Output language code (en, es, fr, de, pt, it, nl, ru, zh, ja, ko, ar, hi, tr)

**Response:**
```json
{
  "original": "Your AI-generated text here",
  "rewritten": "The humanized version of your text",
  "style": "professional",
  "language": "en"
}
```

### 12. Monitoring Dashboard

**How to use:** Go to **Settings** to view the monitoring section.

Tracks:
- Total API requests and rewrites
- Average response latency
- Error rate percentage
- Style and language usage breakdown
- Recent error log

### 13. Document Humanizing — HTML & DOCX with formatting preserved

**How to use:** On the main page, switch from the **Text** tab to the **Document** tab.
Drag in a file (or click to browse), pick a style and language exactly as you would for
text, and press **Humanize document**. You get a formatting preservation report and a
download button.

| | |
|---|---|
| **Input** | `.html`, `.htm`, `.docx`, `.txt` |
| **Output** | Same format as the input, or `.txt` as a formatting-free fallback |
| **Size limit** | 10 MB (configurable — see the environment variables below) |

Only the *text* is rewritten. Structure, styling and non-text content are left alone.

**What is preserved in HTML:** every tag and its nesting, headings, paragraphs, bold,
italic, underline, strikethrough, links and their targets, images, lists, tables, block
quotes, `class`, `id`, inline `style`, and every other attribute — byte-for-byte.

**What is preserved in DOCX:** headings, paragraph styles, bold/italic/underline, font
family, size and colour, alignment, indentation, line and paragraph spacing, bulleted and
numbered lists, tables, hyperlinks, headers, footers, page breaks, sections, and embedded
images. A `.docx` is a zip of XML parts; Humify edits only the text nodes inside it and
repackages every other part untouched, so images come back byte-identical.

**Never rewritten:** the contents of `<script>`, `<style>`, `<code>`, `<pre>` and
`<title>`; URLs and email addresses (even when used as link text); and Word field codes
such as table-of-contents entries and page references, which Word regenerates itself.

**Inline formatting is understood, not flattened.** A sentence split across several runs —
`This is `, **`very important`**, ` information.` — is sent to Gemini as one piece with
boundary markers, so the model rewrites a whole sentence but the bold still lands on the
right words. If the markers come back malformed, that paragraph keeps its original text and
says so in the report rather than risking mangled formatting.

**The report is measured, not asserted.** After processing, the *generated file* is
re-opened and re-counted, and the percentages come from comparing those real counts against
the original. Humify will not claim 100% preservation unless it has verified it:

```
Formatting Preservation Report

Text modified                        YES
Paragraphs preserved                 100% (18/18)
Headings preserved                   100% (2/2)
Text runs preserved                  100% (28/28)
Run formatting preserved             100% (7/7)
Bold / italic / underline preserved  100% (5/5)
Tables preserved                     100% (1/1)
Images preserved                     100% (1/1)
Hyperlinks preserved                 100% (1/1)
Headers preserved                    100% (1/1)
Footers preserved                    100% (1/1)
Archive parts preserved              100% (12/12)
```

**Efficiency:** paragraphs are batched into requests of roughly 6,000 characters, so a
21-block HTML page costs a single Gemini call rather than one per fragment.

**Security:** uploaded HTML is never rendered as-is. The on-screen preview is sanitized
(scripts, event handlers, `javascript:` URLs and iframes removed); the file you download
stays faithful and unsanitized, because stripping tags from it would itself be a formatting
change.

**API:**

```bash
curl -X POST http://localhost:3000/api/documents/humanize \
  -F "file=@report.docx" \
  -F "style=professional" \
  -F "language=auto" \
  -F "outputFormat=docx"
```

Returns JSON with `filename`, `mimeType`, `dataBase64`, `report`, `reportText`, and
`textPreview`. A `GET` on the same URL returns the accepted extensions and size limit.

### 14. Docker Deployment

**How to use:**

```bash
# Set your API key
export GEMINI_API_KEY=your_key_here

# Build and run
docker compose up -d

# Access at http://localhost:3000
```

The Docker setup uses a multi-stage build for minimal image size, runs as a non-root user, and persists data in a named volume.

---

## Quick Start

1. Clone the repo
2. Run `npm install`
3. Create `.env.local` with `GEMINI_API_KEY=your_key` (get one free at [aistudio.google.com/apikeys](https://aistudio.google.com/apikeys))
4. Run `npm run dev`
5. Open http://localhost:3000

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes | — | Your Google AI Studio API key |
| `GEMINI_MODEL` | No | `gemini-flash-latest` | Override the Gemini model used for rewrites and analysis |
| `DOCUMENT_MAX_FILE_BYTES` | No | `10485760` (10 MB) | Largest document upload accepted |
| `DOCUMENT_MAX_TEXT_CHARS` | No | `400000` | Most text one document may contain |
| `DOCUMENT_BATCH_CHARS` | No | `6000` | Target size of one batched Gemini request |
| `DOCUMENT_BATCH_CONCURRENCY` | No | `2` | Batches in flight at once (kept low for free-tier limits) |

### Troubleshooting: `429 Too Many Requests`

If every request fails with a 429 quota error even on a brand-new API key, the cause is
usually a **deprecated model**, not your quota. Google drops the free-tier limit for older
models to `0` and reports it as a rate-limit error rather than a deprecation notice.

The app defaults to the rolling `gemini-flash-latest` alias to avoid this. To pin a specific
model instead, set `GEMINI_MODEL` in `.env.local`:

```
GEMINI_MODEL=gemini-3.6-flash
```

To see which models your key can actually reach:

```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY" \
  | grep -o '"name": "models/[^"]*"'
```

Note that a genuinely invalid key returns a `400`, not a `429` — so a 429 means your key
authenticated fine and the problem lies with the model or quota.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run the document pipeline test suite (offline, no API key needed) |
| `npm run evaluate` | Run automated evaluation suite (requires dev server running) |
| `npm run evaluate:documents` | Run HTML/DOCX fixtures through the real Gemini API and print preservation reports |

---

## Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS 4, TypeScript
- **AI:** Google Gemini Flash (via `gemini-flash-latest`)
- **Database:** SQLite (via better-sqlite3) with WAL mode
- **Deployment:** Docker with multi-stage builds
