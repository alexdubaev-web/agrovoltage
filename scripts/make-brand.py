"""Однократная подготовка фирменных файлов из исходного логотипа.

Запуск: python scripts/make-brand.py <путь к logo-source.png>
Результат кладётся в src/assets/brand/ и коммитится, при сборке не запускается.
"""
import sys
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "src" / "assets" / "brand"


def white_to_alpha(img):
    """Убирает белый фон: «цвет в альфу» (как Color to Alpha в GIMP)."""
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            a = max(255 - r, 255 - g, 255 - b)
            if a < 12:
                px[x, y] = (255, 255, 255, 0)
                continue
            k = a / 255
            px[x, y] = tuple(
                max(0, min(255, round((c - 255 * (1 - k)) / k))) for c in (r, g, b)
            ) + (a,)
    return img


def crop_alpha(img, pad=0):
    box = img.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
    l, t, r, b = box
    return img.crop((max(0, l - pad), max(0, t - pad), min(img.width, r + pad), min(img.height, b + pad)))


def main(src):
    base = white_to_alpha(Image.open(src))
    full = crop_alpha(base, 2)
    full.save(OUT / "logo.png", optimize=True)

    # Знак (треугольник) и надпись лежат в исходнике друг над другом.
    alpha = base.getchannel("A")
    rows = [any(alpha.getpixel((x, y)) > 24 for x in range(base.width)) for y in range(base.height)]
    gaps = [y for y in range(1, base.height) if rows[y - 1] and not rows[y]]
    split = gaps[0] + 1
    mark = crop_alpha(base.crop((0, 0, base.width, split)), 1)
    word = crop_alpha(base.crop((0, split, base.width, base.height)), 1)
    mark.save(OUT / "logo-mark.png", optimize=True)

    # Горизонтальная версия для шапки: знак слева, надпись справа.
    mh = word.height * 2
    m = mark.resize((round(mark.width * mh / mark.height), mh), Image.LANCZOS)
    gap = round(word.height * 0.3)
    horiz = Image.new("RGBA", (m.width + gap + word.width, mh), (255, 255, 255, 0))
    horiz.paste(m, (0, 0), m)
    horiz.paste(word, (m.width + gap, (mh - word.height) // 2 + round(word.height * 0.15)), word)
    horiz.save(OUT / "logo-horizontal.png", optimize=True)

    def square(img, size, bg=None, pad=0.08):
        canvas = Image.new("RGBA", (size, size), bg or (255, 255, 255, 0))
        inner = round(size * (1 - 2 * pad))
        k = inner / max(img.width, img.height)
        s = img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))), Image.LANCZOS)
        canvas.paste(s, ((size - s.width) // 2, (size - s.height) // 2), s)
        return canvas

    square(mark, 32, pad=0.02).save(OUT / "favicon-32.png", optimize=True)
    square(mark, 180, bg=(255, 255, 255, 255), pad=0.12).convert("RGB").save(OUT / "apple-touch-icon.png", optimize=True)
    square(mark, 48, pad=0.02).save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

    og = Image.new("RGB", (1200, 630), (255, 255, 255))
    k = 460 / full.height
    big = full.resize((round(full.width * k), 460), Image.LANCZOS)
    og.paste(big, ((1200 - big.width) // 2, (630 - big.height) // 2), big)
    og.save(OUT / "og-default.png", optimize=True)


if __name__ == "__main__":
    main(sys.argv[1])
