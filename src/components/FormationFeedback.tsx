import { useEffect,useRef,useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useInteractionStore } from '../store/interactionStore';
import { lineupTraits,unitTraits } from '../game/engine/ai/evaluation';
import { getTrait,activeTierIndex } from '../game/engine/traits/trait-defs';
import { prepPoint } from '../game/ui/board-projection';
import { frameAt,orientSnapshot,samplePosition } from '../game/ui/battle-playback';
import { getUnitDef } from '../game/engine/roster';
import type { TraitId } from '../game/engine/types';
/** Feedback follows the visible owner's distinct-unit traits, including emblems. */
export function FormationFeedback():JSX.Element|null {
  const player=useGameStore(s=>s.viewedPlayer()),revision=useGameStore(s=>s.revision),running=useGameStore(s=>s.battleRunning);
  const frames=useGameStore(s=>s.viewedBattleFrames()),time=useGameStore(s=>s.battleTime),inspection=useInteractionStore(s=>s.inspection);
  const previous=useRef<{owner:string;tiers:Map<TraitId,number>}>(),[activated,setActivated]=useState<TraitId[]>([]);
  useEffect(()=>{
    if(!player)return;
    const tiers=new Map([...lineupTraits(player,player.board)].map(([id,n])=>[id,activeTierIndex(getTrait(id),n)]));
    const ownerChanged=previous.current?.owner!==player.id;
    const upgrades=previous.current?.owner===player.id&&!running?[...tiers].filter(([id,tier])=>tier>=0&&tier>(previous.current!.tiers.get(id)??-1)).map(([id])=>id):[];
    previous.current={owner:player.id,tiers};
    if(upgrades.length)setActivated(upgrades);
    else if(running||ownerChanged)setActivated([]);
  },[player,revision,running]);
  useEffect(()=>{if(!activated.length)return;const timer=setTimeout(()=>setActivated([]),1400);return()=>clearTimeout(timer);},[activated]);
  if(!player)return null;
  const inspected=inspection?.kind==='trait'&&inspection.playerId===player.id?inspection.id:null;
  const selected=new Set<TraitId>([...activated,...(inspected?[inspected]:[])]);
  if(!selected.size)return null;
  const counts=lineupTraits(player,player.board);
  const index=frames?.length?frameAt(frames,time):0,frame=running?frames?.[index]:undefined,next=frames?.[index+1];
  const mirrored=frames?.[0]?.units.some(u=>u.id.startsWith(player.id+'#')&&u.team==='B')??false;
  const markers=frame?frame.units.filter(u=>u.alive&&u.id.startsWith(player.id+'#')&&(u.traits??getUnitDef(u.unitDefId).traits).some(t=>selected.has(t))).map(u=>({id:u.id,p:samplePosition(orientSnapshot(u,mirrored),next?.units.find(n=>n.id===u.id)?orientSnapshot(next.units.find(n=>n.id===u.id)!,mirrored):undefined,next?(time-frame.t)/Math.max(.001,next.t-frame.t):0),burst:false}))
    :player.board.filter(u=>u.position&&unitTraits(player,u).some(t=>selected.has(t))).map(u=>({id:u.instanceId,p:prepPoint(u.position!),burst:unitTraits(player,u).some(t=>activated.includes(t))}));
  return <div className="formation-feedback" aria-label="특성 기물 강조">
    {activated.length>0&&<div className="trait-activation" role="status">{activated.map(id=>getTrait(id).name+' '+(activeTierIndex(getTrait(id),counts.get(id)??0)+1)+'단계 활성화').join(' · ')}</div>}
    {markers.map(m=><span key={m.id} data-highlight-unit={m.id} className={'formation-marker'+(m.burst?' activated':'')} style={{left:m.p.x,top:m.p.y,transform:'translate(-50%,-50%) scale('+m.p.scale+')'}}><i/><b>◆</b></span>)}
  </div>;
}
