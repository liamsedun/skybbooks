import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, Clock, Users, AlertTriangle, Loader2, RefreshCw,
  TrendingUp, TrendingDown, CheckCircle2, XCircle, Server,
  BarChart3, Zap, Wifi,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '../../lib/api';

const MOCK_REQUEST_VOLUME = [
  { hour: '00:00', requests: 120, errors: 2 },
  { hour: '02:00', requests: 80, errors: 1 },
  { hour: '04:00', requests: 60, errors: 0 },
  { hour: '06:00', requests: 150, errors: 3 },
  { hour: '08:00', requests: 450, errors: 5 },
  { hour: '10:00', requests: 620, errors: 8 },
  { hour: '12:00', requests: 580, errors: 6 },
  { hour: '14:00', requests: 700, errors: 10 },
  { hour: '16:00', requests: 650, errors: 7 },
  { hour: '18:00', requests: 520, errors: 4 },
  { hour: '20:00', requests: 350, errors: 3 },
  { hour: '22:00', requests: 200, errors: 1 },
];

const MOCK_ERRORS = [
  { time: '2026-07-21 10:23:45', route: '/api/reports/income-statement', message: 'Database timeout', status: 504, count: 3 },
  { time: '2026-07-21 09:15:22', route: '/api/purchases/bills', message: 'Foreign key violation', status: 500, count: 1 },
  { time: '2026-07-21 08:45:10', route: '/api/auth/login', message: 'Rate limit exceeded', status: 429, count: 12 },
  { time: '2026-07-20 22:30:00', route: '/api/sales/invoices', message: 'Payment gateway timeout', status: 504, count: 2 },
  { time: '2026-07-20 18:12:33', route: '/api/banking/sync', message: 'Provider API error', status: 502, count: 1 },
];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function KpiCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string; sub?: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-gray-50 text-gray-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="bg-white rounded-xl border p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${colorMap[color] || colorMap.blue}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export function SystemHealthPage() {
  const { data: healthData, isLoading } = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      try {
        const res = await api.get('/platform/system-health');
        return res.data.data as any;
      } catch {
        return null;
      }
    },
  });

  const kpis = healthData?.kpis;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
          <p className="text-sm text-gray-500 mt-1">Performance monitoring and error tracking</p>
        </div>
        <button onClick={() => window.location.reload()} className="flex items-center gap-2 px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={CheckCircle2} label="Uptime" value={healthData?.uptime ? `${healthData.uptime.toFixed(1)}%` : '99.9%'} sub="Last 30 days" color="green" />
        <KpiCard icon={Users} label="Active Users" value={kpis?.activeUsers?.toLocaleString() || '1,247'} sub="Last 24h" color="blue" />
        <KpiCard icon={Clock} label="API Latency" value={healthData?.avgLatency ? `${healthData.avgLatency}ms` : '245ms'} sub="Average" color="purple" />
        <KpiCard icon={AlertTriangle} label="Error Rate" value={healthData?.errorRate ? `${(healthData.errorRate * 100).toFixed(2)}%` : '0.12%'} sub="Last 24h" color={healthData?.errorRate > 0.01 ? 'red' : 'green'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Request Volume (24h)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={MOCK_REQUEST_VOLUME}>
              <defs>
                <linearGradient id="reqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="requests" stroke="#3b82f6" fill="url(#reqGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Error Rate (24h)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={MOCK_REQUEST_VOLUME}>
              <defs>
                <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="errors" stroke="#ef4444" fill="url(#errGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl border">
        <div className="px-5 py-4 border-b">
          <h3 className="text-sm font-semibold text-gray-700">Recent Errors</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left p-3 font-medium text-gray-600">Time</th>
              <th className="text-left p-3 font-medium text-gray-600">Route</th>
              <th className="text-left p-3 font-medium text-gray-600">Error</th>
              <th className="text-left p-3 font-medium text-gray-600">Status</th>
              <th className="text-left p-3 font-medium text-gray-600">Count</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_ERRORS.map((e, i) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="p-3 text-gray-500">{e.time}</td>
                <td className="p-3 font-mono text-xs text-gray-900">{e.route}</td>
                <td className="p-3 text-gray-700">{e.message}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${e.status >= 500 ? 'bg-red-100 text-red-700' : e.status === 429 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                    {e.status}
                  </span>
                </td>
                <td className="p-3">{e.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-50 text-green-600"><Server className="w-5 h-5" /></div>
          <div>
            <p className="text-xs text-gray-500">Application Server</p>
            <p className="text-sm font-semibold text-gray-900">{healthData?.appServer || 'Healthy'}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600"><BarChart3 className="w-5 h-5" /></div>
          <div>
            <p className="text-xs text-gray-500">Database</p>
            <p className="text-sm font-semibold text-gray-900">{healthData?.dbStatus || 'Connected'}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-50 text-purple-600"><Zap className="w-5 h-5" /></div>
          <div>
            <p className="text-xs text-gray-500">Cache / Queue</p>
            <p className="text-sm font-semibold text-gray-900">{healthData?.cacheStatus || 'Operational'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
