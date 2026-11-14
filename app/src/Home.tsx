import {useEffect, useRef, useState} from 'react';
import {projectCash, defaultPicks, monthAdd, today, won, type Sim, type Workspace} from './model';

/** 메인 화면 — 갈림길에 선 사람.
 *
 *  캐릭터가 밟고 선 바닥이 **현금 궤적 자체**다. 오른쪽에서 두 갈래로 갈라진다:
 *  내려가는 선(지금 흐름)과 올라가는 선(바꿨을 때). 데이터가 배경 장식이 아니라 지형이다.
 *  깊이는 대기 원근으로 낸다 — 먼 평면일수록 차가운 안개색으로 탈색되고, 가까운 캐릭터에만
 *  따뜻한 림라이트가 걸린다. 평면마다 시차가 달라 포인터를 움직이면 깊이가 드러난다.
 */

const VB = {w: 1200, h: 520};

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

  const neutral = projectCash(sim, defaultPicks(sim));
  const best = projectCash(sim, Object.fromEntries(
    sim.levers.map(l => [l.id, l.options.reduce((a, b) => (b.delta + b.hours * 60000) > (a.delta + a.hours * 60000) ? b : a).key])));
  const days = daysUntilMonth(neutral.zeroMonth);
  const months = neutral.rows.map((r, i) => ({
    month: r.month, drop: r.cash, rise: best.rows[i].cash,
  }));

  return (
    <section className="home">
      <Scene tilt={tilt} boxRef={box} drop={months.map(m => m.drop)} rise={months.map(m => m.rise)}
             months={months.map(m => m.month)} />
      <div className="home-copy">
        {days === null ? (
          <>
            <p className="home-lead">지금 흐름이면</p>
            <h1 className="home-figure">버틴다</h1>
            <p className="home-sub">6달 안에 현금이 0 아래로 가지 않아요.</p>
          </>
        ) : (
          <>
            <p className="home-lead">지금 흐름이면 현금이 바닥나기까지</p>
            <h1 className="home-figure"><b>{days}</b><span>일</span></h1>
            <p className="home-sub">{neutral.zeroMonth}. 바꾸면 달라져요.</p>
          </>
        )}
        <dl className="home-facts">
          <div><dt>가진 돈</dt><dd>{won(sim.cash)}</dd></div>
          <div><dt>매달</dt><dd className={sim.netMonthly < 0 ? 'minus' : ''}>{won(sim.netMonthly)}</dd></div>
          <div><dt>오늘 남는 시간</dt><dd>{neutral.freeHours ?? '—'}시간</dd></div>
        </dl>
        <div className="home-actions">
          <button className="primary" onClick={() => onGo('sim')}>길 바꿔 보기</button>
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
  const left = 545;                     // 캐릭터가 선 자리 — 길은 여기서 갈라진다
  const groundY = 236;   // 글자 영역(아래 42%) 위로 올린다
  const has = !!drop && !!rise && drop.length > 0;
  const all = has ? [...drop!, ...rise!, 0] : [0];
  const hi = Math.max(...all), lo = Math.min(...all), span = (hi - lo) || 1;
  const X = (i: number) => left + ((i + 1) / (months.length || 1)) * (w - left - 130);
  const Y = (v: number) => groundY + (1 - (v - lo) / span) * 132 - 66;
  const line = (vals: number[]) => `M${left},${groundY}` + vals.map((v, i) => ` L${X(i)},${Y(v)}`).join('');
  const p = (f: number) => `translate(${tilt.x * f}px, ${tilt.y * f * 0.45}px)`;

  return (
    <div className="home-scene" ref={boxRef}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" role="img"
           aria-label={has ? `앞으로 ${months.length}달의 두 갈래 길. 지금 흐름과 바꿨을 때.` : '길이 아직 그려지지 않은 풍경'}>
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
          <radialGradient id="body" cx=".32" cy=".26" r=".85">
            <stop offset="0" stopColor="#dff6e8"/><stop offset=".5" stopColor="#8fd9ae"/><stop offset="1" stopColor="#2f6a4d"/>
          </radialGradient>
          <radialGradient id="head" cx=".34" cy=".24" r=".8">
            <stop offset="0" stopColor="#f2fbf5"/><stop offset=".55" stopColor="#a8e5c2"/><stop offset="1" stopColor="#3c7a5a"/>
          </radialGradient>
          <radialGradient id="glow" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#5ee89a" stopOpacity=".3"/><stop offset="1" stopColor="#5ee89a" stopOpacity="0"/>
          </radialGradient>
        </defs>

        <rect x={-400} y={-200} width={w + 800} height={h + 400} fill="url(#sky)"/>

        {/* 먼 평면 — 가장 느리게 움직이고 가장 탈색돼 있다 */}
        <g style={{transform: p(6)}} opacity=".5">
          <path d={`M-400,232 Q180,178 360,222 T760,208 T1600,234 V${h + 200} H-400 Z`} fill="#13232a"/>
          <circle cx="952" cy="104" r="48" fill="#1b3038"/>
        </g>
        <g style={{transform: p(14)}} opacity=".72">
          <path d={`M-400,268 Q240,224 470,258 T900,248 T1600,272 V${h + 200} H-400 Z`} fill="#15282c"/>
        </g>
        <rect x={-400} y={120} width={w + 800} height={h + 200} fill="url(#fog)"/>

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
          <ellipse cx={left + 150} cy={groundY - 52} rx="190" ry="140" fill="url(#glow)"/>
          <ellipse className="home-shadow" cx={left} cy={groundY + 12} rx="62" ry="14"/>
          <g className="home-figure-art">
            <rect x={left - 31} y={groundY - 110} width="62" height="86" rx="29" fill="url(#body)"/>
            <path d={`M${left + 24},${groundY - 104} q11,40 -3,76`} stroke="#e3bd72" strokeWidth="3.4"
                  strokeLinecap="round" fill="none" opacity=".75"/>
            <rect x={left - 21} y={groundY - 28} width="16" height="34" rx="8" fill="#2f6a4d"/>
            <rect x={left + 5} y={groundY - 28} width="16" height="34" rx="8" fill="#357756"/>
            <circle cx={left} cy={groundY - 138} r="39" fill="url(#head)"/>
            <path d={`M${left + 28},${groundY - 160} a39,39 0 0 1 3,43`} stroke="#e3bd72" strokeWidth="3.4"
                  strokeLinecap="round" fill="none" opacity=".8"/>
            <circle cx={left - 13} cy={groundY - 141} r="4" fill="#17352a"/>
            <circle cx={left + 11} cy={groundY - 143} r="4" fill="#17352a"/>
            <path d={`M${left - 7},${groundY - 128} q8,6 16,-2`} stroke="#17352a" strokeWidth="2.6"
                  strokeLinecap="round" fill="none"/>
          </g>
        </g>
      </svg>
    </div>
  );
}
