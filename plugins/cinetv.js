const axios = require("axios");

const sessions = {};

const SEARCH_API =
  "https://cine-fix-tv.vercel.app/api/search?q=";

const SCRAPE_API =
  "https://cine-tv-fix.netlify.app/.netlify/functions/scrape?url=";

// =========================
// MAIN HANDLER
// =========================
module.exports = async (m, sock, text) => {
  const jid = m.key.remoteJid;

  if (!sessions[jid]) sessions[jid] = {};

  console.log("━━━━━━━━━━━━━━━━━━━━");
  console.log("📩 MESSAGE RECEIVED:", text);
  console.log("👤 USER:", jid);
  console.log("📊 SESSION:", sessions[jid]);
  console.log("━━━━━━━━━━━━━━━━━━━━");

  // =========================
  // STEP 1: SEARCH
  // =========================
  if (text.startsWith(".tv ")) {
    const query = text.replace(".tv ", "").trim();

    console.log("🔍 SEARCH QUERY:", query);

    const res = await axios.get(SEARCH_API + encodeURIComponent(query));

    console.log("📦 SEARCH RESPONSE:", JSON.stringify(res.data, null, 2));

    const results = res.data.results;

    sessions[jid] = {
      step: "search",
      results,
    };

    let msg = `🎬 *SEARCH RESULTS*\n\n`;

    results.forEach((r, i) => {
      console.log(`➡️ RESULT ${i + 1}:`, r.title);

      msg += `${i + 1}. ${r.title}\n`;
      msg += `⭐ Rating: ${r.rating || "N/A"}\n\n`;
    });

    msg += "Reply number to select series";

    return sock.sendMessage(jid, { text: msg });
  }

  // =========================
  // STEP 2: SELECT SERIES
  // =========================
  if (sessions[jid]?.step === "search") {
    const index = parseInt(text) - 1;
    const series = sessions[jid].results[index];

    console.log("🎯 SELECTED INDEX:", index);
    console.log("📺 SELECTED SERIES:", series);

    if (!series) {
      console.log("❌ INVALID SERIES SELECT");
      return sock.sendMessage(jid, { text: "Invalid selection" });
    }

    const scrapeUrl = SCRAPE_API + encodeURIComponent(series.url);

    console.log("🌐 SCRAPE URL:", scrapeUrl);

    const data = await axios.get(scrapeUrl);

    console.log("📦 SCRAPE RESPONSE:", JSON.stringify(data.data, null, 2));

    const result = data.data.result;

    sessions[jid] = {
      step: "series",
      series,
      result,
    };

    const seasons = [
      ...new Set(result.episodes.map((e) => e.season)),
    ];

    console.log("📚 AVAILABLE SEASONS:", seasons);

    let msg = `📺 *${series.title}*\n\n`;

    seasons.forEach((s, i) => {
      msg += `${i + 1}. Season ${s}\n`;
    });

    msg += `\n0. Download ALL Episodes`;

    return sock.sendMessage(jid, { text: msg });
  }

  // =========================
  // STEP 3: SEASON SELECT
  // =========================
  if (sessions[jid]?.step === "series") {
    const { result } = sessions[jid];

    if (text === "0") {
      console.log("⚡ ALL SERIES DOWNLOAD SELECTED");

      sessions[jid].step = "all_download";

      return sock.sendMessage(jid, {
        text: "Select quality: 480 / 720 / 1080",
      });
    }

    const seasons = [...new Set(result.episodes.map((e) => e.season))];
    const season = seasons[parseInt(text) - 1];

    console.log("🎬 SELECTED SEASON:", season);

    if (!season) {
      console.log("❌ INVALID SEASON");
      return sock.sendMessage(jid, { text: "Invalid season" });
    }

    const eps = result.episodes.filter((e) => e.season === season);

    console.log("📺 EPISODES IN SEASON:", eps.length);

    sessions[jid] = {
      step: "episode",
      season,
      eps,
    };

    let msg = `🎬 Season ${season}\n\n`;

    eps.forEach((e, i) => {
      console.log(`🎞 Episode ${i + 1}:`, e.episode);

      msg += `${i + 1}. Episode ${e.episode}\n`;
    });

    msg += `\n0. Download ALL episodes`;

    return sock.sendMessage(jid, { text: msg });
  }

  // =========================
  // STEP 4: EPISODE SELECT
  // =========================
  if (sessions[jid]?.step === "episode") {
    const { eps } = sessions[jid];

    if (text === "0") {
      console.log("⚡ SEASON BULK DOWNLOAD SELECTED");

      sessions[jid].step = "season_all_quality";

      return sock.sendMessage(jid, {
        text: "Select quality for all episodes: 480 / 720 / 1080",
      });
    }

    const ep = eps[parseInt(text) - 1];

    console.log("🎯 SELECTED EPISODE:", ep);

    if (!ep) {
      console.log("❌ INVALID EPISODE");
      return sock.sendMessage(jid, { text: "Invalid episode" });
    }

    sessions[jid] = {
      step: "quality",
      ep,
    };

    return sock.sendMessage(jid, {
      text: `Episode ${ep.episode}\nSelect quality:\n480\n720\n1080`,
    });
  }

  // =========================
  // STEP 5: SINGLE EPISODE DOWNLOAD
  // =========================
  if (sessions[jid]?.step === "quality") {
    const { ep } = sessions[jid];

    console.log("🎥 QUALITY SELECT:", text);

    const link = ep.download_links.find((l) => l.quality === text);

    console.log("🔗 FOUND LINK:", link);

    if (!link) {
      console.log("❌ INVALID QUALITY");
      return sock.sendMessage(jid, { text: "Invalid quality" });
    }

    await sock.sendMessage(jid, {
      video: { url: link.direct_url },
      caption: `Episode ${ep.episode} - ${text}`,
    });

    console.log("✅ SENT VIDEO");

    delete sessions[jid];
  }

  // =========================
  // STEP 6: ALL EPISODES IN SEASON
  // =========================
  if (sessions[jid]?.step === "season_all_quality") {
    const quality = text;

    console.log("📦 SEASON BULK QUALITY:", quality);

    const { eps } = sessions[jid];

    for (const ep of eps) {
      const link = ep.download_links.find((l) => l.quality === quality);

      console.log(`➡️ Episode ${ep.episode} link:`, link?.direct_url);

      if (!link) continue;

      await sock.sendMessage(jid, {
        video: { url: link.direct_url },
        caption: `Episode ${ep.episode} - ${quality}`,
      });
    }

    delete sessions[jid];
  }

  // =========================
  // STEP 7: FULL SERIES DOWNLOAD
  // =========================
  if (sessions[jid]?.step === "all_download") {
    const quality = text;

    console.log("🔥 FULL SERIES DOWNLOAD:", quality);

    const { result } = sessions[jid];

    for (const ep of result.episodes) {
      const link = ep.download_links.find((l) => l.quality === quality);

      console.log(`🎬 S${ep.season}E${ep.episode}`, link?.direct_url);

      if (!link) continue;

      await sock.sendMessage(jid, {
        video: { url: link.direct_url },
        caption: `S${ep.season}E${ep.episode} - ${quality}`,
      });
    }

    delete sessions[jid];
  }
};
