# Markdown in Personal dashboard

This app renders Markdown in **task descriptions**, **project and epic descriptions**, **note bodies**, **owner entry bodies**, and similar fields using [CommonMark](https://commonmark.org/) plus **GitHub Flavored Markdown (GFM)** and several **Obsidian-style** conveniences. Content is sanitized for safety (no scripts, limited HTML).

Processing order for those fields: **YAML frontmatter** (if present at the very start) is stripped first, then **wiki links** `[[…]]` are expanded, then the Markdown parser runs.

---

## Quick reference

| Feature | Supported |
|--------|------------|
| Headings `#`–`######` | Yes |
| **Bold**, *italic*, ***both*** | Yes |
| `Inline code` | Yes |
| Fenced code blocks with language | Yes (syntax highlighting) |
| Links & images | Yes |
| Tables | Yes (GFM) |
| Strikethrough `~~text~~` | Yes (GFM) |
| Task lists `- [ ]` / `- [x]` | Yes (GFM) |
| Footnotes `[^1]` | Yes (GFM) |
| Autolink URLs & emails | Yes (GFM) |
| Highlight `==text==` | Yes (Obsidian-style) |
| YAML frontmatter at file start | Stripped (not shown in preview) |
| Wiki links `[[…]]` | See [Wiki links](#wiki-links) |
| Callouts / alerts in blockquotes | Yes (GitHub-style) |
| Heading IDs (anchor links) | Yes |
| Math `$…$` / Mermaid | No |
| HTML blocks | Limited; unsafe tags removed |

---

## Headings

```markdown
# Title
## Section
### Subsection
```

Heading elements get stable `id` attributes (for fragment links). Link with `[text](#section-id)` where the id is derived from the heading text (slug).

---

## Emphasis

- `**bold**` or `__bold__`
- `*italic*` or `_italic_`
- `***bold italic***`

---

## Code

### Inline

Wrap with single backticks: `` `const x = 1` ``.

### Fenced blocks (syntax highlighting)

Use triple backticks and an optional **language** identifier (lower case, letters/digits/`+`/`#` — common examples: `ts`, `tsx`, `js`, `json`, `bash`, `python`, `sql`, `html`, `css`).

````markdown
```typescript
function greet(name: string) {
  return `Hello, ${name}`;
}
```
````

Unknown language labels still render as a monospace block; highlighting falls back sensibly.

---

## Links and images

```markdown
[Dashboard](/)

![Alt text](https://example.com/image.png)
```

HTTP/HTTPS images and links are allowed. Other schemes may be stripped by the sanitizer.

---

## Tables (GFM)

```markdown
| Column A | Column B |
|----------|----------|
| One      | Two      |
```

---

## Task lists (GFM)

```markdown
- [ ] Todo item
- [x] Done item
```

---

## Strikethrough (GFM)

```markdown
~~deprecated~~
```

---

## Footnotes (GFM)

```markdown
Sentence with a note.[^fn]

[^fn]: Footnote text here.
```

Footnotes appear at the bottom of the rendered document with a separator.

---

## Highlight (Obsidian-style)

```markdown
This is ==important== text in a sentence.
```

Renders as a highlighted span (similar to Obsidian’s highlight).

---

## YAML frontmatter (Obsidian-style)

If the document **starts** with a YAML block between `---` lines, that block is **removed** before Markdown is parsed. It is **not** shown in the preview and is **not** interpreted as metadata in the app (use it for your own notes when editing elsewhere; the body should start after the closing `---`).

```markdown
---
title: My doc
tags: [a, b]
---

Real content starts here.
```

---

## Wiki links

Bare `[[…]]` links are preprocessed **after** frontmatter removal and **before** Markdown runs. Each segment can be a **UUID** or a **public entity key** (for example `RBRAND-592` or legacy `TAG-ABC12D`); use the values shown in the UI or in your local `data/store.json`. In the table below, placeholders like `{id}` mean “that entity’s UUID or key,” with **no spaces** inside the brackets.

| Form | Resolves to | Examples |
|------|-------------|----------|
| `[[owner:id]]` | `/owners/{id}` | `[[owner:f47ac10b-58cc-4372-a567-0e02b2c3d479]]`, `[[owner:TEAM-15]]` |
| `[[project:id]]` | `/projects/{id}` | `[[project:a1111111-b222-c333-d444-eeeeeeeeeeee]]`, `[[project:PROJ-100]]` |
| `[[epic:id]]` | `/epics/{id}` | `[[epic:b2222222-c333-d444-e555-ffffffffffff]]`, `[[epic:GROWTH-8]]` |
| `[[task:id]]` | `/tasks/{id}` | `[[task:c3333333-d444-e555-f666-111111111111]]`, `[[task:BUG-240]]` |
| `[[note:entry:entryId]]` | `/notes/{entryId}` | `[[note:entry:d4444444-e555-f666-a777-222222222222]]`, `[[note:entry:LOG-5-99]]` |
| `[[note:project:projectId:entryId]]` | `/notes/{entryId}` | `[[note:project:a1111111-b222-c333-d444-eeeeeeeeeeee:d4444444-e555-f666-a777-222222222222]]` |
| `[[note:ownerId:entryId]]` | `/owners/{ownerId}/entries/{entryId}` | `[[note:f47ac10b-58cc-4372-a567-0e02b2c3d479:d4444444-e555-f666-a777-222222222222]]`, `[[note:TEAM-15:LOG-5-99]]` |
| Any other `[[text]]` | Inline chip (not a link) | `[[partner:acme]]` (old prefix, ignored), `[[owner]]` (missing id), `[[note:entry]]` (missing id), `[[just some words]]` |

---

## Callouts / alerts (GitHub-style blockquotes)

Use blockquotes with a bold label line:

```markdown
> [!NOTE]
> Useful information.

> [!TIP]
> A suggestion.

> [!IMPORTANT]
> Key point.

> [!WARNING]
> Caution.

> [!CAUTION]
> Risk of breakage.
```

Styling comes from GitHub’s alert convention; appearance matches the bundled alert CSS.

---

## Horizontal rule

```markdown
---
```

Use a line with three or more `-` on its own (ensure it cannot be parsed as a YAML fence at **document start** only).

---

## Line breaks

Single newlines inside paragraphs are **not** hard line breaks (standard Markdown). End a line with two spaces or use a blank line between paragraphs.

---

## What is not supported

- **LaTeX / math** (`$…$`, `$$…$$`) — not rendered.
- **Mermaid** or other diagram blocks — not rendered.
- **Embeds** (PDF, tweets, etc.) — not supported.
- **Obsidian internal embeds** `![[note]]` — not supported; use wiki links or normal links instead.
- **Raw HTML** — largely stripped; safe subset only (e.g. callout `div`s from alerts, `mark` for highlights).

---

## Security

All Markdown is passed through a sanitizer. Do not rely on Markdown for secrets; treat descriptions as user-visible text only.
