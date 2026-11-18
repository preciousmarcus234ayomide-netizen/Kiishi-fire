import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { WEAPONS } from './src/game/catalog.ts';
import {
  CLASH_ARENA_SPAWNS,
  groundHeightAt,
  LOOT_SPAWN_NODES,
  rayIntersectsBuilding,
  resolveBuildingCollision,
  surfaceHeightAt,
  VEHICLE_SPAWN_NODES,
  WATER_LEVEL,
  WORLD_RADIUS,
} from './src/game/mapData.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

interface ClientMeta {
  ws: WebSocket;
  uid: string;
  playerId: string;
  username: string;
  character: string;
  weapon: string;
  outfit: string;
  hair: string;
  accessory: string;
  equippedSkins: Record<string, string>;
  attachments: string[];
  rankTier: string;
  roomId: string | null;
}

interface WeaponSlotState {
  weaponId: string;
  ammo: number;
  reserveAmmo: number;
}

interface ActorState {
  id: string;
  isBot: boolean;
  username: string;
  team: number;
  character: string;
  outfit: string;
  hair: string;
  accessory: string;
  equippedSkins: Record<string, string>;
  attachments: string[];
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
  yaw: number;
  pitch: number;
  hp: number;
  maxHp: number;
  shield: number;
  armorLevel: number;
  helmetLevel: number;
  alive: boolean;
  deadAt: number;
  kills: number;
  damageDealt: number;
  slots: Array<WeaponSlotState | null>;
  activeSlot: number;
  weaponId: string;
  ammo: number;
  reserveAmmo: number;
  medkits: number;
  grenades: number;
  inPlane: boolean;
  parachuting: boolean;
  crouching: boolean;
  prone: boolean;
  swimming: boolean;
  climbing: boolean;
  aiming: boolean;
  vehicleId: string | null;
  lastShotAt: number;
  reloadingUntil: number;
  abilityCooldownUntil: number;
  abilityActiveUntil: number;
  shieldActive: boolean;
  damageReduction: number;
  reconUntil: number;
  healUntil: number;
  botTargetYaw: number;
  botNextDecisionAt: number;
  inputMoveX: number;
  inputMoveZ: number;
  inputSprint: boolean;
  inputJump: boolean;
  inputCrouch: boolean;
  inputProne: boolean;
  inputFire: boolean;
  inputAim: boolean;
}

interface LootItemState {
  id: string;
  kind: 'weapon' | 'medkit' | 'armor' | 'helmet' | 'grenade' | 'ammo';
  weaponId?: string;
  level?: number;
  label: string;
  color: number;
  x: number;
  y: number;
  z: number;
  taken: boolean;
}

interface VehicleState {
  id: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  speed: number;
  driverId: string | null;
  hp: number;
}

interface GrenadeState {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  explodeAt: number;
}

interface MatchRoom {
  id: string;
  code: string;
  mode: string;
  phase: 'plane' | 'active' | 'ended';
  createdAt: number;
  planeTime: number;
  planeStart: { x: number; z: number };
  planeEnd: { x: number; z: number };
  zoneX: number;
  zoneZ: number;
  zoneRadius: number;
  targetZoneX: number;
  targetZoneZ: number;
  targetZoneRadius: number;
  zonePhase: number;
  zonePhaseEndsAt: number;
  clashRound: number;
  clashScoreA: number;
  clashScoreB: number;
  actors: Map<string, ActorState>;
  loot: LootItemState[];
  vehicles: VehicleState[];
  grenades: GrenadeState[];
  killFeed: Array<{ id: string; killer: string; victim: string; weapon: string; headshot: boolean; ts: number }>;
  totalEliminations: number;
}

const clients = new Map<string, ClientMeta>();
const rooms = new Map<string, MatchRoom>();
let totalMatchesPlayed = 0;
const liveWeaponDamage: Record<string, number> = {};

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getEffectiveWeaponStats(actor: ActorState, weaponId: string) {
  const base = WEAPONS[weaponId] || WEAPONS.ak47_ember;
  const skinId = actor.equippedSkins?.[weaponId] || '';
  const hasExtMag = actor.attachments?.includes('att_extmag');
  const hasRedDot = actor.attachments?.includes('att_reddot');
  const hasComp = actor.attachments?.includes('att_comp');

  const dmgBase = liveWeaponDamage[weaponId] ?? base.damage;
  const damage = Math.round(dmgBase * (skinId === 'skin_ak_magma' ? 1.05 : 1));
  const reloadTimeMs = Math.round(
    base.reloadTimeMs *
      (skinId === 'skin_scar_titan' ? 0.92 : 1) *
      (hasExtMag ? 0.8 : 1),
  );
  const range = Math.round(base.range * (skinId === 'skin_awm_zero' ? 1.1 : 1));
  const fireRateMs = Math.round(base.fireRateMs * (skinId === 'skin_mp40_cobra' ? 0.94 : 1));
  const magSize = Math.round(base.magSize * (hasExtMag ? 1.25 : 1));
  const accuracy = Math.min(99, base.accuracy + (hasRedDot && actor.aiming ? 12 : 0));
  const recoilFactor = hasComp ? 0.8 : 1.0;

  return {
    ...base,
    damage,
    reloadTimeMs,
    range,
    fireRateMs,
    magSize,
    accuracy,
    recoilFactor,
    skinId,
  };
}

function syncActiveSlotToActor(actor: ActorState) {
  const slot = actor.slots[actor.activeSlot];
  if (slot) {
    slot.ammo = actor.ammo;
    slot.reserveAmmo = actor.reserveAmmo;
  }
}

function selectActorSlot(actor: ActorState, slotIndex: number) {
  if (slotIndex < 0 || slotIndex > 2) return false;
  const next = actor.slots[slotIndex];
  if (!next) return false;
  syncActiveSlotToActor(actor);
  actor.activeSlot = slotIndex;
  actor.weaponId = next.weaponId;
  actor.ammo = next.ammo;
  actor.reserveAmmo = next.reserveAmmo;
  actor.reloadingUntil = 0;
  return true;
}

function createInitialLoot(): LootItemState[] {
  const weaponKeys = ['ak47_ember', 'scar_vanguard', 'awm_frost', 'mp40_neon', 'm1887_slag'];
  const items: LootItemState[] = [];
  LOOT_SPAWN_NODES.forEach((node, idx) => {
    const roll = idx % 6;
    const y = surfaceHeightAt(node.x, node.z, 0);
    if (roll === 0 || roll === 3) {
      const wid = weaponKeys[idx % weaponKeys.length];
      const w = WEAPONS[wid];
      items.push({
        id: `loot_${idx}`,
        kind: 'weapon',
        weaponId: wid,
        label: w.name,
        color: w.accentColor,
        x: node.x,
        y,
        z: node.z,
        taken: false,
      });
    } else if (roll === 1) {
      items.push({
        id: `loot_${idx}`,
        kind: 'medkit',
        label: 'Tactical Medkit',
        color: 0xef4444,
        x: node.x,
        y,
        z: node.z,
        taken: false,
      });
    } else if (roll === 2) {
      const lv = (idx % 3) + 1;
      items.push({
        id: `loot_${idx}`,
        kind: 'armor',
        level: lv,
        label: `Armor Vest Lv.${lv}`,
        color: 0x38bdf8,
        x: node.x,
        y,
        z: node.z,
        taken: false,
      });
    } else if (roll === 4) {
      items.push({
        id: `loot_${idx}`,
        kind: 'ammo',
        label: 'Ammo Crate (+45)',
        color: 0xfacc15,
        x: node.x,
        y,
        z: node.z,
        taken: false,
      });
    } else {
      const lv = (idx % 3) + 1;
      items.push({
        id: `loot_${idx}`,
        kind: idx % 2 === 0 ? 'helmet' : 'grenade',
        level: lv,
        label: idx % 2 === 0 ? `Helmet Lv.${lv}` : 'Frag Grenade x2',
        color: idx % 2 === 0 ? 0xf59e0b : 0x22c55e,
        x: node.x,
        y,
        z: node.z,
        taken: false,
      });
    }
  });
  return items;
}

function createInitialVehicles(): VehicleState[] {
  return VEHICLE_SPAWN_NODES.map((v) => ({
    id: v.id,
    x: v.x,
    y: groundHeightAt(v.x, v.z),
    z: v.z,
    rotY: v.rotY,
    speed: 0,
    driverId: null,
    hp: 350,
  }));
}

function createActor(
  id: string,
  isBot: boolean,
  username: string,
  team: number,
  meta?: Partial<ClientMeta>,
  mode = 'br_solo',
  slotIdx = 0,
): ActorState {
  const isClash = mode === 'clash_squad';
  const isTraining = mode === 'training';
  let spawnX = (Math.random() - 0.5) * 40;
  let spawnZ = (Math.random() - 0.5) * 40;
  let spawnY = 78;
  let inPlane = true;

  if (isClash) {
    const arr = team === 0 ? CLASH_ARENA_SPAWNS.teamA : CLASH_ARENA_SPAWNS.teamB;
    const pt = arr[slotIdx % arr.length];
    spawnX = pt.x + (Math.random() - 0.5) * 3;
    spawnZ = pt.z + (Math.random() - 0.5) * 3;
    spawnY = groundHeightAt(spawnX, spawnZ);
    inPlane = false;
  } else if (isTraining) {
    spawnX = isBot ? -12 + (slotIdx % 6) * 7 : -10;
    spawnZ = isBot ? -20 - Math.floor(slotIdx / 6) * 14 : 24;
    spawnY = groundHeightAt(spawnX, spawnZ);
    inPlane = false;
  }

  const startWeapon = isClash || isTraining ? meta?.weapon || 'ak47_ember' : 'usp_tactical';
  const wSpec = WEAPONS[startWeapon] || WEAPONS.usp_tactical;
  const hasExt = Boolean(meta?.attachments?.includes('att_extmag'));
  const startMag = Math.round(wSpec.magSize * (hasExt ? 1.25 : 1));
  const pistolSpec = WEAPONS.usp_tactical;
  const slots: Array<WeaponSlotState | null> =
    startWeapon === 'usp_tactical'
      ? [null, null, { weaponId: 'usp_tactical', ammo: startMag, reserveAmmo: startMag * 4 }]
      : [
          { weaponId: startWeapon, ammo: startMag, reserveAmmo: startMag * 4 },
          isTraining ? { weaponId: 'awm_frost', ammo: WEAPONS.awm_frost.magSize, reserveAmmo: 30 } : null,
          { weaponId: 'usp_tactical', ammo: pistolSpec.magSize, reserveAmmo: pistolSpec.magSize * 3 },
        ];
  const activeSlot = startWeapon === 'usp_tactical' ? 2 : 0;

  return {
    id,
    isBot,
    username,
    team,
    character: meta?.character || randomChoice(['valkyrie', 'kuro', 'titan', 'nova']),
    outfit: meta?.outfit || 'outfit_default',
    hair: meta?.hair || 'hair_tactical',
    accessory: meta?.accessory || 'acc_standard',
    equippedSkins: meta?.equippedSkins || {},
    attachments: meta?.attachments || [],
    x: spawnX,
    y: spawnY,
    z: spawnZ,
    vx: 0,
    vy: 0,
    vz: 0,
    grounded: !inPlane,
    yaw: isClash ? (team === 0 ? -Math.PI / 2 : Math.PI / 2) : 0,
    pitch: 0,
    hp: 100,
    maxHp: 100,
    shield: isClash ? 40 : 0,
    armorLevel: isClash ? 2 : 0,
    helmetLevel: isClash ? 2 : 0,
    alive: true,
    deadAt: 0,
    kills: 0,
    damageDealt: 0,
    slots,
    activeSlot,
    weaponId: startWeapon,
    ammo: startMag,
    reserveAmmo: startMag * 4,
    medkits: isClash ? 2 : 1,
    grenades: isClash ? 1 : 0,
    inPlane,
    parachuting: false,
    crouching: false,
    prone: false,
    swimming: false,
    climbing: false,
    aiming: false,
    vehicleId: null,
    lastShotAt: 0,
    reloadingUntil: 0,
    abilityCooldownUntil: 0,
    abilityActiveUntil: 0,
    shieldActive: false,
    damageReduction: 0,
    reconUntil: 0,
    healUntil: 0,
    botTargetYaw: Math.random() * Math.PI * 2,
    botNextDecisionAt: Date.now() + 800 + Math.random() * 1400,
    inputMoveX: 0,
    inputMoveZ: 0,
    inputSprint: false,
    inputJump: false,
    inputCrouch: false,
    inputProne: false,
    inputFire: false,
    inputAim: false,
  };
}

const BOT_CALLSIGNS = [
  'ShadowViper', 'EmberWolf', 'Kestrel_99', 'ApexGhost', 'SolarisFury',
  'RazorEdge', 'ObsidianX', 'VortexKid', 'NovaStrike', 'BlazePulse',
  'CipherZero', 'IronHawk', 'CrimsonFox', 'FrostBite', 'RogueTitan',
  'ValiantAce', 'NightReaper', 'EchoSniper', 'StormRider', 'AshRunner',
];

function createRoom(mode: string, customCode?: string): MatchRoom {
  const id = `room_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const code = customCode || Math.random().toString(36).slice(2, 8).toUpperCase();
  const now = Date.now();
  const isBr = mode.startsWith('br') || mode === 'custom';
  const totalBots = mode === 'clash_squad' ? 7 : mode === 'training' ? 11 : 49;

  const room: MatchRoom = {
    id,
    code,
    mode,
    phase: isBr ? 'plane' : 'active',
    createdAt: now,
    planeTime: 0,
    planeStart: { x: -175, z: -155 },
    planeEnd: { x: 175, z: 155 },
    zoneX: 0,
    zoneZ: 0,
    zoneRadius: WORLD_RADIUS,
    targetZoneX: (Math.random() - 0.5) * 45,
    targetZoneZ: (Math.random() - 0.5) * 45,
    targetZoneRadius: mode === 'clash_squad' ? 75 : 135,
    zonePhase: 1,
    zonePhaseEndsAt: now + 38000,
    clashRound: 1,
    clashScoreA: 0,
    clashScoreB: 0,
    actors: new Map(),
    loot: createInitialLoot(),
    vehicles: createInitialVehicles(),
    grenades: [],
    killFeed: [],
    totalEliminations: 0,
  };

  for (let i = 0; i < totalBots; i++) {
    const botId = `bot_${i}_${id.slice(-4)}`;
    const team = mode === 'clash_squad' ? (i < 3 ? 0 : 1) : mode === 'br_duo' ? Math.floor(i / 2) + 1 : mode === 'br_squad' ? Math.floor(i / 4) + 1 : i + 1;
    const callsign = `${BOT_CALLSIGNS[i % BOT_CALLSIGNS.length]}_${10 + i}`;
    const bot = createActor(botId, true, callsign, team, undefined, mode, i);
    if (isBr) {
      // Bots drop across the plane path with slight offsets
      bot.botNextDecisionAt = now + 1500 + (i % 14) * 650;
    }
    room.actors.set(botId, bot);
  }

  totalMatchesPlayed++;
  rooms.set(id, room);
  return room;
}

function broadcastRoom(room: MatchRoom, payload: unknown) {
  const raw = JSON.stringify(payload);
  for (const client of clients.values()) {
    if (client.roomId === room.id && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(raw);
    }
  }
}

function broadcastGlobal(payload: unknown) {
  const raw = JSON.stringify(payload);
  for (const client of clients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(raw);
    }
  }
}

function applyDamage(room: MatchRoom, attacker: ActorState, victim: ActorState, rawDmg: number, weaponName: string, headshot: boolean) {
  if (!victim.alive || room.phase === 'ended') return;

  // Training bots respawn automatically
  const armorMit = headshot
    ? Math.max(0.55, 1 - victim.helmetLevel * 0.14)
    : Math.max(0.55, 1 - victim.armorLevel * 0.15);
  const stanceMit = 1 - victim.damageReduction;
  let dmg = Math.round(rawDmg * armorMit * stanceMit);
  if (dmg < 1) dmg = 1;

  attacker.damageDealt += dmg;

  if (victim.shield > 0) {
    const absorbed = Math.min(victim.shield, dmg);
    victim.shield -= absorbed;
    dmg -= absorbed;
  }
  victim.hp = Math.max(0, victim.hp - dmg);

  // Notify attacker hitmarker
  const attackerClient = clients.get(attacker.id);
  if (attackerClient && attackerClient.ws.readyState === WebSocket.OPEN) {
    attackerClient.ws.send(JSON.stringify({
      type: 'match:hit',
      targetId: victim.id,
      damage: dmg,
      headshot,
      killed: victim.hp <= 0,
    }));
  }

  if (victim.hp <= 0) {
    victim.alive = false;
    victim.deadAt = Date.now();
    victim.vehicleId = null;
    attacker.kills += 1;
    room.totalEliminations += 1;

    room.killFeed.unshift({
      id: `kf_${Date.now()}_${Math.random()}`,
      killer: attacker.username,
      victim: victim.username,
      weapon: weaponName,
      headshot,
      ts: Date.now(),
    });
    if (room.killFeed.length > 6) room.killFeed.pop();

    // Training bot auto-respawn
    if (room.mode === 'training' && victim.isBot) {
      setTimeout(() => {
        if (!rooms.has(room.id)) return;
        victim.alive = true;
        victim.deadAt = 0;
        victim.hp = 100;
        victim.shield = 0;
      }, 2500);
    }
  }
}

function fireWeapon(room: MatchRoom, shooter: ActorState) {
  const now = Date.now();
  const w = getEffectiveWeaponStats(shooter, shooter.weaponId);
  if (shooter.reloadingUntil > now || now - shooter.lastShotAt < w.fireRateMs) return;
  if (shooter.ammo <= 0) {
    if (shooter.reserveAmmo > 0) {
      shooter.reloadingUntil = now + w.reloadTimeMs;
    }
    return;
  }

  shooter.lastShotAt = now;
  shooter.ammo -= 1;
  syncActiveSlotToActor(shooter);

  const eyeY = shooter.y + (shooter.prone ? 0.38 : shooter.crouching ? 1.1 : 1.58);
  const cosPitch = Math.cos(shooter.pitch);
  const baseDx = -Math.sin(shooter.yaw) * cosPitch;
  const baseDy = Math.sin(shooter.pitch);
  const baseDz = -Math.cos(shooter.yaw) * cosPitch;

  const spreadFactor = (shooter.prone ? 0.65 : 1.0) * w.recoilFactor;
  const spread = ((100 - w.accuracy) / 100) * (shooter.aiming ? 0.025 : 0.065) * spreadFactor;

  const tracerTargets: Array<{ x: number; y: number; z: number }> = [];

  for (let p = 0; p < w.pellets; p++) {
    const dx = baseDx + (Math.random() - 0.5) * spread;
    const dy = baseDy + (Math.random() - 0.5) * spread * 0.7;
    const dz = baseDz + (Math.random() - 0.5) * spread;
    const len = Math.hypot(dx, dy, dz) || 1;
    const ndx = dx / len;
    const ndy = dy / len;
    const ndz = dz / len;

    const wallDist = rayIntersectsBuilding(shooter.x, eyeY, shooter.z, ndx, ndy, ndz, w.range);
    let maxDist = wallDist !== null ? wallDist : w.range;

    let hitActor: ActorState | null = null;
    let hitDist = maxDist;
    let isHeadshot = false;

    for (const target of room.actors.values()) {
      if (!target.alive || target.id === shooter.id || target.inPlane) continue;
      if (room.mode !== 'br_solo' && room.mode !== 'training' && target.team === shooter.team) continue;

      const targetHeight = target.prone ? 0.52 : target.crouching ? 1.35 : 1.85;
      const toTargetX = target.x - shooter.x;
      const toTargetZ = target.z - shooter.z;
      const tProj = toTargetX * ndx + (target.y + targetHeight * 0.55 - eyeY) * ndy + toTargetZ * ndz;
      if (tProj <= 0 || tProj >= hitDist) continue;

      const rayX = shooter.x + ndx * tProj;
      const rayY = eyeY + ndy * tProj;
      const rayZ = shooter.z + ndz * tProj;

      const horizDist = Math.hypot(rayX - target.x, rayZ - target.z);
      if (horizDist <= 0.62 && rayY >= target.y && rayY <= target.y + targetHeight) {
        hitDist = tProj;
        hitActor = target;
        isHeadshot = rayY >= target.y + targetHeight - 0.34;
      }
    }

    tracerTargets.push({
      x: shooter.x + ndx * hitDist,
      y: eyeY + ndy * hitDist,
      z: shooter.z + ndz * hitDist,
    });

    if (hitActor) {
      const dmg = w.damage * (isHeadshot ? w.headshotMult : 1);
      applyDamage(room, shooter, hitActor, dmg, w.name, isHeadshot);
    }
  }

  broadcastRoom(room, {
    type: 'match:shot',
    shooterId: shooter.id,
    weaponId: w.id,
    origin: { x: shooter.x, y: eyeY, z: shooter.z },
    targets: tracerTargets,
  });
}

// 20Hz Authoritative Simulation Loop
setInterval(() => {
  const now = Date.now();
  const dt = 0.05;

  for (const room of rooms.values()) {
    if (room.phase === 'ended') continue;

    // 1. Cargo plane progression (18s flight across island)
    if (room.phase === 'plane') {
      room.planeTime += dt;
      const t = Math.min(1, room.planeTime / 18);
      const px = room.planeStart.x + (room.planeEnd.x - room.planeStart.x) * t;
      const pz = room.planeStart.z + (room.planeEnd.z - room.planeStart.z) * t;

      for (const a of room.actors.values()) {
        if (a.inPlane) {
          a.x = px;
          a.z = pz;
          a.y = 78;
          if (t >= 0.96 || (a.isBot && now >= a.botNextDecisionAt)) {
            a.inPlane = false;
            a.parachuting = true;
            a.vx = (Math.random() - 0.5) * 8;
            a.vz = (Math.random() - 0.5) * 8;
          }
        }
      }

      if (t >= 1) {
        room.phase = 'active';
      }
    }

    // 2. Shrinking Safe Zone (BR modes)
    if (room.mode.startsWith('br') || room.mode === 'custom') {
      if (now >= room.zonePhaseEndsAt && room.zonePhase < 5) {
        room.zonePhase += 1;
        room.zonePhaseEndsAt = now + 28000;
        room.targetZoneRadius = Math.max(18, room.targetZoneRadius * 0.58);
      }
      // Smoothly shrink current zone toward target zone
      if (room.zoneRadius > room.targetZoneRadius) {
        room.zoneRadius = Math.max(room.targetZoneRadius, room.zoneRadius - dt * 2.1);
        room.zoneX += (room.targetZoneX - room.zoneX) * dt * 0.15;
        room.zoneZ += (room.targetZoneZ - room.zoneZ) * dt * 0.15;
      }
    }

    // 3. Grenades physics & explosions
    for (let i = room.grenades.length - 1; i >= 0; i--) {
      const g = room.grenades[i];
      g.x += g.vx * dt;
      g.z += g.vz * dt;
      g.y += g.vy * dt;
      g.vy -= 18 * dt;
      const floor = groundHeightAt(g.x, g.z);
      if (g.y < floor + 0.15) {
        g.y = floor + 0.15;
        g.vy = Math.abs(g.vy) * 0.35;
        g.vx *= 0.65;
        g.vz *= 0.65;
      }
      if (now >= g.explodeAt) {
        const owner = room.actors.get(g.ownerId);
        for (const a of room.actors.values()) {
          if (!a.alive || a.inPlane) continue;
          const dist = Math.hypot(a.x - g.x, a.z - g.z);
          if (dist < 11) {
            const dmg = Math.round(92 * (1 - dist / 11));
            if (owner) applyDamage(room, owner, a, dmg, 'Frag Grenade', false);
          }
        }
        broadcastRoom(room, { type: 'match:explosion', x: g.x, y: g.y, z: g.z });
        room.grenades.splice(i, 1);
      }
    }

    // 4. Update all actors (Humans + Tactical Bots)
    for (const a of room.actors.values()) {
      if (!a.alive) continue;

      // Finish reload
      if (a.reloadingUntil > 0 && now >= a.reloadingUntil) {
        const w = getEffectiveWeaponStats(a, a.weaponId);
        const needed = w.magSize - a.ammo;
        const take = Math.min(needed, a.reserveAmmo);
        a.ammo += take;
        a.reserveAmmo -= take;
        a.reloadingUntil = 0;
        syncActiveSlotToActor(a);
      }

      // Finish heal
      if (a.healUntil > 0 && now >= a.healUntil) {
        a.hp = Math.min(a.maxHp, a.hp + 60);
        a.healUntil = 0;
      }

      if (a.abilityActiveUntil > 0 && now >= a.abilityActiveUntil) {
        a.shieldActive = false;
        a.damageReduction = 0;
        a.abilityActiveUntil = 0;
      }

      if (a.inPlane) continue;

      // Parachute descent (only while actively parachuting or dropping from high altitude > 6m above ground)
      const floorNow = surfaceHeightAt(a.x, a.z, a.y);
      if (a.parachuting || (a.y > floorNow + 5.0 && a.vy <= 0 && !a.grounded)) {
        const descentRate = a.parachuting ? 11.5 : 22;
        a.y -= descentRate * dt;
        a.grounded = false;
        if (a.y < 32) a.parachuting = true;

        if (a.isBot) {
          a.x += (room.zoneX - a.x) * 0.02 * dt + a.vx * dt;
          a.z += (room.zoneZ - a.z) * 0.02 * dt + a.vz * dt;
        } else {
          const sin = Math.sin(a.yaw);
          const cos = Math.cos(a.yaw);
          const fx = -sin * a.inputMoveZ + cos * a.inputMoveX;
          const fz = -cos * a.inputMoveZ - sin * a.inputMoveX;
          a.x += fx * 12 * dt;
          a.z += fz * 12 * dt;
        }

        const newFloor = surfaceHeightAt(a.x, a.z, a.y);
        if (a.y <= newFloor) {
          a.y = newFloor;
          a.vy = 0;
          a.grounded = true;
          a.parachuting = false;
        }
        continue;
      }

      // Driving vehicle
      if (a.vehicleId) {
        const veh = room.vehicles.find((v) => v.id === a.vehicleId);
        if (veh) {
          const accel = a.inputMoveZ * 26;
          veh.speed = Math.max(-10, Math.min(25, veh.speed * 0.96 + accel * dt));
          veh.rotY -= a.inputMoveX * 1.9 * dt * (veh.speed >= 0 ? 1 : -1);
          const nx = veh.x - Math.sin(veh.rotY) * veh.speed * dt;
          const nz = veh.z - Math.cos(veh.rotY) * veh.speed * dt;
          const col = resolveBuildingCollision(nx, nz, 1.8, veh.y);
          veh.x = Math.max(-WORLD_RADIUS + 8, Math.min(WORLD_RADIUS - 8, col.x));
          veh.z = Math.max(-WORLD_RADIUS + 8, Math.min(WORLD_RADIUS - 8, col.z));
          veh.y = Math.max(WATER_LEVEL, surfaceHeightAt(veh.x, veh.z, veh.y));
          a.x = veh.x;
          a.y = veh.y + 0.6;
          a.z = veh.z;
          a.yaw = veh.rotY;
          continue;
        } else {
          a.vehicleId = null;
        }
      }

      // Bot tactical AI
      if (a.isBot) {
        // Training bots stay near range and strafe gently
        if (room.mode === 'training') {
          a.x += Math.sin(now * 0.001 + a.team) * 2.2 * dt;
          a.y = groundHeightAt(a.x, a.z);
          continue;
        }

        // Auto-loot nearby items
        for (const l of room.loot) {
          if (!l.taken && Math.hypot(l.x - a.x, l.z - a.z) < 3.2) {
            l.taken = true;
            if (l.kind === 'weapon' && l.weaponId) {
              const ws = getEffectiveWeaponStats(a, l.weaponId);
              a.weaponId = l.weaponId;
              a.ammo = ws.magSize;
              a.reserveAmmo = ws.magSize * 4;
              a.slots[0] = { weaponId: l.weaponId, ammo: ws.magSize, reserveAmmo: ws.magSize * 4 };
              a.activeSlot = 0;
            } else if (l.kind === 'ammo') {
              a.reserveAmmo += 45;
              syncActiveSlotToActor(a);
            } else if (l.kind === 'armor') {
              a.armorLevel = Math.max(a.armorLevel, l.level || 1);
            } else if (l.kind === 'helmet') {
              a.helmetLevel = Math.max(a.helmetLevel, l.level || 1);
            }
          }
        }

        // Find nearest visible enemy
        let nearest: ActorState | null = null;
        let nearestDist = 72;
        for (const other of room.actors.values()) {
          if (!other.alive || other.id === a.id || other.inPlane) continue;
          if (room.mode !== 'br_solo' && other.team === a.team) continue;
          const d = Math.hypot(other.x - a.x, other.z - a.z);
          if (d < nearestDist) {
            nearestDist = d;
            nearest = other;
          }
        }

        if (nearest) {
          a.yaw = Math.atan2(-(nearest.x - a.x), -(nearest.z - a.z));
          a.pitch = 0.02 * (Math.random() - 0.5);
          if (nearestDist > 16) {
            const step = 5.4 * dt;
            a.x += -Math.sin(a.yaw) * step;
            a.z += -Math.cos(a.yaw) * step;
          } else {
            // Strafe in combat
            const strafe = Math.sin(now * 0.002 + a.team) * 3.8 * dt;
            a.x += Math.cos(a.yaw) * strafe;
            a.z -= Math.sin(a.yaw) * strafe;
          }
          if (Math.random() < 0.22) {
            fireWeapon(room, a);
          }
        } else {
          // Move toward safe zone
          const distToZone = Math.hypot(a.x - room.zoneX, a.z - room.zoneZ);
          if (distToZone > room.zoneRadius * 0.72) {
            a.botTargetYaw = Math.atan2(-(room.zoneX - a.x), -(room.zoneZ - a.z));
          } else if (now >= a.botNextDecisionAt) {
            a.botTargetYaw += (Math.random() - 0.5) * 1.6;
            a.botNextDecisionAt = now + 1800 + Math.random() * 2000;
          }
          a.yaw = a.botTargetYaw;
          const speed = 5.8 * dt;
          a.x += -Math.sin(a.yaw) * speed;
          a.z += -Math.cos(a.yaw) * speed;
        }
      } else {
        // Human movement (Walk, Run, Sprint, Jump, Crouch, Prone, Swim, Climb)
        const surfCheck = surfaceHeightAt(a.x, a.z, a.y);
        a.swimming = surfCheck < WATER_LEVEL - 0.18;
        a.prone = !a.swimming && a.inputProne;
        a.crouching = !a.swimming && !a.prone && a.inputCrouch;
        a.aiming = !a.swimming && a.inputAim;
        if (a.inputJump && a.grounded && !a.swimming && !a.prone) {
          a.vy = 8.6;
          a.grounded = false;
          a.crouching = false;
        }
        const speedBoost = a.abilityActiveUntil > now && a.character === 'valkyrie' ? 1.25 : 1.0;
        const baseSpeed = a.swimming
          ? 3.8
          : a.prone
            ? 2.4
            : a.crouching
              ? 4.2
              : a.inputSprint && !a.aiming
                ? 9.6
                : 6.8;
        const moveLen = Math.hypot(a.inputMoveX, a.inputMoveZ);
        if (moveLen > 0.05) {
          const nx = a.inputMoveX / Math.max(1, moveLen);
          const nz = a.inputMoveZ / Math.max(1, moveLen);
          const sin = Math.sin(a.yaw);
          const cos = Math.cos(a.yaw);
          const wx = -sin * nz + cos * nx;
          const wz = -cos * nz - sin * nx;
          a.x += wx * baseSpeed * speedBoost * dt;
          a.z += wz * baseSpeed * speedBoost * dt;
        }
        if (a.inputFire && !a.swimming) {
          fireWeapon(room, a);
        }
      }

      // Building + World perimeter collision + Vertical Jump Gravity Physics
      const prevY = a.y;
      const col = resolveBuildingCollision(a.x, a.z, 0.55, prevY);
      a.x = Math.max(-WORLD_RADIUS + 5, Math.min(WORLD_RADIUS - 5, col.x));
      a.z = Math.max(-WORLD_RADIUS + 5, Math.min(WORLD_RADIUS - 5, col.z));
      const nextSurf = surfaceHeightAt(a.x, a.z, prevY);
      a.swimming = nextSurf < WATER_LEVEL - 0.18;
      if (a.swimming) {
        a.y = WATER_LEVEL - 0.55;
        a.vy = 0;
        a.grounded = true;
        a.climbing = false;
      } else {
        a.vy -= 22 * dt;
        const integratedY = prevY + a.vy * dt;
        if (integratedY <= nextSurf + 0.04) {
          a.climbing = nextSurf - prevY > 0.08 && !a.isBot && a.vy <= 0;
          a.y = nextSurf;
          a.vy = 0;
          a.grounded = true;
        } else {
          a.y = integratedY;
          a.grounded = false;
          a.climbing = false;
        }
      }

      // Storm Zone Damage
      if (room.mode.startsWith('br') || room.mode === 'custom') {
        const distFromZone = Math.hypot(a.x - room.zoneX, a.z - room.zoneZ);
        if (distFromZone > room.zoneRadius) {
          a.hp = Math.max(0, a.hp - (1.8 + room.zonePhase * 0.9) * dt);
          if (a.hp <= 0) {
            a.alive = false;
            a.deadAt = now;
            room.totalEliminations += 1;
            room.killFeed.unshift({
              id: `kf_${now}_${a.id}`,
              killer: 'Ember Storm',
              victim: a.username,
              weapon: 'Storm Zone',
              headshot: false,
              ts: now,
            });
          }
        }
      }
    }

    // 5. Check Match Win Condition
    const aliveActors = Array.from(room.actors.values()).filter((a) => a.alive);
    const aliveHumans = aliveActors.filter((a) => !a.isBot);

    if (room.mode === 'clash_squad') {
      const aliveA = aliveActors.filter((a) => a.team === 0).length;
      const aliveB = aliveActors.filter((a) => a.team === 1).length;
      if (aliveA === 0 || aliveB === 0) {
        if (aliveB === 0) room.clashScoreA += 1;
        else room.clashScoreB += 1;

        if (room.clashScoreA >= 3 || room.clashScoreB >= 3) {
          room.phase = 'ended';
          const winTeam = room.clashScoreA >= 3 ? 0 : 1;
          broadcastRoom(room, {
            type: 'match:ended',
            winnerTeam: winTeam,
            winnerName: winTeam === 0 ? 'Vanguard Alpha' : 'Obsidian Bravo',
            clashScoreA: room.clashScoreA,
            clashScoreB: room.clashScoreB,
          });
        } else {
          // Reset round
          room.clashRound += 1;
          let slotA = 0;
          let slotB = 0;
          for (const a of room.actors.values()) {
            const arr = a.team === 0 ? CLASH_ARENA_SPAWNS.teamA : CLASH_ARENA_SPAWNS.teamB;
            const pt = arr[(a.team === 0 ? slotA++ : slotB++) % arr.length];
            a.x = pt.x;
            a.z = pt.z;
            a.y = groundHeightAt(pt.x, pt.z);
            a.hp = 100;
            a.shield = 40;
            a.alive = true;
          }
        }
      }
    } else if (room.mode !== 'training' && room.phase === 'active') {
      const aliveTeams = new Set(aliveActors.map((a) => a.team));
      if (aliveTeams.size <= 1 || (aliveHumans.length === 0 && now - room.createdAt > 15000)) {
        room.phase = 'ended';
        const winner = aliveActors[0];
        broadcastRoom(room, {
          type: 'match:ended',
          winnerTeam: winner ? winner.team : 1,
          winnerName: winner ? winner.username : 'Ember Survivor',
        });
      }
    }

    // 6. Broadcast 20Hz Authoritative Snapshot
    const snapshot = {
      type: 'match:state',
      phase: room.phase,
      planeTime: room.planeTime,
      planePos: {
        x: room.planeStart.x + (room.planeEnd.x - room.planeStart.x) * Math.min(1, room.planeTime / 18),
        y: 78,
        z: room.planeStart.z + (room.planeEnd.z - room.planeStart.z) * Math.min(1, room.planeTime / 18),
      },
      zone: {
        x: room.zoneX,
        z: room.zoneZ,
        radius: room.zoneRadius,
        targetRadius: room.targetZoneRadius,
        phase: room.zonePhase,
        secsLeft: Math.max(0, Math.ceil((room.zonePhaseEndsAt - now) / 1000)),
      },
      clash: {
        round: room.clashRound,
        scoreA: room.clashScoreA,
        scoreB: room.clashScoreB,
      },
      aliveCount: aliveActors.length,
      totalCount: room.actors.size,
      killFeed: room.killFeed,
      actors: Array.from(room.actors.values()).map((a) => ({
        id: a.id,
        isBot: a.isBot,
        username: a.username,
        team: a.team,
        character: a.character,
        outfit: a.outfit,
        hair: a.hair,
        accessory: a.accessory,
        x: Number(a.x.toFixed(2)),
        y: Number(a.y.toFixed(2)),
        z: Number(a.z.toFixed(2)),
        yaw: Number(a.yaw.toFixed(3)),
        hp: Math.round(a.hp),
        maxHp: Math.round(a.maxHp),
        shield: Math.round(a.shield),
        armorLevel: a.armorLevel,
        helmetLevel: a.helmetLevel,
        alive: a.alive,
        deadAt: a.deadAt,
        kills: a.kills,
        damageDealt: a.damageDealt,
        weaponId: a.weaponId,
        skinId: a.equippedSkins?.[a.weaponId] || '',
        activeSlot: a.activeSlot,
        slots: a.slots,
        ammo: a.ammo,
        reserveAmmo: a.reserveAmmo,
        medkits: a.medkits,
        grenades: a.grenades,
        inPlane: a.inPlane,
        parachuting: a.parachuting,
        jumping: !a.grounded && !a.parachuting && !a.swimming && !a.inPlane,
        crouching: a.crouching,
        prone: a.prone,
        swimming: a.swimming,
        climbing: a.climbing,
        aiming: a.aiming,
        vehicleId: a.vehicleId,
        reloading: a.reloadingUntil > now,
        healing: a.healUntil > now,
        shieldActive: a.shieldActive,
        reconActive: a.reconUntil > now,
        abilityCooldownSec: Math.max(0, Math.ceil((a.abilityCooldownUntil - now) / 1000)),
      })),
      loot: room.loot.filter((l) => !l.taken),
      vehicles: room.vehicles,
      grenades: room.grenades.map((g) => ({ id: g.id, x: g.x, y: g.y, z: g.z })),
    };
    broadcastRoom(room, snapshot);
  }
}, 50);

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, clients: clients.size, rooms: rooms.size });
  });

  app.get('/api/admin/server-stats', (_req, res) => {
    const activeRooms = Array.from(rooms.values()).map((r) => ({
      id: r.id,
      code: r.code,
      mode: r.mode,
      phase: r.phase,
      alive: Array.from(r.actors.values()).filter((a) => a.alive).length,
      humans: Array.from(r.actors.values()).filter((a) => !a.isBot).length,
      eliminations: r.totalEliminations,
    }));
    res.json({
      connectedPlayers: clients.size,
      activeRoomsCount: rooms.size,
      totalMatchesPlayed,
      uptimeSec: Math.floor(process.uptime()),
      rooms: activeRooms,
    });
  });

  app.post('/api/payments/checkout', (req, res) => {
    const { uid, itemId, amountUsd } = req.body || {};
    if (!uid || !itemId) {
      res.status(400).json({ error: 'Missing checkout parameters' });
      return;
    }
    res.json({
      verified: true,
      receiptId: `RCP-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      amountUsd: Number(amountUsd || 0),
    });
  });

  app.get('/api/admin/balance', (_req, res) => {
    res.json({ weaponDamage: liveWeaponDamage });
  });

  app.post('/api/admin/balance', (req, res) => {
    const { weapons } = req.body || {};
    if (weapons && typeof weapons === 'object') {
      for (const [k, v] of Object.entries(weapons)) {
        if (WEAPONS[k] && typeof v === 'number' && v >= 5 && v <= 200) {
          liveWeaponDamage[k] = v;
        }
      }
    }
    res.json({ ok: true, weaponDamage: liveWeaponDamage });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    let clientId = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    ws.on('message', (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString());

        if (msg.type === 'auth') {
          clientId = msg.uid || clientId;
          clients.set(clientId, {
            ws,
            uid: clientId,
            playerId: msg.playerId || 'EFR-0000',
            username: msg.username || 'Survivor',
            character: msg.character || 'valkyrie',
            weapon: msg.weapon || 'ak47_ember',
            outfit: msg.outfit || 'outfit_default',
            hair: msg.hair || 'hair_tactical',
            accessory: msg.accessory || 'acc_standard',
            equippedSkins: (msg.equippedSkins && typeof msg.equippedSkins === 'object') ? msg.equippedSkins : {},
            attachments: Array.isArray(msg.attachments) ? msg.attachments : [],
            rankTier: msg.rankTier || 'Bronze',
            roomId: null,
          });
          ws.send(JSON.stringify({ type: 'auth:ok', onlineCount: clients.size }));
          return;
        }

        const client = clients.get(clientId);
        if (!client) return;

        if (msg.type === 'queue:join') {
          const mode = msg.mode || 'br_solo';
          const customCode = msg.roomCode ? String(msg.roomCode).toUpperCase().trim() : undefined;

          // Update latest loadout metadata
          if (msg.character) client.character = msg.character;
          if (msg.weapon) client.weapon = msg.weapon;
          if (msg.outfit) client.outfit = msg.outfit;
          if (msg.hair) client.hair = msg.hair;
          if (msg.accessory) client.accessory = msg.accessory;
          if (msg.equippedSkins && typeof msg.equippedSkins === 'object') client.equippedSkins = msg.equippedSkins;
          if (Array.isArray(msg.attachments)) client.attachments = msg.attachments;

          let targetRoom: MatchRoom | undefined;
          if (customCode) {
            targetRoom = Array.from(rooms.values()).find((r) => r.code === customCode && r.phase !== 'ended');
          } else {
            targetRoom = Array.from(rooms.values()).find(
              (r) => r.mode === mode && r.phase !== 'ended' && (r.phase === 'plane' || mode === 'training'),
            );
          }

          if (!targetRoom) {
            targetRoom = createRoom(mode, customCode);
          }

          client.roomId = targetRoom.id;
          const humanCount = Array.from(targetRoom.actors.values()).filter((a) => !a.isBot).length;
          const team = mode === 'clash_squad' ? humanCount % 2 : 0;
          const actor = createActor(client.uid, false, client.username, team, client, mode, humanCount);
          targetRoom.actors.set(client.uid, actor);

          ws.send(JSON.stringify({
            type: 'match:joined',
            roomId: targetRoom.id,
            roomCode: targetRoom.code,
            mode: targetRoom.mode,
            selfId: client.uid,
          }));
          return;
        }

        if (msg.type === 'match:leave') {
          if (client.roomId) {
            const room = rooms.get(client.roomId);
            if (room) {
              const actor = room.actors.get(client.uid);
              if (actor) actor.alive = false;
              const remainingHumans = Array.from(room.actors.values()).filter((a) => !a.isBot && a.alive).length;
              if (remainingHumans === 0 && room.phase === 'ended') {
                rooms.delete(room.id);
              }
            }
            client.roomId = null;
          }
          return;
        }

        if (msg.type === 'chat:send') {
          const text = String(msg.text || '').slice(0, 180).trim();
          if (!text) return;
          const chatEvent = {
            type: 'chat:message',
            id: `msg_${Date.now()}_${Math.random()}`,
            senderId: client.uid,
            senderName: client.username,
            channel: msg.channel || 'lobby',
            text,
            ts: Date.now(),
          };
          if (msg.channel === 'match' && client.roomId) {
            const room = rooms.get(client.roomId);
            if (room) broadcastRoom(room, chatEvent);
          } else {
            broadcastGlobal(chatEvent);
          }
          return;
        }

        if (msg.type === 'voice:signal') {
          const target = clients.get(msg.targetUid);
          if (target && target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(JSON.stringify({
              type: 'voice:signal',
              fromUid: client.uid,
              fromName: client.username,
              signal: msg.signal,
            }));
          } else if (client.roomId) {
            const room = rooms.get(client.roomId);
            if (room) {
              broadcastRoom(room, {
                type: 'voice:activity',
                uid: client.uid,
                username: client.username,
                speaking: Boolean(msg.speaking),
              });
            }
          }
          return;
        }

        if (!client.roomId) return;
        const room = rooms.get(client.roomId);
        if (!room) return;
        const actor = room.actors.get(client.uid);
        if (!actor || !actor.alive) return;

        if (msg.type === 'match:input') {
          actor.inputMoveX = Number(msg.moveX || 0);
          actor.inputMoveZ = Number(msg.moveZ || 0);
          actor.yaw = Number(msg.yaw ?? actor.yaw);
          actor.pitch = Number(msg.pitch ?? actor.pitch);
          actor.inputSprint = Boolean(msg.sprint);
          actor.inputJump = Boolean(msg.jump);
          actor.inputCrouch = Boolean(msg.crouch);
          actor.inputProne = Boolean(msg.prone);
          actor.inputFire = Boolean(msg.fire);
          actor.inputAim = Boolean(msg.aim);

          if (msg.jumpOut && actor.inPlane) {
            actor.inPlane = false;
            actor.parachuting = true;
            actor.grounded = false;
          }
          if (msg.deployChute && !actor.inPlane && actor.y > groundHeightAt(actor.x, actor.z) + 4) {
            actor.parachuting = true;
          }
        } else if (msg.type === 'match:action') {
          const now = Date.now();
          if (msg.action === 'reload') {
            const w = getEffectiveWeaponStats(actor, actor.weaponId);
            if (actor.ammo < w.magSize && actor.reserveAmmo > 0 && actor.reloadingUntil === 0) {
              actor.reloadingUntil = now + w.reloadTimeMs;
            }
          } else if (msg.action === 'pickup') {
            let best: LootItemState | null = null;
            let bestDist = 4.2;
            for (const l of room.loot) {
              if (l.taken) continue;
              const d = Math.hypot(l.x - actor.x, l.z - actor.z);
              if (d < bestDist) {
                bestDist = d;
                best = l;
              }
            }
            if (best) {
              best.taken = true;
              if (best.kind === 'weapon' && best.weaponId) {
                const w = getEffectiveWeaponStats(actor, best.weaponId);
                const newSlot: WeaponSlotState = {
                  weaponId: best.weaponId,
                  ammo: w.magSize,
                  reserveAmmo: w.magSize * 4,
                };
                if (w.category === 'pistol') {
                  actor.slots[2] = newSlot;
                  selectActorSlot(actor, 2);
                } else if (!actor.slots[0]) {
                  actor.slots[0] = newSlot;
                  selectActorSlot(actor, 0);
                } else if (!actor.slots[1]) {
                  actor.slots[1] = newSlot;
                  selectActorSlot(actor, 1);
                } else {
                  const targetSlot = actor.activeSlot < 2 ? actor.activeSlot : 0;
                  actor.slots[targetSlot] = newSlot;
                  selectActorSlot(actor, targetSlot);
                }
              } else if (best.kind === 'ammo') {
                actor.reserveAmmo += 45;
                syncActiveSlotToActor(actor);
              } else if (best.kind === 'medkit') {
                actor.medkits += 1;
              } else if (best.kind === 'armor') {
                actor.armorLevel = Math.max(actor.armorLevel, best.level || 1);
              } else if (best.kind === 'helmet') {
                actor.helmetLevel = Math.max(actor.helmetLevel, best.level || 1);
              } else if (best.kind === 'grenade') {
                actor.grenades += 2;
              }
              ws.send(JSON.stringify({ type: 'match:looted', label: best.label }));
            }
          } else if (msg.action === 'switch_slot' && typeof msg.slot === 'number') {
            selectActorSlot(actor, msg.slot);
          } else if (msg.action === 'drop_weapon' && typeof msg.slot === 'number') {
            if (msg.slot >= 0 && msg.slot <= 1 && actor.slots[msg.slot]) {
              actor.slots[msg.slot] = null;
              const fallbackSlot = actor.slots.findIndex((s) => s !== null);
              if (fallbackSlot >= 0) selectActorSlot(actor, fallbackSlot);
            }
          } else if (msg.action === 'switch_weapon' && msg.weaponId && WEAPONS[msg.weaponId]) {
            const existingIdx = actor.slots.findIndex((s) => s?.weaponId === msg.weaponId);
            if (existingIdx >= 0) {
              selectActorSlot(actor, existingIdx);
            } else {
              const w = getEffectiveWeaponStats(actor, msg.weaponId);
              const targetSlot = w.category === 'pistol' ? 2 : 0;
              actor.slots[targetSlot] = { weaponId: msg.weaponId, ammo: w.magSize, reserveAmmo: w.magSize * 4 };
              selectActorSlot(actor, targetSlot);
            }
          } else if (msg.action === 'medkit') {
            if (actor.medkits > 0 && actor.hp < actor.maxHp && actor.healUntil === 0) {
              actor.medkits -= 1;
              actor.healUntil = now + 2200;
            }
          } else if (msg.action === 'grenade') {
            if (actor.grenades > 0) {
              actor.grenades -= 1;
              const speed = 22;
              room.grenades.push({
                id: `gr_${now}_${Math.random()}`,
                ownerId: actor.id,
                x: actor.x,
                y: actor.y + 1.5,
                z: actor.z,
                vx: -Math.sin(actor.yaw) * speed,
                vy: 7.5 + Math.sin(actor.pitch) * 6,
                vz: -Math.cos(actor.yaw) * speed,
                explodeAt: now + 2200,
              });
            }
          } else if (msg.action === 'ability') {
            if (now >= actor.abilityCooldownUntil) {
              if (actor.character === 'valkyrie') {
                actor.shield = Math.min(60, actor.shield + 45);
                actor.shieldActive = true;
                actor.abilityActiveUntil = now + 5000;
                actor.abilityCooldownUntil = now + 22000;
              } else if (actor.character === 'kuro') {
                const dashDist = 11;
                const nx = actor.x - Math.sin(actor.yaw) * dashDist;
                const nz = actor.z - Math.cos(actor.yaw) * dashDist;
                const col = resolveBuildingCollision(nx, nz, 0.55, actor.y);
                actor.x = col.x;
                actor.z = col.z;
                actor.y = surfaceHeightAt(actor.x, actor.z, actor.y);
                actor.abilityActiveUntil = now + 2500;
                actor.abilityCooldownUntil = now + 14000;
              } else if (actor.character === 'titan') {
                actor.damageReduction = 0.35;
                actor.shieldActive = true;
                actor.abilityActiveUntil = now + 6000;
                actor.abilityCooldownUntil = now + 24000;
              } else if (actor.character === 'nova') {
                actor.reconUntil = now + 6000;
                actor.abilityActiveUntil = now + 6000;
                actor.abilityCooldownUntil = now + 20000;
              }
            }
          } else if (msg.action === 'vehicle') {
            if (actor.vehicleId) {
              const veh = room.vehicles.find((v) => v.id === actor.vehicleId);
              if (veh) veh.driverId = null;
              actor.vehicleId = null;
              actor.x += 2.2;
              actor.y = groundHeightAt(actor.x, actor.z);
            } else {
              const veh = room.vehicles.find((v) => !v.driverId && Math.hypot(v.x - actor.x, v.z - actor.z) < 4.5);
              if (veh) {
                veh.driverId = actor.id;
                actor.vehicleId = veh.id;
              }
            }
          }
        }
      } catch {
        // Ignore malformed packets safely
      }
    });

    ws.on('close', () => {
      const c = clients.get(clientId);
      if (c && c.roomId) {
        const room = rooms.get(c.roomId);
        if (room) {
          const actor = room.actors.get(c.uid);
          if (actor) actor.alive = false;
        }
      }
      clients.delete(clientId);
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Emberfall Royale server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
