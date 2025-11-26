const { cmd } = require('../command');
const { makeWASocket, downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

console.log('\n╔════════════════════════════════════╗');
console.log('║ 📢 GROUP BROADCAST PLUGIN LOADED! ║');
console.log('╚════════════════════════════════════╝\n');

// Helper function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 🎯 Broadcast Command
cmd({
  pattern: "broadcast",
  desc: "Send a message to all participating groups (Admin only)",
  category: "admin",
  filename: __filename,
}, async (conn, mek, m, { from, args, reply, isOwner }) => {
  try {
    console.log(`\n📢 BROADCAST command from: ${from}`);
    
    // Restrict to bot owner
    if (!isOwner) {
      console.log('   ❌ Access denied - not owner');
      return reply("❌ This command is for the bot owner only!");
    }

    // Check if message content is provided
    if (!args.length) {
      console.log('   ❌ No message provided');
      return reply("❌ Usage: .broadcast <message>\n\nExample:\n• .broadcast Hello everyone! New class schedule is out.");
    }

    const message = args.join(' ');
    console.log(`   Broadcast message: "${message.substring(0, 100)}"`);

    // Get all participating groups
    const groups = await conn.groupFetchAllParticipating();
    const groupIds = Object.keys(groups).filter(id => id.endsWith('@g.us'));
    console.log(`   Found ${groupIds.length} groups`);

    if (!groupIds.length) {
      console.log('   ❌ No groups found');
      return reply("❌ No groups found to broadcast to!");
    }

    // Send broadcast message to each group with retry logic
    let successCount = 0;
    let failCount = 0;
    const errors = [];
    const failedGroups = [];

    await reply(`📢 Broadcasting to ${groupIds.length} groups...\n⏳ Please wait...`);

    for (const jid of groupIds) {
      try {
        await conn.sendMessage(jid, { text: message });
        console.log(`   ✅ Sent to ${jid}`);
        successCount++;
        await delay(2000); // 2 second delay between messages
      } catch (e) {
        console.error(`   ❌ Failed to send to ${jid}: ${e.message}`);
        failedGroups.push({ jid, name: groups[jid].subject });
        failCount++;
      }
    }

    // Retry failed groups with longer delay
    if (failedGroups.length > 0) {
      console.log(`\n🔄 Retrying ${failedGroups.length} failed groups...`);
      await reply(`🔄 Retrying ${failedGroups.length} failed groups...`);
      
      for (const group of failedGroups) {
        try {
          await delay(5000); // 5 second delay for retries
          await conn.sendMessage(group.jid, { text: message });
          console.log(`   ✅ Retry successful for ${group.jid}`);
          successCount++;
          failCount--;
        } catch (e) {
          console.error(`   ❌ Retry failed for ${group.jid}: ${e.message}`);
          errors.push(`${group.name}: ${e.message}`);
        }
      }
    }

    // Summary response
    const response = `📢 *Broadcast Summary*\n\n✅ Sent to: ${successCount} groups\n❌ Failed: ${failCount} groups\n\n${errors.length ? '⚠️ Errors:\n' + errors.slice(0, 5).join('\n') + (errors.length > 5 ? `\n... and ${errors.length - 5} more` : '') : '🎉 All messages sent successfully!'}`;
    console.log(`   Broadcast summary: ${successCount} successes, ${failCount} failures`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return reply(response);

  } catch (e) {
    console.error('❌ Error in broadcast command:', e.message);
    return reply(`❌ Error: ${e.message}`);
  }
});

// 📋 List Groups Command
cmd({
  pattern: "listgroups",
  desc: "List all participating groups (Admin only)",
  category: "admin",
  filename: __filename,
}, async (conn, mek, m, { from, reply, isOwner }) => {
  try {
    console.log(`\n📋 LISTGROUPS command from: ${from}`);
    
    // Restrict to bot owner
    if (!isOwner) {
      console.log('   ❌ Access denied - not owner');
      return reply("❌ This command is for the bot owner only!");
    }

    // Get all participating groups
    const groups = await conn.groupFetchAllParticipating();
    const groupIds = Object.keys(groups).filter(id => id.endsWith('@g.us'));
    console.log(`   Found ${groupIds.length} groups`);

    if (!groupIds.length) {
      console.log('   ❌ No groups found');
      return reply("❌ No groups found!");
    }

    // Format group list
    let response = "📋 *Participating Groups*\n\n";
    groupIds.forEach((jid, i) => {
      const group = groups[jid];
      response += `${i + 1}. ${group.subject}\n   🆔 ${jid}\n   👥 ${group.participants.length} members\n\n`;
    });
    response += `━━━━━━━━━━━━━━━━━\n📊 Total Groups: ${groupIds.length}`;

    console.log('   Sending group list...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return reply(response);

  } catch (e) {
    console.error('❌ Error in listgroups command:', e.message);
    return reply(`❌ Error: ${e.message}`);
  }
});

// 📤 BC Command - Reply to any message to broadcast
cmd({
  pattern: "bc",
  desc: "Reply to any message (text/image/video/pdf/audio) to broadcast it to all groups",
  category: "admin",
  filename: __filename,
}, async (conn, mek, m, { from, reply, isOwner, quoted }) => {
  try {
    console.log(`\n📤 BC command from: ${from}`);
    
    // Restrict to bot owner
    if (!isOwner) {
      console.log('   ❌ Access denied - not owner');
      return reply("❌ This command is for the bot owner only!");
    }

    // Check if replying to a message
    if (!quoted) {
      console.log('   ❌ No quoted message');
      return reply("❌ Please reply to a message (text/image/video/pdf/audio) with .bc to broadcast it!\n\nExample:\n• Reply to an image with: .bc\n• Reply to a PDF with: .bc");
    }

    const quotedMsg = quoted.message || quoted;
    
    // Detect message type
    const isText = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text;
    const isImage = quotedMsg.imageMessage;
    const isVideo = quotedMsg.videoMessage;
    const isDocument = quotedMsg.documentMessage;
    const isAudio = quotedMsg.audioMessage;

    console.log(`   Message type detected - Text: ${!!isText}, Image: ${!!isImage}, Video: ${!!isVideo}, Document: ${!!isDocument}, Audio: ${!!isAudio}`);

    // Get all participating groups
    const groups = await conn.groupFetchAllParticipating();
    const groupIds = Object.keys(groups).filter(id => id.endsWith('@g.us'));
    console.log(`   Found ${groupIds.length} groups`);

    if (!groupIds.length) {
      console.log('   ❌ No groups found');
      return reply("❌ No groups found to broadcast to!");
    }

    let successCount = 0;
    let failCount = 0;
    const errors = [];
    const failedGroups = [];

    await reply(`📤 Broadcasting to ${groupIds.length} groups...\n⏳ Please wait...`);

    // Handle TEXT message
    if (isText) {
      const textContent = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text;
      console.log(`   Broadcasting text: "${textContent?.substring(0, 50)}..."`);

      for (const jid of groupIds) {
        try {
          await conn.sendMessage(jid, { text: textContent });
          console.log(`   ✅ Sent to ${jid}`);
          successCount++;
          await delay(2000);
        } catch (e) {
          console.error(`   ❌ Failed to send to ${jid}: ${e.message}`);
          failedGroups.push({ jid, name: groups[jid].subject, type: 'text', content: textContent });
          failCount++;
        }
      }
    }
    
    // Handle IMAGE message
    else if (isImage) {
      console.log('   📥 Downloading image...');
      const stream = await downloadContentFromMessage(isImage, 'image');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }
      console.log(`   ✅ Downloaded ${buffer.length} bytes`);

      const caption = isImage.caption || undefined;

      for (const jid of groupIds) {
        try {
          const msgContent = { image: buffer };
          if (caption) msgContent.caption = caption;
          
          await conn.sendMessage(jid, msgContent);
          console.log(`   ✅ Sent to ${jid}`);
          successCount++;
          await delay(2000);
        } catch (e) {
          console.error(`   ❌ Failed to send to ${jid}: ${e.message}`);
          failedGroups.push({ jid, name: groups[jid].subject, type: 'image', buffer, caption });
          failCount++;
        }
      }
    }
    
    // Handle VIDEO message
    else if (isVideo) {
      console.log('   📥 Downloading video...');
      const stream = await downloadContentFromMessage(isVideo, 'video');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }
      console.log(`   ✅ Downloaded ${buffer.length} bytes`);

      const caption = isVideo.caption || undefined;

      for (const jid of groupIds) {
        try {
          const msgContent = { video: buffer };
          if (caption) msgContent.caption = caption;
          
          await conn.sendMessage(jid, msgContent);
          console.log(`   ✅ Sent to ${jid}`);
          successCount++;
          await delay(2000);
        } catch (e) {
          console.error(`   ❌ Failed to send to ${jid}: ${e.message}`);
          failedGroups.push({ jid, name: groups[jid].subject, type: 'video', buffer, caption });
          failCount++;
        }
      }
    }
    
    // Handle DOCUMENT (PDF, etc.) message
    else if (isDocument) {
      console.log('   📥 Downloading document...');
      const stream = await downloadContentFromMessage(isDocument, 'document');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }
      console.log(`   ✅ Downloaded ${buffer.length} bytes`);

      const fileName = isDocument.fileName || 'document.pdf';
      const caption = isDocument.caption || undefined;
      const mimetype = isDocument.mimetype || 'application/pdf';

      for (const jid of groupIds) {
        try {
          const msgContent = {
            document: buffer,
            fileName: fileName,
            mimetype: mimetype
          };
          if (caption) msgContent.caption = caption;
          
          await conn.sendMessage(jid, msgContent);
          console.log(`   ✅ Sent to ${jid}`);
          successCount++;
          await delay(2000);
        } catch (e) {
          console.error(`   ❌ Failed to send to ${jid}: ${e.message}`);
          failedGroups.push({ jid, name: groups[jid].subject, type: 'document', buffer, fileName, mimetype, caption });
          failCount++;
        }
      }
    }
    
    // Handle AUDIO message
    else if (isAudio) {
      console.log('   📥 Downloading audio...');
      const stream = await downloadContentFromMessage(isAudio, 'audio');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }
      console.log(`   ✅ Downloaded ${buffer.length} bytes`);

      const mimetype = isAudio.mimetype || 'audio/mp4';
      const ptt = isAudio.ptt || false;

      for (const jid of groupIds) {
        try {
          await conn.sendMessage(jid, {
            audio: buffer,
            mimetype: mimetype,
            ptt: ptt
          });
          console.log(`   ✅ Sent to ${jid}`);
          successCount++;
          await delay(2000);
        } catch (e) {
          console.error(`   ❌ Failed to send to ${jid}: ${e.message}`);
          failedGroups.push({ jid, name: groups[jid].subject, type: 'audio', buffer, mimetype, ptt });
          failCount++;
        }
      }
    }
    
    else {
      console.log('   ❌ Unsupported message type');
      return reply("❌ Unsupported message type! Please reply to:\n• Text message\n• Image\n• Video\n• PDF/Document\n• Audio");
    }

    // Retry failed groups with longer delay
    if (failedGroups.length > 0) {
      console.log(`\n🔄 Retrying ${failedGroups.length} failed groups...`);
      await reply(`🔄 Retrying ${failedGroups.length} failed groups...`);
      
      for (const group of failedGroups) {
        try {
          await delay(5000); // 5 second delay for retries
          
          if (group.type === 'text') {
            await conn.sendMessage(group.jid, { text: group.content });
          } else if (group.type === 'image') {
            const msgContent = { image: group.buffer };
            if (group.caption) msgContent.caption = group.caption;
            await conn.sendMessage(group.jid, msgContent);
          } else if (group.type === 'video') {
            const msgContent = { video: group.buffer };
            if (group.caption) msgContent.caption = group.caption;
            await conn.sendMessage(group.jid, msgContent);
          } else if (group.type === 'document') {
            const msgContent = {
              document: group.buffer,
              fileName: group.fileName,
              mimetype: group.mimetype
            };
            if (group.caption) msgContent.caption = group.caption;
            await conn.sendMessage(group.jid, msgContent);
          } else if (group.type === 'audio') {
            await conn.sendMessage(group.jid, {
              audio: group.buffer,
              mimetype: group.mimetype,
              ptt: group.ptt
            });
          }
          
          console.log(`   ✅ Retry successful for ${group.jid}`);
          successCount++;
          failCount--;
        } catch (e) {
          console.error(`   ❌ Retry failed for ${group.jid}: ${e.message}`);
          errors.push(`${group.name}: ${e.message}`);
        }
      }
    }

    // Summary response
    const mediaType = isImage ? 'Image' : isVideo ? 'Video' : isDocument ? 'Document' : isAudio ? 'Audio' : 'Message';
    const response = `📤 *${mediaType} Broadcast Summary*\n\n✅ Sent to: ${successCount} groups\n❌ Failed: ${failCount} groups\n\n${errors.length ? '⚠️ Errors:\n' + errors.slice(0, 5).join('\n') + (errors.length > 5 ? `\n... and ${errors.length - 5} more` : '') : '🎉 All messages sent successfully!'}`;
    console.log(`   Broadcast summary: ${successCount} successes, ${failCount} failures`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return reply(response);

  } catch (e) {
    console.error('❌ Error in bc command:', e);
    return reply(`❌ Error: ${e.message}`);
  }
});

// 📸 Broadcast Media Command (Legacy - kept for compatibility)
cmd({
  pattern: "broadcastmedia",
  desc: "Send a media message to all participating groups (Admin only)",
  category: "admin",
  filename: __filename,
}, async (conn, mek, m, { from, args, reply, isOwner }) => {
  try {
    console.log(`\n📸 BROADCASTMEDIA command from: ${from}`);
    
    // Restrict to bot owner
    if (!isOwner) {
      console.log('   ❌ Access denied - not owner');
      return reply("❌ This command is for the bot owner only!");
    }

    // Check if message has an image or video
    const hasDirectImage = !!mek.message?.imageMessage;
    const hasDirectVideo = !!mek.message?.videoMessage;
    const hasQuotedImage = !!mek.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    const hasQuotedVideo = !!mek.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;

    if (!hasDirectImage && !hasDirectVideo && !hasQuotedImage && !hasQuotedVideo) {
      console.log('   ❌ No media found');
      return reply("❌ Please send or quote an image or video to broadcast!\n\nUsage: .broadcastmedia [caption]");
    }

    // Get caption if provided
    const caption = args.length ? args.join(' ') : undefined;
    console.log(`   Caption: "${caption}"`);

    // Download media
    console.log('   📥 Downloading media...');
    const stream = await downloadContentFromMessage(
      hasDirectImage ? mek.message.imageMessage :
      hasDirectVideo ? mek.message.videoMessage :
      hasQuotedImage ? mek.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage :
      mek.message.extendedTextMessage.contextInfo.quotedMessage.videoMessage,
      hasDirectImage || hasQuotedImage ? 'image' : 'video'
    );

    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    console.log(`   ✅ Downloaded ${buffer.length} bytes`);

    // Get all participating groups
    const groups = await conn.groupFetchAllParticipating();
    const groupIds = Object.keys(groups).filter(id => id.endsWith('@g.us'));
    console.log(`   Found ${groupIds.length} groups`);

    if (!groupIds.length) {
      console.log('   ❌ No groups found');
      return reply("❌ No groups found to broadcast to!");
    }

    // Send broadcast media to each group
    let successCount = 0;
    let failCount = 0;
    const errors = [];
    const failedGroups = [];

    await reply(`📸 Broadcasting to ${groupIds.length} groups...\n⏳ Please wait...`);

    for (const jid of groupIds) {
      try {
        const msgContent = {
          [hasDirectImage || hasQuotedImage ? 'image' : 'video']: buffer
        };
        if (caption) msgContent.caption = caption;
        
        await conn.sendMessage(jid, msgContent);
        console.log(`   ✅ Sent to ${jid}`);
        successCount++;
        await delay(2000);
      } catch (e) {
        console.error(`   ❌ Failed to send to ${jid}: ${e.message}`);
        failedGroups.push({ jid, name: groups[jid].subject });
        failCount++;
      }
    }

    // Retry failed groups
    if (failedGroups.length > 0) {
      console.log(`\n🔄 Retrying ${failedGroups.length} failed groups...`);
      await reply(`🔄 Retrying ${failedGroups.length} failed groups...`);
      
      for (const group of failedGroups) {
        try {
          await delay(5000);
          const msgContent = {
            [hasDirectImage || hasQuotedImage ? 'image' : 'video']: buffer
          };
          if (caption) msgContent.caption = caption;
          
          await conn.sendMessage(group.jid, msgContent);
          console.log(`   ✅ Retry successful for ${group.jid}`);
          successCount++;
          failCount--;
        } catch (e) {
          console.error(`   ❌ Retry failed for ${group.jid}: ${e.message}`);
          errors.push(`${group.name}: ${e.message}`);
        }
      }
    }

    // Summary response
    const response = `📸 *Media Broadcast Summary*\n\n✅ Sent to: ${successCount} groups\n❌ Failed: ${failCount} groups\n\n${errors.length ? '⚠️ Errors:\n' + errors.slice(0, 5).join('\n') + (errors.length > 5 ? `\n... and ${errors.length - 5} more` : '') : '🎉 All media sent successfully!'}`;
    console.log(`   Broadcast summary: ${successCount} successes, ${failCount} failures`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return reply(response);

  } catch (e) {
    console.error('❌ Error in broadcastmedia command:', e.message);
    return reply(`❌ Error: ${e.message}`);
  }
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Broadcast plugin loaded!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('💡 Commands available:');
console.log('   • .broadcast <message> - Send text to all groups');
console.log('   • .bc (reply to message) - Broadcast any message type');
console.log('   • .broadcastmedia [caption] - Send media to all groups');
console.log('   • .listgroups - List all groups');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📢 Ready to broadcast to groups...\n');
