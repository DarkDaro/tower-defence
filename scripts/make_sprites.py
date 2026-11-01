#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Этап 5 — спрайты v3: полный бестиарий, мрачное тёмное фэнтези.
16 врагов + 8 боссов + 8 башен, сетка 40×40, авто-контур/свет, PNG ×4 + превью.
Запуск:  python3 scripts/make_sprites.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, 'assets', 'sprites')
W = H = 40
SCALE = 4

BASE = {
    'o': (10, 9, 14),
    'I': (108, 114, 128), 'i': (74, 79, 92),  'b': (46, 50, 60),
    'm': (146, 116, 44),  'M': (188, 156, 66),
    'G': (96, 118, 74),   'g': (68, 88, 54),  'd': (44, 58, 36),
    'E': (255, 96, 36),   'e': (168, 54, 26),
    'S': (226, 218, 196), 's': (192, 183, 158), 'B': (136, 128, 106),
    'w': (84, 72, 58),    'W': (108, 94, 76), 'v': (56, 48, 38),
    'L': (100, 68, 42),   'l': (74, 50, 30),  'k': (48, 32, 20),
    'P': (72, 52, 112),   'p': (46, 32, 80),  'q': (28, 19, 54),
    'c': (104, 210, 220), 'C': (186, 242, 246),
    'r': (118, 26, 26),   'R': (152, 40, 36), 'x': (66, 13, 13),
    'N': (108, 104, 116), 'n': (80, 76, 88),  'u': (54, 51, 62),
    'F': (132, 94, 56),   'f': (96, 66, 38),
}
C = dict(BASE)

def col(ch, rgb):
    C[ch] = rgb

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

def line(g, x0, y0, x1, y1, ch):
    """Толстая линия (Брезенхэм + соседний пиксель)."""
    dx, dy = abs(x1 - x0), abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx - dy
    while True:
        px(g, x0, y0, ch)
        px(g, x0 + 1, y0, ch)
        e2 = 2 * err
        if e2 > -dy: err -= dy; x0 += sx
        if e2 < dx: err += dx; y0 += sy
        if x0 == x1 and y0 == y1: break

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

# ---------- контур и свет ----------
def _mix(rgb, k):
    r, gg, b = rgb
    if k >= 0:
        return (int(r + (255 - r) * k), int(gg + (255 - gg) * k), int(b + (255 - b) * k))
    return (int(r * (1 + k)), int(gg * (1 + k)), int(b * (1 + k)))

def outline(g):
    out = [r[:] for r in g]
    solid = lambda x, y: 0 <= x < W and 0 <= y < H and g[y][x] in C
    for y in range(H):
        for x in range(W):
            if g[y][x] == '.' and (solid(x + 1, y) or solid(x - 1, y) or solid(x, y + 1) or solid(x, y - 1)):
                out[y][x] = 'o'
    return out

def shade(g, dark=-0.48, top=0.24, left=0.10):
    out = [r[:] for r in g]
    solid = lambda x, y: 0 <= x < W and 0 <= y < H and g[y][x] in C
    for y in range(H):
        for x in range(W):
            if not solid(x, y) or g[y][x] == 'o':
                continue
            ch = g[y][x]
            k = 0.0
            if not solid(x, y - 1): k += top
            if not solid(x - 1, y): k += left
            if not solid(x, y + 1) or not solid(x + 1, y): k += dark
            if k:
                r, gg, b = C[ch]
                out[y][x] = _mix((r, gg, b), max(-0.62, min(0.5, k)))
    return out

# ============ общие детали ============
def tower_base(g, x0=11, x1=28, y0=16, y1=36, ch='n'):
    """Каменный корпус башни с кладкой + расширенное основание."""
    rect(g, x0, y0, x1, y1, ch)
    vline(g, x0 + 1, y0, y1, 'N'); vline(g, x0 + 2, y0, y1, 'N')
    vline(g, x1 - 1, y0, y1, 'u'); vline(g, x1 - 2, y0, y1, 'u')
    for y in range(y0 + 3, y1, 4): hline(g, y, x0, x1, 'o')
    for y in range(y0 + 5, y1, 4):
        for x in range(x0 + 3, x1 - 2, 6): px(g, x, y, 'o')
    rect(g, x0 - 2, y1 - 2, x1 + 2, y1 + 1, ch)
    hline(g, y1 - 2, x0 - 1, x1 + 1, 'N')
    rect(g, x0 - 2, y1, x1 + 2, y1 + 1, 'u'); hline(g, y1 + 1, x0 - 2, x1 + 2, 'o')

def platform(g, y=14):
    rect(g, 10, y, 29, y, 'f'); rect(g, 8, y - 3, 31, y - 1, 'k')
    hline(g, y - 3, 8, 31, 'f'); hline(g, y - 1, 8, 31, 'o')
    for x in range(9, 31, 5): px(g, x, y - 2, 'o')

def merlons(g, y=8, spikes=True, skip_mid=False):
    for x0 in (8, 15, 22, 29):
        rect(g, x0, y, x0 + 3, y + 2, 'n'); hline(g, y, x0, x0 + 3, 'N')
    px(g, 8, y + 2, 'o'); px(g, 31, y + 2, 'o')
    if spikes:
        for x in ((13, 27) if skip_mid else (13, 20, 27)):
            vline(g, x, y - 3, y, 'I'); px(g, x, y - 4, 'I')

def skull_small(g, cx, cy, ch='s'):
    rect(g, cx - 1, cy - 1, cx + 1, cy + 1, ch)
    px(g, cx - 1, cy, 'o'); px(g, cx + 1, cy, 'o'); px(g, cx, cy + 1, 'B')

def horns_up(g, cx0, cx1, y0, ch='S'):
    """Длинные рога вверх-наружу от точек (cx0,y0) и (cx1,y0)."""
    for dx, dy in [(0, 0), (1, -1), (2, -2), (3, -3), (4, -4), (4, -5)]:
        px(g, cx0 - dx, y0 + dy, ch); px(g, cx0 - dx + 1, y0 + dy, ch)
        px(g, cx1 + dx, y0 + dy, ch); px(g, cx1 + dx - 1, y0 + dy, ch)

def wing_side(g, side, x0, y0):
    """Перепончатое крыло: side=-1 левое, x0,y0 — плечо."""
    for i, (dx, dy) in enumerate([(1, -3), (2, -5), (4, -6), (6, -6), (8, -5), (9, -3), (10, 0)]):
        px(g, x0 + side * dx, y0 + dy, 'D')
        px(g, x0 + side * dx, y0 + dy + 1, 'W')
    for i, (dx, dy) in enumerate([(9, -2), (7, 0), (5, 2), (3, 3), (1, 4)]):
        px(g, x0 + side * dx, y0 + dy, 'W')

# ============ ВРАГИ (16) ============
def boar():
    g = grid()
    col('h', (110, 84, 62)); col('H', (134, 104, 78)); col('D', (72, 54, 40))
    col('t', (214, 204, 178)); col('E', (214, 60, 40))
    ellip(g, 21, 26, 13, 8, 'h'); rect(g, 10, 22, 32, 29, 'h')
    hline(g, 25, 12, 31, 'H')
    for x in range(13, 30, 3): px(g, x, 19 + (x % 3 == 0), 'D')   # щетина
    disc(g, 10, 24, 5, 'h'); rect(g, 4, 22, 8, 27, 'H')
    px(g, 4, 24, 'o'); px(g, 4, 25, 'o')                          # пятачок
    px(g, 6, 20, 't'); px(g, 5, 19, 't'); px(g, 7, 19, 't')       # клыки
    px(g, 10, 22, 'E')                                            # глаз
    px(g, 12, 19, 'D'); px(g, 13, 18, 'D')                        # ухо
    for x in (11, 17, 24, 29):
        vline(g, x, 30, 36, 'D'); px(g, x, 36, 'o'); vline(g, x + 1, 30, 36, 'D'); px(g, x + 1, 36, 'o')
    px(g, 33, 22, 'D'); px(g, 34, 21, 'D'); px(g, 34, 23, 'D')    # хвост
    return g

def wolf():
    g = grid()
    col('h', (92, 94, 102)); col('H', (116, 118, 126)); col('D', (60, 62, 72))
    col('E', (232, 164, 52))
    ellip(g, 21, 26, 12, 6, 'h'); hline(g, 26, 12, 30, 'H')
    disc(g, 12, 24, 5, 'h'); rect(g, 5, 18, 14, 25, 'h')
    rect(g, 2, 21, 7, 24, 'h'); px(g, 2, 22, 'o'); px(g, 2, 23, 'o')
    px(g, 11, 15, 'h'); px(g, 12, 14, 'h'); px(g, 14, 15, 'h'); px(g, 15, 16, 'h')
    px(g, 9, 20, 'E')
    px(g, 4, 24, 'o'); px(g, 3, 25, 'o'); px(g, 5, 23, 'S')       # оскал
    for x in range(13, 29, 2): px(g, x, 20, 'H')                  # загривок
    for x, ln in ((11, 4), (15, 5), (26, 5), (30, 4)):
        vline(g, x, 30, 36, 'h'); vline(g, x + 1, 30, 36, 'h'); px(g, x, 36, 'D'); px(g, x + 1, 36, 'D')
    for dx, dy in [(0, 0), (1, -1), (2, -2), (3, -3)]:
        px(g, 32 + dx, 24 + dy, 'h'); px(g, 33 + dx, 23 + dy, 'H')
    return g

def zombie():
    g = grid()
    col('h', (96, 116, 88)); col('H', (118, 138, 106)); col('D', (60, 76, 56))
    col('c', (50, 44, 58)); col('E', (184, 224, 164)); col('r', (110, 24, 24))
    disc(g, 17, 10, 6, 'h')
    rect(g, 14, 9, 15, 10, 'o'); rect(g, 18, 9, 20, 10, 'o')
    px(g, 15, 10, 'E'); px(g, 19, 10, 'E')
    px(g, 20, 7, 'r'); px(g, 19, 7, 'r')                          # рана
    px(g, 15, 14, 'S'); px(g, 17, 15, 'S'); px(g, 19, 14, 'S')    # кривые зубы
    rect(g, 12, 17, 26, 28, 'c')
    rect(g, 17, 19, 22, 25, 'h'); hline(g, 20, 17, 22, 'o'); hline(g, 22, 17, 22, 'o'); hline(g, 24, 17, 22, 'o')
    hline(g, 17, 13, 26, 'H')
    rect(g, 7, 16, 12, 18, 'h'); px(g, 6, 15, 'h'); px(g, 5, 16, 'h')   # рука вперёд
    rect(g, 25, 18, 27, 27, 'h'); px(g, 26, 28, 'h'); px(g, 27, 28, 'h')
    rect(g, 13, 29, 18, 36, 'c'); rect(g, 21, 29, 26, 36, 'c')
    px(g, 16, 31, 'o'); px(g, 23, 33, 'o')
    hline(g, 37, 12, 19, 'D'); hline(g, 37, 20, 27, 'D')
    return g

def bat():
    g = grid()
    col('h', (74, 58, 84)); col('W', (54, 42, 66)); col('D', (38, 30, 50))
    col('E', (226, 64, 52))
    ellip(g, 20, 21, 4, 6, 'h')
    disc(g, 20, 13, 4, 'h')
    px(g, 17, 9, 'h'); px(g, 18, 8, 'h'); px(g, 22, 8, 'h'); px(g, 23, 9, 'h')
    px(g, 18, 13, 'E'); px(g, 22, 13, 'E')
    px(g, 19, 16, 'S'); px(g, 21, 16, 'S')
    px(g, 20, 28, 'h'); px(g, 19, 30, 'h'); px(g, 21, 30, 'h')    # лапки
    for side in (-1, 1):
        x0 = 17 if side < 0 else 23
        rect(g, 8 if side < 0 else 25, 16, 16 if side < 0 else 33, 24, 'W')
        line(g, x0, 17, 9 if side < 0 else 31, 13, 'D')
        line(g, x0, 17, 7 if side < 0 else 33, 19, 'D')
        line(g, x0, 20, 7 if side < 0 else 33, 19, 'D')
        line(g, x0, 22, 10 if side < 0 else 30, 26, 'D')
        line(g, x0, 24, 14 if side < 0 else 26, 27, 'D')
        px(g, 8 if side < 0 else 32, 15, 'D'); px(g, 7 if side < 0 else 33, 18, 'D')
    return g

def skeleton():
    g = grid()
    col('s', (204, 196, 174)); col('S', (224, 218, 198)); col('B', (148, 140, 118))
    col('E', (150, 214, 224)); col('R', (110, 74, 48))
    disc(g, 20, 8, 5, 's'); rect(g, 17, 12, 23, 13, 's')
    rect(g, 17, 7, 19, 9, 'o'); rect(g, 21, 7, 23, 9, 'o')
    px(g, 18, 8, 'E'); px(g, 22, 8, 'E'); px(g, 20, 10, 'o')
    px(g, 20, 14, 's')
    rect(g, 15, 16, 25, 24, 's')
    for y in (17, 19, 21, 23): hline(g, y, 16, 24, 'o')
    vline(g, 20, 16, 24, 'S')
    rect(g, 16, 27, 24, 28, 's'); px(g, 19, 27, 'o'); px(g, 21, 27, 'o')
    vline(g, 14, 16, 21, 's'); px(g, 13, 22, 's'); vline(g, 14, 23, 26, 's')
    line(g, 13, 15, 10, 24, 'R'); vline(g, 10, 24, 32, 'B'); hline(g, 24, 8, 12, 'B')
    px(g, 10, 25, 'o'); px(g, 10, 28, 'o')
    vline(g, 26, 16, 26, 's'); px(g, 26, 27, 's'); px(g, 27, 27, 's')
    vline(g, 17, 29, 33, 's'); vline(g, 17, 34, 36, 's')
    vline(g, 23, 29, 33, 's'); vline(g, 23, 34, 36, 's')
    hline(g, 37, 16, 18, 's'); hline(g, 37, 22, 24, 's')
    return g

def spider():
    g = grid()
    col('h', (58, 38, 74)); col('H', (78, 52, 96)); col('D', (38, 24, 52))
    col('E', (232, 60, 48)); col('e', (140, 40, 36))
    ellip(g, 20, 28, 9, 7, 'h')
    rect(g, 17, 24, 23, 33, 'H'); px(g, 20, 26, 'h'); px(g, 20, 30, 'h')
    disc(g, 20, 16, 5, 'h')
    px(g, 18, 15, 'E'); px(g, 22, 15, 'E'); px(g, 17, 17, 'e'); px(g, 23, 17, 'e')
    px(g, 18, 20, 'S'); px(g, 22, 20, 'S')
    for side in (-1, 1):
        for ox, oy, kx, ky, tx, ty in [
            (15, 18, 8, 13, 4, 21),
            (14, 22, 6, 20, 2, 27),
            (14, 26, 7, 28, 3, 34),
            (16, 30, 10, 33, 8, 37)]:
            line(g, 20 + side * ox, oy, 20 + side * kx, ky, 'D')
            line(g, 20 + side * kx, ky, 20 + side * tx, ty, 'D')
            line(g, 20 + side * (ox - 1), oy, 20 + side * (kx - 1), ky, 'D')
            line(g, 20 + side * (kx - 1), ky, 20 + side * (tx - 1), ty, 'D')
    return g

def orc():
    g = grid()
    col('h', (96, 120, 76)); col('H', (118, 144, 92)); col('D', (58, 76, 46))
    col('E', (240, 130, 40))
    rect(g, 14, 31, 18, 36, 'd'); rect(g, 22, 31, 26, 36, 'd')
    rect(g, 13, 35, 18, 37, 'k'); rect(g, 22, 35, 27, 37, 'k')
    rect(g, 12, 20, 28, 30, 'l'); hline(g, 20, 13, 27, 'L')
    rect(g, 11, 27, 29, 28, 'k'); px(g, 19, 27, 'M'); px(g, 20, 27, 'M')
    rect(g, 9, 18, 13, 22, 'w'); rect(g, 27, 18, 31, 22, 'w')
    rect(g, 17, 17, 23, 20, 'd')
    ellip(g, 20, 12, 7, 5, 'h'); rect(g, 14, 12, 26, 16, 'h')
    rect(g, 13, 8, 27, 10, 'l'); hline(g, 8, 14, 26, 'L')         # кожаный шлем
    px(g, 14, 11, 'o'); rect(g, 15, 11, 16, 12, 'o'); rect(g, 24, 11, 25, 12, 'o')
    px(g, 15, 11, 'E'); px(g, 24, 11, 'E')
    rect(g, 19, 13, 21, 14, 'D')
    rect(g, 15, 14, 16, 17, 'S'); rect(g, 24, 14, 25, 17, 'S')    # клыки
    hline(g, 16, 17, 23, 'o')
    vline(g, 33, 14, 34, 'k'); vline(g, 34, 14, 34, 'k')
    disc(g, 34, 11, 4, 'F'); rect(g, 31, 10, 37, 12, 'F'); px(g, 34, 8, 'I')
    rect(g, 31, 23, 36, 26, 'h'); vline(g, 33, 23, 26, 'k'); vline(g, 34, 23, 26, 'k')
    return g

def dark_mage():
    g = grid()
    col('h', (88, 62, 140)); col('H', (110, 82, 168)); col('q', (52, 36, 92))
    col('E', (190, 130, 255))
    vline(g, 6, 10, 34, 'k'); vline(g, 7, 10, 34, 'f')
    disc(g, 6, 7, 3, 'q'); disc(g, 6, 7, 2, 'E'); px(g, 5, 6, 'C'); col('C', (232, 210, 255))
    rect(g, 12, 4, 28, 6, 'q')                                    # капюшон
    ellip(g, 20, 9, 6, 4, 'h'); rect(g, 13, 9, 27, 12, 'h')
    rect(g, 15, 8, 25, 11, 'o')
    px(g, 17, 9, 'E'); px(g, 23, 9, 'E')
    rect(g, 10, 12, 30, 33, 'h')
    vline(g, 12, 12, 33, 'H'); vline(g, 28, 12, 33, 'q'); rect(g, 11, 12, 29, 13, 'H')
    px(g, 20, 18, 'M'); px(g, 20, 24, 'M'); px(g, 20, 30, 'M')
    px(g, 14, 18, 'S'); px(g, 26, 18, 'S'); px(g, 14, 24, 'S'); px(g, 26, 24, 'S')
    rect(g, 14, 34, 17, 36, 'q'); rect(g, 23, 34, 26, 36, 'q')
    px(g, 15, 37, 'q'); px(g, 24, 37, 'q')
    rect(g, 8, 14, 11, 22, 'h'); disc(g, 9, 23, 2, 's')
    return g

def drake():
    g = grid()
    col('h', (146, 62, 36)); col('H', (176, 88, 50)); col('D', (98, 40, 24))
    col('E', (255, 170, 40)); col('e', (220, 90, 30))
    for side in (-1, 1):
        x0 = 15 if side < 0 else 25
        rect(g, 4 if side < 0 else 26, 14, 15 if side < 0 else 36, 24, 'D')
        line(g, x0, 15, 6 if side < 0 else 34, 10, 'W'); col('W', (120, 50, 30))
        line(g, x0, 17, 4 if side < 0 else 36, 14, 'W')
        line(g, x0, 19, 4 if side < 0 else 36, 20, 'W')
        line(g, x0, 21, 8 if side < 0 else 32, 26, 'W')
    ellip(g, 20, 25, 8, 9, 'h')
    vline(g, 15, 18, 32, 'H'); vline(g, 25, 18, 32, 'D')
    rect(g, 16, 33, 24, 36, 'D')
    rect(g, 17, 8, 23, 17, 'h')                                   # шея
    disc(g, 20, 7, 5, 'h'); rect(g, 14, 5, 20, 9, 'h')
    px(g, 15, 3, 'S'); px(g, 14, 2, 'S'); px(g, 18, 2, 'S'); px(g, 19, 3, 'S')
    px(g, 17, 6, 'E'); px(g, 16, 7, 'e')
    rect(g, 13, 8, 16, 10, 'e'); px(g, 13, 10, 'E'); px(g, 14, 11, 'E')  # пламя
    px(g, 22, 9, 'D'); px(g, 23, 10, 'D')
    return g

def knight():
    g = grid()
    col('h', (76, 82, 96)); col('H', (100, 108, 124)); col('D', (52, 56, 68))
    col('m', (168, 136, 62)); col('M', (200, 168, 84)); col('E', (255, 190, 70))
    vline(g, 33, 8, 30, 'B'); px(g, 33, 7, 'S')                   # меч за спиной
    hline(g, 30, 31, 36, 'm')
    rect(g, 14, 31, 18, 36, 'D'); rect(g, 22, 31, 26, 36, 'D')
    rect(g, 13, 35, 18, 37, 'k'); rect(g, 22, 35, 27, 37, 'k')
    rect(g, 12, 19, 28, 31, 'h'); hline(g, 19, 13, 27, 'H')
    vline(g, 19, 19, 31, 'm'); hline(g, 25, 12, 28, 'm')
    rect(g, 8, 16, 13, 21, 'h'); hline(g, 16, 9, 12, 'H')
    rect(g, 27, 16, 32, 21, 'h'); hline(g, 16, 28, 31, 'H')
    px(g, 8, 15, 'I'); px(g, 32, 15, 'I')
    rect(g, 16, 9, 24, 15, 'h'); hline(g, 9, 17, 23, 'H')
    hline(g, 12, 17, 23, 'o'); px(g, 18, 12, 'E'); px(g, 19, 12, 'E'); px(g, 21, 12, 'E'); px(g, 22, 12, 'E')
    px(g, 16, 8, 'm'); px(g, 24, 8, 'm')                          # крылья шлема
    rect(g, 19, 5, 21, 8, 'm'); px(g, 20, 4, 'M')                 # гребень
    rect(g, 8, 20, 15, 34, 'D'); hline(g, 20, 8, 15, 'H')         # щит
    vline(g, 8, 20, 34, 'H'); hline(g, 34, 8, 15, 'm')
    disc(g, 11, 26, 2, 'm'); px(g, 11, 26, 'M')
    return g

def ghost():
    g = grid()
    col('h', (152, 192, 216)); col('H', (184, 218, 236)); col('D', (110, 150, 178))
    col('E', (30, 30, 40))
    ellip(g, 20, 12, 8, 7, 'h')
    rect(g, 12, 12, 28, 26, 'h')
    rect(g, 16, 10, 18, 13, 'E'); rect(g, 22, 10, 24, 13, 'E')
    px(g, 19, 16, 'D'); px(g, 20, 16, 'D'); px(g, 21, 16, 'D')    # стон-рот
    hline(g, 10, 15, 25, 'H')
    rect(g, 8, 16, 11, 22, 'h'); rect(g, 29, 16, 32, 22, 'h')     # ручки
    px(g, 8, 23, 'h'); px(g, 32, 23, 'h'); px(g, 7, 17, 'h'); px(g, 33, 17, 'h')
    for x0, ln in ((12, 5), (17, 7), (22, 6), (26, 4)):
        rect(g, x0, 27, x0 + 2, 27 + ln, 'h')
    px(g, 18, 36, 'h'); px(g, 23, 35, 'h')
    px(g, 14, 20, 'D'); px(g, 26, 22, 'D')                        # изморось
    return g

def berserker():
    g = grid()
    col('h', (138, 62, 50)); col('H', (162, 82, 66)); col('D', (94, 40, 32))
    col('S', (222, 214, 192)); col('E', (255, 200, 60))
    rect(g, 12, 31, 17, 36, 'D'); rect(g, 23, 31, 28, 36, 'D')
    rect(g, 11, 35, 17, 37, 'k'); rect(g, 23, 35, 29, 37, 'k')
    rect(g, 11, 19, 29, 31, 'h'); hline(g, 19, 12, 28, 'H')
    rect(g, 14, 22, 26, 28, 'H')
    vline(g, 17, 22, 28, 'S'); vline(g, 23, 22, 28, 'S')          # боевая раскраска
    rect(g, 7, 16, 12, 21, 'h'); hline(g, 16, 8, 11, 'H')
    rect(g, 28, 16, 33, 21, 'h'); hline(g, 16, 29, 32, 'H')
    rect(g, 16, 9, 24, 16, 'h')
    rect(g, 15, 8, 25, 10, 'S'); px(g, 17, 6, 'S'); px(g, 18, 5, 'S'); px(g, 22, 5, 'S'); px(g, 23, 6, 'S')
    px(g, 14, 7, 'S'); px(g, 26, 7, 'S')
    rect(g, 17, 12, 18, 13, 'o'); rect(g, 22, 12, 23, 13, 'o')
    px(g, 17, 12, 'E'); px(g, 22, 12, 'E')
    rect(g, 18, 15, 22, 16, 'S')                                  # клыки шлема
    for x0 in (4, 30):                                            # два топора
        vline(g, x0 + 3, 14, 30, 'k')
        rect(g, x0, 12, x0 + 6, 18, 'B'); hline(g, 12, x0, x0 + 6, 'S')
        px(g, x0, 13, '.'); px(g, x0 + 6, 17, '.')
    rect(g, 9, 23, 12, 26, 'h'); rect(g, 28, 23, 31, 26, 'h')     # кулаки
    return g

def sentinel():
    g = grid()
    col('h', (88, 100, 120)); col('H', (112, 126, 146)); col('D', (56, 64, 80))
    col('E', (140, 200, 255))
    rect(g, 14, 31, 18, 36, 'D'); rect(g, 22, 31, 26, 36, 'D')
    rect(g, 13, 35, 18, 37, 'k'); rect(g, 22, 35, 27, 37, 'k')
    rect(g, 13, 19, 27, 31, 'h'); hline(g, 19, 14, 26, 'H')
    vline(g, 20, 19, 31, 'D'); hline(g, 27, 13, 27, 'D')
    rect(g, 7, 15, 13, 21, 'h'); hline(g, 15, 8, 12, 'H')
    rect(g, 27, 15, 33, 21, 'h'); hline(g, 15, 28, 32, 'H')
    px(g, 7, 13, 'I'); px(g, 10, 12, 'I'); px(g, 33, 13, 'I'); px(g, 30, 12, 'I')
    rect(g, 16, 10, 24, 16, 'h'); hline(g, 10, 17, 23, 'H')
    hline(g, 13, 17, 23, 'o'); px(g, 18, 13, 'E'); px(g, 19, 13, 'E'); px(g, 21, 13, 'E'); px(g, 22, 13, 'E')
    rect(g, 18, 6, 22, 9, 'I'); px(g, 20, 5, 'E')                 # сигнальный гребень
    rect(g, 24, 18, 33, 33, 'D'); hline(g, 18, 25, 32, 'H')       # башенный щит
    vline(g, 24, 18, 33, 'H'); hline(g, 33, 24, 33, 'I')
    vline(g, 28, 20, 31, 'I'); px(g, 28, 25, 'E'); px(g, 28, 26, 'E')
    return g

def wind_shaman():
    g = grid()
    col('h', (74, 138, 126)); col('H', (100, 168, 152)); col('D', (48, 96, 88))
    col('E', (190, 255, 220)); col('v', (150, 220, 205))
    for x0, y0, x1, y1 in [(13, 30, 8, 33), (27, 30, 32, 33), (15, 33, 12, 36), (25, 33, 28, 36)]:
        line(g, x0, y0, x1, y1, 'D')                              # вихрь вместо ног
    px(g, 10, 35, 'v'); px(g, 30, 35, 'v'); px(g, 20, 37, 'v')
    rect(g, 12, 17, 28, 31, 'h'); hline(g, 17, 13, 27, 'H')
    vline(g, 14, 17, 31, 'H'); vline(g, 26, 17, 31, 'D')
    for y in (20, 24, 28): px(g, 20, y, 'E')
    rect(g, 11, 6, 29, 9, 'h'); ellip(g, 20, 10, 7, 3, 'h')
    rect(g, 14, 5, 26, 8, 'D')
    px(g, 17, 9, 'E'); px(g, 23, 9, 'E')
    rect(g, 8, 11, 11, 19, 'h')
    disc(g, 9, 5, 3, 'v'); px(g, 8, 4, 'C'); col('C', (224, 255, 244))
    line(g, 12, 3, 16, 1, 'v'); line(g, 6, 6, 3, 4, 'v')
    return g

def gargoyle():
    g = grid()
    col('h', (122, 120, 130)); col('H', (146, 144, 152)); col('D', (88, 86, 96))
    col('E', (255, 150, 60))
    rect(g, 12, 32, 17, 37, 'D'); rect(g, 23, 32, 28, 37, 'D')    # лапы на корточках
    ellip(g, 20, 24, 11, 8, 'h')
    hline(g, 22, 10, 30, 'H')
    rect(g, 8, 20, 13, 26, 'h'); px(g, 8, 27, 'h'); px(g, 9, 28, 'h')
    rect(g, 27, 20, 32, 26, 'h'); px(g, 31, 27, 'h'); px(g, 30, 28, 'h')
    rect(g, 15, 10, 25, 18, 'h'); ellip(g, 20, 12, 6, 4, 'h')
    px(g, 16, 6, 'h'); px(g, 17, 5, 'h'); px(g, 15, 7, 'h')       # рога-заушины
    px(g, 24, 6, 'h'); px(g, 23, 5, 'h'); px(g, 25, 7, 'h')
    rect(g, 17, 11, 18, 12, 'o'); rect(g, 22, 11, 23, 12, 'o')
    px(g, 17, 11, 'E'); px(g, 22, 11, 'E')
    rect(g, 18, 15, 22, 16, 'D')
    for x in (14, 18, 22, 26): px(g, x, 27, 'D'); px(g, x, 30, 'D')  # трещины
    for side in (-1, 1):
        x0 = 14 if side < 0 else 26
        line(g, x0, 12, x0 + side * 6, 4, 'D')
        line(g, x0 + side * 6, 4, x0 + side * 8, 12, 'D')
        line(g, x0, 13, x0 + side * 7, 5, 'D')
    return g

def necromancer():
    g = grid()
    col('h', (44, 40, 58)); col('H', (62, 56, 78)); col('q', (28, 25, 40))
    col('E', (110, 240, 140)); col('s', (200, 192, 170))
    vline(g, 6, 10, 35, 'k'); vline(g, 7, 10, 35, 'f')
    disc(g, 6, 7, 3, 'q'); disc(g, 6, 7, 2, 'E'); px(g, 5, 6, 'C'); col('C', (190, 255, 205))
    rect(g, 11, 4, 29, 6, 'q')
    disc(g, 20, 9, 5, 's'); rect(g, 16, 8, 24, 11, 's')
    rect(g, 17, 7, 18, 9, 'o'); rect(g, 22, 7, 23, 9, 'o')
    px(g, 17, 8, 'E'); px(g, 22, 8, 'E')
    for x in range(17, 24, 2): px(g, x, 11, 'o')
    rect(g, 10, 12, 30, 33, 'h')
    vline(g, 12, 12, 33, 'H'); vline(g, 28, 12, 33, 'q'); rect(g, 11, 12, 29, 13, 'H')
    for y in (17, 22, 27): px(g, 20, y, 'E'); px(g, 14, y, 's'); px(g, 26, y, 's')
    rect(g, 13, 34, 16, 36, 'q'); rect(g, 24, 34, 27, 36, 'q')
    px(g, 14, 37, 'q'); px(g, 25, 37, 'q')
    rect(g, 8, 14, 11, 23, 'h'); rect(g, 6, 23, 10, 26, 's')      # костяная кисть
    return g

# ============ БОССЫ (8; орк-вождь и лич уже утверждены) ============
def orc_chief():
    g = grid()
    col('x', (66, 13, 13)); col('r', (118, 26, 26))
    rect(g, 6, 20, 11, 33, 'x'); rect(g, 28, 20, 33, 33, 'x')
    rect(g, 7, 34, 9, 35, 'x');  rect(g, 30, 34, 32, 35, 'x')
    rect(g, 14, 31, 18, 36, 'd'); rect(g, 21, 31, 25, 36, 'd')
    rect(g, 13, 35, 18, 37, 'k'); rect(g, 21, 35, 26, 37, 'k')
    rect(g, 11, 28, 28, 30, 'w'); hline(g, 28, 12, 27, 'W')
    for x in range(11, 29, 3): px(g, x, 31, 'v')
    rect(g, 12, 20, 27, 29, 'g'); hline(g, 20, 13, 26, 'G')
    for i in range(8):
        px(g, 13 + i, 21 + i, 'k'); px(g, 13 + i, 22 + i, 'k')
        px(g, 26 - i, 21 + i, 'k'); px(g, 26 - i, 22 + i, 'k')
    rect(g, 11, 27, 28, 28, 'k'); hline(g, 27, 11, 28, 'L')
    rect(g, 18, 27, 21, 28, 's'); px(g, 19, 27, 'o'); px(g, 20, 27, 'o')
    rect(g, 5, 17, 12, 22, 'i');  rect(g, 27, 17, 34, 22, 'i')
    hline(g, 17, 6, 11, 'I');     hline(g, 17, 28, 33, 'I')
    vline(g, 6, 14, 16, 'I'); vline(g, 9, 13, 16, 'I')
    vline(g, 33, 14, 16, 'I'); vline(g, 30, 13, 16, 'I')
    rect(g, 17, 17, 22, 20, 'd')
    ellip(g, 19, 13, 7, 5, 'g'); rect(g, 13, 13, 25, 17, 'g')
    ellip(g, 19, 9, 9, 4, 'i'); rect(g, 10, 9, 28, 11, 'i')
    hline(g, 9, 11, 27, 'I'); rect(g, 10, 11, 28, 12, 'b')
    for dx, dy in [(0, 0), (1, -1), (2, -2), (3, -3), (4, -4), (4, -5)]:
        px(g, 11 - dx, 9 + dy, 'S'); px(g, 12 - dx, 9 + dy, 'S')
        px(g, 27 + dx, 9 + dy, 'S'); px(g, 26 + dx, 9 + dy, 'S')
    rect(g, 14, 12, 17, 13, 'o'); rect(g, 21, 12, 24, 13, 'o')
    px(g, 15, 12, 'e'); px(g, 16, 13, 'E'); px(g, 22, 12, 'e'); px(g, 23, 13, 'E')
    rect(g, 18, 14, 20, 15, 'd'); rect(g, 16, 15, 22, 16, 'o')
    rect(g, 14, 11, 15, 16, 'S'); px(g, 14, 10, 'S')
    rect(g, 23, 11, 24, 16, 'S'); px(g, 24, 10, 'S')
    px(g, 14, 16, 'B'); px(g, 15, 16, 'B'); px(g, 23, 16, 'B'); px(g, 24, 16, 'B')
    vline(g, 33, 14, 36, 'k'); vline(g, 34, 14, 36, 'k')
    rect(g, 29, 6, 39, 14, 'i')
    hline(g, 6, 29, 39, 'I');  vline(g, 29, 6, 14, 'I')
    rect(g, 29, 14, 39, 15, 'b')
    px(g, 37, 6, '.'); px(g, 38, 6, '.'); px(g, 38, 7, '.')
    px(g, 30, 13, 'r'); px(g, 31, 13, 'r'); px(g, 29, 14, 'r')
    vline(g, 33, 6, 14, 'F'); px(g, 34, 6, 'F')
    rect(g, 31, 24, 36, 27, 'g'); hline(g, 24, 31, 36, 'G')
    vline(g, 33, 24, 27, 'k'); vline(g, 34, 24, 27, 'k')
    return g

def spider_queen():
    g = grid()
    col('h', (64, 34, 92)); col('H', (86, 48, 118)); col('D', (42, 22, 62))
    col('E', (255, 60, 48)); col('e', (160, 40, 40)); col('S', (216, 206, 184))
    ellip(g, 20, 28, 11, 8, 'h')
    rect(g, 14, 23, 26, 34, 'H'); rect(g, 17, 25, 23, 33, 'S')    # яйцевой мешок
    px(g, 18, 28, 'h'); px(g, 22, 28, 'h'); px(g, 18, 31, 'h'); px(g, 22, 31, 'h')
    disc(g, 20, 15, 6, 'h')
    px(g, 17, 13, 'E'); px(g, 23, 13, 'E'); px(g, 15, 16, 'e'); px(g, 25, 16, 'e')
    px(g, 18, 19, 'S'); px(g, 22, 19, 'S')
    for x in (14, 26): vline(g, x, 10, 12, 'I'); px(g, x, 9, 'I') # шипы-корона
    for side in (-1, 1):
        for ox, oy, kx, ky, tx, ty in [
            (16, 17, 9, 11, 3, 19),
            (15, 21, 6, 19, 1, 26),
            (15, 25, 7, 27, 2, 33),
            (17, 29, 11, 33, 9, 38)]:
            line(g, 20 + side * ox, oy, 20 + side * kx, ky, 'D')
            line(g, 20 + side * kx, ky, 20 + side * tx, ty, 'D')
            line(g, 20 + side * (ox - 1), oy, 20 + side * (kx - 1), ky, 'D')
            line(g, 20 + side * (kx - 1), ky, 20 + side * (tx - 1), ty, 'D')
    return g

def dragon_lord():
    g = grid()
    col('h', (150, 52, 34)); col('H', (180, 80, 48)); col('D', (100, 34, 22))
    col('W', (120, 42, 28)); col('E', (255, 180, 40)); col('e', (230, 100, 30))
    for side in (-1, 1):
        x0 = 14 if side < 0 else 26
        line(g, x0, 18, 4 if side < 0 else 36, 8, 'W')
        line(g, x0, 20, 2 if side < 0 else 38, 14, 'W')
        line(g, x0, 22, 2 if side < 0 else 38, 21, 'W')
        line(g, x0, 24, 6 if side < 0 else 34, 28, 'W')
        line(g, x0 + side, 19, 5 if side < 0 else 35, 10, 'W')
        px(g, 3 if side < 0 else 37, 13, 'W')
    ellip(g, 20, 26, 9, 10, 'h')
    vline(g, 14, 19, 34, 'H'); vline(g, 26, 19, 34, 'D')
    rect(g, 15, 35, 25, 37, 'D')
    for x in (16, 20, 24): px(g, x, 36, 'H')
    rect(g, 17, 9, 23, 18, 'h')
    disc(g, 20, 7, 6, 'h')
    px(g, 15, 2, 'S'); px(g, 14, 1, 'S'); px(g, 16, 1, 'S')
    px(g, 25, 2, 'S'); px(g, 26, 1, 'S'); px(g, 24, 1, 'S')
    rect(g, 19, 1, 21, 3, 'S')
    px(g, 17, 6, 'E'); px(g, 23, 6, 'E')
    rect(g, 16, 9, 18, 12, 'e'); px(g, 16, 12, 'E'); px(g, 17, 13, 'E'); px(g, 15, 13, 'e')
    px(g, 25, 10, 'D'); px(g, 26, 11, 'D')
    return g

def lich_king():
    g = grid()
    col('r', (118, 26, 26))
    vline(g, 5, 9, 35, 'k'); vline(g, 6, 9, 35, 'f')
    px(g, 7, 9, 'q'); px(g, 4, 9, 'q'); px(g, 6, 10, 'q'); px(g, 3, 10, 'q')
    disc(g, 5, 6, 3, 'q'); disc(g, 5, 6, 2, 'c'); px(g, 4, 5, 'C'); px(g, 5, 4, 'C')
    rect(g, 12, 5, 26, 7, 'i'); hline(g, 5, 13, 25, 'I')
    for x in (13, 16, 22, 25):
        vline(g, x, 3, 4, 'I'); px(g, x, 2, 'I')
    vline(g, 19, 1, 4, 'I'); px(g, 19, 0, 'I')
    px(g, 19, 6, 'c')
    ellip(g, 19, 12, 8, 6, 's')
    rect(g, 12, 12, 26, 16, 's')
    hline(g, 7, 13, 25, 'S'); hline(g, 8, 12, 26, 'S')
    px(g, 23, 8, 'B'); px(g, 24, 9, 'B'); px(g, 24, 10, 'B')
    rect(g, 13, 11, 17, 14, 'o'); rect(g, 21, 11, 25, 14, 'o')
    px(g, 15, 12, 'C'); px(g, 23, 12, 'C'); px(g, 15, 13, 'c'); px(g, 23, 13, 'c')
    rect(g, 18, 14, 20, 16, 'o')
    for x in range(13, 26, 2): px(g, x, 15, 'o')
    hline(g, 16, 12, 26, 'B')
    rect(g, 14, 17, 24, 18, 's'); hline(g, 18, 14, 24, 'B')
    for x in (15, 17, 19, 21, 23): px(g, x, 17, 'o')
    rect(g, 8, 19, 12, 21, 'i'); rect(g, 26, 19, 30, 21, 'i')
    vline(g, 9, 16, 18, 'I'); vline(g, 29, 16, 18, 'I')
    rect(g, 9, 21, 29, 30, 'p')
    rect(g, 9, 19, 29, 20, 'q')
    vline(g, 11, 21, 30, 'P'); vline(g, 27, 21, 30, 'q')
    rect(g, 10, 21, 28, 22, 'P')
    for y in (24, 27, 30):
        px(g, 19, y, 'c'); px(g, 14, y, 'S'); px(g, 24, y, 'S')
    rect(g, 11, 31, 27, 33, 'p'); vline(g, 13, 31, 33, 'P'); vline(g, 25, 31, 33, 'q')
    for x0, x1 in ((12, 14), (18, 20), (23, 25)):
        rect(g, x0, 34, x1, 35, 'p')
    px(g, 13, 36, 'p'); px(g, 19, 36, 'p')
    rect(g, 6, 28, 10, 31, 's'); px(g, 7, 28, 'S'); px(g, 6, 27, 's')
    return g

def demon_lord():
    g = grid()
    col('h', (48, 34, 40)); col('H', (72, 52, 58)); col('D', (30, 22, 28))
    col('E', (255, 120, 30)); col('e', (200, 70, 24)); col('S', (220, 210, 188))
    for side in (-1, 1):                                          # крылья
        x0 = 13 if side < 0 else 27
        line(g, x0, 20, 4 if side < 0 else 36, 12, 'D')
        line(g, x0, 23, 3 if side < 0 else 37, 19, 'D')
        line(g, x0, 26, 6 if side < 0 else 34, 28, 'D')
        px(g, 4 if side < 0 else 36, 13, 'D'); px(g, 5 if side < 0 else 35, 20, 'D')
    rect(g, 14, 31, 18, 36, 'D'); rect(g, 22, 31, 26, 36, 'D')    # копыта
    rect(g, 14, 36, 18, 37, 'o'); rect(g, 22, 36, 26, 37, 'o')
    rect(g, 12, 19, 28, 31, 'h'); hline(g, 19, 13, 27, 'H')
    rect(g, 18, 23, 22, 29, 'D'); px(g, 19, 25, 'e'); px(g, 21, 27, 'e')
    rect(g, 8, 16, 13, 21, 'h'); hline(g, 16, 9, 12, 'H')
    rect(g, 27, 16, 32, 21, 'h'); hline(g, 16, 28, 31, 'H')
    rect(g, 16, 8, 24, 16, 'h'); hline(g, 8, 17, 23, 'H')
    px(g, 15, 6, 'S'); px(g, 13, 5, 'S'); px(g, 12, 3, 'S'); px(g, 12, 1, 'S')
    px(g, 25, 6, 'S'); px(g, 27, 5, 'S'); px(g, 28, 3, 'S'); px(g, 28, 1, 'S')
    rect(g, 17, 11, 18, 12, 'o'); rect(g, 22, 11, 23, 12, 'o')
    px(g, 17, 11, 'E'); px(g, 22, 11, 'E')
    rect(g, 18, 14, 22, 15, 'o')
    for x in range(18, 23, 2): px(g, x, 14, 'S')
    vline(g, 34, 12, 30, 'k'); vline(g, 35, 12, 30, 'k')          # тесак
    rect(g, 30, 8, 39, 14, 'B'); hline(g, 8, 31, 39, 'S')
    rect(g, 30, 14, 39, 15, 'D')
    px(g, 37, 9, 'r'); col('r', (120, 26, 26)); px(g, 38, 11, 'r')
    rect(g, 30, 24, 34, 27, 'h'); px(g, 33, 25, 'D')
    return g

def shadow_lord():
    g = grid()
    col('h', (36, 34, 56)); col('H', (52, 50, 78)); col('D', (24, 22, 40))
    col('S', (235, 240, 250)); col('v', (70, 66, 100))
    ellip(g, 20, 12, 8, 6, 'h')
    rect(g, 12, 12, 28, 27, 'h')
    rect(g, 16, 10, 18, 13, 'S'); rect(g, 22, 10, 24, 13, 'S')    # белые глаза
    hline(g, 9, 16, 24, 'H')
    px(g, 14, 16, 'v'); px(g, 26, 15, 'v')                        # дымки
    rect(g, 7, 15, 11, 23, 'h'); rect(g, 29, 15, 33, 23, 'h')
    line(g, 8, 24, 6, 28, 'h'); line(g, 7, 23, 5, 26, 'h')        # когти
    line(g, 32, 24, 34, 28, 'h'); line(g, 33, 23, 35, 26, 'h')
    px(g, 6, 29, 'v'); px(g, 34, 29, 'v')
    for x0, ln in ((13, 6), (17, 8), (22, 7), (26, 5)):
        rect(g, x0, 28, x0 + 2, 28 + ln, 'h')
    px(g, 18, 38, 'h'); px(g, 23, 37, 'h'); px(g, 15, 36, 'h')
    px(g, 10, 12, 'v'); px(g, 30, 20, 'v'); px(g, 16, 33, 'v')
    return g

def iron_golem():
    g = grid()
    col('h', (92, 96, 106)); col('H', (116, 120, 130)); col('D', (60, 64, 74))
    col('E', (255, 150, 40)); col('e', (200, 100, 30)); col('S', (200, 196, 184))
    rect(g, 12, 30, 17, 36, 'D'); rect(g, 23, 30, 28, 36, 'D')
    rect(g, 11, 35, 18, 37, 'b'); rect(g, 22, 35, 29, 37, 'b')
    rect(g, 11, 16, 29, 30, 'h'); hline(g, 16, 12, 28, 'H')
    vline(g, 13, 16, 30, 'H'); vline(g, 27, 16, 30, 'D')
    hline(g, 23, 11, 29, 'D')
    disc(g, 20, 22, 3, 'D'); disc(g, 20, 22, 2, 'E'); px(g, 20, 21, 'e')   # ядро
    for x in (14, 26):
        for y in (18, 26): px(g, x, y, 'S')                       # клёпки
    rect(g, 5, 17, 11, 30, 'h'); hline(g, 17, 6, 10, 'H')         # руки-глыбы
    rect(g, 29, 17, 35, 30, 'h'); hline(g, 17, 30, 34, 'H')
    rect(g, 4, 30, 11, 33, 'D'); rect(g, 29, 30, 36, 33, 'D')     # кулаки
    px(g, 6, 31, 'S'); px(g, 33, 31, 'S')
    rect(g, 16, 9, 24, 15, 'h'); hline(g, 9, 17, 23, 'H')
    hline(g, 12, 17, 23, 'o')
    px(g, 18, 12, 'E'); px(g, 22, 12, 'E')
    rect(g, 19, 5, 21, 8, 'I'); px(g, 20, 4, 'I')
    return g

def wind_walker():
    g = grid()
    col('h', (84, 164, 152)); col('H', (124, 200, 186)); col('D', (52, 108, 100))
    col('C', (208, 255, 246)); col('v', (150, 225, 210))
    for i, (r, w) in enumerate([(5, 3), (9, 4), (13, 5), (17, 6)]):
        y0 = 30 - i * 7
        line(g, 20 - r, y0, 20 + r, y0 - 2, 'h' if i % 2 else 'D')
        line(g, 20 + r, y0 - 2, 20 + r - 2, y0 - 5, 'H')
        line(g, 20 - r, y0, 20 - r + 3, y0 - 4, 'H')
    disc(g, 20, 14, 5, 'h'); disc(g, 20, 14, 3, 'H'); px(g, 20, 13, 'C')
    px(g, 18, 13, 'S'); px(g, 22, 13, 'S')
    for x, y in [(8, 28), (32, 26), (11, 20), (29, 12), (14, 6)]:
        px(g, x, y, 'v'); px(g, x + 1, y - 1, 'v')
    px(g, 20, 36, 'v'); px(g, 17, 34, 'D'); px(g, 24, 33, 'D')
    return g

# ============ БАШНИ (8; лучник и пушка утверждены) ============
def tower_archer():
    g = grid()
    tower_base(g)
    platform(g); merlons(g, skip_mid=True)
    ellip(g, 19, 6, 4, 3, 'd'); rect(g, 16, 6, 22, 8, 'd')
    hline(g, 4, 17, 21, 'g')
    rect(g, 17, 6, 21, 8, 'o')
    px(g, 18, 7, 'e'); px(g, 20, 7, 'e')
    rect(g, 15, 9, 23, 10, 'd'); hline(g, 9, 16, 22, 'g')
    vline(g, 14, 6, 9, 'k'); px(g, 14, 5, 'f')
    for y in (4, 5): px(g, 13, y, 'f')
    vline(g, 26, 2, 10, 'f')
    px(g, 25, 3, 'f'); px(g, 25, 9, 'f'); px(g, 27, 5, 'f'); px(g, 27, 7, 'f')
    vline(g, 24, 3, 9, 'S')
    return g

def tower_cannon():
    g = grid()
    tower_base(g, 7, 32, 28, 36)
    ax0, ay0, ax1, ay1 = 14, 21, 33, 8
    adx, ady = ax1 - ax0, ay1 - ay0
    L = (adx * adx + ady * ady) ** 0.5
    nx, ny = -ady / L, adx / L
    for s in range(73):
        t = s / 72
        cx = ax0 + adx * t; cy = ay0 + ady * t
        w = 3.4 - 1.1 * t
        if t > 0.94: w += 1.1
        for d2 in range(-8, 9):
            d = d2 / 2
            if abs(d) > w: continue
            X = int(round(cx + nx * d)); Y = int(round(cy + ny * d))
            if t > 0.96: ch = 'o'
            elif abs(d) < w - 1.2: ch = 'b'
            elif d < 0: ch = 'i'
            else: ch = 'o'
            px(g, X, Y, ch)
    for t in (0.32, 0.62):
        cx = ax0 + adx * t; cy = ay0 + ady * t; w = 3.4 - 1.1 * t + 0.6
        for d2 in range(-8, 9):
            d = d2 / 2
            if abs(d) > w: continue
            px(g, int(round(cx + nx * d)), int(round(cy + ny * d)), 'm' if d < w - 1 else 'M')
    px(g, 36, 4, 'o'); px(g, 37, 5, 'o'); px(g, 35, 3, 'o')
    px(g, 24, 12, 'r'); px(g, 25, 13, 'r'); px(g, 19, 15, 'r')
    disc(g, 14, 21, 4, 'o'); disc(g, 14, 21, 3, 'b'); px(g, 13, 19, 'i'); px(g, 12, 20, 'i')
    rect(g, 10, 23, 22, 27, 'k'); hline(g, 23, 10, 22, 'f'); hline(g, 27, 10, 22, 'o')
    for x in (12, 16, 20): px(g, x, 24, 'o'); px(g, x, 25, 'o')
    disc(g, 11, 29, 3, 'o'); disc(g, 11, 29, 2, 'k'); px(g, 11, 29, 'i')
    disc(g, 20, 29, 3, 'o'); disc(g, 20, 29, 2, 'k'); px(g, 20, 29, 'i')
    for x in range(9, 31, 2): px(g, x, 33, 'i')
    rect(g, 18, 31, 21, 34, 's'); px(g, 19, 32, 'o'); px(g, 20, 32, 'o')
    px(g, 18, 34, 'B'); px(g, 21, 34, 'B')
    rect(g, 2, 31, 6, 37, 'k'); hline(g, 31, 2, 6, 'f')
    hline(g, 33, 2, 6, 'i'); hline(g, 36, 2, 6, 'i')
    px(g, 4, 30, 'e')
    disc(g, 34, 35, 2, 'o'); px(g, 33, 34, 'i')
    return g

def tower_ice():
    g = grid()
    col('E', (150, 220, 250))
    tower_base(g)
    platform(g, y=14)
    for x0, w, h in ((12, 4, 11), (18, 5, 14), (25, 4, 10)):      # кристаллы
        for i in range(h):
            half = max(0, int(w * (1 - i / h) / 2))
            rect(g, x0 + w // 2 - half, 13 - i, x0 + w // 2 + half, 13 - i, 'c' if i < h - 1 else 'C')
        px(g, x0 + w // 2, 13 - h, 'C')
    vline(g, 20, 1, 2, 'C')
    px(g, 15, 20, 'c'); px(g, 26, 24, 'c'); px(g, 13, 30, 'c')    # изморось
    px(g, 20, 17, 'E')
    return g

def tower_magic():
    g = grid()
    col('h', (74, 60, 96)); col('H', (94, 78, 120)); col('D', (50, 40, 70))
    col('E', (200, 140, 255))
    rect(g, 13, 12, 27, 36, 'h')
    vline(g, 14, 12, 36, 'H'); vline(g, 26, 12, 36, 'D')
    for y in range(16, 36, 5): hline(g, y, 13, 27, 'D')
    for i in range(5):                                            # шпиль-обелиск
        rect(g, 15 + i, 11 - i * 2, 25 - i, 12 - i * 2, 'h')
    px(g, 20, 1, 'E')
    disc(g, 20, 5, 3, 'q'); disc(g, 20, 5, 2, 'E'); px(g, 20, 4, 'C'); col('C', (236, 214, 255))
    px(g, 15, 3, 'E'); px(g, 25, 6, 'E')
    for y in (20, 26, 32): px(g, 20, y, 'E')
    rect(g, 10, 34, 30, 37, 'D'); hline(g, 34, 11, 29, 'H')
    skull_small(g, 20, 30)
    return g

def tower_poison():
    g = grid()
    col('E', (120, 200, 60)); col('e', (80, 150, 40))
    tower_base(g)
    rect(g, 10, 10, 30, 16, 'k'); ellip(g, 20, 10, 10, 3, 'k')    # котёл
    ellip(g, 20, 10, 8, 2, 'E')
    px(g, 14, 8, 'e'); px(g, 24, 7, 'e'); px(g, 20, 5, 'e')       # пузыри
    px(g, 17, 4, 'E'); px(g, 23, 3, 'E')
    hline(g, 16, 10, 30, 'i'); px(g, 12, 12, 'I'); px(g, 28, 13, 'I')
    px(g, 14, 22, 'E'); px(g, 25, 27, 'E')                        # потёки
    px(g, 14, 23, 'e'); px(g, 25, 28, 'e')
    px(g, 16, 30, 'e'); px(g, 23, 31, 'e')
    return g

def tower_lightning():
    g = grid()
    col('E', (255, 220, 80)); col('e', (240, 170, 50))
    tower_base(g)
    platform(g, y=14)
    rect(g, 16, 4, 24, 13, 'f'); hline(g, 6, 16, 24, 'F')         # тотем
    hline(g, 11, 16, 24, 'o')
    rect(g, 17, 7, 19, 9, 'o'); rect(g, 21, 7, 23, 9, 'o')
    px(g, 18, 8, 'E'); px(g, 22, 8, 'E')
    rect(g, 18, 11, 22, 12, 'o')
    for x in (16, 19, 22): vline(g, x, 13, 15, 'o')
    disc(g, 20, 3, 3, 'e'); disc(g, 20, 3, 2, 'E'); px(g, 20, 2, 'C'); col('C', (255, 250, 200))
    px(g, 15, 1, 'E'); px(g, 26, 4, 'E')
    px(g, 14, 18, 'e'); px(g, 27, 21, 'e')                        # искры на камне
    return g

def tower_buffer():
    g = grid()
    col('R', (150, 44, 40)); col('r', (110, 30, 28)); col('E', (230, 200, 140))
    tower_base(g)
    rect(g, 10, 8, 30, 15, 'F'); ellip(g, 20, 8, 10, 3, 'S')      # барабан
    hline(g, 10, 10, 30, 'r'); hline(g, 13, 10, 30, 'r')
    px(g, 14, 11, 'M'); px(g, 26, 11, 'M')
    line(g, 12, 2, 20, 7, 'k'); line(g, 28, 2, 20, 7, 'k')        # палочки крестом
    px(g, 11, 1, 'S'); px(g, 29, 1, 'S')
    rect(g, 6, 16, 9, 24, 'R'); rect(g, 31, 16, 34, 24, 'R')      # знамёна
    px(g, 7, 25, 'r'); px(g, 8, 25, 'r'); px(g, 32, 25, 'r'); px(g, 33, 25, 'r')
    px(g, 8, 18, 'E'); px(g, 32, 18, 'E')
    return g

def tower_siege():
    g = grid()
    tower_base(g)
    platform(g, y=14)
    line(g, 6, 6, 14, 10, 'f'); line(g, 6, 6, 9, 12, 'f')         # дуга баллисты
    line(g, 34, 6, 26, 10, 'f'); line(g, 34, 6, 31, 12, 'f')
    line(g, 7, 7, 33, 7, 'S')                                     # тетива
    rect(g, 16, 7, 24, 10, 'f'); hline(g, 7, 17, 23, 'F')         # ложо
    vline(g, 15, 6, 9, 'I'); px(g, 15, 5, 'S')                    # болт
    px(g, 14, 4, 'I'); px(g, 13, 3, 'I')
    vline(g, 25, 6, 9, 'I'); px(g, 26, 5, 'S')
    px(g, 20, 12, 'k'); px(g, 21, 12, 'k')
    rect(g, 12, 16, 28, 17, 'k')
    return g

# ============ реестр ============
SPRITES = {
    'enemies/boar':        ('Кабан', boar),
    'enemies/wolf':        ('Волк', wolf),
    'enemies/zombie':      ('Зомби', zombie),
    'enemies/bat':         ('Мышь', bat),
    'enemies/skeleton':    ('Скелет', skeleton),
    'enemies/spider':      ('Паук', spider),
    'enemies/orc':         ('Орк', orc),
    'enemies/dark_mage':   ('Тёмный маг', dark_mage),
    'enemies/drake':       ('Дрейк', drake),
    'enemies/knight':      ('Рыцарь', knight),
    'enemies/ghost':       ('Призрак', ghost),
    'enemies/berserker':   ('Берсерк', berserker),
    'enemies/sentinel':    ('Страж', sentinel),
    'enemies/wind_shaman': ('Шаман ветра', wind_shaman),
    'enemies/gargoyle':    ('Горгулья', gargoyle),
    'enemies/necromancer': ('Некромант', necromancer),
    'bosses/orc_chief':    ('Вождь орков', orc_chief),
    'bosses/spider_queen': ('Королева пауков', spider_queen),
    'bosses/dragon_lord':  ('Драконий лорд', dragon_lord),
    'bosses/lich_king':    ('Лич-король', lich_king),
    'bosses/demon_lord':   ('Владыка демонов', demon_lord),
    'bosses/shadow_lord':  ('Владыка теней', shadow_lord),
    'bosses/iron_golem':   ('Железный голем', iron_golem),
    'bosses/wind_walker':  ('Ходячий ветер', wind_walker),
    'towers/archer':       ('Лучник', tower_archer),
    'towers/cannon':       ('Пушка', tower_cannon),
    'towers/ice':          ('Ледяная', tower_ice),
    'towers/magic':        ('Чернокнижник', tower_magic),
    'towers/poison':       ('Алхимик', tower_poison),
    'towers/lightning':    ('Шаман', tower_lightning),
    'towers/drum':         ('Барабан', tower_buffer),
    'towers/siege':        ('Осадная', tower_siege),
}

def render(shaded):
    img = Image.new('RGBA', (W * SCALE, H * SCALE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for y in range(H):
        for x in range(W):
            v = shaded[y][x]
            if v == '.':
                continue
            rgb = C[v] if isinstance(v, str) else v
            d.rectangle([x * SCALE, y * SCALE, (x + 1) * SCALE - 1, (y + 1) * SCALE - 1],
                        fill=tuple(rgb) + (255,))
    return img

def main():
    for sub in ('enemies', 'bosses', 'towers'):
        os.makedirs(os.path.join(SPR, sub), exist_ok=True)
    images = []
    for key, (title, painter) in SPRITES.items():
        C.clear(); C.update(BASE)
        shaded = shade(outline(painter()))
        img = render(shaded)
        path = os.path.join(SPR, key + '.png')
        img.save(path)
        images.append((title, img))
        print('OK', path)
    # превью: сетка 6×4
    title_font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 20)
    label_font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)
    cols, cell, pad, head = 6, 170, 16, 54
    rows_n = (len(images) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cell + pad * 2, head + rows_n * cell + pad), (11, 10, 15))
    d = ImageDraw.Draw(sheet)
    d.text((pad, 14), 'Этап 5 — полный бестиарий (32 фигуры: 16 врагов + 8 боссов + 8 башен)',
           font=title_font, fill=(210, 202, 184))
    for i, (title, img) in enumerate(images):
        cx = pad + (i % cols) * cell
        cy = head + (i // cols) * cell
        d.rectangle([cx, cy, cx + cell - 1, cy + cell - 1], fill=(28, 25, 36), outline=(58, 50, 68))
        big = img.resize((140, 140), Image.NEAREST)
        sheet.paste(big, (cx + (cell - 140) // 2, cy + 4), big)
        d.text((cx + 6, cy + cell - 22), title, font=label_font, fill=(186, 176, 158))
    out = os.path.join(ROOT, 'docs', 'sprites_preview.png')
    sheet.save(out)
    print('OK', out)

if __name__ == '__main__':
    main()
