import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { startSiegeServer } from '../../server/siege-server.js';

async function peer(port, hello) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`), inbox = [];
  socket.on('message', raw => inbox.push(JSON.parse(raw)));
  await new Promise((resolve,reject) => {socket.once('open',resolve);socket.once('error',reject);});
  let sequence = 0;
  function send(message) { socket.send(JSON.stringify(message)); }
  async function wait(predicate) { const until=Date.now()+3000; while(Date.now()<until) { const index=inbox.findIndex(predicate);if(index>=0)return inbox.splice(index,1)[0];await new Promise(r=>setTimeout(r,10)); } throw new Error('Message wait timed out: '+JSON.stringify(inbox.slice(-3))); }
  send(hello);
  return { socket, send, wait, command(playerId,type,payload={}) { const seq=++sequence;send({type:'command',sequence:seq,action:{...payload,playerId,type}});return wait(m=>m.requestId===seq); } };
}
test('authoritative server binds commands to sessions, shares spending, rejects cheats and reconnects stable IDs', async t => {
  const server=await startSiegeServer({port:0}); t.after(()=>server.close());
  const a=await peer(server.port,{type:'create',name:'A'}), joinedA=await a.wait(m=>m.type==='joined'); t.after(()=>a.socket.terminate());
  const b=await peer(server.port,{type:'join',name:'B',roomCode:joinedA.roomCode}), joinedB=await b.wait(m=>m.type==='joined');t.after(()=>b.socket.terminate());
  assert.equal((await b.command(joinedB.playerId,'select-hero',{hero:'bastion'})).ok,true);
  assert.equal((await a.command(joinedB.playerId,'move',{x:1000,y:900})).type,'error');
  assert.equal((await a.command(joinedA.playerId,'select-hero',{hero:'__proto__'})).ok,false);
  await a.command(joinedA.playerId,'ready',{ready:true}); await b.command(joinedB.playerId,'ready',{ready:true});
  assert.equal((await b.command(joinedB.playerId,'start')).ok,false);
  assert.equal((await a.command(joinedA.playerId,'start')).ok,true);
  const room=server.rooms.get(joinedA.roomCode);
  assert.equal(room.sim.state.heroes[1].kind,'bastion');
  const snapshots=await Promise.all([a.wait(m=>m.type==='snapshot'&&m.state.phase==='playing'),b.wait(m=>m.type==='snapshot'&&m.state.phase==='playing')]);
  assert.equal(snapshots[0].state.seed,snapshots[1].state.seed);
  assert.ok(!JSON.stringify(snapshots).includes(joinedA.token));
  const before=room.sim.heroOf(joinedB.playerId).x;
  await a.command(joinedA.playerId,'move',{x:780,y:820,damage:9999,scrap:999999});
  await new Promise(r=>setTimeout(r,150));assert.equal(room.sim.heroOf(joinedB.playerId).x,before);assert.equal(room.sim.state.scrap,420);
  const spends=await Promise.all([a.command(joinedA.playerId,'build',{padId:'west',fortification:'repeater'}),b.command(joinedB.playerId,'build',{padId:'west',fortification:'repeater'})]);
  assert.equal(spends.filter(r=>r.ok).length,1);assert.equal(room.sim.state.scrap,120);assert.equal(room.sim.state.towers.length,1);
  assert.equal((await a.command(joinedA.playerId,'pause')).ok,false);assert.equal((await a.command(joinedA.playerId,'speed',{speed:2})).ok,false);
  const bad=await peer(server.port,{type:'resume',roomCode:joinedA.roomCode,token:'wrong'});t.after(()=>bad.socket.terminate());assert.match((await bad.wait(m=>m.type==='error')).reason,/expired/);
  a.socket.close();await new Promise(r=>setTimeout(r,50));assert.equal(room.sim.state.players[0].connected,false);assert.equal(room.sim.state.hostId,joinedB.playerId);
  const resumed=await peer(server.port,{type:'resume',roomCode:joinedA.roomCode,token:joinedA.token});t.after(()=>resumed.socket.terminate());assert.equal((await resumed.wait(m=>m.type==='joined')).playerId,joinedA.playerId);assert.equal(room.sim.state.players[0].connected,true);
});
