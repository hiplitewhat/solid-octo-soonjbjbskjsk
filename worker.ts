
export interface Env {
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
}

function template(body: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Pastebin</title>
        <style>
          body { font-family: sans-serif; padding: 2rem; }
          pre { background: #f4f4f4; padding: 1rem; border-radius: 8px; overflow-x: auto; }
          a.button { display: inline-block; margin-top: 1rem; background: #0070f3; color: white; padding: 0.5rem 1rem; border-radius: 5px; text-decoration: none; }
        </style>
      </head>
      <body>
        ${body}
      </body>
    </html>
  `;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const GITHUB_TOKEN = env.GITHUB_TOKEN;
    const GITHUB_REPO = env.GITHUB_REPO;

    if (req.method === 'GET' && pathname === '/') {
      // Homepage: show form and list of pastes
      const pastes = await getPasteList(GITHUB_REPO, GITHUB_TOKEN);
      const pasteLinks = pastes.map(file => `<li><a href="/raw/${file}">${file}</a></li>`).join('');

      const body = `
        <h1>Create a Paste</h1>
        <form method="POST" action="/api/paste">
          <textarea name="content" rows="10" cols="60" placeholder="Enter your text..."></textarea><br><br>
          <button type="submit">Create Paste</button>
        </form>

        <h2>All Pastes:</h2>
        <ul>
          ${pasteLinks}
        </ul>
      `;
      return new Response(template(body), { headers: { 'Content-Type': 'text/html' } });
    }

    if (req.method === 'POST' && pathname === '/api/paste') {
      try {
        const formData = await req.formData();
        const content = formData.get('content')?.toString();

        if (!GITHUB_TOKEN || !GITHUB_REPO || !content) {
          return new Response('Missing GitHub credentials or content', { status: 400 });
        }

        const timestamp = Date.now();
        const filename = `${timestamp}.txt`;
        const filePath = `pastes/${filename}`;
        const githubApiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`;

        const fileContentBase64 = btoa(content);
        const commitMessage = `Add new paste: ${filename}`;

        // Upload new paste
        const response = await fetch(githubApiUrl, {
          method: 'PUT',
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: commitMessage,
            content: fileContentBase64,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          return new Response(`GitHub error: ${data.message || 'Failed to create paste'}`, { status: 500 });
        }

        // Update paste list
        await addPasteToList(filename, GITHUB_REPO, GITHUB_TOKEN);

        // Success
        return Response.redirect('/', 303);
      } catch (err: any) {
        return new Response(`Unexpected error: ${err.message || err}`, { status: 500 });
      }
    }

    if (req.method === 'GET' && pathname.startsWith('/raw/')) {
      const filename = pathname.split('/raw/')[1];
      if (!filename) return new Response('Bad Request', { status: 400 });

      const rawUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/pastes/${filename}`;
      const resp = await fetch(rawUrl);

      if (!resp.ok) {
        return new Response('Paste not found.', { status: 404 });
      }

      const text = await resp.text();
      return new Response(text, {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};

async function getPasteList(repo: string, token: string): Promise<string[]> {
  const apiUrl = `https://api.github.com/repos/${repo}/contents/pastes/pastes.json`;

  const resp = await fetch(apiUrl, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${token}`,
    }
  });

  if (resp.status === 404) return []; // No file yet
  if (!resp.ok) throw new Error('Failed to fetch pastes.json');

  const data = await resp.json();
  const content = atob(data.content);
  return JSON.parse(content) as string[];
}

async function addPasteToList(filename: string, repo: string, token: string) {
  const apiUrl = `https://api.github.com/repos/${repo}/contents/pastes/pastes.json`;

  let currentList: string[] = [];
  let sha: string | undefined = undefined;

  const resp = await fetch(apiUrl, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${token}`,
    }
  });

  if (resp.ok) {
    const data = await resp.json();
    const content = atob(data.content);
    currentList = JSON.parse(content) as string[];
    sha = data.sha;
  }

  currentList.unshift(filename); // Add new paste at the top

  const newContentBase64 = btoa(JSON.stringify(currentList, null, 2));

  const updateResp = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Update pastes list',
      content: newContentBase64,
      sha: sha,
    }),
  });

  if (!updateResp.ok) {
    throw new Error('Failed to update pastes.json');
  }
}

function escapeHTML(str: string): string {
  return str.replace(/[&<>"']/g, (char) => {
    const escape: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return escape[char];
  });
}
