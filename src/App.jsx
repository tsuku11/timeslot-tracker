import { useState, useEffect, useCallback, useRef } from 'react';
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

  // Swipe support
  const touchStart = useRef(null);
  const appRef = useRef(null);

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

  const navigateDay = useCallback((dir) => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + dir);
      return d.toISOString().slice(0, 10);
    });
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || modal) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); navigateDay(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); navigateDay(1); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigateDay, modal]);

  // Touch swipe navigation
  useEffect(() => {
    const el = appRef.current;
    if (!el) return;
    const onStart = (e) => { touchStart.current = e.touches[0].clientX; };
    const onEnd = (e) => {
      if (touchStart.current === null) return;
      const diff = e.changedTouches[0].clientX - touchStart.current;
      if (Math.abs(diff) > 60) {
        navigateDay(diff > 0 ? -1 : 1);
      }
      touchStart.current = null;
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend', onEnd);
    };
  }, [navigateDay]);

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

  // Get slots visible on current day (cross-day aware)
  const getDaySlots = () => {
    return data.slots.filter(s => {
      const sd = s.startDate || s.date;
      const ed = s.endDate || s.date;
      return sd <= currentDate && ed >= currentDate;
    }).map(s => {
      const sd = s.startDate || s.date;
      const ed = s.endDate || s.date;
      // Calculate visible portion on this day
      let visStart = 0;
      let visEnd = 1440;
      if (sd === currentDate) visStart = s.startMin;
      if (ed === currentDate) visEnd = s.endMin;
      return { ...s, visStart, visEnd };
    });
  };

  const daySlots = getDaySlots();

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const isToday = currentDate === new Date().toISOString().slice(0, 10);

  const openModal = (startMin, endMin) => {
    setModal({
      startDate: currentDate,
      endDate: currentDate,
      startMin: startMin ?? 0,
      endMin: endMin ?? 60,
    });
  };

  return (
    <div className="app" ref={appRef}>
      <header className="header">
        <button className="btn-icon sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} title="Настройки">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        <div className="date-nav">
          <button className="btn-nav" onClick={() => navigateDay(-1)} title="Предыдущий день (←)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15,18 9,12 15,6"/>
            </svg>
          </button>
          <div className="date-display">
            <input type="date" value={currentDate} onChange={(e) => e.target.value && setCurrentDate(e.target.value)} className="date-input"/>
            <span className="date-text">{formatDate(currentDate)}</span>
            {isToday && <span className="today-badge">Сегодня</span>}
          </div>
          <button className="btn-nav" onClick={() => navigateDay(1)} title="Следующий день (→)">
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
          <button className="btn-add-slot" onClick={() => openModal()}>
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
          onSelectRange={(startMin, endMin) => openModal(startMin, endMin)}
          onDeleteSlot={deleteSlot}
        />
      </div>

      {modal && (
        <SlotModal
          startDate={modal.startDate}
          endDate={modal.endDate}
          startMin={modal.startMin}
          endMin={modal.endMin}
          users={data.users}
          hourlyRate={data.settings.hourlyRate}
          onSave={addSlot}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

export default App;
