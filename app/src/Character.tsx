/** 캐릭터 — 레퍼런스: Roman Kamzolov 'Little Leo' 류의 3D 애니메이션 아이.
 *
 *  그 스타일의 핵심은 **비율**이다. 머리가 전체의 3분의 1이고, 눈이 크고,
 *  머리카락이 덩어리로 솟고, 신발이 두껍다. 선을 아무리 다듬어도 비율이 틀리면 안 닮는다.
 *  앞선 두 번의 실패가 그것이었다 — 머리가 작고 눈이 점이었다.
 *
 *  좌표는 발바닥(G)과 서 있는 자리(L) 기준. 전체 높이는 약 258.
 */
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
        <linearGradient id="ch-tee" x1=".2" y1="0" x2=".9" y2="1">
          <stop offset="0" stopColor="#fbfaf7"/><stop offset=".55" stopColor="#e6e3dc"/><stop offset="1" stopColor="#b5b1a8"/>
        </linearGradient>
        <linearGradient id="ch-sleeve" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6cc63"/><stop offset="1" stopColor="#c08f2a"/>
        </linearGradient>
        <linearGradient id="ch-shorts" x1=".2" y1="0" x2=".9" y2="1">
          <stop offset="0" stopColor="#5b8fd0"/><stop offset=".6" stopColor="#3f6fae"/><stop offset="1" stopColor="#2a4e7e"/>
        </linearGradient>
        <linearGradient id="ch-shoe" x1=".2" y1="0" x2=".9" y2="1">
          <stop offset="0" stopColor="#f58b76"/><stop offset=".6" stopColor="#e26a54"/><stop offset="1" stopColor="#b14633"/>
        </linearGradient>
        <radialGradient id="ch-eye" cx=".38" cy=".32" r=".75">
          <stop offset="0" stopColor="#7fc9a4"/><stop offset=".6" stopColor="#3f8c69"/><stop offset="1" stopColor="#235340"/>
        </radialGradient>
      </defs>

      <g className="home-breathe">
        {/* ── 다리와 신발 ── */}
        <path d={`M${L - 15},${G - 92} q-3,34 -3,52`} stroke="url(#ch-skin2)" strokeWidth="19"
              strokeLinecap="round" fill="none"/>
        <path d={`M${L + 15},${G - 92} q3,34 3,52`} stroke="url(#ch-skin)" strokeWidth="19"
              strokeLinecap="round" fill="none"/>
        {/* 두꺼운 운동화 — 이 스타일의 표식이다.
               밑창을 두껍게 밝게 깔지 않으면 어두운 배경에서 발이 뭉개진다. */}
        <path d={`M${L - 40},${G - 32} q0,-10 11,-10 h15 q8,0 9,9 q1,11 7,13 q9,3 9,10 v4 h-51 z`}
              fill="url(#ch-shoe)"/>
        <path d={`M${L + 4},${G - 32} q0,-10 11,-10 h15 q8,0 9,9 q1,11 7,13 q9,3 9,10 v4 h-51 z`}
              fill="url(#ch-shoe)"/>
        <rect x={L - 42} y={G - 10} width="53" height="12" rx="6" fill="#fdfdfb"/>
        <rect x={L + 2} y={G - 10} width="53" height="12" rx="6" fill="#fdfdfb"/>
        <rect x={L - 42} y={G - 4} width="53" height="6" rx="3" fill="#d8d4cb"/>
        <rect x={L + 2} y={G - 4} width="53" height="6" rx="3" fill="#d8d4cb"/>
        <path d={`M${L - 33},${G - 28} l11,7 M${L - 22},${G - 28} l-11,7`} stroke="#fdfdfb" strokeWidth="2.8"
              strokeLinecap="round"/>
        <path d={`M${L + 11},${G - 28} l11,7 M${L + 22},${G - 28} l-11,7`} stroke="#fdfdfb" strokeWidth="2.8"
              strokeLinecap="round"/>

        {/* ── 반바지 ── */}
        <path d={`M${L - 29},${G - 128} h58 v44 q0,9 -10,9 h-15 q-4,-12 -4,-20 q0,8 -4,20 h-15 q-10,0 -10,-9 z`}
              fill="url(#ch-shorts)"/>
        <path d={`M${L},${G - 95} v18`} stroke="#2a4e7e" strokeWidth="2" opacity=".6"/>

        {/* ── 티셔츠 (래글런 — 소매만 노란색) ── */}
        <path d={`M${L - 30},${G - 186} q30,-11 60,0 l5,62 q-35,10 -70,0 z`} fill="url(#ch-tee)"/>
        <path d={`M${L - 30},${G - 186} q-17,7 -21,27 l19,9 q4,-17 7,-26 z`} fill="url(#ch-sleeve)"/>
        <path d={`M${L + 30},${G - 186} q17,7 21,27 l-19,9 q-4,-17 -7,-26 z`} fill="url(#ch-sleeve)"/>
        <path d={`M${L - 11},${G - 190} q11,9 22,0`} stroke="#cfcbc2" strokeWidth="3" fill="none" strokeLinecap="round"/>

        {/* ── 팔과 손목밴드 ── */}
        <path d={`M${L - 42},${G - 152} q-7,22 -4,40`} stroke="url(#ch-skin2)" strokeWidth="14"
              strokeLinecap="round" fill="none"/>
        <path d={`M${L + 42},${G - 152} q7,22 4,40`} stroke="url(#ch-skin)" strokeWidth="14"
              strokeLinecap="round" fill="none"/>
        <rect x={L - 53} y={G - 126} width="18" height="10" rx="5" fill="#a8d5e8" transform={`rotate(-8 ${L - 44} ${G - 121})`}/>
        <rect x={L + 35} y={G - 126} width="18" height="10" rx="5" fill="#a8d5e8" transform={`rotate(8 ${L + 44} ${G - 121})`}/>
        <circle cx={L - 45} cy={G - 106} r="8.5" fill="url(#ch-skin2)"/>
        <circle cx={L + 45} cy={G - 106} r="8.5" fill="url(#ch-skin)"/>

        {/* ── 목 ── */}
        <rect x={L - 10} y={G - 202} width="20" height="20" rx="9" fill="#d7a177"/>

        {/* ── 귀 — 크게 뻗어 있다 ── */}
        <ellipse cx={L - 47} cy={G - 232} rx="11" ry="15" fill="url(#ch-skin2)"/>
        <ellipse cx={L + 47} cy={G - 232} rx="11" ry="15" fill="url(#ch-skin)"/>
        <ellipse cx={L - 47} cy={G - 232} rx="5.5" ry="8.5" fill="#c98e62" opacity=".55"/>
        <ellipse cx={L + 47} cy={G - 232} rx="5.5" ry="8.5" fill="#c98e62" opacity=".55"/>

        {/* ── 머리 — 전체의 3분의 1 ── */}
        <ellipse cx={L} cy={G - 238} rx="45" ry="47" fill="url(#ch-skin)"/>
        {/* 머리카락 덩어리 — 두피에 붙지 않고 **위로 솟는다**. 이게 이 스타일의 표식이다. */}
        <path d={`M${L - 48},${G - 240}
                  c-7,-44 7,-72 36,-78 c30,-6 54,6 60,32 c4,17 3,33 -1,46
                  c-5,-25 -16,-36 -27,-40 c-9,13 -28,17 -43,10 c-9,-4 -15,-10 -17,-16
                  c-8,11 -9,29 -8,46 z`} fill="url(#ch-hair)"/>
        {/* 갈래 셋 — 오른쪽으로 쓸린다 */}
        <path d={`M${L - 16},${G - 310} c7,-17 32,-23 48,-8
                  c-11,-3 -18,-1 -22,3 c15,3 25,14 27,27 c-13,-16 -36,-23 -53,-22 z`} fill="url(#ch-hair2)"/>
        <path d={`M${L - 34},${G - 300} c-15,3 -24,15 -25,31 c9,-16 19,-25 25,-31 z`} fill="url(#ch-hair2)"/>
        <path d={`M${L + 20},${G - 300} c16,-4 27,4 30,19 c-9,-11 -19,-16 -30,-19 z`} fill="url(#ch-hair2)"/>
        <path d={`M${L - 28},${G - 292} c14,14 33,18 48,14`} stroke="#9a6640" strokeWidth="3.6"
              strokeLinecap="round" fill="none" opacity=".7"/>
        <path d={`M${L + 4},${G - 300} c13,9 21,20 25,34`} stroke="#9a6640" strokeWidth="3"
              strokeLinecap="round" fill="none" opacity=".55"/>

        {/* ── 눈썹 ── */}
        <path d={`M${L - 28},${G - 252} q9,-6 18,-2`} stroke="#4e2f1e" strokeWidth="3.6"
              strokeLinecap="round" fill="none"/>
        <path d={`M${L + 10},${G - 254} q9,-4 18,2`} stroke="#4e2f1e" strokeWidth="3.6"
              strokeLinecap="round" fill="none"/>

        {/* ── 눈 — 크게. 이 스타일의 중심이다 ── */}
        <g className="home-blink">
          <ellipse cx={L - 18} cy={G - 238} rx="13" ry="14.5" fill="#fffdfa"/>
          <ellipse cx={L + 19} cy={G - 239} rx="13" ry="14.5" fill="#fffdfa"/>
          <circle cx={L - 16} cy={G - 237} r="8.5" fill="url(#ch-eye)"/>
          <circle cx={L + 21} cy={G - 238} r="8.5" fill="url(#ch-eye)"/>
          <circle cx={L - 16} cy={G - 237} r="4" fill="#15211b"/>
          <circle cx={L + 21} cy={G - 238} r="4" fill="#15211b"/>
          <circle cx={L - 13} cy={G - 241} r="3.2" fill="#ffffff"/>
          <circle cx={L + 24} cy={G - 242} r="3.2" fill="#ffffff"/>
          <circle cx={L - 20} cy={G - 232} r="1.6" fill="#ffffff" opacity=".65"/>
          <circle cx={L + 17} cy={G - 233} r="1.6" fill="#ffffff" opacity=".65"/>
        </g>

        {/* ── 코·입·볼 ── */}
        <ellipse cx={L + 2} cy={G - 224} rx="7.5" ry="6" fill="#efb88e"/>
        <ellipse cx={L + 1} cy={G - 226} rx="4" ry="3" fill="#ffd6b4" opacity=".7"/>
        <path d={`M${L - 7},${G - 212} q9,8 18,-1`} stroke="#9c5f3e" strokeWidth="3"
              strokeLinecap="round" fill="none"/>
        <ellipse cx={L - 31} cy={G - 220} rx="9" ry="6" fill="#ef9d8a" opacity=".38"/>
        <ellipse cx={L + 33} cy={G - 221} rx="9" ry="6" fill="#ef9d8a" opacity=".38"/>

        {/* ── 림라이트 — 길 쪽에서 오는 빛.
               윤곽선 자체를 점선으로 끊어 오른쪽 가장자리만 남긴다.
               호를 따로 그리면 반드시 뺨을 가로지른다(처음에 그렇게 했다). ── */}
        <ellipse cx={L} cy={G - 238} rx="45.5" ry="47.5" fill="none" stroke="#e3bd72" strokeWidth="3.2"
                 pathLength="100" strokeDasharray="17 83" strokeDashoffset="11"
                 strokeLinecap="round" opacity=".7"/>
        <path d={`M${L + 34},${G - 182} q9,34 2,58`} stroke="#e3bd72" strokeWidth="3"
              strokeLinecap="round" fill="none" opacity=".45"/>
      </g>
    </>
  );
}
