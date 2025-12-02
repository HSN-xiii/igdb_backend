import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors()); // <-- ALLOW FLUTTER WEB

const port = process.env.PORT || 8080;

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

let cachedToken = null;
let expiresAt = 0;

async function fetchToken() {
  const response = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`,
    { method: "POST" }
  );

  const json = await response.json();

  cachedToken = json.access_token;
  expiresAt = Date.now() + (json.expires_in - 60) * 1000;

  return cachedToken;
}

async function getValidToken() {
  if (cachedToken && Date.now() < expiresAt) {
    return cachedToken;
  }
  return fetchToken();
}

app.get("/token", async (req, res) => {
  try {
    const token = await getValidToken();
    res.json({ access_token: token });
  } catch {
    res.status(500).json({ error: "Failed to fetch token" });
  }
});

app.listen(port, () => {
  console.log("IGDB backend running on port " + port);
});
