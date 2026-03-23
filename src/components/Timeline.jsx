import { useState, useRef, useEffect } from 'react';

const TOTAL_MINUTES = 1440;

function fmtMin(m) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function Timeline({ slots, users, currentDate, hourlyRate, onClickTime, onDeleteSlot }) {
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const gridRef = useRef(null);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const isToday = currentDate === todayStr;
  const currentMin = isToday ? now.getHours() * 60 + now.getMinutes() : -1;

  // Update current time every minute
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isToday) return;
    const iv = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(iv);
  }, [isToday]);

  const getUserById = (id) => users.find(u => u.id === id);

  const pct = (min) => (min / TOTAL_MINUTES) * 100;

  const handleGridClick = (e) => {
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    const clickedMin = Math.round(ratio * TOTAL_MINUTES);
    const snapped = Math.round(clickedMin / 5) * 5;
    onClickTime(Math.max(0, Math.min(snapped, 1380)));
  };

  // Group slots by user rows
  const userRows = users.filter(u => {
    return slots.some(s => s.userId === u.id);
  });

  // Add users who have no slots but are regular users (show empty rows)
  const allRelevantUsers = [...users];

  return (
    <div className="timeline">
      {/* Horizontal time axis */}
      <div className="timeline-container">
        {/* User labels on left */}
        <div className="timeline-labels">
          <div className="timeline-label-header">Часы</div>
          {allRelevantUsers.map(u => (
            <div key={u.id} className="timeline-label">
              <div className="tl-avatar" style={{ backgroundColor: u.color }}>
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="tl-info">
                <span className="tl-name">{u.name}</span>
                {u.isRenter && <span className="tl-renter-badge">Аренда</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Grid area */}
        <div className="timeline-scroll">
          <div className="timeline-grid" ref={gridRef}>
            {/* Hour markers on top */}
            <div className="timeline-hours">
              {Array.from({ length: 25 }, (_, i) => (
                <div
                  key={i}
                  className="hour-marker"
                  style={{ left: `${pct(i * 60)}%` }}
                >
                  <span className="hour-marker-text">{fmtMin(i * 60 === 1440 ? 0 : i * 60)}</span>
                </div>
              ))}
            </div>

            {/* User rows with slots */}
            <div className="timeline-rows">
              {allRelevantUsers.map(user => {
                const userSlots = slots.filter(s => s.userId === user.id);
                return (
                  <div key={user.id} className="timeline-row">
                    {/* Hour grid lines */}
                    {Array.from({ length: 24 }, (_, i) => (
                      <div
                        key={i}
                        className="hour-cell"
                        style={{ left: `${pct(i * 60)}%`, width: `${pct(60)}%` }}
                        onClick={handleGridClick}
                      />
                    ))}

                    {/* Slot blocks */}
                    {userSlots.map(slot => {
                      const left = pct(slot.startMin);
                      const width = pct(slot.endMin - slot.startMin);
                      const hours = (slot.endMin - slot.startMin) / 60;
                      const isRenter = user.isRenter;

                      return (
                        <div
                          key={slot.id}
                          className={`slot-block ${isRenter ? 'renter' : ''}`}
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            backgroundColor: user.color + '35',
                            borderColor: user.color,
                          }}
                          onMouseEnter={(e) => {
                            setHoveredSlot(slot.id);
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltip({
                              x: rect.left + rect.width / 2,
                              y: rect.top - 8,
                              user: user.name,
                              time: `${fmtMin(slot.startMin)} — ${fmtMin(slot.endMin)}`,
                              hours: hours.toFixed(1),
                              cost: isRenter ? null : (hours * hourlyRate).toFixed(2),
                              isRenter,
                              rentRate: isRenter && slot.rentRate != null ? slot.rentRate : null,
                            });
                          }}
                          onMouseLeave={() => { setHoveredSlot(null); setTooltip(null); }}
                        >
                          <span className="slot-block-label">
                            {fmtMin(slot.startMin)}–{fmtMin(slot.endMin)}
                          </span>
                          {hoveredSlot === slot.id && (
                            <button
                              className="slot-delete"
                              onClick={(e) => { e.stopPropagation(); onDeleteSlot(slot.id); }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* Current time line */}
                    {isToday && currentMin >= 0 && (
                      <div className="current-time-v" style={{ left: `${pct(currentMin)}%` }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Current time on the hour header */}
            {isToday && currentMin >= 0 && (
              <div className="current-time-header" style={{ left: `${pct(currentMin)}%` }}>
                <div className="current-time-tag">{fmtMin(currentMin)}</div>
                <div className="current-time-line-full" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="slot-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="tooltip-name">{tooltip.user}</div>
          <div className="tooltip-time">{tooltip.time}</div>
          <div className="tooltip-hours">{tooltip.hours} ч</div>
          {tooltip.cost && <div className="tooltip-cost">−${tooltip.cost}</div>}
          {tooltip.isRenter && tooltip.rentRate != null && (
            <div className="tooltip-rent">Ставка: ${tooltip.rentRate}/ч</div>
          )}
        </div>
      )}

      {/* Summary bar */}
      <div className="timeline-summary">
        <div className="summary-items">
          {users.map(user => {
            const userSlots = slots.filter(s => s.userId === user.id);
            const totalMins = userSlots.reduce((sum, s) => sum + (s.endMin - s.startMin), 0);
            const totalHours = totalMins / 60;
            if (totalMins === 0) return null;
            return (
              <div key={user.id} className="summary-item">
                <div className="summary-dot" style={{ backgroundColor: user.color }} />
                <span className="summary-name">{user.name}</span>
                <span className="summary-hours">{totalHours.toFixed(1)}ч</span>
                {!user.isRenter && (
                  <span className="summary-cost">−${(totalHours * hourlyRate).toFixed(2)}</span>
                )}
                {user.isRenter && (
                  <span className="summary-rent-tag">аренда</span>
                )}
              </div>
            );
          })}
          <div className="summary-total">
            {(() => {
              const totalMins = slots.reduce((sum, s) => sum + (s.endMin - s.startMin), 0);
              const totalHours = totalMins / 60;
              return (
                <>
                  <span>Занято: {totalHours.toFixed(1)}ч / 24ч</span>
                  <div className="summary-bar">
                    <div className="summary-bar-fill" style={{ width: `${(totalMins / TOTAL_MINUTES) * 100}%` }} />
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Timeline;
