import React, { useEffect, useState } from 'react';
import {
  Mail,
  Lock,
  User,
  Upload,
  ShieldCheck,
  Chrome,
  UserCheck,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Play,
} from 'lucide-react';
import {
  auth,
  createUserWithEmailAndPassword,
  googleProvider,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
} from '../services/firebase';
import { buildDefaultProfile, ensureUserProfile, UserProfile } from '../services/gameDb';
import { Lobby3DStage } from './Lobby3DStage';
import { soundEngine } from '../game/audio';
import { PRESET_AVATARS } from '../game/avatars';

interface AuthScreenProps {
  onAuthenticated: (profile: UserProfile, isLocalGuest?: boolean) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'title' | 'login' | 'signup' | 'reset' | 'guest'>('title');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(PRESET_AVATARS[0]);
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (mode === 'title' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        soundEngine.unlock();
        soundEngine.playUiClick();
        setMode('login');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 96;
        canvas.height = 96;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 96, 96);
          setAvatarUrl(canvas.toDataURL('image/jpeg', 0.72));
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleGoogleSignIn = async () => {
    if (!termsAccepted) {
      setError('Please accept the Terms & Conditions before signing in.');
      return;
    }
    soundEngine.unlock();
    soundEngine.playUiClick();
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const profile = await ensureUserProfile(cred.user.uid, {
        username: cred.user.displayName || 'ApexSurvivor',
        email: cred.user.email || '',
        avatarUrl: cred.user.photoURL || PRESET_AVATARS[0],
        authProvider: 'google',
        termsAccepted: true,
      });
      onAuthenticated(profile);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.unlock();
    soundEngine.playUiClick();
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const profile = await ensureUserProfile(cred.user.uid, {
        username: cred.user.displayName || email.split('@')[0] || 'Survivor',
        email: cred.user.email || email,
        authProvider: 'password',
        termsAccepted: true,
      });
      onAuthenticated(profile);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setError(
          'Email/Password Sign-In is not enabled in your Firebase Console yet. Enable it under Authentication → Sign-in method, or use Google Sign-In / Guest Mode.',
        );
      } else {
        setError(err instanceof Error ? err.message : 'Invalid credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      setError('You must accept the Terms & Conditions to create an account.');
      return;
    }
    if (username.trim().length < 2) {
      setError('Callsign must be at least 2 characters.');
      return;
    }
    soundEngine.unlock();
    soundEngine.playUiClick();
    setError('');
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const profile = await ensureUserProfile(cred.user.uid, {
        username: username.trim(),
        email: email.trim(),
        avatarUrl,
        authProvider: 'password',
        termsAccepted: true,
      });
      onAuthenticated(profile);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setError(
          'Email/Password Sign-Up is disabled in Firebase Console (Authentication → Sign-in method). Use Google Sign-In or Guest Mode below.',
        );
      } else {
        setError(err instanceof Error ? err.message : 'Registration failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setNotice('Password reset instructions sent to your email.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!termsAccepted) {
      setError('Please accept the Terms & Conditions to deploy as Guest.');
      return;
    }
    soundEngine.unlock();
    soundEngine.playUiClick();
    setError('');
    setLoading(true);
    const callsign = username.trim() || `Ghost_${Math.floor(100 + Math.random() * 899)}`;
    try {
      const cred = await signInAnonymously(auth);
      const profile = await ensureUserProfile(cred.user.uid, {
        username: callsign,
        avatarUrl,
        authProvider: 'guest',
        termsAccepted: true,
      });
      onAuthenticated(profile, false);
    } catch {
      // Fallback local-synced Guest session if Anonymous provider is not toggled in Firebase Console
      const guestUid = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const localProfile = buildDefaultProfile(guestUid, callsign, avatarUrl);
      onAuthenticated(localProfile, true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#07090F]">
      {/* Live 3D Backdrop */}
      <Lobby3DStage
        characterId="valkyrie"
        weaponId="ak47_ember"
        outfitId="outfit_default"
        hairId="hair_tactical"
        accessoryId="acc_standard"
        activeEmote={null}
        cameraPreset="title"
      />

      {/* Gradient Scrims for Calm Negative Space & Readability */}
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-r from-[#07090F]/92 via-[#07090F]/45 to-[#07090F]/85" />

      {/* Title Screen Layout */}
      <div className="relative z-10 h-full w-full flex flex-col md:flex-row items-center justify-between px-6 md:px-14 py-8">
        {/* Left: Bespoke SVG Lockup & Control Hint */}
        <div className="max-w-xl flex flex-col items-start">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-orange-500/15 border border-orange-500/40 text-orange-400 text-xs font-bold tracking-widest uppercase mb-4">
            Season 01 · Protocol Ember
          </div>

          {/* Bespoke Inline SVG Title Lockup */}
          <svg viewBox="0 0 540 135" className="w-full max-w-[460px] h-auto mb-4 drop-shadow-[0_10px_28px_rgba(255,90,31,0.35)]">
            <defs>
              <linearGradient id="emberGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="55%" stopColor="#F8FAFC" />
                <stop offset="100%" stopColor="#FF5A1F" />
              </linearGradient>
            </defs>
            <polygon points="10,18 42,18 32,68 0,68" fill="#FF5A1F" />
            <polygon points="24,30 34,30 28,58 18,58" fill="#07090F" />
            <text
              x="54"
              y="66"
              fill="url(#emberGrad)"
              fontFamily="Inter, system-ui, sans-serif"
              fontWeight="900"
              fontSize="56"
              letterSpacing="4"
            >
              EMBERFALL
            </text>
            <rect x="54" y="82" width="160" height="4" fill="#FF5A1F" />
            <text
              x="54"
              y="114"
              fill="#38BDF8"
              fontFamily="Inter, system-ui, sans-serif"
              fontWeight="800"
              fontSize="24"
              letterSpacing="10"
            >
              BATTLE ROYALE
            </text>
          </svg>

          <p className="text-slate-300 text-sm md:text-base max-w-md leading-relaxed mb-6">
            Drop from the gunship onto Ember Island. Scavenge ballistic weapons, deploy tactical character abilities, drive armored buggies, and outlast 49 rivals inside the shrinking storm.
          </p>

          {mode === 'title' ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.playUiClick();
                  setMode('login');
                }}
                className="flex items-center gap-2.5 px-7 py-3.5 bg-orange-500 hover:bg-orange-400 text-slate-950 font-black tracking-wider uppercase rounded-lg shadow-lg shadow-orange-500/25 transition cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                Enter Armory & Deploy
              </button>
              <button
                onClick={() => handleGuestLogin()}
                className="flex items-center gap-2 px-5 py-3.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-100 font-bold tracking-wide uppercase rounded-lg transition cursor-pointer"
              >
                <UserCheck className="w-4 h-4 text-cyan-400" />
                Quick Play Guest
              </button>
            </div>
          ) : null}

          <p className="mt-5 text-xs text-slate-400 font-mono tracking-wide">
            WASD Move · Mouse Aim / Click Fire · Right-Click Scope · F Loot/Vehicle · E Ability · Esc Pause
          </p>
        </div>

        {/* Right: Auth / Account Panel */}
        {mode !== 'title' && (
          <div className="w-full max-w-md bg-[#0E1422]/95 border border-slate-700/80 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-black tracking-wide uppercase text-white">
                  {mode === 'login'
                    ? 'Survivor Sign In'
                    : mode === 'signup'
                      ? 'Enlist Operator'
                      : mode === 'reset'
                        ? 'Reset Access'
                        : 'Guest Deployment'}
                </h2>
                <p className="text-xs text-slate-400">Sync profile, rank, and loadout across sessions</p>
              </div>
              <button
                onClick={() => setMode('title')}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded border border-slate-700 cursor-pointer"
              >
                Back
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-3 gap-1.5 bg-slate-900 p-1 rounded-lg mb-4 text-xs font-bold">
              <button
                onClick={() => {
                  setError('');
                  setNotice('');
                  setMode('login');
                }}
                className={`py-2 rounded-md cursor-pointer transition ${
                  mode === 'login' ? 'bg-orange-500 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => {
                  setError('');
                  setNotice('');
                  setMode('signup');
                }}
                className={`py-2 rounded-md cursor-pointer transition ${
                  mode === 'signup' ? 'bg-orange-500 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                Sign Up
              </button>
              <button
                onClick={() => {
                  setError('');
                  setNotice('');
                  setMode('guest');
                }}
                className={`py-2 rounded-md cursor-pointer transition ${
                  mode === 'guest' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                Guest
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/15 border border-red-500/40 text-red-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {notice && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <span>{notice}</span>
              </div>
            )}

            {/* Google Sign-In */}
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleSignIn}
              className="w-full py-2.5 px-4 mb-4 bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm rounded-lg flex items-center justify-center gap-2.5 transition cursor-pointer disabled:opacity-50"
            >
              <Chrome className="w-4 h-4 text-orange-600" />
              Continue with Google
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-slate-800" />
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">or</span>
              <div className="h-px flex-1 bg-slate-800" />
            </div>

            {mode === 'login' && (
              <form onSubmit={handleEmailLogin} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="survivor@emberfall.gg"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setMode('reset')}
                    className="text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-400 text-slate-950 font-black uppercase tracking-wider text-sm rounded-lg transition cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Authenticating...' : 'Sign In'}
                </button>
              </form>
            )}

            {mode === 'signup' && (
              <form onSubmit={handleEmailSignup} className="space-y-3">
                <div className="flex items-center gap-3">
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-12 h-12 rounded-xl border border-orange-500/60 object-cover bg-slate-800"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      {PRESET_AVATARS.map((av, idx) => (
                        <button
                          type="button"
                          key={idx}
                          onClick={() => setAvatarUrl(av)}
                          className={`w-7 h-7 rounded-md overflow-hidden border cursor-pointer ${
                            avatarUrl === av ? 'border-orange-400' : 'border-slate-700'
                          }`}
                        >
                          <img src={av} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                      <label className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs rounded border border-slate-600 cursor-pointer">
                        <Upload className="w-3 h-3" /> Upload
                        <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Callsign / Username</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={24}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="ShadowViper"
                      className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="player@emberfall.gg"
                      className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </div>

                <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 accent-orange-500"
                  />
                  <span>
                    I accept the <span className="text-orange-400 font-semibold">Terms & Fair Play Policy</span> (anti-cheat enforcement active).
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-400 text-slate-950 font-black uppercase tracking-wider text-sm rounded-lg transition cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Creating Profile...' : 'Create Operator Account'}
                </button>
              </form>
            )}

            {mode === 'reset' && (
              <form onSubmit={handlePasswordReset} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Account Email</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="survivor@emberfall.gg"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black uppercase tracking-wider text-sm rounded-lg transition cursor-pointer"
                >
                  Send Password Reset Email
                </button>
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="w-full py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Back to Login
                </button>
              </form>
            )}

            {mode === 'guest' && (
              <form onSubmit={handleGuestLogin} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Guest Callsign</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      maxLength={24}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Ghost_404"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                </div>
                <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 accent-cyan-400"
                  />
                  <span>I accept the Emberfall Royale Fair Play Terms.</span>
                </label>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black uppercase tracking-wider text-sm rounded-lg flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {loading ? 'Deploying...' : 'Play as Guest'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
