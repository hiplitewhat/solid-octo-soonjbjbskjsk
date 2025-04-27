
export interface Env {
  GITHUB_TOKEN: string;
  REPO_OWNER: string;
  REPO_NAME: string;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);

    if (req.method === 'GET' && pathname === '/') {
      return new Response(`
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Create Paste</title></head>
        <body>
          <h1>Create a Paste</h1>
          <form method="POST" action="/api/paste">
            <textarea name="content" rows="10" cols="40" placeholder="Enter content here..."></textarea><br>
            <button type="submit">Create Paste</button>
          </form>
          <h2>Pastes</h2>
          <ul id="paste-list">
            <!-- List of pastes will be injected here by JavaScript -->
          </ul>
          <script>
            async function fetchPastes() {
              try {
                const res = await fetch('/api/pastes');
                if (!res.ok) {
                  throw new Error('Failed to fetch pastes');
                }
                const pastes = await res.json();
                const pasteList = document.getElementById('paste-list');
                if (!pastes.length) {
                  pasteList.innerHTML = '<li>No pastes available</li>';
                  return;
                }

                pastes.forEach(paste => {
                  const li = document.createElement('li');
                  const a = document.createElement('a');
                  a.href = paste.url;
                  a.textContent = paste.title;
                  li.appendChild(a);
                  pasteList.appendChild(li);
                });
              } catch (err) {
                console.error('Error fetching pastes:', err);
                const pasteList = document.getElementById('paste-list');
                pasteList.innerHTML = '<li>Error fetching pastes</li>';
              }
            }
            fetchPastes();
          </script>
        </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html' } });
    }

    // Handle POST requests for creating a paste
    if (req.method === 'POST' && pathname === '/api/paste') {
      const formData = await req.formData();
      const content = formData.get('content')?.toString();
      if (!content) {
        return new Response('Content is required', { status: 400 });
      }

      // Save the paste to GitHub
      const pasteData = { title: 'New Paste', scriptUrl: content };
      try {
        await saveToGitHub(pasteData, env);
        return new Response('Paste created successfully!', { status: 200 });
      } catch (err) {
        return new Response(`Error saving paste: ${err.message}`, { status: 500 });
      }
    }

    // Handle fetching the list of pastes from GitHub
    if (req.method === 'GET' && pathname === '/api/pastes') {
      try {
        const pastes = await fetchPastesFromGitHub(env);
        return new Response(JSON.stringify(pastes), { headers: { 'Content-Type': 'application/json' } });
      } catch (err) {
        return new Response(`Error fetching pastes: ${err.message}`, { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  }
};

async function saveToGitHub(pasteData: { title: string, scriptUrl: string }, env: Env) {
  const { GITHUB_TOKEN, REPO_OWNER, REPO_NAME } = env;
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${pasteData.title}.json`;

  const commitPayload = {
    message: `Create paste: ${pasteData.title}`,
    content: encodeBase64(JSON.stringify(pasteData)),
    branch: 'main',
  };

  const response = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Cloudflare Worker' // Make sure the User-Agent and Accept headers are set
    },
    body: JSON.stringify(commitPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub save failed: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

async function fetchPastesFromGitHub(env: Env) {
  const { GITHUB_TOKEN, REPO_OWNER, REPO_NAME } = env;
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/`;

  const response = await fetch(apiUrl, {
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Cloudflare Worker'
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch pastes from GitHub: ${response.status} - ${errorText}`);
  }

  const files = await response.json();
  console.log("Fetched files:", files); // Log the files fetched from GitHub

  return files.map((file: any) => ({
    title: file.name.replace('.json', ''),
    url: file.download_url,
  }));
}

function encodeBase64(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  return btoa(String.fromCharCode(...data));
}
