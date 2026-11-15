/** 캐릭터 — 레퍼런스: Rotem Talker 'Janner' 류의 마른 소년 모험가.
 *
 *  앞 버전(Little Leo 류)은 3등신 유아였다. 이건 다른 사람이다:
 *  **4등신, 턱이 좁은 얼굴, 가는 팔다리.** 그리고 의상이 성격을 만든다 —
 *  목에 묶은 스카프 · **허리에 묶은 옷** · 손가락 없는 장갑 · 걷어올린 바지 · 끈 부츠.
 *  이 다섯이 빠지면 그냥 티셔츠 입은 아이로 돌아간다.
 *
 *  좌표는 **발바닥이 원점**인 지역 좌표다(위가 음수). 바깥 g 가 (L,G) 로 옮긴다.
 *  숨쉬기는 CSS transform 이라 translate 와 같은 요소에 두면 서로 덮어쓴다 —
 *  그래서 바깥(translate)과 안(home-breathe)을 나눈다.
 */

/** 부츠 한 짝. `k:-1` 이 왼발이다.
 *
 *  **여기서 `scale(-1,1)` 을 쓰면 안 된다.** SVG 의 `transform` 속성은 CSS `transform`
 *  과 같은 속성이라, 장면에 걸린 `.home-scene g{transform-origin:50% 60%}` 가 그대로 먹는다.
 *  그러면 원점이 아니라 **뷰박스 한가운데를 기준으로** 뒤집혀 x≈2150 으로 날아간다.
 *  실제로 왼쪽 부츠와 왼손이 화면 밖에 그려지고 있었다. 그래서 x 부호를 직접 뒤집는다.
 */
function Boot({k}: {k: 1 | -1}) {
  const n = (v: number) => k * v;
  return (
    <g>
      <rect x={k > 0 ? 8 : -31} y="-50" width="23" height="32" rx="4" fill="url(#ch-boot)"/>
      <path d={`M${n(5)},-23 h${n(30)} q${n(11)},0 ${n(12)},10 v6 q0,3 ${n(-4)},3 h${n(-38)} q${n(-4)},0 ${n(-4)},-4 z`}
            fill="url(#ch-boot)"/>
      <rect x={k > 0 ? 1 : -48} y="-8" width="47" height="8" rx="3.5" fill="#cdc0a6"/>
      <path d={`M${n(11)},-44 l${n(17)},5 M${n(11)},-38 l${n(17)},5 M${n(11)},-32 l${n(17)},5`}
            stroke="#e5d8bd" strokeWidth="2.1" strokeLinecap="round" opacity=".9"/>
      {/* 걷어올린 바짓단 — 부츠 위에 겹친다 */}
      <path d={`M${n(9)},-64 h${n(23)} q${n(4)},0 ${n(4)},4 v7 q0,4 ${n(-4)},4 h${n(-23)} q${n(-4)},0 ${n(-4)},-4 v-7 q0,-4 ${n(4)},-4 z`}
            fill="url(#ch-cuff)"/>
    </g>
  );
}

/** 손가락 없는 장갑. 손가락이 보여야 이 의상으로 읽힌다.
 *  좌우를 뒤집지 않는다 — 위 Boot 의 주석과 같은 이유이고, 이 크기에서는 차이도 안 보인다. */
function Hand() {
  return (
    <g>
      <rect x="-9" y="-13" width="18" height="11" rx="5" fill="url(#ch-glove)"/>
      <path d="M-9,-3 q9,-3 18,0 l-1,11 q-8,4 -16,0 z" fill="url(#ch-glove)"/>
      <rect x="-8" y="7" width="4.4" height="9" rx="2.2" fill="url(#ch-skin2)"/>
      <rect x="-2.8" y="8" width="4.4" height="10" rx="2.2" fill="url(#ch-skin)"/>
      <rect x="2.4" y="7" width="4.4" height="9" rx="2.2" fill="url(#ch-skin)"/>
      <rect x="7" y="5" width="4" height="7" rx="2" fill="url(#ch-skin2)"/>
    </g>
  );
}

export default function Character({L, G}: {L: number; G: number}) {
  return (
    <>
      <defs>
        <linearGradient id="ch-skin" x1=".25" y1="0" x2=".85" y2="1">
          <stop offset="0" stopColor="#ffe3c6"/><stop offset=".5" stopColor="#f8cfa8"/><stop offset="1" stopColor="#e3ab7c"/>
        </linearGradient>
        <linearGradient id="ch-skin2" x1="0" y1="0" x2="1" y2=".7">
          <stop offset="0" stopColor="#fad5b1"/><stop offset="1" stopColor="#d79c6f"/>
        </linearGradient>
        <linearGradient id="ch-hair" x1=".2" y1="0" x2=".9" y2="1">
          <stop offset="0" stopColor="#9a6440"/><stop offset=".45" stopColor="#6e442b"/><stop offset="1" stopColor="#43281a"/>
        </linearGradient>
        <linearGradient id="ch-hair2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b2764c"/><stop offset="1" stopColor="#6b422a"/>
        </linearGradient>
        <linearGradient id="ch-tunic" x1=".2" y1="0" x2=".9" y2="1">
          <stop offset="0" stopColor="#f2e9d3"/><stop offset=".55" stopColor="#d5c8a8"/><stop offset="1" stopColor="#9a9177"/>
        </linearGradient>
        <linearGradient id="ch-scarf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0bc54"/><stop offset="1" stopColor="#b57c22"/>
        </linearGradient>
        <linearGradient id="ch-sash" x1=".1" y1="0" x2=".9" y2="1">
          <stop offset="0" stopColor="#b3a673"/><stop offset=".6" stopColor="#8d8255"/><stop offset="1" stopColor="#5d5636"/>
        </linearGradient>
        <linearGradient id="ch-pant" x1=".2" y1="0" x2=".9" y2="1">
          <stop offset="0" stopColor="#657a8c"/><stop offset=".6" stopColor="#47586a"/><stop offset="1" stopColor="#2b3642"/>
        </linearGradient>
        <linearGradient id="ch-cuff" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5d7183"/><stop offset="1" stopColor="#35424f"/>
        </linearGradient>
        <linearGradient id="ch-boot" x1=".2" y1="0" x2=".9" y2="1">
          <stop offset="0" stopColor="#c08e5c"/><stop offset=".6" stopColor="#95633a"/><stop offset="1" stopColor="#5e3b21"/>
        </linearGradient>
        <linearGradient id="ch-glove" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6b4c34"/><stop offset="1" stopColor="#3a2718"/>
        </linearGradient>
        <radialGradient id="ch-eye" cx=".38" cy=".3" r=".75">
          <stop offset="0" stopColor="#7fc9a4"/><stop offset=".6" stopColor="#3f8c69"/><stop offset="1" stopColor="#235340"/>
        </radialGradient>
      </defs>

      <g transform={`translate(${L} ${G})`}>
        <g className="home-breathe">
          {/* ── 부츠와 걷어올린 바짓단 ── */}
          <Boot k={-1}/>
          <Boot k={1}/>

          {/* ── 바지 — 통이 넓고 발목에서 접힌다 ── */}
          <path d="M-31,-128 h27 v72 h-25 z" fill="url(#ch-pant)"/>
          <path d="M31,-128 h-27 v72 h25 z" fill="url(#ch-pant)"/>
          <path d="M-33,-158 h66 v36 q0,5 -6,5 h-54 q-6,0 -6,-5 z" fill="url(#ch-pant)"/>
          <path d="M0,-126 v64" stroke="#28323c" strokeWidth="2" opacity=".55"/>
          <path d="M-28,-96 q11,4 21,0 M7,-96 q11,4 21,0" stroke="#394856" strokeWidth="2"
                strokeLinecap="round" fill="none" opacity=".8"/>

          {/* ── 윗옷 ── */}
          <path d="M-33,-224 q33,-11 66,0 l4,72 q-37,10 -74,0 z" fill="url(#ch-tunic)"/>
          <path d="M-33,-224 q-18,7 -22,29 l20,10 q4,-19 8,-28 z" fill="url(#ch-tunic)"/>
          <path d="M33,-224 q18,7 22,29 l-20,10 q-4,-19 -8,-28 z" fill="#bdb192"/>

          {/* ── 허리에 묶은 옷 — 이 캐릭터의 가장 큰 표식 ── */}
          <path d="M-35,-156 q35,-8 70,0 l-1,15 q-34,7 -68,0 z" fill="url(#ch-sash)"/>
          {/* 자락 — 바지 위로 늘어진다. 어두우면 바지에 먹혀 매듭만 뜬다. */}
          <path d="M-17,-143 q-9,19 -20,28 q-5,-22 10,-33 z" fill="#9c9262"/>
          <path d="M-5,-141 q0,22 -5,33 q-12,-13 -6,-34 z" fill="#857c4e"/>
          <path d="M-16,-150 q11,-7 21,0 q5,9 -5,12 q-13,3 -16,-4 z" fill="#c2b685"/>
          <path d="M-6,-149 q4,5 0,9" stroke="#7d7449" strokeWidth="2"
                strokeLinecap="round" fill="none"/>
          <path d="M-36,-156 q36,-8 72,0" stroke="#4c4830" strokeWidth="2.4" fill="none" opacity=".7"/>

          {/* ── 팔 ── */}
          <path d="M-43,-196 q-9,25 -7,52" stroke="url(#ch-skin2)" strokeWidth="12"
                strokeLinecap="round" fill="none"/>
          <path d="M43,-196 q9,25 7,52" stroke="url(#ch-skin)" strokeWidth="12"
                strokeLinecap="round" fill="none"/>
          <g transform="translate(-50,-142)"><Hand/></g>
          <g transform="translate(50,-142)"><Hand/></g>

          {/* ── 목 ── */}
          <rect x="-9" y="-238" width="18" height="22" rx="8" fill="#d7a177"/>

          {/* ── 목에 묶은 스카프 ── */}
          <path d="M-15,-232 q15,12 30,0 l3,11 q-18,11 -36,0 z" fill="url(#ch-scarf)"/>
          <ellipse cx="1" cy="-218" rx="7" ry="5.5" fill="#d79b30"/>
          <path d="M-4,-214 q-4,13 -9,19 q-2,-13 3,-20 z" fill="url(#ch-scarf)"/>
          <path d="M6,-214 q5,12 3,20 q-8,-8 -7,-20 z" fill="#c98a23"/>

          {/* ── 머리 — 둥근 아이가 아니라 턱이 좁은 소년이다 ── */}
          <path d="M-34,-272 c0,-24 2,-38 34,-38 c32,0 34,14 34,38
                   c0,24 -4,34 -13,42 c-7,6 -14,8 -21,8 c-7,0 -14,-2 -21,-8
                   c-9,-8 -13,-18 -13,-42 z" fill="url(#ch-skin)"/>

          {/* ── 귀 — 크게 뻗는다 ── */}
          <path d="M-32,-274 c-12,-3 -18,3 -17,14 c1,12 8,19 17,18 z" fill="url(#ch-skin2)"/>
          <path d="M32,-274 c12,-3 18,3 17,14 c-1,12 -8,19 -17,18 z" fill="url(#ch-skin)"/>
          <path d="M-35,-268 c-7,-1 -10,3 -9,10 c1,7 5,11 9,11" fill="none" stroke="#c98e62"
                strokeWidth="2.4" opacity=".6"/>
          <path d="M35,-268 c7,-1 10,3 9,10 c-1,7 -5,11 -9,11" fill="none" stroke="#c98e62"
                strokeWidth="2.4" opacity=".6"/>

          {/* ── 머리카락 — 덩어리 위로 갈래가 솟는다 ── */}
          <path d="M-36,-270 c-3,-34 6,-52 36,-52 c30,0 39,18 36,52
                   c-5,-19 -13,-28 -21,-31 c-9,9 -27,11 -39,3 c-6,-4 -9,-10 -12,-18
                   c-5,8 -7,24 0,46 z" fill="url(#ch-hair)"/>
          <path d="M-27,-308 c-5,-15 1,-28 13,-32 c-7,13 -8,23 -5,32 z" fill="url(#ch-hair2)"/>
          <path d="M-10,-315 c-3,-17 6,-29 19,-32 c-10,13 -12,23 -10,33 z" fill="url(#ch-hair2)"/>
          <path d="M8,-315 c5,-16 18,-23 30,-19 c-12,5 -19,12 -22,21 z" fill="url(#ch-hair2)"/>
          <path d="M24,-305 c11,-11 24,-11 32,-2 c-12,-2 -21,1 -27,8 z" fill="url(#ch-hair2)"/>
          <path d="M-36,-298 c-9,-10 -11,-22 -6,-31 c0,12 3,21 10,28 z" fill="url(#ch-hair2)"/>
          <path d="M-28,-296 c14,13 33,17 47,13" stroke="#9a6640" strokeWidth="3.4"
                strokeLinecap="round" fill="none" opacity=".65"/>
          <path d="M4,-304 c12,9 19,20 23,33" stroke="#9a6640" strokeWidth="2.8"
                strokeLinecap="round" fill="none" opacity=".5"/>

          {/* ── 눈썹 ── */}
          <path d="M-25,-285 q10,-5 18,-1" stroke="#4e2f1e" strokeWidth="3.2"
                strokeLinecap="round" fill="none"/>
          <path d="M7,-286 q9,-4 18,1" stroke="#4e2f1e" strokeWidth="3.2"
                strokeLinecap="round" fill="none"/>

          {/* ── 눈 ── */}
          <g className="home-blink">
            <ellipse cx="-15" cy="-270" rx="11.5" ry="13" fill="#fffdfa"/>
            <ellipse cx="16" cy="-271" rx="11.5" ry="13" fill="#fffdfa"/>
            <circle cx="-13" cy="-269" r="7.6" fill="url(#ch-eye)"/>
            <circle cx="18" cy="-270" r="7.6" fill="url(#ch-eye)"/>
            <circle cx="-13" cy="-269" r="3.6" fill="#15211b"/>
            <circle cx="18" cy="-270" r="3.6" fill="#15211b"/>
            <circle cx="-10.5" cy="-273" r="2.9" fill="#ffffff"/>
            <circle cx="20.5" cy="-274" r="2.9" fill="#ffffff"/>
            <circle cx="-17" cy="-264" r="1.4" fill="#ffffff" opacity=".6"/>
            <circle cx="14" cy="-265" r="1.4" fill="#ffffff" opacity=".6"/>
          </g>

          {/* ── 코·입·볼 ── */}
          <path d="M1,-257 q6,7 -1,10" stroke="#b5724a" strokeWidth="3.2"
                strokeLinecap="round" fill="none"/>
          <path d="M-8,-240 q9,6 17,-1" stroke="#8e5133" strokeWidth="3.2"
                strokeLinecap="round" fill="none"/>
          <ellipse cx="-24" cy="-250" rx="8" ry="5" fill="#ef9d8a" opacity=".32"/>
          <ellipse cx="26" cy="-251" rx="8" ry="5" fill="#ef9d8a" opacity=".32"/>

          {/* ── 림라이트 — 길 쪽에서 오는 빛.
                 윤곽선을 점선으로 끊어 오른쪽 가장자리만 남긴다.
                 호를 따로 그리면 반드시 뺨을 가로지른다(처음에 그렇게 했다). ── */}
          <ellipse cx="0" cy="-266" rx="34.5" ry="44" fill="none" stroke="#e3bd72" strokeWidth="3.2"
                   pathLength="100" strokeDasharray="16 84" strokeDashoffset="11"
                   strokeLinecap="round" opacity=".7"/>
          <path d="M33,-216 q10,34 3,58" stroke="#e3bd72" strokeWidth="2.8"
                strokeLinecap="round" fill="none" opacity=".42"/>
        </g>
      </g>
    </>
  );
}
