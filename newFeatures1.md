# Task: Add HTML and DOCX Formatting Preservation to Humify

Implement **HTML and DOCX import/export with formatting preservation** in the existing Humify project.

## Objective

Users should be able to upload or paste an HTML/DOCX document, humanize its text, and receive the humanized document with the **original formatting, structure, and non-text elements preserved**.

The most important requirement is:

> **Only modify the textual content. Do NOT destroy or unnecessarily modify document formatting or structure.**

---

## 1. Supported Formats

Add support for:

### Input

* `.html`
* `.htm`
* `.docx`

### Output

* `.html`
* `.docx`
* `.txt` as the existing fallback

Do NOT implement PDF yet.

---

# 2. HTML Processing

For HTML:

```text
HTML document
      ↓
Parse DOM
      ↓
Identify text nodes
      ↓
Extract only human-readable text
      ↓
Send text to existing Humify rewriting pipeline
      ↓
Replace original text nodes
      ↓
Serialize DOM
      ↓
Download humanized HTML
```

### Critical requirement

Preserve:

* `<h1>`–`<h6>`
* `<p>`
* `<strong>`
* `<b>`
* `<em>`
* `<i>`
* `<u>`
* `<s>`
* `<a>`
* `<ul>`
* `<ol>`
* `<li>`
* `<table>`
* `<thead>`
* `<tbody>`
* `<tr>`
* `<td>`
* `<th>`
* `<blockquote>`
* `<code>`
* `<pre>`
* `<br>`
* classes
* IDs
* inline styles
* hyperlinks
* images
* document structure

Do NOT send HTML markup to Gemini as normal text.

For example:

```html
<p>
  This is <strong>very important</strong>.
</p>
```

should remain structurally equivalent to:

```html
<p>
  This is <strong>extremely important</strong>.
</p>
```

The model should only modify the text.

---

# 3. Do NOT Humanize These HTML Elements

Never modify the contents of:

```text
<script>
<style>
<code>
<pre>
```

Also preserve:

* URLs
* email addresses
* HTML attributes
* CSS
* JavaScript
* IDs
* class names

exactly.

---

# 4. DOCX Processing

Add DOCX parsing and generation.

Use a mature Node.js DOCX library rather than implementing the DOCX format manually.

The pipeline should be:

```text
DOCX
 ↓
Parse document
 ↓
Extract paragraphs/runs
 ↓
Extract human-readable text
 ↓
Humanize text
 ↓
Replace text
 ↓
Reconstruct DOCX
 ↓
Download
```

Preserve as much of the original document structure and formatting as technically possible.

Preserve:

* headings
* paragraphs
* bold
* italic
* underline
* font family
* font size
* text color
* alignment
* indentation
* line spacing
* paragraph spacing
* bullets
* numbered lists
* tables
* hyperlinks
* headers
* footers
* page breaks
* images
* section structure

---

# 5. Important DOCX Requirement

Do NOT treat the entire DOCX as plain text.

For example:

```text
[Heading]
Introduction

[Paragraph]
This is an important paragraph.
```

should become:

```text
[Heading]
Introduction

[Paragraph]
This is a more natural paragraph.
```

while keeping the original heading style and paragraph formatting.

---

# 6. Run-Level Formatting

DOCX often stores formatting at the **run level**.

Example:

```text
This is [bold]very important[/bold] information.
```

Do not flatten this into one unformatted string.

Preserve the run structure wherever possible.

If a paragraph contains:

```text
Run 1 → normal
Run 2 → bold
Run 3 → italic
```

the humanized output should retain those formatting properties.

---

# 7. Humanization Strategy

Do NOT send an entire document to Gemini if it can be avoided.

Instead:

```text
Document
   ↓
Text extraction
   ↓
Group compatible text
   ↓
Humanize
   ↓
Map output back
```

Avoid making unnecessary separate API calls for every tiny text fragment.

For example, don't call Gemini independently for:

```text
"This"
"is"
"a"
"sentence."
```

Instead group appropriate text segments while maintaining a mapping to their original locations.

---

# 8. Preserve Meaning and Formatting

The existing Humify evaluation system should continue to work.

For every conversion, verify:

### Semantic preservation

The meaning of the original text must remain unchanged.

### Formatting preservation

The document structure and formatting must remain intact.

### Content preservation

Do not lose:

* tables
* images
* links
* headings
* lists
* headers
* footers

---

# 9. Add a Formatting Validation Layer

Create a validator that compares the document before and after processing.

For HTML compare:

```text
DOM structure
tag counts
links
images
attributes
classes
IDs
styles
```

For DOCX compare:

```text
paragraph count
table count
image count
heading count
hyperlink count
style information
section count
```

Report something like:

```text
Formatting Preservation Report

Text modified:          YES
Paragraphs preserved:   100%
Headings preserved:     100%
Tables preserved:       100%
Images preserved:       100%
Links preserved:        100%
Styles preserved:       98.7%
```

Do not claim 100% preservation unless the validator actually verifies it.

---

# 10. Error Handling

Handle:

* corrupted HTML
* malformed HTML
* invalid DOCX
* empty documents
* documents containing only images
* unsupported elements
* Gemini API failures
* partial processing failures
* excessively large documents

Never silently discard content.

If something cannot be preserved, clearly report it to the user.

---

# 11. UI

Add a document upload area to the existing Humify UI.

Support:

```text
Drag & Drop

or

Upload Document
```

Show:

```text
example.docx
2.4 MB
✓ Ready
```

After processing:

```text
Original Document
        ↓
Humanized Document
        ↓
Download DOCX
```

For HTML:

```text
Download HTML
```

Keep the existing text humanization interface unchanged.

---

# 12. Architecture

Keep document conversion separate from the existing rewriting logic.

Use something similar to:

```text
lib/
  humanizer/
    rewrite.ts
    analyzer.ts
    evaluator.ts

  documents/
    html/
      parser.ts
      extractor.ts
      replacer.ts
      validator.ts

    docx/
      parser.ts
      extractor.ts
      replacer.ts
      validator.ts

    common/
      types.ts
      document-model.ts
```

Create a common internal representation where useful:

```text
Document
 ├── blocks
 │    ├── paragraph
 │    ├── heading
 │    ├── table
 │    └── list
 │
 └── text runs
```

Do not unnecessarily rewrite existing Humify architecture.

---

# 13. Testing

Create automated tests for:

### HTML

* simple paragraphs
* headings
* bold/italic text
* nested formatting
* lists
* tables
* links
* images
* code blocks
* scripts/styles

### DOCX

* headings
* formatted runs
* lists
* tables
* hyperlinks
* images
* headers/footers
* page breaks
* multiple sections

Create fixture files under:

```text
tests/fixtures/
```

For every fixture:

```text
input
 ↓
process
 ↓
output
 ↓
validate
```

---

# 14. Security

Do not blindly render uploaded HTML.

Sanitize potentially dangerous HTML before displaying it in the browser.

Prevent:

* XSS
* script execution
* malicious HTML
* unsafe URLs

Uploaded files must never execute arbitrary JavaScript.

---

# 15. Performance

For large documents:

* process text in batches
* avoid unnecessary Gemini calls
* preserve a mapping between source text and output text
* avoid loading unnecessarily large files into memory
* enforce reasonable file-size limits

Do not optimize prematurely, but keep the architecture extensible.

---

# 16. Important Constraint

**Do not change the existing Gemini humanization behavior unless required.**

The goal of this task is to add:

```text
HTML/DOCX
    ↓
format-aware extraction
    ↓
existing Humify humanization
    ↓
format-aware reconstruction
```

not to redesign Humify.

---

# 17. Deliverables

Implement:

1. HTML upload
2. HTML parsing
3. HTML text extraction
4. HTML reconstruction
5. HTML download
6. DOCX upload
7. DOCX parsing
8. DOCX text extraction
9. DOCX reconstruction
10. DOCX download
11. Formatting validation
12. Automated tests
13. Error handling
14. UI integration
15. Documentation

Before finishing, run:

```bash
npm run lint
npm run build
npm run evaluate
```

and all document-related tests.

Finally, provide a concise implementation report containing:

* files changed
* libraries added
* architecture
* how HTML formatting is preserved
* how DOCX formatting is preserved
* known limitations
* test results
* examples of documents tested
* any formatting that cannot currently be preserved

**Do not deploy anything. Keep everything local for now.**
