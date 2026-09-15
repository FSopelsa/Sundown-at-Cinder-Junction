import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { ASSET_MANIFEST } from '../src/game/assets/manifest.js';

const command = process.argv[2];
const supportedCommands = new Set(['validate', 'inspect']);
const modelsDirectory = resolve('public/assets/models');
const cli = resolve('node_modules/@gltf-transform/cli/bin/cli.js');

if (!supportedCommands.has(command)) {
  throw new Error(`Expected one of ${[...supportedCommands].join(', ')}; received ${command ?? 'nothing'}.`);
}

const models = (await readdir(modelsDirectory))
  .filter((entry) => entry.endsWith('.glb'))
  .sort();

if (models.length === 0) {
  throw new Error(`No GLB files found in ${modelsDirectory}.`);
}

const manifestModelNames = new Set(
  ASSET_MANIFEST.models.map((asset) => asset.path.split('/').at(-1)),
);
const unregisteredModels = models.filter((model) => !manifestModelNames.has(model));
const missingModels = [...manifestModelNames].filter((model) => !models.includes(model));
if (unregisteredModels.length || missingModels.length) {
  throw new Error([
    unregisteredModels.length ? `Unregistered GLB files: ${unregisteredModels.join(', ')}.` : '',
    missingModels.length ? `Missing manifest GLB files: ${missingModels.join(', ')}.` : '',
  ].filter(Boolean).join(' '));
}

for (const model of models) {
  const path = resolve(modelsDirectory, model);
  if (command === 'inspect') {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const [{ size }, document] = await Promise.all([stat(path), io.read(path)]);
    const root = document.getRoot();
    const primitiveCount = root.listMeshes()
      .reduce((count, mesh) => count + mesh.listPrimitives().length, 0);
    console.log([
      `public/assets/models/${model}`,
      `  file: ${(size / 1024 / 1024).toFixed(2)} MiB`,
      `  scenes: ${root.listScenes().length}; nodes: ${root.listNodes().length}; meshes: ${root.listMeshes().length}; primitives: ${primitiveCount}`,
      `  materials: ${root.listMaterials().length}; textures: ${root.listTextures().length}; animations: ${root.listAnimations().length}`,
    ].join('\n'));
    continue;
  }

  console.log(`\n${command}: public/assets/models/${model}`);
  const exitCode = await new Promise((complete, fail) => {
    const child = spawn(
      process.execPath,
      [cli, command, path, '--ignore', 'UNUSED_OBJECT', '--limit', '20'],
      { stdio: 'inherit' },
    );
    child.once('error', fail);
    child.once('close', complete);
  });
  if (exitCode !== 0) {
    throw new Error(`glTF Transform ${command} failed for ${model} with exit code ${exitCode}.`);
  }
}
