const TARGET_URL = "https://wearedevs.net/api/obfuscate";
const ALLOWED_METHODS = ["POST"];
const ALLOWED_PATHS = ["/api/obfuscate"];

function corsHeaders(origin) {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", origin || "*");
  headers.set("Access-Control-Allow-Methods", "POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
  return headers;
}

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(req) {
  const { method, url, headers } = req;
  const parsedUrl = new URL(url);
  
  // Construct the full target URL by appending the path and search from the request URL
  const targetUrl = new URL(parsedUrl.pathname + parsedUrl.search, TARGET_URL);

  console.log(`[${new Date().toISOString()}] ${method} ${parsedUrl.pathname}`);
  
  // Log the constructed target URL
  console.log(`Forwarding request to target URL: ${targetUrl.toString()}`);

  // Block GET requests outright
  if (method === "GET") {
    return new Response("GET method is not allowed", { status: 405 });
  }

  // Handle CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(headers.get("Origin")) });
  }

  // Method/path filtering
  if (!ALLOWED_METHODS.includes(method) || !ALLOWED_PATHS.some(p => parsedUrl.pathname.startsWith(p))) {
    return new Response("Blocked by proxy", { status: 403 });
  }

  // Enforce POST only before forwarding
  if (method !== "POST") {
    return new Response("Only POST is supported", { status: 405 });
  }

  // Get request body
  const requestBody = await req.text();

  // Log the request body that will be forwarded to the target API
  console.log(`Request body: ${requestBody}`);

  // Forward the request to the target API
  try {
    const proxyRes = await fetch(targetUrl.toString(), {
      method: "POST", // Enforced POST
      headers: {
        "Content-Type": "application/json",
        ...headers, // Forward original headers
      },
      body: requestBody,
    });

    // Log response details from the target API
    console.log(`Response from target: ${proxyRes.status} ${proxyRes.statusText}`);

    // Get the response body
    const resBody = await proxyRes.text();

    // Prepare the CORS headers and forward them with the response
    const resHeaders = new Headers(proxyRes.headers);
    corsHeaders(headers.get("Origin")).forEach((v, k) => resHeaders.set(k, v));

    // Return the response to the client
    return new Response(resBody, {
      status: proxyRes.status,
      headers: resHeaders,
    });
  } catch (error) {
    console.error("Error while fetching from target API:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
