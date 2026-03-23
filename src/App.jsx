import { useState, useEffect, useCallback } from 'react';
import Timeline from './components/Timeline';
import Sidebar from './components/Sidebar';
import SlotModal from './components/SlotModal';
import './App.css';

const API = '/api';

function App() {
  const [data, setData] = useState({ users: [], slots: [], settings: { hourlyRate: 6 } });
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().slice(0, 10));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modal, setModal] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API}/data`);
      const d = await res.json();
      setData(d);
    } catch (e) {
      console.error('Failed to fetch data:', e);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const navigateDay = (dir) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + dir);
    setCurrentDate(d.toISOString().slice(0, 10));
  };

  const addSlot = async (slot) => {
    await fetch(`${API}/slots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slot),
    });
    fetchData();
    setModal(null);
  };

  const deleteSlot = async (id) => {
    await fetch(`${API}/slots/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const updateSettings = async (settings) => {
    await fetch(`${API}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    fetchData();
  };

  const addUser = async (user) => {
    await fetch(`${API}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    fetchData();
  };

  const updateUser = async (id, updates) => {
    await fetch(`${API}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    fetchData();
  };

  const deleteUser = async (id) => {
    await fetch(`${API}/users/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const daySlots = data.slots.filter(s => s.date === currentDate);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const isToday = currentDate === new Date().toISOString().slice(0, 10);

  return (
    <div className="app">
      <header className="header">
        <button className="btn-icon sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} title="Настройки">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        <div className="date-nav">
          <button className="btn-nav" onClick={() => navigateDay(-1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15,18 9,12 15,6"/>
            </svg>
          </button>
          <div className="date-display">
            <input type="date" value={currentDate} onChange={(e) => setCurrentDate(e.target.value)} className="date-input"/>
            <span className="date-text">{formatDate(currentDate)}</span>
            {isToday && <span className="today-badge">Сегодня</span>}
          </div>
          <button className="btn-nav" onClick={() => navigateDay(1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9,6 15,12 9,18"/>
            </svg>
          </button>
          {!isToday && (
            <button className="btn-today" onClick={() => setCurrentDate(new Date().toISOString().slice(0, 10))}>
              Сегодня
            </button>
          )}
        </div>

        <div className="header-right">
          <button className="btn-add-slot" onClick={() => setModal({ startMin: 0, endMin: 60 })}>
            + Слот
          </button>
          <div className="rate-display">
            <span className="rate-label">Ставка</span>
            <span className="rate-value">${data.settings.hourlyRate}/ч</span>
          </div>
        </div>
      </header>

      <div className="main-content">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          users={data.users}
          settings={data.settings}
          onUpdateSettings={updateSettings}
          onAddUser={addUser}
          onUpdateUser={updateUser}
          onDeleteUser={deleteUser}
        />
        {sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(false)} />}

        <Timeline
          slots={daySlots}
          users={data.users}
          currentDate={currentDate}
          hourlyRate={data.settings.hourlyRate}
          onClickTime={(startMin) => setModal({ startMin, endMin: Math.min(startMin + 60, 1440) })}
          onDeleteSlot={deleteSlot}
        />
      </div>

      {modal && (
        <SlotModal
          startMin={modal.startMin}
          endMin={modal.endMin}
          users={data.users}
          hourlyRate={data.settings.hourlyRate}
          currentDate={currentDate}
          onSave={addSlot}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

export default App;
