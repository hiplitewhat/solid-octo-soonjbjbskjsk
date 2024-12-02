addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // Get the User-Agent header from the incoming request
  const userAgent = request.headers.get('User-Agent') || '';

  // Check if the request is coming from Roblox
  // Roblox HTTP requests typically contain a specific User-Agent string
  if (userAgent.includes('Roblox') || userAgent.includes('RobloxApi')) {
    // If it's from Roblox, respond with a normal response
    return new Response('Request received from Roblox!', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  } else {
    // If not from Roblox, respond with a forbidden message
    return new Response('Forbidden', {
      status: 403,  // Forbidden status
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}
