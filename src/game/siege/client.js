import { createSiegeSimulation } from './simulation.js';

export const SIEGE_SAVE_KEY = 'cinder.siege.v1';
export class SiegeClient {
  constructor(onChange = () => {}) { this.onChange = onChange; this.sim = createSiegeSimulation(); this.playerId = null; this.roomCode = null; this.status = ''; this.sequence = 0; this.connected = false; this.networked = false; this.saveMs = 0; this.disposed = false; }
  get state() { return this.networked ? this.remoteState ?? this.sim.state : this.sim.state; }
  solo(resume = false) {
    this.disconnect();
    let snapshot;
    try { if (resume) snapshot = JSON.parse(localStorage.getItem(SIEGE_SAVE_KEY)); } catch { this.status = 'The saved siege could not be read.'; }
    try { this.sim = createSiegeSimulation(snapshot ?? {}); } catch { this.sim = createSiegeSimulation(); this.status = 'Unsupported save. Starting a fresh roster.'; }
    this.networked = false;
    if (!this.sim.state.players.length) this.sim.addPlayer('solo', 'You');
    this.playerId = this.sim.state.players[0].id;
    this.onChange();
  }
  connect(url, type, roomCode, name = 'Marshal', token) {
    this.disconnect(); this.networked = true; this.status = 'Connecting to the Junction…'; this.remoteState = null; this.sequence = 0;
    let socket;
    try { socket = new WebSocket(url); } catch { this.status = 'Enter a valid ws:// or wss:// server address.'; this.networked = false; this.onChange(); return; }
    this.socket = socket; this.connection = { url, roomCode, name, token };
    socket.addEventListener('open', () => socket.send(JSON.stringify({ type, roomCode, name, token })));
    socket.addEventListener('message', event => {
      if (socket !== this.socket) return;
      let msg; try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.type === 'joined') { this.playerId = msg.playerId; this.roomCode = msg.roomCode; this.connected = true; this.status = ''; this.connection = { url, roomCode: msg.roomCode, name, token: msg.token }; try { sessionStorage.setItem('cinder.siege.session', JSON.stringify(this.connection)); } catch {} }
      if (msg.type === 'snapshot') { this.remoteState = msg.state; this.receivedAt = performance.now(); }
      if (msg.type === 'error' || msg.type === 'result' && !msg.ok) this.status = msg.reason;
      this.onChange();
    });
    socket.addEventListener('error', () => { if (socket === this.socket) { this.status = 'Server unavailable. Start npm run siege:server, then reconnect.'; this.onChange(); } });
    socket.addEventListener('close', () => { if (socket === this.socket) { this.connected = false; this.status = 'Disconnected. Your hero returns to the Junction. Reconnect to rejoin.'; this.onChange(); } });
  }
  reconnect() { if (this.connection?.token) this.connect(this.connection.url, 'resume', this.connection.roomCode, this.connection.name, this.connection.token); }
  dispatch(type, payload = {}) {
    const action = { ...payload, type, playerId: this.playerId };
    if (this.networked) {
      if (!this.connected || this.socket?.readyState !== WebSocket.OPEN) return { ok: false, reason: 'Reconnect before issuing commands.' };
      this.socket.send(JSON.stringify({ type: 'command', sequence: ++this.sequence, action }));
      return { ok: true, pending: true };
    }
    const result = this.sim.dispatch(action); if (!result.ok) this.status = result.reason; else this.status = '';
    this.onChange(); return result;
  }
  update(dt) {
    if (this.networked) return;
    this.sim.update(dt); this.saveMs += dt;
    if (this.saveMs >= 15000 && this.state.phase === 'playing') { this.save(); this.saveMs = 0; }
  }
  save() { if (this.networked || !this.playerId) return; try { localStorage.setItem(SIEGE_SAVE_KEY, JSON.stringify(this.sim.snapshot())); } catch { this.status = 'Browser storage unavailable; this run cannot autosave.'; } }
  disconnect() { const socket = this.socket; this.socket = null; socket?.close(); this.connected = false; }
  leave() { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: 'leave' })); this.disconnect(); try { sessionStorage.removeItem('cinder.siege.session'); } catch {} }
  dispose() { this.disposed = true; this.save(); this.disconnect(); }
}
