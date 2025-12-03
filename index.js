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

// Fetch new IGDB/Twitch token
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

// ======================================================================
// TOKEN ENDPOINT
// ======================================================================
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

// ======================================================================
// SIMPLE GAMES (EXAMPLE)
// ======================================================================
app.get("/games", async (req, res) => {
  try {
    const token = await getValidToken();

    const response = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": CLIENT_ID,
        "Authorization": "Bearer " + token,
        Accept: "application/json",
      },
      body:
        "fields name, first_release_date, cover.url; limit 10;",
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

// ======================================================================
// IMPROVED SEARCH ENDPOINT (FIXED FOR MULTI-WORD TYPING)
// ======================================================================
app.post("/searchGames", async (req, res) => {
  try {
    const rawQuery = req.query.query ?? "";
    const query = rawQuery.trim();

    if (query.length === 0) {
      return res.json([]);
    }

    const token = await getValidToken();

    // Multi-word fuzzy search (fixes "rocket leag")
    const processed = query.split(" ").join("*");

    const body = `
      search "${processed}";
      where name ~ *"${query}"*;
      fields name, summary, first_release_date, cover.url;
      limit 20;
    `;

    const response = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": CLIENT_ID,
        "Authorization": "Bearer " + token,
        Accept: "application/json",
      },
      body: body,
    });

    const json = await response.json();
    res.json(json);
  } catch (err) {
    res.status(500).json({
      error: "Failed to search games",
      details: err.toString(),
    });
  }
});

// ======================================================================
// HOME PAGE ENDPOINTS
// ======================================================================

// Top Daily
app.get("/home/topDaily", async (req, res) => {
  try {
    const token = await getValidToken();

    const body = `
      fields name, cover.url, rating, first_release_date;
      sort rating desc;
      limit 20;
    `;

    const response = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": CLIENT_ID,
        "Authorization": "Bearer " + token,
        Accept: "application/json",
      },
      body: body,
    });

    res.json(await response.json());
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch topDaily", details: err.toString() });
  }
});

// Top This Year
app.get("/home/topThisYear", async (req, res) => {
  try {
    const token = await getValidToken();

    const currentYear = new Date().getFullYear();
    const start = new Date(currentYear, 0, 1).getTime() / 1000;
    const end = new Date(currentYear, 11, 31).getTime() / 1000;

    const body = `
      fields name, cover.url, rating, first_release_date;
      where first_release_date >= ${start} & first_release_date <= ${end};
      sort rating desc;
      limit 20;
    `;

    const response = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": CLIENT_ID,
        "Authorization": "Bearer " + token,
        Accept: "application/json",
      },
      body: body,
    });

    res.json(await response.json());
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch this year list", details: err.toString() });
  }
});

// Anticipated
app.get("/home/anticipated", async (req, res) => {
  try {
    const token = await getValidToken();

    const now = Math.floor(Date.now() / 1000);

    const body = `
      fields name, cover.url, first_release_date;
      where first_release_date > ${now};
      sort first_release_date asc;
      limit 20;
    `;

    const response = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": CLIENT_ID,
        "Authorization": "Bearer " + token,
        Accept: "application/json",
      },
      body: body,
    });

    res.json(await response.json());
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch anticipated games", details: err.toString() });
  }
});

// ======================================================================
app.listen(port, () => {
  console.log("IGDB backend running on port " + port);
});
