# Clear Zip Bag

Reference-led reusable prop based on the user-supplied `IMG_0548.jpeg`.
Inspect it at `/?assets&model=Prop_ZipBag`; the Opening slider separates both
film leaves and their closure strips continuously from closed to fully open.

## Included

- `assets/blender/cinder-zip-bag.blend`: editable source, shape keys and packed maps.
- `assets/blender/build_zip_bag.py`: deterministic authoring script.
- `public/assets/models/cinder-zip-bag.glb`: standalone, self-contained game asset.
- Manifest key `MODEL_KEYS.zipBag`, root `Prop_ZipBag`.
- Six meshes, three materials, two original 512x512 normal/roughness textures.
- 10,264 triangles, approximately 1 MiB; no external decoder or texture requests.
- Real punched header holes, wavy plastic silhouette, side/bottom welds, raised
  closure lines and separate green strips. No photograph is mapped onto the bag.
- `Zip_Open` morph target on all six parts; default state is closed and empty.
- `ZipBag_ContentAnchor` and `ZipBag_HangingAnchor` for later placement/attachment.

The front faces +X, Y is up and the root is at ground centre. Height is about
one game cell, width 0.62 cells; scale instances to their intended use. The photo
does not provide measured physical dimensions, and the unseen reverse side and
opening deformation are reasonable modelling interpretations, not a 3D scan.

## Runtime Use

Load only this manifest entry when a scene needs the prop, then clone it normally:

```js
const library = await ModelLibrary.load(
  { models: [getModelAsset(MODEL_KEYS.zipBag)] },
  { includeReserve: true },
);
const bag = library.cloneNamed(MODEL_KEYS.zipBag, 'Prop_ZipBag');
scene.add(bag);
setZipBagOpening(bag, 0.75); // 0 = closed, 1 = open; values are clamped.
```

`setZipBagOpening` is exported from `src/three/zipBag.js`. Copies share geometry
and textures but have independent opening weights. Animation systems can tween
the value; other engines can drive the standard GLB morph directly. There are
no baked animation clips, cloth simulation or skeletal rig.

Thin-film materials use alpha blending, normal mapping and clearcoat. They do
not cast an opaque rectangular shadow. This is a WebGL-friendly approximation,
not ray-traced multilayer refraction. Avoid stacking many transparent bags in a
single view. There is no collision mesh or LOD chain: add a simple interaction
proxy and cheaper distant model if later gameplay requires them.

The prop is registered but not placed into a level or downloaded during ordinary
play. No pickup, inventory, crafting or container rules have been invented.
Those rules belong in the authoritative simulation when its role is decided.

## Rebuild

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python assets/blender/build_zip_bag.py
npm.cmd run assets:prepare:zip-bag
npm.cmd run check
```

Only the bag files are rebuilt. Keep direct artistic edits in a separate source
copy or incorporate them into the generator before rebuilding. The photo is
preserved under `assets/references/zip_bag/`; project-wide image ignore rules
mean that reference is local, while its hash is recorded in `build-report.json`.
The GLB remains self-contained without the photograph.

See [provenance](../provenance/zip-bag.md) and [verification](verification.md).
