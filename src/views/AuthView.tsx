import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  User, 
  Lock, 
  Mail, 
  Phone, 
  ArrowRight, 
  KeyRound, 
  Sun, 
  Moon, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  RefreshCw,
  ArrowLeft,
  Eye,
  EyeOff,
  Wallet
} from 'lucide-react';
import type { UserProfile } from '../types/index.ts';

interface AuthViewProps {
  onLoginSuccess: (user: UserProfile, token: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export function AuthView({ onLoginSuccess, isDark, onToggleTheme }: AuthViewProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  
  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  
  // Register form state
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');

  // Forgot password form state
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPass, setForgotNewPass] = useState('');
  const [forgotTimer, setForgotTimer] = useState(300);

  // General feedback states
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Countdown timer for forgot password OTP
  useEffect(() => {
    let interval: any = null;
    if (mode === 'forgot' && forgotStep === 2 && forgotTimer > 0) {
      interval = setInterval(() => {
        setForgotTimer((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [mode, forgotStep, forgotTimer]);

  const resetMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // 1. Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!loginIdentifier.trim() || !loginPassword) {
      setError('Please enter your username, verified email, or mobile number and password.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: loginIdentifier.trim(),
          password: loginPassword
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed. Please check your credentials.');
      }

      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message || 'Authentication error.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Registration Step 1: Send OTP for contact verification
  // 2. Direct Registration (without OTP)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    const username = regUsername.trim();
    if (username.length < 3) {
      setError('Username must be at least 3 characters long.');
      return;
    }
    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password: regPassword,
          email: regEmail.trim() || undefined,
          phone: regPhone.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create account.');
      }

      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message || 'Registration error.');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Handle Forgot Password Step 1 (Request OTP)
  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!forgotIdentifier.trim()) {
      setError('Please provide your verified email or mobile number.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch('/api/auth/forgot-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: forgotIdentifier.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send recovery code.');
      }

      setForgotStep(2);
      setForgotTimer(300);
      setSuccess(data.message);
    } catch (err: any) {
      setError(err.message || 'Recovery request error.');
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Handle Forgot Password Step 2 (Reset Password)
  const handleForgotReset = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (forgotOtp.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    if (forgotNewPass.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch('/api/auth/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: forgotIdentifier.trim(),
          code: forgotOtp.trim(),
          newPassword: forgotNewPass
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password.');
      }

      setSuccess('Password updated successfully. Please sign in with your new password.');
      setMode('login');
      setLoginIdentifier(forgotIdentifier.trim());
      setLoginPassword('');
      setForgotStep(1);
    } catch (err: any) {
      setError(err.message || 'Failed to complete reset.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between items-center p-4 sm:p-6 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors">
      {/* Top Bar with theme toggle */}
      <header className="w-full max-w-5xl flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-bold text-sm shadow-xs">
            <Wallet className="w-4 h-4" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-white">
            Expense Pattern Analyzer
          </span>
        </div>

        <button
          onClick={onToggleTheme}
          className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white shadow-xs transition-colors"
          aria-label="Toggle dark/light theme"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-zinc-600" />}
        </button>
      </header>

      {/* Main Auth Container */}
      <div className="w-full max-w-md my-auto">
        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden p-6 sm:p-8 space-y-6">
          {/* Header Title */}
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {mode === 'login' && 'Sign in to your account'}
              {mode === 'register' && 'Create your account'}
              {mode === 'forgot' && 'Reset your password'}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {mode === 'login' && 'Manage your income, expenses, and savings with pattern analytics.'}
              {mode === 'register' && 'Enter your username, password, and optional contact info to get started.'}
              {mode === 'forgot' && 'Receive a one-time code on your registered email to securely set a new password.'}
            </p>
          </div>

          {/* Mode Switch Tabs (Login / Register) */}
          {mode !== 'forgot' && (
            <div className="flex rounded-lg bg-zinc-100 dark:bg-zinc-800/70 p-1 border border-zinc-200/80 dark:border-zinc-750 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  resetMessages();
                  setMode('login');
                }}
                className={`flex-1 py-1.5 rounded-md transition-all text-center ${
                  mode === 'login'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  resetMessages();
                  setMode('register');
                }}
                className={`flex-1 py-1.5 rounded-md transition-all text-center ${
                  mode === 'register'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Feedback Messages */}
          {error && (
            <div className="p-3 rounded-lg text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* ============================================== */}
          {/* 1. LOGIN FORM                                  */}
          {/* ============================================== */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-identifier" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Username, Email, or Mobile
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                  <input
                    id="login-identifier"
                    type="text"
                    required
                    autoFocus
                    placeholder="Username or verified contact"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-300"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="login-password" aria-label="Password" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      resetMessages();
                      setMode('forgot');
                      setForgotStep(1);
                    }}
                    className="text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white underline font-medium"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                  <input
                    id="login-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 text-xs font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <span>{isLoading ? 'Signing in...' : 'Sign In'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 text-center text-xs text-zinc-500">
                Don't have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => {
                    resetMessages();
                    setMode('register');
                  }}
                  className="text-zinc-900 dark:text-white font-semibold hover:underline"
                >
                  Create one now
                </button>
              </div>
            </form>
          )}

          {/* ========================================================= */}
          {/* 2. REGISTRATION FLOW (Direct without OTP)                 */}
          {/* ========================================================= */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="reg-username" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Username *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                  <input
                    id="reg-username"
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. alex_rivera"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-300"
                  />
                </div>
                <span className="text-[10px] text-zinc-400">At least 3 characters.</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="reg-password" aria-label="Password" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Password *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      {showRegPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <input
                    id="reg-password"
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    placeholder="Min 6 chars"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-300"
                  />
                </div>
                <div>
                  <label htmlFor="reg-confirm" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Confirm *
                  </label>
                  <input
                    id="reg-confirm"
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    placeholder="Repeat password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-300"
                  />
                </div>
              </div>

              {/* Optional Identifiers / Recovery Contacts */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                <div>
                  <label htmlFor="reg-email" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Email Address (Optional)
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                    <input
                      id="reg-email"
                      type="email"
                      placeholder="you@example.com (for login & recovery)"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-300"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-phone" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Mobile Number (Optional)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                    <input
                      id="reg-phone"
                      type="tel"
                      placeholder="+1234567890 or 9876543210"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-300 font-mono"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 text-xs font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <span>{isLoading ? 'Creating account...' : 'Create Account'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="pt-2 text-center text-xs text-zinc-500">
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => {
                    resetMessages();
                    setMode('login');
                  }}
                  className="text-zinc-900 dark:text-white font-semibold hover:underline"
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

          {/* ============================================== */}
          {/* 3. FORGOT PASSWORD FLOW                        */}
          {/* ============================================== */}
          {mode === 'forgot' && (
            <div className="space-y-4">
              {forgotStep === 1 ? (
                <form onSubmit={handleForgotRequest} className="space-y-4">
                  <div>
                    <label htmlFor="forgot-contact-input" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Registered Email Address
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                      <input
                        id="forgot-contact-input"
                        type="text"
                        required
                        autoFocus
                        placeholder="e.g. user@example.com"
                        value={forgotIdentifier}
                        onChange={(e) => setForgotIdentifier(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-300"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 text-xs font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg shadow-xs transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Sending recovery code...' : 'Send Recovery Code'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleForgotReset} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="forgot-otp-input" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        Enter 6-Digit Code
                      </label>
                      <span className="flex items-center gap-1 text-[11px] text-zinc-500 font-mono">
                        <Clock className="w-3 h-3 text-zinc-400" />
                        <span>Expires in {formatTimer(forgotTimer)}</span>
                      </span>
                    </div>
                    <input
                      id="forgot-otp-input"
                      type="text"
                      maxLength={6}
                      required
                      autoFocus
                      placeholder="123456"
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-center tracking-[0.3em] text-xl font-mono py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="forgot-newpass-input" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      New Password (min 6 characters)
                    </label>
                    <input
                      id="forgot-newpass-input"
                      type="password"
                      required
                      minLength={6}
                      placeholder="••••••••"
                      value={forgotNewPass}
                      onChange={(e) => setForgotNewPass(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || forgotOtp.length !== 6 || forgotTimer === 0}
                    className="w-full py-2.5 px-4 text-xs font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg shadow-xs transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Resetting password...' : 'Verify Code & Reset Password'}
                  </button>
                </form>
              )}

              <div className="pt-2 text-center text-xs">
                <button
                  type="button"
                  onClick={() => {
                    resetMessages();
                    setMode('login');
                  }}
                  className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                >
                  Return to Sign In
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full max-w-5xl py-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
        RupeeTrail · Personal Finance & Expense Analytics
      </footer>
    </div>
  );
}
