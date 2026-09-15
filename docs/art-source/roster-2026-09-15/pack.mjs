import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const here=path.join(root,'docs/art-source/roster-2026-09-15');
const sha=b=>createHash('sha256').update(b).digest('hex');
// IMAGEGEN draws the art and isolates it on a matte; this pass only keys and packs it.
async function keyed(file){
 const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let p=0;p<data.length;p+=4){const r=data[p],g=data[p+1],b=data[p+2],d=g-Math.max(r,b);
  if(d>16){const a=Math.max(0,Math.min(1,1-(d-16)/140));data[p+3]=Math.round(data[p+3]*a);data[p+1]=Math.min(g,Math.max(r,b));}
 }
 return {data,info};
}
// Each source cell belongs to one character. Discard disconnected spill from a neighbour.
function isolate(data,w,h){const seen=new Uint8Array(w*h);let largest=[];for(let at=0;at<w*h;at++){if(seen[at]||data[at*4+3]<20)continue;const queue=[at];seen[at]=1;for(let k=0;k<queue.length;k++){const p=queue[k],x=p%w,y=Math.floor(p/w);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){const xx=x+dx,yy=y+dy,q=yy*w+xx;if(xx>=0&&xx<w&&yy>=0&&yy<h&&!seen[q]&&data[q*4+3]>=20){seen[q]=1;queue.push(q);}}}if(queue.length>largest.length)largest=queue;}const keep=new Uint8Array(w*h);for(const p of largest)keep[p]=1;for(let p=0;p<w*h;p++)if(!keep[p])data[p*4+3]=0;}
function bounds(data,w,h){let l=w,t=h,r=-1,b=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>20){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
 if(r<0)throw Error('empty frame');return{left:l,top:t,width:r-l+1,height:b-t+1};}
const bands={deep_impact:[0,265,509,760,1007,1240,1536],soccer_boy:[0,254,491,751,985,1232,1536],kurofune:[0,263,510,772,1033,1258,1536]};
const results=[];
for(const [id,ys] of Object.entries(bands)){
 const source=path.join(here,'originals',id+'-matte.png');const {data,info}=await keyed(source);
 if(info.width!==1024||info.height!==1536)throw Error('source layout changed');
 const clean=await sharp(data,{raw:info}).png().toBuffer();const cells=[];
 for(let i=0;i<24;i++){const row=Math.floor(i/4);const {data:c,info:ci}=await sharp(clean).extract({left:i%4*256,top:ys[row],width:256,height:ys[row+1]-ys[row]}).raw().toBuffer({resolveWithObject:true});isolate(c,ci.width,ci.height);const box=bounds(c,ci.width,ci.height);cells.push({c,ci,box});}
 const idleH=cells.slice(0,4).map(c=>c.box.height).sort((a,b)=>a-b)[2];
 // One scale for all24poses: crouching and KO cannot enlarge the head.
 const scale=Math.min(96/idleH,114/Math.max(...cells.map(c=>c.box.width)),100/Math.max(...cells.map(c=>c.box.height)));
 const composite=[];const frames=[];
 for(let i=0;i<24;i++){const {c,ci,box}=cells[i];const w=Math.round(box.width*scale),h=Math.round(box.height*scale);
  const body=await sharp(c,{raw:ci}).extract(box).resize(w,h).png().toBuffer();
  let sum=0,n=0;for(let y=Math.max(box.top,box.top+box.height-7);y<box.top+box.height;y++)for(let x=box.left;x<box.left+box.width;x++)if(c[(y*ci.width+x)*4+3]>180){sum+=x;n++;}
  const footX=n?sum/n:box.left+box.width/2;let left=Math.round(64-(footX-box.left)*scale);left=Math.max(6,Math.min(122-w,left));
  const top=110-h-(i===6?3:0);composite.push({input:body,left:i%4*128+left,top:Math.floor(i/4)*128+top});
  frames.push({frame:i,sourceBounds:box,scale,output:{left,top,width:w,height:h},groundY:i===6?107:110});
 }
 const dest='motions/'+id+'.png';await sharp({create:{width:512,height:768,channels:4,background:'#00000000'}}).composite(composite).png().toFile(path.join(root,'public/assets',dest));
 results.push({id,file:dest,source:path.relative(root,source).replaceAll('\\','/'),sourceSha256:sha(await fs.readFile(source)),sha256:sha(await fs.readFile(path.join(root,'public/assets',dest))),frames});
 const portraitSource=path.join(here,'originals',id+'-portrait.png');const {data:pd,info:pi}=await keyed(portraitSource);const box=bounds(pd,pi.width,pi.height);
 const portrait=await sharp(pd,{raw:pi}).extract(box).resize(240,240,{fit:'contain',background:'#00000000'}).png().toBuffer();
 const portraitDest='portraits/'+id+'.png';await sharp({create:{width:256,height:256,channels:4,background:'#00000000'}}).composite([{input:portrait,left:8,top:16}]).png().toFile(path.join(root,'public/assets',portraitDest));
 results.push({id,file:portraitDest,sourceSha256:sha(await fs.readFile(portraitSource)),sha256:sha(await fs.readFile(path.join(root,'public/assets',portraitDest)))});
}
const cs=path.join(here,'originals/deep_impact-cutin.png');const dest=path.join(root,'public/assets/characters/cutin/deep_impact.png');const {data:cut,info:cutInfo}=await sharp(cs).resize(960,540,{fit:'contain',background:'#00000000'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});for(let y=0;y<540;y++)for(let x=0;x<75;x++)cut[(y*960+x)*4+3]=0;const cutPng=await sharp(cut,{raw:cutInfo}).png().toBuffer();await fs.writeFile(dest,cutPng);await fs.writeFile(path.join(here,'deep_impact-cutin-layout.png'),cutPng);results.push({id:'deep_impact',file:'characters/cutin/deep_impact.png',sourceSha256:sha(await fs.readFile(cs)),sha256:sha(await fs.readFile(dest))});
await fs.writeFile(path.join(here,'packing.json'),JSON.stringify({generator:'built-in IMAGEGEN',matte:'IMAGEGEN isolated #00FF00; deterministic green key and despill',results},null,2)+'\n');
console.log('Packed 3 RGBA motion atlases /72frames,3portraits,1cutin.');
