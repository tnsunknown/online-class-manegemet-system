const { cmd } = require('../command');
const { makeWASocket } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

console.log('\n╔════════════════════════════════════╗');
console.log('║ 📢 GROUP BROADCAST PLUGIN LOADED! ║');
console.log('╚════════════════════════════════════╝\n');

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

    // Send broadcast message to each group
    let successCount = 0;
    let failCount = 0;
    const errors = [];

    for (const jid of groupIds) {
      try {
        await conn.sendMessage(jid, { text: `📢 \n\n${message}` });
        console.log(`   ✅ Sent to ${jid}`);
        successCount++;
      } catch (e) {
        console.error(`   ❌ Failed to send to ${jid}: ${e.message}`);
        errors.push(`Failed to send to ${groups[jid].subject}: ${e.message}`);
        failCount++;
      }
    }

    // Summary response
    const response = `📢 *Broadcast Summary*\n\n✅ Sent to: ${successCount} groups\n❌ Failed: ${failCount} groups\n\n${errors.length ? '⚠️ Errors:\n' + errors.join('\n') : '🎉 All messages sent successfully!'}\n\n💡 Use .listgroups to see all groups.`;
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

// 📸 Broadcast Media Command
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
    const caption = args.length ? args.join(' ') : "📢 ";
    console.log(`   Caption: "${caption}"`);

    // Download media
    console.log('   📥 Downloading media...');
    const stream = await require('@whiskeysockets/baileys').downloadContentFromMessage(
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

    for (const jid of groupIds) {
      try {
        await conn.sendMessage(jid, {
          [hasDirectImage || hasQuotedImage ? 'image' : 'video']: buffer,
          caption: `📢\n\n${caption}`
        });
        console.log(`   ✅ Sent to ${jid}`);
        successCount++;
      } catch (e) {
        console.error(`   ❌ Failed to send to ${jid}: ${e.message}`);
        errors.push(`Failed to send to ${groups[jid].subject}: ${e.message}`);
        failCount++;
      }
    }

    // Summary response
    const response = `📸 *Media Broadcast Summary*\n\n✅ Sent to: ${successCount} groups\n❌ Failed: ${failCount} groups\n\n${errors.length ? '⚠️ Errors:\n' + errors.join('\n') : '🎉 All media sent successfully!'}\n\n💡 Use .listgroups to see all groups.`;
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
console.log('   • .broadcastmedia [caption] - Send media to all groups');
console.log('   • .listgroups - List all groups');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📢 Ready to broadcast to groups...\n');
