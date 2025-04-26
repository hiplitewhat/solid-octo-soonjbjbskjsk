
export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(req.url);

    // POST request to create a paste and update pastes.json on GitHub
    if (req.method === 'POST' && pathname === '/api/add-paste') {
      try {
        const formData = await req.formData();
        const title = formData.get('title')?.toString();
        const scriptUrl = formData.get('scriptUrl')?.toString();

        if (!title || !scriptUrl) {
          return new Response('Title and script URL are required', { status: 400 });
        }

        // Access the GitHub token from the environment variable
        const GITHUB_TOKEN = env.GITHUB_TOKEN; // Get the token from environment variables

        if (!GITHUB_TOKEN) {
          return new Response('GitHub token is not set in the environment', { status: 500 });
        }

        // GitHub API details
        const GITHUB_API_URL = 'https://api.github.com/repos/youruser/yourrepo/contents/pastes.json';

        // Fetch current `pastes.json` from GitHub
        const res = await fetch(GITHUB_API_URL, {
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });

        const data = await res.json();

        if (!res.ok || !data.content) {
          return new Response('Failed to fetch pastes.json', { status: 500 });
        }

        // Decode and parse pastes.json content
        const pastes = JSON.parse(atob(data.content));

        // Add new paste to pastes.json
        const newPaste = {
          slug: title.toLowerCase().replace(/\s+/g, '-'),
          url: scriptUrl
        };

        pastes.push(newPaste);

        // Prepare updated content to commit back to GitHub
        const updatedContent = btoa(JSON.stringify(pastes, null, 2));
        const updatePayload = {
          message: `Added new paste: ${title}`,
          content: updatedContent,
          sha: data.sha // Required for the update
        };

        // Push the update to GitHub
        const updateRes = await fetch(GITHUB_API_URL, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          },
          body: JSON.stringify(updatePayload)
        });

        if (!updateRes.ok) {
          const updateError = await updateRes.json();
          return new Response(`Failed to update pastes.json: ${updateError.message}`, { status: 500 });
        }

        return new Response(`Successfully added new paste: ${title}`, { status: 200 });

      } catch (err) {
        return new Response(`Error: ${err.message || err}`, { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  }
};
