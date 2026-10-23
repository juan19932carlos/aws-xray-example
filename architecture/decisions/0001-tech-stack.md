# 0001. Tech stack

- **Status:** Accepted
- **Date:** 2026-10-23

## Context

Todo app built to learn AWS X-Ray. Goals: low cost, one environment, few moving parts.

Only lasting choices are listed. Services that change over time, such as compute, are not decisions here.

This is a snapshot. When a choice changes, a new ADR supersedes the row. This file is not edited after it is committed.

## Decision

| Area | Choice | Rejected | Why |
| --- | --- | --- | --- |
| Language | TypeScript | JavaScript | One typed language for frontend and backend. |
| Tool versions | mise | nvm, asdf | One file pins node, pnpm, aws-sam, aws-cli, esbuild. |
| Database | DynamoDB | RDS | No servers, pay per request. |
| Infrastructure as code | AWS SAM | CDK, Terraform | Short template for Lambda and API. |

## Consequences

- `samconfig.toml` is in `.gitignore`. It stays on one machine.
- One environment only. No staging.
