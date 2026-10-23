# aws-xray-example

Todo app used to learn AWS X-Ray. pnpm monorepo, deployed with SAM (CloudFormation).

## Layout

- `infrastructure/template.yaml` — SAM template: DynamoDB table (`id` string key), REST API, one Lambda, tracing on, public S3 bucket with website hosting for the frontend.
- `packages/backend/src/handler.ts` — single Lambda. `GET /todos` scans, `POST /todos` puts. Needs `title` in the body.
- `packages/frontend` — Vite + vanilla TypeScript. Reads the API base URL from `VITE_API_URL`.

## Tooling

- Tools are pinned in `mise.toml`: node, pnpm, aws-sam, aws-cli. Run commands through `mise exec --` if the shell is not activated.
- `mise.toml` sets `AWS_PROFILE=personal` and `AWS_REGION=us-east-1`. Do not run against `monks-itn` or `watts` (work accounts).
- Use pnpm only. Never npm or yarn.

## Rules

- X-Ray: every AWS SDK client in the Lambda must be wrapped with `AWSXRay.captureAWSv3Client`. An unwrapped client gives no subsegment in the trace.
- `Tracing: Active` (Lambda) and `TracingEnabled: true` (API) live in `infrastructure/template.yaml` under `Globals`. Keep them there.
- The Lambda is bundled by SAM with esbuild (`Metadata` in `infrastructure/template.yaml`). `CodeUri` is `../packages/backend` (relative to the template), `EntryPoints` is `src/handler.ts`.
- CORS headers are set in the handler. API Gateway has no CORS config. Add headers to every new response.
- Never commit `.env`, `samconfig.toml`, `.aws-sam`, or `*.swp`.

## Commands

- `pnpm typecheck` — check both packages.
- `sam build -t infrastructure/template.yaml && sam deploy` — build and deploy. The `ApiUrl` output goes in `packages/frontend/.env` as `VITE_API_URL`.
- `pnpm dev:frontend` — run the frontend (start it yourself).
