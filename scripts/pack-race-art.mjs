
/** Repack genuine imagegen sources; no drawing or synthesized motion frames. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'docs/art-source/race-v2/jobs.json');
const jobs = JSON.parse(await fs.readFile(file, 'utf8'));
const hash = b => createHash('sha256').update(b).digest('hex');
const order = {
  dive_trail_senko: [0,2,4,6,8,1,3,5,7,9],
  dive_trail_oikomi: [0,2,4,6,8,1,3,5,7,9],
  phase_banner_late: [0,2,4,6,8,10,1,3,5,7,9,11],
};
const selected=new Set(process.argv.slice(2));
for (const j of jobs) {
  if(selected.size && !selected.has(j.key)) continue;
  if (j.status !== 'generated') throw new Error('Missing imagegen source: ' + j.key);
  const source = await fs.readFile(path.join(root, j.source));
  if (hash(source) !== j.sourceSha256) throw new Error('Source hash mismatch: ' + j.key);
  const meta = await sharp(source).metadata();
  if (!meta.hasAlpha) throw new Error('Opaque source: ' + j.key);
  const weather = j.key.startsWith('weather_');
  const frames = [];
  for (let i = 0; i < j.frames; i++) {
    const n = order[j.key]?.[i] ?? i;
    const x = Math.round((n % j.sourceCols) * meta.width / j.sourceCols);
    const y = Math.round(Math.floor(n / j.sourceCols) * meta.height / j.sourceRows);
    const right = Math.round(((n % j.sourceCols) + 1) * meta.width / j.sourceCols);
    const bottom = Math.round((Math.floor(n / j.sourceCols) + 1) * meta.height / j.sourceRows);
    let crop = sharp(await sharp(source).extract({ left:x, top:y, width:right-x, height:bottom-y }).png().toBuffer());
    if (j.frames === 1) crop = crop.trim({ threshold: 12 });
    const inset = j.frames === 1 ? 0.94 : 0.92;
    const w = Math.max(1,Math.round(j.w*inset)), h = Math.max(1,Math.round(j.h*inset));
    const raw = await crop.resize(w,h,{fit:'fill'}).ensureAlpha().raw().toBuffer();
    const envelope = j.key.startsWith('hit_physical_') ? [0,.2,.4,.7,1,.9,.65,.4,.2,.02][i]
      : j.key.startsWith('phase_banner_') ? [0,.25,.6,.9,1,1,1,1,.8,.5,.2,0][i] : 1;
    const alpha = weather ? .23 : j.key.startsWith('style_aura_') && j.key.endsWith('_down') ? .45 : envelope;
    for (let p=0;p<raw.length;p+=4) {
      const px=(p/4)%w, py=Math.floor(p/4/w);
      const edge=j.frames>1?Math.min(1,px/Math.max(1,w*.025),(w-1-px)/Math.max(1,w*.025),py/Math.max(1,h*.025),(h-1-py)/Math.max(1,h*.025)):1;
      raw[p+3] = Math.round(raw[p+3]*alpha*Math.max(0,edge));
      if (j.key.startsWith('cond_') || j.key.startsWith('course_')) raw[p]=raw[p+1]=raw[p+2]=255;
    }
    const image = await sharp(raw,{raw:{width:w,height:h,channels:4}}).png().toBuffer();
    frames.push({ input:image, left:(i%j.cols)*j.w+Math.floor((j.w-w)/2), top:Math.floor(i/j.cols)*j.h+Math.floor((j.h-h)/2) });
  }
  const packed = await sharp({create:{width:j.w*j.cols,height:j.h*j.rows,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(frames).png().toBuffer();
  let output = await sharp(packed).png({compressionLevel:9,...(weather?{palette:true,colours:64,dither:0}: {})}).toBuffer();
  if (weather && output.length > 2*1024*1024) output = await sharp(packed).png({compressionLevel:9,palette:true,colours:32,dither:0}).toBuffer();
  if (weather && output.length > 2*1024*1024) throw new Error('Weather budget exceeded: '+j.key);
  await fs.writeFile(path.join(root,'public/assets',j.file), output);
  if (weather) {
    const half = await sharp(packed).resize(j.w*j.cols/2,j.h*j.rows/2).png({compressionLevel:9,palette:true,colours:64,dither:0}).toBuffer();
    await fs.writeFile(path.join(root,'public/assets',j.file.replace('.png','@half.png')),half);
    j.halfSha256=hash(half); j.halfBytes=half.length;
  }
  j.sha256=hash(output); j.bytes=output.length;
  j.postprocess={sourceOrder:order[j.key]??'row-major',inset:j.frames===1?.94:.92,monochrome:/^(cond_|course_)/.test(j.key),weatherAlphaCap:weather?.23:undefined};
  console.log(j.key+': '+output.length+' bytes');
}
await fs.writeFile(file,JSON.stringify(jobs,null,2)+'\n');
const deliveredPath=path.join(root,'src/data/manual/delivered-art.json');
const delivered=JSON.parse(await fs.readFile(deliveredPath,'utf8'));
await fs.writeFile(deliveredPath,JSON.stringify([...new Set([...delivered,...jobs.flatMap(j=>j.key.startsWith('weather_')?[j.file,j.file.replace('.png','@half.png')]:[j.file])])].sort(),null,2)+'\n');
