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
  const allowedUserAgent = 'curl'

  if (!userAgent || !userAgent.includes(allowedUserAgent)) {
    return new Response('Forbidden: Invalid User-Agent', { status: 403 })
  }

  // If User-Agent is valid, proceed to return a script
  // You could also modify this part to use query parameters or dynamic scripts
  const yourScript = `
    print("Hello from the Cloudflare Worker!")
    -- Example Lua script
    -- Add more Lua code here
  `

  return new Response(JSON.stringify({
    message: 'Script received and validated',
    script: yourScript
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
