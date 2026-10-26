# 0002. Documentation site

- **Status:** Accepted
- **Date:** 2026-10-26

## Context

The ADRs and the journal are markdown files in `architecture/`. We want to read them as a site, with a sidebar, Mermaid diagrams, and a public page on GitHub Pages.

## Decision

| Area | Choice | Rejected | Why |
| --- | --- | --- | --- |
| Documentation site | Docusaurus | Not compared. MkDocs and VitePress are alternatives. GitHub's own markdown view is the zero-setup one. | It is the one we know and the first that came to mind. There is no strong preference over the others. |

## Consequences

- The site lives in `architecture/site`. It reads `architecture/decisions` and `architecture/journal` in place, so the markdown has one source.
- Mermaid works through `@docusaurus/theme-mermaid`.
- A GitHub Actions workflow publishes it to GitHub Pages on every push to `main`.
- It adds many packages to `pnpm-lock.yaml`.
- The content stays plain markdown, so moving to another tool means changing only `architecture/site`.
