const express = require("express");
const AWSXRay = require("aws-xray-sdk-core");
const xrayExpress = require("aws-xray-sdk-express");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

// Wrapping the client makes every DynamoDB call show up as a subsegment in X-Ray.
const ddb = DynamoDBDocumentClient.from(AWSXRay.captureAWSv3Client(new DynamoDBClient({})));
const TABLE = process.env.TABLE_NAME;

const app = express();

// openSegment reads the X-Amzn-Trace-Id header from API Gateway and sends one
// segment per request to the daemon on 127.0.0.1:2000.
app.use(xrayExpress.openSegment("xray-example-ec2"));

// The frontend lives on another origin (S3), so the browser needs these headers.
app.use((req, res, next) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/", (req, res) => {
  res.send("<h1>Hello from EC2 (Node + X-Ray)</h1>");
});

app.delete("/todos/:id", async (req, res, next) => {
  try {
    await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { id: req.params.id } }));
    res.sendStatus(204);
  } catch (err) {
    next(err);
  }
});

app.use(xrayExpress.closeSegment());

app.listen(80, () => console.log("listening on 80"));
