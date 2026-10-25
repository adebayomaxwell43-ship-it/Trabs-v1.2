import makeWASocket, { useMultiFileAuthState, makeCacheableSignalKeyStore, Browsers } from "@whiskeysockets/baileys"

export const maxDuration = 60; // Important for Vercel!

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { number } = req.body;
  if (!number) return res.status(400).json({ error: 'Number required' });
  
  const cleanNumber = number.replace(/[^0-9]/g, '');
  
  try {
    const { state, saveCreds } = await useMultiFileAuthState('./tmp/' + cleanNumber);
    
    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, console.log),
      },
      browser: Browsers.ubuntu("Chrome"),
      printQRInTerminal: false,
      logger: { level: 'silent' },
      usePairingCode: true
    });

    sock.ev.on('creds.update', saveCreds);

    if (!sock.authState.creds.registered) {
      await new Promise(r => setTimeout(r, 1000)); // wait socket ready
      const code = await sock.requestPairingCode(cleanNumber);
      console.log('Pairing code for', cleanNumber, ':', code);
      return res.status(200).json({ code: code });
    } else {
      return res.status(200).json({ error: 'Already registered' });
    }

  } catch (e) {
    console.log('Pair Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
