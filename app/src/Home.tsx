import {useEffect, useRef, useState} from 'react';
import Character from './Character';
import {projectCash, picksOf, defaultPicks, today, won, type Sim, type Workspace} from './model';

/** 메인 화면 — 갈림길에 선 사람.
 *
 *  캐릭터가 밟고 선 바닥이 **현금 궤적 자체**다. 오른쪽에서 두 갈래로 갈라진다:
 *  내려가는 점선(아무것도 안 바꿨을 때)과 올라가는 실선(지금 고른 대로). 데이터가 지형이다.
 *  깊이는 대기 원근으로 낸다 — 먼 평면일수록 차가운 안개색으로 탈색되고,
 *  가까운 캐릭터만 따뜻한 색과 림라이트로 떠오른다. 평면마다 시차가 달라 포인터에 반응한다.
 */

const VB = {w: 1200, h: 560};

function daysUntilMonth(ym: string | null) {
  if (!ym) return null;
  const first = new Date(`${ym}-01T00:00:00Z`).getTime();
  const now = new Date(`${today()}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((first - now) / 86400000));
}

export default function Home({s, onGo}: {s: Workspace; onGo: (v: 'sim' | 'journal') => void}) {
  const sim = s.sim as Sim | null;
  const box = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({x: 0, y: 0});

  // 포인터에만 반응한다. 저절로 흔들리지 않는다.
  useEffect(() => {
    const el = box.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      setTilt({
        x: Math.max(-1, Math.min(1, (e.clientX - r.left) / r.width * 2 - 1)),
        y: Math.max(-1, Math.min(1, (e.clientY - r.top) / r.height * 2 - 1)),
      });
    };
    const leave = () => setTilt({x: 0, y: 0});
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); };
  }, []);

  const wrote = s.journal?.some(j => j.date === today()) ?? false;

  if (!sim) {
    return (
      <section className="home home-bare">
        <Scene tilt={tilt} boxRef={box} drop={null} rise={null} months={[]} />
        <div className="home-copy">
          <p className="home-lead">숫자가 아직 없어요.</p>
          <h1 className="home-figure home-figure-quiet">기다리는 중</h1>
          <p className="home-sub">기록이 들어오면 여기에 길이 그려져요.</p>
          <div className="home-actions">
            <button className="primary" onClick={() => onGo('journal')}>오늘 일기 쓰기</button>
          </div>
        </div>
      </section>
    );
  }

  // 지금 고른 조합이 '내 길'이다. 시뮬레이션에서 바꾸면 여기 날짜도 따라 바뀐다.
  const picks = picksOf(s);
  const mine = projectCash(sim, picks);
  const plain = projectCash(sim, defaultPicks(sim));
  const changed = sim.levers.some(l => picks[l.id] !== defaultPicks(sim)[l.id]);
  const days = daysUntilMonth(mine.zeroMonth);
  const months = mine.rows.map((r, i) => ({month: r.month, drop: plain.rows[i].cash, rise: r.cash}));

  return (
    <section className="home">
      <Scene tilt={tilt} boxRef={box} drop={months.map(m => m.drop)} rise={months.map(m => m.rise)}
             months={months.map(m => m.month)} />
      <div className="home-copy">
        {days === null ? (
          <>
            <p className="home-lead">{changed ? '지금 고른 대로면' : '지금 흐름이면'}</p>
            <h1 className="home-figure">버틴다</h1>
            <p className="home-sub">
              {changed ? '지금 고른 대로면 6달 안에 바닥나지 않아요.' : '지금 흐름대로도 6달 안에 바닥나지 않아요.'}
            </p>
          </>
        ) : (
          <>
            <p className="home-lead">{changed ? '지금 고른 대로면 바닥나기까지' : '아무것도 안 바꾸면 바닥나기까지'}</p>
            <h1 className="home-figure"><b>{days}</b><span>일</span></h1>
            <p className="home-sub">{mine.zeroMonth}. {changed ? '더 바꾸면 더 달라져요.' : '바꾸면 달라져요.'}</p>
          </>
        )}
        <dl className="home-facts">
          <div><dt>가진 돈</dt><dd>{won(sim.cash)}</dd></div>
          <div><dt>매달</dt><dd className={sim.netMonthly < 0 ? 'minus' : ''}>{won(sim.netMonthly)}</dd></div>
          <div><dt>오늘 남는 시간</dt>
            <dd className={(mine.freeHours ?? 1) < 0 ? 'minus' : ''}>{mine.freeHours ?? '—'}시간</dd></div>
        </dl>
        <div className="home-actions">
          <button className="primary" onClick={() => onGo('sim')}>{changed ? '길 더 바꾸기' : '길 바꿔 보기'}</button>
          <button className="ghost" onClick={() => onGo('journal')}>
            {wrote ? '오늘 일기 고치기' : '오늘 일기 쓰기'}
          </button>
        </div>
      </div>
    </section>
  );
}

function Scene({tilt, boxRef, drop, rise, months}: {
  tilt: {x: number; y: number};
  boxRef: React.RefObject<HTMLDivElement | null>;
  drop: number[] | null; rise: number[] | null; months: string[];
}) {
  const {w, h} = VB;
  const L = 530;          // 캐릭터가 선 자리 — 길은 여기서 갈라진다
  const G = 400;          // 발이 닿는 높이
  const has = !!drop && !!rise && drop.length > 0;
  const all = has ? [...drop!, ...rise!, 0] : [0];
  const hi = Math.max(...all), lo = Math.min(...all), span = (hi - lo) || 1;
  const FORK = L + 58;   // 분기점. 캐릭터 몸에 가리지 않게 옆으로 뺀다
  const X = (i: number) => FORK + ((i + 1) / (months.length || 1)) * (w - FORK - 120);
  const Y = (v: number) => G + (1 - (v - lo) / span) * 140 - 70;
  const line = (vals: number[]) => `M${FORK},${G - 6}` + vals.map((v, i) => ` L${X(i)},${Y(v)}`).join('');
  const p = (f: number) => `translate(${tilt.x * f}px, ${tilt.y * f * 0.45}px)`;

  return (
    <div className="home-scene" ref={boxRef}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" role="img"
           aria-label={has ? `앞으로 ${months.length}달의 두 갈래 길. 아무것도 안 바꿨을 때와 지금 고른 대로.` : '길이 아직 그려지지 않은 풍경'}>
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0a1512"/><stop offset=".55" stopColor="#0e1d1a"/>
            <stop offset="1" stopColor="#16262f"/>
          </linearGradient>
          <linearGradient id="fog" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#16262f" stopOpacity="0"/><stop offset="1" stopColor="#16262f" stopOpacity=".85"/>
          </linearGradient>
          <linearGradient id="riseG" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#5ee89a" stopOpacity=".25"/><stop offset="1" stopColor="#5ee89a" stopOpacity=".9"/>
          </linearGradient>
          <linearGradient id="dropG" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#4a5f56" stopOpacity=".5"/><stop offset="1" stopColor="#7d5f45" stopOpacity=".8"/>
          </linearGradient>
          <radialGradient id="glow" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#5ee89a" stopOpacity=".26"/><stop offset="1" stopColor="#5ee89a" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="shadowG" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#020504" stopOpacity=".72"/><stop offset="1" stopColor="#020504" stopOpacity="0"/>
          </radialGradient>
        </defs>

        <rect x={-400} y={-200} width={w + 800} height={h + 400} fill="url(#sky)"/>

        {/* 먼 평면 — 가장 느리게 움직이고 가장 탈색돼 있다 */}
        <g style={{transform: p(6)}} opacity=".5">
          <path d={`M-400,296 Q180,242 360,286 T760,272 T1600,298 V${h + 200} H-400 Z`} fill="#13232a"/>
          <circle cx="972" cy="138" r="52" fill="#1b3038"/>
        </g>
        <g style={{transform: p(14)}} opacity=".72">
          <path d={`M-400,338 Q240,294 470,328 T900,318 T1600,342 V${h + 200} H-400 Z`} fill="#15282c"/>
        </g>
        <rect x={-400} y={150} width={w + 800} height={h + 200} fill="url(#fog)"/>

        {/* 두 갈래 길 — 이게 곧 데이터다 */}
        {has && (
          <g style={{transform: p(26)}}>
            <path className="home-path-drop" d={line(drop!)} fill="none"/>
            <path className="home-path-rise" d={line(rise!)} fill="none"/>
            {rise!.map((v, i) => (
              <circle key={`r${i}`} className="home-stop" style={{animationDelay: `${0.5 + i * 0.09}s`}}
                      cx={X(i)} cy={Y(v)} r={i === rise!.length - 1 ? 7 : 4}/>
            ))}
            {months.map((m, i) => (i % 2 === 0 || i === months.length - 1) && (
              <text key={m} className="home-month" x={X(i)} y={Y(drop![i]) + 26} textAnchor="middle">
                {m.slice(5)}월
              </text>
            ))}
          </g>
        )}

        {/* 가까운 평면 — 캐릭터. 빛은 길 쪽에서 온다 */}
        <g style={{transform: p(40)}}>
          <ellipse cx={L + 150} cy={G - 60} rx="200" ry="150" fill="url(#glow)"/>
          <ellipse cx={L + 4} cy={G + 12} rx="70" ry="16" fill="url(#shadowG)"/>
          <g className="home-figure-art">
            {/* 좁은 화면에서는 글과 겹친다 — 위로 올리고 조금 줄인다(.home-actor) */}
            <g className="home-actor">
              <Character L={L} G={G}/>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
