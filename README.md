# aws-xray-example

Todo app to learn AWS X-Ray. pnpm monorepo.

- `packages/frontend` — Vite + TypeScript form
- `packages/backend` — Lambda (TypeScript) behind API Gateway, saves to DynamoDB
- `infrastructure/template.yaml` — SAM / CloudFormation

## Run

```sh
pnpm install
sam build -t infrastructure/template.yaml
sam deploy                 # copy the ApiUrl output
cp packages/frontend/.env.example packages/frontend/.env   # set VITE_API_URL
pnpm dev:frontend
pnpm deploy:frontend       # build and upload to S3, open the WebsiteUrl output
```

## See traces

AWS Console → CloudWatch → X-Ray traces → Trace map.
