addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  if (request.method !== 'POST') {
    return new Response('method not allowed', { status: 405 })
  }

  const userAgent = request.headers.get('User-Agent')
  if (!userAgent || !userAgent.includes('Roblox/WinInet')) {
    return new Response('forbidden', { status: 403 })
  }

  const { script } = await request.json()
  
  // your script goes here
  const yourScript = `
    print("Hello from Roblox exploit!")
    -- Add your Lua script here
  `

  return new Response(JSON.stringify({ 
    message: 'script received',
    script: yourScript 
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
