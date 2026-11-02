// Explicit, local-only migration. Never run this in CI or write output into dist.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
const [factsPath,outputPath]=process.argv.slice(2);
if(!factsPath||!outputPath)throw Error('Usage: node tools/prepare-import.mjs <facts.json> <private-output.json>');
const output=resolve(outputPath);
if(output.startsWith(resolve('dist')))throw Error('Do not put private data in the public build.');
const facts=JSON.parse(readFileSync(factsPath,'utf8')).facts;
const observations=facts.filter(f=>f.kind==='self_report'&&f.review_status==='confirmed'&&f.key==='available_cash'&&f.unit==='KRW'&&typeof f.value==='number'&&f.as_of).map(f=>({id:`fact-${f.id}`,kind:'cash',value:f.value,date:f.as_of,note:`본인 확인 · ${f.id}`}));
if(!observations.length)throw Error('No confirmed dated cash facts found. Review source mapping first.');
const data={schemaVersion:1,name:'나의 LIFE',chapter:'선택지를 지키며 생활 안정화',domains:[{id:'finance',name:'재정 운영',color:'sage',icon:'wallet'},{id:'recovery',name:'회복 습관',color:'teal',icon:'sprout'},{id:'career',name:'일과 성장',color:'blue',icon:'briefcase'},{id:'learning',name:'배움',color:'amber',icon:'book'},{id:'relationships',name:'관계',color:'rose',icon:'heart'},{id:'creative',name:'창작',color:'violet',icon:'sparkles'}],quests:[],plans:[],observations:observations.sort((a,b)=>b.date.localeCompare(a.date)),rewards:[],reviews:[],rewardBudget:null,events:[{id:randomUUID(),at:new Date().toISOString(),text:'검토된 현금 사실을 로컬 가져오기 파일로 준비했어요. 다른 자료는 별도 대사가 필요해요.'}]};
writeFileSync(output,JSON.stringify(data,null,2),'utf8');
console.log('Prepared private import file. Only confirmed dated cash observations were mapped; no source statements, health records, inferred goals or XP were included.');
