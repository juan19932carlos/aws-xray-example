# aws-xray-example

Todo app used to learn AWS X-Ray. pnpm monorepo, deployed with SAM (CloudFormation).

## Layout

- `infrastructure/template.yaml` — SAM template: DynamoDB table (`id` string key), REST API, one Lambda, tracing on, public S3 bucket with website hosting for the frontend.
- `apps/lambda-todos/src/handler.ts` — the todos Lambda. `GET /todos` scans, `POST /todos` puts. Needs `title` in the body.
- `apps/` — every application. Layout and dependency rules are in `.claude/rules/repo-layout.md`.
- `apps/frontend` — Vite + vanilla TypeScript. Reads the API base URLs from `VITE_API_URL` (todos API) and `VITE_WEB_API_URL` (EC2 API).
- `apps/docs` — Docusaurus site (docs-only, Mermaid on). The docs plugin reads `architecture/` directly (`path: '../../architecture'`); `architecture/infrastructure.md` is excluded. Markdown is parsed with `format: 'detect'`, so `.md` is plain CommonMark.
- `.github/workflows/docs.yml` — builds `apps/docs` and deploys it to GitHub Pages on every push to `main`. The site lives at `/aws-xray-example/` (`baseUrl`), so `trailingSlash` is `false` and assets must not use root-absolute paths.
- `apps/ec2` — Node + Express app on the EC2 instance. `DELETE /todos/:id`, wrapped with the X-Ray SDK. SAM does not ship it: `scripts/deploy-ec2.sh` uploads it to the artifacts bucket and the instance pulls it (systemd service `todos-ec2`).

## Tooling

- Tools are pinned in `mise.toml`: node, pnpm, aws-sam, aws-cli, esbuild. Run commands through `mise exec --` if the shell is not activated.
- `mise.toml` sets `AWS_PROFILE=personal` and `AWS_REGION=us-east-1`. Do not run against `monks-itn` or `watts` (work accounts).

## Rules

Repo-wide rules are in `.claude/rules/`: layout, commits, journal, architecture docs.

- X-Ray: every AWS SDK client in the Lambda must be wrapped with `AWSXRay.captureAWSv3Client`. An unwrapped client gives no subsegment in the trace.
- `Tracing: Active` (Lambda) and `TracingEnabled: true` (API) live in `infrastructure/template.yaml` under `Globals`. Keep them there.
- The Lambda is bundled by SAM with esbuild (`Metadata` in `infrastructure/template.yaml`). `CodeUri` is `../apps/lambda-todos` (relative to the template), `EntryPoints` is `src/handler.ts`. Each Lambda has its own `CodeUri`.
- CORS is set twice. `TodosApi` has `Cors` (the `OPTIONS` preflight). The handler adds `Access-Control-Allow-Origin` to every response, because a Lambda proxy passes its reply as is. Add the header to every new response.

- `UserData` of the EC2 instance runs only on first boot. A change to it needs a new logical ID for the instance. A raw `AWS::ApiGateway::Deployment` is not redeployed when methods or URIs change. Rename it (`WebDeploymentV3`, `V4`, ...).

## Commands

- `pnpm typecheck` — check all apps.
- `pnpm deploy` — build, deploy the stack, write the `ApiUrl` and `WebUrl` outputs into `apps/frontend/.env` as `VITE_API_URL` and `VITE_WEB_API_URL` (`scripts/deploy-frontend.sh`), build and upload the frontend. That script overwrites `.env`.
- `pnpm deploy:ec2` — upload `apps/ec2` and restart the service. Part of `pnpm deploy`.
- `pnpm dev:frontend` — run the frontend (start it yourself).
- `pnpm dev:docs` — run the docs site (start it yourself).
