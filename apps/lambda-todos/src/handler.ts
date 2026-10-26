import { randomUUID } from "node:crypto";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import AWSXRay from "aws-xray-sdk-core";

// Wrapping the client makes every DynamoDB call show up as a subsegment in X-Ray.
const ddb = DynamoDBDocumentClient.from(AWSXRay.captureAWSv3Client(new DynamoDBClient({})));
const TABLE = process.env.TABLE_NAME!;

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers,
  body: JSON.stringify(body),
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === "GET") {
    const { Items } = await ddb.send(new ScanCommand({ TableName: TABLE }));
    return json(200, Items ?? []);
  }

  if (event.httpMethod === "POST") {
    const { title } = JSON.parse(event.body ?? "{}");
    if (typeof title !== "string" || !title.trim()) {
      return json(400, { error: "title is required" });
    }
    const todo = { id: randomUUID(), title: title.trim(), createdAt: new Date().toISOString() };
    await ddb.send(new PutCommand({ TableName: TABLE, Item: todo }));
    return json(201, todo);
  }

  return json(405, { error: "method not allowed" });
};
