/**
 * Catalogue and budget diagnostic. IE is a model, not a measured win-rate claim:
 * the spec's exact example magnitudes and its narrow IE bands are inconsistent.
 * --strict-ie makes model warnings fatal for tuning work; ordinary verification
 * enforces real invariants and emits every estimated budget for review.
 */
import { writeFileSync } from 'node:fs';
import { ALL_RACE_PLAN_NODES, guardPasses } from '../src/game/engine/race-plan/defs';
import { ALL_UNITS } from '../src/game/engine/roster';
import { nodeBattleEffects } from '../src/game/engine/race-plan/runtime';
import type { EffectDef } from '../src/game/engine/types';
import type { RacePlanNode } from '../src/game/engine/race-plan/types';

function raw(e:EffectDef):number|null {
 const v=e.value??0;
 const statUnit:Record<string,number>={attackDamage:.2,abilityPower:.4,attackSpeed:.3,armor:45,magicResist:45,hp:250,critChance:.3,startMana:60,maxMana:60};
 if(e.kind==='STAT_ADD'||e.kind==='STAT_MUL'||e.kind==='STACKING_STAT'){
   if(!e.stat||!statUnit[e.stat])return null;
   const pct=e.kind==='STAT_MUL'||e.tag==='PCT';
   const denominator=pct ? ({armor:.45,magicResist:.45,hp:.25} as Record<string,number>)[e.stat]??statUnit[e.stat] : e.stat==='abilityPower'?40:e.stat==='attackDamage'?20:statUnit[e.stat];
   return v/denominator*(e.kind==='STACKING_STAT'?(e.maxStacks??1):1);
 }
 const units:Record<string,number>={DAMAGE_AMP:.15,SKILL_DAMAGE_AMP:.15,DAMAGE_REDUCTION:.12,OMNIVAMP:.18,CRIT_CHANCE_ADD:.3,CRIT_DAMAGE_ADD:.3,MANA_ADD:60,HEAL_MAXHP_PCT:.22,SHIELD_MAXHP_PCT:.25,SUNDER_ARMOR_PCT:.22,SHRED_MR_PCT:.22,SHIELD_FLAT:250};
 return units[e.kind] ? v/units[e.kind] : null;
}
function estimate(e:EffectDef):{value:number;unknown:boolean}{
 const value=raw(e);if(value===null)return {value:0,unknown:true};
 const phase=e.trigger?.when==='ON_RACE_PHASE'?e.trigger.phase:undefined;
 let uptime=phase==='LAST_3F'?.2:phase==='LATE'?.4:phase==='POSITIONING'?.8:1;
 if(e.duration)uptime=Math.min(uptime,e.duration/30);
 let condition=e.kind==='STACKING_STAT'?.7:1;
 if(e.trigger?.when==='ON_TAKEDOWN_ASSIST'||e.trigger?.when==='ON_KILL')condition*=.65;
 if(e.trigger?.when==='HP_BELOW'||e.trigger?.hpBelow!==undefined)condition*=.55;
 if(e.oncePerCombat)condition*=.5;
 const repeat=e.trigger?.when==='EVERY_SECONDS'&&e.kind!=='STACKING_STAT'?Math.floor(30/(e.trigger.threshold??1)):1;
 return {value:value*uptime*condition*repeat,unknown:false};
}
function audit(node:RacePlanNode){
 const effects=nodeBattleEffects(node,'STANDARD');
 if(node.resource)effects.push(...node.resource.perStack.map(e=>({...e,value:(e.value??0)*node.resource!.max,trigger:node.resource!.payoutPhase?{when:'ON_RACE_PHASE' as const,phase:node.resource!.payoutPhase}:undefined})));
 const entries=effects.map(estimate);
 const ie=entries.reduce((sum,e)=>sum+e.value,0);
 const band=node.kind==='PLAN'?[.25,.35]:node.kind==='EVOLUTION'?[.30,.40]:[.60,.90];
 const as=effects.reduce((sum,e,i)=>sum+(e.stat==='attackSpeed'?Math.max(0,entries[i].value):0),0);
 return {id:node.id,kind:node.kind,ie:Math.round(ie*1000)/1000,unknown:entries.filter(e=>e.unknown).length,
   warning:ie<band[0]||ie>band[1],lateAs:node.fit.phases.includes('LAST_3F')&&as>Math.max(0,ie)*.5};
}
const errors:string[]=[];
if(ALL_RACE_PLAN_NODES.length!==90)errors.push('Expected 90 nodes');
for(const node of ALL_RACE_PLAN_NODES){
 if(!ALL_UNITS.some(u=>guardPasses(node,u,8)))errors.push(node.id+': no eligible unit');
 if(!node.effects.length&&!node.resource&&!['RP_TRACK_GOING','EV_TRACK_ADAPT','FM_RACE_READ'].includes(node.id))errors.push(node.id+': no combat payload');
 if(node.resource&&(node.resource.max<=0||node.resource.max>(node.resource.kind==='LEG'?10:6)))errors.push(node.id+': invalid resource cap');
 for(const e of node.effects)if(e.value!==undefined&&!Number.isFinite(e.value))errors.push(node.id+': non-finite magnitude');
}
const rows=ALL_RACE_PLAN_NODES.map(audit);
const warnings=rows.filter(r=>r.warning||r.lateAs||r.unknown);
console.log('race-plan catalogue: '+ALL_RACE_PLAN_NODES.length+' nodes; structural errors '+errors.length+'; estimated IE review flags '+warnings.length);
for(const error of errors)console.error(error);
const output=process.argv.indexOf('--report');
if(output>=0){
 const file=process.argv[output+1]??'docs/generated/RACE_PLAN_BUDGET_REVIEW.md';
 writeFileSync(file,'# Race Plan budget diagnostic\n\nReference: 30-second fight, 100 AD / 100 AP / 1000 HP. These are estimates, not measured item equivalence. Unknown effects are flagged, never silently certified. Exact magnitudes in spec §12–15 do not consistently satisfy §19; no automatic rescaling is applied. Incremental bands: plan .25–.35, evolution .30–.40, finishing .60–.90. Support targeting, mana cadence, retargeting, conditional uptime and combined nodes need simulation.\n\n| Node | Kind | Estimated IE | Unpriced effects | Review |\n|---|---|---:|---:|---|\n'+rows.map(r=>'| '+r.id+' | '+r.kind+' | '+r.ie+' | '+r.unknown+' | '+(r.warning?'band ':'')+(r.lateAs?'late AS >50%':'')+' |').join('\n')+'\n');
}
if(errors.length||(process.argv.includes('--strict-ie')&&warnings.length))process.exitCode=1;
