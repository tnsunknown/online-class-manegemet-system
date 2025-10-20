
// This is the Payment Processing Plugin for handling payment slips and related commands.

const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const GEMINI_API_KEY = "AIzaSyDzkvjs52Lg7mk0jeBdAJnvt_xwsmKAuYo";

// 💰 Payment Records Storage
const PAYMENT_FILE = path.join(__dirname, 'data', 'payments.json');

console.log('\n╔════════════════════════════════════╗');
console.log('║  💰 PAYMENT TRACKER ENABLED!      ║');
console.log('╚════════════════════════════════════╝\n');

// Initialize data directory and payment file
function initPaymentSystem() {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('📁 Created data directory');
  }
  if (!fs.existsSync(PAYMENT_FILE)) {
    fs.writeFileSync(PAYMENT_FILE, JSON.stringify({ payments: [] }, null, 2));
    console.log('💾 Created payments.json file');
  }
  console.log('✅ Payment system initialized\n');
}

// Load payments
function loadPayments() {
  try {
    const data = JSON.parse(fs.readFileSync(PAYMENT_FILE, 'utf8'));
    console.log(`📊 Loaded ${data.payments.length} payment records`);
    return data;
  } catch (e) {
    console.error('❌ Error loading payments:', e.message);
    return { payments: [] };
  }
}

// Save payments
function savePayments(data) {
  try {
    fs.writeFileSync(PAYMENT_FILE, JSON.stringify(data, null, 2));
    console.log('💾 Payments saved successfully');
  } catch (e) {
    console.error('❌ Error saving payments:', e.message);
  }
}

// Download media helper - FIXED
async function downloadMedia(msg) {
  try {
    console.log('📥 Starting media download...');
    console.log('   Message keys:', Object.keys(msg.message || {}));
    
    // Check for image message
    const hasImage = !!msg.message?.imageMessage;
    const hasQuotedImage = !!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    
    console.log('   Has direct image:', hasImage);
    console.log('   Has quoted image:', hasQuotedImage);
    
    let imageMsg;
    
    if (hasImage) {
      imageMsg = msg.message.imageMessage;
      console.log('   Using direct image');
    } else if (hasQuotedImage) {
      imageMsg = msg.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage;
      console.log('   Using quoted image');
    } else {
      console.log('   ❌ No image found in message');
      return null;
    }

    console.log('   Downloading image stream...');
    const stream = await downloadContentFromMessage(imageMsg, 'image');
    
    let buffer = Buffer.from([]);
    let chunks = 0;
    
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
      chunks++;
    }
    
    console.log(`   ✅ Downloaded ${buffer.length} bytes in ${chunks} chunks`);
    return buffer;
    
  } catch (err) {
    console.error('❌ Media download error:', err.message);
    console.error('   Stack:', err.stack);
    return null;
  }
}

// Extract payment info from image using Gemini
async function extractPaymentInfo(buffer) {
  try {
    console.log('\n🔍 Starting payment extraction...');
    console.log(`   Buffer size: ${buffer.length} bytes`);
    
    const dataDir = path.join(__dirname, 'data');
    const timestamp = Date.now();
    const filePath = path.join(dataDir, `slip_${timestamp}.jpg`);
    
    // Save image temporarily
    fs.writeFileSync(filePath, buffer);
    console.log(`   💾 Saved temp file: ${filePath}`);

    // Upload to Gemini
    console.log('   📤 Uploading to Gemini...');
    const uploadRes = await axios.post(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`,
      buffer,
      { 
        headers: { "Content-Type": "image/jpeg" },
        timeout: 15000
      }
    );

    console.log('   Upload response status:', uploadRes.status);
    const fileUri = uploadRes.data.file?.uri;
    const mimeType = uploadRes.data.file?.mimeType || "image/jpeg";

    if (!fileUri) {
      console.error('   ❌ No file URI received');
      return null;
    }
    
    console.log('   ✅ File uploaded:', fileUri);

    // Analyze with Gemini
    console.log('   🤖 Analyzing with Gemini AI...');
    
    const prompt = `You are a payment slip analyzer for a Sri Lankan online class system.

Analyze this payment slip/receipt/bank transfer image and extract the following information:

1. Payment amount (look for LKR, Rs., රු or numbers like 2000, 2000.00)
2. Payment month (look for month names like "October", "ඔක්තෝබර්", "Nov", dates, or any reference to billing period)
3. Payment date (the date when payment was made - look for DD/MM/YYYY or similar formats)
4. Bank/Payment method (BOC, Sampath Bank, Commercial, People's Bank, or mobile banking apps)
5. Reference number or transaction ID

IMPORTANT: 
- If you see "2000" or "Rs. 2000" that's the amount
- Look carefully at dates to determine the month
- Current month is October 2025
- Be accurate with Sinhala text if present

Respond in this EXACT JSON format (no extra text):
{
  "amount": 2000,
  "month": "October 2025",
  "date": "2025-10-20",
  "method": "BOC",
  "reference": "ABC123456"
}

If any field is not clearly visible, use null for that field.`;

    const genRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [
            { text: prompt },
            { fileData: { fileUri, mimeType } }
          ]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 500
        }
      },
      { timeout: 15000 }
    );

    console.log('   Analysis response status:', genRes.status);
    const output = genRes.data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!output) {
      console.error('   ❌ No output from Gemini');
      return null;
    }

    console.log('   Raw AI response:', output);

    // Extract JSON from response
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('   ❌ No JSON found in response');
      return null;
    }

    const paymentInfo = JSON.parse(jsonMatch[0]);
    console.log('   ✅ Extracted payment info:', JSON.stringify(paymentInfo, null, 2));
    
    // Clean up temp file
    try {
      fs.unlinkSync(filePath);
      console.log('   🗑️  Temp file deleted');
    } catch (e) {
      console.log('   ⚠️  Could not delete temp file:', e.message);
    }

    return paymentInfo;

  } catch (err) {
    console.error('\n❌ Payment extraction error:');
    console.error('   Message:', err.message);
    if (err.response) {
      console.error('   Response status:', err.response.status);
      console.error('   Response data:', JSON.stringify(err.response.data, null, 2));
    }
    console.error('   Stack:', err.stack);
    return null;
  }
}

// Initialize payment system
initPaymentSystem();

// 🎯 PAYMENT SLIP HANDLER (image only)
cmd({
  on: "body"
}, async (conn, mek, m, { from, body, isGroup, isOwner }) => {
  try {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📨 NEW MESSAGE RECEIVED (PAYMENT)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`👤 From: ${from}`);
    console.log(`📱 Is Group: ${isGroup}`);
    console.log(`📸 Has image: ${!!mek.message?.imageMessage}`);
    console.log(`🔁 Has quoted: ${!!mek.message?.extendedTextMessage?.contextInfo?.quotedMessage}`);
    
    if (isGroup) {
      console.log('⏭️  Skipping: Group message');
      return;
    }

    if (mek.key?.fromMe) {
      console.log('⏭️  Own message, skipping');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return;
    }

    // Check if message has an image (payment slip)
    const hasDirectImage = !!mek.message?.imageMessage;
    const hasQuotedImage = !!mek.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    
    if (!hasDirectImage && !hasQuotedImage) {
      console.log('⏭️  No image - skipping (handled by auto-reply plugin)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return;
    }

    console.log('\n📸 IMAGE DETECTED - PAYMENT SLIP PROCESSING');
    console.log('   Direct image:', hasDirectImage);
    console.log('   Quoted image:', hasQuotedImage);
    
    await m.reply("📸 Payment slip එකක් ද? මම check කරනවා...");
    
    const buffer = await downloadMedia(mek);
    
    if (!buffer) {
      console.log('❌ Failed to download image');
      return m.reply("❌ Quoted message එකේ image එකක් නැහැ. 😅\n\nClear photo එකක් යවන්න!");
    }

    await m.reply("🔍 Slip එක scan කරනවා... මඳක් වෙලා ගත්තත් කමක් නෑ.");
    
    const paymentInfo = await extractPaymentInfo(buffer);
    
    if (paymentInfo && (paymentInfo.amount || paymentInfo.month)) {
      console.log('\n✅ PAYMENT INFO EXTRACTED SUCCESSFULLY');
      
      // Save payment record
      const payments = loadPayments();
      const userNum = from.split('@')[0];
      
      const record = {
        id: Date.now().toString(),
        student: userNum,
        amount: paymentInfo.amount || 0,
        month: paymentInfo.month || "Unknown",
        date: paymentInfo.date || new Date().toISOString().split('T')[0],
        method: paymentInfo.method || "Unknown",
        reference: paymentInfo.reference || "N/A",
        timestamp: new Date().toISOString(),
        verified: false
      };

      payments.payments.push(record);
      savePayments(payments);

      console.log('💾 Payment record saved:', record.id);
      console.log('   Student:', record.student);
      console.log('   Amount:', record.amount);
      console.log('   Month:', record.month);

      const response = `✅ *Payment Slip Received!*\n\n💰 Amount: රු. ${paymentInfo.amount || 'N/A'}/=\n📅 Month: ${paymentInfo.month || 'N/A'}\n📆 Date: ${paymentInfo.date || 'N/A'}\n🏦 Method: ${paymentInfo.method || 'N/A'}\n🔖 Ref: ${paymentInfo.reference || 'N/A'}\n\n⏳ Your payment will be verified by the teacher soon.\n\n💡 Use '.mypayments' to check your payment history.`;

      console.log('📤 Sending success response...');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return m.reply(response);
    } else {
      console.log('⚠️  Could not extract payment info from image');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return m.reply("❌ මට slip එක හොඳින් read කරගන්න බැහැ. 😅\n\nහැකි නම්:\n• Clear photo එකක් යවන්න\n• හෝ payment details manually කියන්න:\n  - Amount\n  - Month\n  - Date");
    }

  } catch (error) {
    console.error('\n❌❌❌ ERROR IN PAYMENT HANDLER ❌❌❌');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
});

// 💰 Check My Payments Command
cmd({
  pattern: "mypayments",
  desc: "Check your payment history",
  category: "student",
  filename: __filename,
}, async (conn, mek, m, { from, reply }) => {
  try {
    console.log(`\n💰 MYPAYMENTS command from: ${from}`);
    
    const payments = loadPayments();
    const userNum = from.split('@')[0];
    
    const userPayments = payments.payments.filter(p => p.student === userNum);
    console.log(`   Found ${userPayments.length} payments for user`);
    
    if (userPayments.length === 0) {
      return reply("📋 You don't have any payment records yet.\n\n💡 Send your payment slip image to record it!");
    }

    let response = "💰 *Your Payment History*\n\n";
    
    userPayments.reverse().forEach((p, i) => {
      const status = p.verified ? '✅ Verified' : '⏳ Pending';
      response += `${i + 1}. 📅 ${p.month}\n   💵 රු. ${p.amount}/=\n   📆 ${p.date}\n   ${status}\n\n`;
    });

    response += `━━━━━━━━━━━━━━━━━\n📊 Total Records: ${userPayments.length}`;
    
    console.log('   Sending payment history...\n');
    return reply(response);
  } catch (e) {
    console.error('❌ Error in mypayments:', e);
    return reply('❌ Error: ' + e.message);
  }
});

// 🔧 Admin: View All Payments
cmd({
  pattern: "allpayments",
  desc: "View all student payments (Admin only)",
  category: "admin",
  filename: __filename,
}, async (conn, mek, m, { from, reply, isOwner }) => {
  try {
    console.log(`\n📊 ALLPAYMENTS command from: ${from} (Owner: ${isOwner})`);
    
    if (!isOwner) {
      console.log('   ❌ Access denied - not owner\n');
      return reply("❌ Admin command only!");
    }

    const payments = loadPayments();

    if (payments.payments.length === 0) {
      console.log('   No payment records found\n');
      return reply("📋 No payment records yet.");
    }

    console.log(`   Total payments: ${payments.payments.length}`);
    let response = "💰 *All Payment Records*\n\n";
    
    const recent = payments.payments.slice(-10).reverse();
    recent.forEach((p, i) => {
      const status = p.verified ? '✅' : '⏳';
      response += `${status} ${p.student}\n   📅 ${p.month} - රු.${p.amount}\n   🔖 ${p.id}\n\n`;
    });

    response += `━━━━━━━━━━━━━━━━━\n📊 Total: ${payments.payments.length}\n💡 Use: .verifypay <id>`;
    
    console.log('   Sending all payments list...\n');
    return reply(response);
  } catch (e) {
    console.error('❌ Error in allpayments:', e);
    return reply('❌ Error: ' + e.message);
  }
});

// ✅ Admin: Verify Payment
cmd({
  pattern: "verifypay",
  desc: "Verify a student payment (Admin only)",
  category: "admin",
  filename: __filename,
}, async (conn, mek, m, { args, reply, isOwner }) => {
  try {
    console.log(`\n✅ VERIFYPAY command (Owner: ${isOwner})`);
    
    if (!isOwner) {
      console.log('   ❌ Access denied - not owner\n');
      return reply("❌ Admin command only!");
    }

    if (!args[0]) {
      console.log('   ❌ No payment ID provided\n');
      return reply("❌ Usage: .verifypay <payment_id>");
    }

    const paymentId = args[0];
    console.log(`   Looking for payment ID: ${paymentId}`);
    
    const payments = loadPayments();
    const payment = payments.payments.find(p => p.id === paymentId);
    
    if (!payment) {
      console.log('   ❌ Payment not found\n');
      return reply("❌ Payment record not found!");
    }

    console.log('   Payment found:', JSON.stringify(payment, null, 2));

    if (payment.verified) {
      console.log('   ℹ️  Already verified\n');
      return reply("ℹ️ This payment is already verified.");
    }

    payment.verified = true;
    payment.verifiedAt = new Date().toISOString();
    savePayments(payments);

    console.log('   ✅ Payment verified!');

    const studentJid = payment.student + '@s.whatsapp.net';
    
    // Add student to month-specific group
    console.log(`   👥 Adding student to group for month: ${payment.month}`);
    const groupName = `${payment.month} Class`; // e.g., "October 2025 Class"
    
    // Get all participating groups
    const allGroups = await conn.groupFetchAllParticipating();
    let targetGroup = Object.entries(allGroups).find(([gid, meta]) => meta.subject === groupName);
    
    let groupJid;
    if (targetGroup) {
      groupJid = targetGroup[0];
      console.log(`   📁 Existing group found: ${groupJid}`);
      // Add student to existing group
      await conn.groupParticipantsUpdate(groupJid, [studentJid], 'add');
      console.log(`   ✅ Student added to existing group`);
    } else {
      console.log('   📁 No group found, creating new one...');
      // Create new group with student
      const createResponse = await conn.groupCreate(groupName, [studentJid]);
      groupJid = createResponse.gid;
      console.log(`   ✅ New group created: ${groupJid}`);
    }
    
    // Notify student
    console.log(`   📨 Notifying student: ${studentJid}`);
    try {
      await conn.sendMessage(studentJid, {
        text: `✅ *Payment Verified!*\n\n💰 Amount: රු. ${payment.amount}/=\n📅 Month: ${payment.month}\n\n🎉 Thank you! You're all set for classes.\n\n👥 You've been added to the "${groupName}" group.`
      });
      console.log('   ✅ Student notified successfully');
    } catch (e) {
      console.log('   ⚠️  Could not notify student:', e.message);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return reply(`✅ Payment verified!\n\n👤 Student: ${payment.student}\n💰 Amount: ${payment.amount}\n📅 Month: ${payment.month}\n👥 Added to group: ${groupName}\n\n📨 Student has been notified.`);

  } catch (e) {
    console.error('❌ Error in verifypay:', e);
    return reply('❌ Error: ' + e.message);
  }
});

// 🗑️ Admin: Delete Payment
cmd({
  pattern: "delpay",
  desc: "Delete a payment record (Admin only)",
  category: "admin",
  filename: __filename,
}, async (conn, mek, m, { args, reply, isOwner }) => {
  try {
    console.log(`\n🗑️  DELPAY command (Owner: ${isOwner})`);
    
    if (!isOwner) {
      return reply("❌ Admin command only!");
    }

    if (!args[0]) {
      return reply("❌ Usage: .delpay <payment_id>");
    }

    const paymentId = args[0];
    const payments = loadPayments();
    const index = payments.payments.findIndex(p => p.id === paymentId);
    
    if (index === -1) {
      console.log('   ❌ Payment not found\n');
      return reply("❌ Payment record not found!");
    }

    const deleted = payments.payments.splice(index, 1)[0];
    savePayments(payments);

    console.log('   ✅ Payment deleted:', deleted.id);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return reply(`🗑️ Payment deleted!\n\n👤 Student: ${deleted.student}\n💰 Amount: ${deleted.amount}\n📅 Month: ${deleted.month}`);

  } catch (e) {
    console.error('❌ Error in delpay:', e);
    return reply('❌ Error: ' + e.message);
  }
});

// 📊 Student Payment Status
cmd({
  pattern: "paystatus",
  desc: "Check payment status for a specific month",
  category: "student",
  filename: __filename,
}, async (conn, mek, m, { from, args, reply }) => {
  try {
    console.log(`\n📊 PAYSTATUS command from: ${from}`);
    
    const payments = loadPayments();
    const userNum = from.split('@')[0];
    const userPayments = payments.payments.filter(p => p.student === userNum);
    
    if (!args[0]) {
      // Show current month status
      const currentMonth = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
      const currentPayment = userPayments.find(p => p.month?.includes(currentMonth));
      
      if (currentPayment) {
        const status = currentPayment.verified ? '✅ Verified' : '⏳ Pending Verification';
        return reply(`📅 *${currentMonth}*\n\n💰 Amount: රු. ${currentPayment.amount}/=\n${status}\n\n💡 Use '.mypayments' for full history.`);
      } else {
        return reply(`📅 *${currentMonth}*\n\n❌ No payment recorded yet.\n\n💡 Send your payment slip to record it!`);
      }
    }

    // Search for specific month
    const searchMonth = args.join(' ');
    const foundPayment = userPayments.find(p => 
      p.month?.toLowerCase().includes(searchMonth.toLowerCase())
    );
    
    if (foundPayment) {
      const status = foundPayment.verified ? '✅ Verified' : '⏳ Pending Verification';
      console.log(`   Found payment for ${searchMonth}\n`);
      return reply(`📅 *${foundPayment.month}*\n\n💰 Amount: රු. ${foundPayment.amount}/=\n📆 Date: ${foundPayment.date}\n${status}`);
    } else {
      console.log(`   No payment found for ${searchMonth}\n`);
      return reply(`❌ No payment found for "${searchMonth}".\n\n💡 Use '.mypayments' to see all records.`);
    }

  } catch (e) {
    console.error('❌ Error in paystatus:', e);
    return reply('❌ Error: ' + e.message);
  }
});

// 📊 Bot Status Command (Payment Part)
cmd({
  pattern: "botstatus",
  desc: "Check payment bot status",
  category: "admin",
  filename: __filename,
}, async (conn, mek, m, { from, reply }) => {
  try {
    console.log(`\n📊 BOTSTATUS command from: ${from}`);
    
    const payments = loadPayments();
    const pendingPayments = payments.payments.filter(p => !p.verified).length;
    const verifiedPayments = payments.payments.filter(p => p.verified).length;

    const status = `💰 *Payment System Status*

💾 Messages Processed: N/A (Image only)
🔑 AI: ${GEMINI_API_KEY ? 'Connected ✅' : 'Not configured ❌'}

💰 *Payment System:*
📁 Total Records: ${payments.payments.length}
✅ Verified: ${verifiedPayments}
⏳ Pending: ${pendingPayments}

━━━━━━━━━━━━━━━━━
💡 *Commands:*
• .mypayments - Your history
• .paystatus [month] - Check status
• .allpayments - All records (Admin)
• .verifypay <id> - Verify (Admin)
• .delpay <id> - Delete (Admin)
• .paystats - Statistics (Admin)`;

    console.log('   Status sent successfully\n');
    return reply(status);
  } catch (e) {
    console.error('❌ Error in botstatus:', e);
    return reply('❌ Error: ' + e.message);
  }
});

// 📈 Payment Statistics (Admin)
cmd({
  pattern: "paystats",
  desc: "View payment statistics (Admin only)",
  category: "admin",
  filename: __filename,
}, async (conn, mek, m, { reply, isOwner }) => {
  try {
    console.log('\n📈 PAYSTATS command');
    
    if (!isOwner) {
      return reply("❌ Admin command only!");
    }

    const payments = loadPayments();
    const total = payments.payments.length;
    const verified = payments.payments.filter(p => p.verified).length;
    const pending = total - verified;
    
    // Calculate total amount
    const totalAmount = payments.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const verifiedAmount = payments.payments.filter(p => p.verified).reduce((sum, p) => sum + (p.amount || 0), 0);
    
    // Get unique students
    const students = [...new Set(payments.payments.map(p => p.student))];
    
    // Recent payments (last 5)
    const recent = payments.payments.slice(-5).reverse();
    let recentList = "";
    recent.forEach(p => {
      const status = p.verified ? '✅' : '⏳';
      recentList += `${status} ${p.student} - රු.${p.amount} (${p.month})\n`;
    });

    const stats = `📈 *Payment Statistics*

📊 *Overview:*
💰 Total Records: ${total}
✅ Verified: ${verified}
⏳ Pending: ${pending}
👥 Unique Students: ${students.length}

💵 *Revenue:*
💰 Total: රු. ${totalAmount.toLocaleString()}/=
✅ Verified: රු. ${verifiedAmount.toLocaleString()}/=

📋 *Recent Payments:*
${recentList || 'No payments yet'}

━━━━━━━━━━━━━━━━━
💡 Use .allpayments to see all records`;

    console.log('   Stats sent successfully\n');
    return reply(stats);
  } catch (e) {
    console.error('❌ Error in paystats:', e);
    return reply('❌ Error: ' + e.message);
  }
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Payment plugin loaded!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('💡 Commands available:');
console.log('   • .mypayments - Check history');
console.log('   • .paystatus - Check month status');
console.log('   • .allpayments - View all (Admin)');
console.log('   • .verifypay <id> - Verify (Admin)');
console.log('   • .delpay <id> - Delete (Admin)');
console.log('   • .paystats - Statistics (Admin)');
console.log('   • .botstatus - System status');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📸 Send payment slip images for auto-processing\n');
