import { useState, useRef, useEffect, useCallback } from 'react';

const TOTAL_MINUTES = 1440;

function fmtMin(m) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function Timeline({ slots, users, currentDate, hourlyRate, onSelectRange, onDeleteSlot }) {
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const gridRef = useRef(null);

  // Drag-to-select state
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);
  const dragStartRef = useRef(null);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const isToday = currentDate === todayStr;
  const currentMin = isToday ? now.getHours() * 60 + now.getMinutes() : -1;

  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isToday) return;
    const iv = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(iv);
  }, [isToday]);

  const getUserById = (id) => users.find(u => u.id === id);

  const pct = (min) => (min / TOTAL_MINUTES) * 100;

  const getMinFromX = useCallback((clientX) => {
    if (!gridRef.current) return 0;
    const rect = gridRef.current.getBoundingClientRect();
    const x = clientX - rect.left + gridRef.current.parentElement.scrollLeft;
    const totalWidth = gridRef.current.scrollWidth;
    const ratio = x / totalWidth;
    return Math.max(0, Math.min(1440, Math.round(ratio * TOTAL_MINUTES)));
  }, []);

  // Drag handlers
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    // Don't start drag on slot blocks
    if (e.target.closest('.slot-block')) return;
    const min = getMinFromX(e.clientX);
    setDragging(true);
    setDragStart(min);
    setDragEnd(min);
    dragStartRef.current = min;
    e.preventDefault();
  }, [getMinFromX]);

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return;
    const min = getMinFromX(e.clientX);
    setDragEnd(min);
  }, [dragging, getMinFromX]);

  const handleMouseUp = useCallback((e) => {
    if (!dragging) return;
    setDragging(false);
    const min = getMinFromX(e.clientX);
    const start = Math.min(dragStartRef.current, min);
    const end = Math.max(dragStartRef.current, min);
    if (end - start >= 5) {
      onSelectRange(start, end);
    }
    setDragStart(null);
    setDragEnd(null);
  }, [dragging, getMinFromX, onSelectRange]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => handleMouseMove(e);
    const onUp = (e) => handleMouseUp(e);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, handleMouseMove, handleMouseUp]);

  // Selection range
  const selStart = dragStart !== null && dragEnd !== null ? Math.min(dragStart, dragEnd) : null;
  const selEnd = dragStart !== null && dragEnd !== null ? Math.max(dragStart, dragEnd) : null;

  const allRelevantUsers = [...users];

  return (
    <div className="timeline">
      <div className="timeline-container">
        {/* Left labels */}
        <div className="timeline-labels">
          <div className="timeline-label-header">
            <span>Часы</span>
          </div>
          {allRelevantUsers.map(u => (
            <div key={u.id} className="timeline-label">
              <div className="tl-avatar" style={{ backgroundColor: u.color }}>
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="tl-info">
                <span className="tl-name">{u.name}</span>
                {u.isRenter && <span className="tl-renter-badge">Аренда</span>}
                {!u.isRenter && <span className="tl-balance">${u.balance.toFixed(2)}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Grid area */}
        <div className="timeline-scroll">
          <div className="timeline-grid" ref={gridRef}>
            {/* Hour markers */}
            <div className="timeline-hours">
              {Array.from({ length: 25 }, (_, i) => (
                <div key={i} className="hour-marker" style={{ left: `${pct(i * 60)}%` }}>
                  <span className="hour-marker-text">{fmtMin(i * 60 === 1440 ? 0 : i * 60)}</span>
                </div>
              ))}
              {/* Current time on header */}
              {isToday && currentMin >= 0 && (
                <div className="current-time-header" style={{ left: `${pct(currentMin)}%` }}>
                  <div className="current-time-tag">{fmtMin(currentMin)}</div>
                </div>
              )}
            </div>

            {/* User rows */}
            <div className="timeline-rows" onMouseDown={handleMouseDown}>
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
                      />
                    ))}

                    {/* Drag selection overlay */}
                    {dragging && selStart !== null && selEnd !== null && selEnd - selStart >= 5 && (
                      <div
                        className="drag-selection"
                        style={{
                          left: `${pct(selStart)}%`,
                          width: `${pct(selEnd - selStart)}%`,
                        }}
                      >
                        <span className="drag-label">{fmtMin(selStart)} — {fmtMin(selEnd)}</span>
                      </div>
                    )}

                    {/* Slot blocks */}
                    {userSlots.map(slot => {
                      const left = pct(slot.visStart);
                      const width = pct(slot.visEnd - slot.visStart);
                      const totalMins = slot.visEnd - slot.visStart;
                      const hours = totalMins / 60;
                      const isRenter = user.isRenter;
                      const sd = slot.startDate || slot.date;
                      const ed = slot.endDate || slot.date;
                      const isCrossDay = sd !== ed;

                      return (
                        <div
                          key={slot.id}
                          className={`slot-block ${isRenter ? 'renter' : ''} ${isCrossDay ? 'cross-day' : ''}`}
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
                              time: isCrossDay
                                ? `${sd} ${fmtMin(slot.startMin)} — ${ed} ${fmtMin(slot.endMin)}`
                                : `${fmtMin(slot.visStart)} — ${fmtMin(slot.visEnd)}`,
                              hours: hours.toFixed(1),
                              cost: isRenter ? null : (hours * hourlyRate).toFixed(2),
                              isRenter,
                              rentRate: isRenter && slot.rentRate != null ? slot.rentRate : null,
                              isCrossDay,
                            });
                          }}
                          onMouseLeave={() => { setHoveredSlot(null); setTooltip(null); }}
                        >
                          <span className="slot-block-label">
                            {fmtMin(slot.visStart)}–{fmtMin(slot.visEnd)}
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
          {tooltip.isCrossDay && <div className="tooltip-crossday">Межсуточный слот</div>}
        </div>
      )}

      {/* Day swipe hint */}
      <div className="swipe-hint">
        <span>← → листать дни</span>
      </div>

      {/* Summary */}
      <div className="timeline-summary">
        <div className="summary-items">
          {users.map(user => {
            const userSlots = slots.filter(s => s.userId === user.id);
            const totalMins = userSlots.reduce((sum, s) => sum + (s.visEnd - s.visStart), 0);
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
              const totalMins = slots.reduce((sum, s) => sum + (s.visEnd - s.visStart), 0);
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
