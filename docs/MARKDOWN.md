# Markdown in Personal dashboard

This app renders Markdown in **task descriptions**, **note bodies**, **epic descriptions**, and other fields using [CommonMark](https://commonmark.org/) plus **GitHub Flavored Markdown (GFM)** and several **Obsidian-style** conveniences. Content is sanitized for safety (no scripts, limited HTML).

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

Bare `[[…]]` links are preprocessed **before** Markdown runs:

| Form | Result |
|------|--------|
| `[[partner:UUID]]` | Owner link to `/owners/UUID` (syntax still uses `partner`) |
| `[[task:UUID]]` | Link to `/tasks/UUID` |
| `[[note:partnerUUID:entryUUID]]` | Link to that note |
| Any other `[[text]]` | Shown as a small inline code chip `` `⟦text⟧` `` (not a link) |

Use the UUIDs from your app or `store.json`.

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
