const API = import.meta.env.VITE_API_URL as string;

type Service = { name: string; type: string; requests: number; errors: number };
type Sub = {
  id: string;
  name: string;
  namespace?: string;
  durationMs: number | null;
  status?: number;
  operation?: string;
  error: boolean;
  fault: boolean;
  message?: string;
  children: Sub[];
};
type Segment = Sub & { origin?: string; startedAt: string; method?: string; url?: string };
type Trace = { id: string; startedAt: string; method?: string; url?: string; status?: number; segments: Segment[] };

const services = document.querySelector<HTMLUListElement>("#services")!;
const title = document.querySelector<HTMLHeadingElement>("#title")!;
const minutes = document.querySelector<HTMLSelectElement>("#minutes")!;
const error = document.querySelector<HTMLParagraphElement>("#error")!;
const content = document.querySelector<HTMLDivElement>("#content")!;

let selected: Service | undefined;

// Text only, never innerHTML: URLs and messages in a trace come from callers we do not control.
function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (globalThis.Node | string)[]) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids);
  return node;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

const ms = (v: number | null | undefined) => (v == null ? "-" : `${v} ms`);
const label = (n: { type: string }) => n.type || "app (no origin)";

async function loadServices() {
  const nodes = await get<Service[]>(`/traces/services?minutes=${minutes.value}`);
  services.replaceChildren(
    ...nodes.map((n) => {
      const button = el(
        "button",
        { title: n.name },
        el("span", { className: "name", textContent: n.name }),
        el("span", { className: "meta", textContent: `${label(n)} · ${n.requests} requests · ${n.errors} errors` }),
      );
      if (selected && selected.name === n.name && selected.type === n.type) button.setAttribute("aria-current", "true");
      button.addEventListener("click", () => select(n));
      return el("li", {}, button);
    }),
  );
}

async function select(node: Service) {
  selected = node;
  title.textContent = `${node.name} (${label(node)})`;
  error.textContent = "";
  content.replaceChildren(el("p", { className: "muted", textContent: "Loading…" }));
  services.querySelectorAll("button").forEach((b) => b.removeAttribute("aria-current"));
  Array.from(services.querySelectorAll("button")).find((b) => b.title === node.name && b.textContent?.includes(label(node)))?.setAttribute("aria-current", "true");
  try {
    const q = new URLSearchParams({ name: node.name, type: node.type, minutes: minutes.value });
    const traces = await get<Trace[]>(`/traces?${q}`);
    content.replaceChildren(...(traces.length ? traces.map(renderTrace) : [el("p", { className: "muted", textContent: "No traces in this time range." })]));
  } catch (err) {
    content.replaceChildren();
    error.textContent = (err as Error).message;
  }
}

function renderTrace(t: Trace) {
  const head = el(
    "header",
    {},
    el("strong", { textContent: `${t.method ?? ""} ${t.url ?? ""} ${t.status ?? ""}`.trim() }),
    el("div", { className: "id", textContent: `${t.id} · ${new Date(t.startedAt).toLocaleTimeString()}` }),
  );
  const body = t.segments.length
    ? t.segments.map(renderSegment)
    : [el("div", { className: "segment muted", textContent: "No segment of this service in the trace." })];
  return el("section", { className: "trace" }, head, ...body);
}

function renderSegment(s: Segment) {
  const rows: [string, string][] = [
    ["Name", s.name],
    ["Origin", s.origin ?? s.namespace ?? "-"],
    ["Started", new Date(s.startedAt).toLocaleTimeString()],
    ["Duration", ms(s.durationMs)],
  ];
  if (s.method || s.url) rows.push(["Request", `${s.method ?? ""} ${s.url ?? ""}`.trim()]);
  if (s.status) rows.push(["Status", String(s.status)]);
  if (s.error || s.fault) rows.push(["Failure", [s.fault && "fault", s.error && "error"].filter(Boolean).join(", ")]);
  if (s.message) rows.push(["Message", s.message]);
  const list = el("dl", {}, ...rows.flatMap(([k, v]) => [el("dt", { textContent: k }), el("dd", { textContent: v })]));
  const subs = s.children.length
    ? el("details", {}, el("summary", { textContent: `Subsegments (${s.children.length})` }), ...s.children.map(renderSub))
    : el("div", { className: "muted", textContent: "No subsegments" });
  return el("div", { className: "segment" }, list, subs);
}

function renderSub(s: Sub): HTMLElement {
  const text = [s.name, s.operation, s.namespace && `[${s.namespace}]`, ms(s.durationMs), s.status].filter(Boolean).join(" · ");
  const failed = s.error || s.fault;
  const summary = el("summary", { textContent: failed ? `${text} · ${s.fault ? "fault" : "error"}` : text, className: failed ? "bad" : "" });
  if (!s.children.length) {
    return el("div", { className: "leaf" }, summary.textContent!, ...(s.message ? [el("div", { className: "muted", textContent: s.message })] : []));
  }
  return el("details", {}, summary, ...s.children.map(renderSub));
}

minutes.addEventListener("change", async () => {
  await loadServices();
  if (selected) await select(selected);
});

loadServices().catch((err) => (error.textContent = err.message));
