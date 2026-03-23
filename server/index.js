import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'data.json');

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '..', 'dist')));

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
  res.json(user);
});

app.put('/api/users/:id', (req, res) => {
  const data = readData();
  const idx = data.users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  data.users[idx] = { ...data.users[idx], ...req.body };
  writeData(data);
  res.json(data.users[idx]);
});

app.delete('/api/users/:id', (req, res) => {
  const data = readData();
  data.users = data.users.filter(u => u.id !== req.params.id);
  data.slots = data.slots.filter(s => s.userId !== req.params.id);
  writeData(data);
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
  res.json({ slot, users: data.users });
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
  res.json({ ok: true, users: data.users });
});

app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

const PORT = process.env.PORT || 6767;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
