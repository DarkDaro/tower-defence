#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Этап 5 — спрайты: пиксель-арт генератор (тёмное фэнтези).
Рисует спрайты в символьную сетку координатными примитивами,
затем проход света/тени и экспорт PNG + превью-лист.
Запуск:  python3 scripts/make_sprites.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, 'assets', 'sprites')
W = H = 40          # логическая сетка
SCALE = 4           # экспорт ×4 (160×160)

# ---------- палитра ----------
C = {
    'o': (24, 20, 32),      # контур/тёмная щель
    # железо
    'I': (156, 167, 186), 'i': (110, 119, 136), 'b': (70, 77, 94),
    # золото
    'm': (198, 160, 42),  'M': (236, 203, 84),
    # кожа орка
    'G': (112, 164, 82),  'g': (80, 124, 60),  'd': (50, 82, 44),
    # мех
    'w': (128, 112, 92),  'W': (156, 140, 118), 'v': (92, 80, 64),
    # кожаные ремни/сапоги
    'L': (152, 106, 62),  'l': (122, 82, 48),  'k': (84, 55, 32),
    # кость
    'S': (242, 236, 218), 's': (216, 208, 186), 'B': (164, 154, 130),
    # мантия лича
    'P': (92, 68, 148),   'p': (62, 44, 102),  'q': (40, 28, 70),
    # холодное свечение
    'c': (112, 214, 230), 'C': (206, 248, 252),
    # глаз (тёплый)
    'E': (255, 158, 62),
    # камень
    'N': (146, 142, 155), 'n': (112, 108, 120), 'u': (76, 73, 85),
    # дерево
    'F': (172, 124, 76),  'f': (126, 88, 52),
}
KEYS = set(C) - {'.'}

# ---------- примитивы ----------
def grid():
    return [['.'] * W for _ in range(H)]

def px(g, x, y, ch):
    if 0 <= x < W and 0 <= y < H:
        g[y][x] = ch

def rect(g, x0, y0, x1, y1, ch):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            px(g, x, y, ch)

def vline(g, x, y0, y1, ch): rect(g, x, y0, x, y1, ch)
def hline(g, y, x0, x1, ch): rect(g, x0, y, x1, y, ch)

def disc(g, cx, cy, r, ch):
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                px(g, x, y, ch)

def ellip(g, cx, cy, rx, ry, ch):
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
                px(g, x, y, ch)

def rows(g):
    return [''.join(r) for r in g]

# ---------- свет и тень ----------
def _mix(rgb, k):
    r, gg, b = rgb
    if k >= 0:
        return (int(r + (255 - r) * k), int(gg + (255 - gg) * k), int(b + (255 - b) * k))
    return (int(r * (1 + k)), int(gg * (1 + k)), int(b * (1 + k)))

def shade(g, dark=-0.35, top=0.30, left=0.12):
    """Внутренняя кромка темнее, грань сверху/слева светлее — ручной свет."""
    out = [r[:] for r in g]
    solid = lambda x, y: 0 <= x < W and 0 <= y < H and g[y][x] in KEYS
    for y in range(H):
        for x in range(W):
            if not solid(x, y):
                continue
            ch = g[y][x]
            if not solid(x, y + 1) or not solid(x + 1, y):
                out[y][x] = ch  # пометка не нужна, тень ниже
            k = 0.0
            if not solid(x, y - 1): k += top
            if not solid(x - 1, y): k += left
            if not solid(x, y + 1) or not solid(x + 1, y): k += dark
            if k:
                r, gg, b = C[ch]
                out[y][x] = _mix((r, gg, b), max(-0.62, min(0.55, k)))
    return out

# ================= ОРК-ВОЖДЬ (босс) =================
def orc_chief():
    g = grid()
    # ноги
    rect(g, 12, 30, 17, 36, 'g'); rect(g, 12, 34, 17, 36, 'k')   # левая + сапог
    rect(g, 22, 30, 27, 36, 'g'); rect(g, 22, 34, 27, 36, 'k')
    px(g, 12, 30, 'G'); px(g, 22, 30, 'G')
    # набедренная пелерина из меха
    rect(g, 10, 28, 29, 31, 'w')
    hline(g, 28, 11, 28, 'W')
    for x in range(10, 30, 3): px(g, x, 32, 'v')
    # торс: кожаный доспех
    rect(g, 11, 20, 28, 29, 'l')
    hline(g, 20, 12, 27, 'L'); hline(g, 21, 11, 12, 'L')
    # крест-ремни
    for i in range(9):
        px(g, 12 + i, 21 + i, 'k'); px(g, 12 + i, 22 + i, 'k')
        px(g, 27 - i, 21 + i, 'k'); px(g, 27 - i, 22 + i, 'k')
    px(g, 16, 25, 'm'); px(g, 17, 25, 'm'); px(g, 22, 25, 'm'); px(g, 23, 25, 'm')
    # пояс
    rect(g, 10, 27, 29, 28, 'k'); hline(g, 27, 10, 29, 'L')
    px(g, 18, 27, 'm'); px(g, 19, 27, 'm'); px(g, 18, 28, 'm'); px(g, 19, 28, 'm')
    # плечи-погоны из железа и меха
    rect(g, 8, 19, 13, 22, 'w'); rect(g, 26, 19, 31, 22, 'w')
    hline(g, 19, 9, 12, 'W'); hline(g, 19, 27, 30, 'W')
    rect(g, 8, 18, 12, 19, 'i'); rect(g, 27, 18, 31, 19, 'i')
    # шея и голова
    rect(g, 17, 17, 22, 20, 'g')
    ellip(g, 19, 11, 8, 7, 'g')
    hline(g, 8, 13, 26, 'g'); hline(g, 7, 15, 24, 'g')
    # шлем с клёпками
    ellip(g, 19, 7, 9, 5, 'i')
    rect(g, 10, 7, 28, 9, 'i')
    hline(g, 9, 10, 28, 'I'); hline(g, 7, 12, 26, 'I')
    rect(g, 10, 9, 28, 10, 'b')
    hline(g, 10, 10, 28, 'm')                      # золотой обруч
    for x in range(12, 28, 4): px(g, x, 8, 'M')
    # рога
    for i, (dx, dy) in enumerate([(0, 0), (1, -1), (2, -2), (2, -3), (1, -4)]):
        px(g, 10 - dx, 8 + dy, 's'); px(g, 11 - dx, 8 + dy, 's')
        px(g, 28 + dx, 8 + dy, 's'); px(g, 27 + dx, 8 + dy, 's')
    # глаза и морда
    rect(g, 13, 12, 16, 13, 'o'); rect(g, 22, 12, 25, 13, 'o')
    rect(g, 14, 12, 15, 13, 'E'); rect(g, 23, 12, 24, 13, 'E')
    rect(g, 13, 11, 25, 11, 'd')                   # насупленная бровь
    rect(g, 18, 14, 20, 15, 'd')
    # клыки вверх от челюсти
    rect(g, 13, 14, 14, 18, 'S'); px(g, 13, 18, 'B'); px(g, 14, 18, 'B')
    rect(g, 24, 14, 25, 18, 'S'); px(g, 24, 18, 'B'); px(g, 25, 18, 'B')
    hline(g, 17, 15, 23, 'o')                      # рот
    # боевой топор справа
    vline(g, 33, 12, 34, 'k'); vline(g, 34, 12, 34, 'k'); px(g, 33, 12, 'F'); px(g, 34, 12, 'F')
    rect(g, 30, 6, 39, 12, 'i')
    rect(g, 29, 7, 39, 11, 'i'); hline(g, 7, 29, 39, 'I'); hline(g, 8, 29, 39, 'I')
    rect(g, 30, 12, 39, 13, 'b')
    hline(g, 9, 30, 39, 'I')
    hline(g, 6, 29, 39, 'I'); vline(g, 29, 6, 13, 'I')   # лезвийная кромка
    vline(g, 33, 6, 12, 'F'); px(g, 34, 6, 'F')    # проушина
    px(g, 30, 6, 'I'); px(g, 39, 6, 'I')
    px(g, 35, 34, 'k'); px(g, 34, 35, 'b')         # рукоять
    # кулак на древке
    rect(g, 31, 23, 36, 26, 'g'); hline(g, 23, 31, 36, 'G')
    vline(g, 33, 23, 26, 'k'); vline(g, 34, 23, 26, 'k')
    return g

# ================= ЛИЧ-КОРОЛЬ (босс) =================
def lich_king():
    g = grid()
    # посох слева
    vline(g, 5, 8, 35, 'k'); vline(g, 6, 8, 35, 'f'); px(g, 5, 8, 'F')
    disc(g, 5, 5, 3, 'c'); disc(g, 5, 5, 2, 'C'); px(g, 4, 4, 'C')
    # корона
    for x in (13, 19, 25):
        rect(g, x - 1, 2, x + 1, 3, 'm'); px(g, x, 1, 'M')
    rect(g, 12, 4, 26, 6, 'm'); hline(g, 4, 12, 26, 'M')
    px(g, 19, 5, 'c'); px(g, 13, 5, 'c'); px(g, 25, 5, 'c')
    # череп
    ellip(g, 19, 11, 8, 6, 's')
    rect(g, 12, 11, 26, 15, 's'); hline(g, 8, 13, 25, 'S'); hline(g, 9, 12, 26, 'S')
    # глазницы со свечением (симметрично)
    rect(g, 13, 11, 16, 13, 'o'); rect(g, 22, 11, 25, 13, 'o')
    rect(g, 14, 12, 15, 13, 'c'); rect(g, 23, 12, 24, 13, 'c')
    px(g, 14, 12, 'C'); px(g, 23, 12, 'C')
    # нос и зубы
    rect(g, 18, 14, 20, 15, 'o')
    for x in range(13, 26, 2): px(g, x, 16, 'o')
    hline(g, 16, 13, 25, 's'); hline(g, 17, 14, 24, 'B')
    rect(g, 15, 17, 23, 18, 's'); hline(g, 18, 15, 23, 'B')
    for x in range(15, 24, 3): px(g, x, 17, 'o')
    # воротник-стойка
    rect(g, 8, 19, 30, 21, 'p'); hline(g, 19, 8, 30, 'P')
    rect(g, 8, 19, 9, 21, 'P'); rect(g, 29, 19, 30, 21, 'P')
    px(g, 8, 19, 'm'); px(g, 30, 19, 'm')
    # мантия
    rect(g, 9, 22, 29, 30, 'p')
    vline(g, 11, 22, 30, 'P'); vline(g, 27, 22, 30, 'q')
    rect(g, 10, 22, 28, 23, 'P')
    # светящиеся руны по центру
    for y in (24, 27):
        px(g, 19, y, 'c'); px(g, 18, y + 1, 'c')
    # опушка и латунные застёжки
    hline(g, 22, 10, 28, 'q')
    for y in (24, 27, 30):
        px(g, 14, y, 'm'); px(g, 24, y, 'm')
    # мантия сужается, рваный низ
    rect(g, 11, 31, 27, 33, 'p'); vline(g, 13, 31, 33, 'P'); vline(g, 25, 31, 33, 'q')
    for x0, x1 in ((12, 14), (18, 20), (23, 25)):
        rect(g, x0, 34, x1, 34, 'p')
    px(g, 13, 35, 'p'); px(g, 19, 35, 'p')
    # рукав к посоху
    rect(g, 8, 23, 12, 28, 'p'); rect(g, 8, 23, 10, 26, 'P')
    rect(g, 6, 28, 10, 31, 's'); px(g, 7, 28, 'S')      # костяная кисть
    return g

# ================= БАШНЯ «ЛУЧНИК» =================
def tower_archer():
    g = grid()
    # каменное тело
    rect(g, 11, 16, 28, 36, 'n')
    vline(g, 13, 16, 36, 'N'); vline(g, 12, 16, 36, 'N')
    vline(g, 26, 16, 36, 'u'); vline(g, 27, 16, 36, 'u')
    for y in range(19, 36, 4): hline(g, y, 11, 28, 'o')
    for y in range(21, 36, 4):
        for x in range(14, 28, 6): px(g, x, y, 'o')
    # бойница
    rect(g, 18, 24, 20, 28, 'o'); px(g, 19, 25, 'k'); px(g, 19, 26, 'k')
    # расширенное основание
    rect(g, 9, 34, 30, 37, 'u'); rect(g, 9, 34, 30, 35, 'n')
    hline(g, 34, 10, 29, 'N'); hline(g, 37, 9, 30, 'o')
    # деревянная площадка с консолями
    rect(g, 12, 15, 27, 15, 'u'); rect(g, 10, 14, 29, 14, 'F')
    rect(g, 8, 11, 31, 13, 'f')
    hline(g, 11, 8, 31, 'F'); hline(g, 13, 8, 31, 'o')
    for x in range(9, 31, 5): px(g, x, 12, 'o')
    # зубцы
    for x0 in (8, 15, 22, 29):
        rect(g, x0, 8, x0 + 3, 10, 'n'); hline(g, 8, x0, x0 + 3, 'N')
    px(g, 8, 10, 'o'); px(g, 31, 10, 'o')
    # лучник за зубцами: капюшон и плечи
    ellip(g, 19, 6, 4, 3, 'g'); rect(g, 16, 6, 22, 8, 'g')
    hline(g, 4, 17, 21, 'G'); px(g, 17, 3, 'G')
    rect(g, 17, 6, 21, 8, 'k')                      # тень лица
    px(g, 18, 7, 'E'); px(g, 20, 7, 'E')
    rect(g, 15, 9, 23, 10, 'g'); hline(g, 9, 16, 22, 'G')
    # колчан за спиной
    vline(g, 14, 6, 9, 'k'); px(g, 14, 5, 'f')
    for y in (4, 5): px(g, 13, y, 'f')
    # лук (справа, вертикально)
    vline(g, 26, 2, 10, 'f')
    px(g, 25, 3, 'f'); px(g, 25, 9, 'f'); px(g, 27, 5, 'f'); px(g, 27, 7, 'f')
    vline(g, 24, 3, 9, 'S')
    return g

# ================= БАШНЯ «ПУШКА» =================
def tower_cannon():
    g = grid()
    # ствол под углом вверх-вправо: повёрнутый прямоугольник с сужением
    ax0, ay0, ax1, ay1 = 14, 21, 33, 8
    adx, ady = ax1 - ax0, ay1 - ay0
    L = (adx * adx + ady * ady) ** 0.5
    nx, ny = -ady / L, adx / L          # нормаль (положит. сторона — низ-право)
    steps = 72
    for s in range(steps + 1):
        t = s / steps
        cx = ax0 + adx * t; cy = ay0 + ady * t
        w = 3.4 - 1.1 * t               # сужение к дулу
        if t > 0.94: w += 1.1            # раструб дула
        for d2 in range(-8, 9):
            d = d2 / 2
            if abs(d) > w: continue
            X = int(round(cx + nx * d)); Y = int(round(cy + ny * d))
            if t > 0.96: ch = 'b'        # тень канала
            elif abs(d) < w - 1.2: ch = 'i'
            elif d < 0: ch = 'I'         # верхняя грань светится
            else: ch = 'b'
            px(g, X, Y, ch)
    # латунные обручи поперёк ствола
    for t in (0.32, 0.62):
        cx = ax0 + adx * t; cy = ay0 + ady * t; w = 3.4 - 1.1 * t + 0.6
        for d2 in range(-8, 9):
            d = d2 / 2
            if abs(d) > w: continue
            px(g, int(round(cx + nx * d)), int(round(cy + ny * d)), 'm' if d < w - 1 else 'M')
    # казённик
    disc(g, 14, 21, 4, 'b'); disc(g, 14, 21, 3, 'i'); px(g, 13, 19, 'I'); px(g, 12, 20, 'I')
    # лафет с колесом
    rect(g, 10, 23, 22, 27, 'F'); hline(g, 23, 10, 22, 'F'); hline(g, 27, 10, 22, 'o')
    for x in (12, 16, 20): px(g, x, 24, 'k'); px(g, x, 25, 'k')
    disc(g, 11, 29, 3, 'k'); disc(g, 11, 29, 2, 'F'); px(g, 11, 29, 'k')   # колесо
    disc(g, 20, 29, 3, 'k'); disc(g, 20, 29, 2, 'F'); px(g, 20, 29, 'k')
    # каменное основание
    rect(g, 7, 28, 32, 37, 'n')
    vline(g, 10, 28, 37, 'N'); vline(g, 9, 28, 37, 'N')
    vline(g, 29, 28, 37, 'u'); vline(g, 30, 28, 37, 'u')
    for y in range(31, 37, 4): hline(g, y, 7, 32, 'o')
    hline(g, 28, 7, 32, 'N')
    rect(g, 7, 36, 32, 37, 'u'); hline(g, 37, 7, 32, 'o')
    # бочка пороха слева
    rect(g, 2, 31, 6, 37, 'f'); hline(g, 31, 2, 6, 'F')
    hline(g, 33, 2, 6, 'i'); hline(g, 36, 2, 6, 'i')
    px(g, 4, 30, 'k'); px(g, 3, 29, 'k')             # фитиль
    px(g, 3, 29, 'E')                                # тлеющий огонёк
    # ядро у подножия
    disc(g, 34, 35, 2, 'i'); px(g, 33, 34, 'I')
    return g

SPRITES = {
    'bosses/orc_chief':   ('Орк-вождь', orc_chief),
    'bosses/lich_king':   ('Лич-король', lich_king),
    'towers/archer':      ('Лучник', tower_archer),
    'towers/cannon':      ('Пушка', tower_cannon),
}

def render(shaded):
    img = Image.new('RGBA', (W * SCALE, H * SCALE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for y in range(H):
        for x in range(W):
            v = shaded[y][x]
            if v == '.':
                continue
            rgb = C[v] if isinstance(v, str) else v   # символ палитры или уже смешанный RGB
            d.rectangle([x * SCALE, y * SCALE, (x + 1) * SCALE - 1, (y + 1) * SCALE - 1],
                        fill=tuple(rgb) + (255,))
    return img

def main():
    os.makedirs(os.path.join(SPR, 'enemies'), exist_ok=True)
    os.makedirs(os.path.join(SPR, 'bosses'), exist_ok=True)
    os.makedirs(os.path.join(SPR, 'towers'), exist_ok=True)
    images = {}
    for key, (title, painter) in SPRITES.items():
        shaded = shade(painter())
        img = render(shaded)
        path = os.path.join(SPR, key + '.png')
        img.save(path)
        images[title] = img
        print('OK', path)
    # превью-лист
    title_font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
    label_font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)
    pad, cell, head = 24, 300, 64
    cols = 2
    rows_n = (len(images) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cell + pad * 2, head + rows_n * cell + pad), (13, 11, 18))
    d = ImageDraw.Draw(sheet)
    d.text((pad, 18), 'Этап 5 — образцы стиля спрайтов',
           font=title_font, fill=(222, 214, 196))
    for i, (title, img) in enumerate(images.items()):
        cx = pad + (i % cols) * cell
        cy = head + (i // cols) * cell
        d.rectangle([cx, cy, cx + cell - 1, cy + cell - 1], outline=(60, 52, 70), width=1)
        big = img.resize((240, 240), Image.NEAREST)
        sheet.paste(big, (cx + (cell - 240) // 2, cy + 12), big)
        small = img.resize((52, 52), Image.NEAREST)   # как в бою
        sheet.paste(small, (cx + 14, cy + cell - 78), small)
        d.text((cx + 80, cy + cell - 66), title, font=label_font, fill=(196, 186, 166))
        d.text((cx + 80, cy + cell - 44), 'в бою ≈ 52 px', font=label_font, fill=(130, 122, 140))
    out = os.path.join(ROOT, 'docs', 'sprites_preview.png')
    sheet.save(out)
    print('OK', out)

if __name__ == '__main__':
    main()
