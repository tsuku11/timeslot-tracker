import { useState } from 'react';

function fmtMin(m) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function parseTime(str) {
  const [h, m] = str.split(':').map(Number);
  return h * 60 + (m || 0);
}

function SlotModal({ startMin, endMin, users, hourlyRate, currentDate, onSave, onClose }) {
  const [userId, setUserId] = useState(users[0]?.id || '');
  const [startTime, setStartTime] = useState(fmtMin(startMin));
  const [endTime, setEndTime] = useState(fmtMin(endMin));
  const [rentRate, setRentRate] = useState(hourlyRate);

  const start = parseTime(startTime);
  const end = parseTime(endTime);
  const durationMins = end - start;
  const hours = durationMins / 60;

  const selectedUser = users.find(u => u.id === userId);
  const isRenter = selectedUser?.isRenter;
  const cost = hours * hourlyRate;
  const rentLoss = isRenter ? (hourlyRate - Number(rentRate)) * hours : 0;
  const regularUsers = users.filter(u => !u.isRenter);

  const handleSave = () => {
    if (durationMins <= 0 || !userId) return;
    const slot = {
      date: currentDate,
      startMin: start,
      endMin: end,
      userId,
    };
    if (isRenter) {
      slot.rentRate = Number(rentRate);
    }
    onSave(slot);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Добавить слот</h2>
          <button className="btn-icon" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {/* Time inputs */}
          <div className="time-select">
            <div className="time-field">
              <label>Начало</label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="input time-input"
              />
            </div>
            <div className="time-arrow">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12,5 19,12 12,19"/>
              </svg>
            </div>
            <div className="time-field">
              <label>Конец</label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="input time-input"
              />
            </div>
          </div>

          {durationMins <= 0 && (
            <div className="error-msg">Время конца должно быть позже начала</div>
          )}

          {/* User selection */}
          <div className="field">
            <label>Кому назначить</label>
            <div className="user-select">
              {users.map(u => (
                <button
                  key={u.id}
                  className={`user-option ${userId === u.id ? 'active' : ''}`}
                  onClick={() => setUserId(u.id)}
                  style={{ borderColor: userId === u.id ? u.color : 'transparent' }}
                >
                  <div className="user-option-avatar" style={{ backgroundColor: u.color }}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="user-option-info">
                    <span className="user-option-name">
                      {u.name}
                      {u.isRenter && <span className="renter-badge-sm">Аренда</span>}
                    </span>
                    {!u.isRenter && (
                      <span className="user-option-balance">${u.balance.toFixed(2)}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Rent rate — only when renter selected */}
          {isRenter && (
            <div className="field">
              <label>За сколько сдаём ($/ч)</label>
              <div className="input-group">
                <span className="input-prefix">$</span>
                <input
                  type="number"
                  value={rentRate}
                  onChange={e => setRentRate(e.target.value)}
                  className="input"
                  min="0"
                  step="0.5"
                />
                <span className="input-suffix">/ч</span>
              </div>
            </div>
          )}

          {/* Cost preview */}
          <div className="cost-preview">
            <div className="cost-row">
              <span>Длительность</span>
              <span className="cost-value">{durationMins > 0 ? `${hours.toFixed(1)} ч` : '—'}</span>
            </div>
            {!isRenter && durationMins > 0 && (
              <div className="cost-row">
                <span>Стоимость</span>
                <span className="cost-value negative">−${cost.toFixed(2)}</span>
              </div>
            )}
            {isRenter && durationMins > 0 && (
              <>
                <div className="cost-row">
                  <span>Ставка аренды</span>
                  <span className="cost-value">${Number(rentRate).toFixed(2)}/ч</span>
                </div>
                {rentLoss > 0 ? (
                  <>
                    <div className="cost-row warning">
                      <span>Потеря (делится на {regularUsers.length} чел.)</span>
                      <span className="cost-value negative">−${rentLoss.toFixed(2)}</span>
                    </div>
                    <div className="cost-row">
                      <span>С каждого</span>
                      <span className="cost-value negative">
                        −${(rentLoss / Math.max(regularUsers.length, 1)).toFixed(2)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="cost-row">
                    <span>Потери нет</span>
                    <span className="cost-value" style={{ color: 'var(--success)' }}>$0.00</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Отмена</button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={durationMins <= 0 || !userId}
          >
            Добавить
          </button>
        </div>
      </div>
    </div>
  );
}

export default SlotModal;
