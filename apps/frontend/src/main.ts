const API = import.meta.env.VITE_API_URL as string;

type Todo = { id: string; title: string; createdAt: string };

const form = document.querySelector<HTMLFormElement>("#form")!;
const input = document.querySelector<HTMLInputElement>("#title")!;
const list = document.querySelector<HTMLUListElement>("#list")!;
const error = document.querySelector<HTMLParagraphElement>("#error")!;

async function load() {
  const res = await fetch(`${API}/todos`);
  if (!res.ok) throw new Error(`GET /todos failed: ${res.status}`);
  const todos: Todo[] = await res.json();
  todos.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  list.replaceChildren(
    ...todos.map((t) => Object.assign(document.createElement("li"), { textContent: t.title })),
  );
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  error.textContent = "";
  try {
    const res = await fetch(`${API}/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: input.value }),
    });
    if (!res.ok) throw new Error(`POST /todos failed: ${res.status}`);
    input.value = "";
    await load();
  } catch (err) {
    error.textContent = (err as Error).message;
  }
});

load().catch((err) => (error.textContent = err.message));
