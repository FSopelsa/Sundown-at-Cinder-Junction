# Helping out

Thanks for trying the game. This is a hobby project, so there is no heavy
contribution process.

## Get it running

You need Node.js `^20.19.0` or `>=22.12.0`.

```powershell
git clone https://github.com/FSopelsa/Sundown-at-Cinder-Junction.git
Set-Location Sundown-at-Cinder-Junction
npm.cmd ci
npm.cmd run check
npm.cmd run dev -- --host 127.0.0.1
```

Start with `main`. The default page opens the current Three.js level.

## A few useful things to know

- `src/game/` contains the rules and saveable game state.
- `src/three/` displays that state in 3D.
- `src/ui/` contains the HUD.
- Keep gameplay rules out of the Three.js renderer.
- Add runtime assets through `src/game/assets/manifest.js`.
- Blender sources are in `assets/blender/`; exported GLBs are in
  `public/assets/models/`.
- Check the source and licence before adding art or audio from elsewhere.

Before sharing a change, run:

```powershell
npm.cmd run check
```

If it changes something visible, also play a raid and check it in the browser.

I have not chosen a licence for the project yet, so please ask before reusing
its code or assets somewhere else.
