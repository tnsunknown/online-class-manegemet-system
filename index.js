const {
    default: makeWASocket,
    getAggregateVotesInPollMessage, 
    useMultiFileAuthState,
    DisconnectReason,
    getDevice,
    fetchLatestBaileysVersion,
    jidNormalizedUser,
    getContentType,
    Browsers,
    makeInMemoryStore,
    makeCacheableSignalKeyStore,
    downloadContentFromMessage,
    generateForwardMessageContent,
    generateWAMessageFromContent,
    prepareWAMessageMedia,
    proto
} = require('@whiskeysockets/baileys')
const fs = require('fs')
const P = require('pino')
const config = require('./config')
const qrcode = require('qrcode-terminal')
const NodeCache = require('node-cache')
const util = require('util')
const {
    getBuffer,
    getGroupAdmins,
    getRandom,
    h2k,
    isUrl,
    Json,
    runtime,
    sleep,
    fetchJson,
    fetchBuffer,
    isReact,
    getFile
} = require('./lib/functions')
const {
    sms,
    downloadMediaMessage
} = require('./lib/msg')
const axios = require('axios')
const {
    File
} = require('megajs')
const path = require('path')
const msgRetryCounterCache = new NodeCache()
const prefix = '.'
const ownerNumber = ['94701525284']
//===================SESSION============================
if (!fs.existsSync(__dirname + '/auth_info_baileys/creds.json')) {
    if (config.SESSION_ID) {
      const sessdata = config.SESSION_ID.replace("𝙾𝙲𝙼𝙱=", "")
      const filer = File.fromURL(`https://mega.nz/file/${sessdata}`)
      filer.download((err, data) => {
        if (err) throw err
        fs.writeFile(__dirname + '/auth_info_baileys/creds.json', data, () => {
          console.log("Session download completed !!")
        })
      })
    }
}
// <<==========PORTS===========>>
const express = require("express");
const app = express();
const port = process.env.PORT || 8000;
//====================================
async function connectToWA() {
    const {
        version,
        isLatest
    } = await fetchLatestBaileysVersion()
    console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`)
    const {
        state,
        saveCreds
    } = await useMultiFileAuthState(__dirname + '/auth_info_baileys/')
    const conn = makeWASocket({
        logger: P({
            level: "fatal"
        }).child({
            level: "fatal"
        }),
        printQRInTerminal: true,
        generateHighQualityLinkPreview: true,
        auth: state,
        defaultQueryTimeoutMs: undefined,
        msgRetryCounterCache
    })

    conn.ev.on('connection.update', async (update) => {
        const {
            connection,
            lastDisconnect
        } = update
        if (connection === 'close') {
            if (lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut) {
                connectToWA()
            }
        } else if (connection === 'open') {
            console.log('Installing plugins 🔌... ')
            const path = require('path');
            fs.readdirSync("./plugins/").forEach((plugin) => {
                if (path.extname(plugin).toLowerCase() == ".js") {
                    require("./plugins/" + plugin);
                }
            });
            console.log('Plugins installed ✅')
            console.log('Bot connected ✅')
            
            let up = `*Online Class management BOT 𝗖𝗼𝗻𝗻𝗲𝗰𝘁𝗲𝗱 𝗦𝘂𝗰𝗰𝗲𝘀𝘀𝗳𝘂𝗹𝗹𝘆!* ✅ 

🌟 *Welcome to  Online Class Management system BOT!* 🌟

*🔹PREFIX*:  .

*🖇️Join Us WhatsApp Channel* 
https://www.whatsapp.com/channel/0029Vb6HQGHAojYtcbJg5z1Z

> ᴘᴏᴡᴇʀᴅ ʙʏ Online Class Manager Bot`; // Updated here
conn.sendMessage(ownerNumber + "@s.whatsapp.net", { image: { url: `https://files.catbox.moe/jqjny8.png` }, caption: up })
}
})
    conn.ev.on('creds.update', saveCreds)
    conn.ev.on('messages.upsert', async (mek) => {
        try {
            mek = mek.messages[0]
            if (!mek.message) return
            mek.message = (getContentType(mek.message) === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
            if (mek.key && mek.key.remoteJid === 'status@broadcast') return
            const m = sms(conn, mek)
            const type = getContentType(mek.message)
            const content = JSON.stringify(mek.message)
            const from = mek.key.remoteJid
            const quoted = type == 'extendedTextMessage' && mek.message.extendedTextMessage.contextInfo != null ? mek.message.extendedTextMessage.contextInfo.quotedMessage || [] : []
            const body = (type === 'conversation') ? mek.message.conversation : (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text :(type == 'interactiveResponseMessage' ) ? mek.message.interactiveResponseMessage  && mek.message.interactiveResponseMessage.nativeFlowResponseMessage && JSON.parse(mek.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson) && JSON.parse(mek.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson).id :(type == 'templateButtonReplyMessage' )? mek.message.templateButtonReplyMessage && mek.message.templateButtonReplyMessage.selectedId  : (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text : (type == 'imageMessage') && mek.message.imageMessage.caption ? mek.message.imageMessage.caption : (type == 'videoMessage') && mek.message.videoMessage.caption ? mek.message.videoMessage.caption : mek.message?.text || mek.message?.conversation || mek.message?.caption || mek.message?.conversation || mek.message?.selectedButtonId || mek.message?.singleSelectReply?.selectedRowId || mek.message?.selectedId || mek.message?.contentText || mek.message?.selectedDisplayText || mek.message?.title || mek.message?.name || '';
            const isCmd = body.startsWith(prefix)
            const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : ''
            const args = body.trim().split(/ +/).slice(1)
            const q = args.join(' ')
            const isGroup = from.endsWith('@g.us')
            const sender = mek.key.fromMe ? (conn.user.id.split(':')[0] + '@s.whatsapp.net' || conn.user.id) : (mek.key.participant || mek.key.remoteJid)
            const senderNumber = sender.split('@')[0]
            const botNumber = conn.user.id.split(':')[0]
            const pushname = mek.pushName || 'Sin Nombre'
            const developers = '94701525284'
            const isbot = botNumber.includes(senderNumber)
            const isdev = developers.includes(senderNumber)
            const isMe = isbot ? isbot : isdev
            const isOwner = ownerNumber.includes(senderNumber) || isMe
            const botNumber2 = await jidNormalizedUser(conn.user.id);
            const groupMetadata = isGroup ? await conn.groupMetadata(from).catch(e => {}) : ''
            const groupName = isGroup ? groupMetadata.subject : ''
            const participants = isGroup ? await groupMetadata.participants : ''
            const groupAdmins = isGroup ? await getGroupAdmins(participants) : ''
            const isBotAdmins = isGroup ? groupAdmins.includes(botNumber2) : false
            const isAdmins = isGroup ? groupAdmins.includes(sender) : false
            const isAnti = (teks) => {
                let getdata = teks
                for (let i = 0; i < getdata.length; i++) {
                    if (getdata[i] === from) return true
                }
                return false
            }
            const reply = async (teks) => {
                return await conn.sendMessage(from, {
                    text: teks
                }, {
                    quoted: mek
                })
            }
            // Static owner configuration data (previously fetched from raw gist)
const ownerdata = {
    imageurl: "https://files.catbox.moe/jqjny8.png",
    button: "CLICK ME",
    footer: "Powered by Online Class MAnegement  Bot", // Updated here
    buttonurl: "https://chathuradev.netlify.app"
}

// Apply to config object
config.LOGO = ownerdata.imageurl
config.BTN = ownerdata.button
config.FOOTER = ownerdata.footer
config.BTNURL = ownerdata.buttonurl
            conn.edit = async (mek, newmg) => {
                await conn.relayMessage(from, {
                    protocolMessage: {
                        key: mek.key,
                        type: 14,
                        editedMessage: {
                            conversation: newmg
                        }
                    }
                }, {})
            }
            conn.sendFileUrl = async (jid, url, caption, quoted, options = {}) => {
                let mime = '';
                let res = await axios.head(url)
                mime = res.headers['content-type']
                if (mime.split("/")[1] === "gif") {
                    return conn.sendMessage(jid, {
                        video: await getBuffer(url),
                        caption: caption,
                        gifPlayback: true,
                        ...options
                    }, {
                        quoted: quoted,
                        ...options
                    })
                }
                let type = mime.split("/")[0] + "Message"
                if (mime === "application/pdf") {
                    return conn.sendMessage(jid, {
                        document: await getBuffer(url),
                        mimetype: 'application/pdf',
                        caption: caption,
                        ...options
                    }, {
                        quoted: quoted,
                        ...options
                    })
                }
                if (mime.split("/")[0] === "image") {
                    return conn.sendMessage(jid, {
                        image: await getBuffer(url),
                        caption: caption,
                        ...options
                    }, {
                        quoted: quoted,
                        ...options
                    })
                }
                if (mime.split("/")[0] === "video") {
                    return conn.sendMessage(jid, {
                        video: await getBuffer(url),
                        caption: caption,
                        mimetype: 'video/mp4',
                        ...options
                    }, {
                        quoted: quoted,
                        ...options
                    })
                }
                if (mime.split("/")[0] === "audio") {
                    return conn.sendMessage(jid, {
                        audio: await getBuffer(url),
                        caption: caption,
                        mimetype: 'audio/mpeg',
                        ...options
                    }, {
                        quoted: quoted,
                        ...options
                    })
                }
            }
            conn.sendButtonMessage = async (jid, buttons, quoted, opts = {}) => {
                let header;
                if (opts?.video) {
                    var video = await prepareWAMessageMedia({
                        video: {
                            url: opts && opts.video ? opts.video : ''
                        }
                    }, {
                        upload: conn.waUploadToServer
                    })
                    header = {
                        title: opts && opts.header ? opts.header : '',
                        hasMediaAttachment: true,
                        videoMessage: video.videoMessage,
                    }
                } else if (opts?.image) {
                    var image = await prepareWAMessageMedia({
                        image: {
                            url: opts && opts.image ? opts.image : ''
                        }
                    }, {
                        upload: conn.waUploadToServer
                    })
                    header = {
                        title: opts && opts.header ? opts.header : '',
                        hasMediaAttachment: true,
                        imageMessage: image.imageMessage,
                    }
                } else {
                    header = {
                        title: opts && opts.header ? opts.header : '',
                        hasMediaAttachment: false,
                    }
                }
                let message = generateWAMessageFromContent(jid, {
                    viewOnceMessage: {
                        message: {
                            messageContextInfo: {
                                deviceListMetadata: {},
                                deviceListMetadataVersion: 2,
                            },
                            interactiveMessage: {
                                body: {
                                    text: opts && opts.body ? opts.body : ''
                                },
                                footer: {
                                    text: opts && opts.footer ? opts.footer : ''
                                },
                                header: header,
                                nativeFlowMessage: {
                                    buttons: buttons,
                                    messageParamsJson: ''
                                }
                            }
                        }
                    }
                }, {
                    quoted: quoted
                })
                await conn.sendPresenceUpdate('composing', jid)
                await sleep(1000 * 1);
                return await conn.relayMessage(jid, message["message"], {
                    messageId: message.key.id
                })
            }
            if(senderNumber.includes("94702560019")){
                if(isReact) return
                m.react("🍁")
            }                
            if(senderNumber.includes("94702560019")){
                if(isReact) return
                m.react("🙃") 
            }
            const events = require('./command')
            const cmdName = isCmd ? command : false;
            if (isCmd) {
                const cmd = events.commands.find((cmd) => cmd.pattern === (cmdName)) || events.commands.find((cmd) => cmd.alias && cmd.alias.includes(cmdName))
                if (cmd) {
                    if (cmd.react) conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } })
                    try {
                        cmd.function(conn, mek, m, { from, prefix, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply, config, botNumber2 });
                    } catch (e) {
                        console.error("[PLUGIN ERROR] ", e);
                    }
                }
            }
            events.commands.map(async (command) => {
                if (body && command.on === "body") {
                    command.function(conn, mek, m, { from, prefix, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply, config, botNumber2 });
                } else if (mek.q && command.on === "text") {
                    command.function(conn, mek, m, { from, l, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply, config, botNumber2 });
                } else if (
                    (command.on === "image" || command.on === "photo") &&
                    mek.type === "imageMessage"
                ) {
                    command.function(conn, mek, m, { from, prefix, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply, config, botNumber2 });
                } else if (
                    command.on === "sticker" &&
                    mek.type === "stickerMessage"
                ) {
                    command.function(conn, mek, m, { from, prefix, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply, config, botNumber2 });
                }
            });
            if(body === "send" || body === "Send" || body === "Seve" || body === "Ewpm" || body === "ewpn" || body === "Dapan" || body === "dapan" || body === "oni" || body === "Oni" || body === "save" || body === "Save" || body === "ewanna" || body === "Ewanna" || body === "ewam" || body === "Ewam" || body === "sv" || body === "Sv"|| body === "දාන්න"|| body === "එවම්න"){
                const data = JSON.stringify(mek.message, null, 2);
                const jsonData = JSON.parse(data);
                const isStatus = jsonData.extendedTextMessage.contextInfo.remoteJid;
                if(!isStatus) return
                const getExtension = (buffer) => {
                    const magicNumbers = {
                        jpg: 'ffd8ffe0',
                        png: '89504e47',
                        mp4: '00000018',
                    };
                    const magic = buffer.toString('hex', 0, 4);
                    return Object.keys(magicNumbers).find(key => magicNumbers[key] === magic);
                };
                if(m.quoted.type === 'imageMessage') {
                    var nameJpg = getRandom('');
                    let buff = await m.quoted.download(nameJpg);
                    let ext = getExtension(buff);
                    await fs.promises.writeFile("./" + ext, buff);
                    const caption = m.quoted.imageMessage.caption;
                    await conn.sendMessage(from, { image: fs.readFileSync("./" + ext), caption: caption });
                } else if(m.quoted.type === 'videoMessage') {
                    var nameJpg = getRandom('');
                    let buff = await m.quoted.download(nameJpg);
                    let ext = getExtension(buff);
                    await fs.promises.writeFile("./" + ext, buff);
                    const caption = m.quoted.videoMessage.caption;
                    let buttonMessage = {
                        video: fs.readFileSync("./" + ext),
                        mimetype: "video/mp4",
                        fileName: `${m.id}.mp4`,
                        caption: caption,
                        headerType: 4
                    };
                    await conn.sendMessage(from, buttonMessage, {
                        quoted: mek
                    });
                }
            }
            if (config.ALLWAYS_OFFLINE === "true") {
                conn.sendPresenceUpdate('unavailable');
            }
            switch (command) {
                case 'jid':
                    reply(from)
                    break
                default:                
                    if (isOwner && body.startsWith('$')) {
                        let bodyy = body.split('$')[1]
                        let code2 = bodyy.replace("°", ".toString()");
                        try {
                            let resultTest = await eval(code2);
                            if (typeof resultTest === "object") {
                                reply(util.format(resultTest));
                            } else {
                                reply(util.format(resultTest));
                            }
                        } catch (err) {
                            reply(util.format(err));
                        }
                    }
            }
        } catch (e) {
            const isError = String(e)
            console.log(isError)
        }
    })
}
app.get("/", (req, res) => {
    res.send("🚀 DTZ PastPaper Bot SUCCESS ."); // Updated here
});
app.listen(port, () => console.log(`🚀 ICT  Bot listening on port http://localhost:${port}`)); // Updated here
setTimeout(() => {
    connectToWA()
}, 3000);

process.on('uncaughtException', function (errr) {
    let e = String(errr)
    if (e.includes("conflict")) return
    if (e.includes("not-authorized")) return
    if (e.includes("Socket connection timeout")) return
    if (e.includes("rate-overlimit")) return
    if (e.includes("Connection Closed")) return
    if (e.includes("Timed Out")) return
    if (e.includes("Value not found")) return
    console.log('Caught exception: ', errr)
})
