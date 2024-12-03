addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Check if the request method is GET instead of POST
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // Optionally, you can inspect the request URL or query parameters
  const url = new URL(request.url)
  // For example, you could get a query parameter like 'script'
  const scriptParam = url.searchParams.get('script')
  
  if (!scriptParam) {
    return new Response('Missing "script" query parameter', { status: 400 })
  }

  // Your Lua script (this is a placeholder script)
  const yourScript = `
    print("Hello from Roblox exploit!")
    -- Add your Lua script here
  `

  return new Response(JSON.stringify({
    message: 'Script received',
    script: yourScript
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
