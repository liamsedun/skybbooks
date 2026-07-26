import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { AlertCircle } from 'lucide-react';

function friendlyError(err: string): string {
  if (err.includes('not found') || err.includes('404')) return 'Service unavailable. Please try again later.';
  if (err.includes('password') || err.includes('Invalid email')) return 'Invalid email or password.';
  if (err.includes('deactivated') || err.includes('inactive')) return 'Your account has been deactivated.';
  if (err.includes('rate limit') || err.includes('Too many')) return 'Too many attempts. Please wait before trying again.';
  if (err.includes('network') || err.includes('connect') || err.includes('ECONNREFUSED')) return 'Unable to connect. Check your internet connection.';
  return err;
}

export function PlatformLoginPage() {
  const { platformLogin, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [lit, setLit] = useState(false);

  const toggleLamp = useCallback(() => setLit(v => !v), []);

  if (isAuthenticated) {
    navigate('/platform', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setLoginError('Please enter your email and password.');
      return;
    }
    setSubmitting(true);
    setLoginError('');
    try {
      await platformLogin(email, password);
      navigate('/platform');
    } catch (err: any) {
      const raw = err.response?.data?.error || err.message || 'Login failed. Please try again.';
      setLoginError(friendlyError(raw));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`stage ${lit ? 'lit' : ''}`}>
      <style>{`
        :root { --gold: #e0a84a; --gold-bright: #ffd98a; --ink: #eef1f5; --muted: #8fa0b3; }
        .stage {
          position:relative; width:100%; height:100vh;
          display:flex; align-items:center; justify-content:center; gap:6vw; flex-wrap:wrap;
          background:#0c1420; transition:background 1.2s ease;
          font-family:'Segoe UI',system-ui,sans-serif;
        }
        .stage.lit { background:radial-gradient(ellipse at 38% 55%, rgba(224,168,74,0.10), transparent 60%) #0c1420; }

        .lamp-wrap {
          position:relative; width:220px; height:420px;
          cursor:pointer; user-select:none; -webkit-tap-highlight-color:transparent;
        }
        .hint {
          position:absolute; top:-38px; left:50%; transform:translateX(-50%);
          color:var(--muted); font-size:13px; letter-spacing:.5px; white-space:nowrap;
          opacity:.85; animation:bob 2.2s ease-in-out infinite;
          transition:opacity .5s ease;
        }
        .lit .hint { opacity:0; }
        @keyframes bob { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(4px)} }

        .cord {
          position:absolute; top:132px; left:50%; width:2px; height:46px;
          background:#55627a; transform-origin:top center; transition:transform .15s ease;
        }
        .lamp-wrap:active .cord { transform:rotate(8deg) scaleY(1.05); }
        .cord::after {
          content:""; position:absolute; left:50%; bottom:-8px;
          width:12px; height:12px; background:var(--gold); border-radius:50%;
          transform:translateX(-50%); box-shadow:0 0 6px rgba(224,168,74,.6);
        }

        .beam {
          position:absolute; top:178px; left:50%; width:260px; height:320px;
          transform:translateX(-50%);
          clip-path:polygon(43% 0%,57% 0%,100% 100%,0% 100%);
          background:linear-gradient(to bottom,rgba(255,217,138,.55),rgba(255,217,138,0));
          opacity:0; transition:opacity .6s ease; pointer-events:none;
        }
        .lit .beam { opacity:1; }

        .shade {
          position:absolute; top:0; left:50%; width:176px; height:150px;
          transform:translateX(-50%);
          clip-path:polygon(30% 0%,70% 0%,100% 100%,0% 100%);
          background:linear-gradient(180deg,#9a8f7e,#7c7261);
          box-shadow:inset 0 -10px 18px rgba(0,0,0,.25); z-index:3;
        }
        .shade-glow {
          position:absolute; top:144px; left:50%; width:176px; height:14px;
          transform:translateX(-50%); background:#2a2018; border-radius:50%; z-index:2;
          transition:background .5s ease,box-shadow .5s ease;
        }
        .lit .shade-glow { background:var(--gold-bright); box-shadow:0 0 30px 10px rgba(255,217,138,.75); }

        .face {
          position:absolute; top:52px; left:50%; transform:translateX(-50%);
          width:90px; height:40px; z-index:4;
        }
        .eye {
          position:absolute; top:0; width:20px; height:12px;
          border-top:3px solid #2a2118; border-radius:50% 50% 0 0 / 100% 100% 0 0;
        }
        .eye.l { left:8px; } .eye.r { right:8px; }
        .mouth {
          position:absolute; top:18px; left:50%; transform:translateX(-50%);
          width:26px; height:26px; background:#2a2118; border-radius:50%; overflow:hidden;
        }
        .tongue {
          position:absolute; bottom:0; left:50%; transform:translateX(-50%);
          width:14px; height:12px; background:#d9636b; border-radius:50% 50% 40% 40%;
        }
        .cheek {
          position:absolute; top:6px; width:8px; height:5px;
          background:rgba(217,99,107,.55); border-radius:50%; opacity:.7;
        }
        .cheek.l { left:-2px; } .cheek.r { right:-2px; }

        .pole {
          position:absolute; top:148px; left:50%; width:8px; height:190px;
          transform:translateX(-50%);
          background:linear-gradient(90deg,#c9ccd1,#f2f3f5,#c9ccd1); z-index:1;
        }
        .base {
          position:absolute; bottom:40px; left:50%; width:130px; height:20px;
          transform:translateX(-50%);
          background:linear-gradient(180deg,#f2f3f5,#c3c6cb); border-radius:50%;
          box-shadow:0 6px 10px rgba(0,0,0,.4);
        }
        .shadow-pool {
          position:absolute; bottom:18px; left:50%; width:160px; height:22px;
          transform:translateX(-50%); background:rgba(0,0,0,.45); border-radius:50%;
          filter:blur(6px); transition:box-shadow .6s ease,background .6s ease;
        }
        .lit .shadow-pool { background:rgba(255,217,138,.18); box-shadow:0 0 60px 20px rgba(255,217,138,.12); }

        .card {
          width:360px; padding:36px 32px 32px; border-radius:18px;
          background:linear-gradient(180deg,#101a28,#0d1622);
          border:1px solid rgba(224,168,74,.25);
          opacity:0; transform:translateY(18px) scale(.98); filter:blur(2px);
          pointer-events:none;
          transition:opacity .8s ease,transform .8s ease,filter .8s ease,box-shadow .8s ease;
        }
        .card.show {
          opacity:1; transform:translateY(0) scale(1); filter:blur(0); pointer-events:auto;
          box-shadow:0 0 20px rgba(224,168,74,.22),0 0 55px rgba(224,168,74,.10);
          animation:pulseGlow 3.2s ease-in-out infinite;
        }
        @keyframes pulseGlow {
          0%,100%{box-shadow:0 0 20px rgba(224,168,74,.22),0 0 55px rgba(224,168,74,.10)}
          50%{box-shadow:0 0 28px rgba(224,168,74,.35),0 0 75px rgba(224,168,74,.18)}
        }
        .card h1 { margin:0 0 6px; color:var(--ink); font-size:26px; font-weight:700; }
        .card .sub { color:var(--muted); font-size:13px; margin-bottom:26px; }
        .field { margin-bottom:18px; }
        .field label {
          display:block; color:var(--muted); font-size:13px; margin-bottom:8px;
        }
        .field input {
          width:100%; padding:12px 14px; border-radius:8px;
          border:1px solid rgba(255,255,255,.08); background:#0a1420;
          color:var(--ink); font-size:14px; outline:none;
          transition:border-color .2s ease,box-shadow .2s ease;
        }
        .field input:focus { border-color:var(--gold); box-shadow:0 0 0 3px rgba(224,168,74,.15); }
        .field input::placeholder { color:#566173; }
        .field .input-wrap { position:relative; }
        .field .input-wrap input { padding-right:44px; }
        .field .toggle-vis {
          position:absolute; right:10px; top:50%; transform:translateY(-50%);
          background:none; border:none; color:var(--muted); cursor:pointer; padding:6px;
          font-size:14px; line-height:1;
        }
        .field .toggle-vis:hover { color:var(--gold); }
        button.login-btn {
          width:100%; padding:13px; margin-top:6px; border:none; border-radius:8px;
          background:linear-gradient(180deg,var(--gold-bright),var(--gold));
          color:#24160a; font-weight:700; font-size:15px; cursor:pointer;
          transition:transform .15s ease,box-shadow .15s ease,opacity .15s ease;
        }
        button.login-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 18px rgba(224,168,74,.35); }
        button.login-btn:disabled { opacity:.5; cursor:not-allowed; }
        .error-msg {
          background:rgba(239,68,68,.12); border:1px solid rgba(239,68,68,.25);
          color:#f87171; font-size:13px; border-radius:8px; padding:10px 12px;
          margin-bottom:16px; display:flex; align-items:center; gap:8px;
        }
        .back-link {
          display:block; text-align:center; margin-top:18px;
          color:var(--muted); font-size:13px; text-decoration:none;
        }
        .back-link:hover { color:var(--gold); }
        .footer {
          display:block; text-align:center; margin-top:20px;
          color:var(--muted); font-size:11px; opacity:.7;
        }

        @media (max-width:620px) {
          .stage { flex-direction:column; gap:10px; }
          .lamp-wrap { width:160px; height:300px; }
          .lamp-wrap .beam { width:200px; height:240px; top:120px; }
          .lamp-wrap .shade { width:130px; height:110px; }
          .lamp-wrap .shade-glow { top:106px; width:130px; height:10px; }
          .lamp-wrap .pole { top:110px; height:130px; }
          .lamp-wrap .base { bottom:20px; width:100px; height:16px; }
          .lamp-wrap .shadow-pool { bottom:6px; width:120px; height:16px; }
          .lamp-wrap .cord { top:96px; height:34px; }
          .lamp-wrap .face { top:38px; width:70px; height:32px; }
          .lamp-wrap .eye { width:16px; height:10px; }
          .lamp-wrap .eye.l { left:4px; } .lamp-wrap .eye.r { right:4px; }
          .lamp-wrap .mouth { top:16px; width:20px; height:20px; }
          .lamp-wrap .tongue { width:10px; height:8px; }
          .lamp-wrap .cheek { width:6px; height:4px; }
          .card { width:86vw; }
        }
      `}</style>

      <div className="lamp-wrap" onClick={toggleLamp} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleLamp(); } }} role="button" aria-label="Toggle lamp" tabIndex={0}>
        <div className="hint">click the lamp</div>
        <div className="beam" />
        <div className="cord" />
        <div className="shade" />
        <div className="shade-glow" />
        <div className="face">
          <div className="eye l" />
          <div className="eye r" />
          <div className="mouth"><div className="tongue" /></div>
          <div className="cheek l" />
          <div className="cheek r" />
        </div>
        <div className="pole" />
        <div className="base" />
        <div className="shadow-pool" />
      </div>

      <form className={`card ${lit ? 'show' : ''}`} onSubmit={handleSubmit} autoComplete="off">
        <h1>Welcome Back</h1>
        <p className="sub">Sign in to SkyHouse administration</p>

        {loginError && (
          <div className="error-msg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{loginError}</span>
          </div>
        )}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="admin@skyhouse.com"
            required
            autoComplete="email"
            disabled={submitting}
          />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <PasswordInput value={password} onChange={setPassword} disabled={submitting} />
        </div>

        <button type="submit" className="login-btn" disabled={submitting || isLoading}>
          {submitting ? 'Signing in...' : 'Login'}
        </button>

        <a href="/login" className="back-link">&larr; Back to tenant login</a>
        <span className="footer">Authorized access only</span>
      </form>
    </div>
  );
}

function PasswordInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-wrap">
      <input
        id="password"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Enter your password"
        required
        autoComplete="current-password"
        disabled={disabled}
      />
      <button type="button" className="toggle-vis" onClick={() => setShow(v => !v)} aria-label={show ? 'Hide password' : 'Show password'} tabIndex={-1}>
        {show ? '\u25C9' : '\u25CB'}
      </button>
    </div>
  );
}
