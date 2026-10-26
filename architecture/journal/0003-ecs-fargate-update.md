# Journal 03: ECS Fargate and the Update feature
* **Date:** 2026-10-26
* **Main goal:** Run a container on ECS Fargate that serves `PATCH /todos/:id`, with no X-Ray set up, to see how it fails and then fix it step by step.

---

## 1. Segment: Fargate over reusing the EC2 instance
* **Action:** Compared two ways to run ECS: Fargate, or the existing EC2 instance as ECS capacity.
* **Result:** ✅ *Worked*. Chose Fargate with an ALB (Application Load Balancer) in front.
* **Finding / Technical note:** Reusing the instance needs the ECS agent and a new image, and its `UserData` already runs another app. A Fargate task gets a new IP on every deploy, so API Gateway needs a fixed address: the ALB. A Cloud Map plus VPC Link setup is cheaper but was left out.

## 2. Segment: The ECS app and its infrastructure
* **Action:** Wrote `apps/ecs-todos` (Express, `PATCH /todos/:id`, `Dockerfile`), `scripts/deploy-ecs.sh`, and in `infrastructure/template.yaml` the ECR repo, cluster, task definition, service, ALB, security groups, roles, and a `patch` route in `TodosApi`. Added a Done/Undo button to the frontend.
* **Result:** ⚠️ *With warnings*. `sam validate --lint` passes. Not deployed and not verified.
* **Finding / Technical note:** The service starts with `DesiredCount: 0`, because ECR is empty on the first deploy and the stack would wait for a task that cannot start. `deploy-ecs.sh` pushes the image and sets 1. `UpdateItem` creates a missing item, so the app adds `attribute_exists(id)` and returns 404 instead.

## 3. Segment: X-Ray in the code, not in the infrastructure
* **Action:** The app uses `aws-xray-sdk-core` and `aws-xray-sdk-express` (`openSegment`, `closeSegment`) and wraps the DynamoDB client with `captureAWSv3Client`. The task has one container, no `aws-xray-daemon` sidecar. `EcsTaskRole` has no X-Ray policy.
* **Result:** ⚠️ *With warnings*. Nothing to verify yet.
* **Finding / Technical note:** The SDK sends segments to a daemon on `127.0.0.1:2000`. Nothing listens there, so the segments are dropped. Expected in X-Ray: the API Gateway segment and an inferred ALB node, with no details and no DynamoDB subsegment. Fix list, one at a time: (1) add the daemon sidecar, (2) add `AWSXRayDaemonWriteAccess` to the task role, (3) set `AWS_XRAY_DAEMON_ADDRESS` to the sidecar if it does not share `127.0.0.1`.

---

## 📌 Summary and Next Steps
* **Key achievements:** Full ECS Fargate path written, with X-Ray missing on purpose.
* **Technical debt or pending items for tomorrow:** Set `VpcId` and `SubnetIds` in `samconfig.toml`, run `pnpm deploy`, press Done in the frontend, read the trace, then fix the items above.
