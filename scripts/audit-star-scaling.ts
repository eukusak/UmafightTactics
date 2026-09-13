import { writeFileSync, readFileSync } from 'node:fs';
import { ALL_UNITS } from '../src/game/engine/roster';
import { buildSkill } from '../src/game/engine/battle/skill-templates';
import { skillEffectValue } from '../src/game/engine/battle/skill-scaling';
import type { Cost, RunStyle, Star } from '../src/game/engine/types';
const rows=ALL_UNITS.map(u=>({id:u.id,name:u.nameKo,cost:u.cost,pattern:u.skill.choreography?.variant,
  effects:u.skill.effects.filter(e=>e.value!==undefined && !['DASH','APPLY_STATUS','WOUND'].includes(e.kind)).map(e=>({kind:e.kind,stat:e.stat,perHit:([1,2,3] as Star[]).map(star=>skillEffectValue(e,star,u.cost))}))}));
const costProbes=ALL_UNITS.filter(u=>['oguri_cap','mejiro_mcqueen','twin_turbo'].includes(u.id)).map(u=>({id:u.id,pattern:u.skill.choreography?.variant,
  costs:([1,2,3,4,5] as Cost[]).map(cost=>{const skill=buildSkill({unitId:u.id,nameKo:u.nameKo,role:u.role,style:u.traits.find(t=>['nige','senko','sashi','oikomi'].includes(t)) as RunStyle,cost,power01:.5,signatureName:null,mainWin:null});return {cost,effects:skill.effects.filter(e=>['DAMAGE','SHIELD_FLAT','HEAL','STAT_MUL'].includes(e.kind)).map(e=>({kind:e.kind,stat:e.stat,values:([1,2,3] as Star[]).map(star=>skillEffectValue(e,star,cost))}))};})}));
const before=JSON.parse(readFileSync('docs/qa/augment-expansion-after.json','utf8'));
const after=JSON.parse(readFileSync('docs/qa/star-scaling-after.json','utf8'));
const comparison=after.rows.map((row: {seasonId:string;battles:number;drawRate:number;overtimeRate:number;poolViolations:number})=>({season:row.seasonId,before:before.rows.find((r:{seasonId:string})=>r.seasonId===row.seasonId),after:row}));
const report={baselineCommit:'a9c40bb5eab7b43d8c4b505139948250e59d380a',abilityPower:100,note:'Per-hit unmitigated values, not DPS or a win-rate guarantee. Cost probes hold the character kit and power percentile fixed. Match samples reuse the same five seeds per season from PR19; small diagnostic sample only.',costProbes,comparison,roster:rows};
writeFileSync('docs/qa/star-scaling-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({characters:rows.length,costProbes,comparison:comparison.map((r:{season:string;before:{overtimeRate:number;drawRate:number};after:{overtimeRate:number;drawRate:number;poolViolations:number}})=>({season:r.season,overtime:[r.before.overtimeRate,r.after.overtimeRate],draws:[r.before.drawRate,r.after.drawRate],poolViolations:r.after.poolViolations}))},null,2));
