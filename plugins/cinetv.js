const axios = require("axios");

const sessions = {}; 
// user state store (jid based)

const SEARCH_API = "https://YOUR-SEARCH-API/search?query=";
const SCRAPE_API =
  "https://cine-tv-fix.netlify.app/.netlify/functions/scrape?url=";

// ===============================
// 1. MAIN COMMAND
// ===============================
module.exports = async (m, sock, text) => {
  const jid = m.key.remoteJid;

  if (!sessions[jid]) sessions[jid] = {};

  // ===============================
  // STEP 1: SEARCH SERIES
  // ===============================
  if (text.startsWith(".tv ")) {
    const query = text.replace(".tv ", "").trim();

    const res = await axios.get(SEARCH_API + encodeURIComponent(query));
    const results = res.data.results;

    sessions[jid] = { step: "search", results };

    let msg = "🎬 *Search Results*\n\n";

    results.forEach((r, i) => {
      msg += `${i + 1}. ${r.title}\n`;
    });

    msg += "\nReply with number to select series";

    return sock.sendMessage(jid, { text: msg });
  }

  // ===============================
  // STEP 2: SELECT SERIES
  // ===============================
  if (sessions[jid]?.step === "search") {
    const index = parseInt(text) - 1;
    const series = sessions[jid].results[index];

    if (!series) return sock.sendMessage(jid, { text: "Invalid selection" });

    const scrapeUrl = SCRAPE_API + encodeURIComponent(series.url);

    const data = await axios.get(scrapeUrl);
    const result = data.data.result;

    sessions[jid] = {
      step: "series",
      series,
      result,
    };

    let msg = `📺 *${series.title}*\n\nSelect Season:\n`;

    const seasons = [...new Set(result.episodes.map(e => e.season))];

    seasons.forEach((s, i) => {
      msg += `${i + 1}. Season ${s}\n`;
    });

    msg += `\n0. Download ALL Episodes`;

    return sock.sendMessage(jid, { text: msg });
  }

  // ===============================
  // STEP 3: SEASON SELECT
  // ===============================
  if (sessions[jid]?.step === "series") {
    const { result } = sessions[jid];

    if (text === "0") {
      sessions[jid].step = "all_download";

      return sock.sendMessage(jid, {
        text: "⚡ Select quality for ALL episodes: 480 / 720 / 1080",
      });
    }

    const seasons = [...new Set(result.episodes.map(e => e.season))];
    const season = seasons[parseInt(text) - 1];

    if (!season) return sock.sendMessage(jid, { text: "Invalid season" });

    const eps = result.episodes.filter(e => e.season === season);

    sessions[jid] = {
      step: "episode",
      season,
      eps,
    };

    let msg = `🎬 Season ${season}\n\nSelect Episode:\n`;

    eps.forEach((e, i) => {
      msg += `${i + 1}. Episode ${e.episode}\n`;
    });

    msg += `\n0. Download ALL episodes in this season`;

    return sock.sendMessage(jid, { text: msg });
  }

  // ===============================
  // STEP 4: EPISODE SELECT
  // ===============================
  if (sessions[jid]?.step === "episode") {
    const { eps } = sessions[jid];

    if (text === "0") {
      sessions[jid].step = "season_all_quality";

      return sock.sendMessage(jid, {
        text: "Select quality for ALL episodes in season (480 / 720 / 1080)",
      });
    }

    const ep = eps[parseInt(text) - 1];
    if (!ep) return sock.sendMessage(jid, { text: "Invalid episode" });

    sessions[jid] = {
      step: "quality",
      ep,
    };

    return sock.sendMessage(jid, {
      text: `Episode ${ep.episode}\n\nSelect quality:\n480\n720\n1080`,
    });
  }

  // ===============================
  // STEP 5: SINGLE EPISODE DOWNLOAD
  // ===============================
  if (sessions[jid]?.step === "quality") {
    const { ep } = sessions[jid];

    const link = ep.download_links.find(l => l.quality === text);

    if (!link)
      return sock.sendMessage(jid, { text: "Invalid quality" });

    await sock.sendMessage(jid, {
      video: { url: link.direct_url },
      caption: `Episode ${ep.episode} - ${text}`,
    });

    delete sessions[jid];
  }

  // ===============================
  // STEP 6: ALL EPISODES DOWNLOAD (SEASON)
  // ===============================
  if (sessions[jid]?.step === "season_all_quality") {
    const quality = text;

    const { eps } = sessions[jid];

    for (const ep of eps) {
      const link = ep.download_links.find(l => l.quality === quality);
      if (!link) continue;

      await sock.sendMessage(jid, {
        video: { url: link.direct_url },
        caption: `Episode ${ep.episode} - ${quality}`,
      });
    }

    delete sessions[jid];
  }

  // ===============================
  // STEP 7: ALL SERIES ALL EPISODES
  // ===============================
  if (sessions[jid]?.step === "all_download") {
    const quality = text;
    const { result } = sessions[jid];

    for (const ep of result.episodes) {
      const link = ep.download_links.find(l => l.quality === quality);
      if (!link) continue;

      await sock.sendMessage(jid, {
        video: { url: link.direct_url },
        caption: `S${ep.season}E${ep.episode} - ${quality}`,
      });
    }

    delete sessions[jid];
  }
};
