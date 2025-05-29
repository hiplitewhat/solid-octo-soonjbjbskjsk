import { Router } from 'itty-router'

const router = Router();

const REPO_OWNER = 'hiplitewhat';
const REPO_NAME = 'a';
const BRANCH = 'main';

// Helpers

function base64Encode(str) {
  // TextEncoder + btoa for base64 encoding in Workers
  return btoa(String.fromCharCode(...new TextEncoder().encode(str)));
}

function isRobloxScript(content) {
  return content.includes('game') || content.includes('script');
}

async function obfuscate(content) {
  try {
    const res = await fetch('https://broken-pine-ac7f.hiplitehehe.workers.dev/api/obfuscate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script: content })
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

async function filterText(text) {
  try {
    const res = await fetch('https://tiny-river-0235.hiplitehehe.workers.dev/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
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

async function storeNoteGithub(id, title, content, env) {
  const path = `notes/${id}.txt`;
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
  const body = `Title: ${title}\nCreatedAt: ${new Date().toISOString()}\n\n${content}`;
  const encoded = base64Encode(body);

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: `Add note: ${id}`,
      content: encoded,
      branch: BRANCH
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error: ${text}`);
  }

  return await res.json();
}

async function loadNotesFromGithub(env) {
  const notes = [];
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/notes?ref=${BRANCH}`;

  const res = await fetch(url, {
    headers: { Authorization: `token ${env.GITHUB_TOKEN}` }
  });

  if (!res.ok) {
    console.error('Failed to load notes:', await res.text());
    return notes;
  }

  const files = await res.json();

  for (const file of files) {
    if (file.name.endsWith('.txt')) {
      const fileRes = await fetch(file.download_url);
      if (!fileRes.ok) continue;
      const raw = await fileRes.text();

      // Parse title and createdAt
      const lines = raw.split('\n');
      const titleLine = lines.find(l => l.startsWith('Title:')) || 'Title: Untitled';
      const createdAtLine = lines.find(l => l.startsWith('CreatedAt:'));
      const title = titleLine.replace(/^Title:\s*/, '') || 'Untitled';
      const createdAt = createdAtLine ? new Date(createdAtLine.replace(/^CreatedAt:\s*/, '')).toISOString() : new Date().toISOString();

      // Content is after empty line (two line breaks)
      const emptyLineIndex = lines.findIndex(line => line.trim() === '');
      const content = lines.slice(emptyLineIndex + 1).join('\n');

      notes.push({
        id: file.name.replace('.txt', ''),
        title,
        content,
        createdAt
      });
    }
  }

  return notes;
}

function renderHTML(noteList, sortOrder = 'desc') {
  const sortedNotes = [...noteList].sort((a, b) => {
    return sortOrder === 'desc'
      ? new Date(b.createdAt) - new Date(a.createdAt)
      : new Date(a.createdAt) - new Date(b.createdAt);
  });

  const notesHtml = sortedNotes.map(note =>
    `<div class="note">
      <strong><a href="/notes/${note.id}" target="_blank" rel="noopener noreferrer">${note.title || 'Untitled'}</a></strong><br>
      ID: ${note.id}
    </div>`
  ).join('');

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

// Helpers to parse urlencoded form data (POST form submission)
async function parseFormData(request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await request.json();
  }
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await request.formData();
    const obj = {};
    for (const [key, value] of formData.entries()) {
      obj[key] = value;
    }
    return obj;
  }
  return {};
}

// Routes

router.get('/', async (request, env) => {
  const url = new URL(request.url);
  const sort = url.searchParams.get('sort') || 'desc';

  const notes = await loadNotesFromGithub(env);
  const html = renderHTML(notes, sort);

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
});

router.post('/notes', async (request, env) => {
  const form = await parseFormData(request);
  let { title, content } = form;

  if (!content) {
    return new Response('Content is required', { status: 400 });
  }
  if (!title) title = 'Untitled';

  try {
    title = await filterText(title);
    content = await filterText(content);
  } catch (err) {
    console.error('Filtering error, saving original title/content:', err);
  }

  if (isRobloxScript(content)) {
    content = await obfuscate(content);
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  try {
    await storeNoteGithub(id, title, content, env);
    // Redirect to home page
    return new Response(null, {
      status: 303,
      headers: { Location: '/' }
    });
  } catch (err) {
    return new Response(`GitHub error: ${err.message}`, { status: 500 });
  }
});

router.get('/notes/:id', async (request, env) => {
  const userAgent = request.headers.get('User-Agent') || '';
  if (!userAgent.includes('Roblox')) {
    return new Response('Access denied', { status: 403 });
  }

  const id = request.params.id;
  const notes = await loadNotesFromGithub(env);
  const note = notes.find(n => n.id === id);
  if (!note) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(note.content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
});

router.post('/filter', async (request) => {
  try {
    const { text } = await request.json();
    if (typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Text is required and must be a string' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const filtered = await filterText(text);
    return new Response(JSON.stringify({ filtered }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

router.all('*', () => new Response('Not found', { status: 404 }));

export default {
  async fetch(request, env, ctx) {
    return router.handle(request, env, ctx);
  }
};
