import {useEffect, useRef, useState} from 'react';
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
          <linearGradient id="skin" x1=".2" y1="0" x2=".9" y2="1">
            <stop offset="0" stopColor="#f6d2ae"/><stop offset=".55" stopColor="#e3ae84"/><stop offset="1" stopColor="#bf835b"/>
          </linearGradient>
          <linearGradient id="skinDark" x1="0" y1="0" x2="1" y2=".6">
            <stop offset="0" stopColor="#dcae8a"/><stop offset="1" stopColor="#b2794f"/>
          </linearGradient>
          <linearGradient id="hair" x1=".25" y1="0" x2=".8" y2="1">
            <stop offset="0" stopColor="#4c4757"/><stop offset=".45" stopColor="#2f2b36"/><stop offset="1" stopColor="#1b1921"/>
          </linearGradient>
          <linearGradient id="shirt" x1=".2" y1="0" x2=".85" y2="1">
            <stop offset="0" stopColor="#f1e7d2"/><stop offset=".55" stopColor="#dccbac"/><stop offset="1" stopColor="#ab9878"/>
          </linearGradient>
          <linearGradient id="pants" x1=".2" y1="0" x2=".85" y2="1">
            <stop offset="0" stopColor="#aaa48d"/><stop offset=".6" stopColor="#8d8771"/><stop offset="1" stopColor="#686353"/>
          </linearGradient>
          <linearGradient id="bag" x1=".1" y1="0" x2=".9" y2="1">
            <stop offset="0" stopColor="#e8a461"/><stop offset=".6" stopColor="#c97d39"/><stop offset="1" stopColor="#965a27"/>
          </linearGradient>
          <linearGradient id="shoe" x1=".1" y1="0" x2=".9" y2="1">
            <stop offset="0" stopColor="#e0a566"/><stop offset="1" stopColor="#a56d2d"/>
          </linearGradient>
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
            <g className="home-breathe">
              {/* 가방 — 몸 뒤 */}
              <rect x={L - 46} y={G - 128} width="34" height="48" rx="13" fill="url(#bag)"/>
              <rect x={L - 43} y={G - 117} width="26" height="15" rx="6" fill="#ae6c30" opacity=".55"/>

              {/* 다리 */}
              <path d={`M${L - 13},${G - 74} q-3,34 -4,62`} stroke="url(#skinDark)" strokeWidth="17"
                    strokeLinecap="round" fill="none"/>
              <path d={`M${L + 13},${G - 74} q5,32 7,60`} stroke="url(#skin)" strokeWidth="17"
                    strokeLinecap="round" fill="none"/>
              {/* 양말과 신발 */}
              <rect x={L - 26} y={G - 18} width="17" height="10" rx="3" fill="#f2ece0"/>
              <rect x={L + 12} y={G - 18} width="17" height="10" rx="3" fill="#f2ece0"/>
              <path d={`M${L - 29},${G - 9} h22 q8,0 9,6 v3 q0,3 -4,3 h-27 q-3,0 -3,-4 z`} fill="url(#shoe)"/>
              <path d={`M${L + 9},${G - 9} h22 q8,0 9,6 v3 q0,3 -4,3 h-27 q-3,0 -3,-4 z`} fill="url(#shoe)"/>
              <rect x={L - 33} y={G - 1} width="39" height="5" rx="2.5" fill="#efe8da"/>
              <rect x={L + 5} y={G - 1} width="39" height="5" rx="2.5" fill="#efe8da"/>

              {/* 반바지 */}
              <path d={`M${L - 25},${G - 108} h50 v31 q0,8 -9,8 h-13 q-3,-10 -3,-17 q0,7 -3,17 h-13 q-9,0 -9,-8 z`}
                    fill="url(#pants)"/>
              <rect x={L - 26} y={G - 110} width="52" height="7" rx="3" fill="#7b7560"/>

              {/* 상의 */}
              <path d={`M${L - 26},${G - 154} q26,-9 52,0 l4,52 q-30,8 -60,0 z`} fill="url(#shirt)"/>
              <path d={`M${L - 26},${G - 154} q-15,5 -18,23 l16,7 q3,-15 6,-22 z`} fill="url(#shirt)"/>
              <path d={`M${L + 26},${G - 154} q15,5 18,23 l-16,7 q-3,-15 -6,-22 z`} fill="#cdbc9c"/>
              <path d={`M${L - 9},${G - 157} l9,12 l9,-12 l-4,-3 l-5,6 l-5,-6 z`} fill="#f5edda"/>

              {/* 팔 */}
              <path d={`M${L - 36},${G - 126} q-8,19 -5,35`} stroke="url(#skinDark)" strokeWidth="13"
                    strokeLinecap="round" fill="none"/>
              <path d={`M${L + 36},${G - 126} q9,18 6,34`} stroke="url(#skin)" strokeWidth="13"
                    strokeLinecap="round" fill="none"/>
              <circle cx={L - 40} cy={G - 87} r="7.5" fill="url(#skinDark)"/>
              <circle cx={L + 42} cy={G - 89} r="7.5" fill="url(#skin)"/>

              {/* 가방 끈 */}
              <path d={`M${L - 17},${G - 152} q-10,23 -10,46`} stroke="#c27b3a" strokeWidth="6"
                    strokeLinecap="round" fill="none"/>

              {/* 목 */}
              <rect x={L - 8} y={G - 168} width="16" height="18" rx="7" fill="#c78d64"/>

              {/* 머리 */}
              <ellipse cx={L - 34} cy={G - 193} rx="6" ry="8" fill="#dca57c"/>
              <ellipse cx={L + 34} cy={G - 194} rx="6" ry="8" fill="#c78d64"/>
              <ellipse cx={L} cy={G - 196} rx="34" ry="37" fill="url(#skin)"/>
              <path d={`M${L - 35},${G - 198} q2,-39 35,-39 q34,0 36,39 q-6,-17 -17,-20
                        q-7,9 -19,6 q-12,-3 -17,-8 q-11,6 -18,22 z`} fill="url(#hair)"/>
              <path d={`M${L + 10},${G - 235} q17,-9 23,7 q-11,-6 -23,-7 z`} fill="#3b3644"/>
              <path d={`M${L - 21},${G - 229} q9,10 23,9`} stroke="#514b5c" strokeWidth="3"
                    strokeLinecap="round" fill="none" opacity=".8"/>

              <path d={`M${L - 21},${G - 205} q7,-4 14,-1`} stroke="#2b2832" strokeWidth="3"
                    strokeLinecap="round" fill="none"/>
              <path d={`M${L + 7},${G - 206} q8,-3 15,1`} stroke="#2b2832" strokeWidth="3"
                    strokeLinecap="round" fill="none"/>
              <g className="home-blink">
                <ellipse cx={L - 13} cy={G - 194} rx="7.5" ry="8.5" fill="#fdfaf5"/>
                <ellipse cx={L + 15} cy={G - 195} rx="7.5" ry="8.5" fill="#fdfaf5"/>
                <circle cx={L - 11} cy={G - 193} r="4.2" fill="#2b2530"/>
                <circle cx={L + 17} cy={G - 194} r="4.2" fill="#2b2530"/>
                <circle cx={L - 9.6} cy={G - 195} r="1.5" fill="#ffffff"/>
                <circle cx={L + 18.4} cy={G - 196} r="1.5" fill="#ffffff"/>
              </g>
              <path d={`M${L + 1},${G - 186} q3,3 0,5`} stroke="#b57c55" strokeWidth="2.2"
                    strokeLinecap="round" fill="none"/>
              <path d={`M${L - 5},${G - 176} q6,5 12,-1`} stroke="#8d5a3c" strokeWidth="2.6"
                    strokeLinecap="round" fill="none"/>
              <ellipse cx={L - 23} cy={G - 182} rx="6" ry="4" fill="#e08a7a" opacity=".3"/>
              <ellipse cx={L + 24} cy={G - 183} rx="6" ry="4" fill="#e08a7a" opacity=".3"/>

              {/* 림라이트 — 길 쪽에서 오는 빛 */}
              <path d={`M${L + 32},${G - 216} a37,37 0 0 1 2,41`} stroke="#e3bd72" strokeWidth="3"
                    strokeLinecap="round" fill="none" opacity=".7"/>
              <path d={`M${L + 30},${G - 150} q8,30 2,52`} stroke="#e3bd72" strokeWidth="3"
                    strokeLinecap="round" fill="none" opacity=".5"/>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
