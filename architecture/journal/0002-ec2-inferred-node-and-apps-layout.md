# 0002. API Gateway creates the EC2 node in X-Ray

- **Date:** 2026-10-24

## Question

An Apache page on EC2 sits behind a second API Gateway. Apache sends no traces. Why does EC2 still show in the service map?

## Finding

API Gateway adds it, and X-Ray draws it. The raw trace has two parts:

1. **API Gateway wrote a subsegment.**
   - It sits inside the `xray-example-web/Prod` segment (`origin: AWS::ApiGateway::Stage`).
   - Its name is the EC2 URL and it has `namespace: remote`.
   - It holds only what API Gateway saw: URL, method, status.
2. **X-Ray generated an inferred segment.**
   - It has `inferred: true` and its `parent_id` is the subsegment above.
   - Nothing on EC2 sent it. X-Ray builds it from the remote subsegment.

```mermaid
flowchart LR
    Client([Client]) --> Stage["API Gateway segment<br/>origin: ApiGateway::Stage"]
    Stage --> Sub["remote subsegment<br/>written by API Gateway"]
    Sub -. X-Ray infers .-> Node["EC2 node<br/>inferred: true<br/>no details"]
```

## Rule

- A caller records "I called X" as a remote subsegment.
- X-Ray draws X as an inferred node.
- X draws itself only when X sends its own segments.

## Result

- An inferred node has no segments, exceptions, or metadata of its own.
- To see a real EC2 node, the instance needs an IAM role (`AWSXRayDaemonWriteAccess`), the X-Ray daemon, and an app that uses the X-Ray SDK.
