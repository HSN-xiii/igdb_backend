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

// =========================================================
// GET /token
// =========================================================
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

// =========================================================
// GET /games
// =========================================================
app.get("/games", async (req, res) => {
  try {
    const token = await getValidToken();

    const response = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": CLIENT_ID,
        Authorization: "Bearer " + token,
        Accept: "application/json",
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

// =========================================================
// POST /searchGames
// =========================================================
app.post("/searchGames", async (req, res) => {
  try {
    const query = req.query.query;
    if (!query || query.trim().length === 0) {
      return res.json([]);
    }

    const token = await getValidToken();

    const body = `
  search "${query}";
  fields id, name, summary, first_release_date, cover.image_id;
  limit 20;
`;


    const response = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": CLIENT_ID,
        Authorization: "Bearer " + token,
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

// =========================================================
// HOME PAGE ENDPOINTS
// =========================================================

// GET /home/topDaily
app.get("/home/topDaily", async (req, res) => {
  try {
    const token = await getValidToken();
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 24 * 3600;

    const body = `
      where first_release_date > ${thirtyDaysAgo} & total_rating > 60;
      fields id, name, cover.image_id, first_release_date, total_rating, total_rating_count;
      sort total_rating_count desc;
      limit 10;
    `;

    const response = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": CLIENT_ID,
        Authorization: "Bearer " + token,
        Accept: "application/json",
      },
      body,
    });

    const json = await response.json();
    res.json(json);
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch topDaily",
      details: err.toString(),
    });
  }
});

// GET /home/topThisYear
app.get("/home/topThisYear", async (req, res) => {
  try {
    const token = await getValidToken();
    const startOfYear = Math.floor(
      new Date(new Date().getFullYear(), 0, 1).getTime() / 1000
    );

    const body = `
      where first_release_date > ${startOfYear} & total_rating > 60;
      fields id, name, cover.image_id, first_release_date, total_rating, total_rating_count;
      sort total_rating_count desc;
      limit 10;
    `;

    const response = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": CLIENT_ID,
        Authorization: "Bearer " + token,
        Accept: "application/json",
      },
      body,
    });

    const json = await response.json();
    res.json(json);
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch topThisYear",
      details: err.toString(),
    });
  }
});

// GET /home/anticipated
app.get("/home/anticipated", async (req, res) => {
  try {
    const token = await getValidToken();
    const now = Math.floor(Date.now() / 1000);

    const body = `
      where first_release_date > ${now};
      fields id, name, cover.image_id, first_release_date, hypes;
      sort hypes desc;
      limit 10;
    `;

    const response = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": CLIENT_ID,
        Authorization: "Bearer " + token,
        Accept: "application/json",
      },
      body,
    });

    const json = await response.json();
    res.json(json);
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch anticipated",
      details: err.toString(),
    });
  }
});

// =========================================================
// GET /game/:id  (FULL GAME PROFILE)
// =========================================================
app.get("/game/:id", async (req, res) => {
  try {
    const token = await getValidToken();
    const id = req.params.id;

    const body = `
      where id = ${id};
      fields
        id,
        name,
        summary,
        storyline,
        total_rating,
        total_rating_count,
        first_release_date,
        age_ratings.rating,
        genres.name,
        platforms.name,
        cover.image_id,
        screenshots.image_id;
      limit 1;
    `;

    const response = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": CLIENT_ID,
        Authorization: "Bearer " + token,
        Accept: "application/json",
      },
      body,
    });

    const json = await response.json();
    if (!json || !json.length) return res.json({});

    res.json(json[0]);
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch game details",
      details: err.toString(),
    });
  }
});

app.listen(port, () => {
  console.log("IGDB backend running on port " + port);
});
