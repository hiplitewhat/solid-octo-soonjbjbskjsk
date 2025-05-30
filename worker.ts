export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const { pathname, searchParams } = url;

    if (req.method === 'GET' && pathname === '/') {
      const notes = await listNotesFromGithub(env);
      const html = renderHTML(notes, searchParams.get('sort') || 'desc');
      return new Response(html, { headers: { 'Content-Type': 'text/html' } });
    }

    if (req.method === 'POST' && pathname === '/notes') {
      const formData = await req.formData();
      const password = formData.get('password');

      // Password check
      if (password !== env.NOTE_PASSWORD) {
        return new Response('Unauthorized', { status: 401 });
      }

      let title = formData.get('title') || 'Untitled';
      let content = formData.get('content');

      if (!content) return new Response('Content is required', { status: 400 });

      try {
        title = await filterText(title);
        content = await filterText(content);
      } catch (e) {
        console.warn('Filter failed, using raw inputs.');
      }

      if (isRobloxScript(content)) {
        content = await obfuscate(content);
      }

      const id = crypto.randomUUID();
      await storeNoteGithub(id, title, content, env);
      return Response.redirect('/', 302);
    }

    if (req.method === 'GET' && pathname.startsWith('/notes/')) {
      const id = pathname.split('/notes/')[1];
      const ua = req.headers.get('user-agent') || '';
      if (!ua.includes('Roblox')) return new Response('Access denied', { status: 403 });

      const notes = await listNotesFromGithub(env);
      const note = notes.find(n => n.id === id);
      if (!note) return new Response('Not found', { status: 404 });
      return new Response(note.content, { headers: { 'Content-Type': 'text/plain' } });
    }

    return new Response('Not found', { status: 404 });
  }
};

function isRobloxScript(content) {
  return content.includes('game') || content.includes('script');
}

async function obfuscate(content) {
  try {
    const res = await fetch('https://comfortable-starfish-46.deno.dev/api/obfuscate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script: content })
    });
    const data = await res.json();
    return data.obfuscated || content;
  } catch (e) {
    return content;
  }
}

async function filterText(text) {
  const res = await fetch('https://jagged-chalk-feet.glitch.me/filter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  const data = await res.json();
  return data.filtered || text;
}

async function storeNoteGithub(id, title, content, env) {
  const path = `notes/${id}.txt`;
  const body = `Title: ${title}\n\n${content}`;
  const encoded = btoa(unescape(encodeURIComponent(body)));

  await fetch(`https://api.github.com/repos/${env.REPO_OWNER}/${env.REPO_NAME}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json'
    },
    body: JSON.stringify({
      message: `Add note: ${id}`,
      content: encoded,
      branch: env.BRANCH
    })
  });
}

async function listNotesFromGithub(env) {
  const res = await fetch(`https://api.github.com/repos/${env.REPO_OWNER}/${env.REPO_NAME}/contents/notes?ref=${env.BRANCH}`, {
    headers: { Authorization: `token ${env.GITHUB_TOKEN}` }
  });

  const files = await res.json();
  const notes = [];

  for (const file of files) {
    if (file.name.endsWith('.txt')) {
      const fileRes = await fetch(file.download_url);
      const raw = await fileRes.text();
      const [titleLine, , ...rest] = raw.split('\n');
      const title = titleLine.replace(/^Title:\s*/, '') || 'Untitled';
      notes.push({
        id: file.name.replace('.txt', ''),
        title,
        content: rest.join('\n'),
        createdAt: new Date().toISOString()
      });
    }
  }

  return notes;
}

function renderHTML(notes, sortOrder = 'desc') {
  const sorted = notes.sort((a, b) =>
    sortOrder === 'desc'
      ? new Date(b.createdAt) - new Date(a.createdAt)
      : new Date(a.createdAt) - new Date(b.createdAt)
  );

  const list = sorted.map(note =>
    `<div><strong><a href="/notes/${note.id}" target="_blank">${note.title}</a></strong> (ID: ${note.id})</div>`
  ).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head><title>Notes</title></head>
    <body>
      <form method="POST" action="/notes">
        <input name="title" placeholder="Title" required><br>
        <textarea name="content" rows="5" required></textarea><br>
        <input type="password" name="password" placeholder="Password" required><br>
        <button>Save</button>
      </form>
      <hr>
      ${list}
    </body>
    </html>`;
}
