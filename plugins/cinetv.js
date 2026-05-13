const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const sessionMap = new Map();

console.log('📺 TV SERIES PLUGIN LOADED ✅');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// ============================================================
// 🖼️ Thumbnail helper
// ============================================================
async function getThumbnailBuffer(imageUrl) {
    try {
        console.log('🖼️ Fetching thumbnail:', imageUrl);

        const res = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });

        const buf = Buffer.from(res.data);

        const resized = await sharp(buf)
            .resize(320, 320, { fit: 'cover' })
            .jpeg({ quality: 60 })
            .toBuffer();

        console.log('✅ Thumbnail ready:', resized.length, 'bytes');
        return resized;

    } catch (e) {
        console.log('⚠️ Thumbnail error:', e.message);
        return null;
    }
}

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
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 TV SEARCH:', query);

    try {
        const url = `https://cine-fix-tv.vercel.app/api/search?q=${encodeURIComponent(query)}`;
        console.log('🌐 Search API:', url);

        const res = await axios.get(url);
        const data = res.data;

        if (!data?.results?.length) return reply('❌ No results found');

        let text = `📺 *TV SERIES RESULTS*\n🔎 ${query}\n\n`;

        data.results.forEach((s, i) => {
            text += `*${i + 1}.* 📺 ${s.title}\n⭐ ${s.rating || 'N/A'}\n\n`;
        });

        const thumb = await getThumbnailBuffer(data.results[0].poster);

        await conn.sendMessage(from, {
            image: thumb || undefined,
            caption: text
        }, { quoted: mek });

        sessionMap.set(from, {
            stage: 'series_select',
            results: data.results
        });

        console.log('💾 Session: series_select');

    } catch (e) {
        console.log('❌ Search error:', e.message);
        reply('❌ Search failed');
    }
});

// ============================================================
// 🔁 SESSION HANDLER
// ============================================================
cmd({
    on: 'body'
}, async (conn, mek, m, { from, body, reply }) => {

    if (!sessionMap.has(from)) return;

    const session = sessionMap.get(from);
    const input = body.trim();

    if (input.toLowerCase() === 'done') {
        sessionMap.delete(from);
        return reply('✅ Session ended');
    }

    const num = parseInt(input);
    if (isNaN(num)) return;

    // ========================================================
    // 1️⃣ SERIES SELECT
    // ========================================================
    if (session.stage === 'series_select') {

        const series = session.results[num - 1];
        if (!series) return reply('❌ Invalid selection');

        console.log('📺 Selected series:', series.title);

        const api = `https://cine-tv-fix.netlify.app/.netlify/functions/scrape?url=${encodeURIComponent(series.url)}`;
        const res = await axios.get(api);
        const data = res.data.result;

        // group seasons
        const seasons = {};
        data.episodes.forEach(ep => {
            if (!seasons[ep.season]) seasons[ep.season] = [];
            seasons[ep.season].push(ep);
        });

        sessionMap.set(from, {
            stage: 'season_select',
            series,
            seasons
        });

        let msg = `📺 *${series.title}*\n\nSelect Season:\n\n`;
        Object.keys(seasons).forEach((s, i) => {
            msg += `*${i + 1}.* Season ${s}\n`;
        });

        const thumb = await getThumbnailBuffer(series.poster);

        await conn.sendMessage(from, {
            image: thumb || undefined,
            caption: msg
        }, { quoted: mek });

        console.log('💾 Stage: season_select');
    }

    // ========================================================
    // 2️⃣ SEASON SELECT
    // ========================================================
    else if (session.stage === 'season_select') {

        const keys = Object.keys(session.seasons);
        const seasonKey = keys[num - 1];

        if (!seasonKey) return reply('❌ Invalid season');

        const episodes = session.seasons[seasonKey];

        sessionMap.set(from, {
            stage: 'episode_select',
            series: session.series,
            season: seasonKey,
            episodes
        });

        let msg = `📺 *Season ${seasonKey}*\n\nSelect Episode:\n\n`;
        msg += `*0.* 🎬 All Episodes\n\n`;

        episodes.forEach((e, i) => {
            msg += `*${i + 1}.* Episode ${e.episode}\n`;
        });

        await conn.sendMessage(from, { text: msg }, { quoted: mek });

        console.log('💾 Stage: episode_select');
    }

    // ========================================================
    // 3️⃣ EPISODE SELECT
    // ========================================================
    else if (session.stage === 'episode_select') {

        const episodes = session.episodes;

        // ALL EPISODES
        if (num === 0) {

            sessionMap.set(from, {
                stage: 'quality_all',
                episodes,
                series: session.series
            });

            return reply(`🎬 All Episodes selected\n\nReply:\n*1.* 480p\n*2.* 720p\n*3.* 1080p`);
        }

        const ep = episodes[num - 1];
        if (!ep) return reply('❌ Invalid episode');

        sessionMap.set(from, {
            stage: 'quality_single',
            episode: ep,
            series: session.series
        });

        await reply(`📹 Episode ${ep.episode}\n\nSelect quality:\n*1* 480p\n*2* 720p\n*3* 1080p`);
    }

    // ========================================================
    // 4️⃣ QUALITY SINGLE
    // ========================================================
    else if (session.stage === 'quality_single') {

        const map = { 1: 0, 2: 1, 3: 2 };
        const q = ['480p', '720p', '1080p'][map[num]];
        if (!q) return reply('❌ Invalid quality');

        const ep = session.episode;
        const link = ep.download_links.find(d => d.quality === q);

        console.log('⬇️ Download:', ep.episode, q);

        await conn.sendMessage(from, {
            document: { url: link.direct_url },
            mimetype: 'video/mp4',
            fileName: `Episode-${ep.episode}-${q}.mp4`,
            caption: `📺 ${session.series.title}\n🎬 Episode ${ep.episode}\n📹 ${q}`
        }, { quoted: mek });

        sessionMap.delete(from);
    }

    // ========================================================
    // 5️⃣ QUALITY ALL EPISODES
    // ========================================================
    else if (session.stage === 'quality_all') {

        const map = { 1: '480p', 2: '720p', 3: '1080p' };
        const quality = map[num];

        if (!quality) return reply('❌ Invalid quality');

        reply(`⬇️ Sending ALL episodes in ${quality}...`);

        for (const ep of session.episodes) {
            const link = ep.download_links.find(d => d.quality === quality);
            if (!link) continue;

            await conn.sendMessage(from, {
                document: { url: link.direct_url },
                mimetype: 'video/mp4',
                fileName: `S${ep.season}E${ep.episode}-${quality}.mp4`,
                caption: `📺 ${session.series.title}\n🎬 Ep ${ep.episode}\n📹 ${quality}`
            }, { quoted: mek });

            await new Promise(r => setTimeout(r, 2000));
        }

        sessionMap.delete(from);
    }
});
