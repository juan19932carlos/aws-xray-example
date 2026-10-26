#!/usr/bin/env bash
# Reads the stack outputs, writes the API URL into apps/frontend/.env,
# then builds the frontend and uploads it to the S3 bucket.
set -euo pipefail

STACK=xray-example-app

output() {
  aws cloudformation describe-stacks --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

API_URL=$(output ApiUrl)
BUCKET=$(output FrontendBucketName)

echo "VITE_API_URL=$API_URL" > apps/frontend/.env

pnpm --filter frontend build
aws s3 sync apps/frontend/dist "s3://$BUCKET" --delete

echo "Site: $(output WebsiteUrl)"
