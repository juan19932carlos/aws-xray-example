import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  BatchGetTracesCommand,
  GetServiceGraphCommand,
  GetTraceSummariesCommand,
  XRayClient,
} from "@aws-sdk/client-xray";
import AWSXRay from "aws-xray-sdk-core";

// Wrapping the client makes every X-Ray call show up as a subsegment in X-Ray.
const xray = AWSXRay.captureAWSv3Client(new XRayClient({}));

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

// A segment document, as X-Ray stores it. Only the fields this handler reads.
type Doc = {
  id: string;
  name: string;
  origin?: string;
  namespace?: string;
  start_time: number;
  end_time?: number;
  error?: boolean;
  fault?: boolean;
  throttle?: boolean;
  http?: { request?: { method?: string; url?: string }; response?: { status?: number } };
  aws?: { operation?: string; table_name?: string };
  cause?: { exceptions?: { message?: string }[] } | string;
  subsegments?: Doc[];
};

type SubsegmentView = {
  id: string;
  name: string;
  namespace?: string;
  durationMs: number | null;
  status?: number;
  operation?: string;
  error: boolean;
  fault: boolean;
  message?: string;
  children: SubsegmentView[];
};

const MAX_MINUTES = 360;
const MAX_TRACES = 10;

const timeRange = (event: APIGatewayProxyEvent) => {
  const minutes = Math.min(Number(event.queryStringParameters?.minutes) || 60, MAX_MINUTES);
  const end = new Date();
  return { start: new Date(end.getTime() - minutes * 60_000), end };
};

const durationMs = (d: Doc) => (d.end_time ? Math.round((d.end_time - d.start_time) * 1000) : null);

const message = (d: Doc) =>
  typeof d.cause === "string" ? d.cause : d.cause?.exceptions?.[0]?.message;

const subsegmentView = (d: Doc): SubsegmentView => ({
  id: d.id,
  name: d.name,
  namespace: d.namespace,
  durationMs: durationMs(d),
  status: d.http?.response?.status,
  operation: d.aws?.operation,
  error: !!d.error,
  fault: !!d.fault,
  message: message(d),
  children: (d.subsegments ?? []).map(subsegmentView),
});

// A node in the service graph is a (name, type) pair. Type is empty for a segment with no origin.
const belongsToNode = (d: Doc, name: string, type: string) =>
  (d.origin ?? "") === type && (d.name === name || d.aws?.table_name === name);

// Inferred "remote" nodes have no segment of their own. They are subsegments written by the caller.
const findRemote = (docs: Doc[], name: string): Doc[] => {
  const found: Doc[] = [];
  const walk = (d: Doc) => {
    for (const s of d.subsegments ?? []) {
      if (s.namespace === "remote" && s.name === name) found.push(s);
      walk(s);
    }
  };
  docs.forEach(walk);
  return found;
};

const listServices = async (event: APIGatewayProxyEvent) => {
  const { start, end } = timeRange(event);
  const { Services = [] } = await xray.send(new GetServiceGraphCommand({ StartTime: start, EndTime: end }));
  const nodes = Services.filter((s) => s.Type !== "client").map((s) => ({
    name: s.Name ?? "",
    type: s.Type ?? "",
    requests: s.SummaryStatistics?.TotalCount ?? 0,
    errors: (s.SummaryStatistics?.ErrorStatistics?.TotalCount ?? 0) + (s.SummaryStatistics?.FaultStatistics?.TotalCount ?? 0),
  }));
  nodes.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  return json(200, nodes);
};

const listTraces = async (event: APIGatewayProxyEvent) => {
  const name = event.queryStringParameters?.name;
  const type = event.queryStringParameters?.type ?? "";
  if (!name) return json(400, { error: "name is required" });

  const { start, end } = timeRange(event);
  const quoted = (v: string) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  const filter = `service(id(name: ${quoted(name)}${type ? `, type: ${quoted(type)}` : ""}))`;

  const { TraceSummaries = [] } = await xray.send(
    new GetTraceSummariesCommand({ StartTime: start, EndTime: end, FilterExpression: filter }),
  );
  // Trace ids start with the epoch time in hex, so a descending sort is newest first.
  const summaries = TraceSummaries.filter((t) => t.Id)
    .sort((a, b) => b.Id!.localeCompare(a.Id!))
    .slice(0, MAX_TRACES);

  // BatchGetTraces takes at most 5 ids per call.
  const ids = summaries.map((t) => t.Id!);
  const chunks = Array.from({ length: Math.ceil(ids.length / 5) }, (_, i) => ids.slice(i * 5, i * 5 + 5));
  const results = await Promise.all(chunks.map((c) => xray.send(new BatchGetTracesCommand({ TraceIds: c }))));
  const byId = new Map(results.flatMap((r) => r.Traces ?? []).map((t) => [t.Id, t]));

  const traces = summaries.map((summary) => {
    const docs = (byId.get(summary.Id)?.Segments ?? []).map((s) => JSON.parse(s.Document ?? "{}") as Doc);
    const mine = type === "remote" ? findRemote(docs, name) : docs.filter((d) => belongsToNode(d, name, type));
    return {
      id: summary.Id,
      startedAt: new Date(Math.min(...docs.map((d) => d.start_time)) * 1000).toISOString(),
      method: summary.Http?.HttpMethod,
      url: summary.Http?.HttpURL,
      status: summary.Http?.HttpStatus,
      segments: mine.map((d) => ({
        ...subsegmentView(d),
        origin: d.origin,
        startedAt: new Date(d.start_time * 1000).toISOString(),
        method: d.http?.request?.method,
        url: d.http?.request?.url,
      })),
    };
  });
  return json(200, traces);
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (event.httpMethod === "GET" && event.path === "/traces/services") return await listServices(event);
    if (event.httpMethod === "GET" && event.path === "/traces") return await listTraces(event);
    return json(404, { error: "not found" });
  } catch (err) {
    console.error(err);
    return json(500, { error: (err as Error).message });
  }
};
