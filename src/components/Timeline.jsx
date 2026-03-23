import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

const TOTAL_MINUTES = 1440;
const DAYS_BEFORE = 30;
const DAYS_AFTER = 30;
const TOTAL_DAYS = DAYS_BEFORE + 1 + DAYS_AFTER;
const DAY_WIDTH_PX = 1200; // pixels per day

function fmtMin(m) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function dateToStr(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return dateToStr(d);
}

function formatDayHeader(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function daysBetween(a, b) {
  const da = new Date(a + 'T00:00:00').getTime();
  const db = new Date(b + 'T00:00:00').getTime();
  return Math.round((db - da) / 86400000);
}

function Timeline({ slots, users, hourlyRate, onSelectRange, onDeleteSlot }) {
  const scrollRef = useRef(null);
  const rowsRef = useRef(null);
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [visibleDate, setVisibleDate] = useState(null);

  // Drag state
  const [dragging, setDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState(null); // { globalMin }
  const [dragEndPos, setDragEndPos] = useState(null);
  const dragStartRef = useRef(null);
  const dragUserRef = useRef(null);

  // Generate day list
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const days = useMemo(() => {
    const result = [];
    for (let i = -DAYS_BEFORE; i <= DAYS_AFTER; i++) {
      result.push(addDays(todayStr, i));
    }
    return result;
  }, [todayStr]);

  const totalWidth = TOTAL_DAYS * DAY_WIDTH_PX;

  // Scroll to today on mount
  useEffect(() => {
    if (scrollRef.current) {
      const todayOffset = DAYS_BEFORE * DAY_WIDTH_PX;
      const now = new Date();
      const currentMinOffset = (now.getHours() * 60 + now.getMinutes()) / TOTAL_MINUTES * DAY_WIDTH_PX;
      scrollRef.current.scrollLeft = todayOffset + currentMinOffset - scrollRef.current.clientWidth / 2;
    }
  }, []);

  // Track visible date from scroll position
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const center = el.scrollLeft + el.clientWidth / 2;
      const dayIndex = Math.floor(center / DAY_WIDTH_PX);
      const clamped = Math.max(0, Math.min(dayIndex, days.length - 1));
      setVisibleDate(days[clamped]);
    };
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [days]);

  // Current time tick
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(iv);
  }, []);

  // Convert scroll X to globalMin (minutes since first day in array)
  const xToGlobalMin = useCallback((clientX) => {
    if (!rowsRef.current) return 0;
    const rect = rowsRef.current.getBoundingClientRect();
    // rect.left already accounts for scroll, no need to add scrollLeft
    const x = clientX - rect.left;
    const globalMin = (x / totalWidth) * (TOTAL_DAYS * TOTAL_MINUTES);
    return Math.max(0, Math.min(globalMin, TOTAL_DAYS * TOTAL_MINUTES));
  }, [totalWidth]);

  // Convert globalMin to { date, min }
  const globalMinToDateMin = useCallback((gm) => {
    const dayIdx = Math.floor(gm / TOTAL_MINUTES);
    const clamped = Math.max(0, Math.min(dayIdx, days.length - 1));
    const min = Math.round(gm - clamped * TOTAL_MINUTES);
    return { date: days[clamped], min: Math.max(0, Math.min(min, TOTAL_MINUTES)) };
  }, [days]);

  // Drag handlers
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.slot-block')) return;
    // Detect which user row was clicked
    const row = e.target.closest('.timeline-row');
    const userId = row ? row.dataset.userId : null;
    dragUserRef.current = userId;
    const gm = xToGlobalMin(e.clientX);
    setDragging(true);
    setDragStartPos(gm);
    setDragEndPos(gm);
    dragStartRef.current = gm;
    e.preventDefault();
  }, [xToGlobalMin]);

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return;
    setDragEndPos(xToGlobalMin(e.clientX));
  }, [dragging, xToGlobalMin]);

  const handleMouseUp = useCallback((e) => {
    if (!dragging) return;
    setDragging(false);
    const endGm = xToGlobalMin(e.clientX);
    const startGm = dragStartRef.current;
    const s = Math.min(startGm, endGm);
    const en = Math.max(startGm, endGm);
    if (en - s >= 5) {
      const startDM = globalMinToDateMin(s);
      const endDM = globalMinToDateMin(en);
      onSelectRange(startDM.date, startDM.min, endDM.date, endDM.min, dragUserRef.current);
    }
    setDragStartPos(null);
    setDragEndPos(null);
  }, [dragging, xToGlobalMin, globalMinToDateMin, onSelectRange]);

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

  // Selection range in px
  const selStartPx = dragStartPos !== null && dragEndPos !== null
    ? (Math.min(dragStartPos, dragEndPos) / (TOTAL_DAYS * TOTAL_MINUTES)) * totalWidth
    : null;
  const selWidthPx = dragStartPos !== null && dragEndPos !== null
    ? (Math.abs(dragEndPos - dragStartPos) / (TOTAL_DAYS * TOTAL_MINUTES)) * totalWidth
    : null;

  // Get slot visual position on timeline
  const getSlotPosition = useCallback((slot) => {
    const sd = slot.startDate || slot.date;
    const ed = slot.endDate || slot.date;
    const startDayIdx = days.indexOf(sd);
    const endDayIdx = days.indexOf(ed);
    if (startDayIdx === -1 && endDayIdx === -1) {
      // Slot is outside visible range
      const sdOffset = daysBetween(days[0], sd);
      const edOffset = daysBetween(days[0], ed);
      if (sdOffset < 0 && edOffset < 0) return null;
      if (sdOffset >= TOTAL_DAYS && edOffset >= TOTAL_DAYS) return null;
      const clampedStartIdx = Math.max(0, sdOffset);
      const clampedEndIdx = Math.min(TOTAL_DAYS - 1, edOffset);
      const startPx = clampedStartIdx * DAY_WIDTH_PX + (sdOffset === clampedStartIdx ? (slot.startMin / TOTAL_MINUTES) * DAY_WIDTH_PX : 0);
      const endPx = clampedEndIdx * DAY_WIDTH_PX + (edOffset === clampedEndIdx ? (slot.endMin / TOTAL_MINUTES) * DAY_WIDTH_PX : DAY_WIDTH_PX);
      return { left: startPx, width: endPx - startPx };
    }
    const sIdx = startDayIdx >= 0 ? startDayIdx : 0;
    const eIdx = endDayIdx >= 0 ? endDayIdx : days.length - 1;
    const startPx = sIdx * DAY_WIDTH_PX + (startDayIdx >= 0 ? (slot.startMin / TOTAL_MINUTES) * DAY_WIDTH_PX : 0);
    const endPx = eIdx * DAY_WIDTH_PX + (endDayIdx >= 0 ? (slot.endMin / TOTAL_MINUTES) * DAY_WIDTH_PX : DAY_WIDTH_PX);
    return { left: startPx, width: Math.max(endPx - startPx, 2) };
  }, [days]);

  // Current time position
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todayIdx = days.indexOf(todayStr);
  const nowPx = todayIdx >= 0 ? todayIdx * DAY_WIDTH_PX + (nowMin / TOTAL_MINUTES) * DAY_WIDTH_PX : -1;

  // Scroll to today button
  const scrollToNow = () => {
    if (scrollRef.current && nowPx >= 0) {
      scrollRef.current.scrollTo({
        left: nowPx - scrollRef.current.clientWidth / 2,
        behavior: 'smooth',
      });
    }
  };

  const isViewingToday = visibleDate === todayStr;

  return (
    <div className="timeline">
      {/* Floating date indicator */}
      <div className="floating-date-bar">
        <div className="floating-date-info">
          <span className="floating-date-text">
            {visibleDate ? formatDayHeader(visibleDate) : ''}
          </span>
          {visibleDate === todayStr && <span className="today-badge">Сейчас</span>}
        </div>
        {!isViewingToday && (
          <button className="btn-today-float" onClick={scrollToNow}>
            Сегодня →
          </button>
        )}
      </div>

      <div className="timeline-container">
        {/* Left labels */}
        <div className="timeline-labels">
          <div className="timeline-label-header">
            <span>Дни →</span>
          </div>
          {users.map(u => (
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

        {/* Scrollable grid */}
        <div className="timeline-scroll" ref={scrollRef}>
          <div className="timeline-grid" style={{ width: `${totalWidth}px` }}>
            {/* Day headers + hour markers */}
            <div className="timeline-hours-bar">
              {days.map((day, dayIdx) => {
                const isToday = day === todayStr;
                const isPast = day < todayStr;
                return (
                  <div
                    key={day}
                    className={`day-column-header ${isToday ? 'today' : ''} ${isPast ? 'past' : ''}`}
                    style={{ left: `${dayIdx * DAY_WIDTH_PX}px`, width: `${DAY_WIDTH_PX}px` }}
                  >
                    <div className="day-label">{formatDayHeader(day)}</div>
                    <div className="hour-markers">
                      {Array.from({ length: 24 }, (_, h) => (
                        <div
                          key={h}
                          className="hour-tick"
                          style={{ left: `${(h / 24) * 100}%` }}
                        >
                          <span className="hour-tick-text">{String(h).padStart(2, '0')}:00</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {/* Current time marker in header */}
              {nowPx >= 0 && (
                <div className="now-header-marker" style={{ left: `${nowPx}px` }}>
                  <div className="now-tag">{fmtMin(nowMin)}</div>
                </div>
              )}
            </div>

            {/* Rows */}
            <div className="timeline-rows" ref={rowsRef} onMouseDown={handleMouseDown}>
              {users.map(user => {
                const userSlots = slots.filter(s => s.userId === user.id);
                return (
                  <div key={user.id} className="timeline-row" data-user-id={user.id}>
                    {/* Day separators */}
                    {days.map((day, dayIdx) => (
                      <div
                        key={day}
                        className={`day-separator ${day === todayStr ? 'today' : ''} ${day < todayStr ? 'past' : ''}`}
                        style={{ left: `${dayIdx * DAY_WIDTH_PX}px`, width: `${DAY_WIDTH_PX}px` }}
                      >
                        {/* Hour grid lines inside day */}
                        {Array.from({ length: 24 }, (_, h) => (
                          <div
                            key={h}
                            className="hour-gridline"
                            style={{ left: `${(h / 24) * 100}%` }}
                          />
                        ))}
                      </div>
                    ))}

                    {/* Slot blocks */}
                    {userSlots.map(slot => {
                      const pos = getSlotPosition(slot);
                      if (!pos) return null;
                      const isRenter = user.isRenter;
                      const sd = slot.startDate || slot.date;
                      const ed = slot.endDate || slot.date;
                      const isCrossDay = sd !== ed;
                      const totalSlotMins = daysBetween(sd, ed) * 1440 + slot.endMin - slot.startMin;
                      const slotHours = totalSlotMins / 60;

                      return (
                        <div
                          key={slot.id}
                          className={`slot-block ${isRenter ? 'renter' : ''} ${isCrossDay ? 'cross-day' : ''}`}
                          style={{
                            left: `${pos.left}px`,
                            width: `${pos.width}px`,
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
                                ? `${sd} ${fmtMin(slot.startMin)} → ${ed} ${fmtMin(slot.endMin)}`
                                : `${fmtMin(slot.startMin)} — ${fmtMin(slot.endMin)}`,
                              hours: slotHours.toFixed(1),
                              cost: isRenter ? null : (slotHours * hourlyRate).toFixed(2),
                              isRenter,
                              rentRate: isRenter && slot.rentRate != null ? slot.rentRate : null,
                              isCrossDay,
                            });
                          }}
                          onMouseLeave={() => { setHoveredSlot(null); setTooltip(null); }}
                        >
                          <span className="slot-block-label">
                            {fmtMin(slot.startMin)}–{fmtMin(slot.endMin)}
                            {isCrossDay && ` (${daysBetween(sd, ed) + 1}д)`}
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

                    {/* Drag selection */}
                    {dragging && selStartPx !== null && selWidthPx > 3 && (
                      <div
                        className="drag-selection"
                        style={{ left: `${selStartPx}px`, width: `${selWidthPx}px` }}
                      >
                        <span className="drag-label">
                          {(() => {
                            const s = Math.min(dragStartPos, dragEndPos);
                            const e = Math.max(dragStartPos, dragEndPos);
                            const sDM = globalMinToDateMin(s);
                            const eDM = globalMinToDateMin(e);
                            if (sDM.date === eDM.date) {
                              return `${fmtMin(sDM.min)} — ${fmtMin(eDM.min)}`;
                            }
                            return `${formatDayHeader(sDM.date)} ${fmtMin(sDM.min)} → ${formatDayHeader(eDM.date)} ${fmtMin(eDM.min)}`;
                          })()}
                        </span>
                      </div>
                    )}

                    {/* Current time line */}
                    {nowPx >= 0 && (
                      <div className="now-line" style={{ left: `${nowPx}px` }} />
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
    </div>
  );
}

export default Timeline;
