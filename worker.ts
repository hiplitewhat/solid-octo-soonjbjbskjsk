const GEMINI_API_KEY = ENV.GEMINI_API_KEY;  // Ensure GEMINI_API_KEY is stored as a secret in Cloudflare Workers environment.
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

async function handleRequest(req) {
  console.log("Requested URL:", req.url);  // Log the request URL for debugging

  if (req.method === "POST" && req.url === "/filter") {
    try {
      const body = await req.json();
      const { text } = body;

      if (!text) {
        return new Response(
          JSON.stringify({ error: "Text parameter is required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const prompt = `Censor any offensive or inappropriate words in this sentence: "${text}". Return only the censored version.`;

      const res = await fetch(GEMINI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      const data = await res.json();
      const filtered = data.candidates?.[0]?.content?.parts?.[0]?.text || "Error filtering text.";

      return new Response(
        JSON.stringify({
          original: text,
          filtered,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Error processing request:", error);
      return new Response(
        JSON.stringify({ error: "Internal Server Error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  } else {
    console.log("Request method or URL mismatch:", req.method, req.url);
    
    return new Response(
      JSON.stringify({ error: "Not Found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
}

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});
