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

function SlotModal({ startDate, endDate, startMin, endMin, users, hourlyRate, onSave, onClose }) {
  const [userId, setUserId] = useState(users[0]?.id || '');
  const [startTime, setStartTime] = useState(fmtMin(startMin));
  const [endTime, setEndTime] = useState(fmtMin(endMin));
  const [slotStartDate, setSlotStartDate] = useState(startDate);
  const [slotEndDate, setSlotEndDate] = useState(endDate);
  const [rentRate, setRentRate] = useState(hourlyRate);

  const start = parseTime(startTime);
  const end = parseTime(endTime);

  // Calculate total minutes (cross-day)
  const daysDiff = Math.max(0, Math.round(
    (new Date(slotEndDate + 'T00:00:00').getTime() - new Date(slotStartDate + 'T00:00:00').getTime()) / 86400000
  ));
  const totalMins = daysDiff * 1440 + end - start;
  const hours = totalMins / 60;
  const isCrossDay = slotStartDate !== slotEndDate;

  const selectedUser = users.find(u => u.id === userId);
  const isRenter = selectedUser?.isRenter;
  const cost = hours * hourlyRate;
  const rentLoss = isRenter ? (hourlyRate - Number(rentRate)) * hours : 0;
  const regularUsers = users.filter(u => !u.isRenter);

  const isValid = totalMins > 0 && userId && slotEndDate >= slotStartDate;

  const handleSave = () => {
    if (!isValid) return;
    const slot = {
      startDate: slotStartDate,
      endDate: slotEndDate,
      startMin: start,
      endMin: end,
      userId,
    };
    if (isRenter) {
      slot.rentRate = Number(rentRate);
    }
    onSave(slot);
  };

  const formatDateShort = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
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
          {/* Date & Time inputs */}
          <div className="datetime-row">
            <div className="datetime-block">
              <label>Начало</label>
              <div className="datetime-inputs">
                <input
                  type="date"
                  value={slotStartDate}
                  onChange={e => {
                    setSlotStartDate(e.target.value);
                    if (e.target.value > slotEndDate) setSlotEndDate(e.target.value);
                  }}
                  className="input date-input-field"
                />
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="input time-input"
                  step="60"
                />
              </div>
            </div>
            <div className="datetime-arrow">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12,5 19,12 12,19"/>
              </svg>
            </div>
            <div className="datetime-block">
              <label>Конец</label>
              <div className="datetime-inputs">
                <input
                  type="date"
                  value={slotEndDate}
                  onChange={e => {
                    if (e.target.value >= slotStartDate) setSlotEndDate(e.target.value);
                  }}
                  className="input date-input-field"
                  min={slotStartDate}
                />
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="input time-input"
                  step="60"
                />
              </div>
            </div>
          </div>

          {isCrossDay && (
            <div className="info-msg">
              Межсуточный слот: {formatDateShort(slotStartDate)} {startTime} → {formatDateShort(slotEndDate)} {endTime}
            </div>
          )}

          {totalMins <= 0 && (
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

          {/* Rent rate */}
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
              <span className="cost-value">{totalMins > 0 ? `${hours.toFixed(1)} ч` : '—'}</span>
            </div>
            {isCrossDay && totalMins > 0 && (
              <div className="cost-row">
                <span>Дней</span>
                <span className="cost-value">{daysDiff + 1}</span>
              </div>
            )}
            {!isRenter && totalMins > 0 && (
              <div className="cost-row">
                <span>Стоимость</span>
                <span className="cost-value negative">−${cost.toFixed(2)}</span>
              </div>
            )}
            {isRenter && totalMins > 0 && (
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
            disabled={!isValid}
          >
            Добавить
          </button>
        </div>
      </div>
    </div>
  );
}

export default SlotModal;
