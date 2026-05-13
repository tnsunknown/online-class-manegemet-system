const { cmd } = require('../command');
const axios = require('axios');

const session = new Map();

console.log('📺 TV BOT LOADED ✅');

// ============================================================
// 📺 TV SEARCH COMMAND
// ============================================================
cmd({
    pattern: 'tv',
    desc: 'TV Series downloader',
    category: 'download'
}, async (conn, mek, m, { from, args, reply }) => {

    if (!args.length) return reply('❌ Usage: .tv good girl');

    const query = args.join(' ');

    try {
        const searchUrl = `https://cine-fix-tv.vercel.app/api/search?q=${encodeURIComponent(query)}`;
        const res = await axios.get(searchUrl, { timeout: 15000 });

        const data = res.data?.results;

        if (!data || !data.length) {
            return reply('❌ No TV series found');
        }

        let text = `📺 *TV SERIES RESULTS*\n\n`;
        text += `🔎 Query: *${query}*\n\n`;

        data.forEach((tv, i) => {
            text += `*${i + 1}.* 📺 ${tv.title}\n`;
            text += `⭐ ${tv.rating || 'N/A'} | ${tv.season_status || ''}\n\n`;
        });

        text += `_Reply number to select series_\n_Reply "done" to cancel_`;

        await conn.sendMessage(from, { text }, { quoted: mek });

        session.set(from, {
            stage: 'select_series',
            results: data
        });

    } catch (e) {
        console.log(e.message);
        reply('❌ Search failed');
    }
});


// ============================================================
// 🎯 MESSAGE HANDLER (SESSION)
// ============================================================
cmd({
    on: 'body'
}, async (conn, mek, m, { from, body, reply }) => {

    if (!session.has(from)) return;

    const s = session.get(from);
    const input = body.trim();

    if (input.toLowerCase() === 'done') {
        session.delete(from);
        return reply('✅ TV session ended');
    }

    const num = parseInt(input);
    if (isNaN(num)) return;

    // ========================================================
    // 🎬 SELECT SERIES
    // ========================================================
    if (s.stage === 'select_series') {

        const series = s.results[num - 1];
        if (!series) return reply('❌ Invalid number');

        await reply(`📺 Loading episodes...\n🎬 *${series.title}*`);

        try {
            const api = `https://cine-tv-fix.netlify.app/.netlify/functions/scrape?url=${encodeURIComponent(series.url)}`;
            const res = await axios.get(api, {
                timeout: 20000,
                headers: { "User-Agent": "Mozilla/5.0" }
            });

            const episodes = res.data?.result?.episodes;

            if (!episodes || !episodes.length) {
                return reply('❌ Episodes not found');
            }

            let text = `📺 *${series.title}*\n\n🎬 Select Episode:\n\n`;

            episodes.forEach((ep, i) => {
                text += `*${i + 1}.* S${ep.season}E${ep.episode}\n`;
            });

            text += `\n_Reply number to select episode_`;

            await conn.sendMessage(from, { text }, { quoted: mek });

            session.set(from, {
                stage: 'select_episode',
                series,
                episodes
            });

        } catch (e) {
            console.log(e.message);
            reply('❌ Failed to load episodes');
        }
    }


    // ========================================================
    // 🎬 SELECT EPISODE
    // ========================================================
    else if (s.stage === 'select_episode') {

        const ep = s.episodes[num - 1];
        if (!ep) return reply('❌ Invalid episode');

        let text =
`🎬 S${ep.season}E${ep.episode}

📥 Select Quality:
1️⃣ 480p
2️⃣ 720p
3️⃣ 1080p`;

        await conn.sendMessage(from, { text }, { quoted: mek });

        session.set(from, {
            stage: 'select_quality',
            episode: ep
        });
    }


    // ========================================================
    // ⚡ SELECT QUALITY → DOWNLOAD
    // ========================================================
    else if (s.stage === 'select_quality') {

        const map = {
            1: "480p",
            2: "720p",
            3: "1080p"
        };

        const quality = map[num];
        if (!quality) return reply('❌ Reply 1 / 2 / 3');

        const ep = s.episode;

        const link = ep.download_links.find(d => d.quality === quality);

        if (!link) {
            return reply('❌ Quality not available');
        }

        await reply(`⬇️ Downloading S${ep.season}E${ep.episode} (${quality})...`);

        const fileUrl = link.proxy_url; // 🔥 IMPORTANT

        await conn.sendMessage(from, {
            document: { url: fileUrl },
            mimetype: "video/mp4",
            fileName: `S${ep.season}E${ep.episode} (${quality}).mp4`,
            caption:
`📺 TV SERIES DOWNLOAD

🎬 Episode: S${ep.season}E${ep.episode}
📹 Quality: ${quality}

_Powered by Cine TV Bot_`
        }, { quoted: mek });

        // reset to episode stage (multi download support)
        session.set(from, {
            stage: 'select_episode',
            episodes: s.episodes,
            series: s.series
        });
    }
});
