/** Neutral-background review boards: portrait / previous idle / new idle / new skill. */
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)('sharp');
const audit=JSON.parse(await fs.readFile('docs/art-source/motions/identity-revisions-2026-09-12/roster-review.json','utf8'));
const units=Object.entries(audit.units).filter(([,u])=>u.status==='integrated');
const dir='docs/qa/identity-2026-09-12';await fs.mkdir(dir,{recursive:true});
for(let start=0;start<units.length;start+=6){
 const chunk=units.slice(start,start+6),layers=[];
 for(const [i,[id]] of chunk.entries()){
  const y=i*228;
  const label=Buffer.from(`<svg width="800" height="28"><rect width="800" height="28" fill="#10253a"/><text x="8" y="20" font-family="Arial" font-size="16" fill="white">${id} | portrait / previous / revised idle / revised skill</text></svg>`);
  layers.push({input:label,left:0,top:y});
  layers.push({input:await sharp('public/assets/portraits/'+id+'.png').resize(200,200).png().toBuffer(),left:0,top:y+28});
  const prev=execFileSync('git',['show',audit.baselineCommit+':public/assets/motions/'+id+'.png'],{maxBuffer:8*1024*1024});
  for(const [col,input,frame] of [[1,prev,0],[2,'public/assets/motions/'+id+'.png',0],[3,'public/assets/motions/'+id+'.png',14]]){
   layers.push({input:await sharp(input).extract({left:frame%4*128,top:Math.floor(frame/4)*128,width:128,height:128}).resize(200,200,{kernel:'nearest'}).png().toBuffer(),left:col*200,top:y+28});
  }
 }
 await sharp({create:{width:800,height:chunk.length*228,channels:4,background:'#d8e1e8'}}).composite(layers).png().toFile(dir+'/page-'+(start/6+1)+'.png');
}
console.log('Identity review boards: '+units.length+' characters');
