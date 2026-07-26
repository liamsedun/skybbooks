import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User, Shield, Calendar, Mail, LogOut, RefreshCw, Save,
  Camera, Lock, Eye, EyeOff, CheckCircle2, XCircle, Loader2,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function PlatformProfilePage() {
  const { user: authUser, logout } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [nameEdit, setNameEdit] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [prefs, setPrefs] = useState<Record<string, any>>({});

  const { data: profile, isLoading } = useQuery({
    queryKey: ['platform-profile'],
    queryFn: async () => {
      const res = await api.get('/platform/profile');
      return res.data.data as any;
    },
  });

  const updateMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.put('/platform/profile', data);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-profile'] });
      setShowNameInput(false);
      toast.toast('Profile updated', 'success');
    },
    onError: (err: any) => toast.toast(err.response?.data?.error || 'Failed to update profile', 'error'),
  });

  const passwordMut = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      await api.put('/platform/profile/password', data);
    },
    onSuccess: () => {
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.toast('Password changed successfully', 'success');
    },
    onError: (err: any) => toast.toast(err.response?.data?.error || 'Failed to change password', 'error'),
  });

  const prefsMut = useMutation({
    mutationFn: async (preferences: Record<string, any>) => {
      const res = await api.put('/platform/profile/preferences', { preferences });
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-profile'] });
      toast.toast('Preferences saved', 'success');
    },
    onError: (err: any) => toast.toast(err.response?.data?.error || 'Failed to save preferences', 'error'),
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.toast('Image must be under 2MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      updateMut.mutate({ avatarUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  if (isLoading) {
    return <div className="p-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-ink-400" /></div>;
  }

  const u = profile || authUser;
  const userPrefs = profile?.preferences || {};
  const hasPrefsChanged = JSON.stringify(prefs) !== JSON.stringify(userPrefs) && Object.keys(prefs).length > 0;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Profile</h1>
          <p className="text-sm text-ink-500 mt-1">Your platform administrator profile</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => qc.invalidateQueries({ queryKey: ['platform-profile'] })}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-surface border rounded-lg hover:bg-surface-hover">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={logout} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </div>

      <div className="bg-surface rounded-xl border p-6">
        <div className="flex items-start gap-5">
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
              {u.avatarUrl ? (
                <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-blue-600">{u.fullName?.charAt(0)?.toUpperCase() || '?'}</span>
              )}
            </div>
            <button onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 p-1.5 bg-white border rounded-full shadow-sm hover:bg-surface-hover">
              <Camera className="w-3.5 h-3.5 text-ink-600" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <div className="flex-1 min-w-0">
            {showNameInput ? (
              <div className="flex items-center gap-2">
                <input value={nameEdit} onChange={e => setNameEdit(e.target.value)}
                  className="text-lg font-bold border rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500 flex-1" />
                <button onClick={() => updateMut.mutate({ fullName: nameEdit })}
                  disabled={!nameEdit.trim() || updateMut.isPending}
                  className="p-1.5 rounded bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50">
                  <Save className="w-4 h-4" />
                </button>
                <button onClick={() => setShowNameInput(false)}
                  className="p-1.5 rounded bg-gray-200 text-ink-600 hover:bg-gray-300">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2">
                {u.fullName}
                <button onClick={() => { setNameEdit(u.fullName || ''); setShowNameInput(true); }}
                  className="p-1 rounded hover:bg-surface-hover text-ink-400 hover:text-ink-600">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
              </h2>
            )}
            <p className="text-sm text-ink-500">{u.email}</p>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 mt-1 text-xs rounded-full bg-blue-100 text-blue-700">
              <Shield className="w-3 h-3" /> {u.role}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface rounded-xl border p-5 space-y-4">
          <h3 className="text-sm font-semibold text-ink-700 flex items-center gap-2"><Lock className="w-4 h-4" /> Change Password</h3>
          <div>
            <label className="block text-xs text-ink-500 mb-1">Current Password</label>
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} value={passwordForm.currentPassword}
                onChange={e => setPasswordForm(f => ({ ...f, currentPassword: e.target.value }))}
                className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 pr-9" />
              <button onClick={() => setShowPwd(!showPwd)} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-ink-500 mb-1">New Password</label>
            <input type="password" value={passwordForm.newPassword}
              onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
              className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-ink-500 mb-1">Confirm New Password</label>
            <input type="password" value={passwordForm.confirmPassword}
              onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
              className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={() => {
            if (passwordForm.newPassword !== passwordForm.confirmPassword) {
              toast.toast('Passwords do not match', 'error');
              return;
            }
            passwordMut.mutate({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
          }}
            disabled={!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword || passwordMut.isPending}
            className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {passwordMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Update Password
          </button>
        </div>

        <div className="bg-surface rounded-xl border p-5 space-y-4">
          <h3 className="text-sm font-semibold text-ink-700 flex items-center gap-2"><User className="w-4 h-4" /> Account Info</h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-ink-500 mb-0.5">Account ID</p>
              <p className="font-mono text-xs text-ink-600">{u.id}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500 mb-0.5">Email</p>
              <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-ink-400" />{u.email}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500 mb-0.5">Role</p>
              <p className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-ink-400" />{u.role}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500 mb-0.5">Last Login</p>
              <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-ink-400" />{u.lastLogin ? fmtDate(u.lastLogin) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500 mb-0.5">Member Since</p>
              <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-ink-400" />{u.createdAt ? fmtDate(u.createdAt) : '—'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-xl border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink-700">Preferences</h3>
          {hasPrefsChanged && (
            <button onClick={() => prefsMut.mutate(prefs)}
              disabled={prefsMut.isPending}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {prefsMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Save Preferences
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-ink-500 mb-1">Theme</label>
            <select value={prefs.theme ?? userPrefs.theme ?? 'system'}
              onChange={e => setPrefs(p => ({ ...p, theme: e.target.value }))}
              className="w-full px-3 py-2 text-sm border rounded-lg bg-surface">
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-ink-500 mb-1">Language</label>
            <select value={prefs.language ?? userPrefs.language ?? 'en'}
              onChange={e => setPrefs(p => ({ ...p, language: e.target.value }))}
              className="w-full px-3 py-2 text-sm border rounded-lg bg-surface">
              <option value="en">English</option>
              <option value="fr">French</option>
              <option value="es">Spanish</option>
              <option value="pt">Portuguese</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-ink-700 cursor-pointer flex items-center gap-2">
              <input type="checkbox"
                checked={prefs.notificationsEnabled ?? userPrefs.notificationsEnabled ?? true}
                onChange={e => setPrefs(p => ({ ...p, notificationsEnabled: e.target.checked }))}
                className="rounded" />
              Enable notifications
            </label>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-xl border p-5">
        <h3 className="text-sm font-semibold text-ink-700 mb-3 flex items-center gap-2"><Shield className="w-4 h-4" /> Session</h3>
        <p className="text-sm text-ink-600">You are logged into the Platform Portal. Your session is managed via JWT tokens with automatic refresh.</p>
      </div>
    </div>
  );
}
