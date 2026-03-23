import { useState } from 'react';

const COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444', '#84cc16'];

function Sidebar({ open, onClose, users, settings, onUpdateSettings, onAddUser, onUpdateUser, onDeleteUser }) {
  const [newUserName, setNewUserName] = useState('');
  const [newUserColor, setNewUserColor] = useState(COLORS[0]);
  const [newUserBalance, setNewUserBalance] = useState(100);
  const [editingUser, setEditingUser] = useState(null);
  const [editRate, setEditRate] = useState(settings.hourlyRate);

  const handleAddUser = () => {
    if (!newUserName.trim()) return;
    onAddUser({
      name: newUserName.trim(),
      color: newUserColor,
      balance: Number(newUserBalance),
      isRenter: false,
    });
    setNewUserName('');
    setNewUserBalance(100);
    setNewUserColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
  };

  const handleSaveRate = () => {
    onUpdateSettings({ hourlyRate: Number(editRate) });
  };

  const regularUsers = users.filter(u => !u.isRenter);
  const renter = users.find(u => u.isRenter);

  return (
    <div className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-header">
        <h2>Настройки</h2>
        <button className="btn-icon" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Rate setting */}
      <div className="sidebar-section">
        <h3>Стоимость часа</h3>
        <div className="rate-setting">
          <div className="input-group">
            <span className="input-prefix">$</span>
            <input type="number" value={editRate} onChange={e => setEditRate(e.target.value)} className="input" min="0" step="0.5"/>
            <span className="input-suffix">/ч</span>
          </div>
          <button className="btn-primary btn-sm" onClick={handleSaveRate}>Сохранить</button>
        </div>
      </div>

      {/* Regular users */}
      <div className="sidebar-section">
        <h3>Пользователи ({regularUsers.length})</h3>
        <div className="users-list">
          {regularUsers.map(user => (
            <div key={user.id} className="user-card">
              {editingUser === user.id ? (
                <UserEditForm
                  user={user}
                  onSave={(updates) => { onUpdateUser(user.id, updates); setEditingUser(null); }}
                  onCancel={() => setEditingUser(null)}
                />
              ) : (
                <>
                  <div className="user-info">
                    <div className="user-avatar" style={{ backgroundColor: user.color }}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="user-details">
                      <span className="user-name">{user.name}</span>
                      <span className="user-balance">${user.balance.toFixed(2)} USDT</span>
                    </div>
                  </div>
                  <div className="user-actions">
                    <button className="btn-icon btn-sm" onClick={() => setEditingUser(user.id)} title="Редактировать">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button className="btn-icon btn-sm btn-danger" onClick={() => onDeleteUser(user.id)} title="Удалить">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Renter info */}
      {renter && (
        <div className="sidebar-section">
          <h3>Арендатор</h3>
          <div className="renter-info-card">
            <div className="user-info">
              <div className="user-avatar" style={{ backgroundColor: renter.color }}>
                {renter.name.charAt(0).toUpperCase()}
              </div>
              <div className="user-details">
                <span className="user-name">{renter.name}</span>
                <span className="user-rent-rate">Деньги не списываются</span>
              </div>
            </div>
            <p className="renter-hint">
              Ставку аренды указываете при добавлении слота. Если ставка ниже базовой — разница делится поровну между пользователями.
            </p>
          </div>
        </div>
      )}

      {/* Add user */}
      <div className="sidebar-section">
        <h3>Добавить пользователя</h3>
        <div className="add-user-form">
          <input
            type="text"
            placeholder="Имя"
            value={newUserName}
            onChange={e => setNewUserName(e.target.value)}
            className="input"
            onKeyDown={e => e.key === 'Enter' && handleAddUser()}
          />
          <div className="form-row">
            <div className="input-group">
              <span className="input-prefix">$</span>
              <input type="number" placeholder="Баланс USDT" value={newUserBalance} onChange={e => setNewUserBalance(e.target.value)} className="input"/>
            </div>
          </div>
          <div className="color-picker">
            {COLORS.map(c => (
              <button key={c} className={`color-swatch ${newUserColor === c ? 'active' : ''}`} style={{ backgroundColor: c }} onClick={() => setNewUserColor(c)}/>
            ))}
          </div>
          <button className="btn-primary" onClick={handleAddUser} disabled={!newUserName.trim()}>
            + Добавить
          </button>
        </div>
      </div>
    </div>
  );
}

function UserEditForm({ user, onSave, onCancel }) {
  const [name, setName] = useState(user.name);
  const [balance, setBalance] = useState(user.balance);
  const [color, setColor] = useState(user.color);

  return (
    <div className="user-edit-form">
      <input type="text" value={name} onChange={e => setName(e.target.value)} className="input" />
      <div className="form-row">
        <div className="input-group">
          <span className="input-prefix">$</span>
          <input type="number" value={balance} onChange={e => setBalance(Number(e.target.value))} className="input" />
        </div>
      </div>
      <div className="color-picker small">
        {COLORS.map(c => (
          <button key={c} className={`color-swatch ${color === c ? 'active' : ''}`} style={{ backgroundColor: c }} onClick={() => setColor(c)}/>
        ))}
      </div>
      <div className="form-row">
        <button className="btn-primary btn-sm" onClick={() => onSave({ name, balance, color })}>Сохранить</button>
        <button className="btn-secondary btn-sm" onClick={onCancel}>Отмена</button>
      </div>
    </div>
  );
}

export default Sidebar;
