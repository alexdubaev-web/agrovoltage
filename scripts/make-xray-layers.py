"""Слои подсветки «рентгена» трактора (R14, R16): прозрачные PNG, которые лежат поверх базы.

Запуск: python scripts/make-xray-layers.py
Берёт src/assets/images/xray/tractor-xray-base.png и готовые варианты
tractor-xray-<system>.png (кадр и масштаб совпадают с базой), пишет
tractor-xray-<system>-layer.png того же размера. Результат коммитится, при сборке не запускается.

Как режется слой:
- разница варианта с базой по каждому пикселю (максимум по каналам);
- мелкий шум перерисовки (тонкие контуры деталей) убирается: размытие, порог,
  морфологическое открытие, затем зона расширяется на ореол свечения и смягчается;
- внутри зоны альфа растёт с разницей, а цвет подобран так, что
  база * (1 - альфа) + цвет * альфа = вариант. Значит, база с наложенным слоем
  выглядит как готовый вариант, а вне зоны видна сама база.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

DIR = Path(__file__).resolve().parent.parent / "src" / "assets" / "images" / "xray"
SYSTEMS = ["start", "charge", "ecu", "cab", "harness", "climate"]

NOISE_BLUR = 2.5   # размытие разницы перед порогом, px
ZONE_MIN = 26      # порог разницы, с которого пиксель считается частью цепи
OPEN_SIZE = 9      # открытие: убирает линии тоньше ~9 px (шум по контурам)
HALO_SIZE = 11     # расширение зоны на ореол свечения
EDGE_BLUR = 3      # мягкий край зоны, px
ALPHA_LOW, ALPHA_HIGH = 3, 28  # разница, при которой альфа 0 и 1


def load(name):
    return np.asarray(Image.open(DIR / name).convert("RGB")).astype(np.float32)


def zone(diff):
    """Маска цепи 0..1 без мелкого шума."""
    img = Image.fromarray(np.clip(diff, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(NOISE_BLUR))
    core = img.point(lambda v: 255 if v >= ZONE_MIN else 0)
    core = core.filter(ImageFilter.MinFilter(OPEN_SIZE)).filter(ImageFilter.MaxFilter(OPEN_SIZE))
    core = core.filter(ImageFilter.MaxFilter(HALO_SIZE)).filter(ImageFilter.GaussianBlur(EDGE_BLUR))
    return np.asarray(core).astype(np.float32) / 255


def layer(base, variant):
    d = variant - base
    diff = np.abs(d).max(axis=2)
    a_px = np.clip((diff - ALPHA_LOW) / (ALPHA_HIGH - ALPHA_LOW), 0, 1)
    safe = np.where(a_px > 0, a_px, 1)[..., None]
    color = np.clip(base + d / safe, 0, 255)
    alpha = a_px * zone(diff)
    color[alpha <= 0] = 0
    rgba = np.dstack([color, alpha * 255]).round().astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def main():
    base = load("tractor-xray-base.png")
    for system in SYSTEMS:
        variant = load(f"tractor-xray-{system}.png")
        if variant.shape != base.shape:
            raise SystemExit(f"{system}: размер {variant.shape} не совпадает с базой {base.shape}")
        out = DIR / f"tractor-xray-{system}-layer.png"
        img = layer(base, variant)
        img.save(out, optimize=True)
        cover = (np.asarray(img)[..., 3] > 0).mean()
        print(f"{out.name}: непрозрачно {cover:.1%}")


if __name__ == "__main__":
    main()
