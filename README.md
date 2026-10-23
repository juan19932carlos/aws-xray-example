# aws-xray-example

Todo app to learn AWS X-Ray. pnpm monorepo.

- `packages/frontend` — Vite + TypeScript form
- `packages/backend` — Lambda (TypeScript) behind API Gateway, saves to DynamoDB
- `template.yaml` — SAM / CloudFormation

## Run

```sh
pnpm install
sam build
sam deploy --guided        # copy the ApiUrl output
cp packages/frontend/.env.example packages/frontend/.env   # set VITE_API_URL
pnpm dev:frontend
```

## See traces

AWS Console → CloudWatch → X-Ray traces → Trace map.
