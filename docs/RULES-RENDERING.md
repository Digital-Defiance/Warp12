# Rules Rendering Pipeline

## Canonical Source

**RULES.tex** is the canonical, authoritative rules document. All updates to game rules should be made to this file.

## Build Pipeline

The build pipeline automatically converts RULES.tex to both HTML (for the web app) and Markdown (for GitHub/docs):

1. **Source**: `RULES.tex` (canonical LaTeX document)
2. **Build**: `yarn build:rules` (via `tools/build-stamped.mjs`):
   - LaTeX → PDF via two `pdflatex` passes (`RULES.pdf`; two passes settle `longtable` column widths)
   - LaTeX → HTML with MathJax support (`RULES.html`)
   - LaTeX → GitHub-flavored Markdown (`RULES.md`)
   - Skips when `RULES.tex` is unchanged (stamp: `.docs-build-stamps.json`). Force with `yarn build:rules:force`.
3. **Runtime**: React app imports and renders the pre-built HTML

## Why Not Browser-Side LaTeX?

We tried `latex-content-renderer` but it only supports simple LaTeX fragments (inline math, basic tables). RULES.tex is a complex document with:
- Multi-level sections and subsections
- Complex longtable environments
- Custom LaTeX commands
- Cross-references

Pandoc handles all of this correctly at build time, producing clean HTML and readable Markdown.

## Updating Rules

When you edit RULES.tex:

```bash
# Regenerate both HTML and Markdown
yarn build:rules

# Or use the full build (includes build:rules)
yarn build:all

# The dev server will hot-reload automatically
yarn serve:bridge
```

**Important**: Don't manually edit RULES.html or RULES.md — they are generated files that will be overwritten on next build.

## Files

- `RULES.tex` — Canonical source (update this!)
- `RULES.pdf` — Generated PDF (don't edit, regenerate with `yarn build:rules`)
- `RULES.html` — Generated HTML for web app (don't edit, regenerate with `yarn build:rules`)
- `RULES.md` — Generated Markdown for GitHub/docs (don't edit, regenerate with `yarn build:rules`)
- `apps/Warp12/src/app/rules-html.tsx` — React component that renders HTML
- `apps/Warp12/src/content/rules-source.ts` — Imports RULES.html as raw text

## Dependencies

- **pandoc** (system requirement): `brew install pandoc`
- **pdflatex** (system requirement, for `RULES.pdf`): via MacTeX / TeX Live (`brew install --cask mactex-no-gui`)
- **MathJax CDN**: Loaded in index.html for math rendering (HTML only)
- Markdown tables render natively on GitHub
