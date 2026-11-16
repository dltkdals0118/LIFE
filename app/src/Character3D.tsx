/** 캐릭터 3D — 책상에서 타자 치는 장면.
 *
 *  **디자인 정본은 여전히 `Character.tsx` 의 주석이다.** 의상 다섯(스카프 ·
 *  허리에 묶은 옷 · 손가락 없는 장갑 · 걷어올린 바지 · 끈 부츠)은 그대로다.
 *  모델은 `app/assets3d/life_boy.blend` 가 정본이고 `public/desk-scene.glb` 는
 *  그 내보내기다(사무실은 포트폴리오 쪽 `assets3d/office.py` 가 짓는다).
 *  만든 과정은 `app/assets3d/README.md`.
 *
 *  **포즈는 뼈대가 아니라 모프로 낸다.** glb 에 여덟이 실려 있다:
 *    type_l · type_r   양손이 번갈아 내려간다
 *    blink · breathe   눈 · 가슴
 *    head_up · head_tilt · lean_in · lean_back   의사 본(정점 회전)
 *  고정 클립을 쓰지 않는 이유 — 타자도 깜빡임도 **간격이 일정하면 기계로 보인다.**
 *
 *  **입체감은 조명보다 그림자와 시차에서 온다.** 바닥 그림자로 바닥에 붙이고,
 *  포인터를 따라 카메라를 조금 돌린다. 둘 다 없으면 잘 그린 그림으로 보인다.
 *
 *  **three 는 동적으로 받는다.** 정적으로 import 하면 앱 메인 청크가 gzip 기준
 *  340KB 늘어난다 — 첫 그림이 나오기 전에 전부 받는다.
 */

import {useEffect, useRef} from 'react';
import type * as THREE from 'three';

const VIEW_DIR: [number, number, number] = [0.20, 0.34, 1];
const FIT_MARGIN = 1.04;
const FOV = 30;
const PARALLAX = 0.16;        // 포인터를 따라 카메라가 도는 폭(라디안)

const STROKE_HZ = 2.9;        // 한 손이 1초에 두드리는 횟수
const BREATHE_SEC = 4.6;
const BLINK_CLOSE = 0.09;
const BLINK_OPEN = 0.13;
const BLINK_GAP = [3.0, 7.0];
const PAUSE_GAP = [4.0, 9.0];
const PAUSE_LEN = [0.8, 2.2];
const REACT_SEC = 1.6;

type Pose = {head_up: number; head_tilt: number; lean_in: number; lean_back: number; typing: number};
/** 마우스를 올렸을 때 — 하던 일을 멈추고 이쪽을 본다. */
const HOVER_POSE: Pose = {head_up: 1.0, head_tilt: 0.30, lean_in: 0, lean_back: 0.25, typing: 0.25};
/** 그냥 일하는 중. 약간 앞으로 기울어 있어야 일하는 자세로 읽힌다. */
const IDLE_POSE: Pose = {head_up: 0, head_tilt: 0, lean_in: 0.22, lean_back: 0, typing: 1};
/** 누를 때마다 돌아가며 나온다 — 같은 반응이 반복되면 장치로 보인다. */
const REACTIONS: Pose[] = [
  {head_up: 1.0, head_tilt: 0.15, lean_in: 0, lean_back: 1.0, typing: 0},
  {head_up: 0.8, head_tilt: 1.0, lean_in: 0, lean_back: 0.3, typing: 0},
  {head_up: 0.2, head_tilt: 0, lean_in: 1.0, lean_back: 0, typing: 1},
];
const POSE_KEYS = ['head_up', 'head_tilt', 'lean_in', 'lean_back', 'typing'] as const;

type Three = typeof THREE;
type LoaderCtor = new () => {
  load: (
    url: string,
    ok: (gltf: {scene: THREE.Object3D}) => void,
    progress?: unknown,
    fail?: (e: unknown) => void,
  ) => void;
};

export default function Character3D({className, onReady}: {
  className?: string;
  onReady?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  // 콜백은 매번 새 함수로 들어온다. effect 가 그걸 의존하면 WebGL 컨텍스트가
  // 렌더마다 다시 만들어진다 — ref 로 받아 effect 는 한 번만 돈다.
  const readyCb = useRef(onReady);
  readyCb.current = onReady;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let stop: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const [three, loaders, envs] = await Promise.all([
        import('three'),
        import('three/examples/jsm/loaders/GLTFLoader.js'),
        import('three/examples/jsm/environments/RoomEnvironment.js'),
      ]);
      if (cancelled) return;
      stop = mount(el, three, loaders.GLTFLoader as unknown as LoaderCtor,
                   envs.RoomEnvironment, readyCb);
    })().catch(err => console.warn('[Character3D] 3D 를 띄우지 못했습니다', err));

    return () => { cancelled = true; stop?.(); };
  }, []);

  return <div ref={host} className={className}/>;
}

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

/** 한 번 두드리는 모양. 빠르게 내려갔다 천천히 올라온다. */
function stroke(x: number) {
  const s = Math.sin(x);
  return s > 0 ? Math.pow(s, 0.7) : 0;
}

/** 목표값으로 부드럽게 따라간다. 프레임레이트가 달라도 같은 속도로 붙는다. */
function approach(now: number, target: number, dt: number, rate: number) {
  return now + (target - now) * (1 - Math.exp(-rate * dt));
}

function mount(
  el: HTMLDivElement,
  T: Three,
  GLTFLoader: LoaderCtor,
  RoomEnvironment: new () => THREE.Scene,
  readyCb: {current: (() => void) | undefined},
) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const renderer = new T.WebGLRenderer({alpha: true, antialias: true});
  renderer.setClearAlpha(0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  // 이 버전에서 PCFSoft 는 빠졌다 — 지정하지 않으면 경고를 남기고 되돌아간다.
  renderer.shadowMap.type = T.PCFShadowMap;
  el.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';

  const scene = new T.Scene();

  // 축 주의 — 블렌더는 Z 가 위지만 **glTF 는 Y 가 위다.** 내보내면서 바뀐다.
  const camera = new T.PerspectiveCamera(FOV, 1, 0.1, 60);
  let model: THREE.Object3D | null = null;
  const centre = new T.Vector3();
  let dist = 4;

  /** 장면 전체가 화면에 들어오도록 카메라 거리를 계산한다. */
  function measure() {
    if (!model) return;
    const box = new T.Box3().setFromObject(model);
    const size = new T.Vector3();
    box.getSize(size); box.getCenter(centre);
    const v = (FOV * Math.PI) / 180;
    const fitH = (size.y / 2) / Math.tan(v / 2);
    const fitW = (size.x / 2) / Math.tan(v / 2) / camera.aspect;
    dist = Math.max(fitH, fitW) * FIT_MARGIN + size.z / 2;
  }

  /** 포인터를 따라 카메라를 조금 돌린다 — 입체감이 여기서 가장 크게 온다. */
  function place(y: number, p: number) {
    const dir = new T.Vector3(...VIEW_DIR).normalize();
    dir.applyAxisAngle(new T.Vector3(0, 1, 0), y);
    dir.applyAxisAngle(new T.Vector3(1, 0, 0), p);
    camera.position.copy(centre).addScaledVector(dir, dist);
    camera.lookAt(centre);
  }

  // 환경광 — 매트한 플라스틱이 환경을 받아야 장난감처럼 보인다.
  const pmrem = new T.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;

  const key = new T.DirectionalLight(0xfff2e2, 2.2);
  key.position.set(2.4, 4.2, 3.0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0012;
  const sc = key.shadow.camera;
  sc.left = -2.4; sc.right = 2.4; sc.top = 2.4; sc.bottom = -2.4;
  sc.near = 0.5; sc.far = 14;
  scene.add(key);
  const fill = new T.DirectionalLight(0xbfe4d2, 0.9);
  fill.position.set(-3.0, 1.6, 2.2);
  scene.add(fill);
  // 정면광 — 키라이트가 위·옆에서 와서 얼굴이 어두웠다. 얼굴이 읽혀야 한다.
  const front = new T.DirectionalLight(0xffffff, 0.75);
  front.position.set(0.3, 1.1, 4.0);
  scene.add(front);
  scene.add(new T.HemisphereLight(0xdff2e8, 0x101e17, 0.9));
  scene.add(new T.AmbientLight(0xffffff, 0.2));

  // 바닥 그림자만 받는 판. 바닥을 그리지 않으면서 바닥에 붙인다.
  const ground = new T.Mesh(new T.PlaneGeometry(9, 9), new T.ShadowMaterial({opacity: 0.3}));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  let morphs: {mesh: THREE.Mesh; i: Record<string, number>} | null = null;
  let raf = 0;
  let visible = true;
  let disposed = false;

  new GLTFLoader().load(
    `${import.meta.env.BASE_URL}desk-scene.glb`,
    gltf => {
      if (disposed) { gltf.scene.traverse(disposeNode); return; }
      gltf.scene.traverse(o => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.receiveShadow = true;
        if (m.morphTargetDictionary && !morphs) {
          morphs = {mesh: m, i: m.morphTargetDictionary};
        }
      });
      model = gltf.scene;
      scene.add(model);
      resize();
      draw(0);
      readyCb.current?.();
    },
    undefined,
    err => console.warn('[Character3D] glb 를 읽지 못했습니다', err),
  );

  // ── 상태 ──────────────────────────────────────────────────────────
  const t0 = performance.now();
  let blinkAt = rand(BLINK_GAP[0], BLINK_GAP[1]);
  let pauseAt = rand(PAUSE_GAP[0], PAUSE_GAP[1]);
  let pauseTo = -1;
  let phase = 0;
  let speed = STROKE_HZ;
  let last = 0;
  let hover = false;
  let reactTo = -1;
  let reactIdx = -1;
  let yaw = 0, pitch = 0, yawTo = 0, pitchTo = 0;
  const pose: Pose = {head_up: 0, head_tilt: 0, lean_in: 0, lean_back: 0, typing: 1};

  function resize() {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(1);
    renderer.setSize(Math.round(r.width * dpr), Math.round(r.height * dpr), false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    measure();
    place(yaw, pitch);
  }
  resize();

  const still = () => reduced.matches;

  function blinkValue(t: number) {
    const d = t - blinkAt;
    if (d < 0) return 0;
    if (d < BLINK_CLOSE) return d / BLINK_CLOSE;
    if (d < BLINK_CLOSE + BLINK_OPEN) return 1 - (d - BLINK_CLOSE) / BLINK_OPEN;
    blinkAt = t + rand(BLINK_GAP[0], BLINK_GAP[1]);
    return 0;
  }

  function wanted(t: number): Pose {
    if (reactTo > 0 && t < reactTo) return REACTIONS[reactIdx];
    if (reactTo > 0) reactTo = -1;
    return hover ? HOVER_POSE : IDLE_POSE;
  }

  function draw(t: number) {
    const dt = Math.min(Math.max(t - last, 0), 0.1);
    last = t;
    const quiet = still();

    yaw = approach(yaw, quiet ? 0 : yawTo, dt, 4);
    pitch = approach(pitch, quiet ? 0 : pitchTo, dt, 4);
    place(yaw, pitch);

    if (morphs?.mesh.morphTargetInfluences) {
      const inf = morphs.mesh.morphTargetInfluences;
      const idx = morphs.i;
      const want = quiet ? IDLE_POSE : wanted(t);
      for (const nm of POSE_KEYS) {
        pose[nm] = quiet ? want[nm] : approach(pose[nm], want[nm], dt, 6);
        if (idx[nm] !== undefined) inf[idx[nm]] = pose[nm];
      }
      if (idx.breathe !== undefined) {
        inf[idx.breathe] = quiet ? 0.35
          : 0.5 - 0.5 * Math.cos((t / BREATHE_SEC) * Math.PI * 2);
      }
      if (idx.blink !== undefined) inf[idx.blink] = quiet ? 0 : blinkValue(t);

      if (!quiet) {
        if (pauseTo < 0 && t > pauseAt) pauseTo = t + rand(PAUSE_LEN[0], PAUSE_LEN[1]);
        if (pauseTo > 0 && t > pauseTo) {
          pauseTo = -1;
          pauseAt = t + rand(PAUSE_GAP[0], PAUSE_GAP[1]);
          speed = STROKE_HZ * rand(0.85, 1.2);
        }
        const typing = (pauseTo > 0 ? 0 : 1) * pose.typing;
        phase += dt * speed * Math.PI * 2;
        if (idx.type_l !== undefined) inf[idx.type_l] = typing * stroke(phase);
        if (idx.type_r !== undefined) inf[idx.type_r] = typing * stroke(phase + Math.PI);
      } else {
        if (idx.type_l !== undefined) inf[idx.type_l] = 0;
        if (idx.type_r !== undefined) inf[idx.type_r] = 0;
      }
    }
    renderer.render(scene, camera);
  }

  function loop(now: number) {
    raf = requestAnimationFrame(loop);
    if (!visible || document.hidden) return;
    draw((now - t0) / 1000);
  }
  raf = requestAnimationFrame(loop);

  // ── 입력 ──────────────────────────────────────────────────────────
  // 시차는 화면 전체의 포인터를 따른다. 상자 안에서만 반응하면 거의 안 움직인다.
  const onMove = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const cx = (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2);
    const cy = (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2);
    yawTo = Math.max(-1, Math.min(1, cx)) * PARALLAX;
    pitchTo = Math.max(-1, Math.min(1, cy)) * PARALLAX * 0.45;
    const pad = 60;
    hover = e.clientX > r.left - pad && e.clientX < r.right + pad &&
            e.clientY > r.top - pad && e.clientY < r.bottom + pad;
  };
  const onLeave = () => { hover = false; yawTo = 0; pitchTo = 0; };
  const onDown = () => {
    reactIdx = (reactIdx + 1) % REACTIONS.length;
    reactTo = (performance.now() - t0) / 1000 + REACT_SEC;
  };
  window.addEventListener('pointermove', onMove, {passive: true});
  window.addEventListener('pointerleave', onLeave);
  el.addEventListener('pointerdown', onDown);

  const io = new IntersectionObserver(e => { visible = e[0].isIntersecting; }, {threshold: 0.01});
  io.observe(el);
  const onVis = () => { visible = !document.hidden; };
  document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(resize);
  ro.observe(el);

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerleave', onLeave);
    el.removeEventListener('pointerdown', onDown);
    scene.traverse(disposeNode);
    pmrem.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}

function disposeNode(o: THREE.Object3D) {
  const m = o as THREE.Mesh;
  if (!m.isMesh) return;
  m.geometry?.dispose();
  const mats = Array.isArray(m.material) ? m.material : [m.material];
  for (const mat of mats) {
    if (!mat) continue;
    for (const v of Object.values(mat)) {
      if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
    }
    mat.dispose();
  }
}
