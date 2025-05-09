
// GitHub settings (set GITHUB_TOKEN in Cloudflare environment variables)
const GITHUB_TOKEN = ENV_GITHUB_TOKEN;
const REPO_OWNER = "hiplitewhat";
const REPO_NAME = "notes-app";
const USER_AGENT = "notes-app-worker"; // GitHub requires this

// Main request handler
async function handleRequest(request: Request) {
  const url = new URL(request.url);

  // Serve the HTML page
  if (url.pathname === "/") {
    return new Response(`
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
              div.innerHTML = \`<strong>\${note.id}</strong><br>\${note.content}\`;
              notesContainer.appendChild(div);
            });
          }

          window.onload = fetchNotes;
        </script>
      </body>
      </html>
    `, { headers: { "Content-Type": "text/html" } });

  } else if (url.pathname === "/notes" && request.method === "GET") {
    const notes = await fetchNotesFromGitHub();
    return new Response(JSON.stringify(notes), {
      headers: { "Content-Type": "application/json" }
    });

  } else if (url.pathname === "/notes" && request.method === "POST") {
    const requestBody = await request.json();
    const { content } = requestBody;

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
          // Check if the obfuscated data is a valid string
          if (typeof data.obfuscated === "string" && data.obfuscated.trim() !== "") {
            obfuscatedContent = data.obfuscated;
          } else {
            console.warn("Obfuscation response invalid, using original content.");
          }
        }
      } catch (err) {
        console.warn("Obfuscation API failed:", err.message);
      }
    }

    const noteId = generateUUID();
    const result = await storeNoteInGitHub(noteId, obfuscatedContent);

    return new Response(JSON.stringify({ id: noteId, content: obfuscatedContent, github: result }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });

  } 
  // Return "Not Found" for other routes
  return new Response("Not Found", { status: 404 });
}

// Check if content appears to be Roblox-related
function isRobloxScript(content: string) {
  return content.includes("game") || content.includes("script");
}

// Generate UUID
function generateUUID() {
  return crypto.randomUUID();
}

// Append note to a single file in GitHub (notes.txt)
async function storeNoteInGitHub(noteId: string, content: string) {
  if (!GITHUB_TOKEN) throw new Error("Missing GitHub token");

  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/notes.txt`;

  const note = `ID: ${noteId}\nContent: ${content}\n\n`;

  // Get the current content of the notes file
  const fileData = await fetchFileFromGitHub();
  const newFileContent = fileData + note;

  const base64Content = btoa(newFileContent);

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

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  return await response.json();
}

// Fetch the content of the notes file from GitHub
async function fetchFileFromGitHub() {
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/notes.txt`;
  const headers = {
    "Authorization": `token ${GITHUB_TOKEN}`,
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": USER_AGENT
  };

  const response = await fetch(apiUrl, { headers });

  if (response.status === 404) {
    // If the file does not exist, return an empty string
    return "";
  }
  if (!response.ok) throw new Error(`GitHub fetch error: ${response.statusText}`);

  const file = await response.json();
  const content = await fetch(file.download_url).then(res => res.text());

  return content;
}

// Fetch all notes from the single file on GitHub
async function fetchNotesFromGitHub() {
  const fileContent = await fetchFileFromGitHub();
  
  if (!fileContent) {
    return []; // No notes yet
  }

  // Parse the notes by splitting them by the 'ID' marker
  const notes = fileContent.split("\n\n").map(note => {
    const parts = note.split("\n");
    const id = parts[0]?.replace("ID: ", "");
    const content = parts.slice(1).join("\n").replace("Content: ", "").trim();
    return { id, content };
  }).filter(note => note.id && note.content);

  return notes;
}

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});
