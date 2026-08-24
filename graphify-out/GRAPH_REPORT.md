# Graph Report - humify  (2026-08-23)

## Corpus Check
- Corpus is ~35,251 words - fits in a single context window. You may not need a graph.

## Summary
- 544 nodes · 1077 edges · 32 communities (25 shown, 7 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.85)
- Token cost: 127,246 input · 0 output

## Community Hubs (Navigation)
- Document Model Core
- HTTP API Routes
- Main App UI Pages
- Segment Humanizer Batching
- Runtime Dependencies
- TypeScript Build Config
- DOCX Parse And Validate
- Dev Tooling Dependencies
- Document Upload UI
- Product Vision And Features
- Settings And API Keys
- Output Comparison Widgets
- Document Pipeline Spec
- Batching And Preservation
- Deployment And Persistence
- Root Layout And Fonts
- HTML Fixture Edge Cases
- Sanitization And Testing
- Marker Protocol Limits
- Text Rewrite Evaluation
- Gemini Model Integration
- Landing Page Retheme
- Project Instruction Docs
- Baseline HTML Fixtures
- Dark Mode Theming
- ESLint Configuration
- Next.js Configuration
- PostCSS Configuration
- Vendor Logo Assets
- File Icon Asset
- Globe Icon Asset
- Window Icon Asset

## God Nodes (most connected - your core abstractions)
1. `processHtml()` - 18 edges
2. `getDb()` - 17 edges
3. `humanizeBlocks()` - 17 edges
4. `processDocx()` - 16 edges
5. `compilerOptions` - 16 edges
6. `Humify Platform` - 15 edges
7. `POST()` - 13 edges
8. `Style` - 12 edges
9. `Language` - 12 edges
10. `processTxt()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `Next.js create-next-app Boilerplate README` --semantically_similar_to--> `Humify Platform`  [INFERRED] [semantically similar]
  README.md → FEATURES.md
- `Formatting Preservation Report (measured, not asserted)` --semantically_similar_to--> `Success Metrics (BERTScore > 0.95, <3s response, <2% failure)`  [INFERRED] [semantically similar]
  FEATURES.md → prd.md
- `Landing Draft Hand-off via sessionStorage (draft.ts)` --shares_data_with--> `Text Rewriting (Core Humanization)`  [INFERRED]
  UPDATES.md → FEATURES.md
- `Preview-Only HTML Sanitization` --semantically_similar_to--> `isFrozenText / isFrozenBlockRun (URL & email freeze bugfix)`  [INFERRED] [semantically similar]
  FEATURES.md → UPDATES.md
- `429 Too Many Requests = Deprecated Model` --semantically_similar_to--> `Error Handling Requirements (never silently discard content)`  [INFERRED] [semantically similar]
  FEATURES.md → newFeatures1.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Document Formatting-Preservation Pipeline** — updates_document_model, updates_segment_humanizer, updates_html_pipeline, updates_docx_pipeline, updates_orchestrator_process, features_formatting_preservation_report, updates_documents_humanize_route [EXTRACTED 1.00]
- **Inputs Composing the Rewrite System Prompt** — features_style_presets, features_custom_writing_profiles, features_multi_language_support, features_feedback_learning, founder_demo_script_prompt_composition [EXTRACTED 1.00]
- **Landing Page Retheme Decision Set** — updates_retheme_ramp_override, updates_oklch_wcag_contrast, updates_semantic_colour_preserved, updates_landing_page, updates_single_history_drawer [EXTRACTED 1.00]
- **HTML Extraction Fixture Suite (rich, malformed, images-only, minimal)** — tests_fixtures_html_rich_fixture, tests_fixtures_html_malformed_fixture, tests_fixtures_html_images_only_fixture, tests_fixtures_html_simple_fixture [INFERRED 0.95]
- **Next.js Starter Template Boilerplate Icon Set** — public_file_icon, public_globe_icon, public_window_icon, public_next_logo, public_vercel_logo [INFERRED 0.95]

## Communities (32 total, 7 thin omitted)

### Community 0 - "Document Model Core"
Cohesion: 0.07
Nodes (62): main(), countChars(), countRuns(), createIdFactory(), makeRun(), renderRun(), splitWhitespace(), DocumentError (+54 more)

### Community 1 - "HTTP API Routes"
Cohesion: 0.06
Nodes (61): POST(), ALLOWED_OUTPUTS, GET(), POST(), runtime, validOutputs, validStyles, GET() (+53 more)

### Community 2 - "Main App UI Pages"
Cohesion: 0.05
Nodes (45): fetchHistory(), Home(), fetchAnalysis(), handleAnalyze(), handleRewrite(), Mode, Landing(), handleHumanize() (+37 more)

### Community 3 - "Segment Humanizer Batching"
Cohesion: 0.11
Nodes (30): isFrozenBlockRun(), isFrozenText(), isHumanizableBlock(), isHumanizableText(), BATCH_CHAR_BUDGET, BATCH_CONCURRENCY, EXTENSION_FORMATS, MAX_FILE_BYTES (+22 more)

### Community 4 - "Runtime Dependencies"
Cohesion: 0.06
Nodes (32): better-sqlite3, @google/generative-ai, jszip, next, allowScripts, better-sqlite3@13.0.2, dependencies, better-sqlite3 (+24 more)

### Community 5 - "TypeScript Build Config"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 6 - "DOCX Parse And Validate"
Cohesion: 0.14
Nodes (23): blockKind(), extractDocx(), pStyle(), closest(), DocxPart, elementsByTag(), hasDescendant(), isElementNode() (+15 more)

### Community 7 - "Dev Tooling Dependencies"
Cohesion: 0.08
Nodes (25): dotenv, eslint, eslint-config-next, devDependencies, dotenv, eslint, eslint-config-next, tailwindcss (+17 more)

### Community 8 - "Document Upload UI"
Cohesion: 0.13
Nodes (15): DocumentPanel(), DocumentResponse, extensionOf(), FALLBACK_CONFIG, FORMAT_LABELS, UploadConfig, DocumentUpload(), DocumentUploadProps (+7 more)

### Community 9 - "Product Vision And Features"
Cohesion: 0.21
Nodes (17): Custom Writing Profiles, Feedback Learning, Humify Platform, Multi-Language Support (15 languages), REST API Access (POST /api/v1/rewrite), Side-by-Side Comparison, Style Presets (Professional/Casual/Academic/Friendly), Text Rewriting (Core Humanization) (+9 more)

### Community 10 - "Settings And API Keys"
Cohesion: 0.15
Nodes (9): ApiKeyManager(), fetchKeys(), handleCreate(), Header(), HeaderProps, isDark(), subscribe(), ThemeToggle() (+1 more)

### Community 11 - "Output Comparison Widgets"
Cohesion: 0.18
Nodes (8): ComparisonView(), ComparisonViewProps, wordCount(), FeedbackButtons(), FeedbackButtonsProps, OutputActions(), OutputActionsProps, FeedbackRating

### Community 12 - "Document Pipeline Spec"
Cohesion: 0.19
Nodes (13): Architecture: Keep Document Conversion Separate from Rewriting, DOCX Processing Flow (parse → extract runs → replace → reconstruct), Formatting Validation Layer, HTML Processing Flow (parse DOM → replace text nodes → serialize), Requirement: Only Modify Textual Content, Spec: HTML & DOCX Formatting Preservation Task, Document Upload UI (drag & drop, ready state, download), Humify Updates Log (+5 more)

### Community 13 - "Batching And Preservation"
Cohesion: 0.27
Nodes (10): Paragraph Batching (~6000 chars per Gemini call), Document Humanizing (HTML & DOCX), Document Pipeline Environment Variables, Formatting Preservation Report (measured, not asserted), Four-Step Document Pipeline (parse, extract, rewrite, rebuild+report), Humanization Strategy: Group Compatible Text, Map Back, Performance: Batch Text, Enforce File-Size Limits, POST /api/documents/humanize Route (+2 more)

### Community 14 - "Deployment And Persistence"
Cohesion: 0.22
Nodes (9): humify-data named volume, docker-compose humify service, Docker Deployment (multi-stage, non-root), Monitoring Dashboard, Rewrite History, SQLite Persistence (better-sqlite3, WAL mode), Modular Architecture (UI / prompt layer / Gemini wrapper / document pipeline / persistence), Non-Functional Requirements (modular, dockerized, eval suite) (+1 more)

### Community 15 - "Root Layout And Fonts"
Cohesion: 0.25
Nodes (6): dmSans, dmSerifDisplay, geistMono, geistSans, metadata, InlineScript()

### Community 16 - "HTML Fixture Edge Cases"
Cohesion: 0.25
Nodes (8): Exported-Document Markup Reality, Malformed HTML Fixture, Unbalanced Tag Recovery, Code and Script Blocks Must Not Be Humanized, Rich HTML Fixture, Inline Formatting and Attribute Preservation, Deeply Nested Formatting Case, Structural Element Coverage (headings, lists, tables, figures, blockquotes)

### Community 17 - "Sanitization And Testing"
Cohesion: 0.29
Nodes (7): Preview-Only HTML Sanitization, Security: Sanitize Uploaded HTML Before Display, Never-Humanize Elements (script, style, code, pre) and URLs/emails, Automated Tests and tests/fixtures Requirement, Fake Model Test Helper (offline marker-protocol stand-in), isFrozenText / isFrozenBlockRun (URL & email freeze bugfix), Document Test Suite (73 tests, node:test via tsx)

### Community 18 - "Marker Protocol Limits"
Cohesion: 0.29
Nodes (7): PDF Explicitly Out of Scope, Run-Level Formatting Preservation Requirement, Success Metrics (BERTScore > 0.95, <3s response, <2% failure), evaluate-documents.ts (live Gemini fixture evaluation), Known Limitations of Document Preservation, Marker-Preserving Batch Rewrite Protocol, Word Field Codes (w:instrText) Skipped

### Community 19 - "Text Rewrite Evaluation"
Cohesion: 0.38
Nodes (6): EvalResult, main(), runTestCase(), TEST_CASES, TestCase, wordOverlap()

### Community 20 - "Gemini Model Integration"
Cohesion: 0.33
Nodes (6): 429 Too Many Requests = Deprecated Model, Google Gemini Flash (gemini-flash-latest), Writing Analysis Dashboard, Structured JSON Analysis Response from Gemini, Error Handling Requirements (never silently discard content), Phase 2: AI Writing Analysis Dashboard

### Community 21 - "Landing Page Retheme"
Cohesion: 0.40
Nodes (5): Landing Draft Hand-off via sessionStorage (draft.ts), Landing Page (direction 1a wireframe) with /app move, OKLCH-Derived Ramps Holding WCAG AA Contrast, Retheme by Redefining Tailwind Color Ramps, Semantic Colour Preserved, Not Restyled

### Community 22 - "Project Instruction Docs"
Cohesion: 0.50
Nodes (4): Next.js Agent Rules (breaking-change warning), CLAUDE.md Project Instructions, Tech Stack (Next.js 16, React 19, Tailwind 4, TypeScript), Next.js create-next-app Boilerplate README

### Community 23 - "Baseline HTML Fixtures"
Cohesion: 0.50
Nodes (4): Images-Only HTML Fixture, No-Extractable-Text Edge Case, Simple HTML Fixture, Minimal Document Baseline

### Community 24 - "Dark Mode Theming"
Cohesion: 0.67
Nodes (3): Dark Mode Toggle, Lint Clean-up (react-hooks set-state-in-effect), ThemeToggle via useSyncExternalStore + MutationObserver

## Knowledge Gaps
- **128 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `private` (+123 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Style` connect `Main App UI Pages` to `Document Upload UI`, `HTTP API Routes`, `Document Model Core`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `Language` connect `Main App UI Pages` to `Document Upload UI`, `HTTP API Routes`, `Document Model Core`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `name` to the rest of the system?**
  _128 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Document Model Core` be split into smaller, more focused modules?**
  _Cohesion score 0.06962025316455696 - nodes in this community are weakly interconnected._
- **Should `HTTP API Routes` be split into smaller, more focused modules?**
  _Cohesion score 0.06350877192982456 - nodes in this community are weakly interconnected._
- **Should `Main App UI Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.051923076923076926 - nodes in this community are weakly interconnected._
- **Should `Segment Humanizer Batching` be split into smaller, more focused modules?**
  _Cohesion score 0.10588235294117647 - nodes in this community are weakly interconnected._