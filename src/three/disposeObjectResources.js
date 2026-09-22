// Three.js does not release GPU buffers merely because an object leaves a
// scene. Use this only for geometry and materials created by the caller; GLB
// source resources remain owned by ModelLibrary and may be shared by clones.
export function disposeObjectResources(root, { skipNode = () => false } = {}) {
  if (!root) return;

  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();

  root.traverse((node) => {
    if (skipNode(node)) return;
    if (node.geometry) geometries.add(node.geometry);
    const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of nodeMaterials) {
      if (material) materials.add(material);
    }
  });

  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value?.isTexture) textures.add(value);
    }
    material.dispose();
  }
  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) texture.dispose();
}
