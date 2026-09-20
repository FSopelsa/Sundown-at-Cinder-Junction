import { MODEL_KEYS } from './manifest.js';

// The library names are an art contract, independent of enemy rules and saves.
const active = [
  ['Unit_Hero', 'Singularity', 'hero'],
  ['Tower_ColdIronLongshot', 'Cold-Iron Longshot', 'tower'],
  ['Tower_Sunspitter', 'Sunspitter', 'tower'],
  ['Tower_TeslaCoil', 'Tesla Coil', 'tower'],
  ['Unit_RustRunner', 'MechDog / Rust Runner', 'enemy'],
  ['Unit_TinbackHauler', 'Tinback armored hauler', 'enemy'],
  ['Unit_RiftLeech', 'TechSquid / Rift Leech', 'enemy'],
  ['Unit_BlackComet', 'The Black Comet', 'boss'],
  ['Unit_DustMite', 'Dust Mite scavenger', 'enemy'],
  ['Unit_SparkWagon', 'Spark Wagon', 'enemy'],
  ['Unit_SiegeCrawler', 'Siege Crawler', 'enemy'],
  ['Tower_Peacemaker', 'Peacemaker', 'tower'],
  ['Tower_ScrapExchange', 'Scrap Exchange', 'tower'],
  ['Tower_Wall', 'Windowed defensive wall', 'wall'],
];
const reserve = [
  ['Prop_CryogenicPlant', 'Cryogenic cooling plant', 'prop'],
  ['Prop_ContainmentReactor', 'Fusion containment reactor', 'prop'],
  ['Prop_ArcPylon', 'Arc relay pylon', 'prop'],
  ['Prop_TechSquidSentinel', 'TechSquid sentinel', 'enemy'],
  ['Prop_DeathComet', 'Death Comet relic', 'boss'],
  ['Prop_HornedComet', 'Horned Comet', 'boss'],
  ['Prop_EyeOfCinder', 'Eye of Cinder', 'prop'],
  ['Prop_ThresholdGate', 'Threshold gate', 'prop'],
  ['Prop_Tokamak', 'Toroidal fusion engine', 'prop'],
  ['Prop_FaradayCage', 'Faraday service cage', 'prop'],
  ['Prop_UpgradeStation', 'Upgrade workbench', 'prop'],
  ['Kit_FortressWall', 'Fortress wall module', 'wall'],
];
const kit = [
  ['Kit_FloorPlate', 'Diamond steel plate', 'floor'],
  ['Kit_FloorGrate', 'Service grating', 'floor'],
  ['Kit_FloorHazard', 'Hazard edge plate', 'floor'],
];

export const ASSET_CATALOGUE = Object.freeze([
  ...active.map(([node, title, category]) => ({ node, title, category, stage: 'In game', model: MODEL_KEYS.units })),
  ...reserve.map(([node, title, category]) => ({ node, title, category, stage: 'Production reserve', model: MODEL_KEYS.productionReserve })),
  ...kit.map(([node, title, category]) => ({ node, title, category, stage: 'In game', model: MODEL_KEYS.industrialKit })),
  { node: 'Prop_SnabbaSkor', title: 'Snabba skor', category: 'pickup', stage: 'In game', model: MODEL_KEYS.snabbaSkor },
].map(Object.freeze));
