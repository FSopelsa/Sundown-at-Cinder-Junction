import { defineRoom, defineRoomConnection, defineRoomMap, roomCell } from './rooms.js';

const cell = roomCell;
const room = (id, name, x, y, columns, rows, palette, kind = 'defense') => ({
  ...defineRoom({ id, name, x, y, columns, rows, environment: { palette } }), kind,
  terminal: cell(id, 2, 2),
  obstacles: [cell(id, 2, 1), ...(kind === 'workshop' ? Array.from({length: 9}, (_, i) => cell(id, 6 + i % 3, 6 + Math.floor(i / 3))) : []),
    ...(kind === 'boss' ? Array.from({length: 36}, (_, i) => cell(id, 6 + i % 6, 2 + Math.floor(i / 6))) : []),
    ...(kind === 'trial' ? [cell(id, 8, 2)] : [])],
});
const door = (id, from, to) => defineRoomConnection({ id, name: id, from, to, initiallyOpen: false });
export const ELEMENTS = ['solar', 'cryo', 'arc', 'grav'];
export const ELEMENT_REWARDS = {
  solar: 'Solar tower damage +20% · hero damage +10%',
  cryo: 'Cryo tower damage +20% · hero incoming damage −10%',
  arc: 'Arc tower damage +20% · hero damage +10%',
  grav: 'Kinetic tower damage +20% · hero incoming damage −10%',
};
const encounters = [
  { id: 'room-1', roomId: 'room-1', label: 'Room 1 · Portal vault', spawn: cell('room-1', 0, 6), tier: 0, waves: 2 },
  { id: 'room-2', roomId: 'room-2', label: 'Room 2 · Relay approach', spawn: cell('room-2', 8, 0), tier: 1, waves: 3 },
  { id: 'sun', roomId: 'sun', label: 'Room 3 · Sun junction', spawn: cell('sun', 8, 0), tier: 2, waves: 3 },
  ...ELEMENTS.map((element) => ({ id: element, roomId: element, element,
    label: `${element[0].toUpperCase() + element.slice(1)} trial`, spawn: cell(element, 0, 6),
    goal: cell(element, 11, 6), tier: 2, waves: 3 })),
];
export const CAMPAIGN_MAP = Object.freeze({
  ...defineRoomMap({
    id: 'cinder-campaign', name: 'Expanding Cinder Junction', startingScrap: 720,
    rooms: [
      room('room-1', '01 · Portal vault', 1960, 1320, 16, 12, 'rust'),
      room('room-2', '02 · Relay approach', 1240, 1320, 16, 12, 'teal'),
      room('sun', '03 · Sun junction', 1240, 600, 16, 16, 'ember'),
      room('boss', 'Dormant boss chamber', 1960, 760, 16, 12, 'basalt', 'boss'),
      room('workshop', 'Elemental workshop', 600, 680, 14, 14, 'slag', 'workshop'),
      room('solar', 'Solar furnace', 40, 720, 12, 12, 'ember', 'trial'),
      room('cryo', 'Cryo laboratory', 440, 80, 12, 12, 'teal', 'trial'),
      room('grav', 'Gravity containment', 1000, 80, 12, 12, 'basalt', 'trial'),
      room('arc', 'Arc generator', 640, 1320, 12, 12, 'slag', 'trial'),
    ],
    connections: [
      door('vault-door', cell('room-2', 15, 6), cell('room-1', 0, 6)),
      door('sun-door', cell('sun', 8, 15), cell('room-2', 8, 0)),
      door('boss-door', cell('sun', 15, 12), cell('boss', 0, 8)),
      door('workshop-door', cell('sun', 0, 8), cell('workshop', 13, 6)),
      door('solar-door', cell('workshop', 0, 8), cell('solar', 11, 7)),
      door('cryo-door', cell('workshop', 4, 0), cell('cryo', 8, 11)),
      door('grav-door', cell('workshop', 12, 0), cell('grav', 2, 11)),
      door('arc-door', cell('workshop', 7, 13), cell('arc', 6, 0)),
    ],
    entrance: cell('room-1', 0, 6), exit: cell('room-1', 15, 6),
    heroSpawn: { x: 2340, y: 1660 }, unlockedRoomIds: ['room-1'], openDoorIds: [],
  }),
  campaign: { encounters, checkpoint: cell('sun', 8, 8), checkpointDoor: 'sun-door', regenMs: 7000 },
});

export function getEncounter(map, state) {
  return map.campaign?.encounters.find((entry) => entry.id === state.campaign?.activeEncounterId) ?? null;
}

export function getCampaignWave(map, state, index) {
  const encounter = getEncounter(map, state);
  if (!encounter || state.campaign.revealRemainingMs > 0 || state.campaign.completed.includes(encounter.id) || index > encounter.waves) return null;
  const types = encounter.element === 'solar' ? ['riftLeech', 'rustRunner', 'tinbackHauler']
    : encounter.element === 'arc' ? ['sparkWagon', 'dustMite', 'sparkWagon']
    : encounter.element === 'cryo' ? ['rustRunner', 'tinbackHauler', 'siegeCrawler']
    : encounter.element === 'grav' ? ['dustMite', 'tinbackHauler', 'siegeCrawler']
    : encounter.tier === 0 ? ['dustMite', 'rustRunner']
    : encounter.tier === 1 ? ['rustRunner', 'tinbackHauler', 'sparkWagon']
    : ['sparkWagon', 'riftLeech', 'siegeCrawler'];
  const enemyType = types[index - 1];
  // Heavy chassis have a different budget from runners. More floor space is
  // not a reason to send sixteen siege engines into an unupgraded branch.
  const count = enemyType === 'siegeCrawler' ? 2 + Math.floor(index / 2)
    : enemyType === 'tinbackHauler' ? 3 + index
    : enemyType === 'riftLeech' ? 4 + index
    : enemyType === 'sparkWagon' ? 4 + index + encounter.tier
    : 6 + index * 2 + encounter.tier;
  const groups = [{ enemyType, count, intervalMs: enemyType === 'siegeCrawler' ? 1800 : 950 }];
  if (enemyType === 'siegeCrawler') groups.push({ enemyType: 'dustMite', count: 6, intervalMs: 700, delayBeforeMs: 1500 });
  return { index, label: `${encounter.label} · ${index}/${encounter.waves}`, isBounty: false, groups };
}
