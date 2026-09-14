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
 // A free re-release is worth roughly one extra cast: on the reference kit that
 // is close to a whole item of damage, so it prices at 1.0 before uptime.
 if(e.kind==='RECAST_SKILL')return 1;
 // Filling the bar buys one cast's worth of cadence, less than repeating one.
 if(e.kind==='MANA_FILL')return .55*(v||1);
 // A conversion moves `value` of one stat into another at `scaling.cap` rate.
 // The gain is what arrives, the loss is what left, so only the excess counts.
 if(e.kind==='CONVERT_STAT')return v*((e.scaling?.cap??1)-1)+v*.25;
 const units:Record<string,number>={DAMAGE_AMP:.15,SKILL_DAMAGE_AMP:.15,DAMAGE_REDUCTION:.12,OMNIVAMP:.18,CRIT_CHANCE_ADD:.3,CRIT_DAMAGE_ADD:.3,MANA_ADD:60,HEAL_MAXHP_PCT:.22,SHIELD_MAXHP_PCT:.25,SUNDER_ARMOR_PCT:.22,SHRED_MR_PCT:.22,SHIELD_FLAT:250,CC_RESIST:.5,SURVIVE_LETHAL:.5,SKILLS_CAN_CRIT:.6};
 return units[e.kind] ? v/units[e.kind] : null;
}
/**
 * Average multiplier a `scaleBy` source actually contributes over a fight.
 *
 * Without this every scaling card reads at its per-unit value as though the
 * multiplier were always 1, which priced the new cards at four to six times
 * their real budget. Counts use the mean live count across a fight rather than
 * the opening board, and the capped sources are clamped the same way the engine
 * clamps them.
 */
function scaleMean(e:EffectDef):number{
 if(!e.scaleBy)return 1;
 const mean:Record<string,number>={ENEMIES_ALIVE:3.2,ALLIES_ALIVE:3.2,ENEMIES_DEAD:2.2,ALLIES_DEAD:2.2,
  SELF_MISSING_HP_PCT:.42,SELF_CURRENT_HP_PCT:.58,RACE_PROGRESS:.55,SECONDS_ELAPSED:14};
 return Math.min(e.scaleCap??Number.POSITIVE_INFINITY,mean[e.scaleBy]??1);
}
function estimate(e:EffectDef):{value:number;unknown:boolean}{
 const value=raw(e);if(value===null)return {value:0,unknown:true};
 const phase=e.trigger?.when==='ON_RACE_PHASE'?e.trigger.phase:undefined;
 let uptime=phase==='LAST_3F'?.2:phase==='LATE'?.4:phase==='POSITIONING'?.8:1;
 // A continuously-gated phase window is worth the share of the race it covers,
 // not the whole fight: RACE_PHASE_AT puts 중반 at half and the rest at a sixth.
 if(e.trigger?.when==='IN_RACE_PHASE'){
  const share:Record<string,number>={START:1/6,POSITIONING:1/2,LATE:1/6,LAST_3F:1/6,OVERTIME:1/12};
  const windows=e.trigger.phases??(e.trigger.phase?[e.trigger.phase]:[]);
  uptime=windows.length?windows.reduce((n,p)=>n+(share[p]??0),0):1;
 }
 if(e.trigger?.when==='IN_FRONT_ROWS'||e.trigger?.when==='IN_BACK_ROWS')uptime*=.5;
 if(e.trigger?.when==='ON_TARGET_CHANGED'||e.trigger?.when==='ON_SAME_TARGET_NTH_ATTACK')uptime*=.5;
 if(e.duration)uptime=Math.min(uptime,e.duration/30);
 let condition=e.kind==='STACKING_STAT'?.7:1;
 if(e.trigger?.when==='ON_TAKEDOWN_ASSIST'||e.trigger?.when==='ON_KILL')condition*=.65;
 if(e.trigger?.when==='HP_BELOW'||e.trigger?.hpBelow!==undefined)condition*=.55;
 if(e.oncePerCombat)condition*=.5;
 const repeat=e.trigger?.when==='EVERY_SECONDS'&&e.kind!=='STACKING_STAT'?Math.floor(30/(e.trigger.threshold??1)):1;
 return {value:value*uptime*condition*repeat*scaleMean(e),unknown:false};
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
// 40 plans + 40 evolutions + 41 generic + 16 signature moves.
if(ALL_RACE_PLAN_NODES.length!==137)errors.push('Expected 137 nodes, got '+ALL_RACE_PLAN_NODES.length);
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
