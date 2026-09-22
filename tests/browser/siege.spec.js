import { test, expect } from '@playwright/test';

const dev = 'http://127.0.0.1:4174/?debug';
async function point(page,x,y) { return page.evaluate(([x,y])=>window.__siege.screenPoint(x,y),[x,y]); }
async function state(page) { return page.evaluate(()=>window.__siege.client.state); }

test('default production siege boots, hero selection works, and the compact layout fits', async({page},info)=>{
  const errors=[],modelRequests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',request=>{if(request.url().includes('/assets/models/'))modelRequests.push(request.url());});
  await page.setViewportSize({width:1440,height:900});await page.goto('/');
  await expect(page.getByRole('heading',{name:'THE LAST DEPARTURE.'})).toBeVisible();
  await page.waitForTimeout(1500);
  expect(modelRequests.some(url => /cinder-(arrival-yard|relay-hall|prototype-units|zip-bag)\.glb/.test(url))).toBe(false);
  await page.screenshot({path:info.outputPath('01-departure.png')});
  await page.locator('[data-hero="bastion"]').click();await expect(page.locator('[data-siege="kit"]')).toContainText('Iron heart');
  await page.getByRole('button',{name:'Deploy solo'}).click();
  await expect(page.locator('[data-siege="hero-name"]')).toHaveText('Bastion');
  await page.getByRole('button',{name:'Cinder Pulse',exact:true}).click();
  await expect(page.locator('[data-ability="cinder-pulse"]')).toBeDisabled();
  await page.screenshot({path:info.outputPath('02-bastion-deployed.png')});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:info.outputPath('03-mobile.png')});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Inventory / I'}).click();await expect(page.locator('.siege-drawer')).toBeVisible();
  await page.getByRole('button',{name:'Close panel'}).click();
  expect(errors).toEqual([]);
});

test('full solo critical path: real pointer actions, equipment, capacitor, foundry, boss and saved victory', async({page},info)=>{
  test.setTimeout(120000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:900});await page.goto(dev);await page.waitForFunction(()=>window.__siege);
  await page.getByRole('button',{name:'Deploy solo'}).click();
  await page.getByRole('button',{name:'Inventory / I'}).click();await page.locator('[data-buy="arc-coil"]').click();await page.getByRole('button',{name:'Close panel'}).click();
  await page.keyboard.press('2');await expect(page.locator('[data-slot="1"]')).toHaveClass(/is-equipped/);
  const before=(await state(page)).heroes[0];const target=await point(page,780,860);await page.mouse.click(target.x,target.y);
  await expect.poll(async()=>Math.hypot((await state(page)).heroes[0].x-before.x,(await state(page)).heroes[0].y-before.y)).toBeGreaterThan(25);
  await page.locator('[data-do="build"]').click();await page.locator('[data-pad="west"]').click();await page.getByRole('button',{name:'Build Rail repeater'}).click();
  await expect.poll(async()=>(await state(page)).towers.length).toBe(1);
  await page.keyboard.press('q');const cast=await point(page,800,800);await page.mouse.click(cast.x,cast.y);
  await expect.poll(async()=>(await state(page)).fields.length).toBe(1);
  await page.screenshot({path:info.outputPath('04-gravity-and-construction.png')});
  // Real rules and legal actions, accelerated wall time. Draw between stages so
  // rendering, HUD changes and transitions are verified in the actual browser.
  for(const until of [60000,300000,420000,905000,1100000]) {
    await page.evaluate(async until=>{const {pilotSiege}=await import('/tests/helpers/siegePilot.js');const {client}=window.__siege;while(client.state.timeMs<until&&client.state.phase==='playing'){pilotSiege(client.sim,client.playerId);client.sim.update(1000);}},until);
    await page.waitForTimeout(180);
    if(until===60000||until===420000||until===905000)await page.screenshot({path:info.outputPath(`stage-${until}.png`)});
  }
  const result=await state(page);expect(result.event.status).toBe('secured');expect(result.foundry.destroyed).toBe(true);expect(result.phase).toBe('victory');expect(result.timeMs).toBeGreaterThanOrEqual(900000);
  await expect(page.getByRole('heading',{name:'THE JUNCTION STANDS.'})).toBeVisible();await page.screenshot({path:info.outputPath('05-solo-victory.png')});
  await page.evaluate(()=>window.__siege.client.save());await page.reload();await page.getByRole('button',{name:'Resume solo'}).click();await expect(page.getByRole('heading',{name:'THE JUNCTION STANDS.'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('two live clients share a room, different heroes, independent control, atomic Scrap, reconnect and one authoritative defeat', async({browser,request},info)=>{
  test.setTimeout(120000);
  const a=await browser.newContext({viewport:{width:1280,height:800}}),b=await browser.newContext({viewport:{width:1280,height:800}});
  try {
    const left=await a.newPage(),right=await b.newPage(),errors=[];for(const p of [left,right])p.on('pageerror',e=>errors.push(e.message));
    for(const p of [left,right]) {await p.goto(dev);await p.waitForFunction(()=>window.__siege);await p.locator('.siege-network summary').click();await p.getByRole('textbox',{name:'Server address'}).fill('ws://127.0.0.1:8788');}
    await left.getByRole('textbox',{name:'Callsign',exact:true}).fill('Ash');await left.getByRole('button',{name:'Create room'}).click();await expect(left.locator('.siege-room-code')).toBeVisible();const code=await left.locator('.siege-room-code').textContent();
    await right.getByRole('textbox',{name:'Callsign',exact:true}).fill('Rail');await right.getByRole('textbox',{name:'Room code',exact:true}).fill(code);await right.getByRole('button',{name:'Join room',exact:true}).click();await expect(right.locator('.siege-room-code')).toHaveText(code);
    await right.locator('[data-hero="bastion"]').click();
    for(const p of [left,right])await p.getByRole('button',{name:'Ready',exact:true}).click();
    await left.getByRole('button',{name:'Launch siege'}).click();for(const p of [left,right])await expect(p.locator('[data-siege="wave"]')).toContainText('INCOMING');
    const before=await state(right);expect(before.heroes.map(h=>h.kind)).toEqual(['singularity','bastion']);
    const localId=await left.evaluate(()=>window.__siege.client.playerId),remoteId=await right.evaluate(()=>window.__siege.client.playerId);
    const move=await point(left,780,830);await left.mouse.click(move.x,move.y);await expect.poll(async()=>(await state(left)).heroes.find(h=>h.playerId===localId).x).toBeLessThan(810);
    expect((await state(right)).heroes.find(h=>h.playerId===remoteId).x).toBe(before.heroes[1].x);
    // Forging another player's identity is rejected at the WebSocket boundary.
    await left.evaluate(remoteId=>{const c=window.__siege.client;c.socket.send(JSON.stringify({type:'command',sequence:++c.sequence,action:{type:'move',playerId:remoteId,x:1700,y:700}}));},remoteId);
    await expect(left.locator('[data-siege="notice"]')).toContainText('only control your own');
    for(const p of [left,right]) {await p.locator('[data-do="build"]').click();await p.locator('[data-pad="west"]').click();}
    await Promise.all([left.getByRole('button',{name:'Build Rail repeater'}).click(),right.getByRole('button',{name:'Build Rail repeater'}).click()]);
    for(const p of [left,right]) {await expect.poll(async()=>(await state(p)).towers.length).toBe(1);expect((await state(p)).scrap).toBe(120);}
    await right.keyboard.press('Escape');await right.keyboard.press('p');await expect(right.locator('[data-siege="notice"]')).toContainText('real time');
    await left.evaluate(()=>window.__siege.client.disconnect());await expect.poll(async()=>(await state(right)).players.find(p=>p.id===localId).connected).toBe(false);
    await left.evaluate(()=>window.__siege.client.reconnect());await expect.poll(()=>left.evaluate(()=>window.__siege.client.connected)).toBe(true);expect(await left.evaluate(()=>window.__siege.client.playerId)).toBe(localId);
    await request.post(`http://127.0.0.1:8789/advance?room=${code}&seconds=22`);
    for(const p of [left,right])await expect(p.locator('[data-siege="wave"]')).toContainText('ASSAULT 1 / 10');
    await left.screenshot({path:info.outputPath('06-coop-left.png')});await right.screenshot({path:info.outputPath('07-coop-right.png')});
    await request.post(`http://127.0.0.1:8789/advance?room=${code}&seconds=1300`);
    for(const p of [left,right])await expect(p.getByRole('heading',{name:'THE RAIL GOES DARK.'})).toBeVisible();
    expect((await state(left)).summary).toEqual((await state(right)).summary);
    expect(errors).toEqual([]);
  } finally {await a.close();await b.close();}
});
