#!/usr/bin/env bash
# Builds the apps/ecs-todos image, pushes it to ECR, and starts a new ECS deployment.
# The service is created with 0 tasks, because the repository is empty until this script runs.
set -euo pipefail

STACK=xray-example-app

output() {
  aws cloudformation describe-stacks --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

REPO=$(output EcsRepositoryUri)
CLUSTER=$(output EcsClusterName)
SERVICE=$(output EcsServiceName)
REGISTRY=${REPO%%/*}

aws ecr get-login-password | docker login --username AWS --password-stdin "$REGISTRY"

# Fargate runs on arm64 (see RuntimePlatform in the template).
docker build --platform linux/arm64 -t "$REPO:latest" apps/ecs-todos
docker push "$REPO:latest"

aws ecs update-service --cluster "$CLUSTER" --service "$SERVICE" \
  --desired-count 1 --force-new-deployment --query 'service.serviceName' --output text
echo "Deploying $SERVICE. Watch it with: aws ecs describe-services --cluster $CLUSTER --services $SERVICE"
