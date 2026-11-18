import React, { useState } from 'react';
import { X, Settings, Shield, KeyRound, LogOut, CheckCircle2 } from 'lucide-react';
import { PlayerSettings } from '../services/gameDb';
import { soundEngine } from '../game/audio';
import { auth, sendPasswordResetEmail } from '../services/firebase';

interface SettingsModalProps {
  settings: PlayerSettings;
  privacyShowOnline: boolean;
  privacyAllowInvites: boolean;
  authProvider: 'google' | 'password' | 'guest';
  userEmail?: string;
  onUpdateSettings: (next: PlayerSettings) => void;
  onUpdatePrivacy: (showOnline: boolean, allowInvites: boolean) => void;
  onLogout: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  privacyShowOnline,
  privacyAllowInvites,
  authProvider,
  userEmail,
  onUpdateSettings,
  onUpdatePrivacy,
  onLogout,
  onClose,
}) => {
  const [secNotice, setSecNotice] = useState('');

  const update = (patch: Partial<PlayerSettings>) => {
    const next = { ...settings, ...patch };
    soundEngine.setVolumes(next.sfxVolume, next.musicVolume, next.muted);
    onUpdateSettings(next);
  };

  const handleResetPassword = async () => {
    if (!userEmail) return;
    try {
      await sendPasswordResetEmail(auth, userEmail);
      setSecNotice(`Password reset link sent to ${userEmail}.`);
    } catch (err: unknown) {
      setSecNotice(err instanceof Error ? err.message : 'Unable to send reset email.');
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-[#0C121E] border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-black uppercase tracking-wider text-white">Game & Security Settings</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Graphics */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="font-black uppercase text-orange-400">Graphics & Camera</h3>
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-semibold">Graphics Quality</span>
              <div className="flex gap-1.5">
                {(['low', 'medium', 'high'] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => update({ graphicsQuality: q })}
                    className={`px-3 py-1 rounded uppercase font-bold cursor-pointer ${
                      settings.graphicsQuality === q ? 'bg-orange-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-300 font-semibold">Camera FOV ({settings.fov}°)</span>
              <input
                type="range"
                min={55}
                max={95}
                value={settings.fov}
                onChange={(e) => update({ fov: Number(e.target.value) })}
                className="w-48 accent-orange-500"
              />
            </div>
          </div>

          {/* Audio */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="font-black uppercase text-cyan-400">Audio Synthesis</h3>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-300 font-semibold">Sound Effects ({Math.round(settings.sfxVolume * 100)}%)</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.sfxVolume}
                onChange={(e) => update({ sfxVolume: Number(e.target.value) })}
                className="w-48 accent-cyan-400"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-300 font-semibold">Lobby Music ({Math.round(settings.musicVolume * 100)}%)</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.musicVolume}
                onChange={(e) => update({ musicVolume: Number(e.target.value) })}
                className="w-48 accent-cyan-400"
              />
            </div>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-slate-300 font-semibold">Mute All Game Audio</span>
              <input
                type="checkbox"
                checked={settings.muted}
                onChange={(e) => update({ muted: e.target.checked })}
                className="accent-orange-500"
              />
            </label>
          </div>

          {/* Controls & Sensitivity */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="font-black uppercase text-emerald-400">Sensitivity & Shooting Controls</h3>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-300 font-semibold">Aim Sensitivity ({settings.mouseSensitivity.toFixed(2)}x)</span>
              <input
                type="range"
                min={0.3}
                max={2.5}
                step={0.05}
                value={settings.mouseSensitivity}
                onChange={(e) => update({ mouseSensitivity: Number(e.target.value) })}
                className="w-48 accent-emerald-400"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-300 font-semibold">Scope ADS Sensitivity ({settings.adsSensitivity.toFixed(2)}x)</span>
              <input
                type="range"
                min={0.2}
                max={1.5}
                step={0.05}
                value={settings.adsSensitivity}
                onChange={(e) => update({ adsSensitivity: Number(e.target.value) })}
                className="w-48 accent-emerald-400"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-semibold">Shooting Fire Mode</span>
              <div className="flex gap-1.5">
                {(['hold', 'tap', 'auto'] as const).map((fm) => (
                  <button
                    key={fm}
                    onClick={() => update({ fireMode: fm })}
                    className={`px-3 py-1 rounded uppercase font-bold cursor-pointer ${
                      settings.fireMode === fm ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {fm}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-slate-300 font-semibold">Show On-Screen Mobile Touch Controls</span>
              <input
                type="checkbox"
                checked={settings.showMobileControls}
                onChange={(e) => update({ showMobileControls: e.target.checked })}
                className="accent-orange-500"
              />
            </label>
          </div>

          {/* Language & Privacy / Security */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="font-black uppercase text-amber-400 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Language, Privacy & Account Security
            </h3>
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-semibold">Interface Language</span>
              <select
                value={settings.language}
                onChange={(e) => update({ language: e.target.value as PlayerSettings['language'] })}
                className="bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-white"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="pt">Português</option>
              </select>
            </div>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-slate-300 font-semibold">Show Online Status to Friends</span>
              <input
                type="checkbox"
                checked={privacyShowOnline}
                onChange={(e) => onUpdatePrivacy(e.target.checked, privacyAllowInvites)}
                className="accent-orange-500"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-slate-300 font-semibold">Allow Squad Invitations</span>
              <input
                type="checkbox"
                checked={privacyAllowInvites}
                onChange={(e) => onUpdatePrivacy(privacyShowOnline, e.target.checked)}
                className="accent-orange-500"
              />
            </label>

            <div className="pt-2 border-t border-slate-800 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-slate-200 font-bold uppercase">
                    Session Provider: <span className="text-cyan-400">{authProvider}</span>
                  </div>
                  {userEmail && <div className="text-slate-400 font-mono text-[11px]">{userEmail}</div>}
                </div>
                <div className="flex items-center gap-2">
                  {authProvider === 'password' && userEmail && (
                    <button
                      onClick={handleResetPassword}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-cyan-300 font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" /> Reset Password
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onClose();
                      onLogout();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/35 border border-red-500/50 text-red-300 font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              </div>
              {secNotice && (
                <div className="p-2 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {secNotice}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
