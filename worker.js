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

  // Only accept requests with a specific User-Agent (e.g., 'curl')
  const allowedUserAgent = 'Roblox/WinInet'

  if (!userAgent || !userAgent.includes(allowedUserAgent)) {
    return new Response('key needed', { status: 403 })
  }

  // Basic Roblox Lua Script
  const robloxScript = `
-- Roblox Lua Scri
--[[
	WARNING: Heads up! This script has not been verified by ScriptBlox. Use at your own risk!
]]
loadstring(game:HttpGet("https://raw.githubusercontent.com/Hiplitehehe/Bhhhhh/refs/heads/main/Hhhhhhh"))()
`;
  
  // Respond with the Roblox Lua script
  return new Response(robloxScript, {
    headers: { 'Content-Type': 'text/plain' }
  });
}
