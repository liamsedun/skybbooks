import { useMemo, useState, useEffect } from 'react';
import { Calendar, Gift, Umbrella, Briefcase, GraduationCap, ChevronLeft, ChevronRight } from 'lucide-react';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { useToast } from '../../../contexts/ToastContext';
import { hrApi } from '../../../lib/api';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'birthday' | 'holiday' | 'meeting' | 'training';
  description: string;
}

const TYPE_STYLES: Record<string, string> = {
  birthday: 'bg-pink-100 dark:bg-pink-950/30 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800',
  holiday: 'bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  meeting: 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  training: 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  birthday: <Gift className="w-3 h-3" />,
  holiday: <Umbrella className="w-3 h-3" />,
  meeting: <Briefcase className="w-3 h-3" />,
  training: <GraduationCap className="w-3 h-3" />,
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export function HomeCalendarPage() {
  const { toast } = useToast();
  const [data, setData] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(7);
  const [currentYear, setCurrentYear] = useState(2026);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await hrApi.getCalendarEvents({});
      setData(Array.isArray(result) ? result : []);
    } catch (e: any) { toast(e?.message || 'Failed to load', 'error'); }
    finally { setLoading(false); }
  };

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const stats = useMemo(() => [
    { label: 'Total Events', value: data.length, icon: <Calendar className="w-4 h-4" />, color: 'blue' as const, active: false, onClick: () => {} },
    { label: 'Birthdays', value: data.filter(e => e.type === 'birthday').length, icon: <Gift className="w-4 h-4" />, color: 'pink' as const, active: false, onClick: () => {} },
    { label: 'Holidays', value: data.filter(e => e.type === 'holiday').length, icon: <Umbrella className="w-4 h-4" />, color: 'purple' as const, active: false, onClick: () => {} },
    { label: 'Meetings', value: data.filter(e => e.type === 'meeting').length, icon: <Briefcase className="w-4 h-4" />, color: 'blue' as const, active: false, onClick: () => {} },
  ], [data]);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  const calendarDays = useMemo(() => {
    const days: { date: number; events: CalendarEvent[] }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ date: d, events: data.filter(e => e.date === dateStr) });
    }
    return days;
  }, [currentMonth, currentYear, data]);

  return (
    <HrPageShell title="HR Calendar" description="View and manage HR events"
      pageKey="home">
      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map((s, i) => (
          <div key={i} className="bg-surface border border-border-custom rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${s.color}-50 dark:bg-${s.color}-950/30 text-${s.color}-600`}>{s.icon}</div>
            <div><p className="text-xs text-ink-500">{s.label}</p><p className="text-xl font-bold text-ink-900">{s.value}</p></div>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border-custom rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-custom">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-500 hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <h2 className="text-base font-semibold text-ink-900">{MONTHS[currentMonth]} {currentYear}</h2>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-500 hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-7">
          {DAYS.map(d => <div key={d} className="px-3 py-2 text-xs font-semibold text-ink-500 bg-ink-50/50 dark:bg-ink-900/50 border-b border-r border-border-custom">{d}</div>)}
          {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-border-custom bg-ink-50/30 dark:bg-ink-900/30" />)}
          {calendarDays.map(day => (
            <div key={day.date} className="min-h-[100px] p-2 border-b border-r border-border-custom hover:bg-ink-50/50 dark:hover:bg-ink-900/50 transition-colors">
              <span className="text-xs font-medium text-ink-700 mb-1 block">{day.date}</span>
              <div className="space-y-1">
                {day.events.map(evt => (
                  <button key={evt.id} onClick={() => toast(evt.title, 'success')}
                    className={`w-full text-left px-2 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-opacity hover:opacity-80 ${TYPE_STYLES[evt.type]}`}>
                    {TYPE_ICONS[evt.type]}
                    <span className="truncate">{evt.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </HrPageShell>
  );
}


