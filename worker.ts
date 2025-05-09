
// GitHub settings (set GITHUB_TOKEN in Cloudflare environment variables)
const GITHUB_TOKEN = ENV_GITHUB_TOKEN;
const REPO_OWNER = "hiplitewhat";
const REPO_NAME = "notes-app";
const USER_AGENT = "notes-app-worker";

// HTML content for main dashboard
const HTML_PAGE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
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
      notes.forEach(note => {
        const div = document.createElement('div');
        div.classList.add('note');
        const button = document.createElement('button');
        button.textContent = 'View Note';
        button.onclick = () => window.location.href = '/notes/' + note.id;
        div.appendChild(button);
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

  if (url.pathname === "/") {
    return new Response(HTML_PAGE, { headers: { "Content-Type": "text/html" } });
  }

  if (url.pathname === "/notes" && request.method === "GET") {
    const notes = await fetchNotesFromGitHub();
    return new Response(JSON.stringify(notes), {
      headers: { "Content-Type": "application/json" }
    });
  }

  if (url.pathname === "/notes" && request.method === "POST") {
    const { content } = await request.json();
    if (!content) {
      return new Response(JSON.stringify({ message: "Content is required." }), { status: 400 });
    }

    let obfuscatedContent = content;
    if (isRobloxScript(content)) {
      try {
        const response = await fetch("https://comfortable-starfish-46.deno.dev/obfuscate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script: content }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data.obfuscated?.trim()) {
            obfuscatedContent = data.obfuscated;
          }
        }
      } catch (err) {
        console.warn("Obfuscation API failed:", err.message);
      }
    }

    const noteId = generateUUID();
    await storeNoteInGitHub(noteId, obfuscatedContent);

    return new Response(JSON.stringify({ id: noteId }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (url.pathname.startsWith("/notes/") && request.method === "GET") {
    const noteId = url.pathname.split("/")[2];
    const note = await fetchNoteFromGitHub(noteId);
    if (!note) {
      return new Response("Note not found", { status: 404 });
    }
    return new Response(`
      <!DOCTYPE html>
      <html><body>
      <h1>Note</h1><pre>${escapeHtml(note)}</pre>
      <a href="/">Back to Notes</a>
      </body></html>
    `, {
      headers: { "Content-Type": "text/html" }
    });
  }

  return new Response("Not Found", { status: 404 });
}

function isRobloxScript(content) {
  return content.includes("game") || content.includes("script");
}

function generateUUID() {
  return crypto.randomUUID();
}

function escapeHtml(unsafe) {
  return unsafe.replace(/[&<>"']/g, m => ({
    '&': "&amp;", '<': "&lt;", '>': "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}

async function storeNoteInGitHub(noteId, content) {
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/notes/${noteId}.txt`;
  const base64Content = btoa(content);
  const payload = {
    message: `Add new note: ${noteId}`,
    content: base64Content,
    branch: "main"
  };

  const headers = {
    "Authorization": `token ${GITHUB_TOKEN}`,
    "Accept": "application/vnd.github.v3+json",
    "Content-Type": "application/json",
    "User-Agent": USER_AGENT
  };

  const response = await fetch(apiUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`GitHub API error: ${response.statusText}`);
  return await response.json();
}

async function fetchNotesFromGitHub() {
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/notes`;
  const headers = {
    "Authorization": `token ${GITHUB_TOKEN}`,
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": USER_AGENT
  };

  const response = await fetch(apiUrl, { headers });
  if (!response.ok) throw new Error(`GitHub fetch error: ${response.statusText}`);

  const files = await response.json();
  const notes = [];

  for (const file of files) {
    if (file.type === "file" && file.name.endsWith(".txt")) {
      notes.push({ id: file.name.replace(".txt", "") });
    }
  }

  return notes;
}

async function fetchNoteFromGitHub(noteId) {
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/notes/${noteId}.txt`;
  const headers = {
    "Authorization": `token ${GITHUB_TOKEN}`,
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": USER_AGENT
  };

  const response = await fetch(apiUrl, { headers });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub fetch error: ${response.statusText}`);

  const file = await response.json();
  return await fetch(file.download_url).then(res => res.text());
}

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});
