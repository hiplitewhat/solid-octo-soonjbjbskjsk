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

// Serve frontend HTML
const htmlPage = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Notes App</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; }
    input, textarea { display: block; width: 100%; margin-bottom: 1rem; padding: 0.5rem; }
    button { padding: 0.5rem 1rem; }
    .note { border: 1px solid #ccc; padding: 1rem; margin-bottom: 1rem; border-radius: 5px; }
    .note h3 { margin: 0 0 0.5rem 0; }
    .note small { color: #555; }
  </style>
</head>
<body>
  <h1>Notes</h1>

  <form id="note-form">
    <input type="text" id="title" placeholder="Note Title" required />
    <textarea id="content" placeholder="Note Content" rows="5" required></textarea>
    <input type="password" id="password" placeholder="Post Password" required />
    <button type="submit">Submit Note</button>
  </form>

  <hr />

  <div id="notes"></div>

  <script>
    const API_URL = '/notes';

    async function fetchNotes() {
      const res = await fetch(API_URL);
      const notes = await res.json();
      const notesContainer = document.getElementById('notes');
      notesContainer.innerHTML = '';

      for (const note of notes) {
        const div = document.createElement('div');
        div.className = 'note';
        div.innerHTML = \`
          <h3>\${note.title}</h3>
          <p>\${note.content}</p>
          <small>\${new Date(note.createdAt).toLocaleString()}</small>
        \`;
        notesContainer.appendChild(div);
      }
    }

    document.getElementById('note-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('title').value;
      const content = document.getElementById('content').value;
      const password = document.getElementById('password').value;

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, password }),
      });

      if (res.ok) {
        alert('Note posted!');
        document.getElementById('note-form').reset();
        fetchNotes();
      } else {
        alert('Failed to post note: ' + await res.text());
      }
    });

    fetchNotes();
  </script>
</body>
</html>
`;

// Routes

router.get('/notes', () => {
  return new Response(JSON.stringify(notes), {
    headers: { 'Content-Type': 'application/json' },
  });
});

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

// Serve frontend HTML at root
router.get('/', () => {
  return new Response(htmlPage, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});

// Required fetch handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    await loadNotesFromGithub(env); // optional: load notes on every request
    return router.handle(request, env, ctx);
  },
};
