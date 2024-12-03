addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const userAgent = request.headers.get('User-Agent')
  if (!userAgent || !userAgent.includes('Roblox/WinInet')) {
    return new Response('Forbidden', { status: 403 })
  }

  // Try to parse JSON and handle any errors
  let requestBody;
  try {
    requestBody = await request.json()
  } catch (error) {
    return new Response('Invalid JSON or empty body', { status: 400 })
  }

  // Check if the expected 'script' field exists in the JSON body
  const { script } = requestBody;
  if (!script) {
    return new Response('Missing "script" field in request body', { status: 400 })
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
