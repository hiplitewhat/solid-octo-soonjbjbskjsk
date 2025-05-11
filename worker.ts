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
    const match = html.match(/(\d+\.\d+\.\d+(?:\.\d+)?)/);
    return match?.[1]?.trim() || "Unknown";
  };

  const aptoideVersion = await fetchVersion("https://roblox.en.aptoide.com/app");
  const aptoideVngVersion = await fetchVersion("https://roblox-vng.en.aptoide.com/app");

  return { aptoideVersion, aptoideVngVersion };
}

// Get current version from GitHub repo (version.txt)
async function getGitVersion(): Promise<{ aptoideVersion: string, aptoideVngVersion: string, sha: string }> {
  const url = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${VERSION_FILE_PATH}?ref=${GITHUB_BRANCH}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "User-Agent": "AptoideMonitor/1.0"
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch version.txt from GitHub: ${res.status} - ${errorText}`);
  }

  const json = await res.json();
  const content = atob(json.content);

  // Parse the content into individual versions (Aptoide and Aptoide VNG)
  const versions = content.split("\n").reduce((acc: { aptoideVersion: string, aptoideVngVersion: string }, line) => {
    const [key, value] = line.split(":");
    if (key && value) {
      acc[key.trim()] = value.trim();
    }
    return acc;
  }, { aptoideVersion: "Unknown", aptoideVngVersion: "Unknown" });

  return { ...versions, sha: json.sha };
}

// Update version.txt on GitHub
async function updateGitVersion(newAptoideVersion: string, newAptoideVngVersion: string, sha: string) {
  const url = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${VERSION_FILE_PATH}`;

  const body = {
    message: `Update version to Aptoide: ${newAptoideVersion}, Aptoide VNG: ${newAptoideVngVersion}`,
    content: btoa(`Aptoide Version: ${newAptoideVersion}\nAptoide VNG Version: ${newAptoideVngVersion}\n`),
    sha,
    branch: GITHUB_BRANCH,
  };

  let res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "AptoideMonitor/1.0"
    },
    body: JSON.stringify(body),
  });

  if (res.status === 409) {
    // If there's a 409 error, refetch the SHA and try again
    const { sha: latestSha } = await getGitVersion(); // Fetch the latest SHA
    body.sha = latestSha; // Update the body with the new SHA

    res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "AptoideMonitor/1.0"
      },
      body: JSON.stringify(body),
    });
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update version.txt: ${res.status} - ${text}`);
  }
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

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: "New Roblox update detected!",
      embeds: [embed]
    }),
  });
}

// Main handler
async function handleRequest(): Promise<Response> {
  try {
    const { aptoideVersion, aptoideVngVersion } = await getAptoideVersions();
    const { aptoideVersion: gitAptoideVersion, aptoideVngVersion: gitAptoideVngVersion, sha } = await getGitVersion();

    let updated = false;

    // Define the webhook URLs from environment variables
    const aptoideWebhookUrl = DISCORD_WEBHOOK_URL_APTOIDE; // First Aptoide URL webhook from environment
    const aptoideVngWebhookUrl = DISCORD_WEBHOOK_URL_APTOIDE_VNG; // Second Aptoide URL webhook from environment

    // Check and update the Aptoide version
    if (aptoideVersion !== "Unknown" && aptoideVersion !== gitAptoideVersion) {
      await sendDiscord(aptoideVersion, gitAptoideVersion, aptoideWebhookUrl);
      updated = true;
    }

    // Check and update the Aptoide VNG version
    if (aptoideVngVersion !== "Unknown" && aptoideVngVersion !== gitAptoideVngVersion) {
      await sendDiscord(aptoideVngVersion, gitAptoideVngVersion, aptoideVngWebhookUrl);
      updated = true;
    }

    if (updated) {
      // Update the version.txt file with both versions
      await updateGitVersion(aptoideVersion, aptoideVngVersion, sha);
      return new Response(`Updated versions: Aptoide ${aptoideVersion}, VNG ${aptoideVngVersion}`, { status: 200 });
    }

    return new Response(`No update. Current versions: Aptoide ${gitAptoideVersion}, VNG ${gitAptoideVngVersion}`, { status: 200 });

  } catch (err: any) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}

addEventListener("fetch", event => {
  event.respondWith(handleRequest());
});
