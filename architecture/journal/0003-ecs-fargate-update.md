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
* **Result:** ✅ *Worked as a test*. The trace is broken in the expected way (see segment 6).
* **Finding / Technical note:** The SDK sends segments to a daemon on `127.0.0.1:2000`. Nothing listens there, so the segments are dropped. Expected in X-Ray: the API Gateway segment and an inferred ALB node, with no details and no DynamoDB subsegment. Fix list, one at a time: (1) add the daemon sidecar, (2) add `AWSXRayDaemonWriteAccess` to the task role, (3) set `AWS_XRAY_DAEMON_ADDRESS` to the sidecar if it does not share `127.0.0.1`.

## 4. Segment: First deploy and the empty service
* **Action:** Ran `pnpm deploy` with the new VPC parameters.
* **Result:** ⚠️ *With warnings*. Three separate problems, fixed one by one.
* **Finding / Technical note:**
  * The first deploy ran with `CHANGE_ME` in `VpcId` and `SubnetIds`. CloudFormation rolled back and left the stack in `ROLLBACK_COMPLETE`, which cannot be updated. Delete the stack, then deploy again. No resource was created, so nothing was lost.
  * `SubnetIds` had one subnet. An ALB needs at least two, in different AZs.
  * The service stayed at `desiredCount: 0` and ECR was empty, because Docker was not running and `deploy-ecs.sh` stopped at the first `docker` command. Checks that found it: `aws ecr describe-images`, `aws ecs describe-services`, `aws ecs list-tasks --desired-status STOPPED`.
  * While the service had no task, `PATCH` returned `503` from the ALB. That page has no CORS headers, so the browser only showed `Failed to fetch`.

## 5. Segment: Inline title edit in the frontend
* **Action:** Click on the todo text turns it into an input. Enter sends `PATCH /todos/:id` with `{ title }`. Escape or leaving the field cancels.
* **Result:** ✅ *Worked*.
* **Finding / Technical note:** The backend already took `title`. Only the frontend lacked the edit. The first "edit is broken" report was the `503` above, not the edit code.

## 6. Segment: Reading the service map and the traces
* **Action:** Checked the map with `aws xray get-service-graph`, `get-trace-summaries` and `batch-get-traces`.
* **Result:** ✅ *Worked*. Every oddity on the map has a reason.
* **Finding / Technical note:**
  * **Two Lambda nodes:** Lambda writes two segments. `AWS::Lambda` is the service. `AWS::Lambda::Function` is the code, and it is the child.
  * **Many Remote nodes:** API Gateway names the remote node with the full URL, so each `/todos/<id>` on the ALB is its own node. Failed calls (`503`) make them too. No segment comes from ECS, because the SDK sends to `127.0.0.1:2000` and no daemon listens there.
  * **The ALB cannot fix it.** It only adds the `X-Amzn-Trace-Id` header. It sends no segments to X-Ray. A real segment from the container replaces the Remote nodes, as `xray-example-ec2` already does for `DELETE /todos/<id>`.
  * **Second Client node:** internet scanners (`zgrab` user agent, non-AWS IPs) call the EC2 Elastic IP directly. The EC2 app has the SDK, so each call is a root segment with no parent, and X-Ray draws a Client for it.

```mermaid
flowchart LR
    C1([Client]) --> Stage["API Gateway stage<br/>root segment"]
    Stage --> Remote["Remote node<br/>one per URL"]
    Remote -. replaced by .-> Real["xray-example-ecs<br/>after the daemon works"]
    C2(["Client<br/>internet scanner"]) --> EC2["xray-example-ec2<br/>root segment, no parent"]
```

## 7. Segment: Finding, restrict the backends to API Gateway
* **Action:** Discussed how to make the ALB, and the EC2, accept only calls from API Gateway. Nothing was changed.
* **Result:** ⚠️ *Left open on purpose*. Both stay reachable by anyone who knows the address.
* **Finding / Technical note:** A REST API has no fixed IP and no security group, so a security group rule cannot say "only API Gateway". Two options. (A) API Gateway adds a secret header, and an ALB listener rule forwards only when it matches, with a fixed `403` otherwise. It is a shared secret. (B) An internal ALB behind a VPC Link, so there is no public address. It is stronger, but the classic REST VPC Link needs an NLB, so check what REST supports today. For the EC2 app, the same header can be checked in `server.js`.
* **Related:** when the daemon works, the ALB health check (`/health`, every 15 seconds, per container) becomes a trace with its own Client node. Declare the `/health` route before `openSegment` in `apps/ecs-todos/server.js`.

---

## 📌 Summary and Next Steps
* **Key achievements:** ECS Fargate path deployed and working. Title edit and Done in the frontend. The broken trace is understood, with every node explained.
* **Technical debt or pending items for tomorrow:** Add the daemon sidecar and `AWSXRayDaemonWriteAccess` on `EcsTaskRole`. Move `/health` before `openSegment`. Decide on the header or VPC Link restriction (segment 7).
