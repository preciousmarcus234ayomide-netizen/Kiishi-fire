import React, { useEffect, useState } from 'react';
import { X, Trophy, Gift, Target, Calendar, Crown } from 'lucide-react';
import {
  BATTLE_PASS_TIERS,
  DAILY_LOGIN_REWARDS,
  MISSIONS_LIST,
} from '../game/catalog';
import { fetchLeaderboard, GameEventRecord, UserProfile } from '../services/gameDb';
import { soundEngine } from '../game/audio';

interface PassMissionsModalProps {
  profile: UserProfile;
  events: GameEventRecord[];
  initialTab?: 'daily' | 'missions' | 'pass' | 'leaderboard';
  onClaimDaily: () => Promise<void>;
  onClaimMission: (missionId: string, gold: number, xp: number) => Promise<void>;
  onClose: () => void;
}

export const PassMissionsModal: React.FC<PassMissionsModalProps> = ({
  profile,
  events,
  initialTab = 'daily',
  onClaimDaily,
  onClaimMission,
  onClose,
}) => {
  const [tab, setTab] = useState<'daily' | 'missions' | 'pass' | 'leaderboard'>(initialTab);
  const [leaders, setLeaders] = useState<UserProfile[]>([]);
  const todayStr = new Date().toISOString().slice(0, 10);
  const dailyClaimedToday = profile.lastLoginClaimDay === todayStr;

  useEffect(() => {
    if (tab === 'leaderboard') {
      fetchLeaderboard()
        .then(setLeaders)
        .catch(() => setLeaders([profile]));
    }
  }, [tab, profile]);

  const stats = profile.stats || { matches: 0, wins: 0, kills: 0, damage: 0, headshots: 0 };
  const claimedSet = new Set(profile.claimedMissions || []);

  return (
    <div className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-[#0C121E] border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[86vh]">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-black uppercase tracking-wider text-white">
              Progression, Battle Pass & Rankings
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-slate-800 flex flex-wrap gap-2">
          {(
            [
              ['daily', 'Daily & Events'],
              ['missions', 'Missions & Achievements'],
              ['pass', 'Battle Pass'],
              ['leaderboard', 'Leaderboard'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                soundEngine.playUiClick();
                setTab(id);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase cursor-pointer ${
                tab === id ? 'bg-orange-500 text-slate-950' : 'bg-slate-900 text-slate-300 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {tab === 'daily' && (
            <>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-black uppercase text-white flex items-center gap-2">
                    <Gift className="w-4 h-4 text-amber-400" /> 7-Day Daily Login Supply
                  </h3>
                  <button
                    disabled={dailyClaimedToday}
                    onClick={onClaimDaily}
                    className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-45 text-slate-950 text-xs font-black uppercase cursor-pointer"
                  >
                    {dailyClaimedToday ? 'Claimed Today' : `Claim Day ${((profile.dailyStreak || 0) % 7) + 1}`}
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
                  {DAILY_LOGIN_REWARDS.map((r) => {
                    const claimed = (profile.dailyStreak || 0) % 7 >= r.day;
                    return (
                      <div
                        key={r.day}
                        className={`p-3 rounded-xl border text-center ${
                          claimed
                            ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                            : 'bg-slate-900 border-slate-800 text-slate-200'
                        }`}
                      >
                        <div className="text-[10px] font-bold uppercase text-slate-400">Day {r.day}</div>
                        <div className="text-xs font-black mt-1">{r.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black uppercase text-white flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-cyan-400" /> Live Seasonal Events
                </h3>
                {events.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
                    Season 01: Protocol Ember — Ranked Double XP active across Battle Royale & Clash Squad!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {events.map((ev) => (
                      <div key={ev.eventId} className="p-4 rounded-xl bg-slate-900 border border-cyan-500/30">
                        <h4 className="font-black text-white text-sm">{ev.title}</h4>
                        <p className="text-xs text-slate-400 mt-1">{ev.description}</p>
                        <div className="mt-2 text-xs font-bold text-amber-400">
                          Reward: {ev.rewardGold} Gold · {ev.rewardDiamonds} Diamonds
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'missions' && (
            <div className="space-y-3">
              {MISSIONS_LIST.map((m) => {
                const current = Number(stats[m.metric as keyof typeof stats] || 0);
                const pct = Math.min(100, Math.round((current / m.target) * 100));
                const done = current >= m.target;
                const claimed = claimedSet.has(m.id);

                return (
                  <div key={m.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Target className="w-3.5 h-3.5 text-orange-400" />
                        <span className="text-[10px] font-bold uppercase text-cyan-400">{m.type}</span>
                        <h4 className="font-bold text-white text-sm">{m.title}</h4>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{m.desc}</p>
                      <div className="mt-2 h-1.5 w-full max-w-xs bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-bold text-amber-400 mb-1">
                        +{m.rewardGold}G · +{m.rewardXp} XP
                      </div>
                      <button
                        disabled={!done || claimed}
                        onClick={() => onClaimMission(m.id, m.rewardGold, m.rewardXp)}
                        className="px-3.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-slate-950 text-xs font-black uppercase cursor-pointer"
                      >
                        {claimed ? 'Claimed' : done ? 'Claim' : `${current}/${m.target}`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'pass' && (
            <div>
              <div className="p-4 rounded-xl bg-gradient-to-r from-orange-500/20 to-slate-900 border border-orange-500/40 flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs font-black uppercase text-orange-400 flex items-center gap-1.5">
                    <Crown className="w-4 h-4" /> Season 01 Battle Pass · Tier {profile.battlePassLevel || 1}/12
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    {profile.hasElitePass ? 'Elite Pass Unlocked!' : 'Upgrade to Elite Pass in Store for exclusive weapon & outfit drops.'}
                  </div>
                </div>
                <div className="text-sm font-black text-white tabular-nums">
                  {(profile.battlePassXp || 0) % 400} / 400 BP XP
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {BATTLE_PASS_TIERS.map((t) => {
                  const unlockedTier = (profile.battlePassLevel || 1) >= t.tier;
                  return (
                    <div
                      key={t.tier}
                      className={`p-3.5 rounded-xl border ${
                        unlockedTier ? 'bg-slate-900 border-orange-500/60' : 'bg-slate-950/70 border-slate-800 opacity-75'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-black text-white">TIER {t.tier}</span>
                        <span className="text-[10px] font-bold text-emerald-400">
                          {unlockedTier ? 'UNLOCKED' : 'LOCKED'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-300">Free: {t.freeReward}</div>
                      <div className="text-xs font-bold text-amber-400 mt-0.5">
                        Elite: {t.eliteReward}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'leaderboard' && (
            <div className="space-y-2">
              {leaders.map((u, idx) => (
                <div
                  key={u.uid}
                  className={`px-4 py-3 rounded-xl border flex items-center justify-between ${
                    u.uid === profile.uid
                      ? 'bg-orange-500/15 border-orange-500'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center font-black text-amber-400 tabular-nums">#{idx + 1}</span>
                    <div>
                      <div className="font-bold text-white text-sm">{u.username}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{u.playerId} · Lv.{u.level}</div>
                    </div>
                  </div>
                  <div className="text-right tabular-nums">
                    <div className="text-xs font-black text-cyan-400">{u.rankTier}</div>
                    <div className="text-xs text-slate-300">{u.rankPoints} RP · {u.stats?.wins || 0} Wins</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
