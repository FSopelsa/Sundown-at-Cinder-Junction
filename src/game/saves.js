import { GameState } from './simulation/GameState.js';
import { CAMPAIGN_MAP } from './content/campaign.js';

export const SAVE_PREFIX = 'cinder.campaign.v2.';
export class CampaignSaves {
  constructor(storage, now = () => new Date().toISOString()) { this.storage = storage; this.now = now; this.error = null; }
  read(kind) {
    try {
      const raw = this.storage.getItem(SAVE_PREFIX + kind);
      if (!raw) return null;
      const record = JSON.parse(raw);
      const snapshot = record.snapshot;
      const allowed = new Set(CAMPAIGN_MAP.campaign.encounters.map(e => e.id));
      if (record.format !== 1 || snapshot?.levelId !== CAMPAIGN_MAP.id || !snapshot.campaign ||
        !Array.isArray(snapshot.campaign.completed) || !Array.isArray(snapshot.campaign.keys) ||
        snapshot.campaign.completed.some(id => !allowed.has(id)) ||
        (snapshot.campaign.activeEncounterId !== null && !allowed.has(snapshot.campaign.activeEncounterId)) ||
        !Number.isFinite(Date.parse(record.savedAt)) || !Number.isFinite(snapshot.stationIntegrity) ||
        !Number.isFinite(snapshot.hero?.x) || !Number.isFinite(snapshot.hero?.y)) throw new Error('Invalid campaign checkpoint');
      return { ...record, state: GameState.fromJSON(snapshot), kind };
    } catch {
      this.error = 'A checkpoint could not be read. It has been kept intact; another valid checkpoint can still be loaded.';
      return null;
    }
  }
  latest() { return ['auto', 'manual'].map(kind => this.read(kind)).filter(Boolean).sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt))[0] ?? null; }
  write(state, kind) {
    try {
      const record = { format: 1, savedAt: this.now(), snapshot: state.toJSON() };
      this.storage.setItem(SAVE_PREFIX + kind, JSON.stringify(record));
      this.error = null;
      return { ok: true, savedAt: record.savedAt };
    } catch {
      this.error = 'Saving failed: browser storage is unavailable or full. Your previous checkpoint is intact. Free space and use a save machine again.';
      return { ok: false, reason: this.error };
    }
  }
}
