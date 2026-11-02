// 앱에 넣기 전에 import 파일이 스키마에 맞는지 확인한다. 작성: WACUS
//   cd app && npx vite-node tools/verify-import.mjs
// 생성은 저장소 루트에서 python tools/build_app_import.py
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
import {parseBackup} from '../src/model.ts';

const here = dirname(fileURLToPath(import.meta.url));
const file = resolve(here, '../../private_raw/life-app-import.json');

const ws = parseBackup(JSON.parse(readFileSync(file, 'utf8')));
console.log('스키마 검증 통과 —', file);
console.log(`  분야 ${ws.domains.length} · 퀘스트 ${ws.quests.length} · 플랜 ${ws.plans.length} · 관측 ${ws.observations.length}`);

const byDue = {};
for (const q of ws.quests) (byDue[q.due] ??= []).push(q.title);
console.log('  마감일별 — 하루에 몰리지 않는지 본다');
for (const [d, t] of Object.entries(byDue).sort()) console.log(`    ${d}  ${t.length}개  ${t.join(' / ')}`);

console.log('  관측');
for (const o of ws.observations) console.log(`    ${o.date}  ${o.kind.padEnd(10)} ${String(o.value).padStart(12)}  ${o.note}`);
