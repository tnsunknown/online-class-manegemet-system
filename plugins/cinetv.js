const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const sessionMap = new Map();

console.log('📺 TV PLUGIN LOADED ✅');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// ============================================================
// 🖼️ THUMBNAIL (m plugin style)
// ============================================================
async function getThumbnailBuffer(imageUrl) {
    try {
        const res = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });

        return await sharp(Buffer.from(res.data))
            .resize(400, 400, { fit: 'cover' })
            .jpeg({ quality: 65 })
            .toBuffer();

    } catch (e) {
        console.log('⚠️ Thumbnail error:', e.message);
        return null;
    }
}

// ============================================================
// 🔥 REACTION SYSTEM
// ============================================================
async function react(conn, mek, emoji) {
    try {
        await conn.sendMessage(mek.key.remoteJid, {
            react: {
                text: emoji,
                key: mek.key
            }
        });
    } catch (e) {
        console.log('⚠️ Reaction failed:', e.message);
    }
}

// ============================================================
// 📺 SEARCH COMMAND
// ============================================================
cmd({
    pattern: 'tv',
    category: 'download'
}, async (conn, mek, m, { from, args, reply }) => {

    if (!args.length) return reply('❌ Usage: .tv good girl');

    const query = args.join(' ');

    await react(conn, mek, '🔍');

    console.log('🔍 SEARCH:', query);

    try {
        const url = `https://cine-fix-tv.vercel.app/api/search?q=${encodeURIComponent(query)}`;
        const res = await axios.get(url);

        const data = res.data;

        if (!data.results.length) {
            await react(conn, mek, '❌');
            return reply('No results found');
        }

        await react(conn, mek, '📺');

        let text = `📺 *TV SERIES RESULTS*\n\n`;
        data.results.forEach((s, i) => {
            text += `*${i + 1}.* 📺 ${s.title}\n⭐ ${s.rating || 'N/A'}\n\n`;
        });

        const thumb = await getThumbnailBuffer(data.results[0].poster);

        await conn.sendMessage(from, {
            image: thumb || undefined,
            caption: text + `Reply number to select`
        }, { quoted: mek });

        sessionMap.set(from, {
            stage: 'series',
            results: data.results
        });

        console.log('💾 Session: series loaded');

    } catch (e) {
        console.log('❌ Search error:', e.message);
        await react(conn, mek, '❌');
        reply('Search failed');
    }
});

// ============================================================
// 🔁 MESSAGE HANDLER
// ============================================================
cmd({
    on: 'body'
}, async (conn, mek, m, { from, body, reply }) => {

    if (!sessionMap.has(from)) return;

    const session = sessionMap.get(from);
    const input = body.trim();
    const num = parseInt(input);

    if (input.toLowerCase() === 'done') {
        sessionMap.delete(from);
        return reply('✅ Session ended');
    }

    // ========================================================
    // 📺 SERIES SELECT
    // ========================================================
    if (session.stage === 'series') {

        await react(conn, mek, '⏳');

        const series = session.results[num - 1];
        if (!series) return reply('❌ Invalid selection');

        console.log('📺 Selected series:', series.title);

        const api = `https://cine-tv-fix.netlify.app/.netlify/functions/scrape?url=${encodeURIComponent(series.url)}`;
        const res = await axios.get(api);
        const data = res.data.result;

        const seasons = {};
        data.episodes.forEach(ep => {
            if (!seasons[ep.season]) seasons[ep.season] = [];
            seasons[ep.season].push(ep);
        });

        sessionMap.set(from, {
            stage: 'season',
            series,
            seasons
        });

        await react(conn, mek, '📂');

        let msg = `📺 *${series.title}*\n\nSelect Season:\n\n`;

        Object.keys(seasons).forEach((s, i) => {
            msg += `*${i + 1}.* Season ${s}\n`;
        });

        const thumb = await getThumbnailBuffer(series.poster);

        await conn.sendMessage(from, {
            image: thumb,
            caption: msg
        }, { quoted: mek });
    }

    // ========================================================
    // 📂 SEASON SELECT
    // ========================================================
    else if (session.stage === 'season') {

        const keys = Object.keys(session.seasons);
        const seasonKey = keys[num - 1];

        if (!seasonKey) return reply('❌ Invalid season');

        const episodes = session.seasons[seasonKey];

        sessionMap.set(from, {
            stage: 'episode',
            series: session.series,
            seasonKey,
            episodes
        });

        await react(conn, mek, '🎬');

        let msg = `📂 *Season ${seasonKey}*\n\n`;
        msg += `0. 🎬 ALL EPISODES\n\n`;

        episodes.forEach((e, i) => {
            msg += `*${i + 1}.* Episode ${e.episode}\n`;
        });

        msg += `\nReply numbers (e.g: 1 2 3)`;

        return reply(msg);
    }

    // ========================================================
    // 🎬 EPISODE SELECT
    // ========================================================
    else if (session.stage === 'episode') {

        const inputs = body.split(' ').map(n => parseInt(n)).filter(Boolean);

        let selected = [];

        if (inputs.includes(0)) {
            selected = session.episodes;
        } else {
            selected = inputs.map(i => session.episodes[i - 1]).filter(Boolean);
        }

        if (!selected.length) return reply('❌ Invalid selection');

        sessionMap.set(from, {
            stage: 'quality',
            series: session.series,
            episodes: selected
        });

        await react(conn, mek, '📹');

        return reply(
`📹 Selected ${selected.length} episode(s)

Choose Quality:
1️⃣ 480p
2️⃣ 720p
3️⃣ 1080p`
        );
    }

    // ========================================================
    // ⬇️ QUALITY DOWNLOAD (MULTI)
    // ========================================================
    else if (session.stage === 'quality') {

        const map = { 1: '480p', 2: '720p', 3: '1080p' };
        const quality = map[num];

        if (!quality) {
            await react(conn, mek, '❌');
            return reply('Invalid quality');
        }

        await react(conn, mek, '⬇️');

        for (const ep of session.episodes) {

            const link = ep.download_links.find(d => d.quality === quality);
            if (!link) continue;

            console.log(`⬇️ Sending Ep ${ep.episode}`);

            await conn.sendMessage(from, {
                document: { url: link.direct_url },
                mimetype: 'video/mp4',
                fileName: `S${ep.season}E${ep.episode}-${quality}.mp4`,
                caption: `📺 ${session.series.title}\n🎬 Episode ${ep.episode}\n📹 ${quality}`
            }, { quoted: mek });

            await new Promise(r => setTimeout(r, 2000));
        }

        await react(conn, mek, '✅');

        sessionMap.delete(from);
    }
});
