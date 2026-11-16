/** 캐릭터 3D — 2D SVG 캐릭터(`Character.tsx`)를 세운 것.
 *
 *  **디자인 정본은 여전히 `Character.tsx` 의 주석이다.** 4등신 · 턱이 좁은 얼굴 ·
 *  가는 팔다리, 그리고 의상 다섯(스카프 · 허리에 묶은 옷 · 손가락 없는 장갑 ·
 *  걷어올린 바지 · 끈 부츠). 모델은 `app/assets3d/life_boy.blend` 가 정본이고
 *  `public/character.glb` 는 그 내보내기다. 만든 과정은 `app/assets3d/README.md`.
 *
 *  담는 상자 크기에 맞춰 스스로 잡는다 — 쓰는 쪽은 CSS 로 자리와 크기만 준다.
 *
 *  **왜 애니메이션 클립이 아니라 모프 값인가** — glb 에는 `blink`·`breathe`
 *  모프 타깃만 들어 있다. 깜빡임은 간격이 일정하면 기계로 보여서, 고정 클립
 *  대신 여기서 불규칙하게 준다.
 *
 *  **three 는 동적으로 받는다.** 정적으로 import 하면 앱 메인 청크가 gzip 기준
 *  340KB 늘어난다 — 첫 그림이 나오기 전에 전부 받는다. 나눠 두면 화면이 먼저 뜨고
 *  캐릭터는 뒤따라 들어온다(그동안 자리는 비어 있고, 레이아웃은 움직이지 않는다).
 */

import {useEffect, useRef} from 'react';
import type * as THREE from 'three';

/** 모델의 키(m). `life_boy.blend` 가 이 값으로 세워져 있다. */
const MODEL_H = 1.388;
/** 상자 아래쪽에 남기는 여백 비율 — 발이 바닥에 딱 붙지 않게. */
const FOOT_PAD = 0.03;

const BREATHE_SEC = 4.2;
const BLINK_CLOSE = 0.09;     // 감기는 데 걸리는 시간(초)
const BLINK_OPEN = 0.13;
const BLINK_GAP = [3.2, 7.4]; // 다음 깜빡임까지

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
      const [three, loaders] = await Promise.all([
        import('three'),
        import('three/examples/jsm/loaders/GLTFLoader.js'),
      ]);
      if (cancelled) return;
      stop = mount(el, three, loaders.GLTFLoader as unknown as LoaderCtor, readyCb);
    })().catch(err => console.warn('[Character3D] 3D 를 띄우지 못했습니다', err));

    return () => { cancelled = true; stop?.(); };
  }, []);

  return <div ref={host} className={className}/>;
}

function mount(
  el: HTMLDivElement,
  T: Three,
  GLTFLoader: LoaderCtor,
  readyCb: {current: (() => void) | undefined},
) {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new T.WebGLRenderer({alpha: true, antialias: true});
  renderer.setClearAlpha(0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  // ACES 는 밝은 쪽을 눌러 준다. 배경이 어두운 초록이라 그대로 두면 묻힌다.
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  el.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';

  const scene = new T.Scene();

  // 축 주의 — 블렌더는 Z 가 위지만 **glTF 는 Y 가 위다.** 내보내면서 바뀐다.
  // 블렌더 기준으로 카메라를 두면 캐릭터를 아래에서 비스듬히 보게 된다
  // (실제로 그렇게 잘려 나왔다). 모델은 Y 로 서 있고 +Z 를 바라본다.
  const FRAME_H = MODEL_H / (1 - FOOT_PAD * 2);
  const fov = 26;
  const dist = (FRAME_H / 2) / Math.tan((fov / 2) * Math.PI / 180);
  const centreY = FRAME_H / 2 - FOOT_PAD * FRAME_H;
  const camera = new T.PerspectiveCamera(fov, 1, 0.1, 30);
  camera.position.set(0, centreY, dist);
  camera.lookAt(0, centreY, 0);

  // 따뜻한 쪽에서 들어오고 차가운 쪽이 받친다. 화면의 초록 어둠과 붙인다.
  const key = new T.DirectionalLight(0xffe8c8, 3.2);
  key.position.set(2.0, 2.8, 2.6);
  scene.add(key);
  const rim = new T.DirectionalLight(0xa9e8c4, 2.4);
  rim.position.set(-2.6, 1.6, -1.8);
  scene.add(rim);
  const fill = new T.DirectionalLight(0x8fc2d6, 0.9);
  fill.position.set(-2.4, 0.8, 1.8);
  scene.add(fill);
  scene.add(new T.HemisphereLight(0xcdeedd, 0x101e17, 1.2));
  scene.add(new T.AmbientLight(0xffffff, 0.3));

  let mesh: THREE.Mesh | null = null;
  let iBlink = -1;
  let iBreathe = -1;
  let frame = 0;
  let disposed = false;

  new GLTFLoader().load(
    `${import.meta.env.BASE_URL}character.glb`,
    gltf => {
      if (disposed) {
        gltf.scene.traverse(disposeNode);
        return;
      }
      gltf.scene.traverse(o => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || mesh) return;
        if (m.morphTargetDictionary) {
          mesh = m;
          iBlink = m.morphTargetDictionary.blink ?? -1;
          iBreathe = m.morphTargetDictionary.breathe ?? -1;
        }
      });
      scene.add(gltf.scene);
      resize();
      draw(0);
      readyCb.current?.();
    },
    undefined,
    err => console.warn('[Character3D] glb 를 읽지 못했습니다', err),
  );

  function resize() {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(1);
    renderer.setSize(Math.round(r.width * dpr), Math.round(r.height * dpr), false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  resize();

  const t0 = performance.now();
  let blinkAt = rand(BLINK_GAP[0], BLINK_GAP[1]);
  let running = true;

  function blinkValue(t: number) {
    const d = t - blinkAt;
    if (d < 0) return 0;
    if (d < BLINK_CLOSE) return d / BLINK_CLOSE;
    if (d < BLINK_CLOSE + BLINK_OPEN) return 1 - (d - BLINK_CLOSE) / BLINK_OPEN;
    blinkAt = t + rand(BLINK_GAP[0], BLINK_GAP[1]);
    return 0;
  }

  function draw(t: number) {
    if (mesh?.morphTargetInfluences) {
      const inf = mesh.morphTargetInfluences;
      if (iBreathe >= 0) {
        inf[iBreathe] = still ? 0.35
          : 0.5 - 0.5 * Math.cos((t / BREATHE_SEC) * Math.PI * 2);
      }
      if (iBlink >= 0) inf[iBlink] = still ? 0 : blinkValue(t);
    }
    renderer.render(scene, camera);
  }

  function loop(now: number) {
    frame = requestAnimationFrame(loop);
    if (!running) return;
    draw((now - t0) / 1000);
  }
  if (still) draw(0);
  else frame = requestAnimationFrame(loop);

  // 화면 밖이거나 탭이 가려져 있으면 그리지 않는다
  const io = new IntersectionObserver(e => { running = e[0].isIntersecting; }, {threshold: 0.01});
  io.observe(el);
  const onVis = () => { running = !document.hidden; };
  document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(resize);
  ro.observe(el);

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    io.disconnect();
    ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    scene.traverse(disposeNode);
    renderer.dispose();
    renderer.domElement.remove();
  };
}

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
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
