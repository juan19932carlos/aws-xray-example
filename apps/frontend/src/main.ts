const API = import.meta.env.VITE_API_URL as string;

type Todo = { id: string; title: string; createdAt: string; done?: boolean };

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
    ...todos.map((t) => {
      const li = document.createElement("li");
      const text = Object.assign(document.createElement("span"), {
        textContent: t.done ? `✓ ${t.title}` : t.title,
        title: "Click to edit",
      });
      text.style.cursor = "text";
      text.addEventListener("click", () => edit(t, text));
      const toggle = Object.assign(document.createElement("button"), { textContent: t.done ? "Undo" : "Done" });
      toggle.addEventListener("click", () => update(t.id, { done: !t.done }));
      const del = Object.assign(document.createElement("button"), { textContent: "Delete" });
      del.addEventListener("click", () => remove(t.id));
      li.append(text, " ", toggle, " ", del);
      return li;
    }),
  );
}

// Click on the title: swap the text for an input. Enter saves, Escape or leaving the field cancels.
function edit(todo: Todo, text: HTMLSpanElement) {
  const field = Object.assign(document.createElement("input"), { value: todo.title });
  field.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && field.value.trim() && field.value.trim() !== todo.title) {
      update(todo.id, { title: field.value });
    } else if (e.key === "Enter" || e.key === "Escape") {
      field.replaceWith(text);
    }
  });
  field.addEventListener("blur", () => field.replaceWith(text));
  text.replaceWith(field);
  field.focus();
}

async function update(id: string, patch: { title?: string; done?: boolean }) {
  error.textContent = "";
  try {
    const res = await fetch(`${API}/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`PATCH /todos/${id} failed: ${res.status}`);
    await load();
  } catch (err) {
    error.textContent = (err as Error).message;
  }
}

async function remove(id: string) {
  error.textContent = "";
  try {
    const res = await fetch(`${API}/todos/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`DELETE /todos/${id} failed: ${res.status}`);
    await load();
  } catch (err) {
    error.textContent = (err as Error).message;
  }
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
