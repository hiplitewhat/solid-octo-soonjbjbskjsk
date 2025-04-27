
export interface Env {
  GITHUB_TOKEN: string;
  REPO_OWNER: string;
  REPO_NAME: string;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (req.method === 'GET' && pathname === '/') {
      return new Response(`
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Create Paste</title></head>
        <body>
          <h1>Create a Paste</h1>
          <form method="POST" action="/api/paste">
            <textarea name="content" rows="10" cols="40" placeholder="Enter content here..."></textarea><br>
            <input name="title" placeholder="Paste Title"><br>
            <button type="submit">Create Paste</button>
          </form>
          <h2>Pastes</h2>
          <ul id="paste-list"></ul>
          <script>
            async function fetchPastes() {
              const res = await fetch('/api/pastes');
              const pastes = await res.json();
              const pasteList = document.getElementById('paste-list');
              pasteList.innerHTML = '';
              pastes.forEach(paste => {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = paste.url;
                a.textContent = paste.title;
                li.appendChild(a);
                pasteList.appendChild(li);
              });
            }
            fetchPastes();
          </script>
        </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html' } });
    }

    if (req.method === 'POST' && pathname === '/api/paste') {
      const formData = await req.formData();
      const content = formData.get('content')?.toString();
      const title = formData.get('title')?.toString();

      if (!content || !title) {
        return new Response('Content and title are required', { status: 400 });
      }

      try {
        const pasteData = { title, content };
        await saveToGitHub(pasteData, env);
        return new Response('Paste created successfully!', { status: 200 });
      } catch (err) {
        console.error('Failed to save paste:', err);
        return new Response('Failed to create paste', { status: 500 });
      }
    }

    if (req.method === 'GET' && pathname === '/api/pastes') {
      try {
        const pastes = await fetchPastesFromGitHub(env);
        return new Response(JSON.stringify(pastes), { headers: { 'Content-Type': 'application/json' } });
      } catch (err) {
        console.error('Failed to fetch pastes:', err);
        return new Response('Failed to fetch pastes', { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  }
};

async function saveToGitHub(pasteData: { title: string, content: string }, env: Env) {
  const { GITHUB_TOKEN, REPO_OWNER, REPO_NAME } = env;
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/pastes/${encodeURIComponent(pasteData.title)}.json`;

  const payload = {
    message: `Create paste: ${pasteData.title}`,
    content: encodeContent(pasteData),
    branch: 'main',
  };

  const res = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`GitHub save failed: ${res.status} - ${errorBody}`);
  }
}

async function fetchPastesFromGitHub(env: Env) {
  const { GITHUB_TOKEN, REPO_OWNER, REPO_NAME } = env;
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/pastes`;

  const res = await fetch(apiUrl, {
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`GitHub fetch failed: ${res.status} - ${errorBody}`);
  }

  const files = await res.json();

  return files.map((file: any) => ({
    title: decodeURIComponent(file.name.replace('.json', '')),
    url: file.download_url,
  }));
}

function encodeContent(pasteData: { title: string, content: string }): string {
  const str = JSON.stringify(pasteData);
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}
