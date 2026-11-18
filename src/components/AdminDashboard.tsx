import React, { useEffect, useState } from 'react';
import { X, ShieldAlert, Users, Activity, DollarSign, CalendarPlus, Ban, CheckCircle } from 'lucide-react';
import {
  adminCreateEvent,
  adminFetchAllUsers,
  adminFetchEvents,
  adminFetchReports,
  adminFetchTransactions,
  adminGrantCurrency,
  adminResolveReport,
  adminSaveGameConfig,
  adminSetUserBan,
  adminToggleEventActive,
  GameEventRecord,
  ReportRecord,
  TransactionRecord,
  UserProfile,
} from '../services/gameDb';
import { WEAPONS } from '../game/catalog';

interface AdminDashboardProps {
  adminUid: string;
  onClose: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ adminUid, onClose }) => {
  const [tab, setTab] = useState<'overview' | 'players' | 'reports' | 'events' | 'transactions' | 'balance'>('overview');
  const [stats, setStats] = useState<{
    connectedPlayers: number;
    activeRoomsCount: number;
    totalMatchesPlayed: number;
    uptimeSec: number;
    rooms: Array<{ id: string; code: string; mode: string; phase: string; alive: number; humans: number; eliminations: number }>;
  } | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [eventsList, setEventsList] = useState<GameEventRecord[]>([]);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventGold, setEventGold] = useState(500);
  const [eventDia, setEventDia] = useState(25);
  const [akDmg, setAkDmg] = useState(WEAPONS.ak47_ember.damage);
  const [awmDmg, setAwmDmg] = useState(WEAPONS.awm_frost.damage);
  const [scarDmg, setScarDmg] = useState(WEAPONS.scar_vanguard.damage);
  const [mp40Dmg, setMp40Dmg] = useState(WEAPONS.mp40_neon.damage);
  const [notice, setNotice] = useState('');

  const refreshData = async () => {
    try {
      const [statsRes, balRes] = await Promise.all([
        fetch('/api/admin/server-stats'),
        fetch('/api/admin/balance'),
      ]);
      setStats(await statsRes.json());
      const bal = await balRes.json();
      if (bal?.weaponDamage) {
        if (bal.weaponDamage.ak47_ember) setAkDmg(bal.weaponDamage.ak47_ember);
        if (bal.weaponDamage.awm_frost) setAwmDmg(bal.weaponDamage.awm_frost);
        if (bal.weaponDamage.scar_vanguard) setScarDmg(bal.weaponDamage.scar_vanguard);
        if (bal.weaponDamage.mp40_neon) setMp40Dmg(bal.weaponDamage.mp40_neon);
      }
    } catch {
      // ignore
    }
    try {
      const [u, r, t, ev] = await Promise.all([
        adminFetchAllUsers(),
        adminFetchReports(),
        adminFetchTransactions(),
        adminFetchEvents(),
      ]);
      setUsers(u);
      setReports(r);
      setTransactions(t);
      setEventsList(ev);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/82 flex items-center justify-center p-4">
      <div className="max-w-5xl w-full bg-[#090E19] border border-red-500/40 rounded-2xl shadow-2xl flex flex-col max-h-[88vh]">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            <h2 className="text-lg font-black uppercase tracking-wider text-white">
              Emberfall Command — Admin HQ
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-slate-800 flex flex-wrap gap-1.5">
          {(
            [
              ['overview', 'Live Server Stats'],
              ['players', 'Player Accounts'],
              ['reports', 'Anti-Cheat Reports'],
              ['events', 'Events & Rewards'],
              ['transactions', 'Transactions'],
              ['balance', 'Weapons Balance'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase cursor-pointer ${
                tab === id ? 'bg-red-500 text-white' : 'bg-slate-900 text-slate-300 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {notice && (
          <div className="mx-6 mt-3 p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> {notice}
          </div>
        )}

        <div className="p-6 overflow-y-auto flex-1">
          {tab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
                {[
                  ['Connected Sockets', stats?.connectedPlayers || 0, Activity],
                  ['Active Match Rooms', stats?.activeRoomsCount || 0, Users],
                  ['Matches Played', stats?.totalMatchesPlayed || 0, Activity],
                  ['Registered Accounts', users.length, DollarSign],
                ].map(([lbl, val, Icon]) => {
                  const Ic = Icon as React.ElementType;
                  return (
                    <div key={String(lbl)} className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{String(lbl)}</span>
                        <Ic className="w-4 h-4 text-orange-400" />
                      </div>
                      <div className="text-2xl font-black text-white mt-1">{String(val)}</div>
                    </div>
                  );
                })}
              </div>

              <div>
                <h3 className="text-xs font-black uppercase text-slate-400 mb-2">Active Authoritative Match Servers</h3>
                {!stats || stats.rooms.length === 0 ? (
                  <p className="text-xs text-slate-500">No active battle rooms right now.</p>
                ) : (
                  <div className="space-y-2">
                    {stats.rooms.map((r) => (
                      <div key={r.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-black text-orange-400">ROOM {r.code}</span>
                          <span className="text-slate-400 ml-2 uppercase">{r.mode} · {r.phase}</span>
                        </div>
                        <div className="tabular-nums text-slate-300">
                          {r.humans} Humans · {r.alive} Alive · {r.eliminations} Eliminations
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'players' && (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.uid} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-black text-white">
                      {u.username} <span className="text-cyan-400 font-mono ml-1">{u.playerId}</span>
                      {u.banned && <span className="ml-2 px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px]">BANNED</span>}
                    </div>
                    <div className="text-slate-400 tabular-nums">
                      Lv.{u.level} · {u.rankTier} ({u.rankPoints} RP) · {u.gold}G · {u.diamonds} Dia
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        await adminGrantCurrency(u.uid, u.gold + 1000, u.diamonds + 50);
                        flash(`Granted +1000G / +50 Dia to ${u.username}`);
                        refreshData();
                      }}
                      className="px-2.5 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 font-bold cursor-pointer"
                    >
                      +1000G / +50D
                    </button>
                    <button
                      onClick={async () => {
                        await adminSetUserBan(u.uid, !u.banned, !u.banned ? 'Anti-Cheat Violation' : '');
                        flash(`${!u.banned ? 'Banned' : 'Unbanned'} ${u.username}`);
                        refreshData();
                      }}
                      className={`px-2.5 py-1.5 rounded font-bold flex items-center gap-1 cursor-pointer ${
                        u.banned
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-red-500/20 hover:bg-red-500/35 text-red-300'
                      }`}
                    >
                      <Ban className="w-3.5 h-3.5" /> {u.banned ? 'Unban' : 'Ban'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'reports' && (
            <div className="space-y-2.5">
              {reports.length === 0 && <p className="text-xs text-slate-500">No player reports submitted yet.</p>}
              {reports.map((r) => (
                <div key={r.reportId} className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <div className="font-black text-white">
                      Target: {r.targetUsername} <span className="text-red-400 uppercase ml-1">[{r.reason}]</span>
                    </div>
                    <p className="text-slate-400 mt-0.5">{r.details || 'No additional notes'}</p>
                    <span className="text-[10px] uppercase text-cyan-400">Status: {r.status}</span>
                  </div>
                  {r.status === 'open' && (
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          await adminResolveReport(r.reportId, 'banned');
                          await adminSetUserBan(r.targetPlayerId, true, `Report: ${r.reason}`).catch(() => {});
                          flash(`Banned ${r.targetUsername}`);
                          refreshData();
                        }}
                        className="px-3 py-1.5 rounded bg-red-600 text-white font-bold cursor-pointer"
                      >
                        Ban Account
                      </button>
                      <button
                        onClick={async () => {
                          await adminResolveReport(r.reportId, 'dismissed');
                          flash('Report dismissed');
                          refreshData();
                        }}
                        className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 font-bold cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'events' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!eventTitle.trim()) return;
                  await adminCreateEvent(adminUid, eventTitle.trim(), eventDesc.trim(), eventGold, eventDia);
                  setEventTitle('');
                  setEventDesc('');
                  flash('Live seasonal event published to all players!');
                  refreshData();
                }}
                className="space-y-3"
              >
                <h3 className="font-black uppercase text-cyan-400 flex items-center gap-1.5">
                  <CalendarPlus className="w-4 h-4" /> Launch New Live Event
                </h3>
                <input
                  required
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="Event Title (e.g., Volcanic Double XP Weekend)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
                <textarea
                  required
                  value={eventDesc}
                  onChange={(e) => setEventDesc(e.target.value)}
                  placeholder="Event description & milestone rules..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white h-20"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Reward Gold</label>
                    <input
                      type="number"
                      value={eventGold}
                      onChange={(e) => setEventGold(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Reward Diamonds</label>
                    <input
                      type="number"
                      value={eventDia}
                      onChange={(e) => setEventDia(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-black uppercase cursor-pointer"
                >
                  Publish Event
                </button>
              </form>

              <div className="space-y-2">
                <h3 className="font-black uppercase text-slate-400">Published Events ({eventsList.length})</h3>
                {eventsList.length === 0 && <p className="text-slate-500">No events published yet.</p>}
                {eventsList.map((ev) => (
                  <div key={ev.eventId} className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-black text-white">{ev.title}</div>
                      <div className="text-slate-400">{ev.rewardGold}G · {ev.rewardDiamonds} Dia</div>
                    </div>
                    <button
                      onClick={async () => {
                        await adminToggleEventActive(ev.eventId, !ev.active);
                        flash(`Event "${ev.title}" ${!ev.active ? 'activated' : 'paused'}.`);
                        refreshData();
                      }}
                      className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                        ev.active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {ev.active ? 'Active' : 'Paused'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'transactions' && (
            <div className="space-y-2">
              {transactions.length === 0 && <p className="text-xs text-slate-500">No store transactions recorded yet.</p>}
              {transactions.map((tx) => (
                <div key={tx.txId} className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-white">{tx.username}</span>
                    <span className="text-slate-400 ml-2">{tx.itemName}</span>
                  </div>
                  <div className="font-black text-emerald-400 tabular-nums">
                    {tx.amount} {tx.currency.toUpperCase()} · {tx.status}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'balance' && (
            <div className="max-w-md space-y-4 text-xs">
              <p className="text-slate-400">Adjust live weapon damage across both Firestore gameConfig and the real-time match server.</p>
              <div>
                <label className="block text-slate-300 mb-1">AK-47 Ember Base Damage ({akDmg})</label>
                <input
                  type="range"
                  min={22}
                  max={50}
                  value={akDmg}
                  onChange={(e) => setAkDmg(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">SCAR-V Vanguard Base Damage ({scarDmg})</label>
                <input
                  type="range"
                  min={20}
                  max={45}
                  value={scarDmg}
                  onChange={(e) => setScarDmg(Number(e.target.value))}
                  className="w-full accent-emerald-400"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">MP40 Neon Fang Base Damage ({mp40Dmg})</label>
                <input
                  type="range"
                  min={14}
                  max={35}
                  value={mp40Dmg}
                  onChange={(e) => setMp40Dmg(Number(e.target.value))}
                  className="w-full accent-purple-400"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">AWM Frostbite Base Damage ({awmDmg})</label>
                <input
                  type="range"
                  min={70}
                  max={130}
                  value={awmDmg}
                  onChange={(e) => setAwmDmg(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
              <button
                onClick={async () => {
                  const weapons = {
                    ak47_ember: akDmg,
                    scar_vanguard: scarDmg,
                    mp40_neon: mp40Dmg,
                    awm_frost: awmDmg,
                  };
                  await Promise.all([
                    adminSaveGameConfig(adminUid, weapons, {}),
                    fetch('/api/admin/balance', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ weapons }),
                    }),
                  ]);
                  flash('Live weapon balance pushed to Server & Firestore!');
                }}
                className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-black uppercase cursor-pointer"
              >
                Save Live Config
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
