/** Bounded presentation only: no RNG, time scale, or combat state changes. */
export function impactPresentation(damage:number,maxHp:number,critical:boolean,skill:boolean,cost:number,reducedMotion=false) {
  const ratio=Math.max(0,damage)/Math.max(1,maxHp);
  const strength=Math.min(1, .2+ratio*3+(critical?.25:0)+(skill?.1:0));
  const heavy=damage>0&&(critical||skill&&cost>=4&&ratio>=.08);
  return {strength,heavy,radius:10+strength*18,particles:Math.round(3+strength*5),
    recoil:reducedMotion?0:2+strength*4,flash:critical?0xffe4a0:skill?0xe3d3ff:0xffffff,
    shake:!reducedMotion&&heavy?.0006+strength*.0007:0,duration:.16+strength*.1};
}
