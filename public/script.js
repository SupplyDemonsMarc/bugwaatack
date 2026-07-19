const socket = io();

const statusEl = document.getElementById('status');
const pairNumberInput = document.getElementById('pair-number');
const pairBtn = document.getElementById('pair-btn');
const pairResult = document.getElementById('pairing-result');
const targetInput = document.getElementById('target-numbers');
const sendBtn = document.getElementById('send-btn');
const logContainer = document.getElementById('log-container');

let selectedBug = 'ultimate';

// ============================================
// BUG TYPE SELECTION
// ============================================
document.querySelectorAll('.bug-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.bug-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedBug = btn.dataset.type;
        addLog(`🔥 Selected: ${selectedBug.toUpperCase()}`, 'info');
    });
});

// ============================================
// PAIRING
// ============================================
pairBtn.addEventListener('click', async () => {
    const number = pairNumberInput.value.trim();
    if (!number) {
        addLog('❌ Masukkan nomor!', 'error');
        return;
    }

    pairBtn.disabled = true;
    pairBtn.textContent = '⏳ Pairing...';

    try {
        const res = await fetch('/api/pair', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ number })
        });

        const data = await res.json();
        if (data.success) {
            addLog(`📱 Pairing initiated for ${number}`, 'pair');
            addLog('⏳ Tunggu pairing code dari server...', 'info');
        } else {
            addLog(`❌ Pairing failed: ${data.error}`, 'error');
        }
    } catch (err) {
        addLog(`❌ Error: ${err.message}`, 'error');
    }

    pairBtn.disabled = false;
    pairBtn.textContent = '🔗 PAIR';
});

// ============================================
// SEND BUG
// ============================================
sendBtn.addEventListener('click', async () => {
    const numbers = targetInput.value.trim();
    if (!numbers) {
        addLog('❌ Masukkan nomor target!', 'error');
        return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = '☠️ SENDING...';

    try {
        const res = await fetch('/api/send-devil', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                numbers: numbers.split(',').map(n => n.trim()),
                type: selectedBug
            })
        });

        const data = await res.json();
        if (data.results) {
            data.results.forEach(r => {
                addLog(`${r.number} → ${r.message}`, r.success ? 'success' : 'error');
            });
        }
    } catch (err) {
        addLog(`❌ Error: ${err.message}`, 'error');
    }

    sendBtn.disabled = false;
    sendBtn.textContent = '☠️ SEND BUG';
});

// ============================================
// SOCKET EVENTS
// ============================================
socket.on('status', (status) => {
    if (status === 'connected') {
        statusEl.textContent = '● CONNECTED';
        statusEl.className = 'status connected';
        addLog('🔥 Devil Bot Connected!', 'success');
    } else {
        statusEl.textContent = '● OFF';
        statusEl.className = 'status disconnected';
        addLog('💀 Disconnected', 'error');
    }
});

socket.on('pairing_code', (code) => {
    pairResult.innerHTML = `📱 Pairing Code: <strong>${code}</strong><br>
    <span style="color:#884444;font-size:12px;">Masukkan kode ini di WhatsApp > Perangkat Tertaut</span>`;
    addLog(`📱 Pairing Code: ${code}`, 'pair');
});

socket.on('message', (msg) => {
    addLog(msg, 'info');
});

socket.on('log', (data) => {
    if (data.results) {
        data.results.forEach(r => {
            addLog(`${r.number} → ${r.message}`, r.success ? 'success' : 'error');
        });
    }
});

// ============================================
// PARTICLES (Red Fire)
// ============================================
function createParticles() {
    const container = document.getElementById('particles');
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: fixed;
            width: ${2 + Math.random() * 4}px;
            height: ${2 + Math.random() * 4}px;
            background: rgba(255, ${Math.random() * 50}, 0, ${0.2 + Math.random() * 0.4});
            border-radius: 50%;
            top: ${Math.random() * 100}%;
            left: ${Math.random() * 100}%;
            animation: float ${3 + Math.random() * 5}s infinite ease-in-out;
            animation-delay: ${Math.random() * 2}s;
            pointer-events: none;
            z-index: 0;
        `;
        container.appendChild(particle);
    }
}
createParticles();

// ============================================
// HELPER: ADD LOG
// ============================================
function addLog(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const time = new Date().toLocaleTimeString();
    entry.textContent = `[${time}] ${message}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;

    const empty = logContainer.querySelector('.log-empty');
    if (empty) empty.remove();

    // Keep max 100 entries
    while (logContainer.children.length > 100) {
        logContainer.removeChild(logContainer.firstChild);
    }
}

// ============================================
// AUTO PAIR (if number in input)
// ============================================
// Optional: auto-pair on load if env
