import { expect,it } from 'vitest';
import { impactPresentation } from '../src/game/ui/impact-presentation';
it('emphasizes critical/heavy hits, caps extreme damage and disables motion without losing feedback',()=>{
 const basic=impactPresentation(50,1000,false,false,1);
 const heavy=impactPresentation(300,1000,true,true,5);
 expect(heavy.radius).toBeGreaterThan(basic.radius);expect(heavy.shake).toBeGreaterThan(0);expect(basic.shake).toBe(0);
 const huge=impactPresentation(1e12,1,true,true,5);
 expect(huge.recoil).toBeLessThanOrEqual(6);expect(huge.particles).toBeLessThanOrEqual(8);expect(huge.shake).toBeLessThan(.002);
 const reduced=impactPresentation(300,1000,true,true,5,true);
 expect(reduced.shake).toBe(0);expect(reduced.recoil).toBe(0);expect(reduced.flash).toBe(heavy.flash);
 expect(impactPresentation(0,0,false,true,5).heavy).toBe(false);
});
