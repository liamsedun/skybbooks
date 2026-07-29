import { useState, useEffect } from 'react';
import { Clock, LogIn, LogOut, Coffee, MapPin, Wifi, Smartphone, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { useToast } from '../../../contexts/ToastContext';
import { hrApi } from '../../../lib/api';

export function DailyLogPage() {
  const { toast } = useToast();
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isRemote, setIsRemote] = useState(false);

  const fetchToday = async (eid: string) => {
    if (!eid) return;
    try {
      setRefreshing(true);
      const res = await hrApi.getTodayAttendance({ employeeId: eid });
      setTodayRecord(res?.data ?? null);
    } catch {
      setTodayRecord(null);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('hrClockEmployeeId');
    if (stored) { setEmployeeId(stored); fetchToday(stored); }
  }, []);

  const handleClockIn = async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      const res = await hrApi.clockIn({ employeeId, isRemote });
      toast('Clocked in successfully', 'success');
      setTodayRecord(res?.data ?? { clockIn: new Date().toISOString() });
    } catch (e) {
      toast('Failed to clock in', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      const res = await hrApi.clockOut({ employeeId });
      toast('Clocked out successfully', 'success');
      setTodayRecord(res?.data ?? { ...todayRecord, clockOut: new Date().toISOString() });
    } catch (e) {
      toast('Failed to clock out', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBreakIn = async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      await hrApi.breakIn({ employeeId });
      toast('Break started', 'success');
      fetchToday(employeeId);
    } catch (e) {
      toast('Failed to start break', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBreakOut = async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      await hrApi.breakOut({ employeeId });
      toast('Break ended', 'success');
      fetchToday(employeeId);
    } catch (e) {
      toast('Failed to end break', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isClockedIn = todayRecord?.clockIn && !todayRecord?.clockOut;
  const isOnBreak = todayRecord?.breakStart && !todayRecord?.breakEnd;

  const formatTime = (iso: string) => iso ? new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }) : '--:--';

  return (
    <HrPageShell title="Daily Time Log" description="Clock in/out and track your time in real time" pageKey="daily-log">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6">
            <h3 className="text-sm font-semibold text-ink-900 mb-4">Clock In / Out</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Employee ID</label>
                <div className="flex gap-2">
                  <input className="flex-1 h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" value={employeeId} onChange={e => { setEmployeeId(e.target.value); localStorage.setItem('hrClockEmployeeId', e.target.value); }} placeholder="Enter employee ID" />
                  <button onClick={() => fetchToday(employeeId)} className="px-3 h-9 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /></button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-ink-600">
                  <input type="checkbox" checked={isRemote} onChange={e => setIsRemote(e.target.checked)} className="rounded border-ink-300" />
                  Working remotely
                </label>
              </div>
              <div className="flex flex-wrap gap-3">
                <button onClick={handleClockIn} disabled={loading || isClockedIn} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${isClockedIn ? 'bg-ink-100 text-ink-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'}`}>
                  <LogIn className="w-4 h-4" /> {loading ? 'Processing...' : 'Clock In'}
                </button>
                <button onClick={handleClockOut} disabled={loading || !isClockedIn} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${!isClockedIn ? 'bg-ink-100 text-ink-400 cursor-not-allowed' : 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm'}`}>
                  <LogOut className="w-4 h-4" /> Clock Out
                </button>
                <button onClick={handleBreakIn} disabled={loading || !isClockedIn || isOnBreak} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${!isClockedIn || isOnBreak ? 'bg-ink-100 text-ink-400 cursor-not-allowed' : 'bg-amber-600 text-white hover:bg-amber-700 shadow-sm'}`}>
                  <Coffee className="w-4 h-4" /> Break Start
                </button>
                <button onClick={handleBreakOut} disabled={loading || !isOnBreak} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${!isOnBreak ? 'bg-ink-100 text-ink-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'}`}>
                  <Coffee className="w-4 h-4" /> Break End
                </button>
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6">
            <h3 className="text-sm font-semibold text-ink-900 mb-4">Today's Activity</h3>
            {todayRecord ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-ink-50 dark:bg-ink-800/50 rounded-xl p-4 text-center">
                    <p className="text-xs text-ink-500 mb-1">Clock In</p>
                    <p className="text-lg font-bold text-emerald-600">{formatTime(todayRecord.clockIn)}</p>
                  </div>
                  <div className="bg-ink-50 dark:bg-ink-800/50 rounded-xl p-4 text-center">
                    <p className="text-xs text-ink-500 mb-1">Clock Out</p>
                    <p className="text-lg font-bold text-ink-900">{formatTime(todayRecord.clockOut)}</p>
                  </div>
                  <div className="bg-ink-50 dark:bg-ink-800/50 rounded-xl p-4 text-center">
                    <p className="text-xs text-ink-500 mb-1">Break</p>
                    <p className="text-lg font-bold text-amber-600">{todayRecord.totalBreakMinutes ? `${Math.round(todayRecord.totalBreakMinutes)}m` : '0m'}</p>
                  </div>
                  <div className="bg-ink-50 dark:bg-ink-800/50 rounded-xl p-4 text-center">
                    <p className="text-xs text-ink-500 mb-1">Total Hours</p>
                    <p className="text-lg font-bold text-blue-600">{todayRecord.totalHours || '0h'}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-ink-500">
                  {todayRecord.isRemote && <span className="flex items-center gap-1"><Wifi className="w-3 h-3" /> Remote</span>}
                  {todayRecord.isLate && <span className="flex items-center gap-1 text-amber-600"><Clock className="w-3 h-3" /> Late {todayRecord.lateMinutes}m</span>}
                  {todayRecord.isEarlyDeparture && <span className="flex items-center gap-1 text-purple-600"><Clock className="w-3 h-3" /> Early departure {todayRecord.earlyDepartureMinutes}m</span>}
                  {todayRecord.overtimeMinutes > 0 && <span className="flex items-center gap-1 text-blue-600"><Clock className="w-3 h-3" /> Overtime {todayRecord.overtimeMinutes}m</span>}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-ink-400">
                <Clock className="w-10 h-10 mx-auto mb-2 text-ink-300" />
                <p className="text-sm">No clock-in record for today. Enter your Employee ID and clock in.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6">
            <h3 className="text-sm font-semibold text-ink-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button onClick={() => fetchToday(employeeId)} className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-ink-600 bg-ink-50 dark:bg-ink-800 hover:bg-ink-100 dark:hover:bg-ink-700 transition-colors">
                <RefreshCw className="w-4 h-4" /> Refresh Status
              </button>
            </div>
          </div>
          <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6">
            <h3 className="text-sm font-semibold text-ink-900 mb-3">Status</h3>
            <div className="flex items-center gap-2">
              {isClockedIn ? (
                <><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className="text-sm text-emerald-700 font-medium">Clocked In</span></>
              ) : (
                <><XCircle className="w-4 h-4 text-ink-300" /><span className="text-sm text-ink-500">Not Clocked In</span></>
              )}
            </div>
            {isOnBreak && <div className="flex items-center gap-2 mt-2"><Coffee className="w-4 h-4 text-amber-500" /><span className="text-sm text-amber-700 font-medium">On Break</span></div>}
          </div>
        </div>
      </div>
    </HrPageShell>
  );
}
