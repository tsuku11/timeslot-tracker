import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'data.json');

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '..', 'dist')));

// SSE clients
const sseClients = new Set();

function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(msg); } catch {}
  }
}

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    const initial = {
      users: [
        { id: uuidv4(), name: 'Пользователь 1', color: '#6366f1', balance: 100, isRenter: false },
        { id: uuidv4(), name: 'Пользователь 2', color: '#f43f5e', balance: 100, isRenter: false },
        { id: uuidv4(), name: 'Пользователь 3', color: '#10b981', balance: 100, isRenter: false },
        { id: uuidv4(), name: 'Арендатор', color: '#f59e0b', balance: 0, isRenter: true },
      ],
      slots: [],
      settings: { hourlyRate: 6 },
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Compute total minutes of a slot (cross-day aware)
function slotTotalMinutes(slot) {
  const startDate = slot.startDate || slot.date;
  const endDate = slot.endDate || slot.date;
  const startDay = new Date(startDate + 'T00:00:00').getTime();
  const endDay = new Date(endDate + 'T00:00:00').getTime();
  const daysDiff = Math.round((endDay - startDay) / 86400000);
  return daysDiff * 1440 + slot.endMin - slot.startMin;
}

app.get('/api/data', (req, res) => {
  res.json(readData());
});

app.put('/api/settings', (req, res) => {
  const data = readData();
  data.settings = { ...data.settings, ...req.body };
  writeData(data);
  broadcast(data);
  res.json(data.settings);
});

app.post('/api/users', (req, res) => {
  const data = readData();
  const user = {
    id: uuidv4(),
    name: req.body.name,
    color: req.body.color,
    balance: req.body.balance || 0,
    isRenter: req.body.isRenter || false,
  };
  data.users.push(user);
  writeData(data);
  broadcast(data);
  res.json(user);
});

app.put('/api/users/:id', (req, res) => {
  const data = readData();
  const idx = data.users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  data.users[idx] = { ...data.users[idx], ...req.body };
  writeData(data);
  broadcast(data);
  res.json(data.users[idx]);
});

app.delete('/api/users/:id', (req, res) => {
  const data = readData();
  data.users = data.users.filter(u => u.id !== req.params.id);
  data.slots = data.slots.filter(s => s.userId !== req.params.id);
  writeData(data);
  broadcast(data);
  res.json({ ok: true });
});

// POST add slot (cross-day aware)
app.post('/api/slots', (req, res) => {
  const data = readData();
  const slot = {
    id: uuidv4(),
    startDate: req.body.startDate || req.body.date,
    endDate: req.body.endDate || req.body.date,
    startMin: req.body.startMin,
    endMin: req.body.endMin,
    userId: req.body.userId,
    rentRate: req.body.rentRate != null ? req.body.rentRate : null,
  };

  const user = data.users.find(u => u.id === slot.userId);
  if (!user) return res.status(400).json({ error: 'User not found' });

  const totalMins = slotTotalMinutes(slot);
  const hours = totalMins / 60;

  if (user.isRenter) {
    const rentRate = slot.rentRate != null ? slot.rentRate : data.settings.hourlyRate;
    const loss = (data.settings.hourlyRate - rentRate) * hours;
    if (loss > 0) {
      const regularUsers = data.users.filter(u => !u.isRenter);
      if (regularUsers.length > 0) {
        const perUser = loss / regularUsers.length;
        regularUsers.forEach(ru => {
          const idx = data.users.findIndex(u => u.id === ru.id);
          data.users[idx].balance -= perUser;
        });
      }
    }
  } else {
    const cost = hours * data.settings.hourlyRate;
    const idx = data.users.findIndex(u => u.id === user.id);
    data.users[idx].balance -= cost;
  }

  data.slots.push(slot);
  writeData(data);
  broadcast(data);
  res.json({ slot, users: data.users });
});

// PUT update slot: reverse old effect, apply new effect
app.put('/api/slots/:id', (req, res) => {
  const data = readData();
  const oldSlot = data.slots.find(s => s.id === req.params.id);
  if (!oldSlot) return res.status(404).json({ error: 'Slot not found' });

  // Reverse old slot effect
  const oldUser = data.users.find(u => u.id === oldSlot.userId);
  const oldMins = slotTotalMinutes(oldSlot);
  const oldHours = oldMins / 60;
  if (oldUser) {
    if (oldUser.isRenter) {
      const oldRentRate = oldSlot.rentRate != null ? oldSlot.rentRate : data.settings.hourlyRate;
      const oldLoss = (data.settings.hourlyRate - oldRentRate) * oldHours;
      if (oldLoss > 0) {
        const regularUsers = data.users.filter(u => !u.isRenter);
        const perUser = oldLoss / regularUsers.length;
        regularUsers.forEach(ru => {
          const idx = data.users.findIndex(u => u.id === ru.id);
          data.users[idx].balance += perUser;
        });
      }
    } else {
      const idx = data.users.findIndex(u => u.id === oldUser.id);
      data.users[idx].balance += oldHours * data.settings.hourlyRate;
    }
  }

  // Apply new slot
  const newSlot = {
    id: oldSlot.id,
    startDate: req.body.startDate || req.body.date,
    endDate: req.body.endDate || req.body.date,
    startMin: req.body.startMin,
    endMin: req.body.endMin,
    userId: req.body.userId,
    rentRate: req.body.rentRate != null ? req.body.rentRate : null,
  };
  const newUser = data.users.find(u => u.id === newSlot.userId);
  if (!newUser) return res.status(400).json({ error: 'User not found' });
  const newMins = slotTotalMinutes(newSlot);
  const newHours = newMins / 60;
  if (newUser.isRenter) {
    const rentRate = newSlot.rentRate != null ? newSlot.rentRate : data.settings.hourlyRate;
    const loss = (data.settings.hourlyRate - rentRate) * newHours;
    if (loss > 0) {
      const regularUsers = data.users.filter(u => !u.isRenter);
      const perUser = loss / regularUsers.length;
      regularUsers.forEach(ru => {
        const idx = data.users.findIndex(u => u.id === ru.id);
        data.users[idx].balance -= perUser;
      });
    }
  } else {
    const idx = data.users.findIndex(u => u.id === newUser.id);
    data.users[idx].balance -= newHours * data.settings.hourlyRate;
  }

  const slotIdx = data.slots.findIndex(s => s.id === req.params.id);
  data.slots[slotIdx] = newSlot;
  writeData(data);
  broadcast(data);
  res.json({ slot: newSlot, users: data.users });
});

app.delete('/api/slots/:id', (req, res) => {
  const data = readData();
  const slot = data.slots.find(s => s.id === req.params.id);
  if (!slot) return res.status(404).json({ error: 'Slot not found' });

  const user = data.users.find(u => u.id === slot.userId);
  const totalMins = slotTotalMinutes(slot);
  const hours = totalMins / 60;

  if (user) {
    if (user.isRenter) {
      const rentRate = slot.rentRate != null ? slot.rentRate : data.settings.hourlyRate;
      const loss = (data.settings.hourlyRate - rentRate) * hours;
      if (loss > 0) {
        const regularUsers = data.users.filter(u => !u.isRenter);
        if (regularUsers.length > 0) {
          const perUser = loss / regularUsers.length;
          regularUsers.forEach(ru => {
            const idx = data.users.findIndex(u => u.id === ru.id);
            data.users[idx].balance += perUser;
          });
        }
      }
    } else {
      const cost = hours * data.settings.hourlyRate;
      const idx = data.users.findIndex(u => u.id === user.id);
      data.users[idx].balance += cost;
    }
  }

  data.slots = data.slots.filter(s => s.id !== req.params.id);
  writeData(data);
  broadcast(data);
  res.json({ ok: true, users: data.users });
});

app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

// ===== TELEGRAM NOTIFICATIONS =====

function fmtMin(m) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

async function sendTelegram(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' }),
    });
    if (!res.ok) console.error('Telegram error:', await res.text());
  } catch (e) {
    console.error('Telegram send failed:', e.message);
  }
}

// Track which slots were already notified to avoid spam
const notifiedEnding = new Set();  // slot.id — notified "ending in 10 min"
let lastGapNotifiedAt = 0;          // timestamp — last "no slot" notification

function getSlotCoverageAt(slots, todayStr, nowMin) {
  return slots.filter(slot => {
    const sd = slot.startDate || slot.date;
    const ed = slot.endDate || slot.date;
    // Slot covers today
    if (sd > todayStr || ed < todayStr) return false;
    const startM = sd < todayStr ? 0 : slot.startMin;
    const endM   = ed > todayStr ? 1440 : slot.endMin;
    return startM <= nowMin && nowMin < endM;
  });
}

function checkNotifications() {
  const data = readData();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // 1) Slot ending soon (within 10 min window: 9–11 min left)
  data.slots.forEach(slot => {
    const sd = slot.startDate || slot.date;
    const ed = slot.endDate || slot.date;
    if (ed !== todayStr) return; // only slots ending today
    if (sd > todayStr) return;   // hasn't started yet on another day

    const minsLeft = slot.endMin - nowMin;
    if (minsLeft >= 9 && minsLeft <= 11 && !notifiedEnding.has(slot.id)) {
      notifiedEnding.add(slot.id);
      const user = data.users.find(u => u.id === slot.userId);
      const name = user ? user.name : 'Неизвестный';
      sendTelegram(
        `⏰ <b>Слот заканчивается через ~10 минут</b>\n` +
        `👤 ${name}\n` +
        `🕐 До <b>${fmtMin(slot.endMin)}</b>`
      );
    }
    // Clean up old notifications so they can re-trigger on a new day
    if (minsLeft < -60) notifiedEnding.delete(slot.id);
  });

  // 2) No slot covers the NEXT 10 minutes → alert once per 30 min max
  const in10Min = nowMin + 10;
  const coverNow  = getSlotCoverageAt(data.slots, todayStr, nowMin).length > 0;
  const coverSoon = getSlotCoverageAt(data.slots, todayStr, in10Min <= 1439 ? in10Min : 1439).length > 0;

  if (!coverNow && !coverSoon) {
    const elapsed = Date.now() - lastGapNotifiedAt;
    if (elapsed > 30 * 60 * 1000) {
      lastGapNotifiedAt = Date.now();
      sendTelegram(
        `⚠️ <b>Свободное время не занято!</b>\n` +
        `Сейчас <b>${fmtMin(nowMin)}</b> — ни у кого нет активного или ближайшего слота.\n` +
        `Не забудьте назначить время!`
      );
    }
  }
}

// Run every minute
setInterval(checkNotifications, 60 * 1000);

const PORT = process.env.PORT || 6767;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Telegram notifications: ${TELEGRAM_BOT_TOKEN ? 'enabled' : 'disabled (no token)'}`);
});
