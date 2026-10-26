#!/usr/bin/env bash
# Packs apps/ec2, uploads it to the artifacts bucket, and restarts the app on the instance.
# The instance pulls the tarball on every start (see UserData in infrastructure/template.yaml).
set -euo pipefail

STACK=xray-example-app

output() {
  aws cloudformation describe-stacks --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

BUCKET=$(output AppArtifactsBucketName)
INSTANCE=$(output WebServerInstanceId)

TARBALL=$(mktemp -t ec2-app).tgz
tar -czf "$TARBALL" --exclude node_modules -C apps/ec2 .
aws s3 cp "$TARBALL" "s3://$BUCKET/ec2-app.tgz"
rm -f "$TARBALL"

# Restart pulls the new tarball. On a fresh instance the SSM agent may not be
# ready yet. The service retries by itself every 15 seconds, so skipping is safe.
if COMMAND_ID=$(aws ssm send-command --instance-ids "$INSTANCE" \
  --document-name AWS-RunShellScript \
  --parameters 'commands=["systemctl restart todos-ec2"]' \
  --query Command.CommandId --output text 2>/dev/null); then
  aws ssm wait command-executed --command-id "$COMMAND_ID" --instance-id "$INSTANCE"
  echo "Restarted todos-ec2 on $INSTANCE"
else
  echo "SSM not ready. The service picks up the new tarball within 15 seconds."
fi
