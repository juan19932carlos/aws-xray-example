# aws-xray-example

Todo app to learn AWS X-Ray. pnpm monorepo.

- `apps/frontend` — Vite + TypeScript form
- `apps/lambda-todos` — Lambda (TypeScript) behind API Gateway, saves to DynamoDB
- `apps/ec2` — Node + Express app for the EC2 instance, `DELETE /todos/:id`
- `apps/docs` — Docusaurus site that shows the ADRs and the journal from `architecture/`
- `infrastructure/template.yaml` — SAM / CloudFormation

## Run

```sh
pnpm install
pnpm deploy          # build, deploy the stack, write the API URL into apps/frontend/.env, upload the frontend
pnpm dev:frontend    # local dev, uses the .env written by deploy
pnpm dev:docs        # docs site (ADRs and journal)
```

## See traces

AWS Console → CloudWatch → X-Ray traces → Trace map.
