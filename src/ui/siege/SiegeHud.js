import { HEROES, ABILITIES, ITEMS, FORTIFICATIONS, PADS, SIEGE_RULES, xpForLevel, EVENT_SITE } from '../../game/siege/content.js';
import { heroStats } from '../../game/siege/state.js';
import { SIEGE_SAVE_KEY } from '../../game/siege/client.js';
import './siege.css';

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const seconds = ms => Math.max(0, Math.ceil(ms / 1000));
export class SiegeHud {
  constructor(root, client) { this.root = root; this.client = client; this.selection = 'singularity'; this.targetAbility = null; this.panel = null; this.padId = 'west'; this.fortification = 'repeater'; this.renderAt = 0; this.noticeUntil = 0; }
  mount() {
    document.body.classList.add('siege-mode');
    this.root.innerHTML = `<div class="siege-ui">
      <section class="siege-lobby" aria-label="Siege lobby">
        <div class="siege-kicker">SUNDOWN AT CINDER JUNCTION / 01</div>
        <h1>THE LAST<br><em>DEPARTURE.</em></h1>
        <p class="siege-intro">Hold the Junction. Break their foundry.<br>Bring down the Black Comet.</p>
        <div class="siege-lobby-meta">1–4 MARSHALS <span>15–20 MINUTES</span></div>
        <div class="siege-hero-choices">${Object.entries(HEROES).map(([id, hero]) => `<button data-hero="${id}" aria-pressed="${id === this.selection}" style="--hero-color:${hero.color}"><span class="siege-hero-symbol">${id === 'singularity' ? '◎' : '⬡'}</span><span><strong>${hero.name}</strong><small>${hero.role}</small></span></button>`).join('')}</div>
        <div class="siege-kit" data-siege="kit"></div>
        <div class="siege-solo-actions"><button class="siege-primary" data-do="solo">Deploy solo <span>→</span></button><button data-do="resume">Resume solo</button></div>
        <details class="siege-network"><summary>Co-op / create or join a crew</summary>
          <label>Callsign<input data-input="name" maxlength="24" value="Marshal" aria-label="Callsign"></label>
          <label>Local server<input data-input="server" aria-label="Server address" spellcheck="false" value="${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:8787"></label>
          <div class="siege-network-row"><button data-do="create">Create room</button><input data-input="code" aria-label="Room code" placeholder="ROOM CODE" maxlength="5"><button data-do="join">Join room</button></div>
          <button data-do="session">Rejoin saved session</button>
        </details>
        <div class="siege-roster" data-siege="roster"></div>
        <div class="siege-room-actions" hidden><button data-do="ready">Ready</button><button class="siege-primary" data-do="start">Launch siege</button><button data-do="leave">Leave</button></div>
        <p class="siege-connection" data-siege="connection" role="status"></p>
        <footer><a href="?level=cinder-campaign">Campaign</a><a href="?level=cinder-threshold">Classic defense</a><a href="?assets">Asset library</a></footer>
      </section>
      <div class="siege-playing" hidden>
        <section class="siege-objective"><span class="siege-kicker">THE LAST DEPARTURE</span><div class="siege-objective-title"><strong data-siege="phase">Hold the Junction</strong><time data-siege="time">00:00</time></div><div class="siege-meter siege-base"><i data-bar="base"></i></div><div class="siege-statusline"><span>JUNCTION <b data-siege="base"></b></span><span data-siege="wave"></span></div><p data-siege="objective"></p></section>
        <section class="siege-team"><div data-siege="team"></div><div class="siege-team-tools"><button data-do="build">Fortify <b data-siege="scrap"></b></button><button data-do="shop">Inventory / I</button><button data-do="menu" aria-label="Open field manual">☰</button></div><span data-siege="network-status"></span><button data-do="reconnect" hidden>Reconnect</button></section>
        <div class="siege-boss" hidden><div>THE BLACK COMET <span data-siege="boss-shield"></span></div><div class="siege-meter"><i data-bar="boss"></i></div></div>
        <div class="siege-toast" data-siege="notice" role="status"></div>
        <section class="siege-hero-hud"><div class="siege-hero-heading"><strong data-siege="hero-name"></strong><span data-siege="level"></span><span data-siege="hp"></span></div><div class="siege-meter siege-hull"><i data-bar="hp"></i></div><div class="siege-xp"><i data-bar="xp"></i></div><div class="siege-abilities" data-siege="abilities"></div><div class="siege-key-hint">Click deck: move / auto-fire · Q W E: abilities · R: interact · F: follow · O: overview</div></section>
        <section class="siege-inventory"><span><b data-siege="marks"></b> personal Marks <small>1–4: use / equip</small></span><div data-siege="inventory"></div></section>
        <div class="siege-target-hint" hidden></div>
        <aside class="siege-drawer" hidden><button data-do="close" class="siege-close" aria-label="Close panel">×</button><div data-siege="panel"></div></aside>
      </div>
      <section class="siege-outcome" hidden><span class="siege-kicker">CINDER JUNCTION / AFTER ACTION</span><h2 data-siege="outcome"></h2><p data-siege="outcome-message"></p><p data-siege="summary"></p><button class="siege-primary" data-do="new">Back to departure</button></section>
    </div>`;
    this.ui = this.root.querySelector('.siege-ui');
    this.onClick = event => this.click(event);
    this.root.addEventListener('click', this.onClick);
    this.render(true);
  }
  query(key) { return this.root.querySelector(`[data-siege="${key}"]`); }
  text(key, value) { const node = this.query(key); if (node.textContent !== String(value)) node.textContent = value; }
  bar(key, value) { this.root.querySelector(`[data-bar="${key}"]`).style.width = `${Math.max(0, Math.min(100, value * 100))}%`; }
  command(type, payload) { const result = this.client.dispatch(type, payload); if (!result.ok) this.notice(result.reason); return result; }
  notice(message) { this.text('notice', message); this.noticeUntil = performance.now() + 6000; }
  click(event) {
    const heroButton = event.target.closest('[data-hero]');
    if (heroButton) { this.selection = heroButton.dataset.hero; if (this.client.playerId) this.command('select-hero', { hero: this.selection }); this.render(true); return; }
    const ability = event.target.closest('[data-ability]'); if (ability) return this.arm(ability.dataset.ability);
    const slot = event.target.closest('[data-slot]'); if (slot) return this.useSlot(Number(slot.dataset.slot), event.shiftKey);
    const purchase = event.target.closest('[data-buy]'); if (purchase) { this.command('buy-item', { item: purchase.dataset.buy }); return; }
    const pad = event.target.closest('[data-pad]'); if (pad) { this.padId = pad.dataset.pad; this.openPanel('build'); return; }
    const fort = event.target.closest('[data-fort]'); if (fort) { this.fortification = fort.dataset.fort; this.openPanel('build'); return; }
    const action = event.target.closest('[data-do]')?.dataset.do;
    const input = key => this.root.querySelector(`[data-input="${key}"]`).value;
    if (action === 'solo') { this.client.solo(); this.client.dispatch('select-hero', { hero: this.selection }); this.client.dispatch('ready', { ready: true }); this.client.dispatch('start'); this.onDeploy?.(); }
    if (action === 'resume') { this.client.solo(true); this.onDeploy?.(); }
    if (action === 'create' || action === 'join') this.client.connect(input('server'), action, input('code'), input('name'));
    if (action === 'session') { try { const saved = JSON.parse(sessionStorage.getItem('cinder.siege.session')); if (saved) this.client.connect(saved.url, 'resume', saved.roomCode, saved.name, saved.token); else this.text('connection', 'No reconnect session in this tab.'); } catch { this.text('connection', 'The saved session could not be read.'); } }
    if (action === 'ready') { const player = this.client.state.players.find(p => p.id === this.client.playerId); this.command('ready', { ready: !player?.ready }); }
    if (action === 'start') { this.command('start'); this.onDeploy?.(); }
    if (action === 'leave') { this.client.leave(); location.reload(); }
    if (action === 'reconnect') this.client.reconnect();
    if (action === 'build' || action === 'shop' || action === 'menu') this.openPanel(action);
    if (action === 'close') this.openPanel(null);
    if (action === 'confirm-build') { const result = this.command('build', { fortification: this.fortification, padId: this.padId }); if (result.ok) { this.openPanel(null); this.notice('Construction ordered. The crew is assembling your fortification.'); } }
    if (action === 'event') this.command('interact', { targetId: 'capacitor' });
    if (action === 'pause') this.command('pause');
    if (action === 'speed') this.command('speed', { speed: this.client.state.settings.speed === 1 ? 2 : 1 });
    if (action === 'audio') this.onAudio?.();
    if (action === 'new') { this.client.leave(); location.href = location.pathname; }
    if (action === 'save') { this.client.save(); this.notice('Solo checkpoint saved in this browser.'); }
    this.render(true);
  }
  useSlot(slot, drop = false) { const hero = this.client.state.heroes.find(h => h.playerId === this.client.playerId); const item = hero?.inventory[slot]; if (item) this.command(drop ? 'drop-item' : ITEMS[item.type].kind === 'equipment' ? 'equip-item' : 'use-item', { slot }); }
  arm(ability) {
    const def = ABILITIES[ability], hero = this.client.state.heroes.find(h => h.playerId === this.client.playerId);
    if (!hero || !hero.alive || hero.level < def.unlock || hero.cooldowns[ability] > 0) return;
    if (!def.range) { this.command('cast', { ability }); return; }
    this.targetAbility = this.targetAbility === ability ? null : ability;
    const hint = this.root.querySelector('.siege-target-hint'); hint.hidden = !this.targetAbility;
    hint.textContent = `Aim ${def.name} · click deck to cast · Esc cancels`; this.render(true);
  }
  cancelTarget() { this.targetAbility = null; this.root.querySelector('.siege-target-hint').hidden = true; }
  openPanel(panel) {
    this.panel = panel; this.cancelTarget();
    this.root.querySelector('.siege-drawer').hidden = !panel;
    const hero = this.client.state.heroes.find(h => h.playerId === this.client.playerId);
    if (panel === 'shop') this.query('panel').innerHTML = `<span class="siege-kicker">JUNCTION QUARTERMASTER</span><h2>Travel light. Hit hard.</h2><p>Buy near the reactor with your personal Marks. Four slots; equipment must be equipped. Shift-click an inventory slot to drop it for the crew.</p><div class="siege-shop">${Object.entries(ITEMS).map(([id, item]) => `<button data-buy="${id}"><span>${item.glyph}</span><strong>${item.name}<small>${item.description}</small></strong><b>${item.cost} M</b></button>`).join('')}</div>`;
    if (panel === 'build') this.query('panel').innerHTML = `<span class="siege-kicker">SHARED FORTIFICATIONS</span><h2>Make your stand.</h2><p>Three team permits. Each pad holds one fortification. Move within eight cells; assembly takes five seconds.</p><div class="siege-pad-choice">${PADS.map(pad => `<button data-pad="${pad.id}" aria-pressed="${this.padId === pad.id}" ${this.client.state.towers.some(t => t.padId === pad.id) ? 'disabled' : ''}>${pad.id}</button>`).join('')}</div>${Object.entries(FORTIFICATIONS).map(([id, fort]) => `<button class="siege-fort-choice" data-fort="${id}" aria-pressed="${this.fortification === id}"><strong>${fort.name}<small>${fort.description}</small></strong><b>${fort.cost}</b></button>`).join('')}<button class="siege-primary" data-do="confirm-build">Build ${FORTIFICATIONS[this.fortification].name} · ${FORTIFICATIONS[this.fortification].cost} team Scrap</button><p class="siege-small">Owner: ${escape(this.client.state.players.find(p => p.id === this.client.playerId)?.name ?? 'You')} · ${this.client.state.towers.length}/3 permits used</p>`;
    if (panel === 'menu') this.query('panel').innerHTML = `<span class="siege-kicker">MARSHAL'S FIELD MANUAL</span><h2>Keep the rail alive.</h2><p>Defend the shared reactor. At assault 4, stabilize the southern capacitor. From assault 5, push west and destroy Ash Foundry. At 15 minutes the Black Comet arrives; the foundry powers its shield.</p><p>Click to move; attack nearby enemies automatically. Q/W/E selects abilities, then click to aim. R rescues an ally or picks up supplies. F follows your hero; O frames the entire station. Wheel / arrows / right-drag control the tactical camera.</p><p>Downed heroes can be revived by an ally (3s). Otherwise they reconstruct at the reactor after 25s. Stay near the reactor to heal.</p><p>${escape(hero ? HEROES[hero.kind].trait : '')}</p><div class="siege-menu-buttons">${this.client.networked ? '<p>Co-op uses real time. There is no pause or speed control.</p>' : '<button data-do="pause">Pause / resume · P</button><button data-do="speed">Toggle 1× / 2×</button><button data-do="save">Save checkpoint</button>'}<button data-do="audio">Toggle audio</button><button data-do="event">Go to capacitor</button><button data-do="new">Leave siege</button></div>`;
    if (panel === 'build') this.query('panel').insertAdjacentHTML('beforeend', '<div data-siege="construction-status"></div>');
  }
  render(force = false) {
    const now = performance.now(); if (!force && now - this.renderAt < 100) return; this.renderAt = now;
    const state = this.client.state, hero = state.heroes.find(h => h.playerId === this.client.playerId), playing = state.phase !== 'lobby';
    this.root.querySelector('.siege-lobby').hidden = playing;
    this.root.querySelector('.siege-playing').hidden = !playing;
    this.root.querySelector('.siege-outcome').hidden = !['victory', 'defeat'].includes(state.phase);
    if (!playing) {
      this.root.querySelectorAll('[data-hero]').forEach(button => button.setAttribute('aria-pressed', (hero?.kind ?? this.selection) === button.dataset.hero ? 'true' : 'false'));
      const kit = HEROES[hero?.kind ?? this.selection];
      this.query('kit').innerHTML = `<p>${kit.description}</p><span>${kit.abilities.map(id => ABILITIES[id].name).join(' / ')}</span><small>${kit.trait}</small>`;
      this.text('connection', this.client.status);
      this.root.querySelector('.siege-solo-actions').hidden = this.client.networked && this.client.connected;
      this.root.querySelector('.siege-network').hidden = this.client.networked && this.client.connected;
      this.root.querySelector('.siege-room-actions').hidden = !this.client.networked || !this.client.connected;
      this.root.querySelector('[data-do="resume"]').disabled = !localStorage.getItem(SIEGE_SAVE_KEY);
      if (this.client.roomCode && this.client.connected) {
        this.query('roster').innerHTML = `<span class="siege-kicker">CREW CODE <b class="siege-room-code">${escape(this.client.roomCode)}</b> / ${state.players.length} OF 4</span>${state.players.map(p => `<div><b>${escape(p.name)}</b><span>${HEROES[state.heroes.find(h => h.id === p.heroId).kind].name}</span><small>${!p.connected ? 'Disconnected' : p.ready ? 'Ready' : 'Choosing'}</small></div>`).join('')}`;
        const me = state.players.find(p => p.id === this.client.playerId);
        this.root.querySelector('[data-do="ready"]').textContent = me?.ready ? 'Not ready' : 'Ready';
        this.root.querySelector('[data-do="start"]').disabled = state.hostId !== this.client.playerId || state.players.some(p => !p.ready || !p.connected);
      }
      return;
    }
    const minutes = Math.floor(state.timeMs / 60000), sec = Math.floor(state.timeMs / 1000) % 60;
    this.text('time', `${String(minutes).padStart(2, '0')}:${String(sec).padStart(2, '0')}${!state.networked && state.settings.speed === 2 ? ' / 2×' : ''}${state.settings.paused ? ' / PAUSED' : ''}`);
    this.bar('base', state.base.hp / state.base.maxHp); this.text('base', `${Math.ceil(state.base.hp)} / ${state.base.maxHp}`);
    this.text('wave', state.wave ? `ASSAULT ${state.wave} / 10` : `INCOMING ${seconds(state.nextWaveMs - state.timeMs)}s`);
    this.text('phase', state.bossSpawned ? 'Bring down the Black Comet' : state.event.status === 'active' ? 'Stabilize the capacitor' : state.foundry.open && !state.foundry.destroyed ? 'Break the Ash Foundry' : 'Hold the Junction');
    this.text('objective', state.event.status === 'active' ? `Southern console · ${seconds(state.event.remainingMs)}s left · hold ${Math.floor(state.event.progressMs / 1000)}/5s` : state.foundry.open && !state.foundry.destroyed ? `Push west · Foundry ${Math.ceil(state.foundry.hp)} hull · disables a spawn and the boss shield` : state.foundry.destroyed ? `West spawn disabled · ${state.enemies.length} hostiles on the deck` : `Three approaches · ${state.enemies.length} hostiles · next assault in ${seconds(state.nextWaveMs - state.timeMs)}s`);
    this.text('scrap', `${state.scrap} S / ${3 - state.towers.length} permits`);
    const construction = this.query('construction-status');
    if (construction) construction.innerHTML = state.towers.map(t => `<p class="siege-small">${escape(t.padId)} / ${escape(FORTIFICATIONS[t.kind].name)}<br>${escape(state.players.find(p=>p.id===t.ownerId)?.name ?? 'Crew')} · ${t.constructionMs > 0 ? `assembling ${seconds(t.constructionMs)}s` : 'ONLINE'}</p>`).join('');
    const crewKey = state.players.map(p => `${p.id}:${p.connected}:${Math.ceil(state.heroes.find(h => h.id === p.heroId)?.hp)}`).join('|');
    if (crewKey !== this.crewKey) { this.crewKey = crewKey; this.query('team').innerHTML = state.players.map(p => { const h = state.heroes.find(h => h.id === p.heroId); return `<div class="siege-teammate" style="--hero-color:${HEROES[h.kind].color}"><i></i><b>${escape(p.id === this.client.playerId ? 'YOU' : p.name)}</b><span>${!p.connected ? 'OFFLINE' : h.alive ? `${Math.ceil(h.hp)} HP` : 'DOWNED / R'}</span></div>`; }).join(''); }
    this.text('network-status', this.client.networked ? `${this.client.roomCode ?? ''} / ${this.client.connected ? 'LIVE CO-OP' : 'DISCONNECTED'}` : 'SOLO / AUTOSAVE');
    this.root.querySelector('[data-do="reconnect"]').hidden = !this.client.networked || this.client.connected;
    if (state.message !== this.lastMessage) { this.lastMessage = state.message; this.notice(state.message); }
    if (this.client.status && this.client.status !== this.lastStatus) { this.lastStatus = this.client.status; this.notice(this.client.status); }
    this.query('notice').classList.toggle('is-visible', now < this.noticeUntil);
    const boss = state.enemies.find(e => e.type === 'blackComet'); this.root.querySelector('.siege-boss').hidden = !boss;
    if (boss) { this.bar('boss', boss.hp / boss.maxHp); this.text('boss-shield', state.foundry.destroyed ? `${Math.ceil(boss.hp)} HULL` : 'FOUNDRY SHIELD ACTIVE'); }
    if (hero) {
      const stats = heroStats(hero), kit = HEROES[hero.kind];
      this.text('hero-name', kit.name); this.text('level', `LV ${hero.level}`); this.text('hp', hero.alive ? `${Math.ceil(hero.hp)} / ${stats.maxHp}` : `RECONSTRUCTING / ${seconds(hero.downMs)}s`);
      this.bar('hp', hero.hp / stats.maxHp); this.bar('xp', hero.level === 10 ? 1 : hero.xp / xpForLevel(hero.level)); this.text('marks', hero.marks);
      this.root.querySelector('.siege-key-hint').textContent = hero.interaction ? `${hero.path.length ? 'Moving to' : 'Channeling'} ${hero.interaction.type === 'revive' ? 'ally revival' : hero.interaction.targetId === 'capacitor' ? 'capacitor console' : 'supplies'}${hero.interaction.progressMs ? ` / ${(hero.interaction.progressMs / 1000).toFixed(1)}s` : ''} · move to cancel` : 'Click deck: move / auto-fire · Q W E: abilities · R: interact · F: follow · O: overview';
      const abilityKey = `${hero.kind}:${hero.level}:${hero.alive}:${kit.abilities.map(id => seconds(hero.cooldowns[id] ?? 0)).join()}:${this.targetAbility}`;
      if (abilityKey !== this.abilityKey) { this.abilityKey = abilityKey; this.query('abilities').innerHTML = kit.abilities.map((id, index) => { const def = ABILITIES[id], cd = seconds(hero.cooldowns[id] ?? 0), locked = hero.level < def.unlock; return `<button data-ability="${id}" aria-label="${def.name}" aria-pressed="${this.targetAbility === id}" ${cd || locked || !hero.alive ? 'disabled' : ''} title="${escape(def.description)}"><kbd>${['Q','W','E'][index]}</kbd><span class="siege-ability-symbol" style="color:${def.color}">${def.glyph}</span><strong>${def.name}</strong><small>${locked ? `LEVEL ${def.unlock}` : cd ? `${cd}s` : 'READY'}</small></button>`; }).join(''); }
      const inventoryKey = JSON.stringify(hero.inventory);
      if (inventoryKey !== this.inventoryKey) { this.inventoryKey = inventoryKey; this.query('inventory').innerHTML = hero.inventory.map((item, index) => `<button data-slot="${index}" aria-label="Inventory slot ${index + 1}${item ? ': ' + ITEMS[item.type].name : ': empty'}" title="${item ? escape(ITEMS[item.type].description + ' Click to use/equip. Shift-click to drop.') : 'Empty slot'}" class="${item?.equipped ? 'is-equipped' : ''}"><kbd>${index + 1}</kbd><span>${item ? ITEMS[item.type].glyph : '·'}</span><small>${item ? ITEMS[item.type].name : 'EMPTY'}</small>${item?.equipped ? '<i>ON</i>' : ''}</button>`).join(''); }
    }
    if (state.summary) { this.text('outcome', state.phase === 'victory' ? 'THE JUNCTION STANDS.' : 'THE RAIL GOES DARK.'); this.text('outcome-message', state.message); this.text('summary', `${minutes}:${String(sec).padStart(2,'0')} survived · ${state.summary.kills} hero kills · Assault ${state.wave}`); }
  }
  dispose() { this.root.removeEventListener('click', this.onClick); this.root.replaceChildren(); document.body.classList.remove('siege-mode'); }
}
