# Repo layout

- Every application lives in `apps/`. Never at the repo root, never in `packages/`.
- Each Lambda is its own complete project in `apps/lambda-<name>`: own `package.json`, `tsconfig.json`, `src/`.
- A new Lambda is a new `apps/lambda-<name>` folder with the same structure as `apps/lambda-todos`, its own `CodeUri`, and its own `AWS::Serverless::Function` in `infrastructure/template.yaml`.
- Other apps: `apps/ec2`, `apps/frontend`.
- Infrastructure code lives in `infrastructure/`. Scripts live in `scripts/`.
- The Docusaurus site is not an app. It lives in `architecture/site` and is a pnpm workspace package (`pnpm-workspace.yaml` lists it).

## Dependency versions

- Versions live in the `catalog:` block of `pnpm-workspace.yaml`. In an app's `package.json` write `"catalog:"`, not a version range. To bump a version, change it once in the catalog.
- Exception: apps that `npm` installs, because npm cannot read `catalog:`. That is every Lambda (SAM runs `npm install` when it builds) and `apps/ec2` (installed by hand on the instance). They keep explicit versions that must match the catalog.
- Keep `esbuild` in `mise.toml` in line with the catalog.
- Use pnpm only. Never npm or yarn at the repo root.
