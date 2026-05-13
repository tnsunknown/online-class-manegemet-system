const { cmd } = require('../command');
const axios = require('axios');

const tvSession = new Map();

console.log('📺 TV SERIES PLUGIN LOADED ✅');

// ============================================================
// 📺 TV SEARCH
// ============================================================
cmd({
    pattern: 'tv',
    desc: 'TV Series downloader',
    category: 'download'
}, async (conn, mek, m, { from, args, reply }) => {

    if (!args.length) return reply('❌ Usage: .tv good girl');

    const query = args.join(' ');
    const searchUrl = `https://cine-fix-tv.vercel.app/api/search?q=${encodeURIComponent(query)}`;

    try {
        const res = await axios.get(searchUrl, { timeout: 15000 });
        const data = res.data;

        if (!data?.results?.length) {
            return reply('❌ No TV series found');
        }

        let text = `📺 *TV SERIES RESULTS*\n\n`;
        text += `Query: *${query}*\n\nReply number:\n\n`;

        data.results.forEach((tv, i) => {
            text += `*${i + 1}.* 📺 ${tv.title}\n`;
            text += `⭐ ${tv.rating || 'N/A'} | ${tv.season_status || 'Unknown'}\n\n`;
        });

        await conn.sendMessage(from, { text }, { quoted: mek });

        tvSession.set(from, {
            stage: 'select_series',
            results: data.results
        });

    } catch (e) {
        reply('❌ Search failed');
    }
});


// ============================================================
// 📥 SESSION HANDLER
// ============================================================
cmd({
    on: 'body'
}, async (conn, mek, m, { from, body, reply }) => {

    if (!tvSession.has(from)) return;

    const session = tvSession.get(from);
    const input = body.trim();

    if (input.toLowerCase() === 'done') {
        tvSession.delete(from);
        return reply('✅ TV session ended');
    }

    const num = parseInt(input);
    if (isNaN(num)) return;

    // ========================================================
    // 🎯 SELECT SERIES
    // ========================================================
    if (session.stage === 'select_series') {

        const series = session.results[num - 1];
        if (!series) return reply('❌ Invalid number');

        await reply(`📺 Loading episodes for *${series.title}*...`);

        // 🔥 fetch full episode scraper
        const epUrl = `https://cine-fix.vercel.app/api/scrape/?url=${encodeURIComponent(series.url)}`;

        const res = await axios.get(epUrl, { timeout: 20000 });
        const data = res.data?.result;

        if (!data?.episodes?.length) {
            return reply('❌ Episodes not found');
        }

        let text = `📺 *${series.title}*\n\n`;
        text += `Select Episode:\n\n`;

        data.episodes.forEach((ep, i) => {
            text += `*${i + 1}.* 🎬 S${ep.season}E${ep.episode}\n`;
        });

        await conn.sendMessage(from, { text }, { quoted: mek });

        tvSession.set(from, {
            stage: 'select_episode',
            series,
            episodes: data.episodes
        });
    }


    // ========================================================
    // 🎯 SELECT EPISODE
    // ========================================================
    else if (session.stage === 'select_episode') {

        const ep = session.episodes[num - 1];
        if (!ep) return reply('❌ Invalid episode');

        let text = `🎬 *S${ep.season}E${ep.episode}*\n\nSelect Quality:\n\n`;
        text += `1️⃣ 480p\n2️⃣ 720p\n3️⃣ 1080p\n`;

        await conn.sendMessage(from, { text }, { quoted: mek });

        tvSession.set(from, {
            stage: 'select_quality',
            episode: ep
        });
    }


    // ========================================================
    // 🎯 SELECT QUALITY → DOWNLOAD
    // ========================================================
    else if (session.stage === 'select_quality') {

        const map = {
            1: '480p',
            2: '720p',
            3: '1080p'
        };

        const quality = map[num];
        if (!quality) return reply('❌ Reply 1/2/3');

        const ep = session.episode;

        const link = ep.download_links.find(d => d.quality === quality);

        if (!link) {
            return reply('❌ Quality not available');
        }

        await reply(`⬇️ Downloading S${ep.season}E${ep.episode} (${quality})...`);

        // 🔥 DIRECT PROXY DOWNLOAD URL
        const fileUrl = link.proxy_url;

        await conn.sendMessage(from, {
            document: { url: fileUrl },
            mimetype: 'video/mp4',
            fileName: `S${ep.season}E${ep.episode} (${quality}).mp4`,
            caption: `📺 Episode Downloaded\n🎬 S${ep.season}E${ep.episode}\n📹 ${quality}`
        }, { quoted: mek });

        // reset back to episode list (multi download support)
        tvSession.set(from, {
            stage: 'select_episode',
            episodes: session.episodes,
            series: session.series
        });
    }
});
