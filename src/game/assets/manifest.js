export const ASSET_KEYS = Object.freeze({
  heroes: Object.freeze({
    circuitMarshal: 'hero-circuit-marshal',
  }),
  enemies: Object.freeze({
    dustMite: 'enemy-dust-mite',
    rustRunner: 'enemy-rust-runner',
    tinbackHauler: 'enemy-tinback-hauler',
    sparkWagon: 'enemy-spark-wagon',
    riftLeech: 'enemy-rift-leech',
    siegeCrawler: 'enemy-siege-crawler',
    blackComet: 'enemy-black-comet',
  }),
  towers: Object.freeze({
    peacemaker: 'tower-peacemaker',
    sunspitter: 'tower-sunspitter',
    coldIronLongshot: 'tower-cold-iron-longshot',
    teslaCoil: 'tower-tesla-coil',
  }),
});

export const TOWER_ANIMATION_KEYS = Object.freeze({
  sunspitterFire: 'tower-sunspitter-fire',
  coldIronLongshot: 'tower-cold-iron-longshot:attack',
  teslaCoil: 'tower-tesla-coil:attack',
});

export const HERO_ANIMATION_KEYS = Object.freeze({
  idle: 'hero-circuit-marshal:idle',
  run: 'hero-circuit-marshal:run',
  cast: 'hero-circuit-marshal:cast',
});

export const SUNSPITTER_ATLAS_FRAMES = Object.freeze([
  'sunspitter-idle-01',
  'sunspitter-charge-01',
  'sunspitter-charge-02',
  'sunspitter-charge-03',
  'sunspitter-charge-04',
  'sunspitter-fire-01',
  'sunspitter-cooldown-01',
  'sunspitter-idle-02',
]);

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
  images: Object.freeze([]),
  atlases: Object.freeze([
    { key: ASSET_KEYS.towers.coldIronLongshot, path: '/assets/sprites/cold-iron-longshot' },
    { key: ASSET_KEYS.towers.teslaCoil, path: '/assets/sprites/tesla-coil' },
    { key: ASSET_KEYS.heroes.circuitMarshal, path: '/assets/sprites/singularity-hero' },
  ]),
  spritesheets: Object.freeze([
    Object.freeze({
      key: ASSET_KEYS.towers.sunspitter,
      path: 'public/assets/towers/sunspitter-charge.png',
      frameConfig: Object.freeze({ frameWidth: 192, frameHeight: 192 }),
    }),
  ]),
  audio: Object.freeze([
    Object.freeze({
      key: AUDIO_KEYS.ambience.combat,
      path: 'public/assets/audio/music/mapMusic-ambient-game-67014.mp3',
    }),
    Object.freeze({
      key: AUDIO_KEYS.ambience.combatAlternate,
      path: 'public/assets/audio/music/backgroundMusic.whileGameIsRunning-sci-fi-sound-effect-24-200825.mp3',
    }),
    Object.freeze({
      key: AUDIO_KEYS.boss.arrival,
      path: 'public/assets/audio/bossStartSound-astral-254198.mp3',
    }),
    Object.freeze({
      key: AUDIO_KEYS.boss.music,
      path: 'public/assets/audio/music/bossMusic-08-second-490554.mp3',
    }),
    Object.freeze({
      key: AUDIO_KEYS.boss.victory,
      path: 'public/assets/audio/bossDies-magma-brass-sound-effect-222269.mp3',
    }),
    Object.freeze({
      key: AUDIO_KEYS.tower.coldIronLongshot,
      path: 'public/assets/audio/towers/freeze(whoosh)-long-sound-effect-405921.mp3',
    }),
    Object.freeze({
      key: AUDIO_KEYS.music.menu,
      path: 'public/assets/audio/music/menuMusic-dark-future-logo-196217.mp3',
    }),
    Object.freeze({
      key: AUDIO_KEYS.wave.start,
      path: 'public/assets/audio/newWave_start-sound-2-547852.mp3',
    }),
    Object.freeze({
      key: AUDIO_KEYS.ui.towerPlaced,
      path: 'public/assets/audio/towers/placeTower-swordSound-339823.mp3',
    }),
    Object.freeze({
      key: AUDIO_KEYS.ui.failure,
      path: 'public/assets/audio/defeat-477823.mp3',
    }),
  ]),
});
