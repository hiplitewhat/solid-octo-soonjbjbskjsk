interface Env {
  GEMINI_API_KEY: string;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(req, env);
  },
};

async function handleRequest(req: Request, env: Env): Promise<Response> {
  console.log("Requested URL:", req.url);

  if (req.method === "POST" && new URL(req.url).pathname === "/filter") {
    try {
      const body = await req.json();
      const { text } = body;

      if (!text || typeof text !== "string" || text.trim() === "") {
        return new Response(
          JSON.stringify({ error: "Valid 'text' parameter is required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`;
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

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Gemini API error:", errorText);
        throw new Error("Failed to fetch from Gemini API");
      }

      const data = await res.json();
      const filtered = data.candidates?.[0]?.content?.parts?.[0]?.text || "Error filtering text.";

      return new Response(
        JSON.stringify({ original: text, filtered }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    } catch (error) {
      console.error("Error processing request:", error);
      return new Response(
        JSON.stringify({ error: "Internal Server Error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: "Not Found" }),
    { status: 404, headers: { "Content-Type": "application/json" } }
  );
}
