# Markdown în Personal dashboard

Aplicația randă Markdown în **descrierile sarcinilor**, **descrierile proiectelor și epicelor**, **corpurile notițelor**, **intrările responsabilelor** și câmpuri similare folosind [CommonMark](https://commonmark.org/) plus **GitHub Flavored Markdown (GFM)** și câteva facilități în stil **Obsidian**. Conținutul este sanitizat pentru siguranță (fără scripturi, HTML limitat).

Ordinea de procesare: **YAML frontmatter** (dacă apare chiar la început) este eliminat, apoi linkurile wiki `[[…]]` sunt extinse, apoi rulează parserul Markdown.

---

## Referință rapidă

| Funcționalitate | Suport |
|-----------------|--------|
| Titluri `#`–`######` | Da |
| **Bold**, *italic*, ***ambele*** | Da |
| `Cod inline` | Da |
| Blocuri de cod cu limbaj | Da (highlight sintaxă) |
| Linkuri și imagini | Da |
| Tabele | Da (GFM) |
| Tăiere `~~text~~` | Da (GFM) |
| Liste de taskuri `- [ ]` / `- [x]` | Da (GFM) |
| Note de subsol `[^1]` | Da (GFM) |
| URL-uri și emailuri autolink | Da (GFM) |
| Evidențiere `==text==` | Da (stil Obsidian) |
| YAML frontmatter la început | Eliminat (nu apare în preview) |
| Linkuri wiki `[[…]]` | Vezi [Linkuri wiki](#linkuri-wiki) |
| Callouts / alerte în blockquote | Da (stil GitHub) |
| ID-uri pentru titluri (anchor links) | Da |
| Math `$…$` / Mermaid | Nu |
| Blocuri HTML | Limitat; tagurile nesigure sunt eliminate |

---

## Titluri

```markdown
# Titlu
## Secțiune
### Subsecțiune
```

Titlurile primesc atribute `id` stabile pentru linkuri cu fragment. Le poți referi cu `[text](#id-sectiune)`.

---

## Evidențiere text

- `**bold**` sau `__bold__`
- `*italic*` sau `_italic_`
- `***bold italic***`

---

## Cod

### Inline

Folosește backtick-uri simple: `` `const x = 1` ``.

### Blocuri de cod

Folosește trei backtick-uri și, opțional, un identificator de **limbaj** (`ts`, `tsx`, `js`, `json`, `bash`, `python`, `sql`, `html`, `css` etc.).

````markdown
```typescript
function greet(name: string) {
  return `Salut, ${name}`;
}
```
````

Etichetele necunoscute randă în continuare un bloc monospace.

---

## Linkuri și imagini

```markdown
[Dashboard](/)

![Text alternativ](https://example.com/image.png)
```

Sunt permise imagini și linkuri HTTP/HTTPS. Alte scheme pot fi eliminate de sanitizer.

---

## Tabele (GFM)

```markdown
| Coloana A | Coloana B |
|-----------|-----------|
| Unu       | Doi       |
```

---

## Liste de taskuri (GFM)

```markdown
- [ ] Element todo
- [x] Element finalizat
```

---

## Tăiere (GFM)

```markdown
~~învechit~~
```

---

## Note de subsol (GFM)

```markdown
Propoziție cu notă.[^fn]

[^fn]: Textul notei aici.
```

Notele apar la finalul documentului randat, cu separator.

---

## Evidențiere (stil Obsidian)

```markdown
Acesta este un text ==important== într-o propoziție.
```

Se randă ca un span evidențiat, similar cu highlight-ul din Obsidian.

---

## YAML frontmatter (stil Obsidian)

Dacă documentul **începe** cu un bloc YAML între linii `---`, acel bloc este **eliminat** înainte de parsarea Markdown. Nu apare în preview și nu este interpretat ca metadata în aplicație.

```markdown
---
title: Documentul meu
tags: [a, b]
---

Conținutul real începe aici.
```

---

## Linkuri wiki

Linkurile `[[…]]` sunt procesate **după** eliminarea frontmatter și **înainte** de Markdown. Fiecare segment poate fi un **UUID** sau o **cheie publică de entitate** (de exemplu `RBRAND-592` sau cheia legacy `TAG-ABC12D`). Placeholder-ele ca `{id}` înseamnă UUID-ul sau cheia entității, fără spații în paranteze.

| Formă | Rezolvă la | Exemple |
|-------|------------|---------|
| `[[owner:id]]` | `/owners/{id}` | `[[owner:TEAM-15]]` |
| `[[project:id]]` | `/projects/{id}` | `[[project:PROJ-100]]` |
| `[[epic:id]]` | `/epics/{id}` | `[[epic:GROWTH-8]]` |
| `[[task:id]]` | `/tasks/{id}` | `[[task:BUG-240]]` |
| `[[note:entry:entryId]]` | `/notes/{entryId}` | `[[note:entry:LOG-5-99]]` |
| `[[note:project:projectId:entryId]]` | `/notes/{entryId}` | `[[note:project:PROJ-100:LOG-5-99]]` |
| `[[note:ownerId:entryId]]` | `/owners/{ownerId}/entries/{entryId}` | `[[note:TEAM-15:LOG-5-99]]` |
| Orice alt `[[text]]` | Chip inline, fără link | `[[just some words]]` |

---

## Callouts / alerte (blockquote stil GitHub)

Folosește blockquote-uri cu o linie de etichetă:

```markdown
> [!NOTE]
> Informație utilă.

> [!TIP]
> O sugestie.

> [!IMPORTANT]
> Punct cheie.

> [!WARNING]
> Atenție.

> [!CAUTION]
> Risc de defectare.
```

Stilizarea vine din convenția alertelor GitHub.

---

## Linie orizontală

```markdown
---
```

Folosește o linie cu trei sau mai multe `-` pe cont propriu.

---

## Ruperi de linie

Liniile noi simple în paragrafe **nu** sunt ruperi de linie dure. Termină linia cu două spații sau folosește o linie goală între paragrafe.

---

## Ce nu este suportat

- **LaTeX / math** (`$…$`, `$$…$$`) — nu se randează.
- **Mermaid** sau alte diagrame — nu se randează.
- **Embed-uri** (PDF, tweets etc.) — nu sunt suportate.
- **Embed-uri interne Obsidian** `![[note]]` — nu sunt suportate; folosește linkuri wiki sau linkuri normale.
- **HTML brut** — este în mare parte eliminat; doar un subset sigur rămâne.

---

## Securitate

Tot Markdown-ul trece printr-un sanitizer. Nu te baza pe Markdown pentru secrete; tratează descrierile ca text vizibil utilizatorului.
