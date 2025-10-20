// auto_reply_plugin.js
// This is the Auto-Reply Plugin for handling text-based queries in the class assistant bot.

const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ✅ Bot Status
let autoBotEnabled = {};
const processedMsgs = new Set();
const GEMINI_API_KEY = "AIzaSyDzkvjs52Lg7mk0jeBdAJnvt_xwsmKAuYo";

console.log('\n╔════════════════════════════════════╗');
console.log('║  🤖 AUTO-REPLY BOT LOADED!        ║');
console.log('╚════════════════════════════════════╝\n');

// 🎓 Class Schedule
const classSchedule = {
  "සඳුදා": "📚 Mathematics\n⏰ 3:00 PM - 5:00 PM\n🔗 Zoom: https://zoom.us/j/123456",
  "අඟහරුවාදා": "📚 Science\n⏰ 2:00 PM - 4:00 PM\n🔗 Zoom: https://zoom.us/j/234567",
  "බදාදා": "📚 English\n⏰ 4:00 PM - 6:00 PM\n🔗 Zoom: https://zoom.us/j/345678",
  "බ්‍රහස්පතින්දා": "📚 ICT\n⏰ 3:00 PM - 5:00 PM\n🔗 Zoom: https://zoom.us/j/456789",
  "සිකුරාදා": "📚 Sinhala\n⏰ 2:00 PM - 4:00 PM\n🔗 Zoom: https://zoom.us/j/567890",
  "සෙනසුරාදා": "📚 Combined Maths\n⏰ 10:00 AM - 1:00 PM\n🔗 Zoom: https://zoom.us/j/678901"
};

// 📚 Knowledge Base
const knowledgeBase = {
  "හෙලෝ|හායි|ආයුබෝවන්|හලෝ|හායි බං|කෝහොම්ද": 
    "ආයුබෝවන්! 🙏\n\nමම ඔබේ class assistant bot.\n\n💡 මට කළ හැකි දේ:\n• කාලසටහන - පන්ති වේලාවන්\n• ගාස්තු - Fee විස්තර\n• විභාග - Exam info\n• contact - ගුරුතුමා\n\nඕනෑම දෙයක් අහන්න!",

  "hello|hi|hey": 
    "Hello! 👋\n\nI'm your class assistant.\n\n💡 I can help:\n• schedule - Class times\n• fee - Payment info\n• exam - Test details\n• contact - Teacher",

  "පන්ති|class|ක්ලාස්": () => getWeekSchedule(),
  "කාලසටහන|schedule|timetable|වේලාව": () => getWeekSchedule(),
  "අද පන්ති|අද class": () => getTodayClass(),

  "zoom|link": 
    "🔗 Zoom links පන්ති කාලසටහන එක්ක තියනවා.\n\n'කාලසටහන' කියලා message එකක් දාන්න.",

  "fee|ගාස්තු|payment|ගෙවීම": 
    "💰 *මාසික ගාස්තුව:* රු. 2000/=\n\n📤 *ගෙවන්න:*\n🏦 BOC: 12345678\n📱 Mobile: 0771234567\n👤 Name: Mr. Teacher\n\n✅ Receipt photo එක යවන්න.",

  "exam|විභාග|පරීක්ෂණ|test": 
    "📝 *ඊළඟ විභාගය:*\n📅 October 30, 2025\n📚 Syllabus: Units 1-5\n⏰ 2:00 PM\n📍 Online\n\n💪 සූදානම් වෙන්න!",

  "assignment|homework|ගෙදර වැඩ": 
    "📋 *මේ සතියේ assignments:*\n\n1️⃣ Mathematics - Problem Set 5\n   ⏰ Due: Oct 20\n\n2️⃣ Science - Lab Report\n   ⏰ Due: Oct 22\n\n📤 Complete කරලා photo එක යවන්න.",

  "sir|teacher|ගුරුතුමා|contact|phone": 
    "📞 *Teacher Contact:*\n\n📱 Phone: 0771234567\n💬 WhatsApp: Same number\n📧 Email: teacher@example.com\n\n⏰ Available: 9 AM - 8 PM",

  "help|උදව්|උදව": 
    "🤖 *මට කළ හැකි දේවල්:*\n\n✅ කාලසටහන - පන්ති වේලා\n✅ ගාස්තු - Fee info\n✅ විභාග - Exam details\n✅ homework - Assignments\n✅ contact - ගුරුතුමා\n\n💬 සාමාන්‍ය භාෂාවෙන් අහන්න!",

  "thanks|thank|ස්තූති|ස්තුති|thank you": 
    "You're welcome! 😊 වෙන දෙයක් තියෙනවද?",

  "සඳුදා|monday": () => `📅 *සඳුදා:*\n\n${classSchedule["සඳුදා"]}`,
  "අඟහරුවාදා|tuesday": () => `📅 *අඟහරුවාදා:*\n\n${classSchedule["අඟහරුවාදා"]}`,
  "බදාදා|wednesday": () => `📅 *බදාදා:*\n\n${classSchedule["බදාදා"]}`,
  "බ්‍රහස්පතින්දා|thursday": () => `📅 *බ්‍රහස්පතින්දා:*\n\n${classSchedule["බ්‍රහස්පතින්දා"]}`,
  "සිකුරාදා|friday": () => `📅 *සිකුරාදා:*\n\n${classSchedule["සිකුරාදා"]}`,
  "සෙනසුරාදා|saturday": () => `📅 *සෙනසුරාදා:*\n\n${classSchedule["සෙනසුරාදා"]}`
};

function getWeekSchedule() {
  let schedule = "📚 *සතියේ පන්ති කාලසටහන* 📚\n\n";
  for (let day in classSchedule) {
    schedule += `📅 *${day}*\n${classSchedule[day]}\n\n`;
  }
  schedule += "━━━━━━━━━━━━━━━━━\n💡 විශේෂිත දිනයක් අහන්න: 'සඳුදා', 'අඟහරුවාදා', etc.";
  return schedule;
}

function getTodayClass() {
  const days = ["ඉරිදා", "සඳුදා", "අඟහරුවාදා", "බදාදා", "බ්‍රහස්පතින්දා", "සිකුරාදා", "සෙනසුරාදා"];
  const today = days[new Date().getDay()];

  if (classSchedule[today]) {
    return `📅 *අද ${today}:*\n\n${classSchedule[today]}\n\n━━━━━━━━━━━━━━━━━\n💡 Zoom link එක click කරලා පන්තියට join වෙන්න!`;
  }
  return `අද ${today} - පන්ති නැහැ. 😊\n\n🌴 විවේකයක් ගන්න!\n\n💡 'කාලසටහන' කියලා සතියේ පන්ති බලන්න.`;
}

function findAnswer(text) {
  const q = text.toLowerCase().trim();

  for (let keywords in knowledgeBase) {
    const keyList = keywords.split('|');
    for (let key of keyList) {
      if (q.includes(key.toLowerCase())) {
        const answer = knowledgeBase[keywords];
        return typeof answer === 'function' ? answer() : answer;
      }
    }
  }
  return null;
}

async function getAIResponse(question) {
  try {
    const prompt = `You are a helpful class assistant for online classes in Sri Lanka.

Student question: "${question}"

Context:
- Monthly fee: Rs. 2000
- Classes: Monday to Saturday
- Teacher: 0771234567
- Next exam: October 30, 2025

Answer briefly in the SAME language (Sinhala/English) the student asked. Keep it short (2-3 sentences).`;

    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      { 
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 200
        }
      },
      { timeout: 8000 }
    );

    return res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  } catch (e) {
    console.error('⚠️  AI Error:', e.message);
    return null;
  }
}

// 🎯 MAIN AUTO-REPLY HANDLER (text only)
cmd({
  on: "body"
}, async (conn, mek, m, { from, body, isGroup, isOwner }) => {
  try {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📨 NEW MESSAGE RECEIVED (AUTO-REPLY)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`👤 From: ${from}`);
    console.log(`📱 Is Group: ${isGroup}`);
    console.log(`🤖 Auto-reply enabled: ${autoBotEnabled[from] || false}`);
    console.log(`💬 Body: ${body?.substring(0, 50) || 'No body'}`);
    
    if (isGroup) {
      console.log('⏭️  Skipping: Group message');
      return;
    }
    
    if (!autoBotEnabled[from]) {
      console.log('⏭️  Skipping: Auto-reply not enabled for this chat');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return;
    }

    const msgId = mek.key?.id;
    if (!msgId) {
      console.log('⏭️  No message ID found');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return;
    }
    
    if (processedMsgs.has(msgId)) {
      console.log('⏭️  Already processed this message');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return;
    }
    
    processedMsgs.add(msgId);
    console.log(`   Message ID added to processed set (size: ${processedMsgs.size})`);
    
    // Memory cleanup
    if (processedMsgs.size > 500) {
      const arr = Array.from(processedMsgs);
      const toDelete = arr.slice(0, 250);
      toDelete.forEach(id => processedMsgs.delete(id));
      console.log(`   🗑️  Cleaned up ${toDelete.length} old message IDs`);
    }

    if (mek.key?.fromMe) {
      console.log('⏭️  Own message, skipping');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return;
    }

    // Skip if image (handled by payment plugin)
    const hasDirectImage = !!mek.message?.imageMessage;
    const hasQuotedImage = !!mek.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    
    if (hasDirectImage || hasQuotedImage) {
      console.log('⏭️  Image detected - skipping (handled by payment plugin)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return;
    }

    // Regular text message auto-reply logic
    console.log('\n💬 TEXT MESSAGE - AUTO-REPLY PROCESSING');
    
    const text = body || "";
    if (!text || text.trim().length < 2) {
      console.log('⏭️  No text or too short');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return;
    }

    if (text.startsWith('.') || text.startsWith('!') || text.startsWith('/') || text.startsWith('#')) {
      console.log('⏭️  Command detected, skipping auto-reply');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return;
    }

    const userNum = from.split('@')[0];
    console.log(`   Processing text from: ${userNum}`);
    console.log(`   Text: "${text.substring(0, 100)}"`);

    let answer = null;

    // Try FAQ first
    console.log('   🔍 Searching in FAQ...');
    answer = findAnswer(text);

    if (answer) {
      console.log('   ✅ Found answer in FAQ!');
    } else {
      // Use AI
      console.log('   🤖 Asking AI...');
      answer = await getAIResponse(text);

      if (answer) {
        console.log('   ✅ Got AI response!');
      } else {
        // Fallback
        console.log('   ⚠️  Using fallback response');
        answer = "මට ඒ ගැන හරියටම නැහැ. 😅\n\n📞 ගුරුතුමා: 0771234567\n\n💡 'help' කියලා message එකක් දාන්න.";
      }
    }

    console.log('   📤 Sending reply...');
    await m.reply(answer);
    console.log('   ✅ Reply sent successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌❌❌ ERROR IN AUTO-REPLY ❌❌❌');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
});

// 🎛️ Control Command - Enable/Disable Auto-Reply
cmd({
  pattern: "autobot",
  desc: "Enable/Disable Auto-Reply Bot for this chat",
  category: "admin",
  filename: __filename,
}, async (conn, mek, m, { from, args, reply, isGroup, isAdmins, isOwner }) => {
  try {
    console.log(`\n🎛️  AUTOBOT command from: ${from}`);
    console.log(`   Is Group: ${isGroup}, Is Admin: ${isAdmins}, Is Owner: ${isOwner}`);
    
    if (isGroup && !isAdmins && !isOwner) {
      console.log('   ❌ Access denied - not admin in group\n');
      return reply("❌ Only group admins can use this command!");
    }

    if (!isGroup && !isOwner) {
      console.log('   ❌ Access denied - not owner in private chat\n');
      return reply("❌ Only the bot owner can enable auto-reply in private chats!");
    }

    if (!args[0]) {
      const status = autoBotEnabled[from] ? '✅ ON' : '❌ OFF';
      console.log(`   Current status: ${status}\n`);
      return reply(`🤖 *Auto-Reply Status:* ${status}\n\nUsage:\n• .autobot on\n• .autobot off`);
    }

    const cmd = args[0].toLowerCase();

    if (cmd === 'on' || cmd === 'enable') {
      autoBotEnabled[from] = true;
      console.log(`✅ Auto-reply ENABLED for ${from}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return reply('✅ Auto-Reply Bot is now *ENABLED* for this chat!\n\n🤖 Bot will respond to all messages automatically.');

    } else if (cmd === 'off' || cmd === 'disable') {
      autoBotEnabled[from] = false;
      console.log(`⏸️  Auto-reply DISABLED for ${from}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return reply('⏸️  Auto-Reply Bot is now *DISABLED* for this chat!\n\n🔕 Bot will NOT auto-respond.');

    } else {
      console.log('   ❌ Invalid option\n');
      return reply('❌ Invalid option!\n\nUsage:\n• .autobot on\n• .autobot off');
    }

  } catch (e) {
    console.error('❌ Error in autobot command:', e);
    return reply('❌ Error: ' + e.message);
  }
});

// 🧪 Test Command
cmd({
  pattern: "testauto",
  desc: "Test auto-reply response",
  category: "admin",
  filename: __filename,
}, async (conn, mek, m, { args, reply }) => {
  try {
    console.log('\n🧪 TESTAUTO command');
    
    const query = args.join(' ');

    if (!query) {
      return reply('📝 *Test Auto-Reply*\n\nUsage: .testauto <message>\n\nExample:\n• .testauto අද පන්ති කීයට ද?\n• .testauto what is the fee?');
    }

    console.log(`   Query: "${query}"`);

    let answer = findAnswer(query);

    if (answer) {
      console.log('   ✅ Found in FAQ\n');
      return reply(`✅ *FAQ Response:*\n\n${answer}`);
    } else {
      console.log('   🤖 Using AI...');
      answer = await getAIResponse(query);

      if (answer) {
        console.log('   ✅ Got AI response\n');
        return reply(`🤖 *AI Response:*\n\n${answer}`);
      } else {
        console.log('   ⚠️  No response\n');
        return reply('❌ No response generated.');
      }
    }
  } catch (e) {
    console.error('❌ Error in testauto:', e);
    return reply('❌ Test error: ' + e.message);
  }
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Auto-reply plugin loaded!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('💡 Commands available:');
console.log('   • .autobot on/off - Toggle');
console.log('   • .testauto <msg> - Test responses');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🤖 Bot ready for auto-replies...\n');
