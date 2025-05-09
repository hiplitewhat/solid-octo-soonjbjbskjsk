
// GitHub settings (make sure to set GITHUB_TOKEN in your environment)
const GITHUB_TOKEN = ENV_GITHUB_TOKEN;  // Set this in your Cloudflare environment variable
const REPO_OWNER = "hiplitewhat";  // Your GitHub username
const REPO_NAME = "notes-app";  // Name of your repository

// In-memory store for notes (this would be replaced by KV or Durable Objects for persistent storage)
let notes = [];

// Function to handle incoming requests
async function handleRequest(request) {
  const url = new URL(request.url);
  
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
          input, button { margin: 5px 0; }
          .note { padding: 10px; background-color: #f4f4f4; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <h1>Notes App</h1>
        <form id="noteForm">
          <textarea id="content" rows="4" cols="50" placeholder="Write your note here..."></textarea><br>
          <button type="submit">Create Note</button>
        </form>

        <h2>All Notes</h2>
        <div id="notesContainer"></div>

        <script>
          // Handle form submission
          document.getElementById('noteForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const content = document.getElementById('content').value;
            const response = await fetch('/notes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content })
            });
            if (response.ok) {
              document.getElementById('content').value = '';  // Clear input
              fetchNotes();  // Refresh the notes list
            }
          });

          // Fetch and display all notes
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

          // Load notes on page load
          window.onload = fetchNotes;
        </script>
      </body>
      </html>
    `, { headers: { "Content-Type": "text/html" } });
  } else if (url.pathname === "/notes" && request.method === "GET") {
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
      obfuscatedContent = obfuscateRobloxScript(content);
    }

    const newNote = { id: generateUUID(), content: obfuscatedContent };
    notes.push(newNote);

    // Store the note in GitHub
    const result = await storeNoteInGitHub(newNote.id, obfuscatedContent);

    return new Response(JSON.stringify({ ...newNote, github: result }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } else {
    return new Response("Not Found", { status: 404 });
  }
}

// Check if the note is a Roblox script (simple check)
function isRobloxScript(content) {
  return content.includes("game") || content.includes("script");
}

// Simple obfuscator that changes variable names (you can improve this)
function obfuscateRobloxScript(script) {
  return script.replace(/\bgame\b/g, 'g' + Math.random().toString(36).substring(2, 15));
}

// Function to generate a UUID
function generateUUID() {
  return crypto.randomUUID();
}

// Function to store the note in GitHub
async function storeNoteInGitHub(noteId, content) {
  if (!GITHUB_TOKEN) {
    throw new Error("GitHub token is missing.");
  }

  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/notes/${noteId}.txt`;
  
  // Prepare the content for GitHub (Base64 encoded)
  const base64Content = btoa(content);

  const payload = {
    message: `Add note: ${noteId}`,
    content: base64Content,
    branch: "main"
  };

  const headers = {
    "Authorization": `token ${GITHUB_TOKEN}`,
    "Accept": "application/vnd.github.v3+json",
    "Content-Type": "application/json"
  };

  const response = await fetch(apiUrl, {
    method: "PUT",
    headers: headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

// Event listener for the Cloudflare Worker
addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});
