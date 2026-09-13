import { cp, mkdtemp, mkdir, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
const directory = await mkdtemp(path.join(tmpdir(), 'uft-server-only-'));
for (const dir of ['src','server']) await cp(dir, path.join(directory,dir), { recursive: true });
await mkdir(path.join(directory,'scripts'));
for (const file of ['package.json','package-lock.json','scripts/runtime.mjs']) await cp(file,path.join(directory,file));
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run with npm run test:server-install');
await new Promise((resolve,reject)=>{ const child=spawn(process.execPath,[npm,'ci','--omit=dev','--no-audit','--no-fund'],{cwd:directory,stdio:'inherit',windowsHide:true});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Production npm ci failed'))); });
for (const missing of ['dist','public','node_modules/vite','node_modules/ffmpeg-static']) {
  if (await access(path.join(directory,missing)).then(()=>true,()=>false)) throw new Error(missing+' unexpectedly installed');
}
const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
const server=spawn(process.execPath,['--import','tsx','server/index.ts'],{cwd:directory,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'production',ALLOWED_ORIGINS:'https://test.example',ROOM_STATE_FILE:''},stdio:['ignore','pipe','pipe'],windowsHide:true});
let logs='';server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);const exited=once(server,'exit');
try{
  const end=Date.now()+15000;
  while(!logs.includes('server ready')){ if(server.exitCode!==null||Date.now()>end)throw new Error(logs);await new Promise(r=>setTimeout(r,50)); }
  const health=await fetch('http://127.0.0.1:'+port+'/health');if(health.status!==200)throw new Error('Health failed');
  const data=await health.json();if(data.service!=='multiplayer')throw new Error('Wrong service');
  console.log('Server-only production npm ci: PASS (no dist/public/Vite/FFmpeg)');
}finally{server.kill('SIGTERM');await exited;}
// Temporary installation intentionally retained for inspection; OS temp cleanup can remove it.
