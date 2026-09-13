/** Controlled same-cost team matchups; diagnostic, not ranked win rates. */
import { writeFileSync } from 'node:fs';
import { ALL_UNITS } from '../src/game/engine/roster';
import { BattleEngine, type BattleSideInput } from '../src/game/engine/battle/engine';
import { Rng } from '../src/game/engine/rng';
import type { Star, UnitDef } from '../src/game/engine/types';
const seeds=Number(process.argv[2]??3);
const rows:{id:string;name:string;cost:number;role:string;star:Star;battles:number;winRate:number;draws:number;seconds:number;damage:number}[]=[];
const candidates=process.argv[4]?.split(',');
const roster=candidates?ALL_UNITS.filter(u=>candidates.includes(u.id)):ALL_UNITS;
for(const d of roster) for(const star of [1,2,3] as Star[]) {
  let wins=0,draws=0,seconds=0,damage=0;
  const peers=ALL_UNITS.filter(u=>u.id!==d.id && u.cost===d.cost && u.role===d.role);
  const pool=peers.length?peers:ALL_UNITS.filter(u=>u.id!==d.id && u.cost===d.cost);
  for(let seed=0;seed<seeds;seed++) {
    const enemy=new Rng(913+seed*7919).pick(pool);
    const front=ALL_UNITS.filter(u=>u.role==='TANK' && u.id!==d.id && u.id!==enemy.id).sort((a,b)=>Math.abs(a.cost-d.cost)-Math.abs(b.cost-d.cost))[0];
    const carry=ALL_UNITS.filter(u=>u.role==='AD_CARRY' && u.id!==d.id && u.id!==enemy.id).sort((a,b)=>Math.abs(a.cost-d.cost)-Math.abs(b.cost-d.cost))[0];
    const side=(unit:UnitDef,id:string):BattleSideInput=>({playerId:id,augments:[],tacticianItems:[],units:[unit,front,carry].map((u,i)=>({instanceId:id+i,unitDefId:u.id,star,items:seed%2? u.role==='TANK'?['iron_stable']:u.role==='AP_CARRY'||u.role==='SUPPORT'?['blue_focus']:['champion_trophy']:[],position:{q:i===0?2:4,r:u.role==='TANK'||u.role==='BRUISER'?i===0?1:0:i===0?2:3}}))});
    for(const flip of [false,true]) {
      const engine=new BattleEngine(side(flip?enemy:d,'a'),side(flip?d:enemy,'b'),new Rng(913+seed*7919),{stage:4});
      const result=engine.run(),team=flip?'B':'A',id=flip?'b#b0':'a#a0';
      if(!engine.units.every(u=>Number.isFinite(u.hp)&&Number.isFinite(u.maxHp))) throw new Error('Nonfinite '+d.id);
      wins+=Number(result.winner===team);draws+=Number(result.winner===null);seconds+=result.durationSeconds;
      damage+=result.events.reduce((n,e)=>n+(e.type==='DAMAGE'&&e.source===id?e.damage:0),0);
    }
  }
  rows.push({id:d.id,name:d.nameKo,cost:d.cost,role:d.role,star,battles:seeds*2,winRate:wins/(seeds*2),draws,seconds:seconds/(seeds*2),damage:damage/(seeds*2)});
}
const result={seed:913,seeds,method:'145 units x 3 stars x same-cost same-role seeded peers x mirrored sides; identical tank/carry allies, alternating no gear and role gear; natural traits retained. Sparse matchup diagnostic, not ladder win rates.',rows};
writeFileSync(process.argv[3]??'docs/qa/roster-matchups.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({units:roster.length,battles:rows.reduce((n,r)=>n+r.battles,0),stars:[1,2,3].map(star=>({star,damage:rows.filter(r=>r.star===star).reduce((n,r)=>n+r.damage,0)/roster.length})),extremes:rows.filter(r=>r.star===2&&(r.winRate===0||r.winRate===1))}));
