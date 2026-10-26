# 0001. First configuration

- **Date:** 2026-10-23

## What we built

A todo app to learn AWS X-Ray, in one CloudFormation stack deployed with SAM.

```mermaid
flowchart LR
    Browser([Browser]) --> Api[API Gateway REST]
    Api --> Lambda[Lambda]
    Lambda --> DDB[(DynamoDB)]
    Api -.traces.-> XRay[[X-Ray]]
    Lambda -.traces.-> XRay
```

- API Gateway REST API with tracing on, `Prod` stage only.
- One Lambda for `GET` and `POST /todos`, with active tracing and `aws-xray-sdk-core` around the DynamoDB client.
- DynamoDB table, key `id`.
- Vite frontend served from an S3 bucket.

## Problems on the way

| Problem | Cause | Fix |
| --- | --- | --- |
| Two stages, `Prod` and `Stage` | SAM makes an extra `Stage` for an implicit API. The leftover stays, because CloudFormation never owned it. | Explicit `AWS::Serverless::Api` with `OpenApiVersion`. Delete the old stage by hand. |
| `nodejs26.x` is not supported | SAM CLI `1.169.0` does not know the preview runtime. | Use `nodejs24.x`. |
| `Cannot find esbuild` | SAM builds in a temp folder and cannot see the pnpm bin. | Add `npm:esbuild` to `mise.toml`. |
| `Cannot use import statement outside a module` | ESM bundle named `.js`, no `"type": "module"` in the Lambda package. | esbuild `OutExtension: .js=.mjs`. |
| CORS error in the browser | No `OPTIONS` route on the API. | `Cors` on `TodosApi`. |
| `undefined/todos` | `VITE_API_URL` empty at build time. | `scripts/deploy-frontend.sh` writes it from the stack output. |

## Lessons

- SAM deploys the stack. It does not upload the frontend.
- CloudFormation only deletes what it owns.
- X-Ray records requests only. Build and deploy errors never show there.
