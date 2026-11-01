#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Этап 5 — спрайты v2: мрачное тёмное фэнтези.
Палитра десатурирована, чёрный контур, глубокие тени, шипы/рваные края,
глаза-угли в тени. Рисование координатными примитивами, авто-свет, PNG + превью.
Запуск:  python3 scripts/make_sprites.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, 'assets', 'sprites')
W = H = 40          # логическая сетка
SCALE = 4           # экспорт ×4 (160×160)

# ---------- палитра v2: приглушённая, тяжёлая ----------
C = {
    'o': (10, 9, 14),        # почти чёрный контур
    # тёмное железо
    'I': (108, 114, 128), 'i': (74, 79, 92),  'b': (46, 50, 60),
    # тусклая латунь
    'm': (146, 116, 44),  'M': (188, 156, 66),
    # кожа орка: болотная олива
    'G': (96, 118, 74),   'g': (68, 88, 54),  'd': (44, 58, 36),
    # глаза-угли
    'E': (255, 96, 36),   'e': (168, 54, 26),
    # кость
    'S': (226, 218, 196), 's': (192, 183, 158), 'B': (136, 128, 106),
    # мех
    'w': (84, 72, 58),    'W': (108, 94, 76), 'v': (56, 48, 38),
    # кожаные ремни/сапоги
    'L': (100, 68, 42),   'l': (74, 50, 30),  'k': (48, 32, 20),
    # мантия лича: глубокий тёмно-фиолетовый
    'P': (72, 52, 112),   'p': (46, 32, 80),  'q': (28, 19, 54),
    # холодное свечение
    'c': (104, 210, 220), 'C': (186, 242, 246),
    # запёкшаяся кровь
    'r': (118, 26, 26),   'R': (152, 40, 36), 'x': (66, 13, 13),
    # камень
    'N': (108, 104, 116), 'n': (80, 76, 88),  'u': (54, 51, 62),
    # дерево
    'F': (132, 94, 56),   'f': (96, 66, 38),
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

# ---------- контур и свет ----------
def _mix(rgb, k):
    r, gg, b = rgb
    if k >= 0:
        return (int(r + (255 - r) * k), int(gg + (255 - gg) * k), int(b + (255 - b) * k))
    return (int(r * (1 + k)), int(gg * (1 + k)), int(b * (1 + k)))

def outline(g):
    """Внешний контур: прозрачные клетки рядом с телом → почти чёрные."""
    out = [r[:] for r in g]
    solid = lambda x, y: 0 <= x < W and 0 <= y < H and g[y][x] in KEYS
    for y in range(H):
        for x in range(W):
            if g[y][x] == '.' and (solid(x + 1, y) or solid(x - 1, y) or solid(x, y + 1) or solid(x, y - 1)):
                out[y][x] = 'o'
    return out

def shade(g, dark=-0.48, top=0.24, left=0.10):
    """Внутренние кромки: сверху/слева светлее, снизу/справа сильно темнее."""
    out = [r[:] for r in g]
    solid = lambda x, y: 0 <= x < W and 0 <= y < H and g[y][x] in KEYS
    for y in range(H):
        for x in range(W):
            if not solid(x, y) or g[y][x] == 'o':
                continue  # контур не трогаем
            ch = g[y][x]
            k = 0.0
            if not solid(x, y - 1): k += top
            if not solid(x - 1, y): k += left
            if not solid(x, y + 1) or not solid(x + 1, y): k += dark
            if k:
                r, gg, b = C[ch]
                out[y][x] = _mix((r, gg, b), max(-0.62, min(0.5, k)))
    return out

# ================= ОРК-ВОЖДЬ (босс) =================
def orc_chief():
    g = grid()
    # плащ за спиной, рваный
    rect(g, 6, 20, 11, 33, 'x'); rect(g, 28, 20, 33, 33, 'x')
    rect(g, 7, 34, 9, 35, 'x');  rect(g, 30, 34, 32, 35, 'x')
    # ноги и сапоги
    rect(g, 14, 31, 18, 36, 'd'); rect(g, 21, 31, 25, 36, 'd')
    rect(g, 13, 35, 18, 37, 'k'); rect(g, 21, 35, 26, 37, 'k')
    # набедренная пелерина из меха
    rect(g, 11, 28, 28, 30, 'w'); hline(g, 28, 12, 27, 'W')
    for x in range(11, 29, 3): px(g, x, 31, 'v')
    # торс: голая кожа + боевые ремни
    rect(g, 12, 20, 27, 29, 'g'); hline(g, 20, 13, 26, 'G')
    for i in range(8):
        px(g, 13 + i, 21 + i, 'k'); px(g, 13 + i, 22 + i, 'k')
        px(g, 26 - i, 21 + i, 'k'); px(g, 26 - i, 22 + i, 'k')
    # пояс с черепом-трофеем
    rect(g, 11, 27, 28, 28, 'k'); hline(g, 27, 11, 28, 'L')
    rect(g, 18, 27, 21, 28, 's'); px(g, 19, 27, 'o'); px(g, 20, 27, 'o')
    # наплечники с шипами
    rect(g, 5, 17, 12, 22, 'i');  rect(g, 27, 17, 34, 22, 'i')
    hline(g, 17, 6, 11, 'I');     hline(g, 17, 28, 33, 'I')
    vline(g, 6, 14, 16, 'I'); vline(g, 9, 13, 16, 'I')
    vline(g, 33, 14, 16, 'I'); vline(g, 30, 13, 16, 'I')
    # шея в тени
    rect(g, 17, 17, 22, 20, 'd')
    # голова: массивная челюсть
    ellip(g, 19, 13, 7, 5, 'g'); rect(g, 13, 13, 25, 17, 'g')
    # шлем
    ellip(g, 19, 9, 9, 4, 'i'); rect(g, 10, 9, 28, 11, 'i')
    hline(g, 9, 11, 27, 'I'); rect(g, 10, 11, 28, 12, 'b')
    # длинные рога вверх-наружу
    for dx, dy in [(0, 0), (1, -1), (2, -2), (3, -3), (4, -4), (4, -5)]:
        px(g, 11 - dx, 9 + dy, 'S'); px(g, 12 - dx, 9 + dy, 'S')
        px(g, 27 + dx, 9 + dy, 'S'); px(g, 26 + dx, 9 + dy, 'S')
    # глаза-угли в чёрных впадинах
    rect(g, 14, 12, 17, 13, 'o'); rect(g, 21, 12, 24, 13, 'o')
    px(g, 15, 12, 'e'); px(g, 16, 13, 'E'); px(g, 22, 12, 'e'); px(g, 23, 13, 'E')
    # нос и пасть
    rect(g, 18, 14, 20, 15, 'd')
    rect(g, 16, 15, 22, 16, 'o')                    # тёмный рот
    # клыки вверх, поверх козырька шлема
    rect(g, 14, 11, 15, 16, 'S'); px(g, 14, 10, 'S')
    rect(g, 23, 11, 24, 16, 'S'); px(g, 24, 10, 'S')
    px(g, 14, 16, 'B'); px(g, 15, 16, 'B'); px(g, 23, 16, 'B'); px(g, 24, 16, 'B')
    # боевой топор с зазубринами и кровью (опущен ниже, отделён от шлема)
    vline(g, 33, 14, 36, 'k'); vline(g, 34, 14, 36, 'k')
    rect(g, 29, 6, 39, 14, 'i')
    hline(g, 6, 29, 39, 'I');  vline(g, 29, 6, 14, 'I')
    rect(g, 29, 14, 39, 15, 'b')
    px(g, 37, 6, '.'); px(g, 38, 6, '.'); px(g, 38, 7, '.')   # зазубрины
    px(g, 30, 13, 'r'); px(g, 31, 13, 'r'); px(g, 29, 14, 'r')  # кровь
    vline(g, 33, 6, 14, 'F'); px(g, 34, 6, 'F')
    # кулак на древке
    rect(g, 31, 24, 36, 27, 'g'); hline(g, 24, 31, 36, 'G')
    vline(g, 33, 24, 27, 'k'); vline(g, 34, 24, 27, 'k')
    return g

# ================= ЛИЧ-КОРОЛЬ (босс) =================
def lich_king():
    g = grid()
    # посох слева, дым вокруг сферы
    vline(g, 5, 9, 35, 'k'); vline(g, 6, 9, 35, 'f')
    px(g, 7, 9, 'q'); px(g, 4, 9, 'q'); px(g, 6, 10, 'q'); px(g, 3, 10, 'q')
    disc(g, 5, 6, 3, 'q'); disc(g, 5, 6, 2, 'c'); px(g, 4, 5, 'C'); px(g, 5, 4, 'C')
    # корона: тёмное железо с шипами
    rect(g, 12, 5, 26, 7, 'i'); hline(g, 5, 13, 25, 'I')
    for x in (13, 16, 22, 25):
        vline(g, x, 3, 4, 'I'); px(g, x, 2, 'I')
    vline(g, 19, 1, 4, 'I'); px(g, 19, 0, 'I')      # центральный шип выше
    px(g, 19, 6, 'c')
    # череп
    ellip(g, 19, 12, 8, 6, 's')
    rect(g, 12, 12, 26, 16, 's')
    hline(g, 7, 13, 25, 'S'); hline(g, 8, 12, 26, 'S')
    px(g, 23, 8, 'B'); px(g, 24, 9, 'B'); px(g, 24, 10, 'B')   # трещина
    # провалы глазниц с ледяными угольками
    rect(g, 13, 11, 17, 14, 'o'); rect(g, 21, 11, 25, 14, 'o')
    px(g, 15, 12, 'C'); px(g, 23, 12, 'C'); px(g, 15, 13, 'c'); px(g, 23, 13, 'c')
    # нос и зубы
    rect(g, 18, 14, 20, 16, 'o')
    for x in range(13, 26, 2): px(g, x, 15, 'o')
    hline(g, 16, 12, 26, 'B')
    rect(g, 14, 17, 24, 18, 's'); hline(g, 18, 14, 24, 'B')
    for x in (15, 17, 19, 21, 23): px(g, x, 17, 'o')
    # наплечники-шипы
    rect(g, 8, 19, 12, 21, 'i'); rect(g, 26, 19, 30, 21, 'i')
    vline(g, 9, 16, 18, 'I'); vline(g, 29, 16, 18, 'I')
    # мантия: почти чёрная, глубоко тени
    rect(g, 9, 21, 29, 30, 'p')
    rect(g, 9, 19, 29, 20, 'q')
    vline(g, 11, 21, 30, 'P'); vline(g, 27, 21, 30, 'q')
    rect(g, 10, 21, 28, 22, 'P')
    # руны и костяные застёжки
    for y in (24, 27, 30):
        px(g, 19, y, 'c'); px(g, 14, y, 'S'); px(g, 24, y, 'S')
    # сужение и рваный низ
    rect(g, 11, 31, 27, 33, 'p'); vline(g, 13, 31, 33, 'P'); vline(g, 25, 31, 33, 'q')
    for x0, x1 in ((12, 14), (18, 20), (23, 25)):
        rect(g, x0, 34, x1, 35, 'p')
    px(g, 13, 36, 'p'); px(g, 19, 36, 'p')
    # костяная кисть на посохе
    rect(g, 6, 28, 10, 31, 's'); px(g, 7, 28, 'S'); px(g, 6, 27, 's')
    return g

# ================= БАШНЯ «ЛУЧНИК» =================
def tower_archer():
    g = grid()
    # каменное тело, темнее
    rect(g, 11, 16, 28, 36, 'n')
    vline(g, 12, 16, 36, 'N'); vline(g, 13, 16, 36, 'N')
    vline(g, 26, 16, 36, 'u'); vline(g, 27, 16, 36, 'u')
    for y in range(19, 36, 4): hline(g, y, 11, 28, 'o')
    for y in range(21, 36, 4):
        for x in range(14, 28, 6): px(g, x, y, 'o')
    # трещина
    px(g, 25, 20, 'o'); px(g, 24, 21, 'o'); px(g, 24, 22, 'o')
    # бойница с углём внутри
    rect(g, 18, 24, 20, 28, 'o'); px(g, 19, 25, 'e'); px(g, 19, 26, 'e')
    # расширенное основание
    rect(g, 9, 34, 30, 37, 'u'); rect(g, 9, 34, 30, 35, 'n')
    hline(g, 34, 10, 29, 'N'); hline(g, 37, 9, 30, 'o')
    # деревянная площадка, тёмное дерево
    rect(g, 12, 15, 27, 15, 'u'); rect(g, 10, 14, 29, 14, 'f')
    rect(g, 8, 11, 31, 13, 'k'); hline(g, 11, 8, 31, 'f'); hline(g, 13, 8, 31, 'o')
    for x in range(9, 31, 5): px(g, x, 12, 'o')
    # зубцы
    for x0 in (8, 15, 22, 29):
        rect(g, x0, 8, x0 + 3, 10, 'n'); hline(g, 8, x0, x0 + 3, 'N')
    px(g, 8, 10, 'o'); px(g, 31, 10, 'o')
    # железные шипы между зубцами (центр не ставим — там стрелок)
    vline(g, 13, 6, 9, 'I'); vline(g, 27, 6, 9, 'I')
    px(g, 13, 5, 'I'); px(g, 27, 5, 'I')
    # стрелок: тёмный капюшон, лицо в тени
    ellip(g, 19, 6, 4, 3, 'd'); rect(g, 16, 6, 22, 8, 'd')
    hline(g, 4, 17, 21, 'g')
    rect(g, 17, 6, 21, 8, 'o')
    px(g, 18, 7, 'e'); px(g, 20, 7, 'e')            # угли глаз
    rect(g, 15, 9, 23, 10, 'd'); hline(g, 9, 16, 22, 'g')
    # колчан за спиной
    vline(g, 14, 6, 9, 'k'); px(g, 14, 5, 'f')
    for y in (4, 5): px(g, 13, y, 'f')
    # лук
    vline(g, 26, 2, 10, 'f')
    px(g, 25, 3, 'f'); px(g, 25, 9, 'f'); px(g, 27, 5, 'f'); px(g, 27, 7, 'f')
    vline(g, 24, 3, 9, 'S')
    return g

# ================= БАШНЯ «ПУШКА» =================
def tower_cannon():
    g = grid()
    # ствол под углом вверх-вправо
    ax0, ay0, ax1, ay1 = 14, 21, 33, 8
    adx, ady = ax1 - ax0, ay1 - ay0
    L = (adx * adx + ady * ady) ** 0.5
    nx, ny = -ady / L, adx / L
    steps = 72
    for s in range(steps + 1):
        t = s / steps
        cx = ax0 + adx * t; cy = ay0 + ady * t
        w = 3.4 - 1.1 * t
        if t > 0.94: w += 1.1            # раструб дула
        for d2 in range(-8, 9):
            d = d2 / 2
            if abs(d) > w: continue
            X = int(round(cx + nx * d)); Y = int(round(cy + ny * d))
            if t > 0.96: ch = 'o'        # чернь канала
            elif abs(d) < w - 1.2: ch = 'b'
            elif d < 0: ch = 'i'
            else: ch = 'o'
            px(g, X, Y, ch)
    # латунные обручи
    for t in (0.32, 0.62):
        cx = ax0 + adx * t; cy = ay0 + ady * t; w = 3.4 - 1.1 * t + 0.6
        for d2 in range(-8, 9):
            d = d2 / 2
            if abs(d) > w: continue
            px(g, int(round(cx + nx * d)), int(round(cy + ny * d)), 'm' if d < w - 1 else 'M')
    # сажа и ржавчина
    px(g, 36, 4, 'o'); px(g, 37, 5, 'o'); px(g, 35, 3, 'o')
    px(g, 24, 12, 'r'); px(g, 25, 13, 'r'); px(g, 19, 15, 'r')
    # казённик
    disc(g, 14, 21, 4, 'o'); disc(g, 14, 21, 3, 'b'); px(g, 13, 19, 'i'); px(g, 12, 20, 'i')
    # лафет с колёсами
    rect(g, 10, 23, 22, 27, 'k'); hline(g, 23, 10, 22, 'f'); hline(g, 27, 10, 22, 'o')
    for x in (12, 16, 20): px(g, x, 24, 'o'); px(g, x, 25, 'o')
    disc(g, 11, 29, 3, 'o'); disc(g, 11, 29, 2, 'k'); px(g, 11, 29, 'i')
    disc(g, 20, 29, 3, 'o'); disc(g, 20, 29, 2, 'k'); px(g, 20, 29, 'i')
    # каменное основание, трещины, цепь
    rect(g, 7, 28, 32, 37, 'n')
    vline(g, 9, 28, 37, 'N'); vline(g, 10, 28, 37, 'N')
    vline(g, 29, 28, 37, 'u'); vline(g, 30, 28, 37, 'u')
    for y in range(31, 37, 4): hline(g, y, 7, 32, 'o')
    hline(g, 28, 7, 32, 'N')
    rect(g, 7, 36, 32, 37, 'u'); hline(g, 37, 7, 32, 'o')
    px(g, 15, 30, 'o'); px(g, 15, 31, 'o'); px(g, 26, 33, 'o'); px(g, 27, 34, 'o')
    for x in range(9, 31, 2): px(g, x, 33, 'i')     # цепь
    # череп-эмблема на основании
    rect(g, 18, 31, 21, 34, 's'); px(g, 19, 32, 'o'); px(g, 20, 32, 'o')
    px(g, 18, 34, 'B'); px(g, 21, 34, 'B')
    # пороховая бочка
    rect(g, 2, 31, 6, 37, 'k'); hline(g, 31, 2, 6, 'f')
    hline(g, 33, 2, 6, 'i'); hline(g, 36, 2, 6, 'i')
    px(g, 4, 30, 'e')
    # ядро
    disc(g, 34, 35, 2, 'o'); px(g, 33, 34, 'i')
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
        shaded = shade(outline(painter()))
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
    sheet = Image.new('RGB', (cols * cell + pad * 2, head + rows_n * cell + pad), (11, 10, 15))
    d = ImageDraw.Draw(sheet)
    d.text((pad, 18), 'Этап 5 — образцы v2: мрачное тёмное фэнтези',
           font=title_font, fill=(210, 202, 184))
    for i, (title, img) in enumerate(images.items()):
        cx = pad + (i % cols) * cell
        cy = head + (i // cols) * cell
        d.rectangle([cx, cy, cx + cell - 1, cy + cell - 1], fill=(28, 25, 36),
                    outline=(60, 52, 70), width=1)
        big = img.resize((240, 240), Image.NEAREST)
        sheet.paste(big, (cx + (cell - 240) // 2, cy + 12), big)
        small = img.resize((52, 52), Image.NEAREST)   # как в бою
        sheet.paste(small, (cx + 14, cy + cell - 78), small)
        d.text((cx + 80, cy + cell - 66), title, font=label_font, fill=(188, 178, 158))
        d.text((cx + 80, cy + cell - 44), 'в бою ≈ 52 px', font=label_font, fill=(120, 112, 130))
    out = os.path.join(ROOT, 'docs', 'sprites_preview.png')
    sheet.save(out)
    print('OK', out)

if __name__ == '__main__':
    main()
