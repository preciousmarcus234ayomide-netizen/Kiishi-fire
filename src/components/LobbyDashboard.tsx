import React, { useEffect, useState } from 'react';
import {
  Bell,
  ChevronDown,
  ChevronUp,
  Coins,
  Crown,
  Crosshair,
  Gem,
  Gift,
  Play,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import {
  DAILY_LOGIN_REWARDS,
  GAME_MODES,
  TRANSLATIONS,
  xpForLevel,
} from '../game/catalog';
import { soundEngine } from '../game/audio';
import { ADMIN_EMAIL, auth } from '../services/firebase';
import {
  FriendshipRecord,
  GameEventRecord,
  markNotificationRead,
  NotificationRecord,
  PlayerSettings,
  recordTransactionAndPurchase,
  updatePrivateSettings,
  updateUserProfileFields,
  UserProfile,
} from '../services/gameDb';
import { Lobby3DStage } from './Lobby3DStage';
import { ArmoryModal } from './ArmoryModal';
import { CharacterModal } from './CharacterModal';
import { StoreModal } from './StoreModal';
import { PassMissionsModal } from './PassMissionsModal';
import { SocialDrawer } from './SocialDrawer';
import { SettingsModal } from './SettingsModal';
import { AdminDashboard } from './AdminDashboard';
import { getFallbackAvatar } from '../game/avatars';

interface LobbyDashboardProps {
  profile: UserProfile;
  isLocalGuest: boolean;
  authProvider: 'google' | 'password' | 'guest';
  userEmail?: string;
  settings: PlayerSettings;
  privacyShowOnline: boolean;
  privacyAllowInvites: boolean;
  friends: FriendshipRecord[];
  notifications: NotificationRecord[];
  events: GameEventRecord[];
  chatMessages: Array<{ id: string; senderName: string; text: string }>;
  onlineCount: number;
  onStartMatch: (mode: string, roomCode?: string) => void;
  onSendLobbyChat: (text: string) => void;
  onUpdateSettings: (next: PlayerSettings) => void;
  onLocalProfileUpdate: (updater: (p: UserProfile) => UserProfile) => void;
  onLogout: () => void;
}

export const LobbyDashboard: React.FC<LobbyDashboardProps> = ({
  profile,
  isLocalGuest,
  authProvider,
  userEmail,
  settings,
  privacyShowOnline,
  privacyAllowInvites,
  friends,
  notifications,
  events,
  chatMessages,
  onlineCount,
  onStartMatch,
  onSendLobbyChat,
  onUpdateSettings,
  onLocalProfileUpdate,
  onLogout,
}) => {
  const [selectedMode, setSelectedMode] = useState<string>('br_solo');
  const [customCode, setCustomCode] = useState('');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [activeEmote, setActiveEmote] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  const [modal, setModal] = useState<
    null | 'armory' | 'characters' | 'store' | 'pass' | 'leaderboard' | 'social' | 'settings' | 'admin'
  >(null);

  const t = TRANSLATIONS[settings.language] || TRANSLATIONS.en;
  const isAdmin =
    !isLocalGuest &&
    auth.currentUser?.email === ADMIN_EMAIL &&
    auth.currentUser?.emailVerified === true;

  const xpCap = xpForLevel(profile.level || 1);
  const xpPct = Math.min(100, Math.round(((profile.xp || 0) / xpCap) * 100));
  const unreadNotifs = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    soundEngine.setVolumes(settings.sfxVolume, settings.musicVolume, settings.muted);
    soundEngine.startLobbyPulse();
    return () => soundEngine.stopLobbyPulse();
  }, [settings.sfxVolume, settings.musicVolume, settings.muted]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        if (document.activeElement?.tagName !== 'INPUT') {
          setDockCollapsed((c) => !c);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const triggerEmote = (emoteId: string) => {
    soundEngine.playUiClick();
    setActiveEmote(emoteId);
    setTimeout(() => setActiveEmote(null), 2600);
  };

  const applyProfilePatch = async (patch: Partial<UserProfile>) => {
    if (isLocalGuest) {
      onLocalProfileUpdate((p) => ({ ...p, ...patch }));
    } else {
      await updateUserProfileFields(profile.uid, patch);
    }
  };

  const handleUnlockItem = async (
    itemId: string,
    name: string,
    currency: 'gold' | 'diamonds',
    price: number,
  ) => {
    if (currency === 'gold' && profile.gold < price) return;
    if (currency === 'diamonds' && profile.diamonds < price) return;
    soundEngine.playUiClick();
    if (isLocalGuest) {
      onLocalProfileUpdate((p) => ({
        ...p,
        gold: currency === 'gold' ? p.gold - price : p.gold,
        diamonds: currency === 'diamonds' ? p.diamonds - price : p.diamonds,
        unlockedItems: Array.from(new Set([...(p.unlockedItems || []), itemId])),
      }));
    } else {
      await recordTransactionAndPurchase(profile, {
        itemId,
        itemName: name,
        currency,
        amount: price,
        unlockItemIds: [itemId],
      });
    }
  };

  const handleClaimDaily = async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    if (profile.lastLoginClaimDay === todayStr) return;
    const streakIdx = (profile.dailyStreak || 0) % 7;
    const reward = DAILY_LOGIN_REWARDS[streakIdx];
    soundEngine.playHeal();
    await applyProfilePatch({
      gold: profile.gold + reward.gold,
      diamonds: profile.diamonds + reward.diamonds,
      dailyStreak: (profile.dailyStreak || 0) + 1,
      lastLoginClaimDay: todayStr,
    });
  };

  const handleClaimMission = async (missionId: string, gold: number, xp: number) => {
    soundEngine.playHeal();
    let nextXp = (profile.xp || 0) + xp;
    let nextLevel = profile.level || 1;
    while (nextXp >= xpForLevel(nextLevel)) {
      nextXp -= xpForLevel(nextLevel);
      nextLevel += 1;
    }
    await applyProfilePatch({
      gold: profile.gold + gold,
      xp: nextXp,
      level: nextLevel,
      claimedMissions: Array.from(new Set([...(profile.claimedMissions || []), missionId])),
    });
  };

  const handleUpgradeCharacter = async (charId: string) => {
    const cur = profile.characterLevels?.[charId] || 1;
    const cost = cur * 600;
    if (cur >= 5 || profile.gold < cost) return;
    soundEngine.playHeal();
    await applyProfilePatch({
      gold: profile.gold - cost,
      characterLevels: { ...(profile.characterLevels || {}), [charId]: cur + 1 },
    });
  };

  const currentModeObj = GAME_MODES.find((m) => m.id === selectedMode) || GAME_MODES[0];

  return (
    <div className="fixed inset-0 bg-[#07090F] overflow-hidden">
      {/* Unobstructed 3D Character Lobby Stage */}
      <Lobby3DStage
        characterId={profile.selectedCharacter}
        weaponId={profile.selectedWeapon}
        weaponSkinId={settings.equippedSkins?.[profile.selectedWeapon]}
        outfitId={profile.equippedOutfit}
        hairId={profile.equippedHair}
        accessoryId={profile.equippedAccessory}
        activeEmote={activeEmote}
        cameraPreset={modal === 'armory' ? 'armory' : 'hero'}
      />

      {/* Perimeter HUD (No side cards covering the character; no backdrop-filter over WebGL) */}
      <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-3 sm:p-5">
        {/* TOP PERIMETER ROW */}
        <div className="flex items-start justify-between gap-3">
          {/* Top-Left: Player Card */}
          <button
            onClick={() => {
              soundEngine.playUiClick();
              setModal('social');
            }}
            className="pointer-events-auto flex items-center gap-3 bg-[#0B101D]/92 hover:bg-[#111829] border border-slate-700/90 rounded-2xl px-3.5 py-2.5 shadow-xl transition cursor-pointer text-left"
          >
            <img
              src={profile.avatarUrl || getFallbackAvatar(profile.username)}
              alt=""
              className="w-11 h-11 rounded-xl border border-orange-500/70 object-cover bg-slate-800"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-white">{profile.username}</span>
                <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[10px] font-black uppercase">
                  {profile.rankTier}
                </span>
              </div>
              <div className="text-[11px] font-mono text-cyan-400">
                {profile.playerId} · LV.{profile.level}
              </div>
              <div className="mt-1 h-1.5 w-32 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500" style={{ width: `${xpPct}%` }} />
              </div>
            </div>
          </button>

          {/* Top-Right: Currencies & Utility Cluster */}
          <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
            {/* Currencies */}
            <div className="flex items-center gap-3 bg-[#0B101D]/92 border border-slate-700/90 rounded-xl px-3.5 py-2 text-xs font-black tabular-nums shadow-lg">
              <span className="flex items-center gap-1.5 text-amber-400">
                <Coins className="w-4 h-4" /> {profile.gold.toLocaleString()}
              </span>
              <div className="w-px h-4 bg-slate-700" />
              <span className="flex items-center gap-1.5 text-sky-400">
                <Gem className="w-4 h-4" /> {profile.diamonds.toLocaleString()}
              </span>
            </div>

            {/* Online Players Count */}
            <div className="hidden md:flex items-center gap-1.5 bg-[#0B101D]/92 border border-slate-700/90 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 tabular-nums">
              <span>{onlineCount} Online</span>
            </div>

            {/* Quick Action Icons */}
            <button
              onClick={() => {
                soundEngine.playUiClick();
                setModal('pass');
              }}
              title="Daily Rewards"
              className="p-2.5 rounded-xl bg-[#0B101D]/92 hover:bg-slate-800 border border-slate-700 text-amber-400 cursor-pointer"
            >
              <Gift className="w-4 h-4" />
            </button>

            <div className="relative">
              <button
                onClick={() => {
                  soundEngine.playUiClick();
                  setShowNotifications((s) => !s);
                }}
                title="Notifications"
                className="p-2.5 rounded-xl bg-[#0B101D]/92 hover:bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer relative"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifs > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
                    {unreadNotifs}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-72 bg-[#0E1422] border border-slate-700 rounded-xl p-3 shadow-2xl z-30 space-y-2">
                  <div className="text-xs font-black uppercase text-slate-400">Notifications</div>
                  {notifications.length === 0 ? (
                    <div className="text-xs text-slate-500">All caught up!</div>
                  ) : (
                    notifications.slice(0, 5).map((n) => (
                      <div
                        key={n.id}
                        className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs flex flex-col gap-1"
                      >
                        <div className="font-bold text-white">{n.title}</div>
                        <div className="text-slate-400">{n.message}</div>
                        <div className="flex gap-2 mt-1">
                          {n.roomCode && (
                            <button
                              onClick={() => {
                                setShowNotifications(false);
                                markNotificationRead(n.id);
                                onStartMatch('custom', n.roomCode);
                              }}
                              className="px-2 py-1 rounded bg-orange-500 text-slate-950 font-black text-[10px] cursor-pointer"
                            >
                              Join Room {n.roomCode}
                            </button>
                          )}
                          {!n.read && (
                            <button
                              onClick={() => markNotificationRead(n.id)}
                              className="text-[10px] text-cyan-400 cursor-pointer"
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                soundEngine.playUiClick();
                setModal('social');
              }}
              title={t.friends}
              className="p-2.5 rounded-xl bg-[#0B101D]/92 hover:bg-slate-800 border border-slate-700 text-cyan-400 cursor-pointer"
            >
              <Users className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                soundEngine.playUiClick();
                setModal('settings');
              }}
              title={t.settings}
              className="p-2.5 rounded-xl bg-[#0B101D]/92 hover:bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>

            {isAdmin && (
              <button
                onClick={() => {
                  soundEngine.playUiClick();
                  setModal('admin');
                }}
                className="px-3 py-2 rounded-xl bg-red-600/90 hover:bg-red-500 text-white text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer"
              >
                <ShieldAlert className="w-4 h-4" /> {t.admin}
              </button>
            )}
          </div>
        </div>

        {/* BOTTOM COLLAPSIBLE CONTROL DOCK */}
        <div className="flex flex-col items-center">
          <button
            onClick={() => setDockCollapsed((c) => !c)}
            className="pointer-events-auto mb-1.5 px-3 py-1 rounded-t-lg bg-[#0B101D]/92 border border-b-0 border-slate-700/80 text-[11px] font-bold text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" /> Show Controls (H)
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" /> Hide Controls (H)
              </>
            )}
          </button>

          {!dockCollapsed && (
            <div className="pointer-events-auto w-full max-w-[940px] bg-[#0B101D]/94 border border-slate-700/90 rounded-2xl p-3 shadow-2xl space-y-2.5">
              {/* Row 1: Mode Selector + Deploy CTA */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {GAME_MODES.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        soundEngine.playUiClick();
                        setSelectedMode(m.id);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        selectedMode === m.id
                          ? 'bg-orange-500 text-slate-950 font-black'
                          : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                      }`}
                    >
                      {m.name.replace('Battle Royale — ', 'BR ')}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  {selectedMode === 'custom' && (
                    <input
                      value={customCode}
                      onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                      placeholder="ROOM CODE (optional)"
                      maxLength={8}
                      className="w-36 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs font-mono text-white focus:border-orange-500 focus:outline-none"
                    />
                  )}
                  <button
                    onClick={() => {
                      soundEngine.unlock();
                      soundEngine.playUiClick();
                      onStartMatch(selectedMode, selectedMode === 'custom' ? customCode || undefined : undefined);
                    }}
                    className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-orange-500/20 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    {t.deploy}
                  </button>
                </div>
              </div>

              {/* Row 2: Dock Navigation + Emote Preview */}
              <div className="pt-2 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => {
                      soundEngine.playUiClick();
                      setModal('armory');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Crosshair className="w-3.5 h-3.5 text-orange-400" /> {t.armory}
                  </button>
                  <button
                    onClick={() => {
                      soundEngine.playUiClick();
                      setModal('characters');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> {t.characters}
                  </button>
                  <button
                    onClick={() => {
                      soundEngine.playUiClick();
                      setModal('store');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 text-amber-400" /> {t.store}
                  </button>
                  <button
                    onClick={() => {
                      soundEngine.playUiClick();
                      setModal('pass');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Crown className="w-3.5 h-3.5 text-emerald-400" /> {t.pass}
                  </button>
                  <button
                    onClick={() => {
                      soundEngine.playUiClick();
                      setModal('leaderboard');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trophy className="w-3.5 h-3.5 text-yellow-400" /> {t.leaderboard}
                  </button>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="hidden sm:inline">{currentModeObj.subtitle}</span>
                  <button
                    onClick={() => triggerEmote(profile.equippedEmote || 'emote_salute')}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold cursor-pointer"
                  >
                    Emote
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {modal === 'armory' && (
        <ArmoryModal
          profile={profile}
          equippedSkins={settings.equippedSkins || {}}
          equippedAttachments={settings.equippedAttachments || []}
          onClose={() => setModal(null)}
          onEquipWeapon={(weaponId) => applyProfilePatch({ selectedWeapon: weaponId })}
          onEquipSkin={(weaponId, skinId) => {
            const nextSkins = { ...(settings.equippedSkins || {}) };
            if (skinId) nextSkins[weaponId] = skinId;
            else delete nextSkins[weaponId];
            const nextSettings = { ...settings, equippedSkins: nextSkins };
            onUpdateSettings(nextSettings);
            if (!isLocalGuest) {
              updatePrivateSettings(profile.uid, { settings: nextSettings });
            }
          }}
          onToggleAttachment={(attachmentId) => {
            const cur = settings.equippedAttachments || [];
            const nextAtts = cur.includes(attachmentId)
              ? cur.filter((id) => id !== attachmentId)
              : [...cur, attachmentId];
            const nextSettings = { ...settings, equippedAttachments: nextAtts };
            onUpdateSettings(nextSettings);
            if (!isLocalGuest) {
              updatePrivateSettings(profile.uid, { settings: nextSettings });
            }
          }}
          onUnlockItem={handleUnlockItem}
        />
      )}

      {modal === 'characters' && (
        <CharacterModal
          profile={profile}
          onClose={() => setModal(null)}
          onSelectCharacter={(charId) => applyProfilePatch({ selectedCharacter: charId })}
          onUpgradeCharacter={handleUpgradeCharacter}
          onEquipCosmetic={(slot, id) => {
            if (slot === 'outfit') applyProfilePatch({ equippedOutfit: id });
            else if (slot === 'hair') applyProfilePatch({ equippedHair: id });
            else if (slot === 'accessory') applyProfilePatch({ equippedAccessory: id });
            else if (slot === 'emote') {
              applyProfilePatch({ equippedEmote: id });
              triggerEmote(id);
            }
          }}
          onUnlockItem={handleUnlockItem}
        />
      )}

      {modal === 'store' && (
        <StoreModal
          profile={profile}
          isLocalGuest={isLocalGuest}
          onLocalProfileUpdate={onLocalProfileUpdate}
          onClose={() => setModal(null)}
        />
      )}

      {(modal === 'pass' || modal === 'leaderboard') && (
        <PassMissionsModal
          profile={profile}
          events={events}
          initialTab={modal === 'leaderboard' ? 'leaderboard' : 'daily'}
          onClaimDaily={handleClaimDaily}
          onClaimMission={handleClaimMission}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'social' && (
        <SocialDrawer
          profile={profile}
          isLocalGuest={isLocalGuest}
          friends={friends}
          chatMessages={chatMessages}
          onSendLobbyChat={onSendLobbyChat}
          onLogout={onLogout}
          onLocalProfileUpdate={onLocalProfileUpdate}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'settings' && (
        <SettingsModal
          settings={settings}
          privacyShowOnline={privacyShowOnline}
          privacyAllowInvites={privacyAllowInvites}
          authProvider={authProvider}
          userEmail={userEmail}
          onUpdateSettings={(next) => {
            onUpdateSettings(next);
            if (!isLocalGuest) {
              updatePrivateSettings(profile.uid, { settings: next });
            }
          }}
          onUpdatePrivacy={(showOnline, allowInvites) => {
            if (!isLocalGuest) {
              updatePrivateSettings(profile.uid, {
                privacyShowOnline: showOnline,
                privacyAllowInvites: allowInvites,
              });
            }
          }}
          onLogout={onLogout}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'admin' && isAdmin && (
        <AdminDashboard adminUid={profile.uid} onClose={() => setModal(null)} />
      )}
    </div>
  );
};
