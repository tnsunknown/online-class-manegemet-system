const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const sessionMap = new Map();

console.log('🎬 MOVIE PLUGIN LOADED ✅');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// ============================================================
// 🖼️  Thumbnail fetch + sharp resize → under 50KB
// ============================================================
async function getThumbnailBuffer(imageUrl) {
    try {
        console.log('🖼️  Fetching thumbnail:', imageUrl);
        const res = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': 'image/jpeg,image/png,image/*'
            },
            timeout: 15000
        });

        const originalBuf = Buffer.from(res.data);
        console.log('📥 Original size     :', originalBuf.length, 'bytes');

        const resized = await sharp(originalBuf)
            .resize(320, 320, { fit: 'cover', position: 'centre' })
            .jpeg({ quality: 60 })
            .toBuffer();

        console.log('✅ Resized thumbnail  :', resized.length, 'bytes |', resized.length < 51200 ? '✅ Under 50KB' : '⚠️ Over 50KB');
        return resized;

    } catch (e) {
        console.log('⚠️  Thumbnail FAILED  :', e.message);
        return null;
    }
}

// ============================================================
// 🔧  Quality link builder
// ============================================================
function buildQualityLink(manualLink, quality) {
    let fileName = decodeURIComponent(manualLink.split('/').pop());
    console.log('📂 Original filename   :', fileName);
    fileName = fileName.replace(/-\d{3,4}p/i, '');
    fileName = fileName.replace('.mp4', `-${quality}.mp4`);
    console.log(`🎯 Built filename       : ${fileName}`);
    const finalUrl = 'https://06.teha416.online/' + encodeURIComponent(fileName);
    console.log(`🔗 Final download URL   : ${finalUrl}`);
    return finalUrl;
}

// ============================================================
// 📥  Download + Upload (reusable function)
// ============================================================
async function downloadAndSend(conn, mek, from, movie, quality, thumbBuf, reply) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('▶️  DOWNLOAD START');
    console.log('🎬 Title    :', movie.title);
    console.log('📹 Quality  :', quality);
    console.log('🖼️  Has thumb:', thumbBuf ? `YES (${thumbBuf.length} bytes)` : 'NO');

    await reply(`⏳ Fetching *${movie.title}* (${quality})...`);

    try {
        const scraperUrl = `https://karicine.netlify.app/.netlify/functions/scrapper?url=${encodeURIComponent(movie.full_url)}`;
        console.log('🌐 Scraper API URL   :', scraperUrl);

        const scraperRes = await axios.get(scraperUrl, { timeout: 20000 });
        const scraperData = scraperRes.data;
        console.log('📦 Scraper keys      :', Object.keys(scraperData).join(', '));

        if (!scraperData?.links?.manual) {
            console.log('❌ No manual link! Response:', JSON.stringify(scraperData));
            await reply('❌ No download link found for: ' + movie.title);
            return;
        }

        const manualLink = scraperData.links.manual;
        console.log('🔗 Scraper manual URL:', manualLink);

        const finalUrl = buildQualityLink(manualLink, quality);

        await reply(`⬇️ Downloading *${movie.title}* (${quality})...\n_Please wait..._`);

        const filePath = path.join(__dirname, `../temp_${Date.now()}_${quality}.mp4`);
        console.log('💾 Temp file path    :', filePath);

        const dlRes = await axios({
            method: 'GET',
            url: finalUrl,
            responseType: 'stream',
            timeout: 0,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
                'Referer': 'https://cinesubz.lk/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const contentLength = dlRes.headers['content-length'];
        const sizeMB = contentLength
            ? (parseInt(contentLength) / (1024 * 1024)).toFixed(2) + ' MB'
            : 'Unknown';
        console.log('📊 Expected size     :', sizeMB);
        console.log('📡 HTTP status       :', dlRes.status);
        console.log('🔗 Actual served URL :', dlRes.request?.res?.responseUrl || finalUrl);

        const writer = fs.createWriteStream(filePath);
        dlRes.data.pipe(writer);

        writer.on('finish', async () => {
            const stats = fs.statSync(filePath);
            const actualMB = (stats.size / (1024 * 1024)).toFixed(2);
            console.log('✅ Download complete  :', actualMB, 'MB');

            try {
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('📤 Building document message...');

                const docMsg = {
                    document: { url: filePath },
                    mimetype: 'video/mp4',
                    fileName: `${movie.title} (${quality}).mp4`,
                    caption: `🎬 *${movie.title}*\n📹 Quality: *${quality}*\n📦 Size: ${actualMB} MB\n\n_Powered by Online Class Management Bot_`
                };

                if (thumbBuf) {
                    docMsg.jpegThumbnail = thumbBuf;
                    console.log('🖼️  jpegThumbnail SET :', thumbBuf.length, 'bytes |', thumbBuf.length < 51200 ? '✅ Under 50KB' : '⚠️ Over 50KB');
                } else {
                    console.log('⚠️  No thumbnail to add');
                }

                console.log('📄 fileName          :', docMsg.fileName);
                console.log('📏 fileSize          :', actualMB, 'MB');
                console.log('📤 Uploading to WhatsApp...');

                await conn.sendMessage(from, docMsg, { quoted: mek });
                console.log('✅ Upload SUCCESS!');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            } catch (uploadErr) {
                console.log('❌ UPLOAD ERROR:', uploadErr.message);
                console.log(uploadErr.stack);

                console.log('🔄 Trying fallback with direct URL...');
                try {
                    await conn.sendMessage(from, {
                        document: { url: finalUrl },
                        mimetype: 'video/mp4',
                        fileName: `${movie.title} (${quality}).mp4`,
                        caption: `🎬 *${movie.title}*\n📹 Quality: *${quality}*\n\n_Powered by Online Class Management Bot_`,
                        jpegThumbnail: thumbBuf || undefined
                    }, { quoted: mek });
                    console.log('✅ Fallback upload SUCCESS!');
                } catch (fallbackErr) {
                    console.log('❌ Fallback FAILED:', fallbackErr.message);
                    await reply('❌ Upload failed. File may be too large for WhatsApp.');
                }
            }

            // Cleanup
            try {
                fs.unlinkSync(filePath);
                console.log('🗑️  Temp file deleted');
            } catch (e) {
                console.log('⚠️  Cleanup failed:', e.message);
            }
        });

        writer.on('error', (writeErr) => {
            console.log('❌ WRITE ERROR:', writeErr.message);
            reply('❌ Download failed. Selected quality may not be available.');
            try { fs.unlinkSync(filePath); } catch (e) {}
        });

    } catch (err) {
        console.log('❌ FETCH/DOWNLOAD ERROR:', err.message);
        if (err.response) {
            console.log('   HTTP Status:', err.response.status);
            console.log('   HTTP URL   :', err.response.config?.url);
        }
        await reply('❌ Error: ' + err.message);
    }
}

// ============================================================
// 🎬  .m  SEARCH
// ============================================================
cmd({
    pattern: 'm',
    desc: 'Movie downloader — multiple downloads supported',
    category: 'download'
}, async (conn, mek, m, { from, args, reply }) => {

    if (!args.length) return reply('❌ Usage: .m avatar');

    const query = args.join(' ');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 NEW SEARCH:', query);

    try {
        const searchUrl = `https://newcines.netlify.app/api/search?q=${encodeURIComponent(query)}`;
        console.log('🌐 Search API URL:', searchUrl);

        const res = await axios.get(searchUrl, { timeout: 15000 });
        const data = res.data;

        if (!data?.results?.length) return reply('❌ No results found for: ' + query);
        console.log(`📋 Results count: ${data.results.length}`);

        let caption = `🎬 *MOVIE SEARCH RESULTS*\n`;
        caption += `🔎 Query: *${query}*\n\n`;
        caption += `Reply with a number to select:\n`;
        caption += `_You can download multiple — reply again for another_\n`;
        caption += `_Reply *done* to stop_\n\n`;
        data.results.forEach((movie, i) => {
            const icon = movie.type === 'TV Series' ? '📺' : '🎥';
            caption += `*${i + 1}.* ${icon} ${movie.title}\n`;
        });
        caption += `\n_Powered by Online Class Management Bot_`;

        const firstThumbBuf = await getThumbnailBuffer(data.results[0].image_url);

        if (firstThumbBuf) {
            console.log('📤 Sending search results with thumbnail');
            await conn.sendMessage(from, {
                image: firstThumbBuf,
                caption: caption
            }, { quoted: mek });
        } else {
            console.log('📤 Sending search results as text');
            await conn.sendMessage(from, { text: caption }, { quoted: mek });
        }

        // ✅ Save session — results kept alive for multiple downloads
        sessionMap.set(from, {
            results: data.results,
            stage: 'select'
        });
        console.log('💾 Session saved | stage: select | results:', data.results.length);

    } catch (err) {
        console.log('❌ Search error:', err.message);
        reply('❌ Search failed. Please try again.');
    }
});

// ============================================================
// 🎯  REPLY HANDLER — multiple downloads, session stays alive
// ============================================================
cmd({
    on: 'body'
}, async (conn, mek, m, { from, body, reply }) => {

    if (!sessionMap.has(from)) return;

    const session = sessionMap.get(from);
    const input = body.trim();

    // ── STOP command ──────────────────────────────────────
    if (input.toLowerCase() === 'done') {
        sessionMap.delete(from);
        console.log('🛑 Session ended by user:', from);
        return reply('✅ Download session ended.\n_Reply .m <name> to start a new search._');
    }

    const num = parseInt(input);
    if (isNaN(num)) return;

    // ─── STAGE: SELECT MOVIE ───────────────────────────────
    if (session.stage === 'select') {

        if (num < 1 || num > session.results.length) {
            return reply(`❌ Enter a number between 1 and ${session.results.length}\n_Reply *done* to stop_`);
        }

        const movie = session.results[num - 1];
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎬 Movie selected     :', movie.title);
        console.log('🔗 Movie page URL     :', movie.full_url);
        console.log('🖼️  Movie image URL    :', movie.image_url);

        const thumbBuf = await getThumbnailBuffer(movie.image_url);

        let qualMsg = `🎬 *${movie.title}*\n`;
        qualMsg += `📁 Type: ${movie.type}\n\n`;
        qualMsg += `Select download quality:\n\n`;
        qualMsg += `*1.* 📱 480p  — Small file\n`;
        qualMsg += `*2.* 🖥️  720p  — HD\n`;
        qualMsg += `*3.* 🎯 1080p — Full HD\n\n`;
        qualMsg += `_Reply 1, 2 or 3_\n`;
        qualMsg += `_Reply *done* to stop_`;

        if (thumbBuf) {
            console.log('📤 Sending quality menu with thumbnail');
            await conn.sendMessage(from, {
                image: thumbBuf,
                caption: qualMsg
            }, { quoted: mek });
        } else {
            console.log('📤 Sending quality menu as text');
            await conn.sendMessage(from, { text: qualMsg }, { quoted: mek });
        }

        // ✅ Keep results in session — advance to quality stage
        sessionMap.set(from, {
            results: session.results,   // ← results preserve කරනවා
            stage: 'quality',
            movie: movie,
            thumbBuf: thumbBuf
        });
        console.log('💾 Session updated | stage: quality | movie:', movie.title);

    // ─── STAGE: SELECT QUALITY → DOWNLOAD ─────────────────
    } else if (session.stage === 'quality') {

        if (![1, 2, 3].includes(num)) {
            return reply('❌ Reply 1 (480p), 2 (720p) or 3 (1080p)\n_Reply *done* to stop_');
        }

        const qualityMap = { 1: '480p', 2: '720p', 3: '1080p' };
        const quality  = qualityMap[num];
        const movie    = session.movie;
        const thumbBuf = session.thumbBuf;

        // ✅ Go back to select stage — DON'T delete session
        // User can select another movie from same results immediately
        sessionMap.set(from, {
            results: session.results,   // ← results preserve කරනවා
            stage: 'select'             // ← back to select for next download
        });
        console.log('🔄 Session reset to select stage | user can pick another movie');

        // ── Notify user they can select another while this downloads ──
        await conn.sendMessage(from, {
            text: `✅ *Download queued!*\n\n🎬 *${movie.title}*\n📹 Quality: *${quality}*\n\n_You can select another movie from the list while this downloads._\n_Reply *done* to end session._`
        }, { quoted: mek });

        // ── Start download (runs independently) ──
        downloadAndSend(conn, mek, from, movie, quality, thumbBuf, reply);
        console.log(`🚀 Download started (non-blocking): ${movie.title} | ${quality}`);
    }
});
