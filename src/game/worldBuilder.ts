import * as THREE from 'three';
import {
  BuildingDef,
  groundHeightAt,
  MAP_BUILDINGS,
  TERRAIN_EXTENT,
  WATER_LEVEL,
  WORLD_RADIUS,
} from './mapData';
import { createConcreteTexture, createWoodTexture } from './models';

export interface WorldObjects {
  terrainMesh: THREE.Mesh;
  stormCylinder: THREE.Mesh;
  safeRingMesh: THREE.Mesh;
  cargoPlane: THREE.Group;
  dispose: () => void;
}

function createSkyDome(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(460, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x285680) },
      horizonColor: { value: new THREE.Color(0xb8d4e8) },
      sunDir: { value: new THREE.Vector3(110, 160, 85).normalize() },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 sunDir;
      varying vec3 vWorldPos;
      void main() {
        vec3 dir = normalize(vWorldPos);
        float h = clamp(dir.y, 0.0, 1.0);
        vec3 sky = mix(horizonColor, topColor, pow(h, 0.55));
        float sunDot = max(dot(dir, sunDir), 0.0);
        sky += vec3(1.0, 0.88, 0.68) * pow(sunDot, 160.0) * 1.4;
        sky += vec3(1.0, 0.78, 0.55) * pow(sunDot, 12.0) * 0.25;
        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  });
  return new THREE.Mesh(geo, mat);
}

function createTerrainGrassTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#c8cbb8';
  ctx.fillRect(0, 0, 512, 512);
  let seed = 313;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = 0; i < 6000; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(28,36,24,0.09)';
    ctx.fillRect(rand() * 512, rand() * 512, 2 + rand() * 4, 2 + rand() * 4);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(55, 55);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Builds an enterable realistic architectural building matching BUILDING_WALLS & surfaceHeightAt.
 */
function createEnterableBuilding(b: BuildingDef, maxAnisotropy: number): THREE.Group {
  const g = new THREE.Group();
  const baseY = groundHeightAt(b.x, b.z);
  g.position.set(b.x, baseY, b.z);
  g.rotation.y = b.rotY;

  const isCabin = b.style === 'cabin';
  const wallHex = `#${b.color.toString(16).padStart(6, '0')}`;
  const wallTex = isCabin
    ? createWoodTexture(wallHex, maxAnisotropy)
    : createConcreteTexture(wallHex, maxAnisotropy);

  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex,
    roughness: isCabin ? 0.85 : 0.78,
    metalness: b.style === 'military' ? 0.18 : 0.05,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: b.roofColor,
    roughness: 0.72,
    metalness: 0.2,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    map: createConcreteTexture('#585e68', maxAnisotropy),
    roughness: 0.85,
    metalness: 0.05,
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x242830, roughness: 0.6, metalness: 0.4 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x93c5fd,
    roughness: 0.08,
    metalness: 0.1,
    transparent: true,
    opacity: 0.45,
  });
  const crateMat = new THREE.MeshStandardMaterial({
    map: createWoodTexture('#6b4f35', maxAnisotropy),
    roughness: 0.8,
  });

  const wallT = 0.42;
  const doorW = 2.8;
  const doorH = 2.65;
  const segW = Math.max(0.5, (b.w - doorW) / 2);

  // Interior Ground Floor Slab (walkable at baseY + 0.16)
  const floor = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.25, 0.32, b.d + 0.25), floorMat);
  floor.position.y = 0.0;
  floor.receiveShadow = true;
  g.add(floor);

  // Left & Right Solid Walls with framed glass windows
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(wallT, b.h, b.d), wallMat);
    wall.position.set(side * (b.w / 2 - wallT / 2), b.h / 2, 0);
    wall.castShadow = true;
    wall.receiveShadow = true;
    g.add(wall);

    // Framed Window
    const winFrame = new THREE.Mesh(new THREE.BoxGeometry(wallT + 0.08, 1.35, 2.2), trimMat);
    winFrame.position.set(side * (b.w / 2 - wallT / 2), 2.1, 0);
    const winPane = new THREE.Mesh(new THREE.BoxGeometry(wallT + 0.12, 1.15, 2.0), glassMat);
    winPane.position.copy(winFrame.position);
    g.add(winFrame, winPane);
  }

  // Front & Back Perimeter Walls split around 2.8m open doorway + door lintel header
  for (const fb of [-1, 1]) {
    const wz = fb * (b.d / 2 - wallT / 2);

    const segL = new THREE.Mesh(new THREE.BoxGeometry(segW, b.h, wallT), wallMat);
    segL.position.set(-b.w / 2 + segW / 2, b.h / 2, wz);
    segL.castShadow = true;
    segL.receiveShadow = true;

    const segR = new THREE.Mesh(new THREE.BoxGeometry(segW, b.h, wallT), wallMat);
    segR.position.set(b.w / 2 - segW / 2, b.h / 2, wz);
    segR.castShadow = true;
    segR.receiveShadow = true;

    const lintelH = Math.max(0.4, b.h - doorH);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW, lintelH, wallT), wallMat);
    lintel.position.set(0, doorH + lintelH / 2, wz);
    lintel.castShadow = true;

    const frame = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.16, 0.14, wallT + 0.08), trimMat);
    frame.position.set(0, doorH, wz);

    g.add(segL, segR, lintel, frame);
  }

  // Interior Cover Crates inside building
  const crate = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.95, 1.15), crateMat);
  crate.position.set(-b.w * 0.25, 0.62, -b.d * 0.22);
  crate.castShadow = true;
  crate.receiveShadow = true;
  g.add(crate);

  // Roof Structure
  if (isCabin) {
    // Pitched Gable Cabin Roof via ExtrudeGeometry
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-b.w / 2 - 0.55, 0);
    roofShape.lineTo(0, 2.2);
    roofShape.lineTo(b.w / 2 + 0.55, 0);
    roofShape.lineTo(b.w / 2 + 0.55, 0.2);
    roofShape.lineTo(0, 2.42);
    roofShape.lineTo(-b.w / 2 - 0.55, 0.2);
    roofShape.closePath();
    const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: b.d + 0.8, bevelEnabled: false });
    roofGeo.translate(0, b.h, -(b.d + 0.8) / 2);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.castShadow = true;
    roof.receiveShadow = true;
    g.add(roof);
  } else {
    // Concrete Roof Deck + Tactical Parapet walls
    const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.35, 0.32, b.d + 0.35), roofMat);
    roof.position.y = b.h + 0.14;
    roof.castShadow = true;
    roof.receiveShadow = true;
    g.add(roof);

    const parapetH = 0.55;
    const pFront = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.35, parapetH, 0.22), trimMat);
    pFront.position.set(0, b.h + 0.28 + parapetH / 2, b.d / 2);
    const pBack = pFront.clone();
    pBack.position.z = -b.d / 2;
    const pLeft = new THREE.Mesh(new THREE.BoxGeometry(0.22, parapetH, b.d), trimMat);
    pLeft.position.set(-b.w / 2, b.h + 0.28 + parapetH / 2, 0);
    g.add(pFront, pBack, pLeft);
  }

  // Climbable Exterior Side Ramp / Staircase matching surfaceHeightAt()
  if (b.hasRoofAccess) {
    const rampLen = b.d * 0.84;
    const rampRise = b.h + 0.28;
    const hyp = Math.hypot(rampLen, rampRise);
    const angle = Math.atan2(rampRise, rampLen);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.24, hyp), trimMat);
    ramp.position.set(b.w / 2 + 0.92, rampRise / 2, 0);
    ramp.rotation.x = -angle;
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    g.add(ramp);

    // Handrail along stairs
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, hyp), roofMat);
    rail.position.set(b.w / 2 + 1.75, rampRise / 2 + 0.45, 0);
    rail.rotation.x = -angle;
    g.add(rail);
  }

  // Military / Watchtower Radio Mast
  if (b.style === 'tower' || b.style === 'military') {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 3.2, 8), trimMat);
    mast.position.set(-b.w * 0.28, b.h + 1.8, -b.d * 0.28);
    g.add(mast);
  }

  return g;
}

function createCargoPlane(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4b5344, roughness: 0.48, metalness: 0.55 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x2f342d, roughness: 0.4, metalness: 0.65 });

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.0, 18, 16), bodyMat);
  fuselage.rotation.x = Math.PI / 2;
  g.add(fuselage);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(2.3, 14, 10), accentMat);
  nose.scale.set(1, 0.95, 1.8);
  nose.position.z = 9.0;
  g.add(nose);

  const wingShape = new THREE.Shape();
  wingShape.moveTo(-12, -1.2);
  wingShape.lineTo(12, -1.2);
  wingShape.lineTo(9.5, 1.4);
  wingShape.lineTo(-9.5, 1.4);
  wingShape.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08 });
  wingGeo.rotateX(Math.PI / 2);
  const wing = new THREE.Mesh(wingGeo, bodyMat);
  wing.position.set(0, 1.1, 1.2);
  g.add(wing);

  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.4, 3.0), accentMat);
  tailFin.position.set(0, 2.6, -7.8);
  g.add(tailFin);

  const hStab = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.28, 2.1), bodyMat);
  hStab.position.set(0, 1.2, -8);
  g.add(hStab);

  return g;
}

export function buildBattleWorld(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  graphicsQuality: 'low' | 'medium' | 'high',
): WorldObjects {
  const disposables: Array<{ dispose: () => void }> = [];
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  // 0. Atmospheric Sky Gradient Dome
  const skyDome = createSkyDome();
  scene.add(skyDome);
  disposables.push(skyDome.geometry, skyDome.material as THREE.Material);

  // 1. Sculpted Natural Island Terrain
  const segs = graphicsQuality === 'low' ? 76 : 120;
  const terrainGeo = new THREE.PlaneGeometry(TERRAIN_EXTENT * 2, TERRAIN_EXTENT * 2, segs, segs);
  terrainGeo.rotateX(-Math.PI / 2);

  const pos = terrainGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cGrass = new THREE.Color(0x3f5e36);
  const cDry = new THREE.Color(0x636644);
  const cRock = new THREE.Color(0x5b5d5e);
  const cSand = new THREE.Color(0xb8a37e);
  const cRoad = new THREE.Color(0x373a40);
  const tmpColor = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = groundHeightAt(x, z);
    pos.setY(i, y);

    const dist = Math.hypot(x, z);
    const onMainRoad =
      (Math.abs(x - 10) < 4.5 && z > -85 && z < 45) ||
      (Math.abs(z - x * -0.82) < 4.5 && dist < 120);

    if (y < 0.25 || dist > WORLD_RADIUS - 14) {
      tmpColor.copy(cSand);
    } else if (onMainRoad) {
      tmpColor.copy(cRoad);
    } else if (y > 5.2) {
      tmpColor.copy(cRock);
    } else if (Math.sin(x * 0.04) + Math.cos(z * 0.04) > 0.35) {
      tmpColor.copy(cDry);
    } else {
      tmpColor.copy(cGrass);
    }

    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const terrainTex = createTerrainGrassTexture(maxAniso);
  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: terrainTex,
    roughness: 0.94,
    metalness: 0.02,
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);
  disposables.push(terrainGeo, terrainMat, terrainTex);

  // 2. River & Ocean Water Surface
  const waterGeo = new THREE.PlaneGeometry(TERRAIN_EXTENT * 2.4, TERRAIN_EXTENT * 2.4);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x165e7a,
    roughness: 0.14,
    metalness: 0.65,
    transparent: true,
    opacity: 0.86,
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = WATER_LEVEL;
  waterMesh.receiveShadow = true;
  scene.add(waterMesh);
  disposables.push(waterGeo, waterMat);

  // 3. Crosswind Concrete Bridge with Piers & Guardrails
  const bridgeGroup = new THREE.Group();
  const bridgeMat = new THREE.MeshStandardMaterial({
    map: createConcreteTexture('#525862', maxAniso),
    roughness: 0.78,
    metalness: 0.1,
  });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x333942, roughness: 0.55, metalness: 0.5 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(10, 0.7, 34), bridgeMat);
  deck.position.set(10, 1.43, -34);
  deck.castShadow = true;
  deck.receiveShadow = true;
  const railL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.05, 34), railMat);
  railL.position.set(5.2, 2.25, -34);
  const railR = railL.clone();
  railR.position.x = 14.8;
  bridgeGroup.add(deck, railL, railR);

  // Concrete bridge piers anchored below water
  for (const pz of [-46, -34, -22]) {
    for (const px of [6.5, 13.5]) {
      const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 4.2, 10), bridgeMat);
      pier.position.set(px, -0.6, pz);
      pier.castShadow = true;
      bridgeGroup.add(pier);
    }
  }
  scene.add(bridgeGroup);

  // 4. Enterable Architectural Buildings
  for (const b of MAP_BUILDINGS) {
    const bMesh = createEnterableBuilding(b, maxAniso);
    scene.add(bMesh);
  }

  // 5. Realistic Organic Trees (Natural Curved Trunks + Displaced Canopy Clusters, Instanced)
  const treeCount = graphicsQuality === 'low' ? 110 : graphicsQuality === 'medium' ? 175 : 230;
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.08, 1.8, 0.04),
    new THREE.Vector3(-0.06, 3.6, -0.05),
    new THREE.Vector3(0.04, 5.2, 0.02),
  ]);
  const trunkGeo = new THREE.TubeGeometry(trunkCurve, 8, 0.24, 8, false);
  const trunkMat = new THREE.MeshStandardMaterial({
    map: createWoodTexture('#4c3626', maxAniso),
    roughness: 0.92,
  });

  // Organic foliage cluster (perturbed IcosahedronGeometry — zero cones!)
  const crownGeo = new THREE.IcosahedronGeometry(2.35, 2);
  const cPos = crownGeo.attributes.position;
  for (let i = 0; i < cPos.count; i++) {
    const vx = cPos.getX(i);
    const vy = cPos.getY(i);
    const vz = cPos.getZ(i);
    const wobble = 1 + 0.16 * Math.sin(vx * 2.1 + vz * 1.7) + 0.12 * Math.cos(vy * 2.5);
    cPos.setXYZ(i, vx * wobble, vy * 0.85 * wobble + 5.6, vz * wobble);
  }
  crownGeo.computeVertexNormals();
  const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88 });

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const crownInst = new THREE.InstancedMesh(crownGeo, crownMat, treeCount);
  trunkInst.castShadow = true;
  crownInst.castShadow = true;
  crownInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const colorTmp = new THREE.Color();
  let placed = 0;
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  while (placed < treeCount) {
    const angle = rand() * Math.PI * 2;
    const rad = 18 + rand() * (WORLD_RADIUS - 32);
    const tx = Math.cos(angle) * rad;
    const tz = Math.sin(angle) * rad;
    const ty = groundHeightAt(tx, tz);
    if (ty < 0.45) continue;

    let blocked = Math.abs(tx - 10) < 9;
    if (!blocked) {
      for (const b of MAP_BUILDINGS) {
        if (Math.hypot(tx - b.x, tz - b.z) < Math.max(b.w, b.d) * 0.85 + 3.5) {
          blocked = true;
          break;
        }
      }
    }
    if (blocked) continue;

    const sc = 0.82 + rand() * 0.55;
    dummy.position.set(tx, ty - 0.15, tz);
    dummy.rotation.set((rand() - 0.5) * 0.06, rand() * Math.PI * 2, (rand() - 0.5) * 0.06);
    dummy.scale.set(sc, sc, sc);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(placed, dummy.matrix);
    crownInst.setMatrixAt(placed, dummy.matrix);

    colorTmp.setHSL(0.28 + (rand() - 0.5) * 0.05, 0.36, 0.24 + rand() * 0.1);
    crownInst.setColorAt(placed, colorTmp);
    placed++;
  }
  trunkInst.instanceMatrix.needsUpdate = true;
  crownInst.instanceMatrix.needsUpdate = true;
  if (crownInst.instanceColor) crownInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  crownInst.computeBoundingSphere();
  scene.add(trunkInst, crownInst);
  disposables.push(trunkGeo, trunkMat, crownGeo, crownMat);

  // 6. Natural Cover Boulders
  const rockCount = 90;
  const rockGeo = new THREE.DodecahedronGeometry(1.45, 1);
  const rPos = rockGeo.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const rx = rPos.getX(i);
    const ry = rPos.getY(i);
    const rz = rPos.getZ(i);
    const j = 0.85 + 0.25 * Math.sin(rx * 3.1 + rz * 2.2);
    rPos.setXYZ(i, rx * j, ry * 0.72 * j + 0.65, rz * j);
  }
  rockGeo.computeVertexNormals();
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.05 });
  const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  rockInst.castShadow = true;
  rockInst.receiveShadow = true;

  for (let i = 0; i < rockCount; i++) {
    const angle = rand() * Math.PI * 2;
    const rad = 20 + rand() * (WORLD_RADIUS - 28);
    const rx = Math.cos(angle) * rad;
    const rz = Math.sin(angle) * rad;
    const ry = groundHeightAt(rx, rz);
    dummy.position.set(rx, Math.max(0.1, ry - 0.25), rz);
    dummy.rotation.set(rand() * 0.4, rand() * Math.PI * 2, rand() * 0.4);
    dummy.scale.set(0.75 + rand() * 1.1, 0.65 + rand() * 0.85, 0.75 + rand() * 1.1);
    dummy.updateMatrix();
    rockInst.setMatrixAt(i, dummy.matrix);
    colorTmp.setHSL(0.1, 0.06, 0.34 + rand() * 0.14);
    rockInst.setColorAt(i, colorTmp);
  }
  rockInst.instanceMatrix.needsUpdate = true;
  if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
  rockInst.computeBoundingSphere();
  scene.add(rockInst);
  disposables.push(rockGeo, rockMat);

  // 7. Shrinking Safe Zone & Blue/Amber Storm Boundary
  const stormGeo = new THREE.CylinderGeometry(1, 1, 90, 48, 1, true);
  const stormMat = new THREE.MeshBasicMaterial({
    color: 0x3b82f6,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const stormCylinder = new THREE.Mesh(stormGeo, stormMat);
  stormCylinder.position.y = 35;
  stormCylinder.scale.set(WORLD_RADIUS, 1, WORLD_RADIUS);
  scene.add(stormCylinder);
  disposables.push(stormGeo, stormMat);

  const safeGeo = new THREE.RingGeometry(0.985, 1, 64);
  safeGeo.rotateX(-Math.PI / 2);
  const safeMat = new THREE.MeshBasicMaterial({
    color: 0xe2e8f0,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
  });
  const safeRingMesh = new THREE.Mesh(safeGeo, safeMat);
  safeRingMesh.position.y = 0.5;
  scene.add(safeRingMesh);
  disposables.push(safeGeo, safeMat);

  // 8. Military Cargo Gunship
  const cargoPlane = createCargoPlane();
  cargoPlane.position.set(-220, 78, -220);
  scene.add(cargoPlane);

  return {
    terrainMesh,
    stormCylinder,
    safeRingMesh,
    cargoPlane,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
