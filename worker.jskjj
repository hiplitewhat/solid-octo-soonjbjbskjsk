// Bind the KV Namespace in the Worker Settings
const MY_KV_NAMESPACE = MY_KV_NAMESPACE; // This should be the name of the KV namespace you set up

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)

  // Show saved data with a GET request to /api/show
  if (request.method === 'GET' && url.pathname === '/api/show') {
    const key = 'my_data_key'; // Key used to store the data in KV
    const value = await MY_KV_NAMESPACE.get(key)

    if (value) {
      return new Response(
        JSON.stringify({
          message: 'Data retrieved from KV',
          data: JSON.parse(value)
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } else {
      return new Response(
        JSON.stringify({
          message: 'No data found in KV',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  }

  // Save data with a POST request to /api/save
  if (request.method === 'POST' && url.pathname === '/api/save') {
    const requestData = await request.json()
    const key = 'my_data_key' // Key used to store the data in KV

    // Save data to KV storage
    await MY_KV_NAMESPACE.put(key, JSON.stringify(requestData))

    return new Response(
      JSON.stringify({
        message: 'Data saved to KV successfully',
        data: requestData
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  // Return 404 if no match
  return new Response('Not Found', { status: 404 })
}
