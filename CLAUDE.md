# aws-xray-example

Todo app used to learn AWS X-Ray. pnpm monorepo, deployed with SAM (CloudFormation).

## Layout

- `infrastructure/template.yaml` — SAM template: DynamoDB table (`id` string key), one REST API, one Lambda, one EC2 instance, tracing on, public S3 bucket with website hosting for the frontend.
- `apps/lambda-todos/src/handler.ts` — the todos Lambda. `GET /todos` scans, `POST /todos` puts. Needs `title` in the body.
- `apps/` — every application. Layout and dependency rules are in `.claude/rules/repo-layout.md`.
- `apps/frontend` — Vite + vanilla TypeScript. Reads the API base URL from `VITE_API_URL`.
- `architecture/site` — Docusaurus site (Mermaid on). It lives in `architecture/` because it documents the architecture, so it is not an app. Two docs plugin instances read `architecture/decisions` and `architecture/journal`. They are the Decisions and Journal links on the right of the header. `infrastructure.md` is not shown.
- `.github/workflows/docs.yml` — builds `architecture/site` and deploys it to GitHub Pages on every push to `main`. The site lives at `/aws-xray-example/` (`baseUrl`), so `trailingSlash` is `false` and assets must not use root-absolute paths.
- `apps/lambda-traces` — reads traces from the X-Ray API for the viewer page. `GET /traces/services` and `GET /traces`. The viewer is `apps/frontend/traces.html` (the frontend has two Vite pages).
- `apps/ecs-todos` — Node + Express in a container on ECS Fargate. `PATCH /todos/:id`. `scripts/deploy-ecs.sh` builds and pushes the image to ECR. Needs `VpcId` and `SubnetIds` in `samconfig.toml`.
- `apps/ec2` — Node + Express app on the EC2 instance. `DELETE /todos/:id`, wrapped with the X-Ray SDK. SAM does not ship it: `scripts/deploy-ec2.sh` uploads it to the artifacts bucket and the instance pulls it (systemd service `todos-ec2`).

## Tooling

- Tools are pinned in `mise.toml`: node, pnpm, aws-sam, aws-cli, esbuild. Run commands through `mise exec --` if the shell is not activated.
- `mise.toml` sets `AWS_PROFILE=personal` and `AWS_REGION=us-east-1`. Do not run against `monks-itn` or `watts` (work accounts).

## Rules

Repo-wide rules are in `.claude/rules/`: layout, commits, journal, architecture docs.

- X-Ray: every AWS SDK client in the Lambda must be wrapped with `AWSXRay.captureAWSv3Client`. An unwrapped client gives no subsegment in the trace.
- `Tracing: Active` (Lambda) and `TracingEnabled: true` (API) live in `infrastructure/template.yaml` under `Globals`. Keep them there.
- The Lambda is bundled by SAM with esbuild (`Metadata` in `infrastructure/template.yaml`). `CodeUri` is `../apps/lambda-todos` (relative to the template), `EntryPoints` is `src/handler.ts`. Each Lambda has its own `CodeUri`.
- CORS: `TodosApi` has `Cors` (the `OPTIONS` preflight, answered by the gateway). The Lambda and the EC2 app add `Access-Control-Allow-Origin` to every response, because a proxy integration passes the reply as is. Add the header to every new response.
- `UserData` of the EC2 instance runs only on first boot. A change to it needs a new logical ID for the instance.
- `TodosApi` has an explicit `DefinitionBody`: every route declares its own `x-amazon-apigateway-integration`. A new Lambda route needs its path and integration there. EC2 routes use the Elastic IP, never the instance DNS name.

## Commands

- `pnpm typecheck` — check all apps.
- `pnpm deploy` — build, deploy the stack, write the `ApiUrl` output into `apps/frontend/.env` as `VITE_API_URL` (`scripts/deploy-frontend.sh`), build and upload the frontend. That script overwrites `.env`.
- `pnpm deploy:ec2` — upload `apps/ec2` and restart the service. Part of `pnpm deploy`.
- `pnpm deploy:ecs` — build and push the `apps/ecs-todos` image, start a new ECS deployment. Part of `pnpm deploy`.
- `pnpm dev:frontend` — run the frontend (start it yourself).
- `pnpm dev:docs` — run the docs site (start it yourself).
