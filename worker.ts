
export interface Env {
  GITHUB_TOKEN: string;
  REPO_OWNER: string;
  REPO_NAME: string;
}

export default {
  pastes: [] as { title: string; content: string }[],  // In-memory storage for pastes

  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);

    if (req.method === 'GET' && pathname === '/') {
      // Show paste creation form and list of pastes
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
            ${this.pastes.map(paste => `<li><strong>${paste.title}</strong>: ${paste.content}</li>`).join('')}
          </ul>
          <script>
            async function fetchPastes() {
              const res = await fetch('/api/pastes');
              const pastes = await res.json();
              const pasteList = document.getElementById('paste-list');
              pasteList.innerHTML = ''; // Clear the list before adding new items
              pastes.forEach(paste => {
                const li = document.createElement('li');
                li.innerHTML = \`<strong>\${paste.title}</strong>: \${paste.content}\`;
                pasteList.appendChild(li);
              });
            }
            fetchPastes(); // Initial fetch of pastes
          </script>
        </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html' } });
    }

    if (req.method === 'POST' && pathname === '/api/paste') {
      const formData = await req.formData();
      const content = formData.get('content')?.toString();
      if (!content) {
        return new Response('Content is required', { status: 400 });
      }

      // Save the paste to in-memory storage
      const pasteData = { title: `Paste ${this.pastes.length + 1}`, content };
      this.pastes.push(pasteData);

      return new Response(`
        <html><body>
          <h1>Paste created successfully!</h1>
          <a href="/">Go back to the main page</a>
        </body></html>
      `, { status: 200 });
    }

    if (req.method === 'GET' && pathname === '/api/pastes') {
      // Return the list of pastes as JSON
      return new Response(JSON.stringify(this.pastes), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('Not Found', { status: 404 });
  }
};
