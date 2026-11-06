import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  RotateCcw, 
  X, 
  Check, 
  MousePointer,
  Sparkles
} from "lucide-react";

interface ConsumptionDateRangeCalendarProps {
  startDate: string; // YYYY-MM-DD or ""
  endDate: string;   // YYYY-MM-DD or ""
  onSelectRange: (start: string, end: string) => void;
  onClear: () => void;
  datesWithRecords?: Map<string, number>; // dateStr -> record count
  onClose?: () => void;
  isInline?: boolean;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function formatISO(year: number, month: number, day: number): string {
  const y = String(year);
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getTodayISO(): string {
  const now = new Date();
  return formatISO(now.getFullYear(), now.getMonth(), now.getDate());
}

export const ConsumptionDateRangeCalendar: React.FC<ConsumptionDateRangeCalendarProps> = ({
  startDate,
  endDate,
  onSelectRange,
  onClear,
  datesWithRecords = new Map(),
  onClose,
  isInline = false,
}) => {
  // Calendar viewport: base month and year
  const today = new Date();
  const initialYear = startDate ? parseInt(startDate.slice(0, 4), 10) : today.getFullYear();
  const initialMonth = startDate ? parseInt(startDate.slice(5, 7), 10) - 1 : today.getMonth();

  const [viewYear, setViewYear] = useState(initialYear);
  const [viewMonth, setViewMonth] = useState(initialMonth);

  // Drag-to-select range state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // When dragging, active highlighted range is between dragStart and hoverDate
  // When not dragging, it is between startDate and endDate
  const effectiveRange = useMemo(() => {
    if (isDragging && dragStart && hoverDate) {
      const s = dragStart < hoverDate ? dragStart : hoverDate;
      const e = dragStart < hoverDate ? hoverDate : dragStart;
      return { start: s, end: e };
    }
    return {
      start: startDate || "",
      end: endDate || "",
    };
  }, [isDragging, dragStart, hoverDate, startDate, endDate]);

  // Window mouseup listener to guarantee drag ends even if mouse released outside calendar
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging && dragStart && hoverDate) {
        const s = dragStart < hoverDate ? dragStart : hoverDate;
        const e = dragStart < hoverDate ? hoverDate : dragStart;
        onSelectRange(s, e);
      }
      setIsDragging(false);
      setDragStart(null);
      setHoverDate(null);
    };

    if (isDragging) {
      window.addEventListener("mouseup", handleGlobalMouseUp);
    }
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isDragging, dragStart, hoverDate, onSelectRange]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    const todayStr = getTodayISO();
    onSelectRange(todayStr, todayStr);
  };

  // Drag start
  const handleDayMouseDown = (dateStr: string, e: React.MouseEvent) => {
    // Only respond to main left click
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart(dateStr);
    setHoverDate(dateStr);
  };

  // Drag hover
  const handleDayMouseEnter = (dateStr: string) => {
    if (isDragging) {
      setHoverDate(dateStr);
    }
  };

  // Day click fallback (if user clicked instead of dragged)
  const handleDayClick = (dateStr: string) => {
    if (isDragging) return;
    // If no start date or both already selected, start fresh with this day
    if (!startDate || (startDate && endDate)) {
      onSelectRange(dateStr, dateStr);
    } else if (startDate && !endDate) {
      const s = startDate < dateStr ? startDate : dateStr;
      const e = startDate < dateStr ? dateStr : startDate;
      onSelectRange(s, e);
    }
  };

  // Touch event support for dragging on tablets/mobile
  const handleTouchStart = (dateStr: string) => {
    setIsDragging(true);
    setDragStart(dateStr);
    setHoverDate(dateStr);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const elem = document.elementFromPoint(touch.clientX, touch.clientY);
    const dateAttr = elem?.closest("[data-date]")?.getAttribute("data-date");
    if (dateAttr) {
      setHoverDate(dateAttr);
    }
  };

  const handleTouchEnd = () => {
    if (isDragging && dragStart && hoverDate) {
      const s = dragStart < hoverDate ? dragStart : hoverDate;
      const e = dragStart < hoverDate ? hoverDate : dragStart;
      onSelectRange(s, e);
    }
    setIsDragging(false);
    setDragStart(null);
    setHoverDate(null);
  };

  // Render a month grid
  const renderMonth = (year: number, month: number) => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const todayStr = getTodayISO();

    const calendarCells: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    // Preceding month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const dateStr = formatISO(prevYear, prevMonth, dayNum);
      calendarCells.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dateStr = formatISO(year, month, dayNum);
      calendarCells.push({
        dateStr,
        dayNum,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Trailing month filler days to complete grid (up to multiple of 7)
    const remaining = (7 - (calendarCells.length % 7)) % 7;
    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const dateStr = formatISO(nextYear, nextMonth, dayNum);
      calendarCells.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    return (
      <div className="select-none flex-1 min-w-[260px]">
        {/* Month Header */}
        <div className="flex items-center justify-between px-2 py-1.5 font-bold text-neutral-800 text-xs border-b border-neutral-100">
          <span>{MONTH_NAMES[month]} {year}</span>
        </div>

        {/* Weekday labels */}
        <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold text-neutral-400 py-1.5 border-b border-neutral-100">
          {WEEKDAYS.map((wd, i) => (
            <div key={i} className={i === 0 || i === 6 ? "text-neutral-400" : "text-neutral-500"}>
              {wd}
            </div>
          ))}
        </div>

        {/* Day Grid */}
        <div 
          className="grid grid-cols-7 gap-y-1 gap-x-0 pt-1.5"
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {calendarCells.map((cell) => {
            const { dateStr, dayNum, isCurrentMonth, isToday } = cell;
            const recordsCount = datesWithRecords.get(dateStr) || 0;

            const isStart = effectiveRange.start === dateStr;
            const isEnd = effectiveRange.end === dateStr;
            const isSingle = isStart && isEnd;
            const isInRange = 
              effectiveRange.start && 
              effectiveRange.end && 
              dateStr >= effectiveRange.start && 
              dateStr <= effectiveRange.end;

            let cellBg = "";
            let textStyle = isCurrentMonth ? "text-neutral-800" : "text-neutral-300";

            if (isSingle) {
              cellBg = "bg-emerald-600 text-white font-bold rounded-lg shadow-xs";
              textStyle = "text-white";
            } else if (isStart) {
              cellBg = "bg-emerald-600 text-white font-bold rounded-l-lg rounded-r-none shadow-xs";
              textStyle = "text-white";
            } else if (isEnd) {
              cellBg = "bg-emerald-600 text-white font-bold rounded-r-lg rounded-l-none shadow-xs";
              textStyle = "text-white";
            } else if (isInRange) {
              cellBg = "bg-emerald-100 text-emerald-950 font-semibold rounded-none";
              textStyle = "text-emerald-950 font-bold";
            } else if (isToday) {
              cellBg = "ring-1 ring-emerald-500 ring-inset rounded-lg";
            }

            return (
              <div
                key={dateStr}
                data-date={dateStr}
                onMouseDown={(e) => handleDayMouseDown(dateStr, e)}
                onMouseEnter={() => handleDayMouseEnter(dateStr)}
                onClick={() => handleDayClick(dateStr)}
                onTouchStart={() => handleTouchStart(dateStr)}
                className={`h-8 flex flex-col items-center justify-center relative cursor-pointer transition-colors text-xs font-mono select-none ${cellBg} ${
                  !isInRange && isCurrentMonth ? "hover:bg-neutral-100 rounded-lg" : ""
                }`}
                title={`${dateStr}${recordsCount > 0 ? ` (${recordsCount} logs)` : ""}`}
              >
                <span className={`text-[11px] leading-none ${textStyle}`}>
                  {dayNum}
                </span>

                {/* Activity indicator dot */}
                {recordsCount > 0 && (
                  <span 
                    className={`absolute bottom-0.5 h-1 w-1 rounded-full ${
                      isStart || isEnd ? "bg-white" : "bg-emerald-600"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Next Month calculation for side-by-side view
  const nextMonthYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  const nextMonthVal = viewMonth === 11 ? 0 : viewMonth + 1;

  // Preset quick ranges
  const applyPreset = (preset: "TODAY" | "YESTERDAY" | "7DAYS" | "30DAYS" | "THIS_MONTH" | "LAST_MONTH" | "ALL") => {
    const now = new Date();
    if (preset === "ALL") {
      onClear();
      return;
    }
    if (preset === "TODAY") {
      const todayStr = getTodayISO();
      onSelectRange(todayStr, todayStr);
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
      return;
    }
    if (preset === "YESTERDAY") {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = formatISO(y.getFullYear(), y.getMonth(), y.getDate());
      onSelectRange(yStr, yStr);
      setViewYear(y.getFullYear());
      setViewMonth(y.getMonth());
      return;
    }
    if (preset === "7DAYS") {
      const endStr = getTodayISO();
      const s = new Date();
      s.setDate(s.getDate() - 6);
      const startStr = formatISO(s.getFullYear(), s.getMonth(), s.getDate());
      onSelectRange(startStr, endStr);
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
      return;
    }
    if (preset === "30DAYS") {
      const endStr = getTodayISO();
      const s = new Date();
      s.setDate(s.getDate() - 29);
      const startStr = formatISO(s.getFullYear(), s.getMonth(), s.getDate());
      onSelectRange(startStr, endStr);
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
      return;
    }
    if (preset === "THIS_MONTH") {
      const startStr = formatISO(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const endStr = formatISO(now.getFullYear(), now.getMonth(), lastDay);
      onSelectRange(startStr, endStr);
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
      return;
    }
    if (preset === "LAST_MONTH") {
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const py = prevMonthDate.getFullYear();
      const pm = prevMonthDate.getMonth();
      const lastDay = new Date(py, pm + 1, 0).getDate();
      const startStr = formatISO(py, pm, 1);
      const endStr = formatISO(py, pm, lastDay);
      onSelectRange(startStr, endStr);
      setViewYear(py);
      setViewMonth(pm);
      return;
    }
  };

  // Calculate day count
  const dayCount = useMemo(() => {
    if (!effectiveRange.start || !effectiveRange.end) return 0;
    const s = new Date(effectiveRange.start).getTime();
    const e = new Date(effectiveRange.end).getTime();
    const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diff);
  }, [effectiveRange.start, effectiveRange.end]);

  return (
    <div 
      ref={containerRef}
      className={`bg-white border border-neutral-200 rounded-xl shadow-lg p-3 sm:p-4 text-neutral-900 font-sans ${
        isInline ? "w-full" : "w-full max-w-2xl"
      }`}
    >
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
              <span>Date Period Search</span>
              {isDragging ? (
                <span className="bg-amber-100 text-amber-800 text-[10px] font-mono px-1.5 py-0.2 rounded animate-pulse font-bold flex items-center gap-1">
                  <MousePointer className="w-2.5 h-2.5" /> Dragging...
                </span>
              ) : (
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                  Drag dates to select
                </span>
              )}
            </div>
            <p className="text-[10px] text-neutral-400">
              Click & drag across any dates on the calendar to search that specific period.
            </p>
          </div>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center gap-1 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleJumpToToday}
            className="text-[10px] font-bold text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 px-2 py-1 rounded transition-colors"
          >
            Today
          </button>
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-bold text-neutral-700 px-1 min-w-[70px] text-center">
            {MONTH_NAMES[viewMonth].slice(0, 3)} {viewYear}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-neutral-400 hover:text-neutral-700 rounded ml-1"
              title="Close Calendar"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Preset Quick Chips */}
      <div className="flex flex-wrap items-center gap-1.5 py-2.5 border-b border-neutral-100">
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mr-1">Quick:</span>
        <button
          type="button"
          onClick={() => applyPreset("TODAY")}
          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
            startDate === getTodayISO() && endDate === getTodayISO()
              ? "bg-emerald-600 text-white"
              : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
          }`}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => applyPreset("YESTERDAY")}
          className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors"
        >
          Yesterday
        </button>
        <button
          type="button"
          onClick={() => applyPreset("7DAYS")}
          className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors"
        >
          Last 7 Days
        </button>
        <button
          type="button"
          onClick={() => applyPreset("30DAYS")}
          className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors"
        >
          Last 30 Days
        </button>
        <button
          type="button"
          onClick={() => applyPreset("THIS_MONTH")}
          className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors"
        >
          This Month
        </button>
        <button
          type="button"
          onClick={() => applyPreset("ALL")}
          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ml-auto ${
            !startDate && !endDate
              ? "bg-neutral-800 text-white"
              : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
          }`}
        >
          All Time (Clear)
        </button>
      </div>

      {/* Calendar Grids (Side-by-side on sm/md, stacked on mobile) */}
      <div className="flex flex-col md:flex-row gap-4 py-3">
        {renderMonth(viewYear, viewMonth)}
        <div className="hidden md:block w-px bg-neutral-100" />
        <div className="hidden md:block flex-1">
          {renderMonth(nextMonthYear, nextMonthVal)}
        </div>
      </div>

      {/* Footer Status & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2.5 border-t border-neutral-100 text-xs">
        <div className="flex items-center gap-2">
          {effectiveRange.start && effectiveRange.end ? (
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-neutral-700">
              <span className="font-bold text-neutral-900 bg-neutral-100 px-1.5 py-0.5 rounded">
                {effectiveRange.start}
              </span>
              <span className="text-neutral-400">→</span>
              <span className="font-bold text-neutral-900 bg-neutral-100 px-1.5 py-0.5 rounded">
                {effectiveRange.end}
              </span>
              <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px]">
                {dayCount} {dayCount === 1 ? "day" : "days"}
              </span>
            </div>
          ) : (
            <div className="text-[11px] text-neutral-500 italic font-mono">
              All dates included (No date range filter)
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={onClear}
              className="flex items-center gap-1 text-[11px] font-bold text-neutral-500 hover:text-red-600 px-2 py-1 rounded transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-3 py-1 rounded-lg transition-colors shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply & Close</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
