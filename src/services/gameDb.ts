import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { getRankTier, xpForLevel } from '../game/catalog';

export interface PlayerSettings {
  graphicsQuality: 'low' | 'medium' | 'high';
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;
  mouseSensitivity: number;
  adsSensitivity: number;
  fireMode: 'tap' | 'hold' | 'auto';
  fov: number;
  language: 'en' | 'es' | 'fr' | 'pt';
  showMobileControls: boolean;
  equippedSkins?: Record<string, string>;
  equippedAttachments?: string[];
}

export const DEFAULT_SETTINGS: PlayerSettings = {
  graphicsQuality: 'high',
  sfxVolume: 0.7,
  musicVolume: 0.35,
  muted: false,
  mouseSensitivity: 1.0,
  adsSensitivity: 0.65,
  fireMode: 'hold',
  fov: 70,
  language: 'en',
  showMobileControls: false,
  equippedSkins: {},
  equippedAttachments: [],
};

export interface UserProfile {
  uid: string;
  playerId: string;
  username: string;
  avatarUrl?: string;
  level: number;
  xp: number;
  rankPoints: number;
  rankTier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Heroic' | 'Apex';
  gold: number;
  diamonds: number;
  selectedCharacter: string;
  selectedWeapon: string;
  equippedOutfit: string;
  equippedHair: string;
  equippedAccessory: string;
  equippedEmote: string;
  unlockedItems: string[];
  characterLevels?: Record<string, number>;
  stats?: {
    matches: number;
    wins: number;
    kills: number;
    damage: number;
    headshots: number;
  };
  battlePassLevel?: number;
  battlePassXp?: number;
  hasElitePass?: boolean;
  dailyStreak?: number;
  lastLoginClaimDay?: string;
  claimedMissions?: string[];
  banned: boolean;
  banReason?: string;
  onlineStatus: 'online' | 'in_lobby' | 'in_match' | 'offline';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserPrivateInfo {
  uid: string;
  email?: string;
  authProvider: 'google' | 'password' | 'guest';
  termsAccepted: boolean;
  privacyShowOnline?: boolean;
  privacyAllowInvites?: boolean;
  settings?: PlayerSettings;
  updatedAt?: unknown;
}

export interface FriendshipRecord {
  id: string;
  requesterId: string;
  recipientId: string;
  requesterName: string;
  recipientName: string;
  status: 'pending' | 'accepted' | 'declined';
}

export interface GameEventRecord {
  eventId: string;
  title: string;
  description: string;
  rewardGold: number;
  rewardDiamonds: number;
  active: boolean;
  createdBy: string;
}

export interface ReportRecord {
  reportId: string;
  reporterId: string;
  targetPlayerId: string;
  targetUsername: string;
  reason: string;
  details?: string;
  status: 'open' | 'reviewed' | 'banned' | 'dismissed';
}

export interface TransactionRecord {
  txId: string;
  userId: string;
  username: string;
  itemId: string;
  itemName: string;
  currency: 'gold' | 'diamonds' | 'usd';
  amount: number;
  status: 'completed' | 'refunded';
}

export interface NotificationRecord {
  id: string;
  userId: string;
  fromId: string;
  fromName: string;
  type: 'system' | 'reward' | 'squad_invite' | 'friend_request';
  title: string;
  message: string;
  roomCode?: string;
  read: boolean;
}

export function generatePlayerId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `EFR-${code}`;
}

export function buildDefaultProfile(uid: string, username: string, avatarUrl?: string): UserProfile {
  return {
    uid,
    playerId: generatePlayerId(),
    username: username.slice(0, 24).trim() || 'Survivor',
    avatarUrl: avatarUrl || '',
    level: 1,
    xp: 0,
    rankPoints: 350,
    rankTier: 'Bronze',
    gold: 2500,
    diamonds: 120,
    selectedCharacter: 'valkyrie',
    selectedWeapon: 'ak47_ember',
    equippedOutfit: 'outfit_default',
    equippedHair: 'hair_tactical',
    equippedAccessory: 'acc_standard',
    equippedEmote: 'emote_salute',
    unlockedItems: [
      'valkyrie',
      'ak47_ember',
      'usp_tactical',
      'outfit_default',
      'hair_tactical',
      'acc_standard',
      'emote_salute',
    ],
    characterLevels: { valkyrie: 1, kuro: 1, titan: 1, nova: 1 },
    stats: { matches: 0, wins: 0, kills: 0, damage: 0, headshots: 0 },
    battlePassLevel: 1,
    battlePassXp: 0,
    hasElitePass: false,
    dailyStreak: 0,
    lastLoginClaimDay: '',
    claimedMissions: [],
    banned: false,
    banReason: '',
    onlineStatus: 'in_lobby',
  };
}

export async function ensureUserProfile(
  uid: string,
  opts: {
    username: string;
    email?: string;
    avatarUrl?: string;
    authProvider: 'google' | 'password' | 'guest';
    termsAccepted: boolean;
  },
): Promise<UserProfile> {
  const userPath = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      await updateDoc(doc(db, 'users', uid), {
        onlineStatus: 'in_lobby',
        updatedAt: serverTimestamp(),
      });
      return data;
    }

    const profile = buildDefaultProfile(uid, opts.username, opts.avatarUrl);
    await setDoc(doc(db, 'users', uid), {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'users', uid, 'private', 'info'), {
      uid,
      email: (opts.email || '').slice(0, 160),
      authProvider: opts.authProvider,
      termsAccepted: opts.termsAccepted,
      privacyShowOnline: true,
      privacyAllowInvites: true,
      settings: DEFAULT_SETTINGS,
      updatedAt: serverTimestamp(),
    });

    return profile;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, userPath);
  }
}

export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
) {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      onData(snap.exists() ? (snap.data() as UserProfile) : null);
    },
    (err) => handleFirestoreError(err, OperationType.GET, path),
  );
}

export function subscribePrivateInfo(
  uid: string,
  onData: (info: UserPrivateInfo | null) => void,
) {
  const path = `users/${uid}/private/info`;
  return onSnapshot(
    doc(db, 'users', uid, 'private', 'info'),
    (snap) => {
      onData(snap.exists() ? (snap.data() as UserPrivateInfo) : null);
    },
    (err) => handleFirestoreError(err, OperationType.GET, path),
  );
}

export async function updateUserProfileFields(uid: string, patch: Partial<UserProfile>) {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updatePrivateSettings(
  uid: string,
  patch: Partial<UserPrivateInfo>,
) {
  const path = `users/${uid}/private/info`;
  try {
    await updateDoc(doc(db, 'users', uid, 'private', 'info'), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function recordMatchResult(
  profile: UserProfile,
  result: {
    mode: string;
    placement: number;
    totalPlayers: number;
    kills: number;
    damage: number;
    won: boolean;
  },
) {
  const xpEarned = Math.round(120 + result.kills * 45 + (result.won ? 280 : Math.max(0, (50 - result.placement) * 4)));
  const goldEarned = Math.round(80 + result.kills * 35 + (result.won ? 300 : Math.max(0, (50 - result.placement) * 3)));
  const rankDelta = result.won ? 48 : result.placement <= 10 ? 22 : result.kills >= 2 ? 10 : -8;

  let newXp = (profile.xp || 0) + xpEarned;
  let newLevel = profile.level || 1;
  while (newXp >= xpForLevel(newLevel)) {
    newXp -= xpForLevel(newLevel);
    newLevel += 1;
  }

  const newRankPoints = Math.max(0, (profile.rankPoints || 0) + rankDelta);
  const newBpXp = (profile.battlePassXp || 0) + xpEarned;
  const newBpLevel = Math.min(12, Math.floor(newBpXp / 400) + 1);
  const prevStats = profile.stats || { matches: 0, wins: 0, kills: 0, damage: 0, headshots: 0 };

  const matchId = `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  try {
    await setDoc(doc(db, 'matches', matchId), {
      matchId,
      ownerId: profile.uid,
      mode: result.mode,
      placement: result.placement,
      totalPlayers: result.totalPlayers,
      kills: result.kills,
      damage: result.damage,
      xpEarned,
      goldEarned,
      createdAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'users', profile.uid), {
      level: newLevel,
      xp: newXp,
      rankPoints: newRankPoints,
      rankTier: getRankTier(newRankPoints),
      gold: (profile.gold || 0) + goldEarned,
      battlePassXp: newBpXp,
      battlePassLevel: newBpLevel,
      stats: {
        matches: prevStats.matches + 1,
        wins: prevStats.wins + (result.won ? 1 : 0),
        kills: prevStats.kills + result.kills,
        damage: prevStats.damage + result.damage,
        headshots: prevStats.headshots,
      },
      onlineStatus: 'in_lobby',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `matches/${matchId}`);
  }

  return { xpEarned, goldEarned, rankDelta };
}

export async function recordTransactionAndPurchase(
  profile: UserProfile,
  opts: {
    itemId: string;
    itemName: string;
    currency: 'gold' | 'diamonds' | 'usd';
    amount: number;
    unlockItemIds?: string[];
    goldDelta?: number;
    diamondsDelta?: number;
    grantElitePass?: boolean;
  },
) {
  const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  try {
    await setDoc(doc(db, 'transactions', txId), {
      txId,
      userId: profile.uid,
      username: profile.username,
      itemId: opts.itemId,
      itemName: opts.itemName,
      currency: opts.currency,
      amount: opts.amount,
      status: 'completed',
      createdAt: serverTimestamp(),
    });

    const newUnlocked = Array.from(
      new Set([...(profile.unlockedItems || []), ...(opts.unlockItemIds || [])]),
    ).slice(0, 150);

    await updateDoc(doc(db, 'users', profile.uid), {
      gold: Math.max(0, profile.gold + (opts.goldDelta || 0) - (opts.currency === 'gold' ? opts.amount : 0)),
      diamonds: Math.max(0, profile.diamonds + (opts.diamondsDelta || 0) - (opts.currency === 'diamonds' ? opts.amount : 0)),
      unlockedItems: newUnlocked,
      hasElitePass: opts.grantElitePass ? true : Boolean(profile.hasElitePass),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `transactions/${txId}`);
  }
}

export async function fetchLeaderboard(): Promise<UserProfile[]> {
  try {
    const q = query(
      collection(db, 'users'),
      where('banned', '==', false),
      orderBy('rankPoints', 'desc'),
      limit(20),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as UserProfile);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'users');
  }
}

export async function findPlayerByCode(playerCode: string): Promise<UserProfile | null> {
  try {
    const q = query(
      collection(db, 'users'),
      where('banned', '==', false),
      where('playerId', '==', playerCode.toUpperCase().trim()),
      limit(1),
    );
    const snap = await getDocs(q);
    return snap.empty ? null : (snap.docs[0].data() as UserProfile);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'users');
  }
}

export async function sendFriendRequest(from: UserProfile, to: UserProfile) {
  const fid = `fr_${from.uid.slice(0, 8)}_${to.uid.slice(0, 8)}_${Date.now()}`;
  try {
    await setDoc(doc(db, 'friends', fid), {
      requesterId: from.uid,
      recipientId: to.uid,
      requesterName: from.username,
      recipientName: to.username,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const nid = `nt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await setDoc(doc(db, 'notifications', nid), {
      userId: to.uid,
      fromId: from.uid,
      fromName: from.username,
      type: 'friend_request',
      title: 'Friend Request',
      message: `${from.username} (${from.playerId}) sent you a squad friend request.`,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `friends/${fid}`);
  }
}

export async function respondFriendRequest(friendshipId: string, status: 'accepted' | 'declined') {
  try {
    await updateDoc(doc(db, 'friends', friendshipId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `friends/${friendshipId}`);
  }
}

export async function sendSquadInvite(from: UserProfile, toUid: string, roomCode: string) {
  const nid = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  try {
    await setDoc(doc(db, 'notifications', nid), {
      userId: toUid,
      fromId: from.uid,
      fromName: from.username,
      type: 'squad_invite',
      title: 'Squad Deploy Invite',
      message: `${from.username} invited you to join room ${roomCode}.`,
      roomCode,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `notifications/${nid}`);
  }
}

export async function markNotificationRead(notifId: string) {
  try {
    await updateDoc(doc(db, 'notifications', notifId), { read: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `notifications/${notifId}`);
  }
}

export async function submitPlayerReport(
  reporterId: string,
  targetPlayerId: string,
  targetUsername: string,
  reason: 'aimbot' | 'speedhack' | 'toxicity' | 'exploiting' | 'other',
  details: string,
) {
  const reportId = `rep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  try {
    await setDoc(doc(db, 'reports', reportId), {
      reportId,
      reporterId,
      targetPlayerId,
      targetUsername: targetUsername.slice(0, 32),
      reason,
      details: details.slice(0, 500),
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `reports/${reportId}`);
  }
}

// Admin Operations
export async function adminFetchAllUsers(): Promise<UserProfile[]> {
  try {
    const snap = await getDocs(query(collection(db, 'users'), limit(50)));
    return snap.docs.map((d) => d.data() as UserProfile);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'users');
  }
}

export async function adminFetchReports(): Promise<ReportRecord[]> {
  try {
    const snap = await getDocs(query(collection(db, 'reports'), limit(50)));
    return snap.docs.map((d) => d.data() as ReportRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'reports');
  }
}

export async function adminFetchTransactions(): Promise<TransactionRecord[]> {
  try {
    const snap = await getDocs(query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(40)));
    return snap.docs.map((d) => d.data() as TransactionRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'transactions');
  }
}

export async function adminSetUserBan(targetUid: string, banned: boolean, banReason = '') {
  try {
    await updateDoc(doc(db, 'users', targetUid), {
      banned,
      banReason: banReason.slice(0, 200),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
  }
}

export async function adminGrantCurrency(targetUid: string, gold: number, diamonds: number) {
  try {
    await updateDoc(doc(db, 'users', targetUid), {
      gold: Math.max(0, Math.round(gold)),
      diamonds: Math.max(0, Math.round(diamonds)),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
  }
}

export async function adminFetchEvents(): Promise<GameEventRecord[]> {
  try {
    const snap = await getDocs(query(collection(db, 'events'), limit(30)));
    return snap.docs.map((d) => d.data() as GameEventRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'events');
  }
}

export async function adminToggleEventActive(eventId: string, active: boolean) {
  try {
    await updateDoc(doc(db, 'events', eventId), {
      active,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `events/${eventId}`);
  }
}

export async function adminCreateEvent(
  createdBy: string,
  title: string,
  description: string,
  rewardGold: number,
  rewardDiamonds: number,
) {
  const eventId = `ev_${Date.now()}`;
  try {
    await setDoc(doc(db, 'events', eventId), {
      eventId,
      title: title.slice(0, 80),
      description: description.slice(0, 300),
      rewardGold: Math.max(0, Math.round(rewardGold)),
      rewardDiamonds: Math.max(0, Math.round(rewardDiamonds)),
      active: true,
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `events/${eventId}`);
  }
}

export async function adminResolveReport(reportId: string, status: 'reviewed' | 'banned' | 'dismissed') {
  try {
    await updateDoc(doc(db, 'reports', reportId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `reports/${reportId}`);
  }
}

export async function adminSaveGameConfig(
  updatedBy: string,
  weapons: Record<string, unknown>,
  characters: Record<string, unknown>,
) {
  try {
    await setDoc(doc(db, 'gameConfig', 'balance'), {
      configId: 'balance',
      weapons,
      characters,
      updatedBy,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'gameConfig/balance');
  }
}
