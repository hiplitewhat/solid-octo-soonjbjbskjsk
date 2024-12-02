addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Lua code to be fetched
  const luaCode = `
  -- Lua script for Roblox
  local players = game:GetService("Players")
  for _, player in pairs(players:GetPlayers()) do
      if player.Character and player.Character:FindFirstChild("Humanoid") then
          player.Character.Humanoid.Health = 100  -- Set health to 100 for all players
      end
  end
  `;

  // HTML content with a button to fetch and display the Lua code
  const htmlContent = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Lua Code for Roblox</title>
      <style>
          body {
              font-family: Arial, sans-serif;
              padding: 20px;
              background-color: #f4f4f4;
          }
          pre {
              background-color: #333;
              color: #fff;
              padding: 10px;
              border-radius: 5px;
              font-family: 'Courier New', monospace;
              white-space: pre-wrap;
              word-wrap: break-word;
              display: none;
          }
          h1 {
              color: #333;
          }
          button {
              padding: 10px 15px;
              font-size: 16px;
              background-color: #007bff;
              color: white;
              border: none;
              border-radius: 5px;
              cursor: pointer;
          }
          button:hover {
              background-color: #0056b3;
          }
      </style>
  </head>
  <body>
      <h1>Lua Code for Roblox</h1>
      <button id="fetchButton">Show Lua Code</button>
      <pre id="luaCode">${luaCode}</pre>

      <script>
          document.getElementById('fetchButton').addEventListener('click', function() {
              // Toggle visibility of Lua code when button is clicked
              const luaCodeElement = document.getElementById('luaCode');
              if (luaCodeElement.style.display === 'none') {
                  luaCodeElement.style.display = 'block';
              } else {
                  luaCodeElement.style.display = 'none';
              }
          });
      </script>
  </body>
  </html>
  `;

  // Return the HTML content
  return new Response(htmlContent, {
    headers: { 'Content-Type': 'text/html' },
  });
}
