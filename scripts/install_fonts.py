#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""install_fonts.py — локальная установка шрифтов Google Fonts (лицензия SIL OFL).

Скачивает woff2 (подмножества cyrillic/latin) и создаёт css/fonts.css.
Дополнительно заменяет ссылку на fonts.googleapis.com в index.html на локальную.
Идемпотентен: повторный запуск ничего не меняет. Запуск: python3 scripts/install_fonts.py
"""
import io, os, re, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.path.join(ROOT, 'assets', 'fonts')
CSS_DIR = os.path.join(ROOT, 'css')
INDEX = os.path.join(ROOT, 'index.html')
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120.0 Safari/537.36')

# Семейство -> список весов
FAMILIES = {
    'Grenze Gotisch': [400, 600, 800],
    'Ruslan Display': [400],
    'Cormorant Unicase': [600, 700],
    'Cormorant': [500, 600, 700],
}
KEEP_SUBSETS = {'cyrillic-ext', 'cyrillic', 'latin-ext', 'latin'}

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()

def main():
    fonts_css_path = os.path.join(CSS_DIR, 'fonts.css')
    if os.path.exists(fonts_css_path):
        print('Уже установлено (css/fonts.css существует), выходим.'); return

    os.makedirs(FONT_DIR, exist_ok=True)
    os.makedirs(CSS_DIR, exist_ok=True)
    out_css = ['/* Локальные шрифты (SIL OFL). Сгенерировано scripts/install_fonts.py */']

    for family, weights in FAMILIES.items():
        for w in weights:
            fam_q = family.replace(' ', '+')
            url = f'https://fonts.googleapis.com/css2?family={fam_q}:wght@{w}&display=swap'
            css = fetch(url).decode('utf-8')
            # блоки вида: /* cyrillic */ @font-face { ... }
            blocks = re.findall(r'/\*\s*([a-z-]+)\s*\*/\s*(@font-face\s*\{[^}]+\})', css)
            if not blocks:
                print(f'  !! {family} {w}: не получены блоки, пропускаем'); continue
            kept = 0
            for subset, block in blocks:
                if subset not in KEEP_SUBSETS:
                    continue
                m = re.search(r'url\((https://[^)]+\.woff2)\)', block)
                if not m:
                    continue
                data = fetch(m.group(1))
                fname = f"{family.replace(' ', '')}-{w}-{subset}.woff2"
                with open(os.path.join(FONT_DIR, fname), 'wb') as f:
                    f.write(data)
                block = block.replace(m.group(1), f'../assets/fonts/{fname}')
                # font-display: swap добавим, если его нет
                if 'font-display' not in block:
                    block = block.replace(';', '; font-display: swap;', 1)
                out_css.append(f'/* {family} {w} — {subset} */')
                out_css.append(block)
                kept += 1
            print(f'  {family} {w}: скачано {kept} подмножеств')

    with io.open(fonts_css_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out_css) + '\n')
    print('css/fonts.css создан,', len(out_css) // 2, '@font-face блоков')

    # --- index.html: Google Fonts -> локальный файл ---
    html = io.open(INDEX, encoding='utf-8').read()
    if 'css/fonts.css' in html:
        print('index.html уже указывает на локальные шрифты')
    else:
        html2, n = re.subn(
            r'<link href="https://fonts\.googleapis\.com[^"]*" rel="stylesheet">',
            '<link rel="stylesheet" href="css/fonts.css">',
            html)
        if n != 1:
            print(f'  !! ожидалась 1 ссылка на Google Fonts, найдено {n} — index.html не тронут')
            sys.exit(1)
        io.open(INDEX, 'w', encoding='utf-8').write(html2)
        print('index.html: Google Fonts заменён на css/fonts.css')

if __name__ == '__main__':
    main()
