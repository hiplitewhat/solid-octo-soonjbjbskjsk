
// GitHub settings (set GITHUB_TOKEN in Cloudflare environment variables)
const GITHUB_TOKEN = ENV_GITHUB_TOKEN;
const REPO_OWNER = "hiplitewhat";
const REPO_NAME = "notes-app";
const USER_AGENT = "notes-app-worker"; // GitHub requires this

// Main request handler
async function handleRequest(request) {
  const url = new URL(request.url);

  // Route for all notes (GET)
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

// Append note to a single file in GitHub (notes.txt)
async function storeNoteInGitHub(noteId, content) {
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
