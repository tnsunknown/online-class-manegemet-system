const { cmd } = require('../command');

// Event listener for deleted messages - Global array to store deleted messages
let deletedMessages = []; 

// DO NOT call this at the end of the file - will be called by the bot when loading
// This event handler will be properly initialized when the bot is ready and robin is defined
cmd({
  pattern: "setuplisteners",
  desc: "Internal command to setup event listeners",
  category: "system",
  filename: __filename,
  isHidden: true
},
async (robin, mek, m) => {
  // Set up the event listener for deleted messages
  robin.ev.on('messages.delete', async (data) => {
    if (data.keys && data.keys.length > 0) {
      for (let key of data.keys) {
        try {
          const msg = await robin.loadMessage(key.remoteJid, key.id);
          if (msg) {
            const deletedMsg = {
              content: msg.message?.conversation || msg.message?.extendedTextMessage?.text || "No content",
              sender: key.participant || key.fromMe ? robin.user.id : key.remoteJid,
              timestamp: Date.now(),
              chatId: key.remoteJid
            };
            
            deletedMessages.push(deletedMsg);
            
            // Limit array size to prevent memory issues
            if (deletedMessages.length > 100) {
              deletedMessages.shift(); // Remove oldest message
            }
            
            // Immediately notify about the deleted message in the same chat
            robin.sendMessage(key.remoteJid, {
              text: `*⚠️ Deleted message detected*\n\n📝 Message: ${deletedMsg.content}\n👤 Sender: @${deletedMsg.sender.split('@')[0]}\n⏰ Time: ${new Date().toLocaleTimeString()}`,
              mentions: [deletedMsg.sender]
            });
          }
        } catch (error) {
          console.log("Error handling deleted message:", error);
        }
      }
    }
  });
  
  console.log("✅ Event listeners setup successfully");
});

cmd({
  pattern: "block",
  react: "⚠️",
  alias: ["ban"],
  desc: "Block a user instantly.",
  category: "admin",
  filename: __filename
},
async (robin, mek, m, { quoted, reply, isOwner }) => {
  try {
    // Check if the user is the bot owner
    if (!isOwner) return reply("⚠️ Only the owner can use this command!☃️");

    // Check if the command is used on a quoted message
    if (!quoted) return reply("⚠️ Please reply to the user's message to block them!☃️");

    // Extract the target user from the quoted message
    const target = quoted.sender;

    // Block the target user
    await robin.updateBlockStatus(target, "block");

    // Confirm success
    return reply(`✅ Successfully blocked☃️: @${target.split('@')[0]}`);
  } catch (e) {
    console.error("Block Error:", e);
    return reply(`❌ Failed to block the user. Error: ${e.message}`);
  }
});

cmd({
  pattern: "kick",
  alias: ["remove", "ban"],
  react: "⚠️",
  desc: "Remove a mentioned user from the group.",
  category: "admin",
  filename: __filename
},
async (robin, mek, m, { from, isGroup, isOwner, isAdmins, isBotAdmins, reply, quoted }) => {
  try {
    // Check if the command is used in a group
    if (!isGroup) return reply("⚠️ This command can only be used in a group!☃️");

    // Check if the user issuing the command is an admin or owner
    if (!isOwner && !isAdmins) return reply("⚠️ Only group admins can use this command!☃️");

    // Check if the bot is an admin
    if (!isBotAdmins) return reply("⚠️ I need to be an admin to execute this command!☃️");

    // Ensure a user is mentioned
    if (!quoted) return reply("⚠️ Please reply to the user's message you want to kick!☃️");

    // Get the target user to remove
    const target = quoted.sender;

    // Ensure the target is not another admin
    const groupMetadata = await robin.groupMetadata(from);
    const groupAdmins = groupMetadata.participants.filter(participant => participant.admin).map(admin => admin.id);

    if (groupAdmins.includes(target)) {
      return reply("⚠️ I cannot remove another admin from the group!☃️");
    }

    // Kick the target user
    await robin.groupParticipantsUpdate(from, [target], "remove");

    // Confirm the action
    return reply(`✅ Successfully removed☃️: @${target.split('@')[0]}`);
  } catch (e) {
    console.error("Kick Error:", e);
    reply(`❌ Failed to remove the user. Error: ${e.message}`);
  }
});

cmd({
  pattern: "left",
  alias: ["leave", "exit"],
  react: "⚠️",
  desc: "Leave the current group.",
  category: "admin",
  filename: __filename
},
async (robin, mek, m, { from, isGroup, isOwner, isAdmins, reply }) => {
  try {
    // Check if the command is used in a group
    if (!isGroup) return reply("⚠️ This command can only be used in a group!☃️");

    // Check if the user is the bot owner or admin
    if (!isOwner && !isAdmins) return reply("⚠️ Only the owner and admins can use this command!☃️");

    // Leave the group
    await robin.groupLeave(from);

    // Confirm leaving
    console.log(`✅ Successfully left the group☃️: ${from}`);
  } catch (e) {
    console.error("Leave Error:", e);
    reply(`❌ Failed to leave the group. Error: ${e.message}`);
  }
});

cmd({
  pattern: "mute",
  alias: ["silence", "lock"],
  react: "⚠️",
  desc: "Set group chat to admin-only messages.",
  category: "admin",
  filename: __filename
},
async (robin, mek, m, { from, isGroup, isOwner, isAdmins, isBotAdmins, reply }) => {
  try {
    // Check if the command is used in a group
    if (!isGroup) return reply("⚠️ This command can only be used in a group!☃️");

    // Check if the user is an admin or owner
    if (!isOwner && !isAdmins) return reply("⚠️ Only the owner and admins can use this command!☃️");

    // Check if the bot is an admin
    if (!isBotAdmins) return reply("⚠️ I need to be an admin to execute this command!☃️");

    // Set the group to admin-only
    await robin.groupSettingUpdate(from, "announcement");

    // Confirm the action
    return reply("✅ Group has been muted by ❄️Frozen Queen❄️. Only admins can send messages now!☃️");
  } catch (e) {
    console.error("Mute Error:", e);
    reply(`❌ Failed to mute the group. Error: ${e.message}`);
  }
});

cmd({
  pattern: "unmute",
  alias: ["unlock"],
  react: "⚠️",
  desc: "Allow everyone to send messages in the group.",
  category: "admin",
  filename: __filename
},
async (robin, mek, m, { from, isGroup, isOwner, isAdmins, isBotAdmins, reply }) => {
  try {
    // Check if the command is used in a group
    if (!isGroup) return reply("⚠️ This command can only be used in a group!☃️");

    // Check if the user is an admin or owner
    if (!isOwner && !isAdmins) return reply("⚠️ Only the owner and admins can use this command!☃️");

    // Check if the bot is an admin
    if (!isBotAdmins) return reply("⚠️ I need to be an admin to execute this command!☃️");

    // Set the group to everyone can message
    await robin.groupSettingUpdate(from, "not_announcement");

    // Confirm the action
    return reply("✅ Group has been unmuted by ❄️Frozen Queen❄️. Everyone can send messages now!☃️");
  } catch (e) {
    console.error("Unmute Error:", e);
    reply(`❌ Failed to unmute the group. Error: ${e.message}`);
  }
});

cmd({
  pattern: "add",
  alias: ["invite"],
  react: "➕",
  desc: "Add a user to the group.",
  category: "admin",
  filename: __filename
},
async (robin, mek, m, { from, isGroup, isOwner, isAdmins, isBotAdmins, reply, args }) => {
  try {
    // Check if the command is used in a group
    if (!isGroup) return reply("⚠️ This command can only be used in a group!☃️");

    // Check if the user issuing the command is an admin or owner
    if (!isOwner && !isAdmins) return reply("⚠️ Only the owner and admins can use this command!☃️");

    // Check if the bot is an admin
    if (!isBotAdmins) return reply("⚠️ I need to be an admin to execute this command!☃️");

    // Ensure a phone number or user ID is provided
    if (!args[0]) return reply("⚠️ Please provide the phone number of the user to add!☃️");

    // Parse the phone number and ensure it's in the correct format
    const target = args[0].includes("@") ? args[0] : `${args[0]}@s.whatsapp.net`;

    // Add the user to the group
    await robin.groupParticipantsUpdate(from, [target], "add");

    // Confirm success
    return reply(`✅ Successfully added☃️: @${target.split('@')[0]}`);
  } catch (e) {
    console.error("Add Error:", e);
    reply(`❌ Failed to add the user. Error: ${e.message}`);
  }
});

cmd({
  pattern: "demote",
  alias: ["member"],
  react: "⚠️",
  desc: "Remove admin privileges from a mentioned user.",
  category: "admin",
  filename: __filename
},
async (robin, mek, m, { from, isGroup, isOwner, isAdmins, isBotAdmins, reply, quoted }) => {
  try {
    // Check if the command is used in a group
    if (!isGroup) return reply("⚠️ This command can only be used in a group!☃️");

    // Check if the user issuing the command is an admin or owner
    if (!isOwner && !isAdmins) return reply("⚠️ Only the owner and admins can use this command!☃️");

    // Check if the bot is an admin
    if (!isBotAdmins) return reply("⚠️ I need to be an admin to execute this command!☃️");

    // Ensure a user is mentioned
    if (!quoted) return reply("⚠️ Please reply to the user's message you want to remove admin privileges from!☃️");

    // Get the target user to demote
    const target = quoted.sender;

    // Ensure the target is not the user who issued the command
    if (target === from) return reply("⚠️ You cannot remove your own admin privileges!☃️");

    // Ensure the target is an admin
    const groupMetadata = await robin.groupMetadata(from);
    const groupAdmins = groupMetadata.participants.filter(participant => participant.admin).map(admin => admin.id);

    if (!groupAdmins.includes(target)) {
      return reply("⚠️ The mentioned user is not an admin!☃️");
    }

    // Demote the target user
    await robin.groupParticipantsUpdate(from, [target], "demote");

    // Confirm the action
    return reply(`✅ Successfully removed admin privileges from: @${target.split('@')[0]}`);
  } catch (e) {
    console.error("Dismiss Admin Error:", e);
    reply(`❌ Failed to remove admin privileges. Error: ${e.message}`);
  }
});

cmd({
  pattern: "promote",
  alias: ["admin", "makeadmin"],
  react: "⚡",
  desc: "Grant admin privileges to a mentioned user.",
  category: "admin",
  filename: __filename
},
async (robin, mek, m, { from, isGroup, isOwner, isAdmins, isBotAdmins, reply, quoted }) => {
  try {
    // Check if the command is used in a group
    if (!isGroup) return reply("⚠️ This command can only be used in a group!");

    // Check if the user issuing the command is an admin or owner
    if (!isOwner && !isAdmins) return reply("⚠️ Only the owner and admins can use this command!");

    // Check if the bot is an admin
    if (!isBotAdmins) return reply("⚠️ I need to be an admin to execute this command!");

    // Ensure a user is mentioned
    if (!quoted) return reply("⚠️ Please reply to the user's message you want to promote to admin!");

    // Get the target user to promote
    const target = quoted.sender;

    // Ensure the target is not already an admin
    const groupMetadata = await robin.groupMetadata(from);
    const groupAdmins = groupMetadata.participants.filter(participant => participant.admin).map(admin => admin.id);

    if (groupAdmins.includes(target)) {
      return reply("⚠️ The mentioned user is already an admin!");
    }

    // Promote the target user to admin
    await robin.groupParticipantsUpdate(from, [target], "promote");

    // Confirm the action
    return reply(`✅ Successfully promoted @${target.split('@')[0]} to admin!`);
  } catch (e) {
    console.error("Promote Admin Error:", e);
    reply(`❌ Failed to promote the user. Error: ${e.message}`);
  }
});
cmd({
  pattern: "hidetag",
  alias: ["ht", "stealthmention"],
  react: "👻",
  desc: "Silently mention all group members",
  category: "group",
  filename: __filename
},
async (robin, mek, m, { reply, isAdmin, isGroup }) => {
  try {
    if (!isGroup) return reply("❄️ This command works only in groups!");

    // Initial response to show command is processing
    const statusMsg = await reply("❄️ Preparing silent mentions...");

    let metadata;
    try {
      // Attempt with timeout using proper syntax
      metadata = await new Promise(async (resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Initial timeout"));
        }, 5000);

        try {
          const result = await robin.groupMetadata(m.from);
          clearTimeout(timeout);
          resolve(result);
        } catch (e) {
          clearTimeout(timeout);
          reject(e);
        }
      });
    } catch (initialError) {
      console.log("Initial attempt failed, trying with longer timeout...");
      try {
        // Second attempt with longer timeout
        metadata = await new Promise(async (resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Secondary timeout"));
          }, 15000);

          try {
            const result = await robin.groupMetadata(m.from);
            clearTimeout(timeout);
            resolve(result);
          } catch (e) {
            clearTimeout(timeout);
            reject(e);
          }
        });
      } catch (secondaryError) {
        console.log("Secondary attempt failed, using fallback...");
        // Final fallback
        try {
          const rawParticipants = await robin.groupParticipants(m.from);
          metadata = { participants: rawParticipants.map(id => ({ id })) };
        } catch (fallbackError) {
          await statusMsg.delete();
          return reply("❄️ Failed to fetch group data. Please try again later.");
        }
      }
    }

    // Verify bot admin status
    const botJid = robin.user.id.split(':')[0] + '@s.whatsapp.net';
    const botParticipant = metadata.participants.find(p => p.id === botJid);
    
    if (!botParticipant?.admin) {
      await statusMsg.delete();
      return reply("❄️ I need admin rights to mention everyone!");
    }

    if (!isAdmin) {
      await statusMsg.delete();
      return reply("❄️ Only admins can use this command!");
    }

    // Process participants
    const participants = metadata.participants
      .filter(p => p.id?.match(/^\d+@s\.whatsapp\.net$/))
      .map(p => p.id);

    if (participants.length === 0) {
      await statusMsg.delete();
      return reply("❄️ Couldn't fetch participant list!");
    }

    await statusMsg.edit(`❄️ Mentioning ${participants.length} members...`);

    // Send mentions in optimized batches
    const BATCH_SIZE = 25;
    const DELAY = 1500;

    for (let i = 0; i < participants.length; i += BATCH_SIZE) {
      const batch = participants.slice(i, i + BATCH_SIZE);
      
      try {
        await robin.sendMessage(m.from, {
          text: "‎", // Zero-width space
          mentions: batch
        });

        // Update progress every few batches
        if (i % (BATCH_SIZE * 3) === 0) {
          await statusMsg.edit(
            `❄️ Progress: ${Math.min(i + BATCH_SIZE, participants.length)}/${participants.length}`
          );
        }

        if (i + BATCH_SIZE < participants.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY));
        }
      } catch (batchError) {
        console.error(`Batch ${i} error:`, batchError);
      }
    }

    // Cleanup
    await statusMsg.delete();
    try {
      await robin.sendMessage(m.from, { delete: m.key });
    } catch (deleteError) {
      console.log("Couldn't delete command message");
    }

  } catch (criticalError) {
    console.error("HideTag Critical Error:", criticalError);
    reply("❄️ A critical error occurred. Please contact support.");
  }
});

cmd({
  pattern: "owner",
  react: "📞",
  desc: "Share the owner's live WhatsApp contact for easy addition.",
  category: "owner",
  filename: __filename
},
async (robin, mek, m, { reply, isOwner, from }) => {
  try {
    // Check if the user is the bot owner
    if (!isOwner) return reply("⚠️ Only the owner can use this command!☃️");

    // Owner's WhatsApp number
    const ownerNumber = "94702560019"; // Without @s.whatsapp.net
    const ownerJid = `${ownerNumber}@s.whatsapp.net`;

    // Create a simple vCard for easy contact addition
    const vCard = `BEGIN:VCARD\nVERSION:3.0\nN:;Frozen Queen Owner;;;\nFN:❄️Frozen Queen Owner❄️\nTEL;type=CELL;type=VOICE;waid=${ownerNumber}:+${ownerNumber}\nEND:VCARD`;

    // Attempt to send as a contact message
    try {
      await robin.sendMessage(from, {
        contacts: [{
          displayName: "❄️Frozen Queen Owner❄️",
          vcard: vCard
        }]
      }, { quoted: mek });
    } catch (contactError) {
      console.error("Contact Send Error:", contactError);

      // Fallback: Send vCard as a downloadable document
      const vCardBuffer = Buffer.from(vCard, 'utf-8');
      await robin.sendMessage(from, {
        document: vCardBuffer,
        mimetype: 'text/vcard',
        fileName: 'frozen_queen_owner.vcf',
        caption: `📞 Add the owner's contact:\nTap to download 'frozen_queen_owner.vcf' and add to your contacts!\nOr message at: wa.me/${ownerNumber} ☃️`
      }, { quoted: mek });
    }

    // Confirm success with a message
    return reply(`✅ Owner's contact shared! Tap the file or link to add: wa.me/${ownerNumber} ☃️`);

  } catch (e) {
    console.error("Contact Error:", e);
    return reply(`❌ Failed to share contact. Please try again later. Error: ${e.message}`);
  }
});

cmd({
  pattern: "broadcast",
  alias: ["bc", "announce"],
  react: "📢",
  desc: "Send a broadcast message to all groups and chats.",
  category: "owner",
  filename: __filename
},
async (robin, mek, m, { reply, isOwner, args }) => {
  try {
    // Check if the user is the bot owner
    if (!isOwner) return reply("⚠️ Only the owner can use this command!☃️");

    // Ensure a message is provided
    if (!args[0]) return reply("⚠️ Please provide a message to broadcast! Example: .broadcast Hello everyone!☃️");

    // Get the message
    const message = args.join(" ");

    // Check if robin.chats is available
    if (!robin.chats || typeof robin.chats.all !== 'function') {
      return reply("⚠️ Broadcast feature is not supported in this environment! Please check the API or contact developer.☃️");
    }

    // Get all chats
    const chats = await robin.chats.all();
    let successCount = 0;

    // Send message to all chats
    for (let chat of chats) {
      try {
        await robin.sendMessage(chat.jid, { text: message });
        successCount++;
      } catch (error) {
        console.log(`Failed to send to ${chat.jid}:`, error);
      }
    }

    // Confirm success
    return reply(`✅ Broadcast sent successfully to ${successCount} chats!☃️`);
  } catch (e) {
    console.error("Broadcast Error:", e);
    reply(`❌ Failed to send broadcast. Error: ${e.message}`);
  }
});

cmd({
  pattern: "groupchat",
  alias: ["gc", "groupmsg"],
  react: "👥",
  desc: "Send a message to all group chats only.",
  category: "owner",
  filename: __filename
},
async (robin, mek, m, { reply, isOwner, args }) => {
  try {
    if (!isOwner) return reply("⚠️ Only the owner can use this command!☃️");
    if (!args[0]) return reply("⚠️ Please provide a message to send to groups! Example: .groupchat Hello groups!☃️");
    const message = args.join(" ");
    const groups = await robin.groupFetchAllParticipating();
    let groupCount = 0;
    for (let [jid] of Object.entries(groups)) {
      try {
        await robin.sendMessage(jid, { text: message });
        groupCount++;
      } catch (error) {
        console.log(`Failed to send to group ${jid}:`, error);
      }
    }
    return reply(`✅ Message sent successfully to ${groupCount} groups!☃️`);
  } catch (e) {
    console.error("GroupChat Error:", e);
    reply(`❌ Failed to send to groups. Error: ${e.message}`);
  }
});

cmd({
  pattern: "groupdesc",
  alias: ["setdesc"],
  react: "📝",
  desc: "Update the group description.",
  category: "admin",
  filename: __filename
},
async (robin, mek, m, { from, isGroup, isOwner, isAdmins, isBotAdmins, reply, args }) => {
  try {
    if (!isOwner && !isAdmins) return reply("⚠️ Only the owner and admins can use this command!☃️");
    if (!isGroup) return reply("⚠️ This command can only be used in a group!☃️");
    if (!isBotAdmins) return reply("⚠️ I need to be an admin to execute this command!☃️");
    if (!args[0]) return reply("⚠️ Please provide the new group description!☃️");
    const newDesc = args.join(" ");
    await robin.groupUpdateDescription(from, newDesc);
    return reply("✅ Group description updated successfully!☃️");
  } catch (e) {
    console.error("Group Desc Error:", e);
    reply(`❌ Failed to update group description. Error: ${e.message}`);
  }
});

cmd(
  {
    pattern: "support",
    react: "❄️",
    desc: "Get help from Frozen Queen MD's support team",
    category: "general",
    filename: __filename,
  },
  async (robin, mek, m, { from, reply }) => {
    try {
      // Frozen Queen Support Message
      const supportMsg = `
╔══════❄️✦❄️══════╗
   ❄️ *FROZEN QUEEN SUPPORT* ❄️
╚══════❄️✦❄️══════╝

🧊 *Need help?* Join our official support channel for updates, fixes, and community!

🔹 *Support Channel:* 
https://whatsapp.com/channel/0029Vb6HQGHAojYtcbJg5z1Z

❄️ *Follow for:*
- Bot updates
- Troubleshooting
- Exclusive features

🌸 *Thank you for using Frozen Queen MD!* ❄️
      `;

      // Send message with image (optional)
      await robin.sendMessage(
        from,
        {
          image: { url: "https://github.com/chathurahansaka1/help/blob/main/src/a895d5a4-9da0-4716-b7c9-db4bcf955ee7.png?raw=true" }, // Ice-themed image
          caption: supportMsg,
          footer: "✨ Stay frosty with Frozen Queen MD ✨",
        },
        { quoted: mek }
      );

    } catch (e) {
      console.error("Support CMD Error:", e);
      reply("❌ *Error:* Couldn't fetch support details. Try again later.");
    }
  }
);

cmd({
  pattern: "setppgc",
  alias: ["setgpic", "grouppic"],
  react: "🖼️",
  desc: "Set group profile picture (reply to an image/sticker)",
  category: "admin",
  filename: __filename
},
async (robin, mek, m, { from, isGroup, isOwner, isAdmins, isBotAdmins, reply, quoted }) => {
  try {
    // 1. Validate permissions
    if (!isGroup) return reply("⚠️ මෙම command භාවිතා කළ හැක්කේ group එකක පමණි!");
    if (!isOwner && !isAdmins) return reply("⚠️ පරිපාලකයින්ට පමණක් මෙම command භාවිතා කළ හැකිය!");
    if (!isBotAdmins) return reply("⚠️ මම admin කෙනෙක් විය යුතුයි!");

    // 2. Check for quoted message using the same reliable method as toimg
    if (!quoted) {
      return reply("⚠️ පින්තූරයකට reply කරන්න!\nඋදාහරණය: .setppgc ලෙස පින්තූරයකට reply කරන්න");
    }

    // 3. Download media using the proven method from toimg
    let buffer;
    try {
      buffer = await downloadMediaMessage(quoted, "image");
      if (!buffer || buffer.length === 0) {
        throw new Error("Downloaded empty image");
      }
    } catch (err) {
      console.error("Download error:", err);
      return reply("❌ පින්තූරය download කිරීමට අසමත් විය. වෙනත් පින්තූරයක් උත්සාහ කරන්න");
    }

    // 4. If it's a sticker, convert to image first
    if (quoted.stickerMessage) {
      try {
        const sticker = new Sticker(buffer, {
          pack: "❄️Frozen Queen❄️",
          author: "❄️Frozen Queen❄️",
          quality: 100,
        });
        buffer = await sticker.toBuffer({ format: "image/jpeg" });
      } catch (e) {
        console.error("Sticker conversion error:", e);
        return reply("❌ ස්ටිකරය පින්තූරයක් බවට පරිවර්තනය කිරීමට අසමත් විය");
      }
    }

    // 5. Update group profile picture
    try {
      await robin.updateProfilePicture(from, { url: buffer });
      return reply("✅ Group රූපය සාර්ථකව update කරන ලදී!");
    } catch (err) {
      console.error("Update error:", err);
      return reply(`❌ Group රූපය update කිරීමට අසමත් විය: ${err.message}`);
    }

  } catch (e) {
    console.error("SetPPGC Error:", e);
    reply(`❌ අනපේක්ෂිත දෝෂයක්:\n${e.message}`);
  }
});
// Use this function in your bot's index.js or main file to run setuplisteners when bot starts
function initEventHandlers(bot) {
  setTimeout(() => {
    try {
      // Run the setuplisteners command to initialize the deleted message handler
      bot.ev.emit('messages.upsert', {
        messages: [{
          key: {
            remoteJid: 'system@broadcast',
            fromMe: true,
            id: 'SETUPLISTENERS'
          },
          message: {
            conversation: '.setuplisteners'
          }
        }]
      });
      console.log("✅ Event handlers initialization triggered");
    } catch (error) {
      console.error("Failed to initialize event handlers:", error);
    }
  }, 5000); // Wait 5 seconds after bot initialization
}

// Export the initEventHandlers function for use in the main bot file
module.exports = { initEventHandlers };
