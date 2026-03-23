import { useState, useEffect, useCallback } from 'react';
import Timeline from './components/Timeline';
import Sidebar from './components/Sidebar';
import SlotModal from './components/SlotModal';
import './App.css';

const API = '/api';

function App() {
  const [data, setData] = useState({ users: [], slots: [], settings: { hourlyRate: 6 } });
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

  const openModal = (startDate, startMin, endDate, endMin) => {
    setModal({ startDate, startMin, endDate, endMin });
  };

  return (
    <div className="app">
      <header className="header">
        <button className="btn-icon sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} title="Настройки">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        <div className="header-center">
          <span className="header-title">Timeslot Tracker</span>
          <div className="rate-display">
            <span className="rate-label">Ставка</span>
            <span className="rate-value">${data.settings.hourlyRate}/ч</span>
          </div>
        </div>

        <div className="header-right">
          <button className="btn-add-slot" onClick={() => {
            const today = new Date().toISOString().slice(0, 10);
            openModal(today, 0, today, 60);
          }}>
            + Слот
          </button>
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
          slots={data.slots}
          users={data.users}
          hourlyRate={data.settings.hourlyRate}
          onSelectRange={openModal}
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
