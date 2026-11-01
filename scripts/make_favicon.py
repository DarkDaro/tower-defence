#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Иконки «Цитадели Орды»: тёмная башня с угольным окном и порталом у подножия.
Единый источник арта для favicon (16/32/ico), apple-touch, манифеста (192/512, maskable).
Стиль спрайтов v2: болотная олива, тёмное железо, глаза-угли, фиолетовый портал выхода.
"""
from PIL import Image, ImageDraw, ImageFilter
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets')
S = 8  # суперсэмпл: рисуем в 4096, сжимаем — гладкие края на любом размере


def rounded_bg(size, radius_frac, border=True):
    """Фон: тёмный градиент + рамка цвета игровой оправы."""
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    r = int(size * radius_frac)
    # вертикальный градиент построчно внутри скруглённого квадрата
    top, bot = (30, 20, 17), (10, 5, 5)
    for y in range(size):
        t = y / (size - 1)
        c = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)) + (255,)
        d.line([(0, y), (size, y)], fill=c)
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
    bg = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    bg.paste(im, (0, 0), mask)
    if border:
        bd = ImageDraw.Draw(bg)
        w = max(2, size // 28)
        bd.rounded_rectangle([w // 2, w // 2, size - 1 - w // 2, size - 1 - w // 2],
                             radius=r, outline=(139, 58, 58, 255), width=w)
    return bg


def draw_tower(im, u, glow_layer=None):
    """Башня в координатах 64-й сетки: u = size/64. glow_layer — для свечений."""
    d = ImageDraw.Draw(im)

    def X(v): return v * u

    # свечение окна (уголёк) — отдельным слоем с блюром
    if glow_layer is not None:
        gd = ImageDraw.Draw(glow_layer)
        gd.ellipse([X(32 - 7), X(30 - 7), X(32 + 7), X(30 + 7)], fill=(255, 160, 60, 110))
        gd.ellipse([X(32 - 15), X(51), X(32 + 15), X(61)], fill=(150, 60, 220, 90))

    # портал выхода у подножия: фиолетовое пекло
    d.ellipse([X(32 - 13), X(51), X(32 + 13), X(60)], fill=(120, 30, 180, 90))
    d.ellipse([X(32 - 8), X(52.5), X(32 + 8), X(58.5)], fill=(168, 70, 255, 160))
    d.ellipse([X(32 - 4), X(54), X(32 + 4), X(57)], fill=(215, 130, 255, 220))

    # тело башни: трапеция, болотная олива
    body = [(X(21), X(52)), (X(23.2), X(23)), (X(40.8), X(23)), (X(43), X(52))]
    d.polygon(body, fill=(61, 68, 51, 255), outline=(30, 34, 22, 255), width=max(1, int(1.4 * u)))

    # кладка: пара горизонтальных швов
    for yy in (33, 42):
        d.line([(X(22.4 + (yy - 23) * 0.07), X(yy)), (X(41.6 - (yy - 23) * 0.07), X(yy))],
               fill=(46, 52, 38, 255), width=max(1, int(0.8 * u)))

    # зубцы (мерлоны): три столбика
    merl = [(20.4, 15, 25.6, 23), (29.4, 15, 34.6, 23), (38.4, 15, 43.6, 23)]
    for (x1, y1, x2, y2) in merl:
        d.rectangle([X(x1), X(y1), X(x2), X(y2)], fill=(74, 81, 56, 255),
                    outline=(30, 34, 22, 255), width=max(1, int(1.2 * u)))
    # перемычка между зубцами
    d.rectangle([X(20.4), X(19.5), X(43.6), X(23)], fill=(74, 81, 56, 255),
                outline=(30, 34, 22, 255), width=max(1, int(1.0 * u)))

    # окно-уголёк: вертикальная щель
    d.rounded_rectangle([X(30.6), X(27), X(33.4), X(35)], radius=X(1.4), fill=(255, 179, 71, 255))
    d.rounded_rectangle([X(31.4), X(28), X(32.6), X(34)], radius=X(0.6), fill=(255, 229, 160, 255))

    # дверь: тёмная арка
    d.polygon([(X(28), X(52)), (X(28), X(46))], fill=(23, 18, 14, 255))
    d.pieslice([X(28), X(42), X(36), X(50)], 180, 360, fill=(23, 18, 14, 255))
    d.rectangle([X(28), X(46), X(36), X(52)], fill=(23, 18, 14, 255))
    # дверные петли-угли
    d.ellipse([X(31.2), X(48), X(32.8), X(49.6)], fill=(255, 120, 40, 200))


def render(size, maskable=False):
    canvas = size * S
    if maskable:
        # маскируемая: арт целиком в безопасной зоне 80%, фон на весь квадрат
        im = Image.new('RGBA', (canvas, canvas), (13, 8, 7, 255))
        d = ImageDraw.Draw(im)
        for y in range(canvas):
            t = y / (canvas - 1)
            c = tuple(int((26, 17, 15)[i] + ((10, 5, 5)[i] - (26, 17, 15)[i]) * t) for i in range(3)) + (255,)
            d.line([(0, y), (canvas, y)], fill=c)
        inner = int(canvas * 0.80)
        art = Image.new('RGBA', (inner, inner), (0, 0, 0, 0))
        glow = Image.new('RGBA', (inner, inner), (0, 0, 0, 0))
        draw_tower(art, inner / 64, glow)
        glow = glow.filter(ImageFilter.GaussianBlur(inner * 0.045))
        im.alpha_composite(glow, ((canvas - inner) // 2, (canvas - inner) // 2))
        im.alpha_composite(art, ((canvas - inner) // 2, (canvas - inner) // 2))
    else:
        im = rounded_bg(canvas, 0.225)
        glow = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
        art = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
        draw_tower(art, canvas / 64, glow)
        glow = glow.filter(ImageFilter.GaussianBlur(canvas * 0.035))
        im.alpha_composite(glow)
        im.alpha_composite(art)
    return im.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(os.path.join(OUT, 'icons'), exist_ok=True)
    jobs = [
        ('icons/icon-512.png', 512, False),
        ('icons/icon-192.png', 192, False),
        ('icons/icon-maskable-512.png', 512, True),
        ('icons/icon-maskable-192.png', 192, True),
        ('apple-touch-icon.png', 180, False),
        ('favicon-32.png', 32, False),
        ('favicon-16.png', 16, False),
    ]
    for name, size, mask in jobs:
        render(size, mask).save(os.path.join(OUT, name))
        print('ok', name)
    # favicon.ico: 16+32 в одном файле для старых браузеров и вьюверов
    ico = Image.open(os.path.join(OUT, 'favicon-32.png'))
    small = Image.open(os.path.join(OUT, 'favicon-16.png'))
    ico.save(os.path.join(OUT, 'favicon.ico'), sizes=[(32, 32), (16, 16)], append_images=[small])
    print('ok favicon.ico')


if __name__ == '__main__':
    main()
