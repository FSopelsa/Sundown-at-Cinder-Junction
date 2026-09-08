// Stable semantic keys keep content and saved simulation data independent from
// a particular GLB filename or a Blender collection name.
export const ASSET_KEYS = Object.freeze({
  heroes: Object.freeze({
    circuitMarshal: 'unit-circuit-marshal',
  }),
  enemies: Object.freeze({
    dustMite: 'unit-dust-mite',
    rustRunner: 'unit-rust-runner',
    tinbackHauler: 'unit-tinback-hauler',
    sparkWagon: 'unit-spark-wagon',
    riftLeech: 'unit-rift-leech',
    siegeCrawler: 'unit-siege-crawler',
    blackComet: 'unit-black-comet',
  }),
  towers: Object.freeze({
    peacemaker: 'tower-peacemaker',
    sunspitter: 'tower-sunspitter',
    coldIronLongshot: 'tower-cold-iron-longshot',
    teslaCoil: 'tower-tesla-coil',
    scrapExchange: 'tower-scrap-exchange',
    wall: 'tower-defensive-wall',
  }),
});

export const MODEL_KEYS = Object.freeze({
  environment: Object.freeze({
    arrivalYard: 'environment-arrival-yard',
    relayHall: 'environment-relay-hall',
  }),
  units: 'prototype-units',
});

export const AUDIO_KEYS = Object.freeze({
  ambience: Object.freeze({
    combat: 'audio-ambience-combat',
    combatAlternate: 'audio-ambience-combat-alternate',
  }),
  music: Object.freeze({
    menu: 'audio-music-menu',
  }),
  wave: Object.freeze({
    start: 'audio-wave-start',
  }),
  boss: Object.freeze({
    arrival: 'audio-boss-arrival',
    music: 'audio-boss-music',
    victory: 'audio-boss-victory',
  }),
  ui: Object.freeze({
    towerPlaced: 'audio-ui-tower-placed',
    failure: 'audio-ui-failure',
  }),
  tower: Object.freeze({
    coldIronLongshot: 'audio-tower-cold-iron-longshot',
  }),
});

export const ASSET_MANIFEST = Object.freeze({
  models: Object.freeze([
    Object.freeze({
      key: MODEL_KEYS.environment.arrivalYard,
      path: '/assets/models/cinder-arrival-yard.glb',
      kind: 'environment',
    }),
    Object.freeze({
      key: MODEL_KEYS.environment.relayHall,
      path: '/assets/models/cinder-relay-hall.glb',
      kind: 'environment',
    }),
    Object.freeze({
      key: MODEL_KEYS.units,
      path: '/assets/models/cinder-prototype-units.glb',
      kind: 'unit-kit',
    }),
  ]),
  audio: Object.freeze([
    Object.freeze({ key: AUDIO_KEYS.ambience.combat, path: '/assets/audio/music/mapMusic-ambient-game-67014.mp3' }),
    Object.freeze({ key: AUDIO_KEYS.ambience.combatAlternate, path: '/assets/audio/music/backgroundMusic.whileGameIsRunning-sci-fi-sound-effect-24-200825.mp3' }),
    Object.freeze({ key: AUDIO_KEYS.boss.arrival, path: '/assets/audio/bossStartSound-astral-254198.mp3' }),
    Object.freeze({ key: AUDIO_KEYS.boss.music, path: '/assets/audio/music/bossMusic-08-second-490554.mp3' }),
    Object.freeze({ key: AUDIO_KEYS.boss.victory, path: '/assets/audio/bossDies-magma-brass-sound-effect-222269.mp3' }),
    Object.freeze({ key: AUDIO_KEYS.tower.coldIronLongshot, path: '/assets/audio/towers/freeze(whoosh)-long-sound-effect-405921.mp3' }),
    Object.freeze({ key: AUDIO_KEYS.music.menu, path: '/assets/audio/music/menuMusic-dark-future-logo-196217.mp3' }),
    Object.freeze({ key: AUDIO_KEYS.wave.start, path: '/assets/audio/newWave_start-sound-2-547852.mp3' }),
    Object.freeze({ key: AUDIO_KEYS.ui.towerPlaced, path: '/assets/audio/towers/placeTower-swordSound-339823.mp3' }),
    Object.freeze({ key: AUDIO_KEYS.ui.failure, path: '/assets/audio/defeat-477823.mp3' }),
  ]),
});

export function getModelAsset(key) {
  return ASSET_MANIFEST.models.find((asset) => asset.key === key) ?? null;
}
