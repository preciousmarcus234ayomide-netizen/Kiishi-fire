import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, signOut } from './services/firebase';
import {
  DEFAULT_SETTINGS,
  ensureUserProfile,
  FriendshipRecord,
  GameEventRecord,
  NotificationRecord,
  PlayerSettings,
  recordMatchResult,
  subscribePrivateInfo,
  subscribeUserProfile,
  updateUserProfileFields,
  UserPrivateInfo,
  UserProfile,
} from './services/gameDb';
import { AuthScreen } from './components/AuthScreen';
import { LobbyDashboard } from './components/LobbyDashboard';
import { BattleCanvas, MatchSummaryResult } from './components/BattleCanvas';
import { ErrorBoundary } from './components/ErrorBoundary';
import { xpForLevel } from './game/catalog';

function MainApp() {
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [privateInfo, setPrivateInfo] = useState<UserPrivateInfo | null>(null);
  const [isLocalGuest, setIsLocalGuest] = useState(false);
  const [settings, setSettings] = useState<PlayerSettings>(DEFAULT_SETTINGS);

  const [friends, setFriends] = useState<FriendshipRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [events, setEvents] = useState<GameEventRecord[]>([]);
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; senderName: string; text: string }>>([]);
  const [onlineCount, setOnlineCount] = useState(1);

  const [activeMatch, setActiveMatch] = useState<{
    roomId: string;
    roomCode: string;
    mode: string;
    selfId: string;
  } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const profileRef = useRef<UserProfile | null>(null);
  profileRef.current = profile;
  const settingsRef = useRef<PlayerSettings>(settings);
  settingsRef.current = settings;

  // 1. Firebase Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsLocalGuest(false);
        try {
          const p = await ensureUserProfile(user.uid, {
            username: user.displayName || user.email?.split('@')[0] || 'Survivor',
            email: user.email || '',
            avatarUrl: user.photoURL || '',
            authProvider: user.isAnonymous ? 'guest' : user.providerData[0]?.providerId === 'google.com' ? 'google' : 'password',
            termsAccepted: true,
          });
          setProfile(p);
        } catch {
          // Handled via ErrorBoundary / Firestore error logger
        }
      } else if (!isLocalGuest) {
        setProfile(null);
        setPrivateInfo(null);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, [isLocalGuest]);

  // 2. Firestore Realtime Subscriptions (only when authenticated via Firebase)
  useEffect(() => {
    if (!profile?.uid || isLocalGuest || !auth.currentUser) return;
    const uid = profile.uid;

    const unsubProfile = subscribeUserProfile(uid, (p) => {
      if (p) setProfile(p);
    });

    const unsubPrivate = subscribePrivateInfo(uid, (info) => {
      if (info) {
        setPrivateInfo(info);
        if (info.settings) setSettings({ ...DEFAULT_SETTINGS, ...info.settings });
      }
    });

    const unsubNotifs = onSnapshot(
      query(collection(db, 'notifications'), where('userId', '==', uid)),
      (snap) => {
        setNotifications(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NotificationRecord, 'id'>) })),
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications'),
    );

    const unsubEvents = onSnapshot(
      query(collection(db, 'events'), where('active', '==', true)),
      (snap) => {
        setEvents(snap.docs.map((d) => d.data() as GameEventRecord));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'events'),
    );

    const unsubFr1 = onSnapshot(
      query(collection(db, 'friends'), where('requesterId', '==', uid)),
      (snap) => {
        const list1 = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FriendshipRecord, 'id'>) }));
        setFriends((prev) => {
          const map = new Map(prev.filter((f) => f.recipientId === uid).map((f) => [f.id, f]));
          list1.forEach((f) => map.set(f.id, f));
          return Array.from(map.values());
        });
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'friends'),
    );

    const unsubFr2 = onSnapshot(
      query(collection(db, 'friends'), where('recipientId', '==', uid)),
      (snap) => {
        const list2 = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FriendshipRecord, 'id'>) }));
        setFriends((prev) => {
          const map = new Map(prev.filter((f) => f.requesterId === uid).map((f) => [f.id, f]));
          list2.forEach((f) => map.set(f.id, f));
          return Array.from(map.values());
        });
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'friends'),
    );

    return () => {
      unsubProfile();
      unsubPrivate();
      unsubNotifs();
      unsubEvents();
      unsubFr1();
      unsubFr2();
    };
  }, [profile?.uid, isLocalGuest]);

  // 3. Persistent Authoritative WebSocket Connection
  useEffect(() => {
    if (!profile?.uid) return;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws`;
    let socket: WebSocket | null = null;
    let closedByUser = false;

    const connect = () => {
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        const p = profileRef.current;
        const s = settingsRef.current;
        if (!p || !socket) return;
        socket.send(
          JSON.stringify({
            type: 'auth',
            uid: p.uid,
            playerId: p.playerId,
            username: p.username,
            character: p.selectedCharacter,
            weapon: p.selectedWeapon,
            outfit: p.equippedOutfit,
            hair: p.equippedHair,
            accessory: p.equippedAccessory,
            equippedSkins: s.equippedSkins || {},
            attachments: s.equippedAttachments || [],
            rankTier: p.rankTier,
          }),
        );
      };

      socket.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'auth:ok') {
            setOnlineCount(msg.onlineCount || 1);
          } else if (msg.type === 'match:joined') {
            setActiveMatch({
              roomId: msg.roomId,
              roomCode: msg.roomCode,
              mode: msg.mode,
              selfId: msg.selfId,
            });
          } else if (msg.type === 'chat:message' && msg.channel === 'lobby') {
            setChatMessages((prev) => [
              ...prev.slice(-30),
              { id: msg.id, senderName: msg.senderName, text: msg.text },
            ]);
          }
        } catch {
          // ignore
        }
      };

      socket.onclose = () => {
        if (!closedByUser) {
          setTimeout(connect, 2000);
        }
      };
    };

    connect();

    return () => {
      closedByUser = true;
      socket?.close();
      wsRef.current = null;
    };
  }, [profile?.uid]);

  const handleStartMatch = (mode: string, roomCode?: string) => {
    const sock = wsRef.current;
    if (!sock || sock.readyState !== WebSocket.OPEN || !profile) return;
    if (!isLocalGuest) {
      updateUserProfileFields(profile.uid, { onlineStatus: 'in_match' }).catch(() => {});
    }
    sock.send(
      JSON.stringify({
        type: 'queue:join',
        mode,
        roomCode,
        character: profile.selectedCharacter,
        weapon: profile.selectedWeapon,
        outfit: profile.equippedOutfit,
        hair: profile.equippedHair,
        accessory: profile.equippedAccessory,
        equippedSkins: settings.equippedSkins || {},
        attachments: settings.equippedAttachments || [],
      }),
    );
  };

  const handleExitMatch = async (summary: MatchSummaryResult) => {
    setActiveMatch(null);
    if (!profile) return;
    if (isLocalGuest) {
      const xpGain = 120 + summary.kills * 45 + (summary.won ? 280 : 40);
      const goldGain = 80 + summary.kills * 35 + (summary.won ? 300 : 30);
      setProfile((p) => {
        if (!p) return p;
        let nx = p.xp + xpGain;
        let nl = p.level;
        while (nx >= xpForLevel(nl)) {
          nx -= xpForLevel(nl);
          nl++;
        }
        return {
          ...p,
          xp: nx,
          level: nl,
          gold: p.gold + goldGain,
          stats: {
            matches: (p.stats?.matches || 0) + 1,
            wins: (p.stats?.wins || 0) + (summary.won ? 1 : 0),
            kills: (p.stats?.kills || 0) + summary.kills,
            damage: (p.stats?.damage || 0) + summary.damage,
            headshots: p.stats?.headshots || 0,
          },
        };
      });
    } else {
      await recordMatchResult(profile, summary);
    }
  };

  const handleLogout = async () => {
    setActiveMatch(null);
    setProfile(null);
    setIsLocalGuest(false);
    if (auth.currentUser) {
      await signOut(auth);
    }
  };

  if (!authReady) {
    return (
      <div className="fixed inset-0 bg-[#07090F] flex items-center justify-center text-orange-400 font-black tracking-widest uppercase">
        Initializing Emberfall Engine...
      </div>
    );
  }

  if (!profile) {
    return (
      <AuthScreen
        onAuthenticated={(p, localGuest) => {
          setIsLocalGuest(Boolean(localGuest));
          setProfile(p);
        }}
      />
    );
  }

  if (profile.banned) {
    return (
      <div className="fixed inset-0 bg-[#07090F] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#111726] border border-red-500 rounded-2xl p-6 text-center space-y-3">
          <h2 className="text-xl font-black uppercase text-red-400">Account Suspended</h2>
          <p className="text-xs text-slate-300">
            Reason: {profile.banReason || 'Fair Play / Anti-Cheat Enforcement'}
          </p>
          <button
            onClick={handleLogout}
            className="px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (activeMatch) {
    return (
      <BattleCanvas
        ws={wsRef.current}
        profile={profile}
        settings={settings}
        roomInfo={activeMatch}
        onExitMatch={handleExitMatch}
      />
    );
  }

  return (
    <LobbyDashboard
      profile={profile}
      isLocalGuest={isLocalGuest}
      authProvider={privateInfo?.authProvider || (isLocalGuest ? 'guest' : 'password')}
      userEmail={privateInfo?.email || auth.currentUser?.email || ''}
      settings={settings}
      privacyShowOnline={privateInfo?.privacyShowOnline ?? true}
      privacyAllowInvites={privateInfo?.privacyAllowInvites ?? true}
      friends={friends}
      notifications={notifications}
      events={events}
      chatMessages={chatMessages}
      onlineCount={onlineCount}
      onStartMatch={handleStartMatch}
      onSendLobbyChat={(text) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'chat:send', channel: 'lobby', text }));
        }
      }}
      onUpdateSettings={setSettings}
      onLocalProfileUpdate={(updater) => setProfile((p) => (p ? updater(p) : p))}
      onLogout={handleLogout}
    />
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}
