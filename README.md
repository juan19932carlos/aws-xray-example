# aws-xray-example

Todo app to learn AWS X-Ray. pnpm monorepo.

- `packages/frontend` — Vite + TypeScript form
- `packages/backend` — Lambda (TypeScript) behind API Gateway, saves to DynamoDB
- `infrastructure/template.yaml` — SAM / CloudFormation

## Run

```sh
pnpm install
pnpm deploy          # build, deploy the stack, write the API URL into packages/frontend/.env, upload the frontend
pnpm dev:frontend    # local dev, uses the .env written by deploy
```

## See traces

AWS Console → CloudWatch → X-Ray traces → Trace map.
