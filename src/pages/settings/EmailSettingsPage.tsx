import { useState, useEffect } from 'react';
import { emailSettingsApi } from '../../lib/api';
import { Loader2, CheckCircle2, AlertCircle, Send, Eye, EyeOff, Info, RefreshCw } from 'lucide-react';

export default function EmailSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const [form, setForm] = useState({
    protocol: 'smtp',
    hostname: '',
    port: 587,
    username: '',
    email: '',
    password: '',
    sendCopyTo: '',
    replyTo: '',
    useDifferentReplyTo: false,
    doNotVerifyTls: false,
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    emailSettingsApi.get()
      .then(res => {
        const d = res.data.data;
        if (d) {
          setForm({
            protocol: d.protocol || 'smtp',
            hostname: d.hostname || '',
            port: d.port || 587,
            username: d.username || '',
            email: d.email || '',
            password: d.password || '',
            sendCopyTo: d.sendCopyTo || '',
            replyTo: d.replyTo || '',
            useDifferentReplyTo: d.useDifferentReplyTo || false,
            doNotVerifyTls: d.doNotVerifyTls || false,
          });
        }
      })
      .catch(() => setMessage({ type: 'error', text: 'Failed to load email settings.' }))
      .finally(() => setLoading(false));
  }, []);

  function update(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await emailSettingsApi.save(form);
      setMessage({ type: 'success', text: 'Email settings saved successfully.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setMessage(null);
    try {
      const res = await emailSettingsApi.test({
        hostname: form.hostname,
        port: form.port,
        username: form.username,
        password: form.password,
        email: form.email,
        doNotVerifyTls: form.doNotVerifyTls,
      });
      setMessage({ type: 'success', text: res.data.message || 'Test email sent!' });
    } catch (err: any) {
      console.error('[TestEmail]', err?.response?.data || err?.message || err);
      setMessage({ type: 'error', text: err?.response?.data?.message || err?.message || 'Test failed.' });
    } finally {
      setTesting(false);
    }
  }

  async function handleReset() {
    if (!confirm('Reset all email settings?')) return;
    setMessage(null);
    try {
      await emailSettingsApi.reset();
      setForm({ protocol: 'smtp', hostname: '', port: 587, username: '', email: '', password: '', sendCopyTo: '', replyTo: '', useDifferentReplyTo: false, doNotVerifyTls: false });
      setMessage({ type: 'info', text: 'Email settings reset.' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to reset settings.' });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
      </div>
    );
  }

  const portOptions = [
    { value: 465, label: '465 (SSL)' },
    { value: 587, label: '587 (TLS)' },
    { value: 25, label: '25 (Plain)' },
  ];

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900">Email Settings</h1>
          <p className="text-xs text-slate-400 mt-0.5">Configure your SMTP server to send emails from SkyBooks</p>
        </div>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-colors"
        >
          <Info className="w-3.5 h-3.5" />{showHelp ? 'Hide Help' : 'Help'}
        </button>
      </div>

      {/* Help documentation */}
      {showHelp && (
        <div className="mb-6 bg-blue-50 border border-blue-200/60 rounded-2xl p-5 text-xs text-slate-700 space-y-3 max-h-96 overflow-y-auto">
          <h3 className="font-extrabold text-sm text-blue-900">SMTP Setup Guide</h3>
          <p>The SMTP server form connects SkyBooks to your email provider's outgoing mail server. SMTP (Simple Mail Transfer Protocol) is the standard technology used for sending emails across the internet.</p>
          <p>You'll need to obtain SMTP server details from your email provider to complete this setup.</p>

          <h4 className="font-bold text-blue-800 mt-3">Protocol</h4>
          <p>Supports two protocols: <strong>HTTP</strong> and <strong>SMTP</strong>. SMTP is recommended for most setups.</p>

          <h4 className="font-bold text-blue-800">SMTP Server</h4>
          <p>Enter the hostname of your SMTP server. Examples: <code className="bg-blue-100 px-1 rounded">smtp.gmail.com</code>, <code className="bg-blue-100 px-1 rounded">smtp.mail.yahoo.com</code>, <code className="bg-blue-100 px-1 rounded">smtp.office365.com</code>.</p>

          <h4 className="font-bold text-blue-800">Port</h4>
          <p>Port 465 (SSL) or 587 (TLS) are recommended for secure connections. Port 25 is unencrypted.</p>

          <h4 className="font-bold text-blue-800">SMTP Credentials</h4>
          <p><strong>Username</strong> is the name you use to log in with your email provider. <strong>Email address</strong> is the sending address. <strong>Password</strong> — some providers require app-specific passwords (see below).</p>

          <h4 className="font-bold text-blue-800">Gmail Users</h4>
          <ol className="list-decimal pl-4 space-y-1">
            <li>Enable 2-step verification in your Google account settings</li>
            <li>Generate an app-specific password (Google Account → Security → App passwords)</li>
            <li>Use this app-specific password instead of your regular Gmail password</li>
            <li>Set SMTP server to <code className="bg-blue-100 px-1 rounded">smtp.gmail.com</code> and port 587 with TLS</li>
          </ol>

          <h4 className="font-bold text-blue-800">Yahoo Mail Users</h4>
          <ol className="list-decimal pl-4 space-y-1">
            <li>Go to Yahoo Account Security (<code className="bg-blue-100 px-1 rounded">https://login.yahoo.com/account/security</code>)</li>
            <li>Click 'Generate app password' under 'Account Security'</li>
            <li>Select 'Other app' and enter 'SkyBooks' as the app name</li>
            <li>Use the generated password with <code className="bg-blue-100 px-1 rounded">smtp.mail.yahoo.com</code> on port 587 or 465</li>
          </ol>

          <h4 className="font-bold text-blue-800">Troubleshooting</h4>
          <ul className="list-disc pl-4 space-y-1">
            <li>Double-check your SMTP server address, port number, and authentication settings</li>
            <li>Verify your username and password are correct (some providers require app-specific passwords)</li>
            <li>Ensure your firewall or antivirus isn't blocking the SMTP connection</li>
            <li>Test the same settings in another email client like Outlook or Thunderbird to isolate the issue</li>
          </ul>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white border border-slate-200/80 rounded-2xl shadow-sm divide-y divide-slate-100">
        {/* Protocol */}
        <div className="p-5">
          <label className="block text-xs font-bold text-slate-700 mb-1">Protocol</label>
          <select
            value={form.protocol}
            onChange={e => update('protocol', e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
          >
            <option value="smtp">SMTP</option>
            <option value="http">HTTP</option>
          </select>
        </div>

        {/* SMTP Server */}
        <div className="p-5 space-y-4">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">SMTP Server</h3>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Hostname</label>
            <input
              type="text"
              value={form.hostname}
              onChange={e => update('hostname', e.target.value)}
              placeholder="smtp.gmail.com"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Port</label>
            <div className="flex gap-2">
              {portOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update('port', opt.value)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                    form.port === opt.value
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SMTP Credentials */}
        <div className="p-5 space-y-4">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">SMTP Credentials</h3>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Username</label>
            <input
              type="text"
              value={form.username}
              onChange={e => update('username', e.target.value)}
              placeholder="olalekan.edun"
              autoComplete="username"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email address</label>
            <input
              type="email"
              value={form.email}
              onChange={e => update('email', e.target.value)}
              placeholder="olalekan.edun@gmail.com"
              autoComplete="email"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={e => update('password', e.target.value)}
                placeholder="Enter SMTP password"
                autoComplete="current-password"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Additional Options */}
        <div className="p-5 space-y-4">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Additional Options</h3>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Send a copy of every email to this address</label>
            <input
              type="email"
              value={form.sendCopyTo}
              onChange={e => update('sendCopyTo', e.target.value)}
              placeholder="archive@example.com"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="diffReply"
              checked={form.useDifferentReplyTo}
              onChange={e => update('useDifferentReplyTo', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="diffReply" className="text-xs font-semibold text-slate-700">Receive email replies at a different address than you send from</label>
          </div>

          {form.useDifferentReplyTo && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reply-To email address</label>
              <input
                type="email"
                value={form.replyTo}
                onChange={e => update('replyTo', e.target.value)}
                placeholder="replies@example.com"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
              />
            </div>
          )}
        </div>

        {/* Security */}
        <div className="p-5">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-3">Security</h3>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.doNotVerifyTls}
              onChange={e => update('doNotVerifyTls', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <span className="text-xs font-semibold text-slate-700">Do not verify TLS certificate</span>
              <p className="text-[10px] text-slate-400 mt-0.5">Only enable if using self-signed certificates on your own mail server</p>
            </div>
          </label>
        </div>

        {/* Message */}
        {message && (
          <div className={`px-5 pb-2 ${message.type === 'success' ? 'text-emerald-700' : message.type === 'error' ? 'text-rose-700' : 'text-blue-700'}`}>
            <div className={`flex items-start gap-2 p-3 rounded-xl text-xs font-semibold ${
              message.type === 'success' ? 'bg-emerald-50 border border-emerald-100'
                : message.type === 'error' ? 'bg-rose-50 border border-rose-100'
                : 'bg-blue-50 border border-blue-100'
            }`}>
              {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                : message.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                : <Info className="w-4 h-4 shrink-0 mt-0.5" />}
              <span>{message.text}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !form.hostname || !form.email}
              className="px-4 py-2.5 text-xs font-bold text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Test Email Settings
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Update
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
