# Architecture docs

- All docs are written in English.
- `architecture/decisions/` holds ADRs (Architecture Decision Records), named `NNNN-title.md`.
  - An ADR lists only lasting choices, with the rejected option and the reason.
  - A committed ADR is not edited. A new ADR supersedes the old one.
  - Services that change over time, such as compute, are not decisions.
- `architecture/infrastructure.md` describes the stack as it is, with Mermaid diagrams. Update it in the same commit that changes `infrastructure/template.yaml`.
- `architecture/journal/` holds the journal. See `.claude/rules/journal.md`.
- `architecture/site/` is the Docusaurus site that shows `decisions/` and `journal/`. A new top-level section needs its own docs plugin instance in `architecture/site/docusaurus.config.ts`.
