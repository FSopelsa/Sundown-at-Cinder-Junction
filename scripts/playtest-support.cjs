const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function clickWorld(x,y,move=false){const p=await page.evaluate(({x,y})=>{const scene=window.__cinder.game.scene.getScene('battle'),c=scene.cameras.main,p=scene.projection.project(x,y);return {x:(p.x-c.scrollX-640)*c.zoom+640,y:(p.y-c.scrollY-360)*c.zoom+360};},{x,y});const r=await page.locator('canvas').boundingBox();await page.mouse[move ? 'move' : 'click'](r.x+p.x*r.width/1280,r.y+p.y*r.height/720);}
 for(const level of ['cinder-switchyard','cinder-maze','cinder-overlook']){
 await page.goto('http://127.0.0.1:5175/?debug&level='+level);await page.waitForFunction(()=>window.__cinder?.game.scene.isActive('battle'));
 const pos=await page.evaluate(()=>{const s=window.__cinder.simulation;s.state.scrap=5000;return s.map.grid?{x:s.map.grid.x+6.5*40,y:s.map.grid.y+3.5*40}:{x:400,y:350};});
 await page.locator('[data-tower-type="wall"]').click();await clickWorld(pos.x,pos.y);await clickWorld(pos.x,pos.y);await page.locator('[data-ladder]').click();
 assert.equal(await page.evaluate(()=>window.__cinder.simulation.state.towers[0].ladder),true);
 await page.locator('[data-action="back-build"]').click();await page.locator('[data-tower-type="scrapExchange"]').click();await clickWorld(pos.x,pos.y);await clickWorld(pos.x,pos.y);
 await page.locator('[data-support="aura"]').click();await page.locator('[data-support="xp"]').click();
 assert.equal(await page.evaluate(()=>window.__cinder.simulation.state.hero.level),2);
 await page.evaluate(()=>window.__cinder.simulation.systems.heroSystem.takeDamage(99999));await page.locator('[data-support="buyback"]').click();assert.equal(await page.evaluate(()=>window.__cinder.simulation.state.hero.alive),true);
 await page.locator('[data-camera="reset"]').click();await page.waitForTimeout(100);
 const hero=await page.evaluate(()=>window.__cinder.simulation.state.hero);await clickWorld(hero.x,hero.y,true);await page.mouse.wheel(0,-180);await page.waitForTimeout(150);await clickWorld(hero.x,hero.y);assert.equal(await page.evaluate(()=>window.__cinder.hud.inputMode),'move');
 const old=await page.evaluate(()=>window.__cinder.game.scene.getScene('battle').cameras.main.scrollX);
 const r=await page.locator('canvas').boundingBox();await page.mouse.move(r.x+r.width*.6,r.y+r.height*.45);await page.mouse.down({button:'right'});await page.mouse.move(r.x+r.width*.65,r.y+r.height*.45,{steps:8});await page.mouse.up({button:'right'});
 const now=await page.evaluate(()=>window.__cinder.game.scene.getScene('battle').cameras.main.scrollX);assert.ok(Math.abs(now-old)>10);
 await page.keyboard.press('ArrowRight');await page.screenshot({path:'artifacts/playtest/support-'+level+'.png'});
 await page.locator('[data-camera="reset"]').click();await page.waitForTimeout(100);await clickWorld(pos.x,pos.y);assert.equal(await page.locator('[data-hud="tower-name"]').textContent(),'Scrap Exchange');
 await page.screenshot({path:'artifacts/playtest/shop-'+level+'.png'});
 }
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await page.screenshot({path:'artifacts/playtest/shop-mobile.png',fullPage:true});
 const hp=await page.locator('.hero-panel').boundingBox(), shop=await page.locator('.build-palette').boundingBox();assert.ok(shop.y>=hp.y+hp.height);
 await page.locator('[data-support="xp"]').scrollIntoViewIfNeeded();await page.locator('[data-support="xp"]').click();
 assert.deepEqual(errors,[]);console.log('All maps: ladder, Exchange purchases/buyback, hero clicking at zoom, drag camera, shop inspection passed.',errors);await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
