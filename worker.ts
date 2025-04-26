
export interface Env {
  GITHUB_TOKEN: string; // GitHub token to commit to the repo
  REPO_OWNER: string; // GitHub repo owner
  REPO_NAME: string; // GitHub repo name
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(req.url);

    // Handle GET requests for the homepage
    if (req.method === 'GET' && pathname === '/') {
      return new Response(
        `
        <!DOCTYPE html>
        <html>
        <head><title>Create Paste</title></head>
        <body>
          <h1>Create a Paste</h1>
          <form method="POST" action="/api/add-paste">
            <label for="title">Title:</label>
            <input type="text" id="title" name="title" required><br>
            
            <label for="scriptUrl">Script URL:</label>
            <input type="text" id="scriptUrl" name="scriptUrl" required><br>
            
            <button type="submit">Submit</button>
          </form>
        </body>
        </html>
        `,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Handle POST requests for adding a new paste
    if (req.method === 'POST' && pathname === '/api/add-paste') {
      try {
        const formData = await req.formData();
        const title = formData.get('title')?.toString();
        const scriptUrl = formData.get('scriptUrl')?.toString();

        if (!title || !scriptUrl) {
          return new Response('Title and script URL are required', { status: 400 });
        }

        // Create the paste data (you can add more details here)
        const pasteData = {
          title: title,
          scriptUrl: scriptUrl,
        };

        // Save paste to GitHub
        await saveToGitHub(pasteData, env);

        // Return success response
        return new Response(
          `<p>Paste created: <a href="${scriptUrl}">${scriptUrl}</a></p>`,
          { headers: { 'Content-Type': 'text/html' } }
        );
      } catch (err) {
        return new Response(`Error: ${err.message || err}`, { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
};

async function saveToGitHub(pasteData: { title: string, scriptUrl: string }, env: Env) {
  const { GITHUB_TOKEN, REPO_OWNER, REPO_NAME } = env;
  const pasteFileName = `pastes/${pasteData.title}.json`;

  // Prepare the commit payload to GitHub API
  const commitPayload = {
    message: `Add paste: ${pasteData.title}`,
    content: Buffer.from(JSON.stringify(pasteData)).toString('base64'),
    branch: 'main', // You can change the branch if needed
  };

  // GitHub API endpoint to create a file
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${pasteFileName}`;

  const response = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commitPayload),
  });

  if (!response.ok) {
    throw new Error(`Failed to commit paste data: ${response.statusText}`);
  }

  return await response.json();
}
