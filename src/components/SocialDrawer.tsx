import React, { useState } from 'react';
import {
  X,
  Users,
  UserPlus,
  Send,
  Check,
  XCircle,
  MessageSquare,
  LogOut,
  Upload,
} from 'lucide-react';
import {
  findPlayerByCode,
  FriendshipRecord,
  respondFriendRequest,
  sendFriendRequest,
  sendSquadInvite,
  updateUserProfileFields,
  UserProfile,
} from '../services/gameDb';
import { soundEngine } from '../game/audio';
import { getFallbackAvatar } from '../game/avatars';

interface SocialDrawerProps {
  profile: UserProfile;
  isLocalGuest: boolean;
  friends: FriendshipRecord[];
  chatMessages: Array<{ id: string; senderName: string; text: string }>;
  onSendLobbyChat: (text: string) => void;
  onLogout: () => void;
  onLocalProfileUpdate: (updater: (p: UserProfile) => UserProfile) => void;
  onClose: () => void;
}

export const SocialDrawer: React.FC<SocialDrawerProps> = ({
  profile,
  isLocalGuest,
  friends,
  chatMessages,
  onSendLobbyChat,
  onLogout,
  onLocalProfileUpdate,
  onClose,
}) => {
  const [tab, setTab] = useState<'friends' | 'chat' | 'profile'>('friends');
  const [searchCode, setSearchCode] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [newUsername, setNewUsername] = useState(profile.username);
  const [profileMsg, setProfileMsg] = useState('');

  const acceptedFriends = friends.filter((f) => f.status === 'accepted');
  const pendingIncoming = friends.filter((f) => f.status === 'pending' && f.recipientId === profile.uid);

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchCode.trim() || isLocalGuest) {
      setSearchStatus(isLocalGuest ? 'Sign in with Google or Email to add persistent friends.' : '');
      return;
    }
    setSearchStatus('Searching...');
    const target = await findPlayerByCode(searchCode);
    if (!target) {
      setSearchStatus('No player found with that ID.');
      return;
    }
    if (target.uid === profile.uid) {
      setSearchStatus('You cannot add yourself.');
      return;
    }
    await sendFriendRequest(profile, target);
    setSearchStatus(`Friend request sent to ${target.username}!`);
    setSearchCode('');
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 96;
        canvas.height = 96;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 96, 96);
          const url = canvas.toDataURL('image/jpeg', 0.72);
          if (isLocalGuest) {
            onLocalProfileUpdate((p) => ({ ...p, avatarUrl: url }));
          } else {
            await updateUserProfileFields(profile.uid, { avatarUrl: url });
          }
          setProfileMsg('Profile picture updated!');
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newUsername.trim().slice(0, 24);
    if (clean.length < 2) return;
    if (isLocalGuest) {
      onLocalProfileUpdate((p) => ({ ...p, username: clean }));
    } else {
      await updateUserProfileFields(profile.uid, { username: clean });
    }
    setProfileMsg('Callsign saved!');
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-[#0C121E] border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[84vh]">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-black uppercase tracking-wider text-white">Squad, Chat & Profile</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-slate-800 flex gap-2">
          {(
            [
              ['friends', `Friends (${acceptedFriends.length})`],
              ['chat', 'World & Squad Chat'],
              ['profile', 'Account Profile'],
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

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {tab === 'friends' && (
            <>
              <form onSubmit={handleAddFriend} className="flex gap-2">
                <input
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  placeholder="Enter Player ID (e.g., EFR-8X4K2M)"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Add
                </button>
              </form>
              {searchStatus && <div className="text-xs text-cyan-300">{searchStatus}</div>}

              {pendingIncoming.length > 0 && (
                <div>
                  <h4 className="text-xs font-black uppercase text-amber-400 mb-2">Pending Requests</h4>
                  <div className="space-y-2">
                    {pendingIncoming.map((req) => (
                      <div key={req.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                        <span className="text-sm font-bold text-white">{req.requesterName}</span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => respondFriendRequest(req.id, 'accepted')}
                            className="p-1.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/35 cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => respondFriendRequest(req.id, 'declined')}
                            className="p-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/35 cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-black uppercase text-slate-400 mb-2">Squad Roster</h4>
                {acceptedFriends.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Share your Player ID (<span className="text-cyan-400 font-mono">{profile.playerId}</span>) with squadmates to team up in Duo/Squad or Custom Rooms.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {acceptedFriends.map((f) => {
                      const friendUid = f.requesterId === profile.uid ? f.recipientId : f.requesterId;
                      const friendName = f.requesterId === profile.uid ? f.recipientName : f.requesterName;
                      return (
                        <div key={f.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                          <span className="text-sm font-bold text-white">{friendName}</span>
                          <button
                            onClick={async () => {
                              const code = Math.random().toString(36).slice(2, 8).toUpperCase();
                              await sendSquadInvite(profile, friendUid, code);
                              setSearchStatus(`Squad invite (Room ${code}) sent to ${friendName}!`);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-black uppercase cursor-pointer"
                          >
                            Invite Squad
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'chat' && (
            <div className="flex flex-col h-80">
              <div className="flex-1 bg-slate-950/70 border border-slate-800 rounded-xl p-3 overflow-y-auto space-y-2 mb-3">
                {chatMessages.length === 0 && (
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" /> Live WebSocket lobby channel connected. Say hello to other survivors!
                  </div>
                )}
                {chatMessages.map((m) => (
                  <div key={m.id} className="text-xs">
                    <span className="font-bold text-orange-400">{m.senderName}: </span>
                    <span className="text-slate-200">{m.text}</span>
                  </div>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!chatInput.trim()) return;
                  onSendLobbyChat(chatInput.trim());
                  setChatInput('');
                }}
                className="flex gap-2"
              >
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Broadcast to Emberfall lobby..."
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-orange-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-black uppercase flex items-center gap-1 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" /> Send
                </button>
              </form>
            </div>
          )}

          {tab === 'profile' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
                <img
                  src={profile.avatarUrl || getFallbackAvatar(profile.username)}
                  alt=""
                  className="w-14 h-14 rounded-xl border border-orange-500 object-cover bg-slate-800"
                />
                <div className="flex-1">
                  <div className="text-sm font-black text-white">{profile.username}</div>
                  <div className="text-xs font-mono text-cyan-400">{profile.playerId}</div>
                </div>
                <label className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold cursor-pointer flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> Change Avatar
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                </label>
              </div>

              <form onSubmit={handleSaveUsername} className="flex gap-2">
                <input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  minLength={2}
                  maxLength={24}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-black uppercase cursor-pointer"
                >
                  Save Callsign
                </button>
              </form>
              {profileMsg && <div className="text-xs text-emerald-400">{profileMsg}</div>}

              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  ['Matches', profile.stats?.matches || 0],
                  ['Wins', profile.stats?.wins || 0],
                  ['Kills', profile.stats?.kills || 0],
                  ['Damage', profile.stats?.damage || 0],
                ].map(([lbl, val]) => (
                  <div key={String(lbl)} className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-[10px] uppercase text-slate-400">{lbl}</div>
                    <div className="text-base font-black text-white tabular-nums">{val}</div>
                  </div>
                ))}
              </div>

              <button
                onClick={onLogout}
                className="w-full py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/30 border border-red-500/50 text-red-300 text-xs font-black uppercase flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" /> Secure Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
