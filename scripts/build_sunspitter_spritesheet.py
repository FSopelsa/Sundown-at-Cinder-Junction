#!/usr/bin/env python3
"""Build a fixed Sunspitter firing atlas from an approved full-structure frame."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


FRAME_SIZE = 192
FRAME_NAMES = (
    "sunspitter-idle-01",
    "sunspitter-charge-01",
    "sunspitter-charge-02",
    "sunspitter-charge-03",
    "sunspitter-charge-04",
    "sunspitter-fire-01",
    "sunspitter-cooldown-01",
    "sunspitter-idle-02",
)
GLOW_LEVELS = (0.04, 0.2, 0.44, 0.72, 1.0, 1.15, 0.34, 0.04)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Normalize the Sunspitter source art into an eight-frame Phaser atlas."
    )
    parser.add_argument("--input", required=True, help="Generated source sheet with a complete tower frame.")
    parser.add_argument("--output", required=True, help="Output PNG atlas path.")
    parser.add_argument("--atlas", required=True, help="Output TexturePacker-style JSON atlas path.")
    parser.add_argument("--preview", required=True, help="Output checkerboard preview path.")
    return parser.parse_args()


def visible_crop(image: Image.Image, threshold: int = 16) -> Image.Image:
    alpha = image.getchannel("A").point(lambda value: 255 if value > threshold else 0)
    bounds = alpha.getbbox()
    if bounds is None:
        raise SystemExit("The selected source frame contains no visible pixels.")
    return image.crop(bounds)


def first_grid_cell(source: Image.Image) -> Image.Image:
    """The source generator returns a four-by-two sheet; its first frame is the stable idle pose."""
    right = round(source.width / 4)
    bottom = round(source.height / 2)
    return source.crop((0, 0, right, bottom))


def normalize_structure(source: Image.Image) -> Image.Image:
    structure = visible_crop(first_grid_cell(source))
    scale = min((FRAME_SIZE - 16) / structure.width, (FRAME_SIZE - 8) / structure.height)
    width = max(1, round(structure.width * scale))
    height = max(1, round(structure.height * scale))
    structure = structure.resize((width, height), Image.Resampling.LANCZOS)
    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    frame.alpha_composite(structure, ((FRAME_SIZE - width) // 2, FRAME_SIZE - height - 4))
    return frame


def glowing_corona(level: float) -> Image.Image:
    layer = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    radius = 46 + round(level * 22)
    alpha = round(14 + level * 170)
    draw.ellipse(
        (96 - radius, 73 - radius, 96 + radius, 73 + radius),
        fill=(255, 167, 27, alpha),
    )
    return layer.filter(ImageFilter.GaussianBlur(8 + round(level * 10)))


def bright_core(level: float) -> Image.Image:
    layer = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    radius = 34 + round(level * 8)
    draw.ellipse(
        (96 - radius, 73 - radius, 96 + radius, 73 + radius),
        fill=(255, 241, 159, round(level * 92)),
    )
    return layer.filter(ImageFilter.GaussianBlur(2))


def plasma_blast(afterglow: bool = False) -> Image.Image:
    layer = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    start_x = 143
    end_x = 187 if not afterglow else 165
    half_height = 14 if not afterglow else 6
    draw.polygon(
        [(start_x, 76 - half_height), (end_x, 76 - half_height // 2), (end_x, 76 + half_height // 2), (start_x, 76 + half_height)],
        fill=(255, 116, 16, 150 if not afterglow else 90),
    )
    draw.polygon(
        [(start_x, 76 - half_height // 2), (end_x - 2, 76 - 2), (end_x - 2, 76 + 2), (start_x, 76 + half_height // 2)],
        fill=(255, 248, 201, 245 if not afterglow else 140),
    )
    glow = layer.filter(ImageFilter.GaussianBlur(5))
    glow.alpha_composite(layer)
    return glow


def compose_frame(structure: Image.Image, index: int) -> Image.Image:
    level = GLOW_LEVELS[index]
    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    frame.alpha_composite(glowing_corona(level))
    frame.alpha_composite(structure)
    frame.alpha_composite(bright_core(level))
    if index == 5:
        frame.alpha_composite(plasma_blast())
    elif index == 6:
        frame.alpha_composite(plasma_blast(afterglow=True))
    return frame


def write_atlas(path: Path) -> None:
    frames = {}
    for index, name in enumerate(FRAME_NAMES):
        column = index % 4
        row = index // 4
        frames[name] = {
            "frame": {"x": column * FRAME_SIZE, "y": row * FRAME_SIZE, "w": FRAME_SIZE, "h": FRAME_SIZE},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": FRAME_SIZE, "h": FRAME_SIZE},
            "sourceSize": {"w": FRAME_SIZE, "h": FRAME_SIZE},
        }
    payload = {
        "frames": frames,
        "meta": {
            "app": "Sunspitter sprite pipeline",
            "version": "1.0",
            "image": "sunspitter-charge.png",
            "format": "RGBA8888",
            "size": {"w": FRAME_SIZE * 4, "h": FRAME_SIZE * 2},
            "scale": "1",
        },
    }
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def checkerboard(size: tuple[int, int]) -> Image.Image:
    preview = Image.new("RGBA", size, (226, 232, 238, 255))
    draw = ImageDraw.Draw(preview)
    for y in range(0, size[1], 16):
        for x in range(0, size[0], 16):
            if (x // 16 + y // 16) % 2:
                draw.rectangle((x, y, x + 15, y + 15), fill=(244, 247, 250, 255))
    return preview


def write_preview(frames: list[Image.Image], path: Path) -> None:
    gap = 8
    width = FRAME_SIZE * 4 + gap * 3
    height = FRAME_SIZE * 2 + gap
    preview = checkerboard((width, height))
    for index, frame in enumerate(frames):
        x = (index % 4) * (FRAME_SIZE + gap)
        y = (index // 4) * (FRAME_SIZE + gap)
        preview.alpha_composite(frame, (x, y))
    preview.save(path)


def main() -> None:
    args = parse_args()
    source = Image.open(args.input).convert("RGBA")
    structure = normalize_structure(source)
    frames = [compose_frame(structure, index) for index in range(len(FRAME_NAMES))]

    output = Image.new("RGBA", (FRAME_SIZE * 4, FRAME_SIZE * 2), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        output.alpha_composite(frame, ((index % 4) * FRAME_SIZE, (index // 4) * FRAME_SIZE))

    output_path = Path(args.output)
    atlas_path = Path(args.atlas)
    preview_path = Path(args.preview)
    for path in (output_path, atlas_path, preview_path):
        path.parent.mkdir(parents=True, exist_ok=True)
    output.save(output_path)
    write_atlas(atlas_path)
    write_preview(frames, preview_path)


if __name__ == "__main__":
    main()
