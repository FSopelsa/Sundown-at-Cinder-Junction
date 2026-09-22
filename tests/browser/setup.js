import { preview, createServer } from 'vite';
import { startSiegeServer } from '../../server/siege-server.js';
import { createServer as createHttpServer } from 'node:http';

// Own servers in this process so Windows teardown does not depend on taskkill
// enumerating a shell/npm descendant tree (which can hang in restricted hosts).
export default async function setup() {
  const production = await preview({ preview: { host: '127.0.0.1', port: 4173, strictPort: true } });
  // preview sets NODE_ENV=production. Resolve the separate development server
  // under its own development environment so DEV-only diagnostics stay opt-in.
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  const development = await createServer({ server: { host: '127.0.0.1', port: 4174, strictPort: true, hmr: false, watch: null }, clearScreen: false });
  process.env.NODE_ENV = previousNodeEnv;
  await development.listen();
  const siege = await startSiegeServer({ port: 8788 });
  // Test runner clock only: never imported by the production game/server.
  // Advances real simulation ticks without changing HP, rewards or outcomes.
  const clock = createHttpServer((req,res) => {
    const url = new URL(req.url,'http://127.0.0.1');
    const room=siege.rooms.get(url.searchParams.get('room'));
    if(req.method!=='POST'||url.pathname!=='/advance'||!room){res.writeHead(404);res.end();return;}
    const seconds=Math.min(1300,Math.max(0,Number(url.searchParams.get('seconds'))||0));
    for(let i=0;i<seconds&&room.sim.state.phase==='playing';i++)room.sim.update(1000);
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({phase:room.sim.state.phase,timeMs:room.sim.state.timeMs}));
  });
  await new Promise(resolve=>clock.listen(8789,'127.0.0.1',resolve));
  return async () => { clock.closeAllConnections(); await new Promise(resolve=>clock.close(resolve)); await siege.close(); await development.close(); production.httpServer.closeAllConnections(); await new Promise(resolve => production.httpServer.close(resolve)); };
}
