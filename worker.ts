// Cloudflare Worker to monitor Roblox version updates and send to Discord webhook

// Cloudflare KV binding for storing the version
const VERSION_KV: KVNamespace;

// Get your Webhook URL from the environment variables
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "your-webhook-url-here"; 

// Fetch the version from Aptoide
async function getAptoideVersion(): Promise<string> {
  const url = "https://roblox.en.aptoide.com/app";

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Aptoide page. Status: ${response.status}`);
    }

    const html = await response.text();
    const match = html.match(/(\d+\.\d+\.\d+(?:\.\d+)?)/);
    if (match && match[1]) {
      return match[1].trim();
    }

    console.warn("Aptoide version not found.");
    return "Unknown";
  } catch (err) {
    console.error("Error scraping Aptoide version:", err);
    return "Error";
  }
}

// Save the version to KV storage
async function saveVersionToKV(version: string) {
  try {
    await VERSION_KV.put("currentVersion", version);
    console.log(`Version ${version} saved to KV storage.`);
  } catch (err) {
    console.error("Error saving version to KV storage:", err);
  }
}

// Get the stored version from KV storage
async function getStoredVersionFromKV(): Promise<string | null> {
  try {
    const storedVersion = await VERSION_KV.get("currentVersion");
    return storedVersion;
  } catch (err) {
    console.error("Error fetching version from KV storage:", err);
    return null;
  }
}

// Send a message to Discord Webhook
async function sendWebhookNotification(content: string, embed: object) {
  const payload = {
    content: content, // Optional: message text
    embeds: [embed], // Embed content
  };

  try {
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error("Failed to send webhook notification:", response.statusText);
    } else {
      console.log("Webhook notification sent successfully.");
    }
  } catch (error) {
    console.error("Error sending webhook notification:", error);
  }
}

// Handle the version monitoring process
async function startVersionMonitor() {
  const INTERVAL_MS = 3600000; // 1 hour interval for checking
  let lastVersion = await getStoredVersionFromKV() ?? "Unknown";

  console.log("Monitoring started...");

  // Monitor the version in intervals
  setInterval(async () => {
    try {
      const aptVersion = await getAptoideVersion();
      const shouldUpdate = aptVersion !== lastVersion && aptVersion !== "Error";

      if (shouldUpdate) {
        console.log("Version change detected.");

        const embed = {
          title: "Roblox Android Version Updated!",
          color: 0x00ff00,
          fields: [
            {
              name: "Current Version",
              value: `\`${aptVersion}\``,
              inline: true,
            },
            {
              name: "Previous Version",
              value: `\`${lastVersion ?? "unknown"}\``,
              inline: true,
            },
          ],
          timestamp: new Date(),
          footer: {
            text: "Automated Update Monitor",
          },
        };

        await sendWebhookNotification(
          "Roblox Android version updated!",
          embed
        );

        lastVersion = aptVersion; // Update last version after sending
        await saveVersionToKV(aptVersion); // Save updated version to KV
      }
    } catch (err) {
      console.error("Monitor error:", err);
    }
  }, INTERVAL_MS);
}

// Main handler for incoming requests
async function handleRequest(request: Request): Promise<Response> {
  if (request.method === "GET") {
    // Respond with the current version status
    const currentVersion = await getStoredVersionFromKV();
    return new Response(`Current Version: ${currentVersion || "Unknown"}`, {
      status: 200,
    });
  }

  if (request.method === "POST") {
    // Trigger version monitor immediately on POST request
    await startVersionMonitor();
    return new Response("Monitoring triggered.", {
      status: 200,
    });
  }

  return new Response("Invalid request method.", { status: 405 });
}

// Cloudflare Worker entry point
addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});
