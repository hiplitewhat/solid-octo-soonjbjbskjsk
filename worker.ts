import { Router } from 'itty-router';

export interface Env {
  GITHUB_TOKEN: string;
  GITHUB_REPO_OWNER: string;
  GITHUB_REPO_NAME: string;
  GITHUB_BRANCH: string;
  NOTES_POST_PASSWORD: string;  // Added env var for password protection
}

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

const router = Router();

let notes: Note[] = [];

function isRobloxScript(content: string): boolean {
  return content.includes('game') || content.includes('script');
}

async function obfuscate(content: string): Promise<string> {
  try {
    const res = await fetch('https://broken-pine-ac7f.hiplitehehe.workers.dev/api/obfuscate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script: content }),
    });
    if (!res.ok) {
      console.warn('Obfuscation API error:', await res.text());
      return content;
    }
    const data = await res.json();
    return data.obfuscated || content;
  } catch (err) {
    console.error('Obfuscation failed:', err);
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
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Filter API error: ${errText}`);
    }
    const data = await res.json();
    return data.filtered || text;
  } catch (err) {
    console.error('Filtering error:', err);
    return text;
  }
}

async function storeNoteGithub(env: Env, id: string, title: string, content: string): Promise<void> {
  const path = `notes/${id}.txt`;
  const url = `https://api.github.com/repos/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}/contents/${path}`;
  const body = `Title: ${title}\n\n${content}`;
  const encoded = btoa(body);

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'MyNotesApp/1.0', // Added User-Agent header
    },
    body: JSON.stringify({
      message: `Add note: ${id}`,
      content: encoded,
      branch: env.GITHUB_BRANCH,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error: ${text}`);
  }
}

async function loadNotesFromGithub(env: Env): Promise<void> {
  notes = [];
  const url = `https://api.github.com/repos/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}/contents/notes?ref=${env.GITHUB_BRANCH}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${env.GITHUB_TOKEN}`,
      'User-Agent': 'MyNotesApp/1.0',  // Added User-Agent header
    },
  });
  if (!res.ok) {
    console.error('Failed to load notes:', await res.text());
    return;
  }
  const files = await res.json();
  for (const file of files) {
    if (file.name.endsWith('.txt')) {
      const fileRes = await fetch(file.download_url);
      const raw = await fileRes.text();
      const [titleLine, , ...rest] = raw.split('\n');
      const title = titleLine.replace(/^Title:\s*/, '') || 'Untitled';
      const content = rest.join('\n');
      notes.push({
        id: file.name.replace('.txt', ''),
        title,
        content,
        createdAt: new Date().toISOString(),
      });
    }
  }
}

function renderHTML(noteList: Note[], sortOrder: 'asc' | 'desc' = 'desc'): string {
  const sortedNotes = [...noteList].sort((a, b) =>
    sortOrder === 'desc'
      ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const notesHtml = sortedNotes
    .map(
      (note) => `
    <div class="note">
      <strong><a href="/notes/${note.id}" target="_blank">${note.title || 'Untitled'}</a></strong><br>
      ID: ${note.id}
    </div>`,
    )
    .join('');

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <title>Notes App</title>
      <style>
        body { font-family: Arial; padding: 20px; }
        .note { padding: 10px; background: #f0f0f0; margin: 10px 0; }
      </style>
    </head>
    <body>
      <h1>Notes</h1>
      <form method="POST" action="/notes">
        <input type="password" name="password" placeholder="Password" required><br><br>
        <input type="text" name="title" placeholder="Title" required><br><br>
        <textarea name="content" rows="4" cols="50" placeholder="Write your note..." required></textarea><br>
        <button type="submit">Save Note</button>
      </form>
      <p>Sort: 
        <a href="/?sort=desc">Newest First</a> | 
        <a href="/?sort=asc">Oldest First</a>
      </p>
      <div>${notesHtml}</div>
    </body>
  </html>`;
}

router.get('/', async (request, env) => {
  const url = new URL(request.url);
  const sort = url.searchParams.get('sort') === 'asc' ? 'asc' : 'desc';
  return new Response(renderHTML(notes, sort), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});

router.post('/notes', async (request, env) => {
  const formData = await request.formData();
  const password = formData.get('password');
  let title = formData.get('title');
  let content = formData.get('content');

  // Check password
  if (typeof password !== 'string' || password !== env.NOTES_POST_PASSWORD) {
    return new Response('Unauthorized: Invalid password', { status: 401 });
  }

  if (typeof content !== 'string' || content.trim() === '') {
    return new Response('Content is required', { status: 400 });
  }
  if (typeof title !== 'string' || title.trim() === '') {
    title = 'Untitled';
  }

  try {
    title = await filterText(title);
    content = await filterText(content);
  } catch (e) {
    console.error('Filtering error:', e);
  }

  if (isRobloxScript(content)) {
    content = await obfuscate(content);
  }

  const id = crypto.randomUUID();
  const note: Note = {
    id,
    title,
    content,
    createdAt: new Date().toISOString(),
  };

  notes.push(note);

  try {
    await storeNoteGithub(env, id, title, content);
    return Response.redirect(new URL('/', request.url).toString());
  } catch (err) {
    return new Response(`GitHub error: ${(err as Error).message}`, { status: 500 });
  }
});

router.get('/notes/:id', (request, env, ctx) => {
  const userAgent = request.headers.get('User-Agent') || '';
  if (!userAgent.includes('Roblox')) {
    return new Response('Access denied', { status: 403 });
  }
  const { id } = request.params as { id: string };
  const note = notes.find((n) => n.id === id);
  if (!note) {
    return new Response('Not found', { status: 404 });
  }
  return new Response(note.content, { headers: { 'Content-Type': 'text/plain' } });
});

router.post('/filter', async (request) => {
  const json = await request.json();
  const text = json.text;
  if (typeof text !== 'string') {
    return new Response(JSON.stringify({ error: 'Text is required and must be a string' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  try {
    const filtered = await filterText(text);
    return new Response(JSON.stringify({ filtered }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (notes.length === 0) {
      await loadNotesFromGithub(env);
    }
    return router.handle(request, env, ctx);
  },
};
