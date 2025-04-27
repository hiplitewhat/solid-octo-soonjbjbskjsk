
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
          <div id="paste-viewer" style="display:none;">
            <h3>Paste Content</h3>
            <pre id="paste-content"></pre>
          </div>
          <script>
            let pastes = [];

            // Fetch pastes stored in GitHub (you'll need a server endpoint for this)
            async function fetchPastes() {
              const res = await fetch('/api/pastes');
              const pastes = await res.json();
              const pasteList = document.getElementById('paste-list');
              pasteList.innerHTML = ''; // Clear list before appending new pastes
              pastes.forEach(paste => {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = "/paste/" + paste.id; // Link to view individual paste
                a.textContent = paste.title;
                li.appendChild(a);
                pasteList.appendChild(li);
              });
            }

            // View the content of a specific paste
            async function viewPaste(id) {
              const res = await fetch('/paste/' + id); // No '/api/' here
              const content = await res.text();
              const pasteViewer = document.getElementById('paste-viewer');
              const pasteContent = document.getElementById('paste-content');
              pasteContent.textContent = content;
              pasteViewer.style.display = 'block'; // Show the viewer
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

      // Apply the obfuscation logic to the content
      const obfuscatedContent = obfuscateLuaScript(content);

      // Add the new paste to the existing pastes file
      const pasteData = {
        id: Date.now().toString(), // Unique paste ID
        content: obfuscatedContent,
        createdAt: new Date().toISOString(),
      };

      await appendToPastesFile(pasteData, env);

      return new Response('Paste created!', { status: 200 });
    }

    // Fetch all pastes from GitHub
    if (req.method === 'GET' && pathname === '/api/pastes') {
      const pastes = await fetchPastesFromGitHub(env);
      return new Response(JSON.stringify(pastes), { headers: { 'Content-Type': 'application/json' } });
    }

    // Serve the paste content at /paste/:id with User-Agent check
    if (req.method === 'GET' && pathname.startsWith('/paste/')) {
      const pasteId = pathname.split('/').pop();  // Get the paste ID from the URL

      // Check if the User-Agent is Roblox
      const userAgent = req.headers.get('User-Agent') || '';
      if (!userAgent.toLowerCase().includes('roblox')) {
        return new Response('Forbidden: Invalid User-Agent', { status: 403 });
      }

      const paste = await fetchPasteFromGitHub(pasteId, env);
      if (!paste) {
        return new Response('Paste not found', { status: 404 });
      }
      return new Response(paste.content, { headers: { 'Content-Type': 'text/plain' } });
    }

    return new Response('Not Found', { status: 404 });
  }
};

// Obfuscate the Lua script content
function obfuscateLuaScript(content: string): string {
  const thing = content;
  const encoded = thing.split("").map(char => "\\" + char.charCodeAt(0)).join("");

  return `print('Encoded your script... Copy it below!')\nprint('loadstring("${encoded}")()')`;
}

// Check for bad words using Gemini API
async function checkBadWordsWithGemini(content: string, apiKey: string): Promise<boolean> {
  const url = 'https://api.gemini.com/v1/check';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'MyPasteApp/1.0',  // Custom User-Agent header
    },
    body: JSON.stringify({ text: content }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API call failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result.isSafe; // Assuming 'isSafe' indicates whether the content is safe
}

// Append paste data to the single pastes file in GitHub
async function appendToPastesFile(pasteData: { id: string, content: string, createdAt: string }, env: Env) {
  const { GITHUB_TOKEN, REPO_OWNER, REPO_NAME } = env;
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/pastes.json`;

  // Fetch the current contents of the file (if exists)
  const response = await fetch(apiUrl, {
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'User-Agent': 'MyPasteApp/1.0',  // Custom User-Agent header
    },
  });

  let fileContent = [];
  if (response.ok) {
    const fileData = await response.json();
    const content = atob(fileData.content);
    fileContent = JSON.parse(content); // Parse the current pastes file
  }

  // Append new paste to the list
  fileContent.push(pasteData);

  // Save the updated file to GitHub
  const commitPayload = {
    message: `Add new paste: ${pasteData.id}`,
    content: encodeBase64(JSON.stringify(fileContent)),
    sha: fileContent.sha, // Get sha of the file to update it
    branch: 'main',
  };

  const updateResponse = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'MyPasteApp/1.0',  // Custom User-Agent header
    },
    body: JSON.stringify(commitPayload),
  });

  if (!updateResponse.ok) {
    throw new Error(`GitHub save failed: ${updateResponse.statusText}`);
  }

  return await updateResponse.json();
}

// Fetch the list of pastes from GitHub
async function fetchPastesFromGitHub(env: Env) {
  const { GITHUB_TOKEN, REPO_OWNER, REPO_NAME } = env;
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/pastes.json`;

  const response = await fetch(apiUrl, {
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'User-Agent': 'MyPasteApp/1.0',  // Custom User-Agent header
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch pastes from GitHub: ${response.statusText}`);
  }

  const file = await response.json();
  const content = atob(file.content);
  return JSON.parse(content); // Parse the JSON and return
}

// Fetch a single paste from GitHub by ID (or file name)
async function fetchPasteFromGitHub(id: string, env: Env) {
  const { GITHUB_TOKEN, REPO_OWNER, REPO_NAME } = env;
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/pastes.json`;

  const response = await fetch(apiUrl, {
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'User-Agent': 'MyPasteApp/1.0',  // Custom User-Agent header
    },
  });

  if (!response.ok) {
    return null;
  }

  const file = await response.json();
  const content = atob(file.content);
  const pastes = JSON.parse(content);
  return pastes.find(paste => paste.id === id); // Find the paste by ID
}

function encodeBase64(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  return btoa(String.fromCharCode(...data));
}
