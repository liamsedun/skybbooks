import { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, UserCheck, Sun, Moon } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { hrApi } from '../../../lib/api';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function LeaveCalendarPage() {
  const { toast } = useToast();
  const [date, setDate] = useState(new Date());
  const [leaves, setLeaves] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  useEffect(() => { loadData(); }, [year, month, selectedEmployee]);

  const loadData = async () => {
    setLoading(true);
    try {
      const dateFrom = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const dateTo = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
      const params: any = { dateFrom, dateTo };
      if (selectedEmployee) params.employeeId = selectedEmployee;
      const [calendarData, empData] = await Promise.all([
        hrApi.getLeaveCalendar(params),
        hrApi.getEmployees()
      ]);
      setLeaves(calendarData?.leaves || []);
      setHolidays(calendarData?.holidays || []);
      setEmployees(Array.isArray(empData) ? empData : []);
    } catch (e: any) {
      toast(e?.message || 'Failed to load calendar', 'error');
    } finally { setLoading(false); }
  };

  const prevMonth = () => setDate(new Date(year, month - 1, 1));
  const nextMonth = () => setDate(new Date(year, month + 1, 1));

  const getLeavesForDay = (day: number): any[] => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return leaves.filter(l => dateStr >= l.startDate && dateStr <= l.endDate);
  };

  const getHolidaysForDay = (day: number): any[] => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return holidays.filter(h => h.date === dateStr);
  };

  const calendarCells = useMemo(() => {
    const cells: { day: number; leaves: any[]; holidays: any[] }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, leaves: getLeavesForDay(d), holidays: getHolidaysForDay(d) });
    }
    return cells;
  }, [leaves, holidays, year, month, daysInMonth]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Leave Calendar</h1>
          <p className="text-sm text-ink-400 mt-0.5">View employee leave and holidays on a calendar</p>
        </div>
        <div className="flex items-center gap-3">
          <select className="h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)}>
            <option value="">All Employees</option>
            {employees.map((e: any) => (
              <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
            ))}
          </select>
          <div className="flex items-center gap-1 bg-surface rounded-lg border border-border-custom">
            <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center text-ink-500 hover:text-ink-900"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-medium text-ink-900 min-w-[140px] text-center">{MONTHS[month]} {year}</span>
            <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center text-ink-500 hover:text-ink-900"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border-custom shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border-custom">
          {DAYS.map(d => (
            <div key={d} className="px-3 py-2 text-xs font-semibold text-ink-500 text-center bg-ink-50/50 dark:bg-ink-800/30">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[120px] border-r border-b border-border-custom bg-ink-50/20 dark:bg-ink-900/20" />
          ))}
          {calendarCells.map(({ day, leaves: dayLeaves, holidays: dayHolidays }) => (
            <div key={day} className="min-h-[120px] border-r border-b border-border-custom p-1.5 hover:bg-ink-50/30 dark:hover:bg-ink-800/20 transition-colors">
              <div className="text-xs font-medium text-ink-600 mb-1">{day}</div>
              {dayHolidays.map((h: any) => (
                <div key={h.id} className="text-[10px] leading-tight px-1 py-0.5 rounded mb-0.5 bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 truncate" title={h.name}>
                  {h.name}
                </div>
              ))}
              {dayLeaves.slice(0, 3).map((l: any) => (
                <div key={l.id} className="text-[10px] leading-tight px-1 py-0.5 rounded mb-0.5 truncate"
                  style={{ backgroundColor: l.leaveTypeColor ? `${l.leaveTypeColor}20` : '#6366f120', color: l.leaveTypeColor || '#6366f1' }}
                  title={`${l.employeeName} - ${l.leaveTypeName}`}>
                  {l.employeeName}
                </div>
              ))}
              {dayLeaves.length > 3 && (
                <div className="text-[10px] text-ink-400 pl-1">+{dayLeaves.length - 3} more</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-6 text-xs text-ink-500">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-purple-200 dark:bg-purple-950/50" /> Holiday</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{ backgroundColor: '#6366f120' }} /> Leave</div>
      </div>
    </div>
  );
}
