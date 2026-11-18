import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  animateCharacterRig,
  CharacterRig,
  createCharacterModel,
  createConcreteTexture,
  createVehicleModel,
  createWoodTexture,
} from '../game/models';

export interface LobbyStageProps {
  characterId: string;
  weaponId: string;
  weaponSkinId?: string;
  outfitId: string;
  hairId: string;
  accessoryId: string;
  activeEmote: string | null;
  cameraPreset?: 'hero' | 'armory' | 'title';
}

export const Lobby3DStage: React.FC<LobbyStageProps> = ({
  characterId,
  weaponId,
  weaponSkinId,
  outfitId,
  hairId,
  accessoryId,
  activeEmote,
  cameraPreset = 'hero',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef<LobbyStageProps>({
    characterId,
    weaponId,
    weaponSkinId,
    outfitId,
    hairId,
    accessoryId,
    activeEmote,
    cameraPreset,
  });
  propsRef.current = {
    characterId,
    weaponId,
    weaponSkinId,
    outfitId,
    hairId,
    accessoryId,
    activeEmote,
    cameraPreset,
  };

  const rebuildCharRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    rebuildCharRef.current?.();
  }, [characterId, weaponId, weaponSkinId, outfitId, hairId, accessoryId]);

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
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9ab4c9);
    scene.fog = new THREE.FogExp2(0x9eb5c7, 0.018);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.1, 160);
    camera.position.set(0.35, 1.75, 4.15);

    // Golden-Hour Sky Dome
    const skyGeo = new THREE.SphereGeometry(110, 28, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x2c567d) },
        horizonColor: { value: new THREE.Color(0xd1c4b2) },
        sunDir: { value: new THREE.Vector3(6, 5, -8).normalize() },
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
          sky += vec3(1.0, 0.85, 0.62) * pow(sunDot, 120.0) * 1.1;
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyMesh);

    // Realistic Outdoor 3-Point Daylight Rig
    const hemiLight = new THREE.HemisphereLight(0xcbe2f5, 0x454036, 0.82);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff0d6, 2.35);
    keyLight.position.set(5.5, 8.5, 5.5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -5;
    keyLight.shadow.camera.right = 5;
    keyLight.shadow.camera.top = 5;
    keyLight.shadow.camera.bottom = -5;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x9bc4e8, 0.9);
    rimLight.position.set(-5, 4, -6);
    scene.add(rimLight);

    // Military FOB Concrete Airfield Tarmac
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const concreteTex = createConcreteTexture('#585d63', maxAniso);
    concreteTex.repeat.set(18, 18);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(65, 48),
      new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.88, metalness: 0.06 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grass Field Apron Perimeter
    const fieldGrass = new THREE.Mesh(
      new THREE.RingGeometry(15, 72, 48),
      new THREE.MeshStandardMaterial({ color: 0x4a5b3b, roughness: 0.95 }),
    );
    fieldGrass.rotation.x = -Math.PI / 2;
    fieldGrass.position.y = 0.01;
    fieldGrass.receiveShadow = true;
    scene.add(fieldGrass);

    // Painted Helipad Circle Marking flush on tarmac
    const padMark = new THREE.Mesh(
      new THREE.RingGeometry(1.55, 1.72, 48),
      new THREE.MeshStandardMaterial({ color: 0xd99b26, roughness: 0.75 }),
    );
    padMark.rotation.x = -Math.PI / 2;
    padMark.position.y = 0.012;
    scene.add(padMark);

    // Military Sandbag Barricades & Supply Crates in FOB background
    const bagMat = new THREE.MeshStandardMaterial({ color: 0x8c7b5c, roughness: 0.92 });
    const bagGeo = new THREE.SphereGeometry(0.32, 10, 8);
    bagGeo.scale(1.4, 0.55, 0.85);
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 5; col++) {
        const bag = new THREE.Mesh(bagGeo, bagMat);
        bag.position.set(-2.9 + col * 0.68 + row * 0.2, 0.16 + row * 0.28, -2.8 - col * 0.22);
        bag.rotation.y = 0.35;
        bag.castShadow = true;
        bag.receiveShadow = true;
        scene.add(bag);
      }
    }

    const crateMat = new THREE.MeshStandardMaterial({
      map: createWoodTexture('#6b4f35', maxAniso),
      roughness: 0.82,
    });
    const crate1 = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.75, 0.85), crateMat);
    crate1.position.set(2.35, 0.375, -2.1);
    crate1.rotation.y = -0.35;
    crate1.castShadow = true;
    crate1.receiveShadow = true;
    const crate2 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.52, 0.65), crateMat);
    crate2.position.set(2.35, 1.01, -2.1);
    crate2.rotation.y = 0.25;
    crate2.castShadow = true;
    scene.add(crate1, crate2);

    // Parked Tactical 4x4 Recon Truck on Airfield Apron
    const parkedTruck = createVehicleModel(0x4b5544);
    parkedTruck.group.position.set(-5.6, 0, -8.5);
    parkedTruck.group.rotation.y = 0.82;
    scene.add(parkedTruck.group);

    // Distant Rolling Hills Silhouette
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x4a5948, roughness: 0.96 });
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const dist = 48 + (i % 3) * 8;
      const hill = new THREE.Mesh(new THREE.SphereGeometry(14 + (i % 4) * 3, 14, 10), hillMat);
      hill.scale.set(1.8, 0.45 + (i % 3) * 0.12, 1.4);
      hill.position.set(Math.cos(angle) * dist, -1.5, Math.sin(angle) * dist);
      scene.add(hill);
    }

    // Character Rig holder grounded cleanly at y = 0
    const actorSlot = new THREE.Group();
    actorSlot.position.y = 0.01;
    scene.add(actorSlot);

    let rig: CharacterRig | null = null;
    const buildChar = () => {
      if (rig) {
        actorSlot.remove(rig.root);
      }
      const p = propsRef.current;
      rig = createCharacterModel({
        characterId: p.characterId,
        weaponId: p.weaponId,
        skinId: p.weaponSkinId,
        outfitId: p.outfitId,
        hairId: p.hairId,
        accessoryId: p.accessoryId,
      });
      actorSlot.add(rig.root);
    };
    buildChar();
    rebuildCharRef.current = buildChar;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let dragging = false;
    let lastX = 0;
    let targetYaw = 0.22;
    let currentYaw = 0.22;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      targetYaw += dx * 0.01;
    };
    const onPointerUp = () => {
      dragging = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

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
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();
      const p = propsRef.current;

      if (p.cameraPreset === 'title') {
        targetYaw += dt * 0.18;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, -0.8, 4, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, 1.75, 4, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, 4.4, 4, dt);
      } else if (p.cameraPreset === 'armory') {
        camera.position.x = THREE.MathUtils.damp(camera.position.x, 0.85, 5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, 1.55, 5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, 2.95, 5, dt);
      } else {
        camera.position.x = THREE.MathUtils.damp(camera.position.x, 0.25, 5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, 1.65, 5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, 3.85, 5, dt);
      }
      camera.lookAt(0, 1.15, 0);

      currentYaw = THREE.MathUtils.damp(currentYaw, targetYaw, 8, dt);
      actorSlot.rotation.y = currentYaw;

      if (rig) {
        animateCharacterRig(rig, {
          time: elapsed,
          speed: 0,
          emote: p.activeEmote || undefined,
        });
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
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', onResize);
      skyGeo.dispose();
      skyMat.dispose();
      concreteTex.dispose();
      renderer.dispose();
      if (dom.parentNode === container) {
        container.removeChild(dom);
      }
    };
  }, []);

  return <div ref={mountRef} className="fixed inset-0 w-full h-full cursor-grab active:cursor-grabbing" />;
};
