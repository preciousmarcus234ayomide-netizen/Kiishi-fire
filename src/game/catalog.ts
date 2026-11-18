export type WeaponCategory = 'ar' | 'sniper' | 'smg' | 'shotgun' | 'pistol';

export interface WeaponSpec {
  id: string;
  name: string;
  category: WeaponCategory;
  damage: number;
  headshotMult: number;
  fireRateMs: number;
  accuracy: number; // 0-100
  reloadTimeMs: number;
  range: number;
  recoil: number; // 0-100
  magSize: number;
  pellets: number;
  ammoType: string;
  color: number;
  accentColor: number;
  hexColor: string;
  priceGold: number;
  priceDiamonds: number;
  description: string;
}

export interface WeaponSkinSpec {
  id: string;
  name: string;
  weaponId: string;
  primaryColor: number;
  accentColor: number;
  hexPreview: string;
  rarity: 'Rare' | 'Epic' | 'Legendary';
  priceDiamonds: number;
  bonusStat: string;
}

export interface AttachmentSpec {
  id: string;
  name: string;
  slot: 'optic' | 'magazine' | 'muzzle';
  effect: string;
  priceGold: number;
}

export interface CharacterSpec {
  id: string;
  name: string;
  gender: 'male' | 'female';
  title: string;
  abilityName: string;
  abilityDesc: string;
  cooldownSec: number;
  primaryColor: number;
  secondaryColor: number;
  visorColor: number;
  hexColor: string;
  priceGold: number;
  priceDiamonds: number;
}

export interface CosmeticItem {
  id: string;
  slot: 'outfit' | 'hair' | 'accessory' | 'emote';
  name: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  colorHex: string;
  colorNum: number;
  priceGold: number;
  priceDiamonds: number;
  description: string;
}

export interface GameModeSpec {
  id: 'br_solo' | 'br_duo' | 'br_squad' | 'clash_squad' | 'training' | 'custom';
  name: string;
  subtitle: string;
  playersCount: number;
  teamSize: number;
  badge: string;
  description: string;
}

export const WEAPONS: Record<string, WeaponSpec> = {
  ak47_ember: {
    id: 'ak47_ember',
    name: 'AK-47 Ember',
    category: 'ar',
    damage: 34,
    headshotMult: 1.75,
    fireRateMs: 125,
    accuracy: 74,
    reloadTimeMs: 2100,
    range: 145,
    recoil: 56,
    magSize: 30,
    pellets: 1,
    ammoType: '7.62mm',
    color: 0x262930,
    accentColor: 0xff5a1f,
    hexColor: '#FF5A1F',
    priceGold: 0,
    priceDiamonds: 0,
    description: 'High-impact assault rifle forged with volcanic recoil stabilization.',
  },
  scar_vanguard: {
    id: 'scar_vanguard',
    name: 'SCAR-V Vanguard',
    category: 'ar',
    damage: 30,
    headshotMult: 1.7,
    fireRateMs: 105,
    accuracy: 85,
    reloadTimeMs: 1850,
    range: 155,
    recoil: 34,
    magSize: 32,
    pellets: 1,
    ammoType: '5.56mm',
    color: 0x3b4252,
    accentColor: 0x00e5ff,
    hexColor: '#00E5FF',
    priceGold: 2400,
    priceDiamonds: 0,
    description: 'Precision modular assault rifle with crisp medium-range tracking.',
  },
  awm_frost: {
    id: 'awm_frost',
    name: 'AWM Frostbite',
    category: 'sniper',
    damage: 96,
    headshotMult: 2.1,
    fireRateMs: 1150,
    accuracy: 98,
    reloadTimeMs: 2800,
    range: 260,
    recoil: 82,
    magSize: 5,
    pellets: 1,
    ammoType: '.300 Mag',
    color: 0x1e293b,
    accentColor: 0x38bdf8,
    hexColor: '#38BDF8',
    priceGold: 4200,
    priceDiamonds: 180,
    description: 'Long-range bolt-action rifle capable of shattering Lv.3 helmets.',
  },
  mp40_neon: {
    id: 'mp40_neon',
    name: 'MP40 Neon Fang',
    category: 'smg',
    damage: 21,
    headshotMult: 1.5,
    fireRateMs: 68,
    accuracy: 71,
    reloadTimeMs: 1500,
    range: 85,
    recoil: 28,
    magSize: 36,
    pellets: 1,
    ammoType: '9mm',
    color: 0x18181b,
    accentColor: 0xa855f7,
    hexColor: '#A855F7',
    priceGold: 1800,
    priceDiamonds: 0,
    description: 'Blistering close-quarters submachine gun built for aggressive flankers.',
  },
  m1887_slag: {
    id: 'm1887_slag',
    name: 'M1887 Slag Breaker',
    category: 'shotgun',
    damage: 19,
    headshotMult: 1.45,
    fireRateMs: 720,
    accuracy: 58,
    reloadTimeMs: 2200,
    range: 42,
    recoil: 78,
    magSize: 6,
    pellets: 6,
    ammoType: '12-Gauge',
    color: 0x2d2420,
    accentColor: 0xf59e0b,
    hexColor: '#F59E0B',
    priceGold: 2200,
    priceDiamonds: 0,
    description: 'Heavy double-action combat shotgun firing 6 lethal tungsten pellets.',
  },
  usp_tactical: {
    id: 'usp_tactical',
    name: 'USP-T Tactical',
    category: 'pistol',
    damage: 24,
    headshotMult: 1.65,
    fireRateMs: 220,
    accuracy: 82,
    reloadTimeMs: 1200,
    range: 70,
    recoil: 24,
    magSize: 15,
    pellets: 1,
    ammoType: '.45 ACP',
    color: 0x334155,
    accentColor: 0x94a3b8,
    hexColor: '#94A3B8',
    priceGold: 0,
    priceDiamonds: 0,
    description: 'Reliable suppressed sidearm standard-issue on initial parachute drop.',
  },
};

export const WEAPON_SKINS: WeaponSkinSpec[] = [
  {
    id: 'skin_ak_magma',
    name: 'AK-47 Dragon Core',
    weaponId: 'ak47_ember',
    primaryColor: 0x1c1010,
    accentColor: 0xff3b00,
    hexPreview: '#FF3B00',
    rarity: 'Legendary',
    priceDiamonds: 350,
    bonusStat: '+5% Damage',
  },
  {
    id: 'skin_scar_titan',
    name: 'SCAR-V Cyber Gold',
    weaponId: 'scar_vanguard',
    primaryColor: 0x1f242d,
    accentColor: 0xfbbf24,
    hexPreview: '#FBBF24',
    rarity: 'Epic',
    priceDiamonds: 220,
    bonusStat: '+8% Reload Speed',
  },
  {
    id: 'skin_awm_zero',
    name: 'AWM Absolute Zero',
    weaponId: 'awm_frost',
    primaryColor: 0x0f172a,
    accentColor: 0x22d3ee,
    hexPreview: '#22D3EE',
    rarity: 'Legendary',
    priceDiamonds: 400,
    bonusStat: '+10% Range',
  },
  {
    id: 'skin_mp40_cobra',
    name: 'MP40 Venom Pulse',
    weaponId: 'mp40_neon',
    primaryColor: 0x141e18,
    accentColor: 0x10b981,
    hexPreview: '#10B981',
    rarity: 'Epic',
    priceDiamonds: 200,
    bonusStat: '+6% Fire Rate',
  },
];

export const ATTACHMENTS: AttachmentSpec[] = [
  { id: 'att_reddot', name: 'Holo Red Dot', slot: 'optic', effect: '+12% ADS Precision', priceGold: 600 },
  { id: 'att_scope4x', name: '4x Thermal Optic', slot: 'optic', effect: '2.4x Zoom Magnification', priceGold: 1200 },
  { id: 'att_extmag', name: 'Extended Quick Mag', slot: 'magazine', effect: '+25% Mag & Faster Reload', priceGold: 950 },
  { id: 'att_comp', name: 'Muzzle Compensator', slot: 'muzzle', effect: '-20% Vertical Recoil', priceGold: 850 },
];

export const CHARACTERS: Record<string, CharacterSpec> = {
  valkyrie: {
    id: 'valkyrie',
    name: 'Valkyrie',
    gender: 'female',
    title: 'Solaris Vanguard',
    abilityName: 'Aegis Surge',
    abilityDesc: 'Deploys an instant +45 Shield barrier and +20% sprint boost for 5s.',
    cooldownSec: 22,
    primaryColor: 0x5d6748,
    secondaryColor: 0x262b24,
    visorColor: 0x00e5ff,
    hexColor: '#EA580C',
    priceGold: 0,
    priceDiamonds: 0,
  },
  kuro: {
    id: 'kuro',
    name: 'Kuro',
    gender: 'male',
    title: 'Phantom Recon',
    abilityName: 'Shadow Step',
    abilityDesc: 'Triggers a high-velocity tactical dash burst and brief stealth shimmer.',
    cooldownSec: 14,
    primaryColor: 0x3b4048,
    secondaryColor: 0x1c1f24,
    visorColor: 0xc084fc,
    hexColor: '#7C3AED',
    priceGold: 3000,
    priceDiamonds: 150,
  },
  titan: {
    id: 'titan',
    name: 'Titan',
    gender: 'male',
    title: 'Heavy Breacher',
    abilityName: 'Iron Bastion',
    abilityDesc: 'Reinforces ballistic plate carrier for 35% damage reduction and steady recoil for 6s.',
    cooldownSec: 24,
    primaryColor: 0x4f5246,
    secondaryColor: 0x252824,
    visorColor: 0xf59e0b,
    hexColor: '#0284C7',
    priceGold: 3500,
    priceDiamonds: 180,
  },
  nova: {
    id: 'nova',
    name: 'Nova',
    gender: 'female',
    title: 'Orbital Recon',
    abilityName: 'Recon Pulse',
    abilityDesc: 'Emits a 65m tactical radar sweep marking hostile combatants for 6s.',
    cooldownSec: 20,
    primaryColor: 0x435344,
    secondaryColor: 0x1e2521,
    visorColor: 0x34d399,
    hexColor: '#059669',
    priceGold: 2800,
    priceDiamonds: 140,
  },
};

export const COSMETIC_ITEMS: CosmeticItem[] = [
  // Outfits
  { id: 'outfit_default', slot: 'outfit', name: 'Woodland Ripstop BDU', rarity: 'Common', colorHex: '#4B5544', colorNum: 0x4b5544, priceGold: 0, priceDiamonds: 0, description: 'Standard military woodland camouflage fatigues & plate carrier.' },
  { id: 'outfit_crimson', slot: 'outfit', name: 'Crimson PMC Spec-Ops', rarity: 'Epic', colorHex: '#8C2D2D', colorNum: 0x8c2d2d, priceGold: 2500, priceDiamonds: 120, description: 'Reinforced private military contractor tactical jacket.' },
  { id: 'outfit_gold', slot: 'outfit', name: 'Desert Coyote Recon', rarity: 'Legendary', colorHex: '#A68859', colorNum: 0xa68859, priceGold: 0, priceDiamonds: 320, description: 'Arid coyote-tan special forces combat uniform.' },
  { id: 'outfit_arctic', slot: 'outfit', name: 'Arctic Alpine Camo', rarity: 'Rare', colorHex: '#CBD5E1', colorNum: 0xcbd5e1, priceGold: 1600, priceDiamonds: 80, description: 'High-altitude winter thermal combat gear.' },
  // Hairstyles
  { id: 'hair_tactical', slot: 'hair', name: 'Combat Trim / Ponytail', rarity: 'Common', colorHex: '#231D1A', colorNum: 0x231d1a, priceGold: 0, priceDiamonds: 0, description: 'Natural dark brown operator cut (ponytail for female ops).' },
  { id: 'hair_crimson_spike', slot: 'hair', name: 'Auburn Combat Waves', rarity: 'Rare', colorHex: '#8F3A22', colorNum: 0x8f3a22, priceGold: 900, priceDiamonds: 45, description: 'Warm chestnut/auburn layered military hairstyle.' },
  { id: 'hair_cyber_cyan', slot: 'hair', name: 'Ash Blonde Sweep', rarity: 'Epic', colorHex: '#C2A878', colorNum: 0xc2a878, priceGold: 1500, priceDiamonds: 75, description: 'Sun-bleached blonde tactical sweep.' },
  // Accessories / Shoes
  { id: 'acc_standard', slot: 'accessory', name: 'Combat Boots & Rucksack', rarity: 'Common', colorHex: '#3B3630', colorNum: 0x3b3630, priceGold: 0, priceDiamonds: 0, description: 'Laced leather tactical boots & field pack.' },
  { id: 'acc_jetwing', slot: 'accessory', name: 'HALO Parachute Rig', rarity: 'Legendary', colorHex: '#334155', colorNum: 0x334155, priceGold: 0, priceDiamonds: 260, description: 'Carbon-reinforced high-altitude jump rig & desert boots.' },
  { id: 'acc_magma_boots', slot: 'accessory', name: 'Assault Breacher Rig', rarity: 'Epic', colorHex: '#4A4338', colorNum: 0x4a4338, priceGold: 1900, priceDiamonds: 95, description: 'Heavy knee-pad greaves & trauma rucksack.' },
  // Emotes
  { id: 'emote_salute', slot: 'emote', name: 'Tactical Salute', rarity: 'Common', colorHex: '#94A3B8', colorNum: 0x94a3b8, priceGold: 0, priceDiamonds: 0, description: 'Crisp military victory salute.' },
  { id: 'emote_spin', slot: 'emote', name: 'Weapon Inspection', rarity: 'Rare', colorHex: '#FF5A1F', colorNum: 0xff5a1f, priceGold: 1100, priceDiamonds: 55, description: '360-degree operator weapon check.' },
  { id: 'emote_flex', slot: 'emote', name: 'Squad Ready Stance', rarity: 'Epic', colorHex: '#FBBF24', colorNum: 0xfbbf24, priceGold: 1800, priceDiamonds: 90, description: 'Dominant combat-ready stance.' },
];

export const GAME_MODES: GameModeSpec[] = [
  {
    id: 'br_solo',
    name: 'Battle Royale — Solo',
    subtitle: '50 Combatants · Ember Island',
    playersCount: 50,
    teamSize: 1,
    badge: 'RANKED',
    description: 'Parachute into Ember Island, scavenge weapons & armor, outrun the storm, and be the last survivor.',
  },
  {
    id: 'br_duo',
    name: 'Battle Royale — Duo',
    subtitle: '50 Combatants · 25 Pairs',
    playersCount: 50,
    teamSize: 2,
    badge: 'DUO',
    description: 'Drop with a wingman, share medkits and tactical callouts, and dominate the final circle.',
  },
  {
    id: 'br_squad',
    name: 'Battle Royale — Squad',
    subtitle: '50 Combatants · 4-Player Teams',
    playersCount: 50,
    teamSize: 4,
    badge: 'SQUAD',
    description: 'Coordinate character abilities across a 4-player strike squad on the full open-world map.',
  },
  {
    id: 'clash_squad',
    name: 'Clash Squad 4v4',
    subtitle: '8 Combatants · Best of 5 Rounds',
    playersCount: 8,
    teamSize: 4,
    badge: '4v4 ARENA',
    description: 'High-speed close-quarters 4v4 elimination rounds inside Solaris Town & Obsidian Citadel.',
  },
  {
    id: 'training',
    name: 'Training Ground',
    subtitle: 'Free Practice · All Weapons',
    playersCount: 12,
    teamSize: 1,
    badge: 'SANDBOX',
    description: 'Test recoil, sniper ballistics, vehicles, and character abilities on reactive targets.',
  },
  {
    id: 'custom',
    name: 'Custom Room',
    subtitle: 'Private Lobby · Room Code',
    playersCount: 50,
    teamSize: 4,
    badge: 'PRIVATE',
    description: 'Host or join a private tournament lobby with friends using an invite Room Code.',
  },
];

export const DAILY_LOGIN_REWARDS = [
  { day: 1, label: '500 Gold', gold: 500, diamonds: 0 },
  { day: 2, label: '750 Gold', gold: 750, diamonds: 0 },
  { day: 3, label: '30 Diamonds', gold: 0, diamonds: 30 },
  { day: 4, label: '1,200 Gold', gold: 1200, diamonds: 0 },
  { day: 5, label: '50 Diamonds', gold: 0, diamonds: 50 },
  { day: 6, label: '2,000 Gold', gold: 2000, diamonds: 0 },
  { day: 7, label: '120 Diamonds', gold: 500, diamonds: 120 },
];

export const MISSIONS_LIST = [
  { id: 'm_daily_1', type: 'daily', title: 'First Drop', desc: 'Complete 1 match in any mode', target: 1, metric: 'matches', rewardGold: 400, rewardXp: 150 },
  { id: 'm_daily_2', type: 'daily', title: 'Sharpshooter', desc: 'Eliminate 5 opponents', target: 5, metric: 'kills', rewardGold: 650, rewardXp: 250 },
  { id: 'm_daily_3', type: 'daily', title: 'Heavy Firepower', desc: 'Deal 600 total damage', target: 600, metric: 'damage', rewardGold: 550, rewardXp: 200 },
  { id: 'm_weekly_1', type: 'weekly', title: 'Apex Predator', desc: 'Achieve 2 Booyah / Victory placements', target: 2, metric: 'wins', rewardGold: 1800, rewardXp: 800 },
  { id: 'm_weekly_2', type: 'weekly', title: 'Veteran Survivor', desc: 'Eliminate 25 opponents across matches', target: 25, metric: 'kills', rewardGold: 2200, rewardXp: 1000 },
  { id: 'm_ach_1', type: 'achievement', title: 'First Blood Legacy', desc: 'Reach 10 lifetime eliminations', target: 10, metric: 'kills', rewardGold: 1000, rewardXp: 500 },
  { id: 'm_ach_2', type: 'achievement', title: 'Champion of Ember Island', desc: 'Win your first Battle Royale match', target: 1, metric: 'wins', rewardGold: 1500, rewardXp: 750 },
];

export const BATTLE_PASS_TIERS = Array.from({ length: 12 }, (_, idx) => {
  const tier = idx + 1;
  return {
    tier,
    freeReward: tier % 2 === 0 ? `${tier * 250} Gold` : `${tier * 15} BP Tokens`,
    eliteReward:
      tier === 3
        ? 'MP40 Venom Pulse'
        : tier === 6
          ? 'Crimson Ronin Outfit'
          : tier === 9
            ? 'Aero Wing Pack'
            : tier === 12
              ? 'AK-47 Dragon Core'
              : `${tier * 25} Diamonds`,
    gold: tier % 2 === 0 ? tier * 250 : 150,
    diamonds: tier % 3 === 0 ? tier * 15 : 20,
  };
});

export const STORE_BUNDLES = [
  { id: 'pack_diamonds_sm', name: '100 Diamonds Pack', category: 'currency', currency: 'usd', price: 0.99, diamondsGiven: 100, goldGiven: 0, badge: 'STARTER' },
  { id: 'pack_diamonds_md', name: '550 Diamonds Vault', category: 'currency', currency: 'usd', price: 4.99, diamondsGiven: 550, goldGiven: 500, badge: 'POPULAR' },
  { id: 'pack_diamonds_lg', name: '1,250 Diamonds Crate', category: 'currency', currency: 'usd', price: 9.99, diamondsGiven: 1250, goldGiven: 1500, badge: '+25% BONUS' },
  { id: 'pack_gold_boost', name: '3,000 Gold War Chest', category: 'currency', currency: 'diamonds', price: 90, diamondsGiven: 0, goldGiven: 3000, badge: 'DAILY OFFER' },
  { id: 'bundle_elite_pass', name: 'Elite Battle Pass', category: 'pass', currency: 'diamonds', price: 300, diamondsGiven: 0, goldGiven: 1000, badge: 'SEASON 1' },
  { id: 'bundle_apex_starter', name: 'Apex Obsidian Bundle', category: 'bundle', currency: 'diamonds', price: 450, diamondsGiven: 0, goldGiven: 2000, badge: '30% OFF', unlocks: ['outfit_gold', 'skin_ak_magma', 'emote_flex'] },
];

export const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    deploy: 'DEPLOY MATCH',
    armory: 'Armory',
    characters: 'Characters',
    store: 'Store',
    pass: 'Pass & Missions',
    leaderboard: 'Leaderboard',
    settings: 'Settings',
    friends: 'Squad & Friends',
    admin: 'Admin HQ',
  },
  es: {
    deploy: 'DESPLEGAR',
    armory: 'Armería',
    characters: 'Personajes',
    store: 'Tienda',
    pass: 'Pase y Misiones',
    leaderboard: 'Clasificación',
    settings: 'Ajustes',
    friends: 'Escuadrón',
    admin: 'Panel Admin',
  },
  fr: {
    deploy: 'DÉPLOYER',
    armory: 'Armurerie',
    characters: 'Personnages',
    store: 'Boutique',
    pass: 'Passe & Missions',
    leaderboard: 'Classement',
    settings: 'Paramètres',
    friends: 'Escouade',
    admin: 'Admin HQ',
  },
  pt: {
    deploy: 'INICIAR PARTIDA',
    armory: 'Arsenal',
    characters: 'Personagens',
    store: 'Loja',
    pass: 'Passe e Missões',
    leaderboard: 'Ranking',
    settings: 'Configurações',
    friends: 'Esquadrão',
    admin: 'Painel Admin',
  },
};

export function getRankTier(points: number): 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Heroic' | 'Apex' {
  if (points >= 3200) return 'Apex';
  if (points >= 2500) return 'Heroic';
  if (points >= 1900) return 'Diamond';
  if (points >= 1400) return 'Platinum';
  if (points >= 900) return 'Gold';
  if (points >= 450) return 'Silver';
  return 'Bronze';
}

export function xpForLevel(level: number): number {
  return 500 + (level - 1) * 250;
}
