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
    protocol: 'http',
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

  const isHttp = form.protocol === 'http';

  useEffect(() => {
    emailSettingsApi.get()
      .then(res => {
        const d = res.data.data;
        if (d) {
          setForm({
            protocol: d.protocol || 'http',
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
      const payload: any = {
        protocol: form.protocol,
        email: form.email,
      };
      if (form.protocol === 'smtp') {
        payload.hostname = form.hostname;
        payload.port = form.port;
        payload.username = form.username;
        payload.password = form.password;
        payload.doNotVerifyTls = form.doNotVerifyTls;
      }
      const res = await emailSettingsApi.test(payload);
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
      setForm({ protocol: 'http', hostname: '', port: 587, username: '', email: '', password: '', sendCopyTo: '', replyTo: '', useDifferentReplyTo: false, doNotVerifyTls: false });
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
          <p className="text-xs text-slate-400 mt-0.5">Configure how SkyBooks sends emails on your behalf</p>
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
          <h3 className="font-extrabold text-sm text-blue-900">Email Setup Guide</h3>
          <p>SkyBooks supports two protocols for sending emails:</p>

          <h4 className="font-bold text-blue-800 mt-3">HTTP (Built-in) — Recommended</h4>
          <p>No configuration needed. Emails are sent through SkyBooks' built-in email service using Resend. Your recipients will see emails from <strong>"Your Org via SkyBooks"</strong> and replies will come to the email address you set below.</p>
          <p>This works on all hosting providers since it uses HTTPS (port 443), never blocked.</p>

          <h4 className="font-bold text-blue-800">SMTP (Custom Server)</h4>
          <p>Use your own SMTP server (e.g. Gmail, Outlook). You'll need to enter your server hostname, port, and credentials. Note: some cloud hosts block outbound SMTP ports (25, 465, 587) on free tiers.</p>

          <h4 className="font-bold text-blue-800">Setup Tips</h4>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Email address</strong> is used as the Reply-To for HTTP mode and as the sender for SMTP mode</li>
            <li><strong>Send a copy</strong> archives all outgoing org emails to a secondary address</li>
          </ul>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white border border-slate-200/80 rounded-2xl shadow-sm divide-y divide-slate-100">
        {/* Protocol */}
        <div className="p-5">
          <label className="block text-xs font-bold text-slate-700 mb-1">Protocol</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => update('protocol', 'http')}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                isHttp
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              HTTP (Built-in)
            </button>
            <button
              type="button"
              onClick={() => update('protocol', 'smtp')}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                !isHttp
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              SMTP (Custom Server)
            </button>
          </div>
          {isHttp && (
            <p className="text-[10px] text-emerald-600 mt-1.5 font-semibold">
              Emails sent via SkyBooks built-in service — no setup required.
            </p>
          )}
        </div>

        {/* SMTP-only sections */}
        {!isHttp && (
          <>
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

              <div className="pt-2">
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
            </div>
          </>
        )}

        {/* Email address (shared — used as Reply-To for HTTP, sender for SMTP) */}
        <div className="p-5 space-y-4">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
            {isHttp ? 'Reply-To Email' : 'Sender Email'}
          </h3>
          <p className="text-[10px] text-slate-400 -mt-2">
            {isHttp
              ? 'Replies from your recipients will go to this address. Emails are sent from the SkyBooks platform address.'
              : 'This address will appear as the sender of outgoing emails.'}
          </p>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email address</label>
            <input
              type="email"
              value={form.email}
              onChange={e => update('email', e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
            />
          </div>
        </div>

        {/* Additional Options (shared) */}
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
              disabled={testing || !form.email || (!isHttp && !form.hostname)}
              className="px-4 py-2.5 text-xs font-bold text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {isHttp ? 'Send Test via Resend' : 'Test Email Settings'}
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
