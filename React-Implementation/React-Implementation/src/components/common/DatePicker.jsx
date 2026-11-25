import { useState, useEffect, useRef } from 'react';
import './DatePicker.css';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function parseDateInput(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  
  if (typeof val === 'string') {
    const ddmmyyyyMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyyMatch) {
      const day = parseInt(ddmmyyyyMatch[1], 10);
      const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
      const year = parseInt(ddmmyyyyMatch[3], 10);
      const d = new Date(year, month, day);
      if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
        return d;
      }
    }
    const isoDate = new Date(val);
    if (!isNaN(isoDate.getTime())) return isoDate;
  }
  return null;
}

function formatDateToDDMMYYYY(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function normalizeToMidnight(date) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export default function DatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  placeholder = 'DD/MM/YYYY',
  label,
  error,
  required = false,
  disabled = false,
  id,
  name,
}) {
  const inputId = id || name;
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const parsedValue = parseDateInput(value);
  const [typedText, setTypedText] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const initialViewDate = parsedValue || parseDateInput(minDate) || new Date();
  const [viewYear, setViewYear] = useState(initialViewDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialViewDate.getMonth());

  const displayedText = typedText !== null ? typedText : formatDateToDDMMYYYY(parsedValue);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setTypedText(null);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setTypedText(null);
    }
  };

  const minMid = normalizeToMidnight(parseDateInput(minDate));
  const maxMid = normalizeToMidnight(parseDateInput(maxDate));
  const selectedMid = normalizeToMidnight(parsedValue);
  const todayMid = normalizeToMidnight(new Date());

  const isDateDisabled = (date) => {
    const targetMid = normalizeToMidnight(date);
    if (!targetMid) return false;
    if (minMid && targetMid < minMid) return true;
    if (maxMid && targetMid > maxMid) return true;
    return false;
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleSelectDate = (date) => {
    if (isDateDisabled(date)) return;
    const isoString = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0)).toISOString();
    setTypedText(null);
    setIsOpen(false);
    if (onChange) onChange(isoString);
  };

  const handleClear = () => {
    setTypedText(null);
    setIsOpen(false);
    if (onChange) onChange(null);
  };

  const handleToday = () => {
    const now = new Date();
    if (!isDateDisabled(now)) {
      handleSelectDate(now);
    } else {
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setTypedText(val);

    const parsed = parseDateInput(val);
    if (parsed) {
      if (!isDateDisabled(parsed)) {
        const isoString = new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0)).toISOString();
        if (onChange) onChange(isoString);
        setViewYear(parsed.getFullYear());
        setViewMonth(parsed.getMonth());
      }
    } else if (val === '') {
      if (onChange) onChange(null);
    }
  };

  const handleBlur = () => {
    setTypedText(null);
  };

  // Generate calendar days
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const calendarDays = [];

  // Previous month trailing days
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const dateObj = new Date(viewYear, viewMonth - 1, dayNum);
    calendarDays.push({
      date: dateObj,
      dayNumber: dayNum,
      isCurrentMonth: false,
      disabled: isDateDisabled(dateObj),
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(viewYear, viewMonth, d);
    const dateMid = normalizeToMidnight(dateObj);
    const isSelected = selectedMid && dateMid && selectedMid.getTime() === dateMid.getTime();
    const isToday = todayMid && dateMid && todayMid.getTime() === dateMid.getTime();

    calendarDays.push({
      date: dateObj,
      dayNumber: d,
      isCurrentMonth: true,
      isSelected,
      isToday,
      disabled: isDateDisabled(dateObj),
    });
  }

  // Next month leading days to complete grid
  const remainingCells = (7 - (calendarDays.length % 7)) % 7;
  for (let d = 1; d <= remainingCells; d++) {
    const dateObj = new Date(viewYear, viewMonth + 1, d);
    calendarDays.push({
      date: dateObj,
      dayNumber: d,
      isCurrentMonth: false,
      disabled: isDateDisabled(dateObj),
    });
  }

  return (
    <div className="date-picker-container" ref={containerRef} onKeyDown={handleKeyDown}>
      {label && (
        <label className="date-picker-label" htmlFor={inputId}>
          {label}
          {required && <span className="date-picker-required">*</span>}
        </label>
      )}

      <div className="date-picker-input-wrap">
        <input
          ref={inputRef}
          type="text"
          id={inputId}
          name={name}
          className={`date-picker-input ${error ? 'has-error' : ''}`}
          placeholder={placeholder}
          value={displayedText}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onClick={() => !disabled && setIsOpen(true)}
          disabled={disabled}
          autoComplete="off"
        />

        <button
          type="button"
          className="date-picker-toggle-btn"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          aria-label="Toggle calendar"
          tabIndex={-1}
          disabled={disabled}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="date-picker-popover" role="dialog" aria-modal="true" aria-label="Choose Date">
          <div className="date-picker-header">
            <button
              type="button"
              className="date-picker-nav-btn"
              onClick={handlePrevMonth}
              aria-label="Previous month"
            >
              &#8249;
            </button>
            <span className="date-picker-title">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              className="date-picker-nav-btn"
              onClick={handleNextMonth}
              aria-label="Next month"
            >
              &#8250;
            </button>
          </div>

          <div className="date-picker-weekdays">
            {WEEKDAYS.map((w) => (
              <span key={w} className="date-picker-weekday">{w}</span>
            ))}
          </div>

          <div className="date-picker-grid">
            {calendarDays.map((cell, idx) => {
              const classNames = ['date-picker-day'];
              if (!cell.isCurrentMonth) classNames.push('other-month');
              if (cell.isToday) classNames.push('today');
              if (cell.isSelected) classNames.push('selected');
              if (cell.disabled) classNames.push('disabled');

              return (
                <button
                  key={idx}
                  type="button"
                  className={classNames.join(' ')}
                  disabled={cell.disabled}
                  onClick={() => handleSelectDate(cell.date)}
                >
                  {cell.dayNumber}
                </button>
              );
            })}
          </div>

          <div className="date-picker-footer">
            <button
              type="button"
              className="date-picker-footer-btn"
              onClick={handleToday}
            >
              Today
            </button>
            <button
              type="button"
              className="date-picker-footer-btn clear-btn"
              onClick={handleClear}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {error && <span className="date-picker-error">{error}</span>}
    </div>
  );
}
