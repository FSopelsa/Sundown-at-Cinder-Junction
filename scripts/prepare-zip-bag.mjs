import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, dedup, prune } from '@gltf-transform/functions';
import { MODEL_KEYS, getModelAsset } from '../src/game/assets/manifest.js';

const path = `public${getModelAsset(MODEL_KEYS.zipBag).path}`;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const document = await io.read(path);
// Most morph deltas are nonzero, so dense accessors are smaller than sparse storage.
for (const accessor of document.getRoot().listAccessors()) accessor.setSparse(false);
await document.transform(weld(), dedup(), prune({ keepLeaves: true, keepExtras: true, keepAttributes: true }));
for (const mesh of document.getRoot().listMeshes()) {
  for (const primitive of mesh.listPrimitives()) {
    if (!primitive.getMaterial()?.getNormalTexture()) primitive.setAttribute('TANGENT', null);
  }
}
await document.transform(prune({ keepLeaves: true, keepExtras: true, keepAttributes: true }));
await io.write(path, document);
const bytes = await readFile(path);
const root = document.getRoot();
const reportPath = 'docs/3d/zip-bag/build-report.json';
const report = JSON.parse(await readFile(reportPath, 'utf8'));
report.packages = [{ key: MODEL_KEYS.zipBag, path, bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  meshes: root.listMeshes().length, materials: root.listMaterials().length,
  textures: root.listTextures().length,
  optimization: 'weld, dedup, prune; semantic nodes and Zip_Open morphs retained; no decoder required' }];
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Zip bag: ${(bytes.length / 1048576).toFixed(2)} MiB; ${root.listMeshes().length} meshes; ${root.listTextures().length} textures.`);
