
export interface Env {
  GITHUB_TOKEN: string;  // GitHub token for authentication
  REPO_OWNER: string;    // GitHub repository owner (your username or organization)
  REPO_NAME: string;     // GitHub repository name
  GEMINI_API_KEY: string; // Gemini API key for content moderation
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);

    // Serve the HTML form and previously submitted pastes
    if (req.method === 'GET' && pathname === '/') {
      return new Response(`
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Create Paste</title></head>
        <body>
          <h1>Create a Paste</h1>
          <form id="pasteForm" method="POST">
            <textarea name="content" rows="10" cols="40" placeholder="Enter content here..." id="content"></textarea><br>
            <button type="submit">Create Paste</button>
          </form>
          <h2>Pastes</h2>
          <ul id="paste-list">
            <!-- List of pastes will be injected here by JavaScript -->
          </ul>
          <script>
            let pastes = [];

            // Fetch pastes stored in GitHub (you'll need a server endpoint for this)
            async function fetchPastes() {
              const res = await fetch('/api/pastes');
              const pastes = await res.json();
              const pasteList = document.getElementById('paste-list');
              pastes.forEach(paste => {
                const li = document.createElement('li');
                const pre = document.createElement('pre');
                pre.textContent = paste.content;
                li.appendChild(pre);
                pasteList.appendChild(li);
              });
            }

            // Submit the paste form
            document.getElementById('pasteForm').addEventListener('submit', async (e) => {
              e.preventDefault();
              const form = e.target;
              const content = form.content.value;

              const res = await fetch('/api/paste', {
                method: 'POST',
                body: new URLSearchParams({ content }),
              });

              if (res.ok) {
                form.reset();
                fetchPastes(); // Update the displayed pastes
              } else {
                alert('Failed to create paste');
              }
            });

            fetchPastes(); // Initial load of pastes
          </script>
        </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html' } });
    }

    // Handle POST request to create a paste
    if (req.method === 'POST' && pathname === '/api/paste') {
      const formData = await req.formData();
      const content = formData.get('content')?.toString();
      if (!content) {
        return new Response('Content is required', { status: 400 });
      }

      // Check for bad words using Gemini API
      const isContentSafe = await checkBadWordsWithGemini(content, env.GEMINI_API_KEY);
      if (!isContentSafe) {
        return new Response('Content contains inappropriate language', { status: 400 });
      }

      // Save the paste to GitHub
      const pasteData = { content };
      const fileName = `paste_${Date.now()}.txt`; // unique filename based on timestamp
      await saveToGitHub(fileName, pasteData, env);

      return new Response('Paste created and saved to GitHub!', { status: 200 });
    }

    // Handle fetching the list of pastes from GitHub
    if (req.method === 'GET' && pathname === '/api/pastes') {
      const pastes = await fetchPastesFromGitHub(env);
      return new Response(JSON.stringify(pastes), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('Not Found', { status: 404 });
  }
};

// Check for bad words using Gemini API
async function checkBadWordsWithGemini(content: string, apiKey: string): Promise<boolean> {
  const url = 'https://api.gemini.com/v1/check';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: content }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API call failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result.isSafe; // Assuming 'isSafe' indicates whether the content is safe
}

// Save the paste content to GitHub
async function saveToGitHub(fileName: string, pasteData: { content: string }, env: Env) {
  const { GITHUB_TOKEN, REPO_OWNER, REPO_NAME } = env;
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${fileName}`;

  const commitPayload = {
    message: `Create paste: ${fileName}`,
    content: encodeBase64(pasteData.content),
    branch: 'main',
  };

  const response = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'PasteApp/1.0', // Required by GitHub API
    },
    body: JSON.stringify(commitPayload),
  });

  if (!response.ok) {
    throw new Error(`Failed to save paste to GitHub: ${response.statusText}`);
  }

  return await response.json();
}

// Fetch the list of pastes from GitHub repository
async function fetchPastesFromGitHub(env: Env) {
  const { GITHUB_TOKEN, REPO_OWNER, REPO_NAME } = env;
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/`;

  const response = await fetch(apiUrl, {
    headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'User-Agent': 'PasteApp/1.0' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch pastes from GitHub: ${response.statusText}`);
  }

  const files = await response.json();
  return files.map((file: any) => ({
    content: file.name,
    url: file.download_url,
  }));
}

// Base64 encode the content for GitHub upload
function encodeBase64(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  return btoa(String.fromCharCode(...data));
}
