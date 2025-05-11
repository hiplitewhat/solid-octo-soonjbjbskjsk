interface Env {
  GITHUB_TOKEN: string;
  DISCORD_WEBHOOK_URL_APTOIDE: string;
  DISCORD_WEBHOOK_URL_APTOIDE_VNG: string;
  GITHUB_REPO_OWNER: string;
  GITHUB_REPO_NAME: string;
  VERSION_FILE_PATH: string;
  GITHUB_BRANCH: string;
}

// Get current version from both Aptoide URLs
async function getAptoideVersions(): Promise<{ aptoideVersion: string, aptoideVngVersion: string }> {
  const fetchVersion = async (url: string): Promise<string> => {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const html = await res.text();
    console.log(`HTML from ${url}:`, html); // Log the HTML for inspection
    const match = html.match(/(\d+\.\d+\.\d+(?:\.\d+)?)/);
    return match?.[1]?.trim() || "Unknown";
  };

  const aptoideVersion = await fetchVersion("https://roblox.en.aptoide.com/app");
  const aptoideVngVersion = await fetchVersion("https://roblox-vng.en.aptoide.com/app");

  return { aptoideVersion, aptoideVngVersion };
}

// Get current version from GitHub repo (version.txt)
async function getGitVersion(): Promise<{ version: string, sha: string }> {
  const url = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${VERSION_FILE_PATH}?ref=${GITHUB_BRANCH}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "User-Agent": "AptoideMonitor/1.0"
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.log("GitHub request failed:", res.status, errorText); // Log the error response
    throw new Error(`Failed to fetch version.txt from GitHub: ${res.status} - ${errorText}`);
  }

  const json = await res.json();
  const content = atob(json.content);
  return { version: content.trim(), sha: json.sha };
}

// Update version.txt on GitHub
async function updateGitVersion(newVersion: string, sha: string) {
  const url = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${VERSION_FILE_PATH}`;

  const body = {
    message: `Update version to ${newVersion}`,
    content: btoa(newVersion + "\n"),
    sha,
    branch: GITHUB_BRANCH,
  };

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "AptoideMonitor/1.0"
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.log("GitHub update failed:", res.status, text); // Log the failure message
    throw new Error(`Failed to update version.txt: ${res.status} - ${text}`);
  }

  console.log("Successfully updated version.txt on GitHub."); // Log success
}

// Send notification to Discord with different webhooks based on version source
async function sendDiscord(version: string, oldVersion: string, webhookUrl: string) {
  const embed = {
    title: "Roblox Android Version Updated!",
    color: 0x00ff00,
    fields: [
      { name: "New Version", value: `\`${version}\``, inline: true },
      { name: "Old Version", value: `\`${oldVersion}\``, inline: true }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: "AptoideMonitor" }
  };

  const discordResponse = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: "New Roblox update detected!",
      embeds: [embed]
    }),
  });

  console.log("Discord response status:", discordResponse.status); // Log the Discord response
  const discordBody = await discordResponse.text();
  console.log("Discord response body:", discordBody); // Log the Discord response body
}

// Main handler
async function handleRequest(): Promise<Response> {
  try {
    const { aptoideVersion, aptoideVngVersion } = await getAptoideVersions();
    const { version: gitVersion, sha } = await getGitVersion();

    console.log("Aptoide Version:", aptoideVersion); // Log Aptoide version
    console.log("Aptoide VNG Version:", aptoideVngVersion); // Log Aptoide VNG version
    console.log("GitHub Version:", gitVersion); // Log GitHub version

    let updated = false;

    // Define the webhook URLs from environment variables
    const aptoideWebhookUrl = DISCORD_WEBHOOK_URL_APTOIDE; // First Aptoide URL webhook from environment
    const aptoideVngWebhookUrl = DISCORD_WEBHOOK_URL_APTOIDE_VNG; // Second Aptoide URL webhook from environment

    // Check and update the Aptoide version
    if (aptoideVersion !== "Unknown" && aptoideVersion !== gitVersion) {
      console.log("Updating Aptoide version...");
      await sendDiscord(aptoideVersion, gitVersion, aptoideWebhookUrl);
      await updateGitVersion(aptoideVersion, sha);
      updated = true;
    }

    // Check and update the Aptoide VNG version
    if (aptoideVngVersion !== "Unknown" && aptoideVngVersion !== gitVersion) {
      console.log("Updating Aptoide VNG version...");
      await sendDiscord(aptoideVngVersion, gitVersion, aptoideVngWebhookUrl);
      await updateGitVersion(aptoideVngVersion, sha);
      updated = true;
    }

    if (updated) {
      return new Response(`Updated version(s) to Aptoide: ${aptoideVersion}, VNG: ${aptoideVngVersion}`, { status: 200 });
    }

    return new Response(`No update. Current version: ${gitVersion}`, { status: 200 });

  } catch (err: any) {
    console.log("Error:", err.message); // Log the error message
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}

addEventListener("fetch", event => {
  event.respondWith(handleRequest());
});
