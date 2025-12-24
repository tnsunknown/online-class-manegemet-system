const { cmd } = require('../command');

console.log('\n╔═══════════════════════════════════════════════════╗');
console.log('║ 🤖 GROUP MEMBER ADDER (GADD) LOADED!             ║');
console.log('╚═══════════════════════════════════════════════════╝\n');

// Helper function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Store temporary data
const pendingGaddData = new Map();

// Parse time string (5m, 10m, 2h, etc.)
function parseTimeString(timeStr) {
  const match = timeStr.match(/^(\d+)([mh])$/i);
  if (!match) return null;
  
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  if (unit === 'm') {
    return value * 60 * 1000;
  } else if (unit === 'h') {
    return value * 60 * 60 * 1000;
  }
  return null;
}

// Calculate optimal delays
function calculateDelays(totalMembers, timeLimit) {
  const usableTime = timeLimit * 0.9;
  const MIN_MEMBER_DELAY = 1000;
  const MIN_BATCH_DELAY = 5000;
  const BATCH_SIZE = 4;
  const batchCount = Math.ceil(totalMembers / BATCH_SIZE);
  const totalDelayPoints = (totalMembers - batchCount) + (batchCount - 1);
  
  if (totalDelayPoints === 0) {
    return {
      batchSize: BATCH_SIZE,
      memberDelay: MIN_MEMBER_DELAY,
      batchDelay: MIN_BATCH_DELAY,
      estimatedTime: 0,
      batchCount: 1
    };
  }
  
  const averageDelay = usableTime / totalDelayPoints;
  const memberDelay = Math.max(MIN_MEMBER_DELAY, Math.floor(averageDelay * 0.4));
  const batchDelay = Math.max(MIN_BATCH_DELAY, Math.floor(averageDelay * 0.6));
  const estimatedTime = ((totalMembers - batchCount) * memberDelay) + ((batchCount - 1) * batchDelay);
  
  return {
    batchSize: BATCH_SIZE,
    memberDelay,
    batchDelay,
    estimatedTime,
    batchCount
  };
}

// Format time
function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// 📋 List Groups (same as before but stores data for gadd)
cmd({
  pattern: "glist",
  alias: ["grouplist", "listgroups"],
  desc: "List all groups (Reply with .gadd to add members)",
  category: "admin",
  filename: __filename,
}, async (conn, mek, m, { from, reply, isOwner }) => {
  try {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 PLIST COMMAND INITIATED`);
    console.log(`   👤 Sender: ${from}`);
    console.log(`   ⏰ Time: ${new Date().toLocaleString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (!isOwner) {
      console.log('❌ ACCESS DENIED\n');
      return reply("❌ This command is for the bot owner only!");
    }

    await reply("🔍 Fetching all groups...\n⏳ Please wait...");

    const groups = Object.values(await conn.groupFetchAllParticipating());
    
    console.log(`✅ Found ${groups.length} groups\n`);

    if (groups.length === 0) {
      return reply("❌ No groups found!");
    }

    // Store groups data
    const dataKey = from;
    pendingGaddData.set(dataKey, {
      groups: groups,
      timestamp: Date.now()
    });

    // Create numbered list
    let response = `📋 *GROUP LIST*\n\n`;
    response += `🤖 Total Groups: ${groups.length}\n\n`;
    response += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    groups.forEach((group, index) => {
      const number = index + 1;
      const name = group.subject || 'Unknown Group';
      const memberCount = group.participants ? group.participants.length : 0;
      
      response += `${number}. *${name}*\n`;
      response += `   👥 Members: ${memberCount}\n`;
      response += `   📍 JID: \`${group.id}\`\n\n`;
      
      console.log(`${number}. ${name} (${memberCount} members)`);
    });
    
    response += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    response += `🤖 *ADD MEMBERS TO EXISTING GROUP*\n\n`;
    response += `📝 *Reply Format:*\n`;
    response += `\`.gadd <target_jid>, group_numbers, time\`\n\n`;
    response += `*Examples:*\n`;
    response += `• \`.gadd 120363xxx@g.us, 1, 5m\`\n`;
    response += `  → Add group 1 members in 5 min\n\n`;
    response += `• \`.gadd 120363xxx@g.us, 1,3,5, 10m\`\n`;
    response += `  → Add groups 1,3,5 in 10 min\n\n`;
    response += `⏱️ *Time Format:*\n`;
    response += `• \`m\` = minutes (e.g., 5m)\n`;
    response += `• \`h\` = hours (e.g., 2h)\n\n`;
    response += `⚠️ *Note:* Admins excluded automatically`;

    await reply(response);

    console.log('\n✅ GROUP LIST SENT!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (e) {
    console.error('\n❌ ERROR IN PLIST:');
    console.error(`   ${e.message}\n`);
    return reply(`❌ Error: ${e.message}`);
  }
});

// 🤖 Handle .gadd command in reply
cmd({
  on: "body",
  filename: __filename,
}, async (conn, mek, m, { from, body, reply, isOwner, quoted }) => {
  try {
    if (!isOwner) return;
    if (!body || typeof body !== 'string' || !quoted) return;
    
    // Check if body starts with .gadd
    const trimmedBody = body.trim();
    if (!trimmedBody.toLowerCase().startsWith('.gadd')) return;
    
    // Get quoted text
    let quotedText = "";
    if (quoted.msg && typeof quoted.msg === 'string') {
      quotedText = quoted.msg;
    } else if (quoted.text && typeof quoted.text === 'string') {
      quotedText = quoted.text;
    } else if (quoted.message) {
      const msg = quoted.message;
      if (msg.conversation) quotedText = msg.conversation;
      else if (msg.extendedTextMessage?.text) quotedText = msg.extendedTextMessage.text;
    }
    
    // Check if quoted message is from plist
    if (!quotedText || typeof quotedText !== 'string') return;
    if (!quotedText.includes("📋 *GROUP LIST*") || !quotedText.includes("ADD MEMBERS TO EXISTING GROUP")) {
      return;
    }

    // Check data
    const dataKey = from;
    if (!pendingGaddData.has(dataKey)) {
      return reply("❌ Data expired! Run .plist again.");
    }

    const savedData = pendingGaddData.get(dataKey);
    const groups = savedData.groups;

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🤖 GADD COMMAND TRIGGERED`);
    console.log(`   👤 Sender: ${from}`);
    console.log(`   📝 Input: "${trimmedBody}"`);
    console.log(`   ⏰ Time: ${new Date().toLocaleString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Parse: .gadd <jid>, 1,2,3, 5m
    const commandRemoved = trimmedBody.substring(5).trim(); // Remove ".gadd"
    const parts = commandRemoved.split(',').map(p => p.trim());
    
    if (parts.length < 3) {
      return reply("❌ Invalid format!\n\n📝 Use: `.gadd <jid>, group_numbers, time`\n\n💡 Example: `.gadd 120363xxx@g.us, 1,3, 5m`");
    }

    // First part is target JID
    const targetJid = parts[0];
    
    // Validate JID format
    if (!targetJid.includes('@g.us')) {
      return reply("❌ Invalid group JID!\n\n💡 JID must end with @g.us\n📝 Example: 120363xxx@g.us");
    }

    // Last part is time
    const timeString = parts[parts.length - 1];
    const timeLimit = parseTimeString(timeString);
    
    if (!timeLimit) {
      return reply("❌ Invalid time format!\n\n💡 Use: 5m (minutes) or 2h (hours)");
    }

    // Middle parts are group numbers
    const groupNumbers = parts.slice(1, -1)
      .join(',')
      .split(',')
      .map(n => parseInt(n.trim()))
      .filter(n => !isNaN(n) && n > 0);

    if (groupNumbers.length === 0) {
      return reply("❌ No valid group numbers!\n\n💡 Example: `.gadd 120363xxx@g.us, 1,3,5, 5m`");
    }

    console.log(`📊 PARSED INPUT:`);
    console.log(`   🎯 Target JID: ${targetJid}`);
    console.log(`   🔢 Source Groups: ${groupNumbers.join(', ')}`);
    console.log(`   ⏱️ Time Limit: ${formatTime(timeLimit)}\n`);

    // Validate group numbers
    const invalidNumbers = groupNumbers.filter(n => n > groups.length);
    if (invalidNumbers.length > 0) {
      return reply(`❌ Invalid group number(s): ${invalidNumbers.join(', ')}\n\nSelect from 1 to ${groups.length}`);
    }

    // Verify target group exists
    try {
      await conn.groupMetadata(targetJid);
    } catch (e) {
      return reply(`❌ Target group not found!\n\n📍 JID: ${targetJid}\n⚠️ Make sure the bot is in this group.`);
    }

    await reply(`🔍 Extracting members from ${groupNumbers.length} group(s)...\n🔄 Converting to real numbers...\n⏳ Please wait...`);

    // Collect members
    const allMembers = new Set();
    const selectedGroupNames = [];
    
    console.log('📊 COLLECTING MEMBERS...\n');
    
    for (const num of groupNumbers) {
      const group = groups[num - 1];
      const groupJid = group.id;
      selectedGroupNames.push(group.subject || 'Unknown');
      
      console.log(`[Group ${num}] ${group.subject}`);
      
      try {
        const metadata = await conn.groupMetadata(groupJid);
        const participants = metadata.participants || [];
        
        console.log(`   👥 Total members: ${participants.length}`);
        
        const nonAdminMembers = participants.filter(p => {
          const isAdmin = p.admin === 'admin' || p.admin === 'superadmin';
          return !isAdmin;
        });
        
        console.log(`   ✅ Non-admin members: ${nonAdminMembers.length}`);
        
        let addedCount = 0;
        
        for (const participant of nonAdminMembers) {
          try {
            const lid = participant.id;
            let waJid = null;
            
            // Method 1: Direct JID
            if (participant.jid && participant.jid.includes('@s.whatsapp.net')) {
              waJid = participant.jid;
            }
            // Method 2: Notify field
            else if (participant.notify) {
              const numMatch = participant.notify.match(/\d{10,15}/);
              if (numMatch) {
                waJid = `${numMatch[0]}@s.whatsapp.net`;
              }
            }
            
            // Method 3: onWhatsApp API
            if (!waJid && lid) {
              try {
                await delay(300);
                const lidNumber = lid.split('@')[0];
                const contact = await conn.onWhatsApp(lidNumber);
                if (contact && contact.length > 0 && contact[0].jid) {
                  waJid = contact[0].jid;
                }
              } catch (e) {}
            }
            
            if (waJid && waJid.includes('@s.whatsapp.net')) {
              allMembers.add(waJid);
              addedCount++;
            }
            
          } catch (error) {
            console.log(`      ⚠️ Error: ${error.message}`);
          }
        }
        
        console.log(`   📥 Added: ${addedCount}\n`);
        await delay(500);
        
      } catch (e) {
        console.log(`   ❌ Error: ${e.message}\n`);
      }
    }

    const memberArray = Array.from(allMembers);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 MEMBER COLLECTION SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   🎯 Groups Selected: ${groupNumbers.length}`);
    console.log(`   👥 Total Members: ${memberArray.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (memberArray.length === 0) {
      return reply("❌ No members found!");
    }

    // Calculate optimal delays
    const timing = calculateDelays(memberArray.length, timeLimit);
    
    console.log('⏱️ CALCULATED TIMING:');
    console.log(`   👥 Members: ${memberArray.length}`);
    console.log(`   📦 Batches: ${timing.batchCount}`);
    console.log(`   ⏱️ Member Delay: ${timing.memberDelay}ms`);
    console.log(`   ⏱️ Batch Delay: ${timing.batchDelay}ms`);
    console.log(`   ⌛ Estimated: ${formatTime(timing.estimatedTime)}`);
    console.log(`   🎯 Limit: ${formatTime(timeLimit)}\n`);

    // Get target group info
    let targetGroupName = "Unknown Group";
    try {
      const targetMeta = await conn.groupMetadata(targetJid);
      targetGroupName = targetMeta.subject || "Unknown Group";
    } catch (e) {}

    await reply(`🤖 *ADDING MEMBERS*\n\n📍 Target: *${targetGroupName}*\n🔗 JID: ${targetJid}\n👥 Members: ${memberArray.length}\n⏱️ Time: ${formatTime(timeLimit)}\n⌛ Est: ${formatTime(timing.estimatedTime)}\n\n🔄 Starting...`);

    // Add members
    let successCount = 0;
    let failCount = 0;
    const startTime = Date.now();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👥 ADDING MEMBERS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (let i = 0; i < memberArray.length; i += timing.batchSize) {
      const batch = memberArray.slice(i, i + timing.batchSize);
      const batchNum = Math.floor(i / timing.batchSize) + 1;
      
      console.log(`\n📦 BATCH ${batchNum}/${timing.batchCount}`);
      
      for (let j = 0; j < batch.length; j++) {
        const memberJid = batch[j];
        const memberNum = memberJid.split('@')[0];
        const globalIndex = i + j + 1;
        
        try {
          console.log(`[${globalIndex}/${memberArray.length}] Adding: +${memberNum}`);
          
          const result = await conn.groupParticipantsUpdate(targetJid, [memberJid], "add");
          
          if (result && result[0] && result[0].status === "200") {
            successCount++;
            console.log(`   ✅ Success`);
          } else {
            failCount++;
            console.log(`   ⚠️ Failed`);
          }
          
          if (j < batch.length - 1) {
            await delay(timing.memberDelay);
          }
          
        } catch (e) {
          failCount++;
          console.log(`   ❌ Error: ${e.message}`);
        }
      }
      
      // Progress update
      if (batchNum % 2 === 0 || i + timing.batchSize >= memberArray.length) {
        const elapsed = Date.now() - startTime;
        const progressPercent = Math.round((successCount / memberArray.length) * 100);
        await reply(`📊 *Progress*\n\n${successCount}/${memberArray.length} (${progressPercent}%)\n⌛ ${formatTime(elapsed)}\n\n✅ Success: ${successCount}\n❌ Failed: ${failCount}`);
      }
      
      if (i + timing.batchSize < memberArray.length) {
        await delay(timing.batchDelay);
      }
    }

    const totalTime = Date.now() - startTime;
    const successRate = Math.round((successCount / memberArray.length) * 100);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ COMPLETED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   📍 Target: ${targetGroupName}`);
    console.log(`   ✅ Added: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📈 Rate: ${successRate}%`);
    console.log(`   ⌛ Time: ${formatTime(totalTime)}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let finalResponse = `✅ *MEMBERS ADDED!*\n\n`;
    finalResponse += `📍 *Target:* ${targetGroupName}\n`;
    finalResponse += `🔗 *JID:* ${targetJid}\n\n`;
    finalResponse += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    finalResponse += `📊 *Statistics:*\n`;
    finalResponse += `👥 Total: ${memberArray.length}\n`;
    finalResponse += `✅ Added: ${successCount}\n`;
    finalResponse += `❌ Failed: ${failCount}\n`;
    finalResponse += `📈 Success: ${successRate}%\n`;
    finalResponse += `⌛ Time: ${formatTime(totalTime)}\n\n`;
    finalResponse += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    finalResponse += `📋 *Source Groups:*\n`;
    selectedGroupNames.forEach((name, i) => {
      finalResponse += `${i + 1}. ${name}\n`;
    });

    await reply(finalResponse);

    pendingGaddData.delete(dataKey);

  } catch (e) {
    console.error('\n❌ ERROR:');
    console.error(`   ${e.message}\n`);
    
    if (body && body.toLowerCase().startsWith('.gadd')) {
      return reply(`❌ Error: ${e.message}`);
    }
  }
});

// Cleanup old data
setInterval(() => {
  const now = Date.now();
  const expireTime = 10 * 60 * 1000;
  
  for (const [key, data] of pendingGaddData.entries()) {
    if (now - data.timestamp > expireTime) {
      pendingGaddData.delete(key);
      console.log(`🗑️ Cleaned: ${key}`);
    }
  }
}, 600000);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Group Member Adder (gadd) loaded!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('💡 Usage:');
console.log('   1. .plist - List groups');
console.log('   2. Reply: .gadd <jid>, 1,2,3, 5m');
console.log('   3. Members added to target group');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
