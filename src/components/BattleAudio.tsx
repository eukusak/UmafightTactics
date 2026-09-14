import { useEffect,useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { playSound,type GameSound } from '../game/ui/audio';
import { getUnitDef } from '../game/engine/roster';
import { frameAt } from '../game/ui/battle-playback';
/** Consume only newly visible events; scouting and seek/skip cannot replay a backlog. */
export function BattleAudio():null {
  const frames=useGameStore(s=>s.viewedBattleFrames()),time=useGameStore(s=>s.battleTime),running=useGameStore(s=>s.battleRunning);
  const key=useGameStore(s=>[s.match?.seed,s.match?.stage,s.match?.round,s.onlineBattleId,s.spectating??s.human()?.id].join(':'));
  const cursor=useRef({key:'',index:-1,time:0});
  useEffect(()=>{
    if(!running||!frames?.length){cursor.current={key:'',index:-1,time:0};return;}
    const end=frameAt(frames,time);
    if(cursor.current.key!==key||time<cursor.current.time){cursor.current={key,index:time>.25?end:-1,time};}
    if (cursor.current.index === -1 && time <= .25 && frames[0].units.some(u => u.race)) playSound('race-gate');
    let played=0;
    for(let i=cursor.current.index+1;i<=end;i++) {
      const frame=frames[i];if(!frame||frame.t<time-.25)continue;
      // Race phase cues take precedence over the per-tick hit budget.
      const race = frame.events.filter(e => e.type === 'RACE_PHASE').at(-1);
      if (race?.type === 'RACE_PHASE') {
        if (race.phase === 'LATE') playSound('race-late');
        else if (race.phase === 'LAST_3F') playSound('race-last3f');
      }
      for(const e of frame.events) {
        if(played>=12)break;
        let sound:GameSound|undefined;
        const unit='source' in e?frame.units.find(u=>u.id===e.source):undefined;
        if(e.type==='ATTACK_START')sound=e.ranged?'attack-ranged':'attack-melee';
        else if(e.type==='DAMAGE'&&e.damage+e.absorbed>0)sound='hit';
        else if(e.type==='SKILL_EFFECT'&&unit){const def=getUnitDef(unit.unitDefId);sound=def.role==='SUPPORT'||!def.skill.effects.some(e=>e.kind.startsWith('DAMAGE'))?'skill-support':def.skill.damageType==='PHYSICAL'?'skill-strike':'skill-magic';}
        if(sound){playSound(sound,unit?.unitDefId.split('').reduce((n,c)=>n+c.charCodeAt(0),0)??0);played++;}
      }
    }
    cursor.current={key,index:end,time};
  },[frames,time,running,key]);
  return null;
}
