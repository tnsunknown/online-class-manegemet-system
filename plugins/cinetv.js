const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const sessionMap = new Map();

console.log('📺 TV SERIES PLUGIN LOADED ✅');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// ============================================================
// 🖼️ Thumbnail (same as movie plugin)
// ============================================================
async function getThumbnailBuffer(imageUrl) {
    try {
        const res = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: 15000
        });

        const buf = Buffer.from(res.data);

        const resized = await sharp(buf)
            .resize(320, 320, { fit: 'cover' })
            .jpeg({ quality: 60 })
            .toBuffer();

        return resized;

    } catch (e) {
        console.log('⚠️ thumb error:', e.message);
        return null;
    }
}

// ============================================================
// 📦 DOWNLOAD EPISODE (movie plugin style adapted)
// ============================================================
async function downloadEpisode(conn, mek, from, episode, quality, thumbBuf, reply) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📺 EPISODE DOWNLOAD START');

    try {
        const finalUrl = episode.download_links.find(x => x.quality === quality)?.direct_url;

        if (!finalUrl) {
            return reply('❌ Quality not found');
        }

        const filePath = path.join(__dirname, `../tv_${Date.now()}_${quality}.mp4`);

        const dlRes = await axios({
            method: 'GET',
            url: finalUrl,
            responseType: 'stream',
            timeout: 0
        });

        const writer = fs.createWriteStream(filePath);
        dlRes.data.pipe(writer);

        writer.on('finish', async () => {

            const stats = fs.statSync(filePath);
            const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

            const msg = {
                document: { url: filePath },
                mimetype: 'video/mp4',
                fileName: `Episode ${episode.episode} (${quality}).mp4`,
                caption:
`📺 Episode ${episode.episode}
🎯 Quality: ${quality}
📦 Size: ${sizeMB} MB`
            };

            if (thumbBuf) msg.jpegThumbnail = thumbBuf;

            await conn.sendMessage(from, msg, { quoted: mek });

            fs.unlinkSync(filePath);
        });

    } catch (e) {
        console.log('❌ download error:', e.message);
        reply('❌ Download failed');
    }
}

// ============================================================
// 🔍 SEARCH TV SERIES
// ============================================================
cmd({
    pattern: 'tv',
    desc: 'TV Series downloader',
    category: 'download'
}, async (conn, mek, m, { from, args, reply }) => {

    if (!args.length) return reply('❌ Usage: .tv good girl');

    const query = args.join(' ');

    try {
        console.log('🔍 SEARCH:', query);

        const res = await axios.get(
            `https://cine-fix-tv.vercel.app/api/search?q=${encodeURIComponent(query)}`
        );

        const data = res.data;

        if (!data.results.length) return reply('❌ No results');

        let text = `🔍 *TV SEARCH RESULTS*\n\n`;

        data.results.forEach((r, i) => {
            text += `*${i + 1}.* 📺 ${r.title}\n⭐ ${r.rating || '-'}\n\n`;
        });

        const thumb = await getThumbnailBuffer(data.results[0].poster);

        if (thumb) {
            await conn.sendMessage(from, {
                image: thumb,
                caption: text + `Reply number to select`
            }, { quoted: mek });
        } else {
            await conn.sendMessage(from, { text }, { quoted: mek });
        }

        sessionMap.set(from, {
            stage: 'select_show',
            results: data.results
        });

        console.log('💾 session saved: select_show');

    } catch (e) {
        console.log(e);
        reply('❌ Search error');
    }
});

// ============================================================
// 🎯 HANDLER (STAGES)
// ============================================================
cmd({
    on: 'body'
}, async (conn, mek, m, { from, body, reply }) => {

    if (!sessionMap.has(from)) return;

    const session = sessionMap.get(from);
    const input = body.trim();

    // ❌ STOP
    if (input.toLowerCase() === 'done') {
        sessionMap.delete(from);
        return reply('✅ Session ended');
    }

    const num = parseInt(input);

    // ========================================================
    // 📺 SELECT SHOW
    // ========================================================
    if (session.stage === 'select_show') {

        if (isNaN(num) || num < 1 || num > session.results.length) {
            return reply('❌ Invalid selection');
        }

        const show = session.results[num - 1];

        const res = await axios.get(
            `https://cine-tv-fix.netlify.app/.netlify/functions/scrape?url=${encodeURIComponent(show.url)}`
        );

        const showData = res.data.result;

        let text = `📺 *${show.title}*\n\n🎬 Select Season:\n\n`;

        const seasons = [...new Set(showData.episodes.map(e => e.season))];

        seasons.forEach((s, i) => {
            text += `*${i + 1}.* Season ${s}\n`;
        });

        const thumb = await getThumbnailBuffer(show.poster);

        await conn.sendMessage(from, {
            image: thumb,
            caption: text
        }, { quoted: mek });

        sessionMap.set(from, {
            stage: 'select_season',
            show: show,
            data: showData
        });

    }

    // ========================================================
    // 📂 SELECT SEASON
    // ========================================================
    else if (session.stage === 'select_season') {

        const seasons = [...new Set(session.data.episodes.map(e => e.season))];

        if (isNaN(num) || num < 1 || num > seasons.length) {
            return reply('❌ Invalid season');
        }

        const season = seasons[num - 1];

        const episodes = session.data.episodes.filter(e => e.season === season);

        let text = `📂 *Season ${season}*\n\nSelect Episode:\n\n`;

        episodes.forEach((e, i) => {
            text += `*${i + 1}.* Episode ${e.episode}\n`;
        });

        await conn.sendMessage(from, {
            text
        }, { quoted: mek });

        sessionMap.set(from, {
            stage: 'select_episode',
            episodes
        });
    }

    // ========================================================
    // 🎬 SELECT EPISODE
    // ========================================================
    else if (session.stage === 'select_episode') {

        const epList = session.episodes;

        if (isNaN(num) || num < 1 || num > epList.length) {
            return reply('❌ Invalid episode');
        }

        const episode = epList[num - 1];

        let text =
`🎬 Episode ${episode.episode}

Select Quality:
1. 480p
2. 720p
3. 1080p`;

        const thumb = await getThumbnailBuffer(episode.episode_url);

        await conn.sendMessage(from, {
            image: thumb,
            caption: text
        }, { quoted: mek });

        sessionMap.set(from, {
            stage: 'select_quality',
            episode
        });
    }

    // ========================================================
    // 🎯 QUALITY → DOWNLOAD
    // ========================================================
    else if (session.stage === 'select_quality') {

        if (![1,2,3].includes(num)) return reply('❌ 1-3 only');

        const map = {1:'480p',2:'720p',3:'1080p'};
        const quality = map[num];

        const episode = session.episode;

        sessionMap.set(from, {
            ...session,
            stage: 'select_show'
        });

        await reply(`⬇️ Downloading Episode ${episode.episode} (${quality})...`);

        downloadEpisode(conn, mek, from, episode, quality, null, reply);
    }
});
