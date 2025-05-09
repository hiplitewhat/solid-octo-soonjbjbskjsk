
// GitHub settings (set GITHUB_TOKEN in Cloudflare environment variables)
const GITHUB_TOKEN = ENV_GITHUB_TOKEN;
const REPO_OWNER = "hiplitewhat";
const REPO_NAME = "notes-app";
const USER_AGENT = "notes-app-worker"; // GitHub requires this

// Main request handler
async function handleRequest(request) {
  const url = new URL(request.url);

  // Route to fetch all notes (GET)
  if (url.pathname === "/notes" && request.method === "GET") {
    const notes = await fetchNotesFromGitHub();
    return new Response(JSON.stringify(notes), {
      headers: { "Content-Type": "application/json" }
    });
  } 
  // Route to create a new note (POST)
  else if (url.pathname === "/notes" && request.method === "POST") {
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
  // Route to fetch a single note (GET /notes/{noteId})
  else if (url.pathname.startsWith("/notes/") && request.method === "GET") {
    const noteId = url.pathname.split("/")[2];
    const note = await fetchNoteFromGitHub(noteId);

    if (!note) {
      return new Response("Note not found", { status: 404 });
    }

    return new Response(JSON.stringify(note), {
      headers: { "Content-Type": "application/json" }
    });
  } 
  // Route to update a single note (PUT /notes/{noteId})
  else if (url.pathname.startsWith("/notes/") && request.method === "PUT") {
    const noteId = url.pathname.split("/")[2];
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

    const result = await updateNoteInGitHub(noteId, obfuscatedContent);

    return new Response(JSON.stringify({ id: noteId, content: obfuscatedContent, github: result }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } 
  // Return "Not Found" for other routes
  return new Response("Not Found", { status: 404 });
}

// Check if content appears to be Roblox-related
function isRobloxScript(content) {
  return content.includes("game") || content.includes("script");
}

// Generate UUID
function generateUUID() {
  return crypto.randomUUID();
}

// Store a new note in GitHub as a file
async function storeNoteInGitHub(noteId, content) {
  if (!GITHUB_TOKEN) throw new Error("Missing GitHub token");

  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/notes/${noteId}.txt`;

  const note = `ID: ${noteId}\nContent: ${content}\n\n`;
  const base64Content = btoa(note);

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

// Fetch a specific note from GitHub by noteId
async function fetchNoteFromGitHub(noteId) {
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/notes/${noteId}.txt`;
  const headers = {
    "Authorization": `token ${GITHUB_TOKEN}`,
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": USER_AGENT
  };

  const response = await fetch(apiUrl, { headers });

  if (response.status === 404) {
    return null; // Note not found
  }
  if (!response.ok) throw new Error(`GitHub fetch error: ${response.statusText}`);

  const file = await response.json();
  const content = await fetch(file.download_url).then(res => res.text());

  return { id: noteId, content };
}

// Update a specific note on GitHub
async function updateNoteInGitHub(noteId, content) {
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/notes/${noteId}.txt`;
  const base64Content = btoa(`ID: ${noteId}\nContent: ${content}\n\n`);

  const payload = {
    message: `Update note: ${noteId}`,
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

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});
