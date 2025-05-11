interface Env {
  GITHUB_TOKEN: string;
  DISCORD_WEBHOOK_URL: string;
  GITHUB_REPO_OWNER: string;
  GITHUB_REPO_NAME: string;
  VERSION_FILE_PATH: string;
  GITHUB_BRANCH: string;
}

// Get current version from Aptoide
async function getAptoideVersion(): Promise<string> {
  const res = await fetch("https://roblox.en.aptoide.com/app", {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  const html = await res.text();
  const match = html.match(/(\d+\.\d+\.\d+(?:\.\d+)?)/);
  return match?.[1]?.trim() || "Unknown";
}

// Get current version from GitHub repo (version.txt)
async function getGitVersion(): Promise<{ version: string, sha: string }> {
  const url = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${VERSION_FILE_PATH}?ref=${GITHUB_BRANCH}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}` },
  });

  if (!res.ok) throw new Error("Failed to fetch version.txt from GitHub");

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
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update version.txt: ${text}`);
  }
}

// Send notification to Discord
async function sendDiscord(version: string, oldVersion: string) {
  const embed = {
    title: "Roblox Android Version Updated!",
    color: 0x00ff00,
    fields: [
      { name: "New Version", value: `\`${version}\``, inline: true },
      { name: "Old Version", value: `\`${oldVersion}\``, inline: true }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: "Aptoide Monitor" }
  };

  await fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: "New Roblox update detected!", embeds: [embed] }),
  });
}

// Main handler
async function handleRequest(): Promise<Response> {
  try {
    const aptVersion = await getAptoideVersion();
    const { version: gitVersion, sha } = await getGitVersion();

    if (aptVersion !== "Unknown" && aptVersion !== gitVersion) {
      await sendDiscord(aptVersion, gitVersion);
      await updateGitVersion(aptVersion, sha);
      return new Response(`Updated version to ${aptVersion}`, { status: 200 });
    }

    return new Response(`No update. Current version: ${gitVersion}`, { status: 200 });

  } catch (err: any) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}

addEventListener("fetch", event => {
  event.respondWith(handleRequest());
});
