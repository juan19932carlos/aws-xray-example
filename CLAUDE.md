# aws-xray-example

Todo app used to learn AWS X-Ray. pnpm monorepo, deployed with SAM (CloudFormation).

## Layout

- `infrastructure/template.yaml` — SAM template: DynamoDB table (`id` string key), REST API, one Lambda, tracing on, public S3 bucket with website hosting for the frontend.
- `apps/lambda-todos/src/handler.ts` — the todos Lambda. `GET /todos` scans, `POST /todos` puts. Needs `title` in the body.
- `apps/` — every application lives here. Each Lambda is its own complete project in `apps/lambda-<name>` (own `package.json`, `tsconfig.json`, `src/`). Other apps: `apps/ec2`, `apps/frontend`. A new app goes in `apps/`, never at the repo root and never in `packages/`. A new Lambda is a new `apps/lambda-<name>` folder with the same structure as `apps/lambda-todos`, its own `CodeUri`, and its own `AWS::Serverless::Function` in the template.
- Dependency versions live in the `catalog:` block of `pnpm-workspace.yaml`. In an app's `package.json` write `"catalog:"`, not a version range. To bump a version, change it once in the catalog. Exception: apps that `npm` installs, which cannot read `catalog:`. That is every Lambda (SAM runs `npm install` when it builds) and `apps/ec2` (installed by hand on the instance). They keep explicit versions that must match the catalog. Keep `esbuild` in `mise.toml` in line with the catalog.
- `apps/frontend` — Vite + vanilla TypeScript. Reads the API base URLs from `VITE_API_URL` (todos API) and `VITE_WEB_API_URL` (EC2 API).
- `apps/ec2` — Node + Express app run by hand on the EC2 instance (not deployed by SAM). `DELETE /todos/:id`, wrapped with the X-Ray SDK.

## Tooling

- Tools are pinned in `mise.toml`: node, pnpm, aws-sam, aws-cli. Run commands through `mise exec --` if the shell is not activated.
- `mise.toml` sets `AWS_PROFILE=personal` and `AWS_REGION=us-east-1`. Do not run against `monks-itn` or `watts` (work accounts).
- Use pnpm only. Never npm or yarn.

## Rules

- X-Ray: every AWS SDK client in the Lambda must be wrapped with `AWSXRay.captureAWSv3Client`. An unwrapped client gives no subsegment in the trace.
- `Tracing: Active` (Lambda) and `TracingEnabled: true` (API) live in `infrastructure/template.yaml` under `Globals`. Keep them there.
- The Lambda is bundled by SAM with esbuild (`Metadata` in `infrastructure/template.yaml`). `CodeUri` is `../apps/lambda-todos` (relative to the template), `EntryPoints` is `src/handler.ts`. Each Lambda has its own `CodeUri`.
- CORS is set twice. `TodosApi` has `Cors` (the `OPTIONS` preflight). The handler adds `Access-Control-Allow-Origin` to every response, because a Lambda proxy passes its reply as is. Add the header to every new response.
- Never commit `.env`, `samconfig.toml`, `.aws-sam`, or `*.swp`.

## Commands

- `pnpm typecheck` — check both packages.
- `pnpm deploy` — build, deploy the stack, write the `ApiUrl` output into `apps/frontend/.env` as `VITE_API_URL` (`scripts/deploy-frontend.sh`), build and upload the frontend. That script overwrites `.env`.
- `pnpm dev:frontend` — run the frontend (start it yourself).
