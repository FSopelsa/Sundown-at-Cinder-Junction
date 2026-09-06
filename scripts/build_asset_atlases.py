"""Pack approved source sheets with stable scale/feet anchors. Requires Pillow.

Run from any directory: python scripts/build_asset_atlases.py
Source art stays untouched; each output PNG/JSON/preview is next to base_images.
Only selected PNG/JSON runtime atlases are copied into public/assets/sprites.
"""
from pathlib import Path
import json
import math
from PIL import Image, ImageDraw, ImageFilter, ImageChops
from collections import deque

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/sprites'
RUNTIME = ROOT / 'public/assets/sprites'
SIZE, GROUND = 192, 180


def grid_frames(path, cols, rows, count):
    image = Image.open(path).convert('RGBA')
    frames = []
    for i in range(count):
        col, row = i % cols, i // cols
        frame = image.crop((round(col * image.width / cols), round(row * image.height / rows),
                            round((col + 1) * image.width / cols), round((row + 1) * image.height / rows)))
        frames.append(frame)
    return frames


def isolate(frame):
    """Remove isolated fragments from a neighbouring generated grid slot."""
    alpha = frame.getchannel('A')
    mask = alpha.point(lambda a: 255 if a >= 32 else 0)
    pixels = mask.load()
    largest = []
    for y in range(frame.height):
        for x in range(frame.width):
            if not pixels[x, y]:
                continue
            component, queue = [], deque([(x, y)])
            pixels[x, y] = 0
            while queue:
                px, py = queue.popleft()
                component.append((px, py))
                for nx, ny in ((px-1, py), (px+1, py), (px, py-1), (px, py+1)):
                    if 0 <= nx < frame.width and 0 <= ny < frame.height and pixels[nx, ny]:
                        pixels[nx, ny] = 0
                        queue.append((nx, ny))
            if len(component) > len(largest):
                largest = component
    clean = Image.new('L', frame.size)
    ImageDraw.Draw(clean).point(largest, fill=255)
    clean = clean.filter(ImageFilter.MaxFilter(9))
    frame.putalpha(ImageChops.multiply(alpha, clean))
    return frame


def normalize(frames, body_height):
    frames = [isolate(frame) for frame in frames]
    anchors = []
    heights = []
    for frame in frames:
        solid = frame.getchannel('A').point(lambda a: 255 if a >= 160 else 0)
        box = solid.getbbox()
        if not box:
            raise ValueError('Empty source animation frame')
        # The lower structure/boots define the anchor, never a sideways projectile.
        band_top = box[1] + round((box[3] - box[1]) * .70)
        feet = solid.crop((0, band_top, frame.width, box[3])).getbbox()
        anchors.append(((feet[0] + feet[2]) / 2, box[3]))
        heights.append(box[3] - box[1])
    scale = body_height / sorted(heights)[len(heights) // 2]
    normalized = []
    for frame, (ax, ay) in zip(frames, anchors):
        resized = frame.resize((round(frame.width * scale), round(frame.height * scale)), Image.Resampling.LANCZOS)
        output = Image.new('RGBA', (SIZE, SIZE))
        output.alpha_composite(resized, (round(SIZE / 2 - ax * scale), round(GROUND - ay * scale)))
        normalized.append(output)
    return normalized


def pack(folder, stem, groups):
    named = []
    animations = {}
    for name, frames, fps, loop in groups:
        names = [f'{name}-{i:02d}' for i in range(len(frames))]
        animations[name] = {'frames': names, 'frameRate': fps, 'repeat': -1 if loop else 0}
        named.extend(zip(names, frames))
    columns = 4 if len(named) <= 8 else 6
    rows = math.ceil(len(named) / columns)
    sheet = Image.new('RGBA', (SIZE * columns, SIZE * rows))
    atlas = {'frames': {}, 'meta': {'app': 'Cinder Junction asset pipeline', 'image': f'{stem}.png',
        'format': 'RGBA8888', 'size': {'w': sheet.width, 'h': sheet.height}, 'scale': '1',
        'anchor': {'x': .5, 'y': GROUND / SIZE}, 'animations': animations}}
    for i, (name, frame) in enumerate(named):
        x, y = i % columns * SIZE, i // columns * SIZE
        sheet.alpha_composite(frame, (x, y))
        atlas['frames'][name] = {'frame': {'x': x, 'y': y, 'w': SIZE, 'h': SIZE},
            'rotated': False, 'trimmed': False, 'spriteSourceSize': {'x': 0, 'y': 0, 'w': SIZE, 'h': SIZE},
            'sourceSize': {'w': SIZE, 'h': SIZE}}
    destination = SOURCE / folder
    destination.mkdir(parents=True, exist_ok=True)
    sheet.save(destination / f'{stem}.png', optimize=True)
    (destination / f'{stem}.json').write_text(json.dumps(atlas, indent=2) + '\n', encoding='utf-8')
    preview = Image.new('RGBA', sheet.size, '#18232e')
    draw = ImageDraw.Draw(preview)
    for y in range(0, sheet.height, 16):
        for x in range(0, sheet.width, 16):
            if (x // 16 + y // 16) % 2:
                draw.rectangle((x, y, x + 15, y + 15), fill='#223340')
    preview.alpha_composite(sheet)
    preview.convert('RGB').save(destination / f'{stem}-preview.png')
    # Small looping motion preview, with the same baseline as the game.
    preview_frames = []
    for _, frame in named:
        canvas = Image.new('RGBA', frame.size, '#18232e')
        canvas.alpha_composite(frame)
        preview_frames.append(canvas.convert('RGB'))
    preview_frames[0].save(destination / f'{stem}-preview.gif', save_all=True,
        append_images=preview_frames[1:], duration=90, loop=0)
    RUNTIME.mkdir(parents=True, exist_ok=True)
    for suffix in ('png', 'json'):
        (RUNTIME / f'{stem}.{suffix}').write_bytes((destination / f'{stem}.{suffix}').read_bytes())
    print(f'{stem}: {len(named)} frames, {sheet.width}x{sheet.height}, anchor {GROUND}/{SIZE}')


def main():
    for folder, stem in [('cold_Iron_Longshot', 'cold-iron-longshot'), ('tesla_coil', 'tesla-coil')]:
        frames = normalize(grid_frames(SOURCE / folder / f'{stem}-raw.png', 4, 2, 8), 158)
        frames[-1] = frames[0].copy()
        pack(folder, stem, [('attack', frames, 16, False)])
    run = normalize(grid_frames(SOURCE / 'singularity_hero/base_images/Singularity-run-trimmed.png', 5, 5, 21)[1:], 142)
    cast = normalize(grid_frames(SOURCE / 'singularity_hero/singularity-cast-raw.png', 3, 2, 6), 142)
    cast[-1] = cast[0].copy()
    pack('singularity_hero', 'singularity-hero', [('idle', [cast[0]], 1, False),
        ('run', run, 20, True), ('cast', cast, 16, False)])


if __name__ == '__main__':
    main()
