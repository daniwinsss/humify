# Humify — Updates Log

Running record of every change made to this project. Newest entries at the top of each
phase; phases in implementation order. Updated on every change.

**Current work:** HTML + DOCX formatting-preserving import/export (`newFeatures1.md`).

---

## Status board

| Phase | Area | Status |
| --- | --- | --- |
| 1 | Foundation — types, document model, segment humanizer | ✅ Done |
| 2 | HTML — parse / extract / replace / validate / sanitize | ✅ Done |
| 3 | DOCX — parse / extract / replace / validate | ✅ Done |
| 4 | Formatting validation + report | ✅ Done |
| 5 | API route | ✅ Done |
| 6 | UI integration | ✅ Done |
| 7 | Tests + fixtures | ✅ Done — 73/73 passing |
| 8 | Docs + lint/build/evaluate | ⚠️ Done — see verification |

Legend: ⬜ Not started · 🟨 In progress · ✅ Done · ⚠️ Done with caveats

---

## Decisions

Recorded up front because they shape everything downstream.

### DOCX: direct OOXML editing, not convert-and-rebuild

A `.docx` is a zip of XML parts. Rather than `mammoth` (docx→html) + `docx` (build new
file) — which is a lossy conversion that discards fonts, spacing, headers/footers and
section structure — we unzip the file, mutate **only** the `<w:t>` text nodes, and re-zip
every other part untouched.

Images, styles, numbering definitions, section properties, page breaks and table geometry
survive because we never touch them.

### Run-level text: marker-preserving batch rewrite

DOCX runs and HTML inline tags split a sentence into fragments:

```
Run1 "This is "   Run2 "very important" (bold)   Run3 " information."
```

Humanizing fragments independently produces incoherent text. Humanizing the joined
paragraph loses the boundaries. So we join a block's runs with sentinel markers, send the
whole block for context, and require the markers back:

```
in:   This is [[1]]very important[[2]] information.
out:  This is [[1]]extremely important[[2]] info.
```

Markers are validated on return. On mismatch: retry that block once, then fall back to the
block's original text and record a warning. Content is never silently dropped.

### Existing humanization behaviour is untouched

Per spec §16, `src/lib/gemini.ts` `rewriteText()` and `src/lib/prompts.ts` keep their
current behaviour. The document pipeline calls them; it does not modify them.

---

## Change log

### Phase 0 — Planning

- **Added** `UPDATES.md` (this file) as the running change log.
- **Analysed** `newFeatures1.md` against the existing codebase.
- **Chose** `node:test` via `tsx` as the test runner (no new test framework dependency).
- **Chose** `parse5` (HTML), `sanitize-html` (XSS defence), `jszip` + `@xmldom/xmldom`
  (DOCX) as the new libraries.

### Phase 1 — Foundation

- **Installed** `parse5`, `sanitize-html`, `jszip`, `@xmldom/xmldom`, `@types/sanitize-html`.
  - `npm audit` reports 4 pre-existing high-severity advisories (`postcss`, `sharp`,
    `nanoid`) — all inside Next.js's own dependency tree, none introduced here. Fixing
    them requires upgrading Next, which is out of scope.
- **Added** `src/lib/documents/common/types.ts` — `TextRun`, `TextBlock`,
  `DocumentWarning`, `PreservationReport`, `DocumentResult`.
- **Added** `src/lib/documents/common/errors.ts` — `DocumentError` carrying a code and an
  HTTP status.
- **Added** `src/lib/documents/common/limits.ts` — file-size, text-length, batch-size and
  concurrency limits, all overridable by env var. Extension → format mapping.
- **Added** `src/lib/documents/common/document-model.ts` — run/block constructors,
  whitespace splitting, and `isHumanizableText` (bare URLs, emails, and text without
  letters are never sent to Gemini).
- **Added** `src/lib/documents/common/segment-humanizer.ts` — the marker protocol,
  batching, bounded-concurrency pool, per-block retry, and fallback-with-warning.

Notes on the humanizer:

- Leading/trailing whitespace is stripped per run before sending and re-attached verbatim
  afterwards, so spacing between runs cannot drift.
- Whitespace-only runs are never sent and never modified.
- A decode that would empty a run is rejected as content loss, not accepted as a rewrite.
- If *every* block fails and Gemini was the cause, the job throws rather than returning an
  unchanged document that looks successful.

### Phase 2 — HTML

- **Added** `src/lib/documents/html/parser.ts` — parse5 wrapper. Verified round-trip
  fidelity: doctype, attribute order, and entities (`&amp;`, `&nbsp;`) all survive
  unchanged. Detects document vs. fragment input so a pasted snippet isn't given an
  `<html>` shell it never had.
- **Added** `src/lib/documents/html/extractor.ts` — one block per block-level element;
  inline tags (`<strong>`, `<em>`, `<a>`…) become separate runs inside the same block, so
  the model sees whole sentences. `SKIP_SUBTREE` covers `script`, `style`, `code`, `pre`,
  `textarea`, `noscript`, `svg`, `math`, `template`, `head`, `title`, `iframe`, `object`,
  `canvas`.
- **Added** `src/lib/documents/html/replacer.ts` — assigns `TextNode.value` and nothing
  else. Elements, attributes, and tree shape are never touched.
- **Added** `src/lib/documents/html/validator.ts` — fingerprints tags, elements, links,
  images, IDs, classes, inline styles, and attribute counts; compares as multisets so
  duplicates are counted honestly.
- **Added** `src/lib/documents/html/sanitizer.ts` — `sanitize-html` for the preview.

Security note: sanitizing is applied to the **preview only**. The downloaded file is the
faithful, unsanitized output — stripping tags from it would itself be a formatting change,
which the spec forbids. The actual risk is rendering untrusted markup in our own origin,
and that is precisely what the preview sanitizer prevents.

### Phase 3 — DOCX

- **Added** `src/lib/documents/docx/parser.ts` — JSZip + `@xmldom/xmldom`. Verified the XML
  round-trips with namespaces, `mc:Ignorable`, attribute order, and entity escaping intact
  (only `\r\n` → `\n` after the XML declaration, which Word ignores). Text-bearing parts:
  `document.xml`, `header*.xml`, `footer*.xml`, `footnotes.xml`, `endnotes.xml`,
  `comments.xml`. Every other archive entry is passed through untouched.
- **Added** `src/lib/documents/docx/extractor.ts` — groups `<w:t>` by walking *up* to the
  nearest `<w:p>` rather than down from paragraphs, so text in text boxes and nested tables
  is attributed correctly instead of double-counted. Paragraphs containing `<w:instrText>`
  (TOC entries, page references, cross-references) are skipped — Word regenerates them from
  their field code, so rewriting them is wasted or wrong.
- **Added** `src/lib/documents/docx/replacer.ts` — sets `textContent` on `<w:t>` and adds
  `xml:space="preserve"` whenever the value has edge whitespace, without which Word silently
  strips it and glues runs together.
- **Added** `src/lib/documents/docx/validator.ts` — fingerprints paragraphs, runs, run
  properties, bold/italic/underline, tables/rows/cells, images and image relationship IDs,
  headings, hyperlinks, lists, sections, page breaks, headers, footers, styles, **and the
  full archive entry list** — the last of which proves no embedded image or part was lost.

### Phase 4 — Report

- **Added** `src/lib/documents/report.ts` — `buildReport` and the spec §9 text rendering.
  `fullyPreserved` is true only when every *measured* metric is 100% and nothing reported
  lost content; metrics with nothing to measure (`before === 0`) render as `n/a` and count
  as evidence for neither side. Duplicate warnings collapse to one line with a `×N` count.

### Phase 5 — Orchestrator + API

- **Added** `src/lib/documents/process.ts` — the shared shape for all formats: parse,
  fingerprint, extract, rewrite, write back, **re-parse the actual output**, compare. The
  after-fingerprint is taken from the real generated file (the re-opened zip, the re-parsed
  HTML), not from the in-memory tree, so the report cannot flatter itself.
  - Documents with no rewritable prose (image-only files) return **unchanged with an
    explanation**, not an error and not an empty file.
  - `.txt` output is supported for every input as the formatting-free fallback, and says so
    in its own report.
- **Added** `POST /api/documents/humanize` — multipart upload. Prompt composition is copied
  from `/api/rewrite` (style → language → feedback examples) so documents inherit the same
  voice. `GET` on the same route returns the accepted extensions and size limit so the UI
  doesn't hardcode them.
  - Confirmed Route Handlers have no body-size cap in this Next version (`bodySizeLimit`
    applies to Server Actions only), so our own 10 MB limit is the governing one.
- **Changed** nothing in `src/lib/gemini.ts`, `src/lib/prompts.ts`, or `/api/rewrite`.

### Phase 7 — Tests

- **Added** `npm test` → `tsx --test "tests/**/*.test.ts"`. No new test framework.
- **Changed** `humanizeBlocks` and `processDocument` to accept an optional `rewrite`
  function, defaulting to the real `rewriteText`. This is what lets the suite drive the
  *actual* pipeline offline instead of testing a simplified stub of it.
- **Added** `tests/helpers/fake-model.ts` — a stand-in that speaks the batch protocol
  correctly, plus switches to simulate a model dropping markers, truncating its reply, or
  Gemini failing outright.
- **Added** `tests/fixtures/html/` — `rich.html` (headings, nested inline formatting,
  lists, tables, links, images, `<pre>`/`<code>`, `<script>`, `<style>`), `simple.html`,
  `malformed.html`, `images-only.html`.
- **Added** `tests/fixtures/docx-fixtures.ts` — hand-written OOXML built in memory, so the
  fixtures exercise the exact structures the spec names rather than whatever a generator
  library happens to emit. Covers headings, multi-run formatting with fonts/colour/size,
  alignment/indentation/spacing, bulleted and numbered lists, a bordered table, an external
  hyperlink, an embedded PNG, header and footer parts, a `PAGEREF` field, an explicit page
  break, and two sections. Variants: rich, simple, image-only, empty, and a not-a-docx zip.
- **Added** 73 tests across `humanizer.test.ts`, `html.test.ts`, `docx.test.ts`,
  `report.test.ts`. All passing.

**Bug found and fixed by the tests:** an email address or URL used as link text sits inside
an inline `<a>`, so it became a run *inside* a prose block. The block-level "is this
prose?" check passed, and the address was sent for rewriting. Added `isFrozenText` /
`isFrozenBlockRun`: such runs are still sent for context so the sentence reads naturally,
but any rewrite that comes back for them is discarded. See the regression test *"freezes a
URL or email run inside an otherwise rewritten sentence"*.

Notable assertions worth knowing hold:

- The `.docx` output keeps every archive entry, and `word/media/image1.png` is
  **byte-identical** to the input.
- `document.xml.rels`, `styles.xml`, `[Content_Types].xml` and `_rels/.rels` come out
  byte-identical.
- Run count, `<w:rPr>` count, and bold/italic/underline counts are unchanged — the
  paragraph is not flattened.
- A paragraph containing a Word field (`PAGEREF`) is left alone and reported as skipped.
- `<script>`, `<style>`, `<pre>`, `<code>` and `<title>` contents come through untouched.
- The downloaded HTML keeps its `<script>`; only the preview is sanitized.

### Phase 6 — UI

- **Added** `src/components/DocumentUpload.tsx` — drag & drop plus click-to-browse, showing
  filename, size and a ✓ Ready state. Extension and size are checked client-side before
  upload, and again on the server.
- **Added** `src/components/FormattingReport.tsx` — the preservation report as a table with
  before/after counts beside each percentage, a warnings list, and a copy button.
- **Added** `src/components/DocumentPanel.tsx` — upload → output format → process →
  report → preview → download. HTML gets a rendered before/after preview (sanitized); DOCX
  gets a plain-text before/after with an explicit note that the browser cannot render Word
  files but the download keeps its formatting.
- **Changed** `src/app/page.tsx` — added a **Text** / **Document** tab. Style, language and
  profile controls are shared between the two modes. **The existing text interface is
  unchanged**; it is the same components, same handlers, same layout, now rendered under a
  tab.
- **Changed** `src/app/globals.css` — typography scoped to `.document-preview`. Tailwind's
  reset flattens headings, lists and tables, which would make a preview of a *formatted*
  document look like the formatting had been lost — the opposite of what the preview is for.
- **Changed** `DocumentResult` to carry `originalPreviewHtml` and a `textPreview`
  before/after pair, captured before replacements are applied.

### Phase 8 — Docs & verification

- **Added** `scripts/evaluate-documents.ts` + `npm run evaluate:documents` — runs the
  fixtures through the **real** Gemini API. The unit tests prove the formatting machinery
  with a stand-in model; this proves a real model can actually hold the marker protocol.
- **Changed** `FEATURES.md` — new section 13 covering the document feature, the four new
  env vars, and the two new npm scripts.

---

## Verification

Run on 2026-08-08.

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | ✅ Clean |
| `npm test` | ✅ 73/73 passing |
| `npm run build` | ✅ Compiled; `/api/documents/humanize` registered |
| `npm run evaluate:documents` | ✅ Both fixtures 100% preserved against live Gemini |
| `npm run lint` | ⚠️ 4 errors, all pre-existing (see below) |
| `npm run evaluate` | ⚠️ 0/7, all latency/quota (see below) |

**Lint** — 4 errors, all in files this work never touched:
`ThemeToggle.tsx` (setState in effect), `ProfileManager.tsx` and `page.tsx`
(`react-hooks/immutability` on the pre-existing `fetchProfiles`/`fetchHistory` pattern),
`ApiKeyManager.tsx`. Verified: every new file lints clean. These were left alone as
unrelated to this feature — fixing `ThemeToggle` in particular would change theme behaviour.

**`npm run evaluate`** — 0/7. Every failure is the suite's `Response < 3s` assertion against
real Gemini latency of 3.6–9.7s, plus a 429 quota exhaustion on the final case and two
word-overlap heuristics. This suite exercises `/api/rewrite`, which this work does not
touch: `gemini.ts`, `prompts.ts`, `db.ts` and the rewrite route are all byte-for-byte
unchanged. The failures are environmental (latency and free-tier quota), not a regression —
but note they could not be compared against a clean baseline, because none of these files
were committed to git before this work began.

**Live document evaluation** (`npm run evaluate:documents`, real Gemini):

```
▸ rich.html    21 blocks · 38 runs · 1 Gemini call  · 10178ms · 100% across all 10 metrics
▸ rich.docx    14 blocks · 20 runs · 1 Gemini call  ·  9153ms · 100% across all 18 metrics
```

One API call per document — the batching works. The email address `ops@example.com` came
back untouched while the surrounding prose was rewritten.

---

## Implementation report

**Libraries added:** `parse5` (HTML), `sanitize-html` + `@types/sanitize-html` (preview
XSS defence), `jszip` (DOCX archive), `@xmldom/xmldom` (OOXML). No test framework added.

**Architecture** — document handling is kept entirely separate from the rewriting logic,
per spec §12:

```
src/lib/documents/
  common/    types · document-model · segment-humanizer · errors · limits
  html/      parser · extractor · replacer · validator · sanitizer
  docx/      parser · extractor · replacer · validator
  process.ts   orchestrator
  report.ts    preservation report
```

**How HTML formatting is preserved:** parse5 builds a DOM; extraction collects only
`TextNode` values; replacement assigns only `TextNode.value`. Elements, attributes and tree
shape are never written to, so preservation is structural rather than best-effort.

**How DOCX formatting is preserved:** the archive is unzipped, only `<w:t>` text nodes in
the text-bearing parts are edited, and every other entry is repackaged untouched. Styles,
numbering, themes, relationships and media are preserved because they are never opened.

**Known limitations** — the things this cannot currently preserve or handle:

1. **PDF is not supported** — out of scope by the spec.
2. **HTML `<title>` is not rewritten.** It sits in `<head>`, which is skipped wholesale to
   avoid touching `<meta>` content. A deliberate trade-off, not a bug.
3. **Word field text is not rewritten** (TOC entries, page references). Word regenerates it
   from the field code, so any rewrite would be discarded or wrong. Reported as a warning.
4. **`\r\n` after the XML declaration becomes `\n`** in edited DOCX parts. Word ignores it;
   it is the only byte-level difference in parts we touch.
5. **`.docx` output cannot be previewed in the browser** — a text-only before/after is shown
   instead, with the limitation stated in the UI.
6. **HTML cannot be converted to DOCX or vice versa.** Each format exports as itself or as
   `.txt`. Cross-conversion would mean rebuilding a document, which is exactly the lossy
   approach this design rejects.
7. **A model that ignores the markers costs that paragraph its rewrite**, not its
   formatting. The paragraph keeps its original text and the report says so.
8. **Text boxes and SmartArt** are extracted if they contain `<w:t>`, but their layout is
   untested — the fixtures do not cover them.
9. **`.doc` (pre-2007 Word) is rejected** with a clear message; it is not a zip format.

**Documents tested:** `rich.html` (headings, nested inline formatting, lists, tables, links,
images, `<pre>`/`<code>`/`<script>`/`<style>`), `simple.html`, `malformed.html` (unclosed
and mis-nested tags), `images-only.html`, and generated `.docx` fixtures covering headings,
multi-run formatting with fonts/colour/size, alignment/indentation/spacing, bulleted and
numbered lists, a bordered table, an external hyperlink, an embedded PNG, header and footer
parts, a `PAGEREF` field, a page break, two sections, plus image-only, empty, and
not-a-Word-document variants.

**Nothing was deployed.** All work is local.

---

# Update — landing page and app-wide retheme

**Added** `src/app/page.tsx`, a landing page built from direction 1a of the "Humify project
wireframes" design doc. The tool moved to `/app` (`src/app/app/page.tsx`) unchanged; the hero's
paste box hands its text over through `src/lib/draft.ts` (sessionStorage, read once and cleared —
not a query string, because the input takes full essays and unsubmitted writing has no business
in browser history or a referrer header).

**Retheme.** The tool UI moved from zinc/indigo/Geist to the wireframe's cream/clay/olive with
DM Sans, by **redefining the `zinc`, `indigo`, `violet` and `amber` ramps** in `globals.css`
rather than editing class names in ~21 components. Tailwind declares its palette in
`@theme default { … }`, where `default` means "yield to a user value", so the override retargets
every existing utility at once.

Why not a find-and-replace across the components: roughly 600 colour classes, nearly all in
`dark:`-paired form, and five places where a colour pair is the *only* indicator of state (mode
tabs, style cards, profile chips, output-format chips, feedback thumbs) plus two hover-only delete
affordances. Retargeting the ramps makes it structurally impossible to drop one by hand. Verified:
`dark:`, `zinc-`, `violet-`, `amber-`, `bg-white` and `group-hover` occurrence counts are byte-for-byte
unchanged.

**Semantic colour was preserved, not restyled.** `red`, `emerald`, `blue`, `green` and `purple`
keep their stock values — they carry meaning (error, success, ScoreBar's 70/40 thresholds, the four
style badges). `amber` was shifted from orange to gold because stock `amber-700` sits 2.4° of hue
from the clay accent, which would have made warnings read as brand colour — worst in
`DocumentPanel`, where the lossy-format warning sits directly above a clay CTA.

**Ramps were derived in OKLCH at the lightness of the ramp they replace**, so pre-existing contrast
relationships survive. Two deliberate deviations, both to hold WCAG AA:
- The brand clay `#c67139` sits at `indigo-500` (focus borders, rings, `accent-*`), **not** at 600.
  White 14px text on `#c67139` is 3.6:1, and 600 is the primary CTA. `indigo-600` is darkened to
  reach 5.15:1.
- `zinc-500` is darkened below stock because the cream page is darker than `zinc-50` was;
  `text-zinc-500` on it now measures 4.89:1 instead of falling to 4.35:1.

**Five component edits** were needed where the token swap could not help:
`ComparisonView` and `AnalysisDashboard` distinguished original from rewritten by neutral-vs-accent
*hue*, which collapses when both sides are warm — those tints are now full-strength so lightness
carries the distinction. `ApiKeyManager` and `ProfileManager` had CTAs that lightened on hover
(600→500) where every other CTA darkens, dropping white text below AA. `settings/page.tsx` had a
`text-zinc-500 dark:text-zinc-500` typo (same shade in both modes).

**Known debt.** `indigo-600` is now terracotta and `zinc-500` a warm taupe, so an editor's colour
preview will lie and anyone adding a component will reach for a misleading name. The clean fix is a
mechanical codemod (`indigo-`→`clay-`, `violet-`→`olive-`, `zinc-`→`stone-`) plus a lint guard.
Deliberately not done here — it would have buried the retheme in an unreviewable diff.

**Not changed:** `bg-white` card surfaces stay white (white-on-cream is the wireframe's own
relationship, and every one is `dark:`-paired so white never appears in dark mode); the
`bg-black/50` mobile scrim; and `.document-preview`, which stays a deliberately theme-immune white
sheet — only its own chrome colours were warmed, and they remain literal hex so that invariant
stays obvious.

**The landing page is light-only in both app themes** (`.landing { color-scheme: light }`), as the
design doc specifies no dark variant for it.

---

# Update — lint clean-up and /app aligned to the landing layout

**Lint is now clean** (`npm run lint` exits 0; it previously reported 5 errors).

- `ThemeToggle` no longer mirrors the theme into component state. It reads the `dark` class off
  `<html>` through `useSyncExternalStore` with a `MutationObserver`, which is the actual source of
  truth — the inline script in the root layout has already applied the stored preference before
  first paint. This also stops the component re-deriving the preference and re-writing the class on
  every mount.
- The two mount-time fetches (`fetchHistory`, `fetchProfiles`) moved to module scope and now return
  their data instead of setting state; the effect sets state in the `.then` callback, which is the
  pattern the `react-hooks/set-state-in-effect` rule is asking for. Both gained a `cancelled` guard,
  so an unmount mid-flight no longer sets state on a dead component.
- Escaped an apostrophe in `ApiKeyManager`.
- One `eslint-disable` remains, on the landing-draft hand-off in `/app`. It is a one-shot read of
  external state and cannot become a lazy `useState` initializer: `takeDraft()` clears the key as it
  reads, and React invokes initializers twice in development, so the second call would return `""`
  and lose the draft. The reason is recorded at the call site.

**`/app` now matches the landing's composition.** It was a wide two-column workspace; it is now a
centered single column under the same nav.

- `Header` was rebuilt to the landing's nav: hairline rule, serif wordmark, no fill of its own so
  the page surface shows through, and an `actions` slot for page-specific controls. Its tagline
  ("Make AI text sound human") was dropped — the landing hero already says it, and the landing nav
  is a single line.
- **History is one drawer at every width**, opened from a `History (n)` button in the nav. Previously
  there were two `HistoryPanel` instances — a sticky desktop sidebar and a mobile bottom sheet —
  gated by `hidden`/`md:hidden`. There is now one right-side slide-over, so desktop and mobile show
  the same list and there is no second copy to drift. `HistoryPanel` supplies the heading (with the
  count), so the drawer only adds a close button.
- Surfaces inverted to match the landing: **white page, warm panels** (`bg-white` page,
  `bg-zinc-50` cards and inputs) instead of a cream page with white cards. Dark mode keeps the warm
  dark page with a lifted card.
- Section headings (`Result`, `Writing Analysis`, `History`, `Settings`) use DM Serif Display, as
  the landing does for its wordmark and section titles. Note DM Serif Display ships weight 400 only,
  so these carry `font-normal`; `font-bold` on it synthesizes an ugly faux-bold.

No control, handler or piece of state was removed — every component still mounts in `/app`, and the
`group-hover` delete affordances in `HistoryItem` and `ProfileManager` are untouched.
