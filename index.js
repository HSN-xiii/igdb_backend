import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors()); // Allow Flutter Web

const port = process.env.PORT || 8080;

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

let cachedToken = null;
let expiresAt = 0;

// Fetch a new IGDB/Twitch access token
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

// Return cached token if still valid
async function getValidToken() {
  if (cachedToken && Date.now() < expiresAt) {
    return cachedToken;
  }
  return fetchToken();
}

// ---------------------------------------------------------------------------
// GET /token → Flutter uses this only to verify backend works (optional)
// ---------------------------------------------------------------------------
app.get("/token", async (req, res) => {
  try {
    const token = await getValidToken();
    res.json({ access_token: token });
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch token",
      details: err.toString(),
    });
  }
});

// ---------------------------------------------------------------------------
// GET /games → Flutter calls THIS instead of calling IGDB directly
// ---------------------------------------------------------------------------
app.get("/games", async (req, res) => {
  try {
    const token = await getValidToken();

    const response = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": CLIENT_ID,
        "Authorization": "Bearer " + token,
        "Accept": "application/json",
      },
      body: "fields name, first_release_date, cover.url; limit 10;",
    });

    const json = await response.json();

    res.json(json);
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch games",
      details: err.toString(),
    });
  }
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(port, () => {
  console.log("IGDB backend running on port " + port);
});
