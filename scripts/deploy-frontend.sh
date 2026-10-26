#!/usr/bin/env bash
# Reads the stack outputs, writes both API URLs into apps/frontend/.env,
# then builds the frontend and uploads it to the S3 bucket.
set -euo pipefail

STACK=xray-example-app

output() {
  aws cloudformation describe-stacks --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

API_URL=$(output ApiUrl)
WEB_API_URL=$(output WebUrl)
BUCKET=$(output FrontendBucketName)

printf "VITE_API_URL=%s\nVITE_WEB_API_URL=%s\n" "$API_URL" "$WEB_API_URL" > apps/frontend/.env

pnpm --filter frontend build
aws s3 sync apps/frontend/dist "s3://$BUCKET" --delete

echo "Site: $(output WebsiteUrl)"
