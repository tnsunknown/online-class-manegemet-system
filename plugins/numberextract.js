const { cmd } = require('../command');

console.log('\n╔═══════════════════════════════════════╗');
console.log('║ 📇 EXTRACT GROUP NUMBERS LOADED!     ║');
console.log('╚═══════════════════════════════════════╝\n');

// Helper function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 📋 List Groups with Numbers
cmd({
  pattern: "glist",
  alias: ["grouplist", "listgroups"],
  desc: "List all groups with numbers (Reply with number to extract)",
  category: "admin",
  filename: __filename,
}, async (conn, mek, m, { from, reply, isOwner }) => {
  try {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 GLIST COMMAND INITIATED`);
    console.log(`   👤 Sender: ${from}`);
    console.log(`   ⏰ Time: ${new Date().toLocaleString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Restrict to bot owner
    if (!isOwner) {
      console.log('❌ ACCESS DENIED\n');
      return reply("❌ This command is for the bot owner only!");
    }

    await reply("🔍 Fetching all groups...\n⏳ Please wait...");

    // Get all groups
    const groups = Object.values(await conn.groupFetchAllParticipating());
    
    console.log(`✅ Found ${groups.length} groups\n`);

    if (groups.length === 0) {
      return reply("❌ No groups found!");
    }

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
      response += `   📍 JID: ${group.id}\n\n`;
      
      console.log(`${number}. ${name} (${memberCount} members)`);
    });
    
    response += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    response += `💡 *How to use:*\n`;
    response += `Reply to this message with a group number to extract phone numbers.\n\n`;
    response += `📝 Example: Reply with "5" to extract numbers from group 5`;

    await reply(response);

    console.log('\n✅ GROUP LIST SENT SUCCESSFULLY!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (e) {
    console.error('\n❌ ERROR IN GLIST COMMAND:');
    console.error(`   ${e.message}\n`);
    return reply(`❌ Error: ${e.message}`);
  }
});

// 📇 Handle Reply to Extract Numbers (Using on: "body")
cmd({
  on: "body",
  filename: __filename,
}, async (conn, mek, m, { from, body, reply, isOwner, quoted }) => {
  try {
    // Skip if not owner
    if (!isOwner) return;
    
    // Skip if no body or quoted message
    if (!body || typeof body !== 'string' || !quoted) return;
    
    // Get quoted message text properly
    let quotedText = "";
    if (quoted.msg && typeof quoted.msg === 'string') {
      quotedText = quoted.msg;
    } else if (quoted.text && typeof quoted.text === 'string') {
      quotedText = quoted.text;
    } else if (quoted.message) {
      // Try to extract text from message object
      const msg = quoted.message;
      if (msg.conversation) quotedText = msg.conversation;
      else if (msg.extendedTextMessage?.text) quotedText = msg.extendedTextMessage.text;
    }
    
    // Check if quoted message is from glist command
    if (!quotedText || typeof quotedText !== 'string') return;
    if (!quotedText.includes("📋 *GROUP LIST*") || !quotedText.includes("Reply to this message with a group number")) {
      return;
    }

    // Extract the group number from user's reply (trim whitespace)
    const trimmedBody = body.trim();
    const groupNumber = parseInt(trimmedBody);
    
    // Validate the number
    if (isNaN(groupNumber) || groupNumber < 1) {
      return; // Ignore invalid numbers silently
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📇 GROUP NUMBER EXTRACTION TRIGGERED`);
    console.log(`   👤 Sender: ${from}`);
    console.log(`   🔢 Group Number: ${groupNumber}`);
    console.log(`   📝 Reply Text: "${trimmedBody}"`);
    console.log(`   ⏰ Time: ${new Date().toLocaleString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Get all groups
    const groups = Object.values(await conn.groupFetchAllParticipating());
    
    // Check if group number is valid
    if (groupNumber > groups.length) {
      console.log(`❌ Invalid group number: ${groupNumber} (Max: ${groups.length})\n`);
      return reply(`❌ Invalid group number!\n\nPlease enter a number between 1 and ${groups.length}`);
    }

    // Get the selected group (index is number - 1)
    const selectedGroup = groups[groupNumber - 1];
    const groupJid = selectedGroup.id;
    
    console.log(`🎯 Selected Group: ${selectedGroup.subject}`);
    console.log(`   📍 JID: ${groupJid}\n`);

    // Get group metadata with participant details
    console.log('📊 FETCHING GROUP METADATA...');
    let groupMetadata;
    try {
      groupMetadata = await conn.groupMetadata(groupJid);
      console.log(`✅ Group found: ${groupMetadata.subject}`);
      console.log(`   👥 Total members: ${groupMetadata.participants.length}\n`);
    } catch (e) {
      console.error('❌ GROUP NOT FOUND');
      console.error(`   Error: ${e.message}\n`);
      return reply(`❌ Failed to access group: ${e.message}`);
    }

    const participants = groupMetadata.participants;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 EXTRACTING REAL PHONE NUMBERS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await reply(`🔍 Extracting phone numbers from:\n📍 *${groupMetadata.subject}*\n\n⏳ Please wait...`);

    // Extract real phone numbers from participants
    const extractedData = [];
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i];
      const lid = participant.id;
      const name = participant.notify || 'Unknown';
      
      console.log(`[${i + 1}/${participants.length}] Processing: ${name}`);
      
      let realNumber = null;
      let waJid = null;
      let method = 'Unknown';
      
      // Method 1: Direct JID check
      if (participant.jid && participant.jid.includes('@s.whatsapp.net')) {
        waJid = participant.jid;
        realNumber = participant.jid.split('@')[0];
        method = 'Direct JID';
        console.log(`   ✅ Found: +${realNumber}`);
      }
      // Method 2: Notify field check
      else if (participant.notify) {
        const numMatch = participant.notify.match(/\d{10,15}/);
        if (numMatch) {
          realNumber = numMatch[0];
          waJid = `${realNumber}@s.whatsapp.net`;
          method = 'Notify';
          console.log(`   ✅ Found: +${realNumber}`);
        }
      }
      
      // Method 3: onWhatsApp API
      if (!realNumber) {
        try {
          await delay(300); // Rate limit protection
          const lidNumber = lid.split('@')[0];
          const contact = await conn.onWhatsApp(lidNumber);
          if (contact && contact.length > 0 && contact[0].jid) {
            waJid = contact[0].jid;
            realNumber = contact[0].jid.split('@')[0];
            method = 'API';
            console.log(`   ✅ Found: +${realNumber}`);
          }
        } catch (e) {
          console.log(`   ⚠️ API failed`);
        }
      }
      
      if (realNumber) {
        extractedData.push({
          name: name,
          phoneNumber: realNumber,
          waJid: waJid,
          method: method
        });
        successCount++;
      } else {
        failCount++;
        console.log(`   ❌ Not found`);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 EXTRACTION SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   📍 Group: ${groupMetadata.subject}`);
    console.log(`   🎯 Total Members: ${participants.length}`);
    console.log(`   ✅ Found: ${successCount}`);
    console.log(`   ❌ Not Found: ${failCount}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Generate WhatsApp message response
    let response = `📇 *PHONE NUMBERS EXTRACTED*\n\n`;
    response += `📍 Group: *${groupMetadata.subject}*\n`;
    response += `👥 Total Members: ${participants.length}\n`;
    response += `✅ Numbers Found: ${successCount}\n`;
    response += `❌ Not Found: ${failCount}\n\n`;
    response += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // Add list with names and numbers
    extractedData.forEach((data, i) => {
      response += `${i + 1}. ${data.name}\n`;
      response += `   📱 +${data.phoneNumber}\n\n`;
    });
    
    response += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // Numbers only list
    const numbersList = extractedData
      .map(d => `+${d.phoneNumber}`)
      .join('\n');
    
    response += `📋 *Numbers Only:*\n\n${numbersList}`;
    
    // Send the message with format selection
    response += `\n\n📥 *Download Format:*\n`;
    response += `Reply with format number:\n`;
    response += `1️⃣ - TXT (Text File)\n`;
    response += `2️⃣ - CSV (Excel Compatible)\n`;
    response += `3️⃣ - JSON (Data Format)\n`;
    response += `4️⃣ - PDF (Document)\n`;
    response += `5️⃣ - ALL (All Formats)`;
    
    const formatMessage = await reply(response);

    console.log('⏳ Waiting for format selection...\n');

    // Event handler for format selection
    const formatHandler = async (update) => {
      try {
        const message = update.messages[0];
        if (!message.message) return;
        
        // Check if it's a reply to our format message
        const contextInfo = message.message.extendedTextMessage?.contextInfo;
        if (!contextInfo || contextInfo.stanzaId !== formatMessage.key.id) return;

        const userReply = (message.message.conversation || 
                          message.message.extendedTextMessage?.text || '').trim();
        const formatChoice = parseInt(userReply);

        if (isNaN(formatChoice) || formatChoice < 1 || formatChoice > 5) {
          await conn.sendMessage(from, { 
            text: "❌ Invalid choice! Please reply with 1, 2, 3, 4, or 5" 
          }, { quoted: message });
          return;
        }

        console.log(`📥 Format selected: ${formatChoice}\n`);
        await conn.sendMessage(from, { 
          text: "⏳ Generating file(s)... Please wait..." 
        }, { quoted: message });

        const groupNameClean = groupMetadata.subject.replace(/[^a-zA-Z0-9]/g, '_');
        const timestamp = Date.now();

        // Helper function to send document
        const sendDoc = async (buffer, fileName, mimetype, caption) => {
          await conn.sendMessage(from, {
            document: buffer,
            fileName: fileName,
            mimetype: mimetype,
            caption: caption
          }, { quoted: message });
        };

        // 1️⃣ TXT Format
        if (formatChoice === 1 || formatChoice === 5) {
          console.log('📄 Creating TXT file...');
          let txtContent = `═══════════════════════════════════════════════════\n`;
          txtContent += `        EXTRACTED PHONE NUMBERS\n`;
          txtContent += `═══════════════════════════════════════════════════\n\n`;
          txtContent += `Group Name: ${groupMetadata.subject}\n`;
          txtContent += `Group JID: ${groupJid}\n`;
          txtContent += `Total Members: ${participants.length}\n`;
          txtContent += `Numbers Found: ${successCount}\n`;
          txtContent += `Numbers Not Found: ${failCount}\n`;
          txtContent += `Extracted Date: ${new Date().toLocaleString()}\n\n`;
          txtContent += `═══════════════════════════════════════════════════\n\n`;
          txtContent += `DETAILED LIST:\n\n`;
          extractedData.forEach((data, i) => {
            txtContent += `${i + 1}. ${data.name}\n`;
            txtContent += `   Phone: +${data.phoneNumber}\n`;
            txtContent += `   WhatsApp JID: ${data.waJid}\n`;
            txtContent += `   Method: ${data.method}\n\n`;
          });
          txtContent += `═══════════════════════════════════════════════════\n\n`;
          txtContent += `NUMBERS ONLY:\n\n${numbersList}\n\n`;
          txtContent += `═══════════════════════════════════════════════════\n`;

          await sendDoc(
            Buffer.from(txtContent, 'utf-8'),
            `${groupNameClean}_${timestamp}.txt`,
            'text/plain',
            '📄 TXT Format - Text File'
          );
          console.log('✅ TXT sent!\n');
        }

        // 2️⃣ CSV Format
        if (formatChoice === 2 || formatChoice === 5) {
          console.log('📊 Creating CSV file...');
          let csvContent = 'No,Name,Phone Number,WhatsApp JID,Method,Group Name\n';
          extractedData.forEach((data, i) => {
            const name = data.name.replace(/,/g, ' '); // Remove commas from name
            csvContent += `${i + 1},"${name}",+${data.phoneNumber},${data.waJid},${data.method},"${groupMetadata.subject}"\n`;
          });

          await sendDoc(
            Buffer.from(csvContent, 'utf-8'),
            `${groupNameClean}_${timestamp}.csv`,
            'text/csv',
            '📊 CSV Format - Excel Compatible'
          );
          console.log('✅ CSV sent!\n');
        }

        // 3️⃣ JSON Format
        if (formatChoice === 3 || formatChoice === 5) {
          console.log('📋 Creating JSON file...');
          const jsonData = {
            metadata: {
              groupName: groupMetadata.subject,
              groupJid: groupJid,
              totalMembers: participants.length,
              numbersFound: successCount,
              numbersNotFound: failCount,
              extractedDate: new Date().toISOString(),
              extractedBy: from
            },
            contacts: extractedData.map((data, i) => ({
              index: i + 1,
              name: data.name,
              phoneNumber: `+${data.phoneNumber}`,
              whatsappJid: data.waJid,
              extractionMethod: data.method
            })),
            numbersOnly: extractedData.map(d => `+${d.phoneNumber}`)
          };

          await sendDoc(
            Buffer.from(JSON.stringify(jsonData, null, 2), 'utf-8'),
            `${groupNameClean}_${timestamp}.json`,
            'application/json',
            '📋 JSON Format - Data Structure'
          );
          console.log('✅ JSON sent!\n');
        }

        // 4️⃣ PDF Format (Simple text-based PDF)
        if (formatChoice === 4 || formatChoice === 5) {
          console.log('📕 Creating PDF file...');
          // Simple text content formatted for PDF viewers
          let pdfContent = `EXTRACTED PHONE NUMBERS
═══════════════════════════════════════

Group: ${groupMetadata.subject}
Total Members: ${participants.length}
Numbers Found: ${successCount}
Extracted: ${new Date().toLocaleString()}

═══════════════════════════════════════

CONTACT LIST:

`;
          extractedData.forEach((data, i) => {
            pdfContent += `${i + 1}. ${data.name}\n`;
            pdfContent += `   📱 +${data.phoneNumber}\n`;
            pdfContent += `   WhatsApp: ${data.waJid}\n\n`;
          });

          pdfContent += `\n═══════════════════════════════════════\n\n`;
          pdfContent += `NUMBERS ONLY:\n\n${numbersList}`;

          await sendDoc(
            Buffer.from(pdfContent, 'utf-8'),
            `${groupNameClean}_${timestamp}.pdf`,
            'application/pdf',
            '📕 PDF Format - Document'
          );
          console.log('✅ PDF sent!\n');
        }

        await conn.sendMessage(from, { 
          text: `✅ File(s) sent successfully!\n\n📍 Group: ${groupMetadata.subject}\n✅ ${successCount} numbers extracted` 
        }, { quoted: message });

        // Remove event listener
        conn.ev.off("messages.upsert", formatHandler);
        
      } catch (error) {
        console.error('❌ Error generating file:', error);
        await conn.sendMessage(from, { 
          text: `❌ Error generating file: ${error.message}` 
        });
      }
    };

    // Add event listener
    conn.ev.on("messages.upsert", formatHandler);

    // Auto-remove listener after 5 minutes
    setTimeout(() => {
      conn.ev.off("messages.upsert", formatHandler);
      console.log('⏱️ Format selection timed out\n');
    }, 300000);
    
    console.log('✅ TEXT DOCUMENT SENT!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ EXTRACTION COMPLETED SUCCESSFULLY!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (e) {
    console.error('\n❌ ERROR IN NUMBER EXTRACTION:');
    console.error(`   ${e.message}`);
    console.error(`   Stack: ${e.stack}\n`);
    
    // Only reply if we're sure this was a number extraction attempt
    if (quoted && quoted.text && quoted.text.includes("📋 *GROUP LIST*")) {
      return reply(`❌ Error extracting numbers: ${e.message}`);
    }
  }
});

// 📇 Original extractnumbers command (keeping for direct JID usage)
cmd({
  pattern: "extractnumbers",
  alias: ["getnumbers", "groupnumbers"],
  desc: "Extract phone numbers from a group using JID",
  category: "admin",
  filename: __filename,
}, async (conn, mek, m, { from, args, reply, isOwner }) => {
  try {
    if (!isOwner) {
      return reply("❌ This command is for the bot owner only!");
    }

    if (!args.length) {
      return reply("❌ Please provide group JID!\n\n📖 Usage: .extractnumbers <group_jid>\n\n💡 Or use .glist for easier extraction");
    }

    const groupJid = args[0].trim();

    if (!groupJid.endsWith('@g.us')) {
      return reply("❌ Invalid group JID format!\n\nJID must end with @g.us");
    }

    let groupMetadata;
    try {
      groupMetadata = await conn.groupMetadata(groupJid);
    } catch (e) {
      return reply(`❌ Group not found!\n\n💡 Use .glist to see available groups`);
    }

    const participants = groupMetadata.participants;
    await reply(`🔍 Extracting from "${groupMetadata.subject}"...\n⏳ Please wait...`);

    const extractedData = [];
    let successCount = 0;
    
    for (const participant of participants) {
      const lid = participant.id;
      const name = participant.notify || 'Unknown';
      let realNumber = null;
      let waJid = null;
      
      if (participant.jid && participant.jid.includes('@s.whatsapp.net')) {
        waJid = participant.jid;
        realNumber = participant.jid.split('@')[0];
      } else if (participant.notify) {
        const numMatch = participant.notify.match(/\d{10,15}/);
        if (numMatch) {
          realNumber = numMatch[0];
          waJid = `${realNumber}@s.whatsapp.net`;
        }
      }
      
      if (!realNumber) {
        try {
          await delay(300);
          const lidNumber = lid.split('@')[0];
          const contact = await conn.onWhatsApp(lidNumber);
          if (contact && contact.length > 0 && contact[0].jid) {
            waJid = contact[0].jid;
            realNumber = contact[0].jid.split('@')[0];
          }
        } catch (e) {}
      }
      
      if (realNumber) {
        extractedData.push({ name, phoneNumber: realNumber, waJid });
        successCount++;
      }
    }

    let response = `📇 *Numbers Extracted*\n\n`;
    response += `📍 ${groupMetadata.subject}\n`;
    response += `✅ Found: ${successCount}/${participants.length}\n\n`;
    response += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    extractedData.forEach((d, i) => {
      response += `${i + 1}. ${d.name}\n   📱 +${d.phoneNumber}\n\n`;
    });
    
    const numbersList = extractedData.map(d => `+${d.phoneNumber}`).join('\n');
    response += `━━━━━━━━━━━━━━━━━━━━━━\n\n📋 *Numbers Only:*\n\n${numbersList}`;
    
    await reply(response);

    if (successCount > 0) {
      let fileContent = `Group: ${groupMetadata.subject}\n`;
      fileContent += `Total: ${participants.length}\n`;
      fileContent += `Found: ${successCount}\n\n`;
      fileContent += `NUMBERS:\n\n${numbersList}`;
      
      const buffer = Buffer.from(fileContent, 'utf-8');
      await conn.sendMessage(from, {
        document: buffer,
        fileName: `${groupMetadata.subject.replace(/[^a-zA-Z0-9]/g, '_')}_numbers.txt`,
        mimetype: 'text/plain',
        caption: '📄 Extracted phone numbers'
      }, { quoted: mek });
    }

  } catch (e) {
    return reply(`❌ Error: ${e.message}`);
  }
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Enhanced Number Extractor loaded!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('💡 Commands:');
console.log('   • .glist - List groups with numbers');
console.log('   • Reply number - Extract from that group');
console.log('   • .extractnumbers <jid> - Direct extract');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
