import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Crosshair,
  Heart,
  Shield,
  Volume2,
  VolumeX,
  Pause,
  LogOut,
  MessageSquare,
  Mic,
  MicOff,
  Flag,
  ChevronRight,
  Car,
  Zap,
  Award,
  Eye,
  Backpack,
  X,
} from 'lucide-react';
import { ATTACHMENTS, CHARACTERS, WEAPONS } from '../game/catalog';
import { soundEngine } from '../game/audio';
import { groundHeightAt, MAP_POIS, surfaceHeightAt, WORLD_RADIUS } from '../game/mapData';
import {
  animateCharacterRig,
  CharacterRig,
  createCharacterModel,
  createLootMesh,
  createVehicleModel,
  createWeaponModel,
} from '../game/models';
import { buildBattleWorld } from '../game/worldBuilder';
import { PlayerSettings, submitPlayerReport, UserProfile } from '../services/gameDb';

export interface MatchSummaryResult {
  mode: string;
  placement: number;
  totalPlayers: number;
  kills: number;
  damage: number;
  won: boolean;
}

interface BattleCanvasProps {
  ws: WebSocket | null;
  profile: UserProfile;
  settings: PlayerSettings;
  roomInfo: { roomId: string; roomCode: string; mode: string; selfId: string };
  onExitMatch: (summary: MatchSummaryResult) => void;
}

interface SnapshotActor {
  id: string;
  isBot: boolean;
  username: string;
  team: number;
  character: string;
  outfit: string;
  hair: string;
  accessory: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  shield: number;
  armorLevel: number;
  helmetLevel: number;
  alive: boolean;
  deadAt: number;
  kills: number;
  damageDealt: number;
  weaponId: string;
  skinId?: string;
  activeSlot: number;
  slots: Array<{ weaponId: string; ammo: number; reserveAmmo: number } | null>;
  ammo: number;
  reserveAmmo: number;
  medkits: number;
  grenades: number;
  inPlane: boolean;
  parachuting: boolean;
  jumping: boolean;
  crouching: boolean;
  prone: boolean;
  swimming: boolean;
  climbing: boolean;
  aiming: boolean;
  vehicleId: string | null;
  reloading: boolean;
  healing: boolean;
  shieldActive: boolean;
  reconActive: boolean;
  abilityCooldownSec: number;
}

interface SnapshotState {
  phase: 'plane' | 'active' | 'ended';
  planePos: { x: number; y: number; z: number };
  zone: { x: number; z: number; radius: number; targetRadius: number; phase: number; secsLeft: number };
  clash: { round: number; scoreA: number; scoreB: number };
  aliveCount: number;
  totalCount: number;
  killFeed: Array<{ id: string; killer: string; victim: string; weapon: string; headshot: boolean }>;
  actors: SnapshotActor[];
  loot: Array<{ id: string; kind: string; weaponId?: string; label: string; color: number; x: number; y: number; z: number }>;
  vehicles: Array<{ id: string; x: number; y: number; z: number; rotY: number; speed: number; driverId: string | null }>;
  grenades: Array<{ id: string; x: number; y: number; z: number }>;
}

// Pre-allocated math helpers (zero GC inside render loop)
const _camTarget = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _tracerStart = new THREE.Vector3();
const _tracerEnd = new THREE.Vector3();

export const BattleCanvas: React.FC<BattleCanvasProps> = ({
  ws,
  profile,
  settings,
  roomInfo,
  onExitMatch,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const snapshotRef = useRef<SnapshotState | null>(null);
  const yawRef = useRef(0);
  const pitchRef = useRef(-0.08);
  const recoilOffsetRef = useRef(0);
  const shakeRef = useRef(0);
  const hitstopRef = useRef(0);
  const pendingTracersRef = useRef<Array<{ ox: number; oy: number; oz: number; tx: number; ty: number; tz: number; life: number }>>([]);
  const pendingExplosionsRef = useRef<Array<{ x: number; y: number; z: number }>>([]);
  const pendingFlashesRef = useRef<Array<{ x: number; y: number; z: number }>>([]);
  const pendingImpactsRef = useRef<Array<{ x: number; y: number; z: number }>>([]);
  const spectateIndexRef = useRef(0);
  const firstPersonRef = useRef(false);
  const isAdsRef = useRef(false);
  const wonRef = useRef(false);
  const tapFireQueuedRef = useRef(false);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [hudState, setHudState] = useState<{
    self: SnapshotActor | null;
    aliveCount: number;
    totalCount: number;
    zoneSecs: number;
    zonePhase: number;
    inStorm: boolean;
    phase: string;
    clash: { round: number; scoreA: number; scoreB: number };
    killFeed: SnapshotState['killFeed'];
    nearbyLoot: string | null;
    nearbyVehicle: boolean;
    hitFlash: 'none' | 'body' | 'head';
    lootBanner: string | null;
    spectatingName: string | null;
    spectatingId: string | null;
    isAiming: boolean;
    crouchActive: boolean;
    proneActive: boolean;
  }>({
    self: null,
    aliveCount: 50,
    totalCount: 50,
    zoneSecs: 38,
    zonePhase: 1,
    inStorm: false,
    phase: 'plane',
    clash: { round: 1, scoreA: 0, scoreB: 0 },
    killFeed: [],
    nearbyLoot: null,
    nearbyVehicle: false,
    hitFlash: 'none',
    lootBanner: null,
    spectatingName: null,
    spectatingId: null,
    isAiming: false,
    crouchActive: false,
    proneActive: false,
  });

  const [paused, setPaused] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const inventoryOpenRef = useRef(false);
  inventoryOpenRef.current = inventoryOpen;
  const [firstPerson, setFirstPerson] = useState(false);
  const [muted, setMuted] = useState(settings.muted);
  const [matchEnd, setMatchEnd] = useState<{ won: boolean; winnerName: string } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; senderName: string; text: string }>>([]);
  const [micActive, setMicActive] = useState(false);
  const [reportMsg, setReportMsg] = useState<string | null>(null);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [stickKnob, setStickKnob] = useState({ x: 0, y: 0 });

  // Mobile & shared toggle input state refs
  const touchMoveRef = useRef({ x: 0, z: 0 });
  const touchAimRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const touchLookRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const touchFireRef = useRef(false);
  const touchAimDownRef = useRef(false);
  const touchJumpRef = useRef(false);
  const stanceToggleRef = useRef({ crouch: false, prone: false });
  const isTouchDevice =
    settings.showMobileControls ||
    (typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0));

  const sendAction = (action: string, extra: Record<string, unknown> = {}) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'match:action', action, ...extra }));
    }
  };

  // WebSocket message listener for match state, shots, hits, explosions, chat
  useEffect(() => {
    if (!ws) return;
    const onMessage = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'match:state') {
          snapshotRef.current = msg as SnapshotState;
        } else if (msg.type === 'match:shot') {
          const w = WEAPONS[msg.weaponId] || WEAPONS.ak47_ember;
          if (msg.shooterId === roomInfo.selfId) {
            soundEngine.playGunshot(w.category);
            recoilOffsetRef.current = Math.min(0.14, recoilOffsetRef.current + w.recoil * 0.00055);
            shakeRef.current = Math.max(shakeRef.current, w.category === 'sniper' ? 0.25 : 0.08);
          } else {
            const self = snapshotRef.current?.actors.find((a) => a.id === roomInfo.selfId);
            if (self && Math.hypot(self.x - msg.origin.x, self.z - msg.origin.z) < 75) {
              soundEngine.playGunshot(w.category);
            }
          }
          pendingFlashesRef.current.push({ x: msg.origin.x, y: msg.origin.y, z: msg.origin.z });
          for (const t of msg.targets || []) {
            pendingTracersRef.current.push({
              ox: msg.origin.x,
              oy: msg.origin.y,
              oz: msg.origin.z,
              tx: t.x,
              ty: t.y,
              tz: t.z,
              life: 0.08,
            });
            pendingImpactsRef.current.push({ x: t.x, y: t.y, z: t.z });
          }
        } else if (msg.type === 'match:hit') {
          soundEngine.playHitmarker(Boolean(msg.headshot));
          if (msg.killed) hitstopRef.current = 0.045;
          setHudState((prev) => ({ ...prev, hitFlash: msg.headshot ? 'head' : 'body' }));
          setTimeout(() => setHudState((prev) => ({ ...prev, hitFlash: 'none' })), 140);
        } else if (msg.type === 'match:explosion') {
          soundEngine.playExplosion();
          shakeRef.current = Math.max(shakeRef.current, 0.45);
          pendingExplosionsRef.current.push({ x: msg.x, y: msg.y, z: msg.z });
        } else if (msg.type === 'match:looted') {
          soundEngine.playUiClick();
          setHudState((prev) => ({ ...prev, lootBanner: `Equipped: ${msg.label}` }));
          setTimeout(() => setHudState((prev) => ({ ...prev, lootBanner: null })), 1800);
        } else if (msg.type === 'match:ended') {
          const self = snapshotRef.current?.actors.find((a) => a.id === roomInfo.selfId);
          const won =
            roomInfo.mode === 'clash_squad'
              ? self?.team === msg.winnerTeam
              : Boolean(self?.alive) || msg.winnerName === profile.username;
          wonRef.current = won;
          if (won) soundEngine.playVictory();
          setMatchEnd({ won, winnerName: msg.winnerName || 'Survivor' });
          if (document.pointerLockElement) document.exitPointerLock();
        } else if (msg.type === 'chat:message' && msg.channel === 'match') {
          setChatMessages((prev) => [...prev.slice(-18), { id: msg.id, senderName: msg.senderName, text: msg.text }]);
        }
      } catch {
        // Ignore parse error
      }
    };
    ws.addEventListener('message', onMessage);
    return () => ws.removeEventListener('message', onMessage);
  }, [ws, roomInfo.selfId, roomInfo.mode, profile.username]);

  // Main Three.js 60fps Engine Lifecycle (mounted once)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl && settingsRef.current.graphicsQuality !== 'low',
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    const dprCap = settingsRef.current.graphicsQuality === 'low' ? 1 : 2;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, dprCap));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = !isSoftwareGl && settingsRef.current.graphicsQuality !== 'low';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x88b4d8);
    scene.fog = new THREE.FogExp2(0x88b4d8, 0.0042);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      settingsRef.current.fov || 70,
      container.clientWidth / container.clientHeight,
      0.1,
      550,
    );

    // Outdoor Daylight + Cool Hemisphere + Rim
    const hemi = new THREE.HemisphereLight(0xbae6fd, 0x3b3024, 0.78);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff5e4, 2.1);
    sun.position.set(110, 160, 85);
    sun.castShadow = !isSoftwareGl && settingsRef.current.graphicsQuality !== 'low';
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -140;
    sun.shadow.camera.right = 140;
    sun.shadow.camera.top = 140;
    sun.shadow.camera.bottom = -140;
    sun.shadow.camera.far = 360;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);

    const world = buildBattleWorld(scene, renderer, settingsRef.current.graphicsQuality);

    // Dynamic Pools: Actors, Vehicles, Loot, Grenades, Tracers, Particles
    const actorRigs = new Map<string, { rig: CharacterRig; weaponId: string; skinId: string }>();
    const vehicleMeshes = new Map<string, { group: THREE.Group; wheels: THREE.Mesh[] }>();
    const lootMeshes = new Map<string, THREE.Group>();
    const grenadeMeshes = new Map<string, THREE.Mesh>();
    const activeTracers: Array<{ line: THREE.Line; life: number }> = [];
    const activeParticles: Array<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number }> = [];

    const tracerMat = new THREE.LineBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.85 });
    const particleGeo = new THREE.SphereGeometry(0.28, 6, 6);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xff6b2b, transparent: true, opacity: 0.9 });
    const impactGeo = new THREE.SphereGeometry(0.08, 5, 5);
    const impactMat = new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.95 });
    const muzzleFlashGeo = new THREE.SphereGeometry(0.18, 6, 6);
    const muzzleFlashMat = new THREE.MeshBasicMaterial({ color: 0xfdba74, transparent: true, opacity: 0.9 });
    const muzzleFlashMesh = new THREE.Mesh(muzzleFlashGeo, muzzleFlashMat);
    muzzleFlashMesh.visible = false;
    scene.add(muzzleFlashMesh);
    const muzzleLight = new THREE.PointLight(0xffb347, 0, 12);
    scene.add(muzzleLight);
    let muzzleFlashTimer = 0;

    const grenadeGeo = new THREE.SphereGeometry(0.22, 8, 8);
    const grenadeMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.6 });

    if (!isSoftwareGl) renderer.compile(scene, camera);

    // Input Tracking (Continuous held keys vs edge actions + blur reset)
    const keys: Record<string, boolean> = {};
    let mouseFire = false;
    let mouseAim = false;

    const onKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      keys[e.code] = true;

      if (e.code === 'Escape') {
        if (inventoryOpenRef.current) {
          setInventoryOpen(false);
        } else {
          setPaused((p) => !p);
        }
        if (document.pointerLockElement) document.exitPointerLock();
      } else if (e.code === 'Tab' || e.code === 'KeyB' || e.code === 'KeyI') {
        e.preventDefault();
        setInventoryOpen((o) => {
          const next = !o;
          if (next && document.pointerLockElement) document.exitPointerLock();
          return next;
        });
      } else if (e.code === 'KeyR') {
        soundEngine.playReload();
        sendAction('reload');
      } else if (e.code === 'KeyF') {
        const self = snapshotRef.current?.actors.find((a) => a.id === roomInfo.selfId);
        if (self?.inPlane) {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'match:input', jumpOut: true }));
          }
        } else {
          // Check nearby vehicle or loot
          const snap = snapshotRef.current;
          const nearVeh = snap?.vehicles.find(
            (v) => !v.driverId && self && Math.hypot(v.x - self.x, v.z - self.z) < 4.5,
          );
          if (self?.vehicleId || nearVeh) {
            sendAction('vehicle');
          } else {
            sendAction('pickup');
          }
        }
      } else if (e.code === 'Space') {
        const self = snapshotRef.current?.actors.find((a) => a.id === roomInfo.selfId);
        if (self?.inPlane && ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'match:input', jumpOut: true }));
        } else if (self && !self.parachuting && self.y > groundHeightAt(self.x, self.z) + 6) {
          ws?.send(JSON.stringify({ type: 'match:input', deployChute: true }));
        }
      } else if (e.code === 'KeyH') {
        soundEngine.playHeal();
        sendAction('medkit');
      } else if (e.code === 'KeyG') {
        sendAction('grenade');
      } else if (e.code === 'KeyE') {
        soundEngine.playUiClick();
        sendAction('ability');
      } else if (e.code === 'Digit1') {
        sendAction('switch_slot', { slot: 0 });
      } else if (e.code === 'Digit2') {
        sendAction('switch_slot', { slot: 1 });
      } else if (e.code === 'Digit3') {
        sendAction('switch_slot', { slot: 2 });
      } else if (e.code === 'KeyC') {
        stanceToggleRef.current.crouch = !stanceToggleRef.current.crouch;
        if (stanceToggleRef.current.crouch) stanceToggleRef.current.prone = false;
      } else if (e.code === 'KeyZ') {
        stanceToggleRef.current.prone = !stanceToggleRef.current.prone;
        if (stanceToggleRef.current.prone) stanceToggleRef.current.crouch = false;
      } else if (e.code === 'KeyV') {
        firstPersonRef.current = !firstPersonRef.current;
        setFirstPerson(firstPersonRef.current);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };

    const onBlur = () => {
      Object.keys(keys).forEach((k) => (keys[k] = false));
      mouseFire = false;
      mouseAim = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      const sens =
        0.0022 *
        settingsRef.current.mouseSensitivity *
        (mouseAim ? settingsRef.current.adsSensitivity : 1);
      yawRef.current -= e.movementX * sens;
      pitchRef.current = THREE.MathUtils.clamp(pitchRef.current - e.movementY * sens, -0.85, 0.78);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.target !== renderer.domElement) return;
      soundEngine.unlock();
      if (!isTouchDevice && document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock?.();
      }
      if (e.button === 0) {
        mouseFire = true;
        tapFireQueuedRef.current = true;
      }
      if (e.button === 2) mouseAim = true;
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) mouseFire = false;
      if (e.button === 2) mouseAim = false;
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const onPointerLockChange = () => {
      setPointerLocked(document.pointerLockElement === renderer.domElement);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('pointerlockchange', onPointerLockChange);

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    // Send Input Packet to Authoritative Server at 20Hz
    const inputTimer = window.setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const mx = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0) + touchMoveRef.current.x;
      const mz = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0) + touchMoveRef.current.z;
      const aim = mouseAim || touchAimDownRef.current;
      isAdsRef.current = aim;

      let fire = false;
      const fm = settingsRef.current.fireMode;
      if (fm === 'tap') {
        fire = tapFireQueuedRef.current;
        tapFireQueuedRef.current = false;
      } else if (fm === 'auto') {
        fire = mouseFire || touchFireRef.current;
        if (!fire && snapshotRef.current) {
          const self = snapshotRef.current.actors.find((a) => a.id === roomInfo.selfId);
          if (self?.alive && !self.inPlane && !self.parachuting && !self.swimming) {
            const fx = -Math.sin(yawRef.current);
            const fz = -Math.cos(yawRef.current);
            fire = snapshotRef.current.actors.some((other) => {
              if (!other.alive || other.id === self.id || other.inPlane) return false;
              if (roomInfo.mode !== 'br_solo' && roomInfo.mode !== 'training' && other.team === self.team) return false;
              const dx = other.x - self.x;
              const dz = other.z - self.z;
              const dist = Math.hypot(dx, dz);
              if (dist > 65 || dist < 0.5) return false;
              const dot = (dx / dist) * fx + (dz / dist) * fz;
              return dot > 0.985;
            });
          }
        }
      } else {
        fire = mouseFire || touchFireRef.current;
      }

      ws.send(
        JSON.stringify({
          type: 'match:input',
          moveX: THREE.MathUtils.clamp(mx, -1, 1),
          moveZ: THREE.MathUtils.clamp(mz, -1, 1),
          yaw: yawRef.current,
          pitch: pitchRef.current + recoilOffsetRef.current,
          sprint: Boolean(keys['ShiftLeft'] || keys['ShiftRight'] || Math.hypot(touchMoveRef.current.x, touchMoveRef.current.z) > 0.78),
          jump: Boolean(keys['Space'] || touchJumpRef.current),
          crouch: stanceToggleRef.current.crouch,
          prone: stanceToggleRef.current.prone,
          fire,
          aim,
        }),
      );
      touchJumpRef.current = false;
    }, 50);

    // Sync HUD state at 10Hz to keep React zero-overhead on 60fps loop
    const hudTimer = window.setInterval(() => {
      const snap = snapshotRef.current;
      if (!snap) return;
      const self = snap.actors.find((a) => a.id === roomInfo.selfId) || null;
      let nearbyLoot: string | null = null;
      let nearbyVehicle = false;
      if (self && self.alive && !self.inPlane) {
        const l = snap.loot.find((item) => Math.hypot(item.x - self.x, item.z - self.z) < 4.2);
        if (l) nearbyLoot = l.label;
        nearbyVehicle = snap.vehicles.some((v) => !v.driverId && Math.hypot(v.x - self.x, v.z - self.z) < 4.5);
      }

      let spectatingName: string | null = null;
      let spectatingId: string | null = null;
      if (self && !self.alive) {
        const aliveList = snap.actors.filter((a) => a.alive);
        if (aliveList.length > 0) {
          const target = aliveList[spectateIndexRef.current % aliveList.length];
          spectatingName = target.username;
          spectatingId = target.id;
        }
      }

      const inStorm = Boolean(
        self &&
          self.alive &&
          !self.inPlane &&
          Math.hypot(self.x - snap.zone.x, self.z - snap.zone.z) > snap.zone.radius,
      );

      setHudState((prev) => ({
        ...prev,
        self,
        aliveCount: snap.aliveCount,
        totalCount: snap.totalCount,
        zoneSecs: snap.zone.secsLeft,
        zonePhase: snap.zone.phase,
        inStorm,
        phase: snap.phase,
        clash: snap.clash,
        killFeed: snap.killFeed,
        nearbyLoot,
        nearbyVehicle,
        spectatingName,
        spectatingId,
        isAiming: isAdsRef.current,
        crouchActive: stanceToggleRef.current.crouch,
        proneActive: stanceToggleRef.current.prone,
      }));

      // Draw Tactical Minimap Radar
      const rCanvas = radarCanvasRef.current;
      if (rCanvas && self) {
        const rCtx = rCanvas.getContext('2d');
        if (rCtx) {
          const size = rCanvas.width;
          const half = size / 2;
          const scale = size / (WORLD_RADIUS * 2.15);
          rCtx.clearRect(0, 0, size, size);
          rCtx.fillStyle = '#0a101d';
          rCtx.fillRect(0, 0, size, size);

          // Island circle
          rCtx.beginPath();
          rCtx.arc(half, half, WORLD_RADIUS * scale, 0, Math.PI * 2);
          rCtx.fillStyle = '#1b2c22';
          rCtx.fill();

          // Safe Zone
          rCtx.beginPath();
          rCtx.arc(half + snap.zone.x * scale, half + snap.zone.z * scale, snap.zone.radius * scale, 0, Math.PI * 2);
          rCtx.strokeStyle = '#00e5ff';
          rCtx.lineWidth = 1.5;
          rCtx.stroke();

          // POI labels
          rCtx.fillStyle = 'rgba(226, 232, 240, 0.45)';
          rCtx.font = '8px sans-serif';
          for (const poi of MAP_POIS) {
            rCtx.fillText(poi.name.split(' ')[0], half + poi.x * scale - 12, half + poi.z * scale);
          }

          // Vehicles
          rCtx.fillStyle = '#f59e0b';
          for (const v of snap.vehicles) {
            rCtx.fillRect(half + v.x * scale - 2, half + v.z * scale - 2, 4, 4);
          }

          // Enemies (if Recon Pulse active or firing nearby)
          if (self.reconActive) {
            rCtx.fillStyle = '#ef4444';
            for (const a of snap.actors) {
              if (!a.alive || a.id === self.id) continue;
              if (Math.hypot(a.x - self.x, a.z - self.z) < 68) {
                rCtx.beginPath();
                rCtx.arc(half + a.x * scale, half + a.z * scale, 2.6, 0, Math.PI * 2);
                rCtx.fill();
              }
            }
          }

          // Self arrow
          const sx = half + self.x * scale;
          const sy = half + self.z * scale;
          rCtx.save();
          rCtx.translate(sx, sy);
          rCtx.rotate(-yawRef.current);
          rCtx.fillStyle = '#ffffff';
          rCtx.beginPath();
          rCtx.moveTo(0, -5);
          rCtx.lineTo(3.5, 4);
          rCtx.lineTo(-3.5, 4);
          rCtx.closePath();
          rCtx.fill();
          rCtx.restore();
        }
      }
    }, 100);

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      const rawDt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      if (hitstopRef.current > 0) {
        hitstopRef.current = Math.max(0, hitstopRef.current - rawDt);
        renderer.render(scene, camera);
        if (isSoftwareGl) afterDraw(tick);
        else frameId = requestAnimationFrame(tick);
        return;
      }

      const snap = snapshotRef.current;
      recoilOffsetRef.current = THREE.MathUtils.damp(recoilOffsetRef.current, 0, 14, rawDt);
      shakeRef.current = THREE.MathUtils.damp(shakeRef.current, 0, 12, rawDt);

      if (snap) {
        // 1. Update Storm Cylinder & Safe Ring
        world.stormCylinder.position.x = snap.zone.x;
        world.stormCylinder.position.z = snap.zone.z;
        world.stormCylinder.scale.set(snap.zone.radius, 1, snap.zone.radius);
        world.safeRingMesh.position.x = snap.zone.x;
        world.safeRingMesh.position.z = snap.zone.z;
        world.safeRingMesh.scale.set(snap.zone.targetRadius, snap.zone.targetRadius, 1);

        // 2. Update Cargo Plane
        world.cargoPlane.visible = snap.phase === 'plane';
        if (snap.planePos) {
          world.cargoPlane.position.lerp(_camTarget.set(snap.planePos.x, snap.planePos.y, snap.planePos.z), 0.25);
          world.cargoPlane.rotation.y = Math.atan2(350, 310);
        }

        // 3. Sync Loot Meshes
        const activeLootIds = new Set(snap.loot.map((l) => l.id));
        for (const [lid, mesh] of lootMeshes) {
          if (!activeLootIds.has(lid)) {
            scene.remove(mesh);
            lootMeshes.delete(lid);
          }
        }
        for (const l of snap.loot) {
          let mesh = lootMeshes.get(l.id);
          if (!mesh) {
            mesh = createLootMesh(l.kind, l.color);
            mesh.position.set(l.x, l.y, l.z);
            scene.add(mesh);
            lootMeshes.set(l.id, mesh);
          }
          mesh.rotation.y = elapsed * 1.6;
        }

        // 4. Sync Vehicles
        for (const v of snap.vehicles) {
          let vm = vehicleMeshes.get(v.id);
          if (!vm) {
            vm = createVehicleModel();
            vm.group.position.set(v.x, v.y, v.z);
            scene.add(vm.group);
            vehicleMeshes.set(v.id, vm);
          }
          vm.group.position.x = THREE.MathUtils.damp(vm.group.position.x, v.x, 14, rawDt);
          vm.group.position.y = THREE.MathUtils.damp(vm.group.position.y, v.y, 14, rawDt);
          vm.group.position.z = THREE.MathUtils.damp(vm.group.position.z, v.z, 14, rawDt);
          vm.group.rotation.y = v.rotY;
          for (const w of vm.wheels) w.rotation.x += v.speed * rawDt * 1.8;
        }

        // 5. Sync Grenades
        const activeGrIds = new Set(snap.grenades.map((g) => g.id));
        for (const [gid, m] of grenadeMeshes) {
          if (!activeGrIds.has(gid)) {
            scene.remove(m);
            grenadeMeshes.delete(gid);
          }
        }
        for (const g of snap.grenades) {
          let m = grenadeMeshes.get(g.id);
          if (!m) {
            m = new THREE.Mesh(grenadeGeo, grenadeMat);
            scene.add(m);
            grenadeMeshes.set(g.id, m);
          }
          m.position.set(g.x, g.y, g.z);
        }

        // 6. Sync Actors (with live weapon/skin swaps + death & victory animations)
        const nowMs = Date.now();
        for (const a of snap.actors) {
          let entry = actorRigs.get(a.id);
          if (!entry) {
            const rig = createCharacterModel({
              characterId: a.character,
              outfitId: a.outfit,
              hairId: a.hair,
              accessoryId: a.accessory,
              weaponId: a.weaponId,
              skinId: a.skinId,
              teamTint: roomInfo.mode === 'clash_squad' ? (a.team === 0 ? 0x0ea5e9 : 0xef4444) : undefined,
            });
            rig.root.position.set(a.x, a.y, a.z);
            scene.add(rig.root);
            entry = { rig, weaponId: a.weaponId, skinId: a.skinId || '' };
            actorRigs.set(a.id, entry);
          }

          const nextSkinId = a.skinId || '';
          if (entry.weaponId !== a.weaponId || entry.skinId !== nextSkinId) {
            while (entry.rig.weaponMount.children.length > 0) {
              entry.rig.weaponMount.remove(entry.rig.weaponMount.children[0]);
            }
            entry.rig.weaponMount.add(createWeaponModel(a.weaponId, nextSkinId || undefined));
            entry.weaponId = a.weaponId;
            entry.skinId = nextSkinId;
          }

          const { rig } = entry;
          const isSelfFpsHide =
            a.id === roomInfo.selfId &&
            (firstPersonRef.current || ((mouseAim || touchAimDownRef.current) && a.weaponId === 'awm_frost'));
          const recentlyDead = !a.alive && a.deadAt > 0 && nowMs - a.deadAt < 4000;
          rig.root.visible = (a.alive || recentlyDead) && !a.inPlane && !a.vehicleId && !isSelfFpsHide;
          if (!rig.root.visible) continue;

          const prevX = rig.root.position.x;
          const prevZ = rig.root.position.z;
          rig.root.position.x = THREE.MathUtils.damp(rig.root.position.x, a.x, 16, rawDt);
          rig.root.position.y = THREE.MathUtils.damp(rig.root.position.y, a.y, 16, rawDt);
          rig.root.position.z = THREE.MathUtils.damp(rig.root.position.z, a.z, 16, rawDt);
          rig.root.rotation.y = a.id === roomInfo.selfId ? yawRef.current : a.yaw;

          rig.helmetMesh.visible = a.helmetLevel > 0;
          rig.vestMesh.visible = a.armorLevel > 0;
          rig.shieldAura.visible = a.shieldActive;

          const moveSpeed = Math.hypot(rig.root.position.x - prevX, rig.root.position.z - prevZ) / Math.max(rawDt, 0.001);
          animateCharacterRig(rig, {
            time: elapsed,
            speed: moveSpeed,
            parachuting: a.parachuting,
            jumping: a.jumping,
            dead: !a.alive,
            victory: wonRef.current && a.id === roomInfo.selfId,
            crouching: a.crouching,
            prone: a.prone,
            swimming: a.swimming,
            climbing: a.climbing,
            aiming: a.aiming,
            reloading: a.reloading,
            recoil: a.id === roomInfo.selfId ? recoilOffsetRef.current * 4 : 0,
          });
        }

        // 7. Third-Person Over-The-Shoulder / First-Person Aiming / Sniper Optic / Plane Camera
        const self = snap.actors.find((a) => a.id === roomInfo.selfId);
        let focusActor = self;
        if (self && !self.alive) {
          const aliveList = snap.actors.filter((a) => a.alive);
          if (aliveList.length > 0) {
            focusActor = aliveList[spectateIndexRef.current % aliveList.length];
          }
        }

        if (focusActor) {
          if (focusActor.inPlane) {
            _camDesired.set(snap.planePos.x - 16, snap.planePos.y + 11, snap.planePos.z - 22);
            camera.position.lerp(_camDesired, 1 - Math.exp(-6 * rawDt));
            camera.lookAt(snap.planePos.x, snap.planePos.y, snap.planePos.z);
          } else {
            const isAiming = (mouseAim || touchAimDownRef.current) && focusActor.id === roomInfo.selfId;
            const isSniper = focusActor.weaponId === 'awm_frost';
            const useFirstPerson =
              focusActor.id === roomInfo.selfId &&
              !focusActor.vehicleId &&
              !focusActor.parachuting &&
              (firstPersonRef.current || (isAiming && isSniper));

            const targetFov = isAiming ? (isSniper ? 22 : 46) : settingsRef.current.fov || 70;
            if (Math.abs(camera.fov - targetFov) > 0.2) {
              camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 14, rawDt);
              camera.updateProjectionMatrix();
            }

            const camYaw = focusActor.id === roomInfo.selfId ? yawRef.current : focusActor.yaw;
            const camPitch = focusActor.id === roomInfo.selfId ? pitchRef.current : -0.08;
            const focusRig = actorRigs.get(focusActor.id)?.rig;
            const fx = focusRig ? focusRig.root.position.x : focusActor.x;
            const fy = focusRig ? focusRig.root.position.y : focusActor.y;
            const fz = focusRig ? focusRig.root.position.z : focusActor.z;

            if (useFirstPerson) {
              const eyeOffset = focusActor.prone ? 0.36 : focusActor.crouching ? 1.15 : 1.62;
              _camDesired.set(fx, fy + eyeOffset, fz);
              camera.position.lerp(_camDesired, 1 - Math.exp(-26 * rawDt));
              const lookDist = 35;
              const cosP = Math.cos(camPitch + recoilOffsetRef.current);
              _camTarget.set(
                fx - Math.sin(camYaw) * cosP * lookDist,
                fy + eyeOffset + Math.sin(camPitch + recoilOffsetRef.current) * lookDist,
                fz - Math.cos(camYaw) * cosP * lookDist,
              );
              camera.lookAt(_camTarget);
            } else {
              const dist = focusActor.vehicleId ? 7.2 : focusActor.parachuting ? 6.4 : isAiming ? 2.1 : 4.1;
              const shoulder = isAiming ? 0.52 : 0.72;
              const heightOffset = focusActor.prone ? 0.58 : focusActor.crouching ? 1.25 : 1.72;

              const backX = Math.sin(camYaw) * Math.cos(camPitch) * dist;
              const backZ = Math.cos(camYaw) * Math.cos(camPitch) * dist;
              const backY = -Math.sin(camPitch) * dist;
              const rightX = Math.cos(camYaw) * shoulder;
              const rightZ = -Math.sin(camYaw) * shoulder;

              _camDesired.set(fx + backX + rightX, fy + heightOffset + backY, fz + backZ + rightZ);
              const camGround = surfaceHeightAt(_camDesired.x, _camDesired.z, fy) + 0.45;
              if (_camDesired.y < camGround) _camDesired.y = camGround;

              camera.position.lerp(_camDesired, 1 - Math.exp(-18 * rawDt));

              const shakeX = (Math.random() - 0.5) * shakeRef.current;
              const shakeY = (Math.random() - 0.5) * shakeRef.current;
              camera.position.x += shakeX;
              camera.position.y += shakeY;

              const lookDist = 28;
              _camTarget.set(
                fx - Math.sin(camYaw) * lookDist + rightX * 0.6,
                fy + heightOffset + Math.sin(camPitch + recoilOffsetRef.current) * lookDist,
                fz - Math.cos(camYaw) * lookDist + rightZ * 0.6,
              );
              camera.lookAt(_camTarget);
            }
          }
        }
      }

      // 8. Spawn Muzzle Flash, Bullet Tracers, Impact Sparks & Explosion Bursts
      if (pendingFlashesRef.current.length > 0) {
        const fl = pendingFlashesRef.current.pop()!;
        muzzleFlashMesh.position.set(fl.x, fl.y - 0.08, fl.z);
        muzzleFlashMesh.visible = true;
        muzzleLight.position.set(fl.x, fl.y, fl.z);
        muzzleLight.intensity = 4.5;
        muzzleFlashTimer = 0.045;
      }
      if (muzzleFlashTimer > 0) {
        muzzleFlashTimer -= rawDt;
        if (muzzleFlashTimer <= 0) {
          muzzleFlashMesh.visible = false;
          muzzleLight.intensity = 0;
        }
      }

      while (pendingImpactsRef.current.length > 0) {
        const imp = pendingImpactsRef.current.pop()!;
        for (let s = 0; s < 4; s++) {
          const m = new THREE.Mesh(impactGeo, impactMat);
          m.position.set(imp.x, imp.y, imp.z);
          scene.add(m);
          activeParticles.push({
            mesh: m,
            vx: (Math.random() - 0.5) * 6,
            vy: 1.5 + Math.random() * 4,
            vz: (Math.random() - 0.5) * 6,
            life: 0.24,
          });
        }
      }

      while (pendingTracersRef.current.length > 0) {
        const t = pendingTracersRef.current.pop()!;
        const pts = [_tracerStart.set(t.ox, t.oy, t.oz).clone(), _tracerEnd.set(t.tx, t.ty, t.tz).clone()];
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const line = new THREE.Line(geo, tracerMat);
        scene.add(line);
        activeTracers.push({ line, life: t.life });
      }
      for (let i = activeTracers.length - 1; i >= 0; i--) {
        activeTracers[i].life -= rawDt;
        if (activeTracers[i].life <= 0) {
          scene.remove(activeTracers[i].line);
          activeTracers[i].line.geometry.dispose();
          activeTracers.splice(i, 1);
        }
      }

      while (pendingExplosionsRef.current.length > 0) {
        const ex = pendingExplosionsRef.current.pop()!;
        for (let p = 0; p < 18; p++) {
          const m = new THREE.Mesh(particleGeo, particleMat);
          m.position.set(ex.x, ex.y + 0.3, ex.z);
          scene.add(m);
          activeParticles.push({
            mesh: m,
            vx: (Math.random() - 0.5) * 16,
            vy: 4 + Math.random() * 11,
            vz: (Math.random() - 0.5) * 16,
            life: 0.65,
          });
        }
      }
      for (let i = activeParticles.length - 1; i >= 0; i--) {
        const pt = activeParticles[i];
        pt.life -= rawDt;
        pt.mesh.position.x += pt.vx * rawDt;
        pt.mesh.position.y += pt.vy * rawDt;
        pt.mesh.position.z += pt.vz * rawDt;
        pt.vy -= 18 * rawDt;
        pt.mesh.scale.setScalar(Math.max(0.1, pt.life * 1.8));
        if (pt.life <= 0) {
          scene.remove(pt.mesh);
          activeParticles.splice(i, 1);
        }
      }

      renderer.render(scene, camera);
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      clearInterval(inputTimer);
      clearInterval(hudTimer);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      window.removeEventListener('resize', onResize);
      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock();
      }
      world.dispose();
      tracerMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      impactGeo.dispose();
      impactMat.dispose();
      muzzleFlashGeo.dispose();
      muzzleFlashMat.dispose();
      grenadeGeo.dispose();
      grenadeMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [roomInfo.selfId, roomInfo.mode, profile.selectedWeapon, ws, isTouchDevice]);

  const self = hudState.self;
  const equippedWeapon = WEAPONS[self?.weaponId || 'ak47_ember'] || WEAPONS.ak47_ember;
  const charSpec = CHARACTERS[self?.character || profile.selectedCharacter] || CHARACTERS.valkyrie;

  const handleLeave = () => {
    if (document.pointerLockElement) document.exitPointerLock();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'match:leave' }));
    }
    onExitMatch({
      mode: roomInfo.mode,
      placement: matchEnd?.won ? 1 : Math.max(1, hudState.aliveCount),
      totalPlayers: hudState.totalCount,
      kills: self?.kills || 0,
      damage: self?.damageDealt || 0,
      won: Boolean(matchEnd?.won),
    });
  };

  const handleSendMatchChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim() || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'chat:send', channel: 'match', text: chatText.trim() }));
    setChatText('');
  };

  const handleReportSpectated = async () => {
    if (!hudState.spectatingId || !hudState.spectatingName) return;
    await submitPlayerReport(
      profile.uid,
      hudState.spectatingId,
      hudState.spectatingName,
      'aimbot',
      'Reported from Spectator Camera during live match.',
    );
    setReportMsg(`Reported ${hudState.spectatingName} to Anti-Cheat HQ.`);
    setTimeout(() => setReportMsg(null), 2600);
  };

  const showSniperScope = Boolean(
    self?.alive &&
      !self.inPlane &&
      !self.parachuting &&
      hudState.isAiming &&
      self.weaponId === 'awm_frost',
  );

  return (
    <div className="fixed inset-0 bg-[#07090F] overflow-hidden">
      {/* Isolated WebGL Mount */}
      <div ref={mountRef} className="fixed inset-0 w-full h-full" />

      {/* Optical Sniper Scope Overlay when ADS with AWM */}
      {showSniperScope && (
        <div
          className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center"
          style={{
            background:
              'radial-gradient(circle at center, transparent 28%, rgba(5, 8, 12, 0.96) 36%)',
          }}
        >
          <div className="relative w-[56vmin] h-[56vmin] rounded-full border-2 border-slate-700/90 flex items-center justify-center">
            <div className="absolute inset-x-0 top-1/2 h-px bg-black/80" />
            <div className="absolute inset-y-0 left-1/2 w-px bg-black/80" />
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="absolute bottom-6 text-[10px] font-mono text-emerald-400">
              8x MIL-DOT · ZEROED 200M
            </span>
          </div>
        </div>
      )}

      {/* Low-Occlusion Tactical HUD Overlay (no backdrop-filter over WebGL!) */}
      <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-3 sm:p-4">
        {/* TOP BAR */}
        <div className="flex items-start justify-between gap-3">
          {/* Top-Left: Minimap Radar + Safe Zone Timer */}
          <div className="flex items-start gap-2.5">
            <div className="bg-[#0A101D]/90 border border-slate-700/80 rounded-xl p-1.5 shadow-lg">
              <canvas ref={radarCanvasRef} width={118} height={118} className="rounded-lg block" />
              <div className="mt-1 flex items-center justify-between text-[10px] font-bold px-1 tabular-nums">
                <span className="text-cyan-400">ZONE {hudState.zonePhase}</span>
                <span className={hudState.inStorm ? 'text-red-400' : 'text-slate-200'}>
                  {hudState.zoneSecs}s
                </span>
              </div>
            </div>

            {/* Kill Feed */}
            <div className="hidden sm:flex flex-col gap-1 max-w-[230px]">
              {hudState.killFeed.slice(0, 4).map((kf) => (
                <div
                  key={kf.id}
                  className="bg-[#0A101D]/85 border-l-2 border-orange-500 px-2.5 py-1 rounded-r text-[11px] text-slate-200 truncate"
                >
                  <span className="font-bold text-orange-400">{kf.killer}</span>
                  <span className="text-slate-400 mx-1">[{kf.weapon}]</span>
                  <span className="font-semibold text-white">{kf.victim}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top-Center: Mode / Clash Score / Storm Warning */}
          <div className="flex flex-col items-center gap-1.5">
            {roomInfo.mode === 'clash_squad' ? (
              <div className="bg-[#0A101D]/92 border border-slate-700 px-4 py-1.5 rounded-lg flex items-center gap-4 text-sm font-black tabular-nums">
                <span className="text-cyan-400">ALPHA {hudState.clash.scoreA}</span>
                <span className="text-xs text-slate-400">RD {hudState.clash.round}</span>
                <span className="text-red-400">{hudState.clash.scoreB} BRAVO</span>
              </div>
            ) : (
              <div className="bg-[#0A101D]/88 border border-slate-700/80 px-3.5 py-1 rounded-lg text-[11px] font-bold tracking-wider uppercase text-slate-300">
                Room {roomInfo.roomCode} · {roomInfo.mode.replace('_', ' ')}
              </div>
            )}

            {hudState.inStorm && (
              <div className="bg-red-600/90 text-white px-3 py-1 rounded text-xs font-black tracking-wider uppercase">
                OUTSIDE SAFE ZONE — TAKING STORM DAMAGE
              </div>
            )}
            {hudState.lootBanner && (
              <div className="bg-emerald-600/90 text-white px-3 py-1 rounded text-xs font-bold">
                {hudState.lootBanner}
              </div>
            )}
          </div>

          {/* Top-Right: Alive, Kills, Audio, Chat, Pause */}
          <div className="flex items-center gap-2">
            <div className="bg-[#0A101D]/92 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-3 text-xs font-black tabular-nums">
              <div>
                <span className="text-slate-400 mr-1">ALIVE</span>
                <span className="text-white text-sm">{hudState.aliveCount}</span>
              </div>
              <div className="w-px h-4 bg-slate-700" />
              <div>
                <span className="text-orange-400 mr-1">KILLS</span>
                <span className="text-white text-sm">{self?.kills || 0}</span>
              </div>
            </div>

            <div className="pointer-events-auto flex items-center gap-1.5">
              <button
                onClick={() => {
                  firstPersonRef.current = !firstPersonRef.current;
                  setFirstPerson(firstPersonRef.current);
                }}
                title="Toggle 1P / 3P Perspective [V]"
                className={`px-2.5 py-2 rounded-lg border text-[11px] font-black cursor-pointer flex items-center gap-1 ${
                  firstPerson
                    ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                    : 'bg-[#0A101D]/90 border-slate-700 text-slate-200 hover:border-slate-500'
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> {firstPerson ? '1P' : '3P'}
              </button>
              <button
                onClick={() => {
                  const next = !micActive;
                  setMicActive(next);
                  if (ws?.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'voice:signal', speaking: next }));
                  }
                }}
                title="Squad Voice Chat"
                className={`p-2 rounded-lg border cursor-pointer ${
                  micActive
                    ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                    : 'bg-[#0A101D]/90 border-slate-700 text-slate-200 hover:border-slate-500'
                }`}
              >
                {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setChatOpen((o) => !o)}
                title="Match Chat"
                className="p-2 rounded-lg bg-[#0A101D]/90 border border-slate-700 text-slate-200 hover:border-slate-500 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  const next = !muted;
                  setMuted(next);
                  soundEngine.setVolumes(settings.sfxVolume, settings.musicVolume, next);
                }}
                title="Toggle Audio"
                className="p-2 rounded-lg bg-[#0A101D]/90 border border-slate-700 text-slate-200 hover:border-slate-500 cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setPaused(true)}
                title="Pause"
                className="p-2 rounded-lg bg-[#0A101D]/90 border border-slate-700 text-slate-200 hover:border-orange-500 cursor-pointer"
              >
                <Pause className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* CENTER RETICLE & CONTEXT PROMPTS */}
        <div className="flex flex-col items-center justify-center relative">
          {self?.alive && !self.inPlane && !self.parachuting && (
            <div className="relative flex items-center justify-center">
              <Crosshair
                className={`w-7 h-7 transition-transform duration-75 ${
                  hudState.hitFlash === 'head'
                    ? 'text-red-500 scale-125'
                    : hudState.hitFlash === 'body'
                      ? 'text-orange-400 scale-110'
                      : 'text-white/85'
                }`}
              />
            </div>
          )}

          {!isTouchDevice && !pointerLocked && !paused && !matchEnd && self?.alive && (
            <div className="mt-4 px-3 py-1.5 rounded-lg bg-[#0A101D]/90 border border-orange-500/60 text-xs font-bold text-orange-300">
              Click anywhere on battlefield to lock Mouse Aim · Press Esc to unlock
            </div>
          )}

          {self?.inPlane && (
            <div className="pointer-events-auto mt-6 flex flex-col items-center gap-2">
              <div className="px-4 py-2 rounded-xl bg-[#0A101D]/95 border border-orange-500 text-sm font-black tracking-wider uppercase text-orange-400">
                Cargo Gunship En Route — Drop Over Ember Island
              </div>
              <button
                onClick={() => ws?.send(JSON.stringify({ type: 'match:input', jumpOut: true }))}
                className="px-6 py-2.5 bg-orange-500 hover:bg-orange-400 text-slate-950 font-black uppercase rounded-lg shadow-lg cursor-pointer"
              >
                Eject Now [SPACE / F]
              </button>
            </div>
          )}

          {self?.parachuting && (
            <div className="mt-4 px-3 py-1 rounded bg-[#0A101D]/85 border border-cyan-400/60 text-xs font-bold text-cyan-300">
              PARACHUTE DEPLOYED · STEER WITH WASD
            </div>
          )}

          {hudState.nearbyLoot && (
            <button
              onClick={() => sendAction('pickup')}
              className="pointer-events-auto mt-5 px-4 py-1.5 rounded-lg bg-[#0A101D]/95 border border-emerald-400 text-xs font-bold text-emerald-300 cursor-pointer"
            >
              [F] Pick up {hudState.nearbyLoot}
            </button>
          )}

          {hudState.nearbyVehicle && !self?.vehicleId && (
            <button
              onClick={() => sendAction('vehicle')}
              className="pointer-events-auto mt-2 px-4 py-1.5 rounded-lg bg-[#0A101D]/95 border border-amber-400 text-xs font-bold text-amber-300 flex items-center gap-1.5 cursor-pointer"
            >
              <Car className="w-3.5 h-3.5" /> [F] Drive Armored Buggy
            </button>
          )}

          {self?.vehicleId && (
            <button
              onClick={() => sendAction('vehicle')}
              className="pointer-events-auto mt-4 px-4 py-1.5 rounded-lg bg-[#0A101D]/95 border border-amber-400 text-xs font-bold text-amber-300 cursor-pointer"
            >
              [F] Exit Vehicle
            </button>
          )}
        </div>

        {/* BOTTOM BAR: HP, Armor, Weapon, Equipment OR Spectator Controls */}
        <div className="flex items-end justify-between gap-4">
          {/* Bottom-Left: Match Chat Drawer if open */}
          <div className="w-64">
            {chatOpen && (
              <div className="pointer-events-auto bg-[#0A101D]/95 border border-slate-700 rounded-xl p-2.5 shadow-xl">
                <div className="h-28 overflow-y-auto space-y-1 text-xs mb-2">
                  {chatMessages.length === 0 && (
                    <div className="text-slate-500">No squad messages yet...</div>
                  )}
                  {chatMessages.map((m) => (
                    <div key={m.id}>
                      <span className="font-bold text-cyan-400">{m.senderName}: </span>
                      <span className="text-slate-200">{m.text}</span>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleSendMatchChat} className="flex gap-1.5">
                  <input
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    placeholder="Team chat..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1 bg-orange-500 text-slate-950 font-bold text-xs rounded cursor-pointer"
                  >
                    Send
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Bottom-Center: Player Status & 3-Slot Loadout */}
          {self && self.alive ? (
            <div className="bg-[#0A101D]/92 border border-slate-700/90 rounded-2xl px-4 py-2.5 flex flex-wrap items-center gap-3 sm:gap-4 shadow-xl">
              {/* HP & Shield */}
              <div className="w-36 sm:w-48">
                <div className="flex items-center justify-between text-[11px] font-bold mb-1 tabular-nums">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Heart className="w-3.5 h-3.5 fill-current" /> {self.hp} HP
                  </span>
                  <span className="flex items-center gap-1 text-cyan-400">
                    <Shield className="w-3.5 h-3.5" /> {self.shield} · V{self.armorLevel}/H{self.helmetLevel}
                  </span>
                </div>
                <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden mb-1">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-100"
                    style={{ width: `${Math.max(0, Math.min(100, self.hp))}%` }}
                  />
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-100"
                    style={{ width: `${Math.max(0, Math.min(100, (self.shield / 60) * 100))}%` }}
                  />
                </div>
              </div>

              <div className="w-px h-10 bg-slate-700 hidden sm:block" />

              {/* 3-Slot Weapon Strip */}
              <div className="pointer-events-auto hidden md:flex items-center gap-1.5 tabular-nums">
                {[0, 1, 2].map((slotIdx) => {
                  const slot = self.slots?.[slotIdx];
                  const wSpec = slot ? WEAPONS[slot.weaponId] : null;
                  const active = self.activeSlot === slotIdx;
                  return (
                    <button
                      key={slotIdx}
                      disabled={!slot}
                      onClick={() => sendAction('switch_slot', { slot: slotIdx })}
                      className={`px-2.5 py-1.5 rounded-lg border text-left transition cursor-pointer disabled:opacity-35 ${
                        active
                          ? 'bg-orange-500/20 border-orange-500 text-white'
                          : 'bg-slate-900/90 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="text-[9px] font-black uppercase text-orange-400">
                        [{slotIdx + 1}] {slotIdx === 2 ? 'Sidearm' : slotIdx === 0 ? 'Primary' : 'Secondary'}
                      </div>
                      <div className="text-[11px] font-bold truncate max-w-[92px]">
                        {wSpec ? wSpec.name.split(' ')[0] : 'Empty'}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Equipped Weapon Ammo & Stance */}
              <div className="text-right tabular-nums">
                <div className="text-[11px] font-bold uppercase text-orange-400 flex items-center justify-end gap-1.5">
                  {(self.swimming || self.prone || self.crouching || self.climbing || self.jumping) && (
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[9px] text-cyan-300">
                      {self.swimming
                        ? 'SWIM'
                        : self.climbing
                          ? 'CLIMB'
                          : self.jumping
                            ? 'JUMP'
                            : self.prone
                              ? 'PRONE'
                              : 'CROUCH'}
                    </span>
                  )}
                  <span>{equippedWeapon.name}</span>
                </div>
                <div className="text-lg font-black text-white leading-tight">
                  {self.reloading ? (
                    <span className="text-amber-400 text-xs uppercase">Reloading...</span>
                  ) : (
                    <>
                      {self.ammo} <span className="text-xs text-slate-400">/ {self.reserveAmmo}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Quick Slots + Backpack */}
              <div className="pointer-events-auto hidden sm:flex items-center gap-1.5 text-[11px] font-bold">
                <button
                  onClick={() => {
                    setInventoryOpen((o) => !o);
                    if (document.pointerLockElement) document.exitPointerLock();
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-cyan-300 flex items-center gap-1 cursor-pointer"
                >
                  <Backpack className="w-3.5 h-3.5" /> [Tab] Bag
                </button>
                <button
                  onClick={() => {
                    soundEngine.playHeal();
                    sendAction('medkit');
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white cursor-pointer"
                >
                  [H] Med ({self.medkits})
                </button>
                <button
                  onClick={() => sendAction('grenade')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white cursor-pointer"
                >
                  [G] Frag ({self.grenades})
                </button>
                <button
                  onClick={() => sendAction('ability')}
                  className="px-2.5 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/35 border border-orange-500 text-orange-300 flex items-center gap-1 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  [E] {self.abilityCooldownSec > 0 ? `${self.abilityCooldownSec}s` : charSpec.abilityName}
                </button>
              </div>
            </div>
          ) : self && !self.alive && !matchEnd ? (
            /* Spectator Mode Bar */
            <div className="pointer-events-auto bg-[#0A101D]/95 border border-red-500/60 rounded-2xl px-5 py-3 flex flex-wrap items-center gap-4 shadow-2xl">
              <div>
                <div className="text-[11px] uppercase font-bold text-red-400">Eliminated · Spectating</div>
                <div className="text-sm font-black text-white">{hudState.spectatingName || 'Surviving Combatant'}</div>
                {reportMsg && <div className="text-[11px] text-emerald-400 mt-0.5">{reportMsg}</div>}
              </div>
              <button
                onClick={() => {
                  spectateIndexRef.current += 1;
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                Next Player <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleReportSpectated}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/35 border border-red-500/60 text-xs font-bold text-red-300 flex items-center gap-1 cursor-pointer"
              >
                <Flag className="w-3.5 h-3.5" /> Report
              </button>
              <button
                onClick={handleLeave}
                className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-black uppercase cursor-pointer"
              >
                Return to Lobby
              </button>
            </div>
          ) : (
            <div />
          )}

          <div className="w-16 sm:w-36" />
        </div>
      </div>

      {/* Tactical Backpack / Loot Inventory Modal */}
      {inventoryOpen && self?.alive && !paused && !matchEnd && (
        <div className="fixed inset-0 z-30 bg-black/75 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-[#0C121E] border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 font-black uppercase text-sm text-white">
                <Backpack className="w-4 h-4 text-orange-400" /> Tactical Backpack & Loadout
              </div>
              <button
                onClick={() => setInventoryOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-black uppercase text-slate-400">Weapon Slots</div>
              {[0, 1, 2].map((idx) => {
                const slot = self.slots?.[idx];
                const w = slot ? WEAPONS[slot.weaponId] : null;
                const active = self.activeSlot === idx;
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border flex items-center justify-between ${
                      active ? 'bg-orange-500/15 border-orange-500' : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="text-[10px] font-bold uppercase text-cyan-400">
                        Slot {idx + 1} · {idx === 2 ? 'Sidearm' : idx === 0 ? 'Primary' : 'Secondary'}
                      </div>
                      <div className="font-black text-white text-sm">{w ? w.name : 'Empty Slot'}</div>
                      {slot && w && (
                        <div className="text-slate-400 tabular-nums">
                          {w.ammoType} · {slot.ammo} / {slot.reserveAmmo}
                        </div>
                      )}
                    </div>
                    {slot && (
                      <div className="flex items-center gap-2">
                        {!active && (
                          <button
                            onClick={() => {
                              sendAction('switch_slot', { slot: idx });
                              setInventoryOpen(false);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-orange-500 text-slate-950 font-black uppercase cursor-pointer"
                          >
                            Equip
                          </button>
                        )}
                        {idx < 2 && (
                          <button
                            onClick={() => sendAction('drop_weapon', { slot: idx })}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-red-600/40 text-red-300 font-bold cursor-pointer"
                          >
                            Drop
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-slate-400 font-bold uppercase text-[10px]">Armor & Helmet</div>
                <div className="text-white font-black mt-1">Vest Lv.{self.armorLevel} · Helmet Lv.{self.helmetLevel}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-slate-400 font-bold uppercase text-[10px]">Attachments Active</div>
                <div className="text-cyan-300 font-bold mt-1 truncate">
                  {settings.equippedAttachments?.length
                    ? settings.equippedAttachments
                        .map((id) => ATTACHMENTS.find((a) => a.id === id)?.name || id)
                        .join(', ')
                    : 'Standard Iron Sights'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={self.medkits <= 0 || self.hp >= self.maxHp}
                onClick={() => {
                  soundEngine.playHeal();
                  sendAction('medkit');
                  setInventoryOpen(false);
                }}
                className="py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 disabled:opacity-40 border border-emerald-500/60 text-emerald-300 font-black uppercase cursor-pointer"
              >
                Use Medkit ({self.medkits})
              </button>
              <button
                disabled={self.grenades <= 0}
                onClick={() => {
                  sendAction('grenade');
                  setInventoryOpen(false);
                }}
                className="py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 disabled:opacity-40 border border-amber-500/60 text-amber-300 font-black uppercase cursor-pointer"
              >
                Throw Frag ({self.grenades})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Touch Controls Overlay (Joystick, Right-Side Touch Camera Drag, Full Action Buttons) */}
      {isTouchDevice && self?.alive && !paused && !inventoryOpen && !matchEnd && (
        <div className="pointer-events-none fixed inset-0 z-20">
          {/* Right-half Touch Camera Look Area */}
          <div
            className="pointer-events-auto fixed top-16 right-0 bottom-0 left-1/3 touch-none"
            onTouchStart={(e) => {
              const t = e.touches[0];
              touchLookRef.current = { active: true, lastX: t.clientX, lastY: t.clientY };
            }}
            onTouchMove={(e) => {
              const t = e.touches[0];
              if (touchLookRef.current.active) {
                const dx = t.clientX - touchLookRef.current.lastX;
                const dy = t.clientY - touchLookRef.current.lastY;
                yawRef.current -= dx * 0.0065 * settingsRef.current.mouseSensitivity;
                pitchRef.current = THREE.MathUtils.clamp(
                  pitchRef.current - dy * 0.005 * settingsRef.current.mouseSensitivity,
                  -0.82,
                  0.76,
                );
                touchLookRef.current.lastX = t.clientX;
                touchLookRef.current.lastY = t.clientY;
              }
            }}
            onTouchEnd={() => {
              touchLookRef.current.active = false;
            }}
          />

          <div className="fixed inset-0 flex items-end justify-between p-4 pb-16 pointer-events-none">
            {/* Left Virtual Stick + Bag / View / Context */}
            <div className="pointer-events-auto flex flex-col items-start gap-2.5">
              <div className="flex gap-1.5">
                <button
                  onTouchStart={() => setInventoryOpen(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900/85 border border-slate-600 text-[10px] font-black text-cyan-300"
                >
                  BAG
                </button>
                <button
                  onTouchStart={() => {
                    const nextSlot = ((self.activeSlot ?? 0) + 1) % 3;
                    if (self.slots?.[nextSlot]) {
                      sendAction('switch_slot', { slot: nextSlot });
                    } else {
                      const avail = self.slots?.findIndex((s, i) => s !== null && i !== self.activeSlot);
                      if (avail !== undefined && avail >= 0) sendAction('switch_slot', { slot: avail });
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900/85 border border-orange-500/70 text-[10px] font-black text-orange-300"
                >
                  WPN
                </button>
                {(hudState.nearbyLoot || hudState.nearbyVehicle || self.inPlane || self.vehicleId) && (
                  <button
                    onTouchStart={() => {
                      if (self.inPlane) {
                        ws?.send(JSON.stringify({ type: 'match:input', jumpOut: true }));
                      } else if (self.vehicleId || hudState.nearbyVehicle) {
                        sendAction('vehicle');
                      } else {
                        sendAction('pickup');
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-[10px] font-black uppercase"
                  >
                    {self.inPlane ? 'EJECT' : self.vehicleId ? 'EXIT' : hudState.nearbyVehicle ? 'DRIVE' : 'LOOT'}
                  </button>
                )}
              </div>

              <div
                className="w-28 h-28 rounded-full bg-slate-900/55 border-2 border-slate-500/60 flex items-center justify-center touch-none relative"
                onTouchMove={(e) => {
                  const t = e.touches[0];
                  const rect = e.currentTarget.getBoundingClientRect();
                  const dx = (t.clientX - (rect.left + rect.width / 2)) / 42;
                  const dy = (t.clientY - (rect.top + rect.height / 2)) / 42;
                  const clampedX = THREE.MathUtils.clamp(dx, -1, 1);
                  const clampedY = THREE.MathUtils.clamp(dy, -1, 1);
                  touchMoveRef.current = { x: clampedX, z: -clampedY };
                  setStickKnob({ x: clampedX * 26, y: clampedY * 26 });
                }}
                onTouchEnd={() => {
                  touchMoveRef.current = { x: 0, z: 0 };
                  setStickKnob({ x: 0, y: 0 });
                }}
              >
                <div
                  className="w-11 h-11 rounded-full bg-orange-500/85 border border-white/70"
                  style={{ transform: `translate(${stickKnob.x}px, ${stickKnob.y}px)` }}
                />
              </div>
            </div>

            {/* Right Combat + Stance + Fire Cluster */}
            <div className="pointer-events-auto flex items-end gap-2.5">
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onTouchStart={() => (touchJumpRef.current = true)}
                  className="w-11 h-11 rounded-full bg-slate-900/85 border border-slate-500 text-[10px] font-black text-white"
                >
                  JMP
                </button>
                <button
                  onTouchStart={() => {
                    stanceToggleRef.current.crouch = !stanceToggleRef.current.crouch;
                    if (stanceToggleRef.current.crouch) stanceToggleRef.current.prone = false;
                  }}
                  className={`w-11 h-11 rounded-full border text-[10px] font-black ${
                    hudState.crouchActive
                      ? 'bg-cyan-500 border-cyan-300 text-slate-950'
                      : 'bg-slate-900/85 border-slate-600 text-white'
                  }`}
                >
                  CRH
                </button>
                <button
                  onTouchStart={() => {
                    stanceToggleRef.current.prone = !stanceToggleRef.current.prone;
                    if (stanceToggleRef.current.prone) stanceToggleRef.current.crouch = false;
                  }}
                  className={`w-11 h-11 rounded-full border text-[10px] font-black ${
                    hudState.proneActive
                      ? 'bg-cyan-500 border-cyan-300 text-slate-950'
                      : 'bg-slate-900/85 border-slate-600 text-white'
                  }`}
                >
                  PRN
                </button>
                <button
                  onTouchStart={() => (touchAimDownRef.current = !touchAimDownRef.current)}
                  className={`w-11 h-11 rounded-full border text-[10px] font-black ${
                    hudState.isAiming
                      ? 'bg-cyan-500 border-cyan-300 text-slate-950'
                      : 'bg-slate-900/85 border-cyan-400 text-cyan-300'
                  }`}
                >
                  ADS
                </button>
                <button
                  onTouchStart={() => {
                    soundEngine.playReload();
                    sendAction('reload');
                  }}
                  className="w-11 h-11 rounded-full bg-slate-900/85 border border-slate-600 text-[10px] font-bold text-white"
                >
                  RLD
                </button>
                <button
                  onTouchStart={() => sendAction('grenade')}
                  className="w-11 h-11 rounded-full bg-slate-900/85 border border-amber-500 text-[10px] font-bold text-amber-300"
                >
                  FRAG
                </button>
                <button
                  onTouchStart={() => sendAction('ability')}
                  className="w-11 h-11 rounded-full bg-slate-900/85 border border-orange-500 text-[10px] font-bold text-orange-300"
                >
                  SKILL
                </button>
                <button
                  onTouchStart={() => {
                    soundEngine.playHeal();
                    sendAction('medkit');
                  }}
                  className="w-11 h-11 rounded-full bg-slate-900/85 border border-emerald-500 text-[10px] font-bold text-emerald-300"
                >
                  HEAL
                </button>
              </div>

              <div
                className="w-24 h-24 rounded-full bg-red-600/80 border-2 border-orange-400 flex items-center justify-center text-sm font-black text-white touch-none"
                onTouchStart={(e) => {
                  e.stopPropagation();
                  soundEngine.unlock();
                  touchFireRef.current = true;
                  tapFireQueuedRef.current = true;
                  const t = e.touches[0];
                  touchAimRef.current = { active: true, lastX: t.clientX, lastY: t.clientY };
                }}
                onTouchMove={(e) => {
                  e.stopPropagation();
                  const t = e.touches[0];
                  if (touchAimRef.current.active) {
                    const dx = t.clientX - touchAimRef.current.lastX;
                    const dy = t.clientY - touchAimRef.current.lastY;
                    yawRef.current -= dx * 0.006 * settingsRef.current.mouseSensitivity;
                    pitchRef.current = THREE.MathUtils.clamp(
                      pitchRef.current - dy * 0.005 * settingsRef.current.mouseSensitivity,
                      -0.8,
                      0.75,
                    );
                    touchAimRef.current.lastX = t.clientX;
                    touchAimRef.current.lastY = t.clientY;
                  }
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  touchFireRef.current = false;
                  touchAimRef.current.active = false;
                }}
              >
                FIRE
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {paused && !matchEnd && (
        <div className="fixed inset-0 z-30 bg-black/75 flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-[#0E1422] border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-xl font-black uppercase tracking-wider text-white">Match Paused</h3>
            <p className="text-xs text-slate-400">
              Controls: WASD Move · Shift Sprint · Space Jump · C Crouch · Z Prone · 1/2/3 Weapons · Tab Bag · V 1P/3P · Right-Click ADS/Scope · F Loot/Vehicle · R Reload · H Medkit · G Frag · E Ability
            </p>
            <button
              onClick={() => setPaused(false)}
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-400 text-slate-950 font-black uppercase rounded-lg cursor-pointer"
            >
              Resume Combat
            </button>
            <button
              onClick={handleLeave}
              className="w-full py-2.5 bg-slate-800 hover:bg-red-600/80 text-white font-bold uppercase rounded-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> Leave Match
            </button>
          </div>
        </div>
      )}

      {/* Victory / Match Summary Modal */}
      {matchEnd && (
        <div className="fixed inset-0 z-40 bg-black/82 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#0E1422] border border-orange-500/60 rounded-2xl p-7 shadow-2xl text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-500/20 border border-orange-500 text-orange-400 mb-3">
              <Award className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-black uppercase tracking-wider text-white mb-1">
              {matchEnd.won ? 'BOOYAH! VICTORY' : 'MATCH COMPLETE'}
            </h2>
            <p className="text-xs text-slate-400 mb-5">
              Champion: <span className="text-orange-400 font-bold">{matchEnd.winnerName}</span>
            </p>

            <div className="grid grid-cols-3 gap-3 mb-6 tabular-nums">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                <div className="text-[11px] text-slate-400 uppercase">Rank</div>
                <div className="text-xl font-black text-cyan-400">
                  #{matchEnd.won ? 1 : Math.max(2, hudState.aliveCount)}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                <div className="text-[11px] text-slate-400 uppercase">Elims</div>
                <div className="text-xl font-black text-orange-400">{self?.kills || 0}</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                <div className="text-[11px] text-slate-400 uppercase">Damage</div>
                <div className="text-xl font-black text-white">{self?.damageDealt || 0}</div>
              </div>
            </div>

            <button
              onClick={handleLeave}
              className="w-full py-3 bg-orange-500 hover:bg-orange-400 text-slate-950 font-black uppercase tracking-wider rounded-xl cursor-pointer"
            >
              Claim Rewards & Return to Lobby
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
