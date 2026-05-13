const { cmd } = require('../command');
const axios = require('axios');

// Session management with timeout
const tvSession = new Map();

// Cleanup expired sessions every minute
setInterval(() => {
    const now = Date.now();
    for (const [userId, session] of tvSession.entries()) {
        if (now - session.createdAt > 300000) { // 5 minutes timeout
            tvSession.delete(userId);
        }
    }
}, 60000);

console.log('📺 TV SERIES PLUGIN LOADED ✅');

// ============================================================
// 📺 TV SEARCH - Your search API
// ============================================================
cmd({
    pattern: 'tvs',
    desc: 'Search and download TV series',
    category: 'download'
}, async (conn, mek, m, { from, args, reply }) => {

    if (!args.length) {
        return reply('❌ *Usage:*\n.tv Game of Thrones\n\n*Example:*\n.tv breaking bad');
    }

    const query = args.join(' ');
    
    // Send typing indicator
    await conn.sendPresenceUpdate('composing', from);
    
    // Your search API
    const searchUrl = `https://cine-fix-tv.vercel.app/api/search?q=${encodeURIComponent(query)}`;

    try {
        const res = await axios.get(searchUrl, { 
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const data = res.data;

        if (!data?.results?.length) {
            return reply(`❌ No results found for "*${query}*"\n\n💡 Try different keywords`);
        }

        // Format results message
        let text = `📺 *TV SERIES RESULTS*\n`;
        text += `🔍 Query: *${query}*\n`;
        text += `📊 Found: *${data.results.length}* series\n\n`;
        text += `*Reply with number (1-${Math.min(data.results.length, 20)})*\n\n`;

        // Show first 20 results
        const displayResults = data.results.slice(0, 20);
        displayResults.forEach((tv, i) => {
            text += `*${i + 1}.* 📺 *${tv.title}*\n`;
            text += `   ⭐ ${tv.rating || 'N/A'} | ${tv.season_status || 'Status Unknown'}\n\n`;
        });

        if (data.results.length > 20) {
            text += `\n*+${data.results.length - 20} more results*\n`;
        }

        text += `\n⏱️ Session expires in 5 minutes\n`;
        text += `📝 Type *"done"* to cancel`;

        await conn.sendMessage(from, { text }, { quoted: mek });

        // Store session
        tvSession.set(from, {
            stage: 'select_series',
            results: data.results,
            createdAt: Date.now(),
            query: query
        });

    } catch (error) {
        console.error('Search error:', error.message);
        reply('❌ Search failed. Please try again later.');
    }
});

// ============================================================
// 📥 MAIN SESSION HANDLER
// ============================================================
cmd({
    on: 'body'
}, async (conn, mek, m, { from, body, reply }) => {

    if (!tvSession.has(from)) return;

    const session = tvSession.get(from);
    const input = body.trim();

    // Check session expiry
    if (Date.now() - session.createdAt > 300000) {
        tvSession.delete(from);
        return reply('⏰ Session expired. Please search again using *.tv*');
    }

    // Cancel session
    if (input.toLowerCase() === 'done' || input.toLowerCase() === 'cancel') {
        tvSession.delete(from);
        return reply('✅ Session cancelled. Type *.tv* to start new search');
    }

    const num = parseInt(input);
    if (isNaN(num)) {
        return reply('❌ Please reply with a *number* or type *"done"* to cancel');
    }

    // ========================================================
    // 🎯 SELECT SERIES
    // ========================================================
    if (session.stage === 'select_series') {

        if (num < 1 || num > session.results.length) {
            return reply(`❌ Invalid number. Please choose between *1* and *${session.results.length}*`);
        }

        const series = session.results[num - 1];
        
        await reply(`📺 Fetching episodes for *${series.title}*...\n⏳ Please wait`);
        await conn.sendPresenceUpdate('composing', from);

        // Your scraper API
        const scraperUrl = `https://cine-fix.vercel.app/api/scrape?url=${encodeURIComponent(series.url)}`;

        try {
            const res = await axios.get(scraperUrl, { 
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            const result = res.data?.result;

            if (!result || !result.episodes || result.episodes.length === 0) {
                tvSession.delete(from);
                return reply('❌ No episodes found for this series.\n\n💡 Try another series or search again with *.tv*');
            }

            // Filter out episodes with errors
            const validEpisodes = result.episodes.filter(ep => !ep.error && ep.download_links && ep.download_links.length > 0);
            
            if (validEpisodes.length === 0) {
                tvSession.delete(from);
                return reply('❌ No download links available for this series.\n\n💡 Try another series.');
            }

            // Format episodes list
            let text = `📺 *${series.title}*\n`;
            text += `⭐ Rating: ${series.rating || 'N/A'}\n`;
            text += `📊 Total Episodes: *${validEpisodes.length}*\n\n`;
            text += `*Select Episode:*\n`;
            text += `Reply with number (1-${Math.min(validEpisodes.length, 50)})\n\n`;

            // Show episodes (limit to 50 per page)
            const displayEpisodes = validEpisodes.slice(0, 50);
            displayEpisodes.forEach((ep, i) => {
                const seasonNum = ep.season || '??';
                const episodeNum = ep.episode || '??';
                text += `*${i + 1}.* 🎬 S${seasonNum.toString().padStart(2, '0')}E${episodeNum.toString().padStart(2, '0')}\n`;
            });

            if (validEpisodes.length > 50) {
                text += `\n*+${validEpisodes.length - 50} more episodes available*`;
            }

            text += `\n\n⏱️ Session expires in 5 minutes\n`;
            text += `📝 Type *"done"* to cancel`;

            await conn.sendMessage(from, { text }, { quoted: mek });

            // Update session
            tvSession.set(from, {
                stage: 'select_episode',
                series: series,
                episodes: validEpisodes,
                allEpisodes: result.episodes,
                createdAt: Date.now()
            });

        } catch (error) {
            console.error('Episode fetch error:', error.message);
            tvSession.delete(from);
            reply('❌ Failed to load episodes. Please try again later.');
        }
    }

    // ========================================================
    // 🎯 SELECT EPISODE
    // ========================================================
    else if (session.stage === 'select_episode') {

        if (num < 1 || num > session.episodes.length) {
            return reply(`❌ Invalid episode number. Please choose between *1* and *${session.episodes.length}*`);
        }

        const episode = session.episodes[num - 1];
        
        // Check if episode has download links
        if (!episode.download_links || episode.download_links.length === 0) {
            return reply('❌ No download links available for this episode.\n\n💡 Try another episode.');
        }

        // Get available qualities
        const qualities = episode.download_links.map(link => link.quality);
        const uniqueQualities = [...new Set(qualities)];
        
        let text = `🎬 *${session.series.title}*\n`;
        const seasonNum = episode.season || '??';
        const episodeNum = episode.episode || '??';
        text += `📺 *S${seasonNum.toString().padStart(2, '0')}E${episodeNum.toString().padStart(2, '0')}*\n\n`;
        text += `*Select Quality:*\n\n`;
        
        // Map qualities to numbers
        const qualityMap = {};
        uniqueQualities.forEach((quality, index) => {
            const numOption = index + 1;
            qualityMap[numOption] = quality;
            text += `*${numOption}.* ${quality}\n`;
        });
        
        text += `\n⏱️ Session expires in 5 minutes\n`;
        text += `📝 Type *"done"* to cancel`;
        
        await conn.sendMessage(from, { text }, { quoted: mek });
        
        // Update session
        tvSession.set(from, {
            stage: 'select_quality',
            series: session.series,
            episode: episode,
            qualityMap: qualityMap,
            episodes: session.episodes,
            createdAt: Date.now()
        });
    }

    // ========================================================
    // 🎯 SELECT QUALITY → DOWNLOAD
    // ========================================================
    else if (session.stage === 'select_quality') {

        const quality = session.qualityMap[num];
        
        if (!quality) {
            const available = Object.values(session.qualityMap).join(', ');
            return reply(`❌ Invalid choice. Please choose from: *${available}*`);
        }

        // Find the download link for selected quality
        const downloadLink = session.episode.download_links.find(link => link.quality === quality);
        
        if (!downloadLink || !downloadLink.proxy_url) {
            return reply(`❌ Download link not available for ${quality} quality.\n\n💡 Try another quality.`);
        }

        const fileUrl = downloadLink.proxy_url;
        const seasonNum = session.episode.season || '??';
        const episodeNum = session.episode.episode || '??';
        const fileName = `${session.series.title} - S${seasonNum.toString().padStart(2, '0')}E${episodeNum.toString().padStart(2, '0')} (${quality}).mp4`;
        
        await reply(`⬇️ *Downloading...*\n\n📺 ${session.series.title}\n🎬 S${seasonNum}E${episodeNum}\n📹 Quality: ${quality}\n\n⏳ Preparing file, please wait...`);
        
        try {
            // Send video file
            await conn.sendMessage(from, {
                document: { url: fileUrl },
                mimetype: 'video/mp4',
                fileName: fileName,
                caption: `🎬 *TV Series Episode Downloaded*\n\n📺 *Series:* ${session.series.title}\n📌 *Episode:* S${seasonNum}E${episodeNum}\n📹 *Quality:* ${quality}\n\n✅ Download complete!`
            }, { quoted: mek });
            
            // Keep session for more downloads from same series
            tvSession.set(from, {
                stage: 'select_episode',
                series: session.series,
                episodes: session.episodes,
                createdAt: Date.now()
            });
            
            // Ask if user wants more episodes
            await reply(`✅ *Download complete!*\n\n📺 Type a number (1-${session.episodes.length}) to download another episode\n📝 Type *"done"* to exit`);
            
        } catch (error) {
            console.error('Download error:', error.message);
            reply(`❌ Failed to send file.\n\nError: ${error.message}\n\n💡 Try again with different quality or episode.`);
            
            // Reset to episode selection
            tvSession.set(from, {
                stage: 'select_episode',
                series: session.series,
                episodes: session.episodes,
                createdAt: Date.now()
            });
        }
    }
});

// ============================================================
// 🛑 HELP COMMAND
// ============================================================
cmd({
    pattern: 'tvhelp',
    desc: 'TV Series downloader help',
    category: 'download'
}, async (conn, mek, m, { from, reply }) => {
    const helpText = `📺 *TV SERIES DOWNLOADER HELP*\n\n
*Commands:*
• *.tv <series name>* - Search for TV series
• *"done"* - Cancel current session
• *.tvhelp* - Show this help

*How to use:*
1️⃣ Search series using *.tv*
2️⃣ Reply with series number
3️⃣ Select episode number
4️⃣ Choose video quality
5️⃣ Wait for download

*Features:*
✅ Multiple quality options (480p/720p/1080p)
✅ Session expires after 5 minutes
✅ Download multiple episodes
✅ Direct MP4 downloads
✅ Custom proxy support

*Example:*
.tv game of thrones
→ Reply: 1
→ Reply: 5 (episode)
→ Reply: 2 (720p)

*Note:* Downloads may take time based on file size and connection speed.

*API Info:* Using custom scraper with multi-domain support (01-45.teha416.online)

*Support:* Report issues to bot owner`;

    await reply(helpText);
});

// ============================================================
// 📊 STATUS COMMAND
// ============================================================
cmd({
    pattern: 'tvstatus',
    desc: 'Check TV downloader status',
    category: 'download'
}, async (conn, mek, m, { from, reply }) => {
    const activeSessions = tvSession.size;
    const statusText = `📺 *TV Series Downloader Status*\n\n
🟢 *Status:* Active
📊 *Active Sessions:* ${activeSessions}
⏱️ *Session Timeout:* 5 minutes
🔗 *Search API:* Active
🔗 *Scraper API:* Active
🌐 *Proxy Support:* Enabled
📹 *Qualities:* 480p, 720p, 1080p

*Commands:*
• .tv <name> - Search series
• .tvhelp - Get help
• tvstatus - This status

*Note:* Type "done" anytime to cancel session`;

    await reply(statusText);
});
