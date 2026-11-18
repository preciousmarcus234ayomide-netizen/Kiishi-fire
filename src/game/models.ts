import * as THREE from 'three';
import { CHARACTERS, COSMETIC_ITEMS, WEAPONS, WEAPON_SKINS } from './catalog';

export interface CharacterRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  leftElbow: THREE.Group;
  rightArm: THREE.Group;
  rightElbow: THREE.Group;
  leftLeg: THREE.Group;
  leftKnee: THREE.Group;
  rightLeg: THREE.Group;
  rightKnee: THREE.Group;
  weaponMount: THREE.Group;
  parachuteGroup: THREE.Group;
  helmetMesh: THREE.Group;
  vestMesh: THREE.Group;
  shieldAura: THREE.Mesh;
  gender: 'male' | 'female';
}

const textureCache = new Map<string, THREE.CanvasTexture>();

export function createContactShadowTexture(): THREE.CanvasTexture {
  const key = 'contact_shadow';
  if (textureCache.has(key)) return textureCache.get(key)!;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0,0,0,0.62)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.22)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

export function createTacticalGridTexture(baseHex: string, lineHex: string, maxAnisotropy = 4): THREE.CanvasTexture {
  const key = `grid_${baseHex}_${lineHex}`;
  if (textureCache.has(key)) return textureCache.get(key)!;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 800; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect((i * 73) % 256, (i * 137) % 256, 3, 3);
  }

  ctx.strokeStyle = lineHex;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 254, 254);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  textureCache.set(key, tex);
  return tex;
}

export function createCamoTexture(primaryHex: number, secondaryHex: number, maxAnisotropy = 4): THREE.CanvasTexture {
  const pStr = `#${primaryHex.toString(16).padStart(6, '0')}`;
  const sStr = `#${secondaryHex.toString(16).padStart(6, '0')}`;
  const key = `camo_${pStr}_${sStr}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = pStr;
  ctx.fillRect(0, 0, 512, 512);

  // Organic woodland / multicam blotches
  let seed = primaryHex + 17;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const tones = [sStr, 'rgba(30, 34, 28, 0.55)', 'rgba(130, 122, 95, 0.35)', 'rgba(18, 22, 18, 0.45)'];
  for (let i = 0; i < 65; i++) {
    ctx.fillStyle = tones[i % tones.length];
    ctx.beginPath();
    const cx = rand() * 512;
    const cy = rand() * 512;
    const rx = 24 + rand() * 55;
    const ry = 16 + rand() * 38;
    ctx.ellipse(cx, cy, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine ripstop fabric weave lines
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  for (let y = 0; y < 512; y += 6) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }
  for (let x = 0; x < 512; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  textureCache.set(key, tex);
  return tex;
}

export function createConcreteTexture(baseHex: string, maxAnisotropy = 4): THREE.CanvasTexture {
  const key = `concrete_${baseHex}`;
  if (textureCache.has(key)) return textureCache.get(key)!;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 512);

  let seed = 91;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = 0; i < 4500; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(rand() * 512, rand() * 512, 2 + rand() * 4, 2 + rand() * 4);
  }
  // Subtle weathering seams
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, 508, 508);
  ctx.beginPath();
  ctx.moveTo(0, 256);
  ctx.lineTo(512, 256);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  textureCache.set(key, tex);
  return tex;
}

export function createWoodTexture(baseHex: string, maxAnisotropy = 4): THREE.CanvasTexture {
  const key = `wood_${baseHex}`;
  if (textureCache.has(key)) return textureCache.get(key)!;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 512);

  for (let p = 0; p < 8; p++) {
    const py = p * 64;
    ctx.fillStyle = p % 2 === 0 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.03)';
    ctx.fillRect(0, py, 512, 62);
    ctx.fillStyle = 'rgba(20,12,6,0.35)';
    ctx.fillRect(0, py + 62, 512, 2);
    for (let g = 0; g < 18; g++) {
      ctx.strokeStyle = 'rgba(30,16,8,0.14)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, py + 4 + g * 3);
      ctx.bezierCurveTo(170, py + g * 3 + Math.sin(g) * 4, 340, py + g * 3 - Math.cos(g) * 4, 512, py + 4 + g * 3);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  textureCache.set(key, tex);
  return tex;
}

function createFaceTexture(skinHex: string, isFemale: boolean, lipHex: string): THREE.CanvasTexture {
  const key = `face_${skinHex}_${isFemale}_${lipHex}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base skin tone + soft radial shading
  ctx.fillStyle = skinHex;
  ctx.fillRect(0, 0, 512, 512);

  // Warm cheek & nose flush
  const cheekL = ctx.createRadialGradient(178, 295, 8, 178, 295, 58);
  cheekL.addColorStop(0, isFemale ? 'rgba(205, 105, 95, 0.25)' : 'rgba(180, 95, 80, 0.14)');
  cheekL.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cheekL;
  ctx.fillRect(100, 220, 150, 150);

  const cheekR = ctx.createRadialGradient(334, 295, 8, 334, 295, 58);
  cheekR.addColorStop(0, isFemale ? 'rgba(205, 105, 95, 0.25)' : 'rgba(180, 95, 80, 0.14)');
  cheekR.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cheekR;
  ctx.fillRect(260, 220, 150, 150);

  // Subtle eye socket shadow
  ctx.fillStyle = 'rgba(70, 42, 32, 0.16)';
  ctx.beginPath();
  ctx.ellipse(202, 232, 34, 18, 0, 0, Math.PI * 2);
  ctx.ellipse(310, 232, 34, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Detailed eyebrows
  ctx.strokeStyle = '#251a14';
  ctx.lineWidth = isFemale ? 6 : 8.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(168, 206);
  ctx.quadraticCurveTo(202, isFemale ? 194 : 199, 234, 205);
  ctx.moveTo(278, 205);
  ctx.quadraticCurveTo(310, isFemale ? 194 : 199, 344, 206);
  ctx.stroke();

  // Eyelash / upper lid crease
  ctx.strokeStyle = '#1b1310';
  ctx.lineWidth = isFemale ? 4.5 : 3;
  ctx.beginPath();
  ctx.moveTo(176, 231);
  ctx.quadraticCurveTo(204, 221, 230, 232);
  ctx.moveTo(282, 232);
  ctx.quadraticCurveTo(308, 221, 336, 231);
  ctx.stroke();

  // Natural nose bridge shadow & nostril hints
  ctx.fillStyle = 'rgba(85, 50, 38, 0.18)';
  ctx.beginPath();
  ctx.ellipse(246, 294, 5, 3, 0, 0, Math.PI * 2);
  ctx.ellipse(266, 294, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Lips
  ctx.fillStyle = lipHex;
  ctx.beginPath();
  ctx.moveTo(226, 340);
  ctx.quadraticCurveTo(246, 330, 256, 335);
  ctx.quadraticCurveTo(266, 330, 286, 340);
  ctx.quadraticCurveTo(256, isFemale ? 356 : 350, 226, 340);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,18,16,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(228, 340);
  ctx.lineTo(284, 340);
  ctx.stroke();

  // Male subtle tactical jawline stubble
  if (!isFemale) {
    ctx.fillStyle = 'rgba(35, 28, 24, 0.14)';
    ctx.beginPath();
    ctx.ellipse(256, 382, 72, 42, 0, 0, Math.PI);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Builds a realistic detailed firearm mesh using ExtrudeGeometry receivers/stocks,
 * LatheGeometry barrels/suppressors, and TubeGeometry curved magazines.
 */
export function createWeaponModel(weaponId: string, skinId?: string): THREE.Group {
  const spec = WEAPONS[weaponId] || WEAPONS.ak47_ember;
  const skin = WEAPON_SKINS.find((s) => s.id === skinId && s.weaponId === weaponId);
  const bodyColor = skin ? skin.primaryColor : spec.color;
  const accentColor = skin ? skin.accentColor : spec.accentColor;

  const group = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.34, metalness: 0.84 });
  const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.4, metalness: 0.88 });
  const polymerMat = new THREE.MeshStandardMaterial({ color: 0x16191f, roughness: 0.78, metalness: 0.12 });
  const woodStockMat = new THREE.MeshStandardMaterial({ color: 0x5c3720, roughness: 0.65, metalness: 0.05 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.28,
    metalness: 0.65,
  });
  const opticGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    roughness: 0.05,
    metalness: 0.1,
    transmission: 0.6,
    clearcoat: 1.0,
  });

  const isSniper = spec.category === 'sniper';
  const isShotgun = spec.category === 'shotgun';
  const isPistol = spec.category === 'pistol';
  const isSmg = spec.category === 'smg';
  const isAk = weaponId === 'ak47_ember';

  const recLen = isPistol ? 0.22 : isSmg ? 0.32 : isSniper ? 0.48 : 0.42;

  // Profiled receiver via ExtrudeGeometry
  const recShape = new THREE.Shape();
  recShape.moveTo(-recLen * 0.5, -0.045);
  recShape.lineTo(recLen * 0.5, -0.045);
  recShape.lineTo(recLen * 0.5, 0.032);
  recShape.lineTo(recLen * 0.35, 0.052);
  recShape.lineTo(-recLen * 0.42, 0.052);
  recShape.lineTo(-recLen * 0.5, 0.025);
  recShape.closePath();
  const recGeo = new THREE.ExtrudeGeometry(recShape, {
    depth: 0.048,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
  });
  recGeo.rotateY(-Math.PI / 2);
  recGeo.translate(0.024, 0, 0);
  const receiver = new THREE.Mesh(recGeo, metalMat);
  receiver.castShadow = true;
  group.add(receiver);

  // Pistol grip (ergonomic angled ExtrudeGeometry)
  const gripShape = new THREE.Shape();
  gripShape.moveTo(0, 0);
  gripShape.lineTo(0.045, 0);
  gripShape.lineTo(0.025, -0.115);
  gripShape.lineTo(-0.022, -0.115);
  gripShape.closePath();
  const gripGeo = new THREE.ExtrudeGeometry(gripShape, {
    depth: 0.036,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 2,
  });
  gripGeo.rotateY(-Math.PI / 2);
  gripGeo.translate(0.018, -0.032, -recLen * 0.28);
  const grip = new THREE.Mesh(gripGeo, polymerMat);
  group.add(grip);

  // Fluted LatheGeometry Barrel + Flash Hider
  const barrelLen = isPistol ? 0.14 : isSmg ? 0.22 : isSniper ? 0.62 : isShotgun ? 0.48 : 0.38;
  const rBase = isShotgun ? 0.02 : 0.014;
  const barrelPts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(rBase * 1.35, 0),
    new THREE.Vector2(rBase * 1.15, barrelLen * 0.35),
    new THREE.Vector2(rBase, barrelLen * 0.85),
    new THREE.Vector2(rBase * 1.4, barrelLen * 0.88),
    new THREE.Vector2(rBase * 1.35, barrelLen),
    new THREE.Vector2(0.004, barrelLen),
  ];
  const barrel = new THREE.Mesh(new THREE.LatheGeometry(barrelPts, 14), darkSteelMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.018, recLen * 0.48);
  barrel.castShadow = true;
  group.add(barrel);

  // Handguard shroud around forward barrel
  if (!isPistol) {
    const shroud = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.028, barrelLen * 0.56, 10),
      isAk ? woodStockMat : polymerMat,
    );
    shroud.rotation.x = Math.PI / 2;
    shroud.position.set(0, 0.012, recLen * 0.48 + barrelLen * 0.28);
    group.add(shroud);
  }

  // Curved / Straight Magazine
  if (!isPistol && !isShotgun) {
    if (isAk) {
      const magCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.03, recLen * 0.12),
        new THREE.Vector3(0, -0.11, recLen * 0.15),
        new THREE.Vector3(0, -0.18, recLen * 0.22),
      ]);
      const mag = new THREE.Mesh(new THREE.TubeGeometry(magCurve, 8, 0.022, 8, false), accentMat);
      mag.scale.set(0.8, 1, 1.35);
      group.add(mag);
    } else {
      const magLen = isSmg ? 0.18 : 0.14;
      const mag = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.016, magLen, 8), accentMat);
      mag.scale.set(0.85, 1, 1.5);
      mag.position.set(0, -0.095, recLen * 0.12);
      mag.rotation.x = -0.15;
      group.add(mag);
    }
  }

  // Ergonomic Buttstock
  if (!isPistol) {
    const stockShape = new THREE.Shape();
    stockShape.moveTo(0, 0.032);
    stockShape.lineTo(-0.22, 0.022);
    stockShape.lineTo(-0.24, -0.085);
    stockShape.lineTo(-0.18, -0.085);
    stockShape.lineTo(0, -0.02);
    stockShape.closePath();
    const stockGeo = new THREE.ExtrudeGeometry(stockShape, {
      depth: 0.034,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.005,
      bevelSegments: 2,
    });
    stockGeo.rotateY(-Math.PI / 2);
    stockGeo.translate(0.017, 0, -recLen * 0.48);
    const stock = new THREE.Mesh(stockGeo, isAk ? woodStockMat : polymerMat);
    group.add(stock);
  }

  // Optical Sight / Sniper Scope with glass lens
  if (isSniper || spec.category === 'ar') {
    const scopeLen = isSniper ? 0.28 : 0.11;
    const scopePts = [
      new THREE.Vector2(0.018, 0),
      new THREE.Vector2(0.022, scopeLen * 0.2),
      new THREE.Vector2(0.016, scopeLen * 0.35),
      new THREE.Vector2(0.016, scopeLen * 0.7),
      new THREE.Vector2(0.026, scopeLen * 0.85),
      new THREE.Vector2(0.026, scopeLen),
    ];
    const scope = new THREE.Mesh(new THREE.LatheGeometry(scopePts, 14), darkSteelMat);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.075, -scopeLen * 0.45);
    group.add(scope);

    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), opticGlassMat);
    lens.scale.set(1, 1, 0.35);
    lens.position.set(0, 0.075, scopeLen * 0.55);
    group.add(lens);
  }

  return group;
}

/**
 * Helper to create anatomically tapered organic limb segments via LatheGeometry.
 */
function createOrganicLimbSegment(
  topR: number,
  midR: number,
  botR: number,
  length: number,
  mat: THREE.Material,
): THREE.Mesh {
  const pts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(topR * 0.88, -length * 0.03),
    new THREE.Vector2(topR, -length * 0.16),
    new THREE.Vector2(midR, -length * 0.52),
    new THREE.Vector2(botR, -length * 0.92),
    new THREE.Vector2(botR * 0.82, -length),
    new THREE.Vector2(0.001, -length),
  ];
  const geo = new THREE.LatheGeometry(pts, 14);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds a realistic male or female human soldier rig grounded at y = 0.
 * Zero BoxGeometry used on human anatomy.
 */
export function createCharacterModel(opts: {
  characterId: string;
  outfitId?: string;
  hairId?: string;
  accessoryId?: string;
  weaponId?: string;
  skinId?: string;
  teamTint?: number;
  withContactShadow?: boolean;
}): CharacterRig {
  const charSpec = CHARACTERS[opts.characterId] || CHARACTERS.valkyrie;
  const isFemale = charSpec.gender === 'female';
  const outfit = COSMETIC_ITEMS.find((c) => c.id === opts.outfitId);
  const hair = COSMETIC_ITEMS.find((c) => c.id === opts.hairId);
  const accessory = COSMETIC_ITEMS.find((c) => c.id === opts.accessoryId);

  const primaryCol = outfit && outfit.id !== 'outfit_default' ? outfit.colorNum : charSpec.primaryColor;
  const secondaryCol = opts.teamTint ?? charSpec.secondaryColor;
  const hairCol = hair ? hair.colorNum : 0x231d1a;
  const accCol = accessory ? accessory.colorNum : 0x3b3630;

  const camoTex = createCamoTexture(primaryCol, secondaryCol, 4);
  const pantsTex = createCamoTexture(secondaryCol, primaryCol, 4);
  const bduMat = new THREE.MeshStandardMaterial({ map: camoTex, roughness: 0.82, metalness: 0.05 });
  const pantsMat = new THREE.MeshStandardMaterial({ map: pantsTex, roughness: 0.86, metalness: 0.04 });
  const vestMat = new THREE.MeshStandardMaterial({ color: 0x2b2d28, roughness: 0.72, metalness: 0.14 });
  const leatherMat = new THREE.MeshStandardMaterial({ color: accCol, roughness: 0.55, metalness: 0.15 });

  // Natural skin tones per character
  const skinHex =
    opts.characterId === 'kuro'
      ? '#c89878'
      : opts.characterId === 'titan'
        ? '#9d6b4c'
        : opts.characterId === 'nova'
          ? '#d6a484'
          : '#dfb195';
  const lipHex = isFemale ? '#b8625c' : '#9c6358';
  const faceTex = createFaceTexture(skinHex, isFemale, lipHex);
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.62, metalness: 0.02 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.62, metalness: 0.02 });

  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  const hipHeight = isFemale ? 0.90 : 0.94;
  bodyPivot.position.y = hipHeight;
  root.add(bodyPivot);

  if (opts.withContactShadow !== false) {
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 1.3),
      new THREE.MeshBasicMaterial({
        map: createContactShadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0.52,
      }),
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.02;
    root.add(shadowPlane);
  }

  // Pelvis / Hip sculpted LatheGeometry
  const pelvisPts = isFemale
    ? [
        new THREE.Vector2(0.01, -0.08),
        new THREE.Vector2(0.175, -0.02),
        new THREE.Vector2(0.18, 0.05),
        new THREE.Vector2(0.135, 0.12),
        new THREE.Vector2(0.01, 0.12),
      ]
    : [
        new THREE.Vector2(0.01, -0.08),
        new THREE.Vector2(0.165, -0.02),
        new THREE.Vector2(0.17, 0.06),
        new THREE.Vector2(0.155, 0.12),
        new THREE.Vector2(0.01, 0.12),
      ];
  const pelvis = new THREE.Mesh(new THREE.LatheGeometry(pelvisPts, 18), pantsMat);
  pelvis.scale.set(1.12, 1, 0.76);
  pelvis.castShadow = true;
  bodyPivot.add(pelvis);

  // Tactical Utility Belt & Drop Holster
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.024, 8, 22), leatherMat);
  belt.rotation.x = Math.PI / 2;
  belt.scale.set(1.12, 0.8, 1);
  belt.position.y = 0.06;
  bodyPivot.add(belt);

  // Sculpted Torso Group (Waist -> Ribcage -> Shoulders)
  const torsoGroup = new THREE.Group();
  torsoGroup.position.y = 0.08;
  bodyPivot.add(torsoGroup);

  const torsoPts = isFemale
    ? [
        new THREE.Vector2(0.01, 0.0),
        new THREE.Vector2(0.132, 0.04), // slim waist
        new THREE.Vector2(0.145, 0.18),
        new THREE.Vector2(0.175, 0.34), // bust / ribcage
        new THREE.Vector2(0.18, 0.45),  // shoulder breadth
        new THREE.Vector2(0.065, 0.54), // neck base
        new THREE.Vector2(0.01, 0.55),
      ]
    : [
        new THREE.Vector2(0.01, 0.0),
        new THREE.Vector2(0.155, 0.04), // waist
        new THREE.Vector2(0.175, 0.22), // lats
        new THREE.Vector2(0.215, 0.42), // broad chest / shoulders
        new THREE.Vector2(0.195, 0.49),
        new THREE.Vector2(0.078, 0.56), // neck base
        new THREE.Vector2(0.01, 0.57),
      ];
  const torsoGeo = new THREE.LatheGeometry(torsoPts, 20);
  const torsoMesh = new THREE.Mesh(torsoGeo, bduMat);
  torsoMesh.scale.set(1.15, 1, isFemale ? 0.78 : 0.8);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  torsoGroup.add(torsoMesh);

  // Sculpted Ballistic Plate Carrier Vest (toggleable armor)
  const vestMesh = new THREE.Group();
  const plateShape = new THREE.Shape();
  const pw = isFemale ? 0.14 : 0.165;
  plateShape.moveTo(-pw * 0.82, 0.06);
  plateShape.lineTo(pw * 0.82, 0.06);
  plateShape.lineTo(pw, 0.36);
  plateShape.lineTo(pw * 0.65, 0.44);
  plateShape.lineTo(-pw * 0.65, 0.44);
  plateShape.lineTo(-pw, 0.36);
  plateShape.closePath();
  const vestGeo = new THREE.ExtrudeGeometry(plateShape, {
    depth: isFemale ? 0.27 : 0.31,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.018,
    bevelSegments: 3,
  });
  vestGeo.translate(0, 0, isFemale ? -0.135 : -0.155);
  const vestPlate = new THREE.Mesh(vestGeo, vestMat);
  vestPlate.castShadow = true;
  vestMesh.add(vestPlate);

  // Front triple magazine pouches on plate carrier
  for (let i = -1; i <= 1; i++) {
    const pouch = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.11, 8), leatherMat);
    pouch.scale.set(1.15, 1, 0.75);
    pouch.position.set(i * 0.068, 0.16, isFemale ? 0.145 : 0.165);
    vestMesh.add(pouch);
  }
  torsoGroup.add(vestMesh);

  // Tactical Field Rucksack on back
  const packGeo = new THREE.CylinderGeometry(0.13, 0.15, 0.34, 12);
  packGeo.scale(1.15, 1, 0.65);
  const backpack = new THREE.Mesh(packGeo, leatherMat);
  backpack.position.set(0, 0.28, -0.19);
  backpack.castShadow = true;
  torsoGroup.add(backpack);

  // Neck + Sculpted Realistic Human Head Group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, isFemale ? 0.56 : 0.58, 0.01);
  torsoGroup.add(headGroup);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(isFemale ? 0.048 : 0.058, isFemale ? 0.056 : 0.068, 0.11, 14),
    skinMat,
  );
  neck.position.y = 0.03;
  headGroup.add(neck);

  // Vertex-sculpted human cranium + jawline (deformed SphereGeometry, zero blocks)
  const headGeo = new THREE.SphereGeometry(0.115, 24, 20);
  const hPos = headGeo.attributes.position;
  for (let i = 0; i < hPos.count; i++) {
    let x = hPos.getX(i);
    let y = hPos.getY(i);
    let z = hPos.getZ(i);
    // Elongate head vertically and front-to-back
    y *= 1.18;
    z *= 1.08;
    // Taper chin & jawline below eye line
    if (y < 0) {
      const chinT = Math.min(1, -y / 0.135);
      x *= 1 - chinT * (isFemale ? 0.42 : 0.32);
      if (z > 0) z *= 1 - chinT * 0.12;
    }
    // Slight cheekbone definition
    if (y > -0.03 && y < 0.03 && z > 0.04) {
      x *= 1.04;
    }
    hPos.setXYZ(i, x, y, z);
  }
  headGeo.computeVertexNormals();
  const headMesh = new THREE.Mesh(headGeo, faceMat);
  headMesh.position.set(0, 0.16, 0.01);
  headMesh.rotation.y = -Math.PI / 2; // align canvas face texture front (+Z)
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // 3D Sculpted Nose Bridge
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.048, 8), skinMat);
  nose.rotation.x = Math.PI * 0.36;
  nose.position.set(0, 0.155, 0.128);
  headGroup.add(nose);

  // 3D Ears
  const earGeo = new THREE.SphereGeometry(0.022, 8, 8);
  earGeo.scale(0.35, 1.15, 0.72);
  const earL = new THREE.Mesh(earGeo, skinMat);
  earL.position.set(-0.114, 0.16, -0.005);
  const earR = new THREE.Mesh(earGeo, skinMat);
  earR.position.set(0.114, 0.16, -0.005);
  headGroup.add(earL, earR);

  // 3D Realistic Eyes (Sclera + Colored Iris + Pupil)
  const scleraMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.15 });
  const irisColor = opts.characterId === 'nova' ? 0x2f6b58 : opts.characterId === 'valkyrie' ? 0x3b6ea5 : 0x423124;
  const irisMat = new THREE.MeshStandardMaterial({ color: irisColor, roughness: 0.2 });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
  for (const side of [-1, 1]) {
    const eyeGroup = new THREE.Group();
    eyeGroup.position.set(side * 0.042, 0.178, 0.104);
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.015, 10, 8), scleraMat);
    sclera.scale.set(1.15, 0.85, 0.65);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 10, 8), irisMat);
    iris.position.z = 0.0055;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 8, 8), pupilMat);
    pupil.position.z = 0.0095;
    eyeGroup.add(sclera, iris, pupil);
    headGroup.add(eyeGroup);
  }

  // Sculpted Realistic Hairstyles (Gender-appropriate!)
  const hairMat = new THREE.MeshStandardMaterial({ color: hairCol, roughness: 0.58, metalness: 0.08 });
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.122, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62),
    hairMat,
  );
  hairCap.scale.set(1.02, 1.16, 1.12);
  hairCap.position.set(0, 0.175, -0.002);
  hairCap.rotation.x = -0.18;
  headGroup.add(hairCap);

  if (isFemale) {
    // Sculpted back ponytail + sweeping side fringe
    const ponytailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.20, -0.115),
      new THREE.Vector3(0, 0.13, -0.165),
      new THREE.Vector3(0, 0.02, -0.155),
    ]);
    const ponytail = new THREE.Mesh(new THREE.TubeGeometry(ponytailCurve, 10, 0.036, 10, false), hairMat);
    headGroup.add(ponytail);

    const bangsCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.08, 0.25, 0.08),
      new THREE.Vector3(0.02, 0.255, 0.112),
      new THREE.Vector3(0.10, 0.20, 0.075),
    ]);
    const bangs = new THREE.Mesh(new THREE.TubeGeometry(bangsCurve, 10, 0.024, 8, false), hairMat);
    headGroup.add(bangs);
  } else {
    // Textured top military fade crown
    const topFade = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 10), hairMat);
    topFade.scale.set(1.05, 0.55, 1.25);
    topFade.position.set(0, 0.27, 0.015);
    headGroup.add(topFade);
  }

  // FAST Tactical Combat Helmet (with chin strap & NVG shroud)
  const helmetMesh = new THREE.Group();
  const helmetShell = new THREE.Mesh(
    new THREE.SphereGeometry(0.142, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.54),
    new THREE.MeshStandardMaterial({ color: 0x2c3029, roughness: 0.42, metalness: 0.35 }),
  );
  helmetShell.scale.set(1.04, 1.05, 1.14);
  helmetShell.position.set(0, 0.185, 0.0);
  helmetShell.rotation.x = -0.12;
  const nvgMount = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.03, 6), vestMat);
  nvgMount.rotation.x = Math.PI / 2;
  nvgMount.position.set(0, 0.24, 0.145);
  helmetMesh.add(helmetShell, nvgMount);
  helmetMesh.visible = false;
  headGroup.add(helmetMesh);

  // Articulated Arms (Shoulder -> Upper Arm -> Elbow -> Forearm -> Gloved Hand)
  const armScale = isFemale ? 0.84 : 1.0;
  const shoulderX = isFemale ? 0.205 : 0.245;

  const buildArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * shoulderX, 0.46, 0);
    torsoGroup.add(shoulder);

    const deltoid = new THREE.Mesh(new THREE.SphereGeometry(0.062 * armScale, 12, 10), bduMat);
    shoulder.add(deltoid);

    const upperArm = createOrganicLimbSegment(0.056 * armScale, 0.052 * armScale, 0.044 * armScale, 0.28, bduMat);
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.y = -0.28;
    shoulder.add(elbow);

    const forearm = createOrganicLimbSegment(0.044 * armScale, 0.04 * armScale, 0.032 * armScale, 0.26, skinMat);
    elbow.add(forearm);

    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.038 * armScale, 10, 8), leatherMat);
    glove.scale.set(0.85, 1.25, 1.05);
    glove.position.set(0, -0.275, 0.01);
    elbow.add(glove);

    return { shoulder, elbow };
  };

  const leftArmRig = buildArm(-1);
  const rightArmRig = buildArm(1);

  // Weapon Mount attached to right hand
  const weaponMount = new THREE.Group();
  weaponMount.position.set(0, -0.28, 0.07);
  weaponMount.rotation.x = Math.PI / 2;
  rightArmRig.elbow.add(weaponMount);
  const gun = createWeaponModel(opts.weaponId || 'ak47_ember', opts.skinId);
  weaponMount.add(gun);

  // Articulated Legs (Hip -> Thigh -> Knee -> Shin -> Combat Boot)
  const legScale = isFemale ? 0.90 : 1.0;
  const hipX = isFemale ? 0.105 : 0.11;

  const buildLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * hipX, -0.02, 0);
    bodyPivot.add(hip);

    const thigh = createOrganicLimbSegment(0.095 * legScale, 0.084 * legScale, 0.064 * legScale, 0.44, pantsMat);
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -0.44;
    hip.add(knee);

    // Tactical Knee Pad
    const kneePad = new THREE.Mesh(new THREE.SphereGeometry(0.056 * legScale, 10, 8), vestMat);
    kneePad.scale.set(0.95, 1.15, 0.65);
    kneePad.position.set(0, 0, 0.045);
    knee.add(kneePad);

    const shin = createOrganicLimbSegment(0.062 * legScale, 0.056 * legScale, 0.044 * legScale, 0.36, pantsMat);
    knee.add(shin);

    // Sculpted Combat Boot grounded neatly
    const bootShaft = createOrganicLimbSegment(0.048 * legScale, 0.046 * legScale, 0.045 * legScale, 0.14, leatherMat);
    bootShaft.position.y = -0.30;
    const bootFoot = new THREE.Mesh(new THREE.SphereGeometry(0.054 * legScale, 12, 8), leatherMat);
    bootFoot.scale.set(0.95, 0.68, 1.95);
    bootFoot.position.set(0, -0.44, 0.055);
    bootFoot.castShadow = true;
    knee.add(bootShaft, bootFoot);

    return { hip, knee };
  };

  const leftLegRig = buildLeg(-1);
  const rightLegRig = buildLeg(1);

  // Parachute Canopy
  const parachuteGroup = new THREE.Group();
  parachuteGroup.position.set(0, 2.3, 0);
  parachuteGroup.visible = false;
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x3b4938,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(2.1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), canopyMat);
  canopy.scale.set(1.25, 0.75, 0.95);
  parachuteGroup.add(canopy);
  const cordMat = new THREE.LineBasicMaterial({ color: 0xe2e8f0 });
  [
    [-1.4, 0.2, -0.8],
    [1.4, 0.2, -0.8],
    [-1.4, 0.2, 0.8],
    [1.4, 0.2, 0.8],
  ].forEach(([cx, cy, cz]) => {
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -1.6, 0),
      new THREE.Vector3(cx, cy, cz),
    ]);
    parachuteGroup.add(new THREE.Line(lineGeo, cordMat));
  });
  bodyPivot.add(parachuteGroup);

  // Ability Shield Aura
  const shieldAura = new THREE.Mesh(
    new THREE.SphereGeometry(1.05, 18, 14),
    new THREE.MeshBasicMaterial({
      color: charSpec.visorColor,
      transparent: true,
      opacity: 0.18,
      wireframe: true,
    }),
  );
  shieldAura.position.y = 0.2;
  shieldAura.visible = false;
  bodyPivot.add(shieldAura);

  return {
    root,
    bodyPivot,
    torsoGroup,
    headGroup,
    leftArm: leftArmRig.shoulder,
    leftElbow: leftArmRig.elbow,
    rightArm: rightArmRig.shoulder,
    rightElbow: rightArmRig.elbow,
    leftLeg: leftLegRig.hip,
    leftKnee: leftLegRig.knee,
    rightLeg: rightLegRig.hip,
    rightKnee: rightLegRig.knee,
    weaponMount,
    parachuteGroup,
    helmetMesh,
    vestMesh,
    shieldAura,
    gender: charSpec.gender,
  };
}

/**
 * Natural multi-joint skeletal animation for Idle, Walk/Run/Sprint, Crouch, Prone,
 * Climb, Swim, Parachute, Aiming, Reloading, Recoil, and Emotes.
 */
export function animateCharacterRig(
  rig: CharacterRig,
  state: {
    time: number;
    speed: number;
    parachuting?: boolean;
    jumping?: boolean;
    dead?: boolean;
    victory?: boolean;
    crouching?: boolean;
    prone?: boolean;
    swimming?: boolean;
    climbing?: boolean;
    aiming?: boolean;
    reloading?: boolean;
    emote?: string;
    recoil?: number;
  },
) {
  const {
    time,
    speed,
    parachuting,
    jumping,
    dead,
    victory,
    crouching,
    prone,
    swimming,
    climbing,
    aiming,
    reloading,
    emote,
    recoil = 0,
  } = state;

  rig.parachuteGroup.visible = Boolean(parachuting);

  // Reset rotational posture defaults smoothly
  const hipBase = rig.gender === 'female' ? 0.90 : 0.94;
  rig.bodyPivot.rotation.set(0, 0, 0);
  rig.torsoGroup.rotation.set(0, 0, 0);
  rig.headGroup.rotation.set(0, 0, 0);

  if (dead) {
    rig.bodyPivot.position.y = 0.2;
    rig.bodyPivot.rotation.set(-Math.PI * 0.46, 0, 0.22);
    rig.torsoGroup.rotation.set(0.15, 0.1, 0);
    rig.headGroup.rotation.set(0.25, -0.2, 0);
    rig.leftArm.rotation.set(-0.35, 0, -0.95);
    rig.leftElbow.rotation.set(-0.35, 0, 0);
    rig.rightArm.rotation.set(0.25, 0, 0.85);
    rig.rightElbow.rotation.set(-0.45, 0, 0);
    rig.leftLeg.rotation.set(0.18, 0, -0.18);
    rig.leftKnee.rotation.set(0.25, 0, 0);
    rig.rightLeg.rotation.set(-0.1, 0, 0.22);
    rig.rightKnee.rotation.set(0.45, 0, 0);
    return;
  }

  if (victory) {
    rig.bodyPivot.position.y = hipBase + Math.abs(Math.sin(time * 3.5)) * 0.08;
    rig.torsoGroup.rotation.set(-0.08, Math.sin(time * 2) * 0.12, 0);
    rig.rightArm.rotation.set(-2.65, -0.15, 0.35);
    rig.rightElbow.rotation.set(-0.25, 0, 0);
    rig.leftArm.rotation.set(-1.35 + Math.sin(time * 4) * 0.2, 0, -0.65);
    rig.leftElbow.rotation.set(-1.25, 0, 0);
    rig.leftLeg.rotation.set(-0.08, 0, -0.12);
    rig.rightLeg.rotation.set(0.08, 0, 0.12);
    rig.leftKnee.rotation.set(0.1, 0, 0);
    rig.rightKnee.rotation.set(0.1, 0, 0);
    return;
  }

  if (parachuting) {
    rig.bodyPivot.position.y = hipBase;
    rig.leftArm.rotation.set(-2.5, 0, -0.35);
    rig.leftElbow.rotation.set(-0.3, 0, 0);
    rig.rightArm.rotation.set(-2.5, 0, 0.35);
    rig.rightElbow.rotation.set(-0.3, 0, 0);
    rig.leftLeg.rotation.set(0.35 + Math.sin(time * 4) * 0.1, 0, 0);
    rig.leftKnee.rotation.set(0.35, 0, 0);
    rig.rightLeg.rotation.set(-0.2 + Math.cos(time * 4) * 0.1, 0, 0);
    rig.rightKnee.rotation.set(0.45, 0, 0);
    return;
  }

  if (swimming) {
    rig.bodyPivot.position.y = 0.28;
    rig.bodyPivot.rotation.x = Math.PI * 0.44; // horizontal swimming posture
    rig.headGroup.rotation.x = -Math.PI * 0.38; // keep chin above water
    const stroke = time * 5.2;
    rig.leftArm.rotation.set(-1.3 + Math.sin(stroke) * 0.9, 0, -0.45);
    rig.leftElbow.rotation.set(-0.4, 0, 0);
    rig.rightArm.rotation.set(-1.3 - Math.sin(stroke) * 0.9, 0, 0.45);
    rig.rightElbow.rotation.set(-0.4, 0, 0);
    rig.leftLeg.rotation.set(Math.sin(stroke * 1.4) * 0.35, 0, 0);
    rig.rightLeg.rotation.set(-Math.sin(stroke * 1.4) * 0.35, 0, 0);
    rig.leftKnee.rotation.set(0.25, 0, 0);
    rig.rightKnee.rotation.set(0.25, 0, 0);
    return;
  }

  if (prone) {
    rig.bodyPivot.position.y = 0.22;
    rig.bodyPivot.rotation.x = Math.PI * 0.48; // lying belly-down
    rig.headGroup.rotation.x = -Math.PI * 0.42; // looking forward
    const crawl = speed > 0.35 ? Math.sin(time * 7.5) : 0;
    rig.leftArm.rotation.set(-1.2 + crawl * 0.4, 0.3, -0.25);
    rig.leftElbow.rotation.set(-1.1, 0, 0);
    rig.rightArm.rotation.set(-1.35 - crawl * 0.3 - recoil, -0.25, 0.2);
    rig.rightElbow.rotation.set(-0.95, 0, 0);
    rig.leftLeg.rotation.set(crawl * 0.25, 0, -0.12);
    rig.rightLeg.rotation.set(-crawl * 0.25, 0, 0.12);
    rig.leftKnee.rotation.set(0.15, 0, 0);
    rig.rightKnee.rotation.set(0.15, 0, 0);
    return;
  }

  if (climbing) {
    rig.bodyPivot.position.y = hipBase;
    rig.torsoGroup.rotation.x = 0.16;
    const climbPhase = time * 8.5;
    rig.leftArm.rotation.set(-1.8 + Math.sin(climbPhase) * 0.7, 0, -0.2);
    rig.leftElbow.rotation.set(-0.85, 0, 0);
    rig.rightArm.rotation.set(-1.8 - Math.sin(climbPhase) * 0.7, 0, 0.2);
    rig.rightElbow.rotation.set(-0.85, 0, 0);
    rig.leftLeg.rotation.set(-0.45 - Math.sin(climbPhase) * 0.55, 0, 0);
    rig.leftKnee.rotation.set(0.95, 0, 0);
    rig.rightLeg.rotation.set(-0.45 + Math.sin(climbPhase) * 0.55, 0, 0);
    rig.rightKnee.rotation.set(0.95, 0, 0);
    return;
  }

  if (emote === 'emote_spin') {
    rig.bodyPivot.position.y = hipBase;
    rig.bodyPivot.rotation.y = time * 3.6;
    rig.rightArm.rotation.set(-1.0, 0, 0.4);
    rig.rightElbow.rotation.set(-0.9, 0, 0);
    rig.leftArm.rotation.set(-0.4, 0, -0.35);
    rig.leftElbow.rotation.set(-0.5, 0, 0);
    return;
  } else if (emote === 'emote_salute') {
    rig.bodyPivot.position.y = hipBase;
    rig.rightArm.rotation.set(-2.15, -0.35, -0.15);
    rig.rightElbow.rotation.set(-1.35, 0, 0);
    rig.leftArm.rotation.set(0.1, 0, -0.12);
    rig.leftElbow.rotation.set(-0.2, 0, 0);
    return;
  } else if (emote === 'emote_flex') {
    rig.bodyPivot.position.y = hipBase;
    rig.torsoGroup.rotation.y = Math.sin(time * 2) * 0.18;
    rig.leftArm.rotation.set(-1.3, 0, -0.75);
    rig.leftElbow.rotation.set(-1.4, 0, 0);
    rig.rightArm.rotation.set(-1.3, 0, 0.75);
    rig.rightElbow.rotation.set(-1.4, 0, 0);
    return;
  }

  if (jumping) {
    rig.bodyPivot.position.y = hipBase + 0.08;
    rig.torsoGroup.rotation.set(0.16, 0, 0);
    rig.leftLeg.rotation.set(-0.78, 0, -0.06);
    rig.leftKnee.rotation.set(1.22, 0, 0);
    rig.rightLeg.rotation.set(-0.32, 0, 0.06);
    rig.rightKnee.rotation.set(0.68, 0, 0);
    rig.leftArm.rotation.set(-1.05, 0.35, -0.22);
    rig.leftElbow.rotation.set(-0.95, 0, 0);
    rig.rightArm.rotation.set(-0.92 - recoil, -0.2, 0.18);
    rig.rightElbow.rotation.set(-0.95, 0, 0);
    return;
  }

  // Standing / Crouching / Running / Reloading / Aiming
  const targetHipY = crouching ? hipBase - 0.30 : hipBase;
  rig.bodyPivot.position.y += (targetHipY - rig.bodyPivot.position.y) * 0.25;

  if (speed > 0.35) {
    const freq = speed > 7.5 ? 11.5 : 8.5;
    const amp = Math.min(0.75, speed * 0.085);
    const stride = Math.sin(time * freq) * amp;
    rig.leftLeg.rotation.set(stride - (crouching ? 0.55 : 0), 0, 0);
    rig.rightLeg.rotation.set(-stride - (crouching ? 0.55 : 0), 0, 0);
    rig.leftKnee.rotation.set(Math.max(0.08, (crouching ? 1.05 : 0.2) + Math.max(0, -stride) * 0.85), 0, 0);
    rig.rightKnee.rotation.set(Math.max(0.08, (crouching ? 1.05 : 0.2) + Math.max(0, stride) * 0.85), 0, 0);

    rig.torsoGroup.rotation.x = crouching ? 0.28 : 0.1;
    rig.torsoGroup.rotation.y = -stride * 0.14;
    rig.bodyPivot.position.y += Math.abs(Math.sin(time * freq)) * 0.045;
  } else {
    const breath = Math.sin(time * 2.2) * 0.025;
    rig.leftLeg.rotation.set(crouching ? -0.58 : -0.04, 0, -0.05);
    rig.rightLeg.rotation.set(crouching ? -0.58 : 0.04, 0, 0.05);
    rig.leftKnee.rotation.set(crouching ? 1.1 : 0.08, 0, 0);
    rig.rightKnee.rotation.set(crouching ? 1.1 : 0.08, 0, 0);
    rig.torsoGroup.rotation.x = (crouching ? 0.22 : 0.02) + breath;
  }

  // Realistic Two-Handed Rifle / Sidearm Grip & Reload Animation
  if (reloading) {
    const rPulse = Math.sin(time * 12) * 0.22;
    rig.leftArm.rotation.set(-0.95 + rPulse, 0.45, -0.15);
    rig.leftElbow.rotation.set(-1.15 + rPulse, 0, 0);
    rig.rightArm.rotation.set(-0.75, -0.3, 0.1);
    rig.rightElbow.rotation.set(-0.85, 0, 0);
  } else if (aiming) {
    rig.leftArm.rotation.set(-1.18, 0.55, -0.08);
    rig.leftElbow.rotation.set(-0.85, 0, 0);
    rig.rightArm.rotation.set(-1.25 - recoil, -0.25, 0.05);
    rig.rightElbow.rotation.set(-0.92, 0, 0);
  } else {
    const swing = speed > 0.35 ? Math.sin(time * 9) * 0.18 : Math.sin(time * 2.2) * 0.02;
    rig.leftArm.rotation.set(-0.78 + swing, 0.48, -0.06);
    rig.leftElbow.rotation.set(-0.82, 0, 0);
    rig.rightArm.rotation.set(-0.82 - swing * 0.4 - recoil, -0.22, 0.06);
    rig.rightElbow.rotation.set(-0.85, 0, 0);
  }
}

/**
 * Builds a realistic beveled 4x4 Military Tactical Recon Truck grounded at y = 0.
 */
export function createVehicleModel(accentColor = 0x5d6748): { group: THREE.Group; wheels: THREE.Mesh[] } {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.58, metalness: 0.25 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x1e2226, roughness: 0.5, metalness: 0.65 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x121417, roughness: 0.88, metalness: 0.05 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.35, metalness: 0.8 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x93c5fd,
    roughness: 0.08,
    metalness: 0.1,
    transparent: true,
    opacity: 0.55,
  });

  // Side silhouette extruded body with sloped hood, windshield frame, cab roof, and flatbed
  const bodyProfile = new THREE.Shape();
  bodyProfile.moveTo(-2.05, 0.45);
  bodyProfile.lineTo(2.05, 0.45);  // undercarriage
  bodyProfile.lineTo(2.12, 0.95);  // front bumper & grille
  bodyProfile.lineTo(1.88, 1.15);  // sloped hood
  bodyProfile.lineTo(0.82, 1.24);  // hood cowl
  bodyProfile.lineTo(0.45, 1.88);  // windshield pillar
  bodyProfile.lineTo(-0.92, 1.88); // cab roof
  bodyProfile.lineTo(-1.12, 1.25); // rear cab wall
  bodyProfile.lineTo(-2.05, 1.22); // cargo bed rail
  bodyProfile.closePath();

  const bodyGeo = new THREE.ExtrudeGeometry(bodyProfile, {
    depth: 1.86,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.06,
    bevelSegments: 2,
  });
  bodyGeo.rotateY(-Math.PI / 2);
  bodyGeo.translate(0.93, 0, 0);
  const hull = new THREE.Mesh(bodyGeo, bodyMat);
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);

  // Bullbar + Skid plate
  const bullbar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.9, 10), trimMat);
  bullbar.rotation.z = Math.PI / 2;
  bullbar.position.set(0, 0.72, 2.18);
  group.add(bullbar);

  // Windshield glass
  const windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.68, 0.68), glassMat);
  windshield.position.set(0, 1.56, 0.66);
  windshield.rotation.x = -0.52;
  group.add(windshield);

  // Headlights
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 1.2 });
  for (const sx of [-0.66, 0.66]) {
    const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 12), lightMat);
    hl.rotation.x = Math.PI / 2;
    hl.position.set(sx, 0.94, 2.14);
    group.add(hl);
  }

  // 4 Treaded Wheels grounded at y = 0 (radius = 0.48)
  const wheels: THREE.Mesh[] = [];
  const wheelGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.36, 20);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.38, 12);
  rimGeo.rotateZ(Math.PI / 2);

  const wheelCoords: [number, number, number][] = [
    [-1.08, 0.48, 1.32],
    [1.08, 0.48, 1.32],
    [-1.08, 0.48, -1.32],
    [1.08, 0.48, -1.32],
  ];
  for (const [wx, wy, wz] of wheelCoords) {
    const w = new THREE.Mesh(wheelGeo, tireMat);
    w.position.set(wx, wy, wz);
    w.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, rimMat);
    w.add(rim);
    wheels.push(w);
    group.add(w);
  }

  return { group, wheels };
}

/**
 * Builds a realistic ground loot item (gun/crate/medkit/helmet/vest) grounded at y = 0.
 */
export function createLootMesh(kind: string, colorHex: number): THREE.Group {
  const g = new THREE.Group();

  if (kind === 'medkit') {
    const bag = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.28, 0.22, 12),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.45 }),
    );
    bag.scale.set(1.3, 1, 0.9);
    bag.position.y = 0.18;
    const cross1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.24, 6), new THREE.MeshBasicMaterial({ color: 0xdc2626 }));
    cross1.rotation.z = Math.PI / 2;
    cross1.position.y = 0.3;
    const cross2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.24, 6), new THREE.MeshBasicMaterial({ color: 0xdc2626 }));
    cross2.rotation.x = Math.PI / 2;
    cross2.position.y = 0.3;
    g.add(bag, cross1, cross2);
  } else if (kind === 'helmet') {
    const helm = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
      new THREE.MeshStandardMaterial({ color: 0x3b4236, roughness: 0.4, metalness: 0.35 }),
    );
    helm.position.y = 0.14;
    g.add(helm);
  } else if (kind === 'armor') {
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.26, 0.44, 10),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.55, metalness: 0.25 }),
    );
    plate.scale.set(1.15, 1, 0.65);
    plate.position.y = 0.26;
    g.add(plate);
  } else if (kind === 'ammo') {
    const ammoBox = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.25, 0.26, 8),
      new THREE.MeshStandardMaterial({ color: 0x3f4a32, roughness: 0.65, metalness: 0.2 }),
    );
    ammoBox.scale.set(1.25, 1, 0.85);
    ammoBox.position.y = 0.18;
    const brassBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 0.07, 8),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.75 }),
    );
    brassBand.scale.set(1.26, 1, 0.86);
    brassBand.position.y = 0.21;
    g.add(ammoBox, brassBand);
  } else if (kind === 'grenade') {
    const frag = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x2c4a2e, roughness: 0.55, metalness: 0.3 }),
    );
    frag.position.y = 0.22;
    const pin = new THREE.Mesh(
      new THREE.TorusGeometry(0.06, 0.015, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 }),
    );
    pin.position.set(0.06, 0.38, 0);
    g.add(frag, pin);
  } else {
    const gunCrate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.2, 0.65, 8),
      new THREE.MeshStandardMaterial({ color: 0x2f3b2e, roughness: 0.6, metalness: 0.2 }),
    );
    gunCrate.rotation.z = Math.PI / 2;
    gunCrate.position.y = 0.2;
    g.add(gunCrate);
  }

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.52, 24),
    new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.68 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  g.add(ring);

  return g;
}
