
export interface Env {
  PASTECODE_API_TOKEN: string;
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
          <form method="POST" action="/api/paste">
            <textarea name="content" rows="10" cols="40" placeholder="Enter content here..."></textarea><br>
            <button type="submit">Create Paste</button>
          </form>
        </body>
        </html>
        `,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Handle POST requests for creating a paste
    if (req.method === 'POST' && pathname === '/api/paste') {
      try {
        const formData = await req.formData();
        const content = formData.get('content')?.toString();

        const API_TOKEN = env.PASTECODE_API_TOKEN;
        if (!API_TOKEN || !content) {
          return new Response('Missing API token or content', { status: 400 });
        }

        const pasteData = {
          title: 'New Paste from Cloudflare Worker',
          exposure: 'public',
          expiration: 'never',
          pasteFiles: [{ syntax: 'plaintext', code: content }],
        };

        const response = await fetch('https://pastecode.dev/api/pastes', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(pasteData),
        });

        const data = await response.json();

        if (response.ok) {
          return new Response(
            `<p>Paste created: <a href="${data.url}">${data.url}</a></p>`,
            { headers: { 'Content-Type': 'text/html' } }
          );
        } else {
          return new Response(`Error: ${data.message || 'Paste creation failed'}`, { status: 500 });
        }
      } catch (err: any) {
        return new Response(`Unexpected error: ${err.message || err}`, { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  }
};
