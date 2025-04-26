
export interface Env {
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
}

const USER_AGENT = 'MyCloudflareWorker/1.0'; // <-- Set your User-Agent here

async function fetchPastes(env: Env) {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/pastes/pastes.json`;

  const githubRes = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': USER_AGENT,
    },
  });

  if (githubRes.status === 404) {
    console.log('pastes.json not found, creating...');

    await updatePastes(env, []);
    return [];
  }

  if (!githubRes.ok) {
    const errorText = await githubRes.text();
    console.log('GitHub fetch error:', errorText);
    throw new Error('Failed to fetch pastes.json');
  }

  const data = await githubRes.json();
  const content = atob(data.content);
  return JSON.parse(content);
}

async function updatePastes(env: Env, pastes: any[]) {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/pastes/pastes.json`;

  let sha: string | undefined;
  const checkRes = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': USER_AGENT,
    },
  });

  if (checkRes.ok) {
    const checkData = await checkRes.json();
    sha = checkData.sha;
  }

  const content = btoa(JSON.stringify(pastes, null, 2));

  const body = {
    message: 'Update pastes.json',
    content,
    sha,
  };

  const githubRes = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify(body),
  });

  if (!githubRes.ok) {
    const errorText = await githubRes.text();
    console.log('GitHub update error:', errorText);
    throw new Error('Failed to update pastes.json');
  }
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(req.url);

    if (req.method === 'GET' && pathname === '/') {
      const pastes = await fetchPastes(env);

      const listItems = pastes.map((p) => 
        `<li><a href="/view/${p.slug}">${p.slug}</a> - <button onclick="window.location.href='/raw/${p.slug}'">Raw</button></li>`
      ).join('');

      return new Response(`
        <!DOCTYPE html>
        <html>
        <head><title>My Pastes</title></head>
        <body>
          <h1>My Pastes</h1>
          <ul>${listItems}</ul>
          <h2>Create New Paste</h2>
          <form method="POST" action="/api/paste">
            <textarea name="content" rows="10" cols="40" placeholder="Enter content here..."></textarea><br>
            <button type="submit">Create Paste</button>
          </form>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    if (req.method === 'POST' && pathname === '/api/paste') {
      const formData = await req.formData();
      const content = formData.get('content')?.toString();

      if (!content) {
        return new Response('Missing content', { status: 400 });
      }

      const slug = Math.random().toString(36).substring(2, 8);

      const pastes = await fetchPastes(env);
      pastes.push({ slug, content });
      await updatePastes(env, pastes);

      return new Response(`Paste created: <a href="/view/${slug}">View</a>`, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    if (req.method === 'GET' && pathname.startsWith('/view/')) {
      const slug = pathname.split('/view/')[1];
      const pastes = await fetchPastes(env);

      const paste = pastes.find((p) => p.slug === slug);
      if (!paste) return new Response('Paste not found', { status: 404 });

      return new Response(`
        <!DOCTYPE html>
        <html>
        <head><title>Paste ${slug}</title></head>
        <body>
          <h1>Paste ${slug}</h1>
          <pre>${paste.content}</pre>
          <p><a href="/raw/${slug}">View Raw</a></p>
          <p><a href="/">Back to home</a></p>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    if (req.method === 'GET' && pathname.startsWith('/raw/')) {
      const slug = pathname.split('/raw/')[1];
      const pastes = await fetchPastes(env);

      const paste = pastes.find((p) => p.slug === slug);
      if (!paste) return new Response('Paste not found', { status: 404 });

      return new Response(paste.content, {
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};
