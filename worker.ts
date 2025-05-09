
// GitHub settings (set GITHUB_TOKEN in Cloudflare environment variables)
const GITHUB_TOKEN = ENV_GITHUB_TOKEN;
const REPO_OWNER = "hiplitewhat";
const REPO_NAME = "notes-app";
const USER_AGENT = "notes-app-worker";

// HTML content as a string (for the main page)
const HTML_PAGE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notes App</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    input, button, textarea { margin: 5px 0; width: 100%; }
    .note { padding: 10px; background-color: #f4f4f4; margin-bottom: 10px; }
  </style>
</head>
<body>
  <h1>Notes App</h1>
  <form id="noteForm">
    <textarea id="content" rows="4" placeholder="Write your note here..."></textarea><br>
    <button type="submit">Create Note</button>
  </form>

  <button onclick='location.href="/notes"' style="margin: 10px 0;">/notes</button>

  <h2>All Notes</h2>
  <div id="notesContainer"></div>
  <script>
    document.getElementById('noteForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const content = document.getElementById('content').value;
      const response = await fetch('/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      if (response.ok) {
        document.getElementById('content').value = '';
        fetchNotes();
      } else {
        alert('Failed to create note');
      }
    });

    async function fetchNotes() {
      const response = await fetch('/notes');
      const notes = await response.json();
      const notesContainer = document.getElementById('notesContainer');
      notesContainer.innerHTML = '';
      notes.forEach(content => {
        const div = document.createElement('div');
        div.classList.add('note');
        div.textContent = content;
        notesContainer.appendChild(div);
      });
    }

    window.onload = fetchNotes;
  </script>
</body>
</html>
`;

async function handleRequest(request) {
  const url = new URL(request.url);

  // Serve main page
  if (url.pathname === "/") {
    return new Response(HTML_PAGE, { headers: { "Content-Type": "text/html" } });
  }

  // GET all notes (JSON array)
  if (url.pathname === "/notes" && request.method === "GET") {
    const notes = await fetchNotesFromGitHub();
    return new Response(JSON.stringify(notes), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // POST create a note
  if (url.pathname === "/notes" && request.method === "POST") {
    const { content } = await request.json();
    if (!content) {
      return new Response(JSON.stringify({ message: "Content is required." }), { status: 400 });
    }

    let obfuscatedContent = content;
    if (isRobloxScript(content)) {
      try {
        const resp = await fetch("https://comfortable-starfish-46.deno.dev/obfuscate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script: content }),
        });
        const data = await resp.json();
        if (resp.ok && data.obfuscated?.trim()) {
          obfuscatedContent = data.obfuscated;
        }
      } catch (err) {
        console.warn("Obfuscation API failed:", err.message);
      }
    }

    const noteId = generateUUID();
    await storeNoteInGitHub(noteId, obfuscatedContent);
    return new Response(JSON.stringify(obfuscatedContent), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  }

  // GET single note as raw text
  if (url.pathname.startsWith("/notes/") && request.method === "GET") {
    const noteId = url.pathname.split("/")[2];
    const note = await fetchNoteFromGitHub(noteId);
    if (note === null) {
      return new Response("Note not found", { status: 404 });
    }
    // Return plain text without JSON quotes
    return new Response(note, {
      headers: { "Content-Type": "text/plain" }
    });
  }

  // PUT update a note
  if (url.pathname.startsWith("/notes/") && request.method === "PUT") {
    const noteId = url.pathname.split("/")[2];
    const { content } = await request.json();
    if (!content) {
      return new Response(JSON.stringify({ message: "Content is required." }), { status: 400 });
    }

    let obfuscatedContent = content;
    if (isRobloxScript(content)) {
      try {
        const resp = await fetch("https://comfortable-starfish-46.deno.dev/obfuscate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script: content }),
        });
        const data = await resp.json();
        if (resp.ok && data.obfuscated?.trim()) {
          obfuscatedContent = data.obfuscated;
        }
      } catch (err) {
        console.warn("Obfuscation API failed:", err.message);
      }
    }

    await updateNoteInGitHub(noteId, obfuscatedContent);
    return new Response(JSON.stringify(obfuscatedContent), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response("Not Found", { status: 404 });
}

// Utility: Detect Roblox-like scripts
function isRobloxScript(content) {
  return content.includes("game") || content.includes("script");
}

// Utility: Generate UUID
function generateUUID() {
  return crypto.randomUUID();
}

// Store new note in GitHub
async function storeNoteInGitHub(noteId, content) {
  if (!GITHUB_TOKEN) throw new Error("Missing GitHub token");
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/notes/${noteId}.txt`;
  const base64 = btoa(content);
  const payload = { message: `Add new note: ${noteId}`, content: base64, branch: "main" };
  const headers = {
    "Authorization": `token ${GITHUB_TOKEN}`,
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": USER_AGENT,
    "Content-Type": "application/json"
  };
  const resp = await fetch(apiUrl, { method: "PUT", headers, body: JSON.stringify(payload) });
  if (!resp.ok) throw new Error(`GitHub API error: ${resp.statusText}`);
  return resp.json();
}

// Fetch all notes from GitHub
async function fetchNotesFromGitHub() {
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/notes`;
  const headers = {
    "Authorization": `token ${GITHUB_TOKEN}`,
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": USER_AGENT
  };
  const resp = await fetch(apiUrl, { headers });
  if (!resp.ok) throw new Error(`GitHub fetch error: ${resp.statusText}`);
  const files = await resp.json();
  const notes = [];
  for (const f of files) {
    if (f.type === "file" && f.name.endsWith(".txt")) {
      const txt = await fetch(f.download_url).then(r => r.text());
      notes.push(txt);
    }
  }
  return notes;
}

// Fetch a single note from GitHub
async function fetchNoteFromGitHub(noteId) {
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/notes/${noteId}.txt`;
  const headers = {
    "Authorization": `token ${GITHUB_TOKEN}`,
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": USER_AGENT
  };
  const resp = await fetch(apiUrl, { headers });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`GitHub fetch error: ${resp.statusText}`);
  const file = await resp.json();
  return fetch(file.download_url).then(r => r.text());
}

// Update an existing note on GitHub
async function updateNoteInGitHub(noteId, content) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/notes/${noteId}.txt`;
  const headers = {
    "Authorization": `token ${GITHUB_TOKEN}`,
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": USER_AGENT
  };
  const getResp = await fetch(url, { headers });
  if (!getResp.ok) throw new Error("Could not retrieve file for update");
  const file = await getResp.json();
  const base64 = btoa(content);
  const payload = { message: `Update note: ${noteId}`, content: base64, sha: file.sha, branch: "main" };
  const resp = await fetch(url, { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!resp.ok) throw new Error(`GitHub update error: ${resp.statusText}`);
  return resp.json();
}

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});
