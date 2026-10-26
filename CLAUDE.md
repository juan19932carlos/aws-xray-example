# aws-xray-example

Todo app used to learn AWS X-Ray. pnpm monorepo, deployed with SAM (CloudFormation).

## Layout

- `infrastructure/template.yaml` — SAM template: DynamoDB table (`id` string key), REST API, one Lambda, tracing on, public S3 bucket with website hosting for the frontend.
- `apps/lambda-todos/src/handler.ts` — the todos Lambda. `GET /todos` scans, `POST /todos` puts. Needs `title` in the body.
- `apps/` — every application. Layout and dependency rules are in `.claude/rules/repo-layout.md`.
- `apps/frontend` — Vite + vanilla TypeScript. Reads the API base URLs from `VITE_API_URL` (todos API) and `VITE_WEB_API_URL` (EC2 API).
- `apps/docs` — Docusaurus site (docs-only, Mermaid on). The docs plugin reads `architecture/` directly (`path: '../../architecture'`); `architecture/infrastructure.md` is excluded. Markdown is parsed with `format: 'detect'`, so `.md` is plain CommonMark.
- `apps/ec2` — Node + Express app run by hand on the EC2 instance (not deployed by SAM). `DELETE /todos/:id`, wrapped with the X-Ray SDK.

## Tooling

- Tools are pinned in `mise.toml`: node, pnpm, aws-sam, aws-cli, esbuild. Run commands through `mise exec --` if the shell is not activated.
- `mise.toml` sets `AWS_PROFILE=personal` and `AWS_REGION=us-east-1`. Do not run against `monks-itn` or `watts` (work accounts).

## Rules

Repo-wide rules are in `.claude/rules/`: layout, commits, journal, architecture docs.

- X-Ray: every AWS SDK client in the Lambda must be wrapped with `AWSXRay.captureAWSv3Client`. An unwrapped client gives no subsegment in the trace.
- `Tracing: Active` (Lambda) and `TracingEnabled: true` (API) live in `infrastructure/template.yaml` under `Globals`. Keep them there.
- The Lambda is bundled by SAM with esbuild (`Metadata` in `infrastructure/template.yaml`). `CodeUri` is `../apps/lambda-todos` (relative to the template), `EntryPoints` is `src/handler.ts`. Each Lambda has its own `CodeUri`.
- CORS is set twice. `TodosApi` has `Cors` (the `OPTIONS` preflight). The handler adds `Access-Control-Allow-Origin` to every response, because a Lambda proxy passes its reply as is. Add the header to every new response.

## Commands

- `pnpm typecheck` — check all apps.
- `pnpm deploy` — build, deploy the stack, write the `ApiUrl` output into `apps/frontend/.env` as `VITE_API_URL` (`scripts/deploy-frontend.sh`), build and upload the frontend. That script overwrites `.env`.
- `pnpm dev:frontend` — run the frontend (start it yourself).
- `pnpm dev:docs` — run the docs site (start it yourself).
