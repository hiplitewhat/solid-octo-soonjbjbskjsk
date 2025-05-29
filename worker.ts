import { Router } from 'itty-router';

export interface Env {
  GITHUB_TOKEN: string;
  GITHUB_REPO_OWNER: string;
  GITHUB_REPO_NAME: string;
  GITHUB_BRANCH: string;
  NOTES_POST_PASSWORD: string;
}

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

const router = Router();
let notes: Note[] = [];

const isRobloxScript = (content: string) =>
  content.includes('game') || content.includes('script');

async function obfuscate(content: string): Promise<string> {
  try {
    const res = await fetch('https://broken-pine-ac7f.hiplitehehe.workers.dev/api/obfuscate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script: content }),
    });
    if (!res.ok) return content;
    const data = await res.json();
    return data.obfuscated || content;
  } catch {
    return content;
  }
}

async function filterText(text: string): Promise<string> {
  try {
    const res = await fetch('https://tiny-river-0235.hiplitehehe.workers.dev/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.filtered || text;
  } catch {
    return text;
  }
}

async function storeNotesInGithubFile(env: Env, updatedNotes: Note[]) {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}/contents/notes.json`;
  let sha: string | undefined;

  const getRes = await fetch(url, {
    headers: {
      Authorization: `token ${env.GITHUB_TOKEN}`,
      'User-Agent': 'MyNotesApp/1.0',
    },
  });
  if (getRes.ok) {
    const existing = await getRes.json();
    sha = existing.sha;
  }

  const notesObject = updatedNotes.reduce<Record<string, Omit<Note, 'id'>>>((acc, note) => {
    const { id, ...rest } = note;
    acc[id] = rest;
    return acc;
  }, {});

  const encoded = btoa(JSON.stringify(notesObject, null, 2));

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'MyNotesApp/1.0',
    },
    body: JSON.stringify({
      message: 'Update notes',
      content: encoded,
      branch: env.GITHUB_BRANCH,
      ...(sha && { sha }),
    }),
  });

  if (!putRes.ok) {
    const text = await putRes.text();
    throw new Error(`GitHub API error: ${text}`);
  }
}

async function loadNotesFromGithub(env: Env): Promise<void> {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}/contents/notes.json`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${env.GITHUB_TOKEN}`,
      'User-Agent': 'MyNotesApp/1.0',
    },
  });

  if (res.ok) {
    const data = await res.json();
    const content = atob(data.content);
    const parsed = JSON.parse(content);
    notes = Object.entries(parsed).map(([id, note]: [string, any]) => ({
      id,
      ...note,
    }));
  }
}

// Dashboard HTML with submission form
function renderDashboard(notes: Note[]) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Notes Dashboard</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; max-width: 700px; }
    ul { list-style: none; padding: 0; }
    li { margin-bottom: 0.5rem; }
    a { text-decoration: none; color: #0366d6; }
    a:hover { text-decoration: underline; }
    form { margin-top: 2rem; }
    label { display: block; margin-top: 1rem; }
    input[type="text"], textarea, input[type="password"] {
      width: 100%;
      padding: 0.5rem;
      margin-top: 0.25rem;
      box-sizing: border-box;
      font-family: inherit;
      font-size: 1rem;
    }
    button {
      margin-top: 1rem;
      padding: 0.5rem 1rem;
      font-size: 1rem;
      cursor: pointer;
    }
    #message {
      margin-top: 1rem;
      color: green;
    }
    #error {
      margin-top: 1rem;
      color: red;
    }
  </style>
</head>
<body>
  <h1>Notes Dashboard</h1>
  <ul>
    ${notes.map(note => `<li><a href="/note/${note.id}">${escapeHtml(note.title)}</a></li>`).join('\n')}
  </ul>

  <h2>Add a New Note</h2>
  <form id="noteForm">
    <label for="title">Title</label>
    <input type="text" id="title" name="title" required />

    <label for="content">Content</label>
    <textarea id="content" name="content" rows="6" required></textarea>

    <label for="password">Password</label>
    <input type="password" id="password" name="password" required />

    <button type="submit">Add Note</button>
  </form>

  <div id="message"></div>
  <div id="error"></div>

  <script>
    const form = document.getElementById('noteForm');
    const messageEl = document.getElementById('message');
    const errorEl = document.getElementById('error');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      messageEl.textContent = '';
      errorEl.textContent = '';

      const title = form.title.value.trim();
      const content = form.content.value.trim();
      const password = form.password.value;

      if (!title || !content || !password) {
        errorEl.textContent = 'Please fill all fields.';
        return;
      }

      try {
        const res = await fetch('/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, content, password }),
        });

        if (!res.ok) {
          const text = await res.text();
          errorEl.textContent = 'Error: ' + text;
          return;
        }

        const newNote = await res.json();
        messageEl.textContent = 'Note added successfully! Reloading...';
        setTimeout(() => {
          window.location.reload();
        }, 1000);

      } catch (err) {
        errorEl.textContent = 'Network error. Try again.';
      }
    });
  </script>
</body>
</html>`;
}

// Single note HTML page
function renderNotePage(note: Note) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(note.title)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; max-width: 700px; }
    pre { white-space: pre-wrap; background: #f6f8fa; padding: 1rem; border-radius: 5px; }
    a { display: inline-block; margin-bottom: 1rem; color: #0366d6; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <a href="/">← Back to Dashboard</a>
  <h1>${escapeHtml(note.title)}</h1>
  <pre>${escapeHtml(note.content)}</pre>
  <small>Created at: ${new Date(note.createdAt).toLocaleString()}</small>
</body>
</html>`;
}

// Simple HTML escape helper
function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (m) => {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return m;
    }
  });
}

// API route returning all notes JSON (optional)
router.get('/notes', () => {
  return new Response(JSON.stringify(notes), {
    headers: { 'Content-Type': 'application/json' },
  });
});

// Post new note API
router.post('/notes', async (req, env: Env) => {
  const body = await req.json();

  if (body.password !== env.NOTES_POST_PASSWORD) {
    return new Response('Unauthorized', { status: 401 });
  }

  let { title, content } = body;

  if (isRobloxScript(content)) {
    content = await obfuscate(content);
  } else {
    content = await filterText(content);
  }

  const newNote: Note = {
    id: crypto.randomUUID(),
    title,
    content,
    createdAt: new Date().toISOString(),
  };

  notes.push(newNote);
  await storeNotesInGithubFile(env, notes);

  return new Response(JSON.stringify(newNote), {
    headers: { 'Content-Type': 'application/json' },
    status: 201,
  });
});

// Dashboard route /
router.get('/', () => {
  return new Response(renderDashboard(notes), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});

// Note detail route /note/:id
router.get('/note/:id', ({ params }) => {
  const note = notes.find(n => n.id === params.id);
  if (!note) {
    return new Response('Note not found', { status: 404 });
  }
  return new Response(renderNotePage(note), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});

// Default 404 handler
router.all('*', () => new Response('Not Found', { status: 404 }));

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    await loadNotesFromGithub(env);
    return router.handle(request, env, ctx);
  },
};
