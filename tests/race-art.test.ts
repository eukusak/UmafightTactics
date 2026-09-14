
import { describe, expect, it } from 'vitest';
import { RACE_ART, raceArtFrame, raceArtPosition, g1CrestKey, cardFrameKey } from '../src/game/ui/race-art';
import { isExposedCarry } from '../src/game/engine/battle/exposed-carries';
import { G1_THEMES } from '../src/game/engine/race-plan/profiles';
import { ALL_RACE_PLAN_NODES } from '../src/game/engine/race-plan/defs';
import { reflectCell, toBattleCell } from '../src/game/engine/battle/hex';
describe('race art delivery contracts',()=>{
  it('covers every G1 identity and every special card heading with a delivered key',()=>{
    for(const theme of G1_THEMES) expect(RACE_ART[g1CrestKey(theme)],theme.id).toBeDefined();
    for(const node of ALL_RACE_PLAN_NODES) {const key=cardFrameKey(node);if(key)expect(RACE_ART[key]).toBeDefined();}
    expect(Object.values(RACE_ART).reduce((n,a)=>n+a.frames,0)).toBe(447);
  });
  it('handles sheet row boundaries, negative seek, final frame and reduced motion',()=>{
    expect(raceArtFrame('dive_execute',-1)).toBe(0);
    expect(raceArtFrame('dive_execute',99)).toBe(13);
    expect(raceArtPosition('dive_execute',7)).toBe('0% 100%');
    expect(raceArtFrame('style_aura_nige_up',1,true)).toBe(2);
    expect(raceArtFrame('dive_execute',99,false,true)).toBe(6);
    expect(raceArtPosition('missing',4)).toBe('0% 0%');
  });
  it('shows the same screen protection before combat and on both battle orientations',()=>{
    for(let r=0;r<4;r++)for(let q=0;q<7;q++){
      const carry={role:'AD_CARRY' as const,cell:{q,r}};
      const tank={role:'TANK' as const,cell:{q:Math.max(0,q-1),r}};
      expect(isExposedCarry(carry,[tank])).toBe(false);
      expect(isExposedCarry(carry,[])).toBe(true);
      for(const team of ['A','B'] as const)expect(isExposedCarry({...carry,cell:toBattleCell(carry.cell,team)},[{...tank,cell:toBattleCell(tank.cell,team)}])).toBe(false);
      expect(isExposedCarry({...carry,cell:reflectCell(carry.cell)},[{...tank,cell:reflectCell(tank.cell)}])).toBe(false);
    }
    expect(isExposedCarry({role:'TANK',cell:{q:0,r:0}},[])).toBe(false);
    expect(isExposedCarry({role:'SUPPORT',cell:{q:0,r:0}},[{role:'AP_CARRY',cell:{q:0,r:1}}])).toBe(true);
  });
});
