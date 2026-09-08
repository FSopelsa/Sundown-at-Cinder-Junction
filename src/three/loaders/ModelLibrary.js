import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ASSET_MANIFEST } from '../../game/assets/manifest.js';

function prepareForRuntime(root) {
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = true;
  });
  return root;
}

export class ModelLibrary {
  constructor(models = new Map(), failures = []) {
    this.models = models;
    this.failures = failures;
  }

  static async load(manifest = ASSET_MANIFEST) {
    const loader = new GLTFLoader();
    const models = new Map();
    const failures = [];
    await Promise.all(manifest.models.map(async (asset) => {
      try {
        const gltf = await loader.loadAsync(asset.path);
        models.set(asset.key, prepareForRuntime(gltf.scene));
      } catch (error) {
        failures.push({ key: asset.key, path: asset.path, error });
      }
    }));
    return new ModelLibrary(models, failures);
  }

  clone(key) {
    const source = this.models.get(key);
    return source?.clone(true) ?? null;
  }

  cloneNamed(key, name) {
    const source = this.models.get(key)?.getObjectByName(name);
    return source?.clone(true) ?? null;
  }

  dispose() {
    const disposedGeometry = new Set();
    const disposedMaterials = new Set();
    for (const root of this.models.values()) {
      root.traverse((node) => {
        if (!node.isMesh) return;
        if (node.geometry && !disposedGeometry.has(node.geometry)) {
          disposedGeometry.add(node.geometry);
          node.geometry.dispose();
        }
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) {
          if (material && !disposedMaterials.has(material)) {
            disposedMaterials.add(material);
            material.dispose();
          }
        }
      });
    }
    this.models.clear();
  }
}
