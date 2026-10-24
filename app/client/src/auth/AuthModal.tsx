import React, { useCallback, useState } from 'react';
import { soundEffects } from '../audio/soundEffects';
import { GoldDivider, RoyalPanel } from '../componenets/lobby/LobbyOrnaments';
import { useAuth } from './AuthContext';
import { GoogleSignInButton } from './GoogleSignInButton';

type AuthMode = 'login' | 'register';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  fontFamily: "'Almendra', 'Georgia', serif",
  background: 'linear-gradient(135deg, #3f2719, #29180e)',
  border: '2px solid #785128',
};

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { signIn, register, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const switchMode = (nextMode: AuthMode) => {
    soundEffects.playHover();
    setMode(nextMode);
    setError(null);
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    setError(null);

    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    soundEffects.playClick();

    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
      } else {
        await register(name, email.trim(), password);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      if (submitting) return;
      setError(null);
      setSubmitting(true);

      try {
        await signInWithGoogle(credential);
        soundEffects.playClick();
        onClose();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Google sign-in failed. Please try again.',
        );
      } finally {
        setSubmitting(false);
      }
    },
    [onClose, signInWithGoogle, submitting],
  );

  if (!isOpen) return null;

  const isRegister = mode === 'register';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-4 animate-fadeIn">
      <RoyalPanel className="relative w-full max-w-md p-5 sm:p-6 max-h-[94vh] overflow-y-auto animate-modalPop shadow-[0_0_50px_rgba(212,175,55,0.35)]">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h3
              className="text-lg sm:text-xl font-bold text-amber-100 tracking-wide"
              style={{ fontFamily: "'MedievalSharp', 'Cinzel', serif" }}
            >
              {isRegister ? 'Create Your Account' : 'Enter the Royal Court'}
            </h3>
            <p
              className="text-[11px] sm:text-xs text-amber-200/60"
              style={{ fontFamily: "'Almendra', 'Georgia', serif" }}
            >
              {isRegister
                ? 'Claim your commander name across every battle.'
                : 'Sign in to keep your name, avatar, and progress.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              soundEffects.playModal();
              onClose();
            }}
            className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-amber-300/60 hover:text-amber-200 transition cursor-pointer"
            style={{ background: 'rgba(74,18,18,0.6)', border: '1px solid rgba(197,155,39,0.3)' }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <GoldDivider className="my-3 sm:my-4" />

        <div
          className="grid grid-cols-2 gap-1 p-1 rounded-lg mb-4"
          style={{ background: 'rgba(41,24,14,0.8)', border: '1px solid rgba(197,155,39,0.3)' }}
        >
          {(['login', 'register'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => switchMode(tab)}
              className="py-2 rounded-md text-xs font-bold tracking-wider transition cursor-pointer"
              style={{
                fontFamily: "'Almendra SC', 'Almendra', serif",
                background:
                  mode === tab
                    ? 'linear-gradient(180deg, #c59b27, #92681a)'
                    : 'transparent',
                color: mode === tab ? '#29180e' : '#fde68a',
                border: mode === tab ? '1px solid #fef08a' : '1px solid transparent',
              }}
            >
              {tab === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {isRegister && (
            <div>
              <label
                htmlFor="auth-name"
                className="block text-[11px] font-bold text-amber-200/70 uppercase tracking-[0.15em] mb-1"
                style={{ fontFamily: "'Almendra SC', 'Almendra', serif" }}
              >
                Display Name <span className="normal-case font-normal">(optional)</span>
              </label>
              <input
                id="auth-name"
                type="text"
                maxLength={40}
                autoComplete="nickname"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Alaungpaya"
                className="w-full px-3.5 py-2.5 rounded-lg text-amber-100 placeholder-amber-900/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition text-sm"
                style={inputStyle}
              />
            </div>
          )}

          <div>
            <label
              htmlFor="auth-email"
              className="block text-[11px] font-bold text-amber-200/70 uppercase tracking-[0.15em] mb-1"
              style={{ fontFamily: "'Almendra SC', 'Almendra', serif" }}
            >
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="commander@example.com"
              className="w-full px-3.5 py-2.5 rounded-lg text-amber-100 placeholder-amber-900/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition text-sm"
              style={inputStyle}
            />
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="block text-[11px] font-bold text-amber-200/70 uppercase tracking-[0.15em] mb-1"
              style={{ fontFamily: "'Almendra SC', 'Almendra', serif" }}
            >
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              className="w-full px-3.5 py-2.5 rounded-lg text-amber-100 placeholder-amber-900/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition text-sm"
              style={inputStyle}
            />
          </div>

          {isRegister && (
            <div>
              <label
                htmlFor="auth-confirm-password"
                className="block text-[11px] font-bold text-amber-200/70 uppercase tracking-[0.15em] mb-1"
                style={{ fontFamily: "'Almendra SC', 'Almendra', serif" }}
              >
                Confirm Password
              </label>
              <input
                id="auth-confirm-password"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat your password"
                className="w-full px-3.5 py-2.5 rounded-lg text-amber-100 placeholder-amber-900/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition text-sm"
                style={inputStyle}
              />
            </div>
          )}

          {error && (
            <div
              className="rounded-md px-3 py-2 text-xs leading-snug"
              style={{
                background: 'linear-gradient(135deg, #7f1d1d, #5c0f0f)',
                border: '1px solid rgba(248,113,113,0.6)',
                color: '#fecaca',
                fontFamily: "'Almendra', 'Georgia', serif",
              }}
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            onMouseEnter={() => soundEffects.playHover()}
            className="w-full py-2.5 rounded-lg font-bold text-xs sm:text-sm tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] hover:brightness-110"
            style={{
              fontFamily: "'Almendra SC', 'Almendra', serif",
              background: 'linear-gradient(180deg, #10b981, #059669, #047857)',
              border: '2px solid #d4af37',
              color: '#fef3c7',
              boxShadow: '0 2px 10px rgba(5,150,105,0.4), inset 0 1px 0 rgba(254,240,138,0.3)',
            }}
          >
            {submitting
              ? 'Please wait...'
              : isRegister
                ? 'Create Account'
                : 'Sign In'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-600/50 to-amber-700/40" />
          <span
            className="text-[10px] uppercase tracking-[0.2em] text-amber-200/50"
            style={{ fontFamily: "'Almendra SC', 'Almendra', serif" }}
          >
            or
          </span>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent via-amber-600/50 to-amber-700/40" />
        </div>

        <GoogleSignInButton
          onCredential={handleGoogleCredential}
          disabled={submitting}
        />
      </RoyalPanel>
    </div>
  );
};
