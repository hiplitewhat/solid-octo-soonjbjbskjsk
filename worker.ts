const serviceId = 3663;
const secret = "151a5ade-1252-4c90-9608-f7402ad87578";
const useNonce = true;
const hostname = "https://api.platoboost.com";

// HWID hashing
async function hashHWID(hwid: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(hwid));
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Nonce generator
function generateNonce(): string {
  return useNonce ? Date.now().toString() : "empty";
}

// Get link from Platoboost
async function getLink(hwid: string): Promise<string | null> {
  const identifier = await hashHWID(hwid);

  const res = await fetch(`${hostname}/public/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ service: serviceId, identifier }),
  });

  if (res.ok) {
    const json = await res.json();
    return json?.data?.url ?? null;
  }

  return null;
}

// Key verification
async function verifyKey(key: string, hwid: string): Promise<boolean> {
  const identifier = await hashHWID(hwid);
  const nonce = generateNonce();

  const url = `${hostname}/public/whitelist/${serviceId}?identifier=${identifier}&key=${key}&nonce=${nonce}`;

  const res = await fetch(url);
  let json;

  try {
    json = await res.json();
  } catch {
    return false;
  }

  if (res.ok && json.success) {
    const valid = json.data.valid;
    const hash = json.data.hash;

    const computed = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${String(valid).toLowerCase()}-${nonce}-${secret}`)
    );

    const computedHash = Array.from(new Uint8Array(computed))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    return valid === true && hash === computedHash;
  }

  return false;
}

// Main handler
async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname === "/link") {
    const hwid = url.searchParams.get("customHwid");
    if (!hwid) {
      return new Response(JSON.stringify({ success: false, error: "Missing customHwid" }), { status: 400 });
    }

    const link = await getLink(hwid);
    return new Response(JSON.stringify({ success: !!link, link }), { headers: { "Content-Type": "application/json" } });
  }

  if (pathname === "/verify") {
    const key = url.searchParams.get("key");
    const hwid = url.searchParams.get("customHwid");

    if (!key || !hwid) {
      return new Response(JSON.stringify({ success: false, error: "Missing key or customHwid" }), { status: 400 });
    }

    const valid = await verifyKey(key, hwid);
    return new Response(JSON.stringify({ success: valid }), { headers: { "Content-Type": "application/json" } });
  }

  return new Response("Not Found", { status: 404 });
}

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});
