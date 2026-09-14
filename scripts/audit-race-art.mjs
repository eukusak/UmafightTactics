
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const jobs=JSON.parse(await fs.readFile(path.join(root,'docs/art-source/race-v2/jobs.json'),'utf8'));
const catalog=JSON.parse(await fs.readFile(path.join(root,'src/data/manual/race-art.json'),'utf8'));
const delivered=new Set(JSON.parse(await fs.readFile(path.join(root,'src/data/manual/delivered-art.json'),'utf8')));
assert.equal(jobs.length,89);assert.equal(jobs.reduce((n,j)=>n+j.frames,0),447);
const sha=b=>createHash('sha256').update(b).digest('hex');
const results=[];
for(const j of jobs){
  const b=await fs.readFile(path.join(root,'public/assets',j.file));
  assert.equal(sha(b),j.sha256,j.key+' SHA');
  assert(delivered.has(j.file),j.key+' delivery');
  assert.equal(catalog.find(c=>c.key===j.key)?.frames,j.frames);
  const {data,info}=await sharp(b,{failOn:'warning'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,j.w*j.cols);assert.equal(info.height,j.h*j.rows);
  let max=0,min=255;
  for(let p=3;p<data.length;p+=4){max=Math.max(max,data[p]);min=Math.min(min,data[p]);}
  assert.equal(min,0,j.key+' transparent background');assert(max>0,j.key+' visible content');
  const frameHashes=[];
  for(let i=0;i<j.frames;i++){
    const frame=await sharp(b).extract({left:(i%j.cols)*j.w,top:Math.floor(i/j.cols)*j.h,width:j.w,height:j.h}).ensureAlpha().raw().toBuffer();
    for(let x=0;x<j.w;x++) {assert.equal(frame[x*4+3],0,j.key+' top bleed');assert.equal(frame[((j.h-1)*j.w+x)*4+3],0,j.key+' bottom bleed');}
    for(let y=0;y<j.h;y++) {assert.equal(frame[y*j.w*4+3],0,j.key+' left bleed');assert.equal(frame[(y*j.w+j.w-1)*4+3],0,j.key+' right bleed');}
    frameHashes.push(sha(frame));
  }
  assert(new Set(frameHashes).size>=Math.max(1,j.frames-2),j.key+' unique animation frames');
  if(j.key.startsWith('weather_')){
    assert(b.length<=2*1024*1024,j.key+' 2MB budget');assert(max<=64,j.key+' alpha <=25%');
    const half=await fs.readFile(path.join(root,'public/assets',j.file.replace('.png','@half.png')));
    assert.equal(sha(half),j.halfSha256);assert(half.length<=2*1024*1024);
    const halfMeta=await sharp(half).metadata();assert.equal(halfMeta.width,3840);assert.equal(halfMeta.height,1620);
  }
  results.push({key:j.key,frames:j.frames,bytes:b.length,maxAlpha:max,uniqueFrames:new Set(frameHashes).size});
}
await fs.writeFile(path.join(root,'docs/art-source/race-v2/verification.json'),JSON.stringify({files:89,frames:447,totalBytes:results.reduce((n,r)=>n+r.bytes,0),assets:results},null,2)+'\n');
console.log('Race art: 89 files / 447 frames verified (plus 5 half-resolution derivatives).');
