import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect,it } from 'vitest';
import { getUnitDef } from '../src/game/engine/roster';
import type { SkillDef } from '../src/game/engine/types';
const signature=(s:SkillDef)=>createHash('sha256').update(JSON.stringify(s)).digest('hex');
function motionContract(s:SkillDef) {
 const copy:Partial<SkillDef>=structuredClone(s);delete copy.description;delete copy.baseValues;
 for(const e of copy.effects!)if(['DAMAGE','HEAL','SHIELD_FLAT'].includes(e.kind))delete e.value;
 return copy;
}
it('documents exactly five numeric-only power corrections and preserves their entire motion contract',()=>{
 const audit=JSON.parse(readFileSync('docs/qa/adaptive-balance-motion-compatibility.json','utf8'));
 expect(Object.keys(audit.units).sort()).toEqual(['tm_opera_o','symboli_rudolf','agnes_digital','agnes_tachyon','gran_alegria'].sort());
 for(const [id,record] of Object.entries(audit.units) as [string,{before:SkillDef;after:SkillDef;beforeSignature:string;skillSignature:string}][]){
  expect(signature(record.before)).toBe(record.beforeSignature);
  expect(signature(getUnitDef(id).skill)).toBe(record.skillSignature);
  expect(record.after).toEqual(getUnitDef(id).skill);
  expect(motionContract(record.after)).toEqual(motionContract(record.before));
  expect(record.skillSignature).not.toBe(record.beforeSignature);
 }
});
