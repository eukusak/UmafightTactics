import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ['--no-sandbox','--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.addInitScript(() => {
    window.__loadingMetrics = { lcp: 0, longTasks: [] };
    new PerformanceObserver(list => { for (const e of list.getEntries()) window.__loadingMetrics.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(list => { for (const e of list.getEntries()) window.__loadingMetrics.longTasks.push(e.duration); }).observe({ type: 'longtask', buffered: true });
  });
  const cdp = await page.context().newCDPSession(page); await cdp.send('Performance.enable');
  await page.goto(process.env.PROFILE_BASE_URL || 'http://127.0.0.1:4173/', { waitUntil: 'networkidle' }); await page.evaluate(() => document.fonts.ready);
  const title = await page.evaluate(() => ({ ...window.__loadingMetrics, resources: performance.getEntriesByType('resource').map(e => ({ name: new URL(e.name).pathname, transferred: e.transferSize, decoded: e.decodedBodySize })) }));
  const titleCPU = (await cdp.send('Performance.getMetrics')).metrics.filter(m => ['ScriptDuration','TaskDuration','JSHeapUsedSize'].includes(m.name));
  await page.getByRole('button',{name:'시작하기'}).click();
  const start = performance.now(); await page.getByRole('button',{name:/도감/}).click(); await page.locator('.collection-card').first().waitFor();
  const collectionMs = performance.now() - start;
  const loadedPortraits = await page.locator('.collection-card img').evaluateAll(images=>images.filter(i=>i.naturalWidth>0).length);
  await page.getByRole('button',{name:'돌아가기'}).click();
  const cycles = [];
  for (let i=0;i<10;i++) {
    await page.getByRole('button',{name:/모션/}).click();
    await page.getByText('프레임 애니메이션 · 6종 모션 · 24개 원화',{exact:true}).waitFor();
    if (await page.locator('canvas').count()!==1) throw new Error('Unexpected active canvas count');
    await page.getByRole('button',{name:'돌아가기'}).click();
    await page.waitForFunction(()=>document.querySelectorAll('canvas').length===0);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await cdp.send('HeapProfiler.collectGarbage');
    await cdp.send('HeapProfiler.collectGarbage');
    const heap = (await cdp.send('Performance.getMetrics')).metrics.find(m=>m.name==='JSHeapUsedSize').value;
    cycles.push({ cycle:i+1, heapBytes:heap, ...(await cdp.send('Memory.getDOMCounters')) });
  }
  await writeFile('docs/performance/pr22-client-profile.json',JSON.stringify({ environment:'Local Chromium, cold context. Diagnostic snapshot; CPU and timings depend on concurrent PC workload, not a before/after latency benchmark.', title, titleCPU, collectionMs, loadedPortraitsAtFirstPaint:loadedPortraits, motionMountUnmountCycles:cycles },null,2));
  console.log(JSON.stringify({lcp:title.lcp,titleCPU,collectionMs,loadedPortraitsAtFirstPaint:loadedPortraits,cycles}));
} finally { await browser.close(); }
