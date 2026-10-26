# Journal 02: EC2 in X-Ray and the apps layout
* **Date:** 2026-10-25
* **Main goal:** Add an EC2 web server behind a second API Gateway, see how it looks in X-Ray, and organize the repo.

---

## 1. Segment: EC2 web server behind a second API Gateway
* **Action:** Added an EC2 `t4g.nano` with Apache, a security group, and a separate REST API (`WebApi`) with an HTTP proxy to the instance. Added `architecture/infrastructure.md`.
* **Result:** ⚠️ *With warnings*. It worked after one fix.
* **Finding / Technical note:** API Gateway returned `network error communicating with endpoint`. The console log showed `dnf` killed by the OOM killer: 0.5 GB of RAM is too little to install Apache. Fix: a 1 GB swap file in `UserData`. `UserData` runs only on first boot, so the logical ID was renamed (`WebServerHost`) to force a new instance. A raw `AWS::ApiGateway::Deployment` does not redeploy when methods change, so rename it (`WebDeploymentV2`) when routes change.

## 2. Segment: Why EC2 shows in the X-Ray map
* **Action:** Read the raw trace (`get-trace` JSON) of a call to the Apache page.
* **Result:** ✅ *Worked*. Confirmed the node is inferred.
* **Finding / Technical note:** API Gateway writes a `remote` subsegment named after the EC2 URL. X-Ray then generates a segment with `inferred: true` whose `parent_id` is that subsegment. Nothing on EC2 sent it, so it has no details.

```mermaid
flowchart LR
    Client([Client]) --> Stage["API Gateway segment<br/>origin: ApiGateway::Stage"]
    Stage --> Sub["remote subsegment<br/>written by API Gateway"]
    Sub -. X-Ray infers .-> Node["EC2 node<br/>inferred: true<br/>no details"]
```

Rule: a caller records "I called X". X-Ray draws X as an inferred node. X draws itself only when it sends its own segments.

## 3. Segment: SSH and the X-Ray daemon
* **Action:** Opened port 22 in the security group for one IP (parameter `SshCidr`, set in `samconfig.toml`). Connected with EC2 Instance Connect. Installed the X-Ray daemon by hand from the arm64 RPM.
* **Result:** ✅ *Worked*. The daemon runs and listens on `127.0.0.1:2000`.
* **Finding / Technical note:** The daemon logs to `/var/log/xray/xray.log`, not to `journalctl`. The `SshCidr` parameter keeps the home IP out of git. The IP is the source allowed in, not the instance IP. The daemon alone sends nothing. An app with the X-Ray SDK makes the segments, and an IAM role with `AWSXRayDaemonWriteAccess` lets the daemon send them.

## 4. Segment: Apps layout and the pnpm catalog
* **Action:** Moved every app into `apps/` (`lambda-todos`, `ec2`, `frontend`). Added a pnpm `catalog:` in `pnpm-workspace.yaml`. Added repo rules in `.claude/rules/`.
* **Result:** ⚠️ *With warnings*. Only the frontend uses `catalog:`.
* **Finding / Technical note:** `sam build` failed with `EUNSUPPORTEDPROTOCOL`. SAM's esbuild build runs `npm install`, and npm cannot read `catalog:`. Options: keep explicit versions in Lambdas, or use `BuildMethod: makefile` so pnpm works. Decision: explicit versions, no Makefile, because the focus of the project is X-Ray. `apps/ec2` also keeps explicit versions, because npm installs it on the instance.

## 5. Segment: `DELETE /todos/:id` on EC2
* **Action:** Wrote `apps/ec2` (Express with the X-Ray SDK and DynamoDB). Added an IAM role with `dynamodb:DeleteItem` only, a `WebApi` route `ANY /todos/{id}`, and a Delete button in the frontend.
* **Result:** ✅ *Worked*. After `pnpm deploy`, Node on the instance, and the app copied over, the Delete button removes the todo through the second API Gateway.
* **Finding / Technical note:** The X-Ray policy is left out on purpose, to see the failure first. The app is deployed by hand over SSH and stops when the session ends. To copy files: push a public key with `aws ec2-instance-connect send-ssh-public-key` (valid 60 seconds, the key must be passed as `file://<path>`), then use plain `scp -i <key>`. Node comes from `dnf` (`dnf list available 'nodejs*'`). Apache must be stopped (`sudo systemctl disable --now httpd`) to free port 80.

## 6. Segment: Reading the service map
* **Action:** Looked at the X-Ray service map after a few calls and listed its nodes with `aws xray get-service-graph`.
* **Result:** ✅ *Worked*. The three EC2 nodes are not three instances. Only one instance exists.
* **Finding / Technical note:** API Gateway names each `remote` subsegment with the full URL, and X-Ray makes one inferred node per name. So `/`, `/todos/<id>`, and `/todos/test` are three nodes for the same host. Each todo deleted adds a node. The todos path (API Gateway, Lambda, DynamoDB) is complete because the Lambda sends its own segments. The EC2 side stays inferred until the X-Ray policy is added.

## 7. Segment: Docs site with Docusaurus
* **Action:** Asked a subagent to create `apps/docs`, a Docusaurus site that reads `architecture/decisions/` and `architecture/journal/` in place, with Mermaid enabled and no other content.
* **Result:** ⚠️ *With warnings*. `pnpm --filter docs build` passes with no warnings and no broken links. The site was not opened in a browser yet, so the Mermaid diagrams are not seen with eyes.
* **Finding / Technical note:** One source of truth: the site points at the existing markdown folders (`path: '../../architecture'`) instead of copying them, and `infrastructure.md` is excluded. Three build problems on the way: `"type": "module"` in `package.json` broke the build (`require.resolveWeak is not a function`), Mermaid needs `@mermaid-js/layout-elk`, and with docs at `/` the navbar link was broken until an intro page was added. Mermaid renders in the browser only, so the diagram source is in a JS chunk, not in the static HTML. Run it with `pnpm dev:docs`.

## 8. Segment: Automating the EC2 setup
* **Action:** Moved the manual steps into the template and scripts. The instance role got `AWSXRayDaemonWriteAccess` and `AmazonSSMManagedInstanceCore`. `UserData` installs Node, the X-Ray daemon, and a systemd service `todos-ec2`. A private bucket `AppArtifactsBucket` holds `ec2-app.tgz`. New `scripts/deploy-ec2.sh` packs `apps/ec2`, uploads it, and restarts the service. `pnpm deploy` now runs it last.
* **Result:** ⚠️ *With warnings*. Written and `sam validate --lint` passes. Not deployed yet, so nothing here is proven on a real instance.
* **Finding / Technical note:** The service pulls the tarball from S3 on every start (`ExecStartPre`), so a first boot before the first upload just retries every 15 seconds. Restart goes through SSM Run Command, so SSH is not needed for deploys. Changing `UserData` needs a new logical ID (`WebServerInstance`), and the raw API Gateway deployment needs a new one too (`WebDeploymentV3`), because the instance URL changes. Apache is gone: the Node app serves `/` as well. `tmux` is installed for SSH sessions.

## 9. Segment: Docs site on GitHub Pages
* **Action:** Asked a second subagent for a GitHub Actions workflow, `.github/workflows/docs.yml`. On every push to `main` (and by hand) it builds `apps/docs` and deploys it to GitHub Pages. The Docusaurus config got `url`, `baseUrl: '/aws-xray-example/'`, `organizationName`, `projectName`, and `trailingSlash: false`.
* **Result:** ⚠️ *With warnings*. The build passes locally with the new `baseUrl`, and `pnpm install --frozen-lockfile` passes. The workflow has not run on GitHub, because it triggers only on `main` and this branch is not merged.
* **Finding / Technical note:** A project page is served under `/<repo>/`, so `baseUrl` must match or every asset path breaks. The workflow uses the official Pages flow (`upload-pages-artifact`, then `deploy-pages`) with `pages: write` and `id-token: write`. `pnpm/action-setup` reads the pnpm version from the root `packageManager` field. One manual step: Settings, Pages, Source = GitHub Actions.

## 10. Segment: One API Gateway
* **Action:** Removed the second API (`WebApi` and its resources). `TodosApi` now has an explicit `DefinitionBody`: `GET` and `POST /todos` go to the Lambda, `GET /` and `DELETE /todos/{id}` go to the EC2 instance. Added an Elastic IP for the instance. The frontend lost `VITE_WEB_API_URL` and uses only `VITE_API_URL`.
* **Result:** ⚠️ *With warnings*. `sam validate --lint` passes, and the translated template (`sam validate --debug`) has every route with its integration, the CORS `OPTIONS` routes, and both Lambda permissions. Not deployed yet.
* **Finding / Technical note:** With an inline `DefinitionBody`, SAM does not add the integrations from the function events. A first attempt translated with **no Lambda integration at all** and no error, so the translated output is worth reading. Each route must declare its own `x-amazon-apigateway-integration` (`aws_proxy` with the function ARN for the Lambda, `http_proxy` for EC2). The EC2 routes use the Elastic IP, because a stage keeps its old deployment when only an instance URL changes. This also ends the `WebDeploymentV3` rename trick.

## 11. Segment: The full trace, end to end
* **Action:** After `pnpm deploy`, clicked Delete in the frontend and read the raw trace (`1-6adedd89-2c82620f7dd708644b32adc9`).
* **Result:** ✅ *Worked*. The EC2 app now sends its own segment, so the EC2 node is real, not inferred.
* **Finding / Technical note:** The trace has four pieces, all in one trace id, in one API.
  1. `xray-example-app/Prod` (API Gateway stage) holds a `remote` subsegment named after the Elastic IP URL, `http://18.211.122.110/todos/<id>`.
  2. `xray-example-ec2` is a real segment from the Express SDK (`aws-xray-sdk-core 3.12.0`, Node 24). Its `parent_id` is the id of that remote subsegment. The `X-Amzn-Trace-Id` header from API Gateway is what links them.
  3. Under it, a `DynamoDB` subsegment (`DeleteItem`, status 200, `retries: 1`) from the wrapped client.
  4. A `DynamoDB` segment with `inferred: true` and `origin: AWS::DynamoDB::Table`. X-Ray built it from that subsegment, as in segment 2, but now for the table.

```mermaid
flowchart LR
    Client([Client]) --> Stage["xray-example-app/Prod<br/>API Gateway, 125 ms"]
    Stage --> Sub["remote subsegment<br/>http://ELASTIC_IP/todos/id"]
    Sub -- parent_id --> Ec2["xray-example-ec2<br/>real segment, 114 ms"]
    Ec2 --> Ddb["DynamoDB subsegment<br/>DeleteItem, 66 ms"]
    Ddb -. X-Ray infers .-> Table["DynamoDB table node<br/>inferred: true"]
```

Compare with segment 2: before, the EC2 node was only the inferred shadow of the remote subsegment, with no details. Now the segment carries its own URL, status `204`, runtime, and the DynamoDB call. The role with `AWSXRayDaemonWriteAccess` and the daemon on `127.0.0.1:2000` made the difference. Total time is 126 ms.

## 12. Segment: Docusaurus moved into `architecture/`
* **Action:** Moved the docs site from `apps/docs` to `architecture/site`, because it supports the architecture and is not an app. Replaced the single docs plugin (which read all of `architecture/`) with two instances: one for `architecture/decisions` and one for `architecture/journal`. Decisions and Journal are now links on the right of the header. Removed `sidebars.ts`. Updated the workspace list, `.gitignore`, the Pages workflow path, `README.md`, `CLAUDE.md`, and `.claude/rules/repo-layout.md`.
* **Result:** ⚠️ *With warnings*. `pnpm --filter docs build` passes, and the built page has both links on the right. Not opened in a browser, so the look is unchecked.
* **Finding / Technical note:** A second docs instance needs `@docusaurus/plugin-content-docs` as its own dependency. pnpm does not let the site import it through the preset. Each instance gets its own sidebar, built from its folder. No new ADR: the stack is the same, only the location of the site changed.

---

## 📌 Summary and Next Steps
* **Key achievements:** EC2 first appeared as an inferred node, and the cause is understood. It now sends real segments, with the DynamoDB call under it. SSH and the daemon work. `DELETE /todos/:id` works on EC2, through one API Gateway. The repo has a clear layout and written rules.
* **Technical debt or pending items for tomorrow:**
  * Find out why the DynamoDB call shows `retries: 1`.
  * Optional: add `AWSXRay.config([AWSXRay.plugins.EC2Plugin])` so the EC2 segment gets `origin: AWS::EC2::Instance`.
  * Next focus: ECS on Fargate behind the same API (for example `PUT /todos/{id}`), with the X-Ray daemon as a sidecar container. Watch the cost: the task and the load balancer bill by the hour. SQS is skipped for now, because it behaves like the DynamoDB node.
  * Open the docs site with `pnpm dev:docs` and check the Mermaid diagrams and the header links.
  * Set Pages to GitHub Actions in the repo settings, merge to `main`, and check that the workflow publishes the site.
