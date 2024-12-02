addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Check if the request is coming from curl by inspecting the User-Agent header
  const userAgent = request.headers.get('User-Agent') || ''

  // If the User-Agent contains 'curl', send the response with the text
  if (userAgent.includes('curl')) {
    return new Response('This text can only be seen with curl!', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    })
  } else {
    // If not from curl, return a forbidden response or empty response
    return new Response('Forbidden', {
      status: 403,
      headers: { 'Content-Type': 'text/plain' }
    })
  }
}
