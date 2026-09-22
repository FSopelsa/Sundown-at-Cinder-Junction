import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { createSiegeSimulation } from '../src/game/siege/simulation.js';

// Session secrets remain transport-only. They are never broadcast in game state.
export async function startSiegeServer({ port = 8787, host = '127.0.0.1', tickMs = 50, roomTtlMs = 300000 } = {}) {
  const rooms = new Map();
  const http = createServer((req, res) => {
    res.writeHead(req.url === '/health' ? 200 : 404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ service: 'cinder-siege', rooms: rooms.size }));
  });
  const sockets = new WebSocketServer({ server: http, maxPayload: 4096, perMessageDeflate: false });
  const send = (socket, message) => { if (socket.readyState === WebSocket.OPEN && socket.bufferedAmount < 1024 * 1024) socket.send(JSON.stringify(message)); };
  function broadcast(room) { const snapshot = { type: 'snapshot', roomCode: room.code, state: room.sim.snapshot() }; for (const session of room.sessions.values()) if (session.socket) send(session.socket, snapshot); }
  function fail(socket, reason, requestId) { send(socket, { type: 'error', reason, requestId }); }
  sockets.on('connection', socket => {
    socket.isAlive = true;
    socket.on('pong', () => { socket.isAlive = true; });
    let binding = null, budget = 0, budgetAt = Date.now(), lastSequence = -1;
    socket.on('error', () => {});
    socket.on('message', raw => {
      if (Date.now() - budgetAt > 1000) { budgetAt = Date.now(); budget = 0; }
      if (++budget > 35) { fail(socket, 'Too many commands.'); return; }
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { fail(socket, 'Invalid message.'); return; }
      if (!msg || typeof msg !== 'object') return fail(socket, 'Invalid message.');
      if (msg.type === 'create' || msg.type === 'join' || msg.type === 'resume') {
        if (binding) return fail(socket, 'Already in a room.');
        let room;
        if (msg.type === 'create') {
          if (rooms.size >= 32) return fail(socket, 'The local server is full.');
          let code; do { code = randomBytes(3).toString('hex').slice(0, 5).toUpperCase(); } while (rooms.has(code));
          room = { code, sim: createSiegeSimulation({ networked: true, seed: randomBytes(4).readUInt32LE() }), sessions: new Map(), emptySince: null, lastBroadcast: 0 };
          rooms.set(code, room);
        } else room = rooms.get(String(msg.roomCode ?? '').trim().toUpperCase());
        if (!room) return fail(socket, 'Room not found. Check the code.');
        let session = msg.type === 'resume' && typeof msg.token === 'string' ? room.sessions.get(msg.token) : null;
        if (msg.type === 'resume' && !session) return fail(socket, 'This reconnect session has expired.');
        if (session) {
          if (session.socket?.readyState === WebSocket.OPEN) return fail(socket, 'That session is already connected.');
          session.socket = socket; room.sim.setConnected(session.playerId, true);
        } else {
          const playerId = randomUUID();
          const result = room.sim.addPlayer(playerId, typeof msg.name === 'string' ? msg.name : 'Marshal');
          if (!result.ok) return fail(socket, room.sim.state.phase === 'lobby' ? 'This room has four players.' : 'This siege has already started.');
          session = { playerId, token: randomBytes(24).toString('hex'), socket };
          room.sessions.set(session.token, session);
        }
        binding = { room, session }; room.emptySince = null;
        send(socket, { type: 'joined', roomCode: room.code, playerId: session.playerId, token: session.token });
        broadcast(room); return;
      }
      if (!binding) return fail(socket, 'Join a room first.');
      const { room, session } = binding;
      if (msg.type === 'command') {
        if (!Number.isSafeInteger(msg.sequence) || msg.sequence <= lastSequence) return fail(socket, 'Duplicate or invalid command sequence.', msg.sequence);
        lastSequence = msg.sequence;
        if (msg.action?.playerId !== session.playerId) return fail(socket, 'You can only control your own hero.', msg.sequence);
        const result = room.sim.dispatch(msg.action);
        send(socket, { type: 'result', requestId: msg.sequence, ...result });
        broadcast(room);
      } else if (msg.type === 'leave') { room.sim.removePlayer(session.playerId); room.sessions.delete(session.token); binding = null; broadcast(room); socket.close(1000, 'Left room'); }
      else fail(socket, 'Unknown message.');
    });
    socket.on('close', () => {
      if (!binding) return;
      const { room, session } = binding;
      if (session.socket !== socket) return;
      session.socket = null; room.sim.setConnected(session.playerId, false);
      session.disconnectedAt = Date.now(); broadcast(room);
    });
  });
  let previous = performance.now();
  const heartbeat = setInterval(() => { for (const socket of sockets.clients) { if (!socket.isAlive) socket.terminate(); else { socket.isAlive = false; socket.ping(); } } }, 15000);
  const timer = setInterval(() => {
    const now = performance.now(), elapsed = Math.min(250, now - previous); previous = now;
    for (const [code, room] of rooms) {
      const connected = [...room.sessions.values()].some(session => session.socket?.readyState === WebSocket.OPEN);
      if (!connected) room.emptySince ??= Date.now(); else room.emptySince = null;
      if (room.emptySince && Date.now() - room.emptySince > roomTtlMs) { rooms.delete(code); continue; }
      if (room.sim.state.phase === 'lobby') for (const [token, session] of room.sessions) if (!session.socket && Date.now() - session.disconnectedAt > 60000) { room.sim.removePlayer(session.playerId); room.sessions.delete(token); }
      // No client-controlled speed or pause. An empty room continues for the reconnect grace period.
      room.sim.update(elapsed);
      if (now - room.lastBroadcast >= 100) { broadcast(room); room.lastBroadcast = now; }
    }
  }, tickMs);
  await new Promise((resolve, reject) => { http.once('error', reject); http.listen(port, host, resolve); });
  return { port: http.address().port, rooms, async close() { clearInterval(timer); clearInterval(heartbeat); for (const socket of sockets.clients) socket.terminate(); await new Promise(resolve => sockets.close(resolve)); await new Promise(resolve => http.close(resolve)); } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = await startSiegeServer({ port: Number(process.env.PORT || 8787), host: process.env.HOST || '127.0.0.1' });
  console.log(`Cinder Siege server ready at ws://${process.env.HOST || '127.0.0.1'}:${server.port}`);
  const close = async () => { await server.close(); process.exit(0); };
  process.once('SIGINT', close); process.once('SIGTERM', close);
}
