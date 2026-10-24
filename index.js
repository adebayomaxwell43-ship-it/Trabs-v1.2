const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const P = require('pino');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Keep Vercel pair site alive
app.get('/', (req,res)=> res.sendFile(__dirname+'/index.html'));
app.get('/owner.html', (req,res)=> res.sendFile(__dirname+'/owner.html'));
app.listen(PORT, ()=> console.log('Web running on',PORT));

async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState('./session');
  const sock = makeWASocket({
    auth: state,
    logger: P({level:'silent'}),
    browser: Browsers.macOS('Chrome'),
    printQRInTerminal: true
  });

  sock.ev.on('creds.update', saveCreds);

  if(!sock.authState.creds.registered){
    const phoneNumber = process.env.PHONE_NUMBER || ''; // Put your number for panel env
    if(phoneNumber){
      await new Promise(r=> setTimeout(r,3000));
      const code = await sock.requestPairingCode(phoneNumber);
      console.log(`\n=== YOUR PAIRING CODE FOR ${phoneNumber} ===\n${code}\n================================\n`);
    } else {
      console.log('No PHONE_NUMBER env set, scan QR in logs to pair');
    }
  }

  sock.ev.on('connection.update', async (s)=>{
    const { connection, lastDisconnect } = s;
    if(connection==='close'){
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if(shouldReconnect) startBot();
    } else if(connection==='open'){
      console.log('✅ TRABS V1.2 CONNECTED!');
    }
  });

  // Simple command
  sock.ev.on('messages.upsert', async m=>{
    const msg = m.messages[0];
    if(!msg.message) return;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    if(text.toLowerCase() === '.ping'){
      await sock.sendMessage(msg.key.remoteJid, {text:'Pong! TRABS V1.2 Active 🦇'});
    }
  });
}

startBot();
