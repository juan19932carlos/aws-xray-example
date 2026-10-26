const express = require("express");
const AWSXRay = require("aws-xray-sdk-core");
const xrayExpress = require("aws-xray-sdk-express");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

// Wrapping the client makes every DynamoDB call show up as a subsegment in X-Ray.
// The SDK sends to a daemon on 127.0.0.1:2000. The task has no daemon sidecar yet,
// so the segments are dropped. That is the next fix.
const ddb = DynamoDBDocumentClient.from(AWSXRay.captureAWSv3Client(new DynamoDBClient({})));
const TABLE = process.env.TABLE_NAME;

const app = express();

// openSegment reads the X-Amzn-Trace-Id header from API Gateway and makes one segment per request.
app.use(xrayExpress.openSegment("xray-example-ecs"));
app.use(express.json());

// The frontend lives on another origin (S3), so the browser needs these headers.
app.use((req, res, next) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// The load balancer calls this to know the container is alive.
app.get("/health", (req, res) => res.sendStatus(200));

app.patch("/todos/:id", async (req, res, next) => {
  const { title, done } = req.body ?? {};
  const names = {};
  const values = {};
  const sets = [];
  if (typeof title === "string" && title.trim()) {
    names["#title"] = "title";
    values[":title"] = title.trim();
    sets.push("#title = :title");
  }
  if (typeof done === "boolean") {
    names["#done"] = "done";
    values[":done"] = done;
    sets.push("#done = :done");
  }
  if (!sets.length) return res.status(400).json({ error: "title or done is required" });

  try {
    const { Attributes } = await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { id: req.params.id },
        UpdateExpression: `SET ${sets.join(", ")}`,
        // Without this, UpdateItem creates the item when the id does not exist.
        ConditionExpression: "attribute_exists(id)",
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_NEW",
      }),
    );
    res.json(Attributes);
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      return res.status(404).json({ error: "todo not found" });
    }
    next(err);
  }
});

app.use(xrayExpress.closeSegment());

app.listen(8080, () => console.log("listening on 8080"));
