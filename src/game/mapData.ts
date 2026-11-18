export interface POI {
  id: string;
  name: string;
  x: number;
  z: number;
  radius: number;
  kind: 'city' | 'military' | 'village' | 'woods' | 'bridge';
}

export interface BuildingDef {
  id: string;
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  rotY: number;
  style: 'concrete' | 'military' | 'cabin' | 'tower' | 'bunker';
  color: number;
  roofColor: number;
  hasRoofAccess?: boolean;
}

export interface WallAABB {
  cx: number;
  cz: number;
  hw: number;
  hd: number;
  rotY: number;
  minY: number;
  maxY: number;
}

export interface LootSpawnNode {
  id: string;
  x: number;
  z: number;
}

export interface VehicleSpawnNode {
  id: string;
  x: number;
  z: number;
  rotY: number;
}

export const WORLD_RADIUS = 210;
export const TERRAIN_EXTENT = 360;
export const WATER_LEVEL = -0.35;

/**
 * Deterministic terrain height function shared identically between
 * server authoritative collision/spawns and Three.js terrain geometry.
 */
export function groundHeightAt(x: number, z: number): number {
  const dist = Math.hypot(x, z);
  const islandFalloff = dist > WORLD_RADIUS - 18 ? Math.max(0, 1 - (dist - (WORLD_RADIUS - 18)) / 55) : 1;

  // River channel cutting across the island near z = -34
  const riverCenter = -34 + Math.sin(x * 0.025) * 14;
  const riverDist = Math.abs(z - riverCenter);
  const riverDip = riverDist < 13 ? -2.2 * (1 - riverDist / 13) : 0;

  // Flatten POIs & roads smoothly so buildings sit flush
  const flatTown = Math.max(0, 1 - Math.hypot(x + 18, z - 16) / 42);
  const flatBase = Math.max(0, 1 - Math.hypot(x - 86, z + 78) / 44);
  const flatVillage = Math.max(0, 1 - Math.hypot(x + 92, z - 82) / 36);
  const flattenFactor = 1 - Math.min(1, flatTown * 0.92 + flatBase * 0.92 + flatVillage * 0.9);

  const hills =
    (Math.sin(x * 0.024) * Math.cos(z * 0.024) * 3.8 +
      Math.sin(x * 0.055 + 1.1) * Math.sin(z * 0.048) * 1.4) *
    flattenFactor;

  const mountainRidge =
    Math.max(0, (dist - 125) / 80) *
    Math.max(0, Math.sin(x * 0.03 + z * 0.02)) *
    11 *
    islandFalloff;

  const baseElevation = (1.6 + hills + mountainRidge) * islandFalloff + riverDip;
  if (dist > WORLD_RADIUS + 35) return -3.2;
  return Number(baseElevation.toFixed(3));
}

export const MAP_POIS: POI[] = [
  { id: 'solaris', name: 'Solaris City', x: -18, z: 16, radius: 44, kind: 'city' },
  { id: 'citadel', name: 'Obsidian Base', x: 86, z: -78, radius: 46, kind: 'military' },
  { id: 'pinecrest', name: 'Pinecrest Village', x: -92, z: 82, radius: 36, kind: 'village' },
  { id: 'crosswind', name: 'Crosswind Bridge', x: 10, z: -34, radius: 24, kind: 'bridge' },
  { id: 'whisper', name: 'Whispering Woods', x: -88, z: -76, radius: 45, kind: 'woods' },
];

export const MAP_BUILDINGS: BuildingDef[] = [
  // Solaris City (Enterable Modern Houses & Buildings)
  { id: 'b_sol_1', x: -32, z: 6, w: 12, h: 4.5, d: 10, rotY: 0, style: 'concrete', color: 0x7c8594, roofColor: 0x3b4252, hasRoofAccess: true },
  { id: 'b_sol_2', x: -8, z: 4, w: 14, h: 5.0, d: 11, rotY: 0, style: 'concrete', color: 0x6b7280, roofColor: 0x2d3748, hasRoofAccess: true },
  { id: 'b_sol_3', x: -28, z: 32, w: 11, h: 4.2, d: 9, rotY: 0.15, style: 'concrete', color: 0x8b8378, roofColor: 0x4b4239 },
  { id: 'b_sol_4', x: 4, z: 28, w: 13, h: 4.6, d: 10, rotY: -0.1, style: 'concrete', color: 0x717987, roofColor: 0x27303f, hasRoofAccess: true },
  { id: 'b_sol_5', x: -16, z: 18, w: 7, h: 9.0, d: 7, rotY: 0, style: 'tower', color: 0x475569, roofColor: 0x334155, hasRoofAccess: true },

  // Obsidian Military Base (Barracks, Bunkers, Watchtower)
  { id: 'b_mil_1', x: 86, z: -78, w: 18, h: 4.8, d: 14, rotY: 0, style: 'military', color: 0x4b5544, roofColor: 0x293026, hasRoofAccess: true },
  { id: 'b_mil_2', x: 64, z: -68, w: 12, h: 4.0, d: 9, rotY: 0.2, style: 'bunker', color: 0x575d66, roofColor: 0x32363d },
  { id: 'b_mil_3', x: 106, z: -64, w: 12, h: 4.4, d: 9, rotY: -0.25, style: 'military', color: 0x4b5544, roofColor: 0x252b23 },
  { id: 'b_mil_4', x: 74, z: -98, w: 6, h: 9.5, d: 6, rotY: 0, style: 'tower', color: 0x3f444c, roofColor: 0x272b30, hasRoofAccess: true },
  { id: 'b_mil_5', x: 102, z: -94, w: 11, h: 4.0, d: 8, rotY: 0, style: 'bunker', color: 0x5b6068, roofColor: 0x292d33 },

  // Pinecrest Village (Abandoned Rural Cabins)
  { id: 'b_vil_1', x: -92, z: 82, w: 9, h: 3.8, d: 8, rotY: 0.1, style: 'cabin', color: 0x7c583c, roofColor: 0x4a2e1d },
  { id: 'b_vil_2', x: -74, z: 94, w: 8.5, h: 3.8, d: 7.5, rotY: -0.2, style: 'cabin', color: 0x855f44, roofColor: 0x3f2416 },
  { id: 'b_vil_3', x: -108, z: 92, w: 9.5, h: 4.0, d: 8, rotY: 0.35, style: 'cabin', color: 0x6b4b34, roofColor: 0x3f2416 },
  { id: 'b_vil_4', x: -88, z: 64, w: 10, h: 4.0, d: 7.5, rotY: 0, style: 'cabin', color: 0x785438, roofColor: 0x4a2e1d },

  // Outposts & Highway Checkpoints
  { id: 'b_out_1', x: 52, z: 48, w: 9, h: 4.2, d: 8, rotY: 0.4, style: 'bunker', color: 0x555c66, roofColor: 0x282d35 },
  { id: 'b_out_2', x: -82, z: -68, w: 8, h: 3.8, d: 8, rotY: -0.3, style: 'cabin', color: 0x6b4b34, roofColor: 0x3a2a1e },
  { id: 'b_out_3', x: 18, z: -76, w: 10, h: 4.2, d: 8, rotY: 0.15, style: 'military', color: 0x4b5544, roofColor: 0x242a22 },
];

/**
 * Generates individual perimeter wall AABBs for each enterable building,
 * leaving open 2.8m wide doorways on front and back so players can walk inside!
 */
export const BUILDING_WALLS: WallAABB[] = (() => {
  const walls: WallAABB[] = [];
  const wallT = 0.45;
  const doorHalf = 1.4;

  for (const b of MAP_BUILDINGS) {
    const baseY = groundHeightAt(b.x, b.z);
    const minY = baseY;
    const maxY = baseY + b.h;
    const cos = Math.cos(b.rotY);
    const sin = Math.sin(b.rotY);

    const addLocalWall = (lx: number, lz: number, hw: number, hd: number) => {
      walls.push({
        cx: b.x + lx * cos - lz * sin,
        cz: b.z + lx * sin + lz * cos,
        hw,
        hd,
        rotY: b.rotY,
        minY,
        maxY,
      });
    };

    const hw = b.w / 2;
    const hd = b.d / 2;
    const segW = Math.max(0.5, (b.w - doorHalf * 2) / 2);

    // Left & Right solid side walls
    addLocalWall(-hw + wallT / 2, 0, wallT / 2, hd);
    addLocalWall(hw - wallT / 2, 0, wallT / 2, hd);

    // Front wall split around doorway
    addLocalWall(-hw + segW / 2, hd - wallT / 2, segW / 2, wallT / 2);
    addLocalWall(hw - segW / 2, hd - wallT / 2, segW / 2, wallT / 2);

    // Back wall split around doorway
    addLocalWall(-hw + segW / 2, -hd + wallT / 2, segW / 2, wallT / 2);
    addLocalWall(hw - segW / 2, -hd + wallT / 2, segW / 2, wallT / 2);
  }
  return walls;
})();

/**
 * Returns walkable floor height including Crosswind Bridge deck, building interiors,
 * side roof stairs/ramps, and building rooftops for climbing & vertical combat!
 */
export function surfaceHeightAt(x: number, z: number, currentY = 0): number {
  let y = groundHeightAt(x, z);

  // Crosswind Bridge Deck (x: 5..15, z: -51..-17)
  if (x >= 5 && x <= 15 && z >= -51 && z <= -17) {
    y = Math.max(y, 1.78);
  }

  for (const b of MAP_BUILDINGS) {
    const dx = x - b.x;
    const dz = z - b.z;
    const cos = Math.cos(-b.rotY);
    const sin = Math.sin(-b.rotY);
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    const base = groundHeightAt(b.x, b.z);

    // Interior floor slab
    if (Math.abs(lx) < b.w / 2 + 0.4 && Math.abs(lz) < b.d / 2 + 0.4) {
      const floorY = base + 0.16;
      const roofY = base + b.h + 0.28;
      if (currentY >= roofY - 1.35 && b.style !== 'cabin') {
        y = Math.max(y, roofY);
      } else {
        y = Math.max(y, floorY);
      }
    }

    // Climbable exterior stair ramp on the right side (+X) for roof-access buildings
    if (b.hasRoofAccess && lx >= b.w / 2 && lx <= b.w / 2 + 1.9 && Math.abs(lz) <= b.d * 0.42) {
      const t = (lz + b.d * 0.42) / (b.d * 0.84);
      const rampY = base + t * (b.h + 0.28);
      y = Math.max(y, rampY);
    }
  }

  return y;
}

export const LOOT_SPAWN_NODES: LootSpawnNode[] = [
  // Inside & around Solaris City buildings
  { id: 'l1', x: -32, z: 6 }, { id: 'l2', x: -8, z: 4 }, { id: 'l3', x: -28, z: 32 },
  { id: 'l4', x: 4, z: 28 }, { id: 'l5', x: -16, z: 18 }, { id: 'l6', x: -18, z: -4 },
  // Inside & around Obsidian Military Base
  { id: 'l7', x: 86, z: -78 }, { id: 'l8', x: 64, z: -68 }, { id: 'l9', x: 106, z: -64 },
  { id: 'l10', x: 74, z: -98 }, { id: 'l11', x: 102, z: -94 },
  // Inside Pinecrest Village cabins
  { id: 'l12', x: -92, z: 82 }, { id: 'l13', x: -74, z: 94 }, { id: 'l14', x: -108, z: 92 },
  { id: 'l15', x: -88, z: 64 },
  // Bridge, Woods, Outposts
  { id: 'l16', x: 10, z: -20 }, { id: 'l17', x: 12, z: -50 }, { id: 'l18', x: -82, z: -68 },
  { id: 'l19', x: -94, z: -62 }, { id: 'l20', x: 52, z: 48 }, { id: 'l21', x: 46, z: 36 },
  { id: 'l22', x: 18, z: -76 }, { id: 'l23', x: -46, z: -20 }, { id: 'l24', x: 112, z: 18 },
  { id: 'l25', x: -22, z: 105 }, { id: 'l26', x: 82, z: 84 },
];

export const VEHICLE_SPAWN_NODES: VehicleSpawnNode[] = [
  { id: 'veh_1', x: 6, z: -12, rotY: 0.2 },
  { id: 'veh_2', x: 54, z: -48, rotY: -0.6 },
  { id: 'veh_3', x: -62, z: 54, rotY: 0.8 },
  { id: 'veh_4', x: -42, z: -52, rotY: 1.2 },
];

export const CLASH_ARENA_SPAWNS = {
  teamA: [
    { x: -38, z: 22 },
    { x: -34, z: 28 },
    { x: -42, z: 16 },
    { x: -30, z: 34 },
  ],
  teamB: [
    { x: 12, z: 10 },
    { x: 16, z: 16 },
    { x: 8, z: 4 },
    { x: 14, z: 24 },
  ],
};

export function resolveBuildingCollision(
  x: number,
  z: number,
  radius: number,
  actorY = 0,
): { x: number; z: number; hit: boolean } {
  let rx = x;
  let rz = z;
  let hit = false;

  for (const w of BUILDING_WALLS) {
    // Allow walking freely on rooftops above walls
    if (actorY >= w.maxY - 0.35) continue;

    const dx = rx - w.cx;
    const dz = rz - w.cz;
    const cos = Math.cos(-w.rotY);
    const sin = Math.sin(-w.rotY);
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;

    const hw = w.hw + radius;
    const hd = w.hd + radius;

    if (Math.abs(lx) < hw && Math.abs(lz) < hd) {
      hit = true;
      const penX = hw - Math.abs(lx);
      const penZ = hd - Math.abs(lz);
      let nlx = lx;
      let nlz = lz;
      if (penX < penZ) {
        nlx = lx >= 0 ? hw : -hw;
      } else {
        nlz = lz >= 0 ? hd : -hd;
      }
      const ic = Math.cos(w.rotY);
      const is = Math.sin(w.rotY);
      rx = w.cx + nlx * ic - nlz * is;
      rz = w.cz + nlx * is + nlz * ic;
    }
  }

  return { x: rx, z: rz, hit };
}

export function rayIntersectsBuilding(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
): number | null {
  let closest: number | null = null;
  for (const w of BUILDING_WALLS) {
    const rx = ox - w.cx;
    const rz = oz - w.cz;
    const cos = Math.cos(-w.rotY);
    const sin = Math.sin(-w.rotY);
    const lox = rx * cos - rz * sin;
    const loz = rx * sin + rz * cos;
    const ldx = dx * cos - dz * sin;
    const ldz = dx * sin + dz * cos;

    let tmin = 0;
    let tmax = maxDist;

    const slabs: [number, number, number, number][] = [
      [lox, ldx, -w.hw, w.hw],
      [oy, dy, w.minY, w.maxY],
      [loz, ldz, -w.hd, w.hd],
    ];

    let missed = false;
    for (const [o, d, bmin, bmax] of slabs) {
      if (Math.abs(d) < 1e-6) {
        if (o < bmin || o > bmax) {
          missed = true;
          break;
        }
      } else {
        let t1 = (bmin - o) / d;
        let t2 = (bmax - o) / d;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) {
          missed = true;
          break;
        }
      }
    }
    if (!missed && tmin > 0 && tmin < maxDist) {
      if (closest === null || tmin < closest) closest = tmin;
    }
  }
  return closest;
}
