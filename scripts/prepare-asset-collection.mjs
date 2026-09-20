import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld } from '@gltf-transform/functions';
import { MODEL_KEYS, getModelAsset } from '../src/game/assets/manifest.js';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const report = JSON.parse(await readFile('docs/3d/asset-collection/build-report.json', 'utf8'));
report.packages = [];
for (const key of [MODEL_KEYS.units, MODEL_KEYS.industrialKit, MODEL_KEYS.productionReserve]) {
  const asset = getModelAsset(key);
  const file = resolve(`public${asset.path}`);
  const before = (await stat(file)).size;
  const document = await io.read(file);
  await document.transform(weld(), dedup(), prune({ keepLeaves: true, keepAttributes: true, keepExtras: true }));
  await io.write(file, document);
  const bytes = await readFile(file);
  const root = document.getRoot();
  report.packages.push({
    key, path: `public${asset.path}`, bytes: bytes.length, rawBytes: before,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    nodes: root.listNodes().length, meshes: root.listMeshes().length,
    primitives: root.listMeshes().reduce((n, m) => n + m.listPrimitives().length, 0),
    materials: root.listMaterials().length, textures: root.listTextures().length,
    optimization: 'weld, dedup, prune; semantic roots and motion extras retained; no decoder required',
  });
  console.log(`${key}: ${(before / 1048576).toFixed(2)} -> ${(bytes.length / 1048576).toFixed(2)} MiB`);
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function resolveReference(path) {
  if (path.includes('singularity_hero')) return ['Unit_Hero'];
  if (path.includes('cold_Iron_Longshot')) return ['Tower_ColdIronLongshot', 'Prop_CryogenicPlant'];
  if (path.includes('sunspitter')) return ['Tower_Sunspitter', 'Prop_ContainmentReactor', 'Prop_Tokamak'];
  if (path.includes('tesla_coil')) return ['Tower_TeslaCoil', 'Prop_ArcPylon', 'Prop_FaradayCage'];
  if (path.includes('MechDog_enemy')) return ['Unit_RustRunner', 'Unit_TinbackHauler'];
  if (path.includes('TechSquid_enemy')) return ['Unit_RiftLeech', 'Prop_TechSquidSentinel'];
  if (path.includes('BlackComet_wave-boss')) return ['Unit_BlackComet', 'Prop_DeathComet', 'Prop_HornedComet', 'Prop_EyeOfCinder'];
  if (path.includes("floor'ground_tiles")) return ['Kit_FloorPlate', 'Kit_FloorGrate', 'Kit_FloorHazard'];
  if (path.includes('/walls/')) return ['Tower_Wall', 'Kit_FortressWall'];
  if (path.endsWith('map_sketch.jpg')) return ['Prop_ThresholdGate', 'Prop_UpgradeStation'];
  if (path.startsWith('graphicInspo/')) return ['collection-art-direction'];
  return [];
}

const hashes = new Map();
const inventory = [];
for (const file of [...await walk('assets'), ...await walk('graphicInspo')]) {
  const path = relative(process.cwd(), file).replaceAll('\\', '/');
  const bytes = await readFile(file);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const models = resolveReference(path);
  const isImage = /\.(png|jpe?g|webp|gif)$/i.test(path);
  inventory.push({
    path, bytes: bytes.length, sha256, duplicateOf: hashes.get(sha256) ?? null,
    role: isImage ? (path.includes('base_images') || path.startsWith('graphicInspo') ? 'visual-reference' : 'source-art') : 'authoring-or-metadata',
    models,
    disposition: isImage ? 'Reviewed as reference; source preserved; original 3D interpretation; pixels not shipped' : 'Preserved source or supporting metadata',
    referenceLicence: isImage ? 'Not supplied; reference-only' : null,
  });
  if (!hashes.has(sha256)) hashes.set(sha256, path);
}
await writeFile('docs/3d/asset-collection/source-inventory.json', `${JSON.stringify({ schemaVersion: 1, files: inventory }, null, 2)}\n`);
await writeFile('docs/3d/asset-collection/build-report.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`Inventoried ${inventory.length} files, ${inventory.filter(f => f.duplicateOf).length} byte-identical duplicates.`);
