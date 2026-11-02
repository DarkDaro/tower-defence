#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Вынос баланса из js/game.js в js/balance.js (чанк «баланс в конфиг»).

Правила проекта: изменения кода — скриптом, с бэкапом в Archive/, идемпотентно
(повторный запуск ничего не портит — просто отказывается работать).

Что делает:
  1) бэкапит js/game.js и index.html в Archive/ (с датой);
  2) извлекает пять больших блоков (towerDefs, enemyBase, bossTypes, waveMods,
     waves) со счётчиком скобок и собирает из них js/balance.js
     (window.TD_BALANCE = { towers, enemies, bosses, waveMods, waves, ... });
  3) заменяет блоки в game.js ссылками на конфиг, а раскиданные по коду числа
     (старт/мана/экономика/спеллы/спавн/моды) — точечными заменами строк;
  4) подключает balance.js в index.html ДО game.js;
  5) проверяет синтаксис обоих файлов (node --check).

Запуск из корня репо: python3 scripts/extract_balance.py
"""
import datetime
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
GAME = REPO / "js" / "game.js"
BAL = REPO / "js" / "balance.js"
HTML = REPO / "index.html"
ARCHIVE = REPO / "Archive"
TODAY = "2026-11-02"

# (якорь объявления, имя ключа в TD_BALANCE, закрывающий символ)
BLOCKS = [
    ("const towerDefs = ", "towers", "{"),
    ("const enemyBase = ", "enemies", "["),
    ("const bossTypes = ", "bosses", "["),
    ("const waveMods = ", "waveMods", "["),
    ("const waves = ", "waves", "["),
]

CLOSE = {"{": "}", "[": "]"}

# точечные замены: (старое, новое). Каждая строка должна встречаться ровно 1 раз.
REPL = [
    # старт и ресурсы
    ("let gold = 200, lives = 20, waveNum = 0,",
     "let gold = TD_BALANCE.start.gold, lives = TD_BALANCE.start.lives, waveNum = 0,"),
    ("let mana = 0, maxMana = 1000, manaRegen = 15;",
     "let mana = 0, maxMana = TD_BALANCE.mana.max, manaRegen = TD_BALANCE.mana.regen;"),
    # масштабирование сложности
    ("return Math.pow(1.08, wave - 1);",
     "return Math.pow(TD_BALANCE.economy.hpGrowth, wave - 1);"),
    ("return 1 + (getDifficultyMultiplier(wave) - 1) * 0.3;",
     "return 1 + (getDifficultyMultiplier(wave) - 1) * TD_BALANCE.economy.armorGrowth;"),
    ("this.reward = Math.max(1, Math.round(src.reward * 0.75)); // экономика строже",
     "this.reward = Math.max(1, Math.round(src.reward * TD_BALANCE.economy.rewardMult)); // экономика строже"),
    # эффекты модов волн
    ("""                    if (mod.id === 'speed') this.baseSpeed *= 1.25;
                    if (mod.id === 'armor') this.armor += 10;
                    if (mod.id === 'regen') this.regen = 0.01;
                    if (mod.id === 'shield') this.waveShield = 0.25;""",
     """                    const mfx = TD_BALANCE.waveFx;
                    if (mod.id === 'speed') this.baseSpeed *= mfx.speedMult;
                    if (mod.id === 'armor') this.armor += mfx.armorAdd;
                    if (mod.id === 'regen') this.regen = mfx.regenRate;
                    if (mod.id === 'shield') this.waveShield = mfx.shieldCut;"""),
    # апгрейд/продажа
    ("upgradeCost() { return this.level<4 ? 120 + this.level*90 : null; }",
     "upgradeCost() { return this.level<4 ? TD_BALANCE.economy.upgradeBase + this.level*TD_BALANCE.economy.upgradeStep : null; }"),
    ("sum += 120 + i*90; return Math.floor(sum*0.4); }",
     "sum += TD_BALANCE.economy.upgradeBase + i*TD_BALANCE.economy.upgradeStep; return Math.floor(sum*TD_BALANCE.economy.sellRatio); }"),
    # старт модов и спавн
    ("return n >= 6 ? waveMods[(n - 6) % waveMods.length] : null;",
     "return n >= TD_BALANCE.modsFromWave ? waveMods[(n - TD_BALANCE.modsFromWave) % waveMods.length] : null;"),
    ("delay += 2;", "delay += TD_BALANCE.bossGap;"),
    ("t: delay + i*0.3, type: group.type });",
     "t: delay + i*TD_BALANCE.spawnInterval, type: group.type });"),
    ("delay += group.count * 0.3;",
     "delay += group.count * TD_BALANCE.spawnInterval;"),
    # бонус зачистки
    ("const bonusGold = Math.max(0, Math.floor(30 - waveElapsed * 0.25));",
     "const bonusGold = Math.max(0, Math.floor(TD_BALANCE.economy.clearBonusBase - waveElapsed * TD_BALANCE.economy.clearBonusDecay));"),
    # заклинания: Молния
    ("""            if (mana<300) { playError(); showToast('Нужно 300 маны'); return; }
            mana-=300; lightningCD=15; playLightning();
            const dmg = Math.floor(200 * (1 + waveNum * 0.08));""",
     """            const sp = TD_BALANCE.spells.lightning;
            if (mana<sp.mana) { playError(); showToast('Нужно ' + sp.mana + ' маны'); return; }
            mana-=sp.mana; lightningCD=sp.cd; playLightning();
            const dmg = Math.floor(sp.dmg * (1 + waveNum * TD_BALANCE.spellDmgGrowth));"""),
    # заклинания: Ледяной шторм
    ("""            if (mana<400) { playError(); showToast('Нужно 400 маны'); return; }
            mana-=400; frostCD=18; playFrost();
            const dmg = Math.floor(60 * (1 + waveNum * 0.08));""",
     """            const sp = TD_BALANCE.spells.frost;
            if (mana<sp.mana) { playError(); showToast('Нужно ' + sp.mana + ' маны'); return; }
            mana-=sp.mana; frostCD=sp.cd; playFrost();
            const dmg = Math.floor(sp.dmg * (1 + waveNum * TD_BALANCE.spellDmgGrowth));"""),
    ("e.applySlow(0.05, 6); e.applyFreeze(2); e.takeDamage(dmg, 'ice');",
     "e.applySlow(sp.slowFactor, sp.slowDur); e.applyFreeze(sp.freeze); e.takeDamage(dmg, 'ice');"),
    # заклинания: Огненный дождь
    ("""            if (mana<500) { playError(); showToast('Нужно 500 маны'); return; }
            mana-=500; fireRainCD=22; playFire();
            const dmg = Math.floor(150 * (1 + waveNum * 0.08));""",
     """            const sp = TD_BALANCE.spells.fireRain;
            if (mana<sp.mana) { playError(); showToast('Нужно ' + sp.mana + ' маны'); return; }
            mana-=sp.mana; fireRainCD=sp.cd; playFire();
            const dmg = Math.floor(sp.dmg * (1 + waveNum * TD_BALANCE.spellDmgGrowth));"""),
    ("e.applyDot(Math.round(20 * (1 + waveNum * 0.06)), 3);",
     "e.applyDot(Math.round(sp.dot * (1 + waveNum * sp.dotGrowth)), sp.dotDur);"),
    # тултипы спеллов — тоже из конфига, чтобы не разъезжались
    ("""        initSpellBtn('lightning-btn', 'Гнев небес — 200 урона всем врагам (+8% за волну). 300 маны, КД 15с');
        initSpellBtn('frost-btn', 'Ледяной шторм — 60 урона, заморозка 2с, замедление 95% на 6с. 400 маны, КД 18с');
        initSpellBtn('fire-rain-btn', 'Огненный дождь — 150 урона и горение, усиливается с волной. 500 маны, КД 22с');""",
     """        // стоимости на кнопках и в aria — из конфига (в разметке значения по умолчанию)
        [['lightning-btn', 'lightning'], ['frost-btn', 'frost'], ['fire-rain-btn', 'fireRain']].forEach(p => {
            const el = document.getElementById(p[0]), cost = TD_BALANCE.spells[p[1]].mana;
            el.innerHTML = el.innerHTML.replace(/\\(\\d+</, '(' + cost + '<');
            el.setAttribute('aria-label', (el.getAttribute('aria-label') || '').replace(/\\d+ маны/, cost + ' маны'));
        });
        const spL = TD_BALANCE.spells.lightning, spF = TD_BALANCE.spells.frost, spR = TD_BALANCE.spells.fireRain;
        initSpellBtn('lightning-btn', 'Гнев небес — ' + spL.dmg + ' урона всем врагам (+' + Math.round(TD_BALANCE.spellDmgGrowth*100) + '% за волну). ' + spL.mana + ' маны, КД ' + spL.cd + 'с');
        initSpellBtn('frost-btn', 'Ледяной шторм — ' + spF.dmg + ' урона, заморозка ' + spF.freeze + 'с, замедление ' + Math.round((1-spF.slowFactor)*100) + '% на ' + spF.slowDur + 'с. ' + spF.mana + ' маны, КД ' + spF.cd + 'с');
        initSpellBtn('fire-rain-btn', 'Огненный дождь — ' + spR.dmg + ' урона и горение, усиливается с волной. ' + spR.mana + ' маны, КД ' + spR.cd + 'с');"""),
    # рестарт и загрузка сейва
    ("gold = 200; lives = 20; waveNum = 0; waveActive = false; waveSpawningComplete = true;",
     "gold = TD_BALANCE.start.gold; lives = TD_BALANCE.start.lives; waveNum = 0; waveActive = false; waveSpawningComplete = true;"),
    ("gold = state.gold ?? 200;", "gold = state.gold ?? TD_BALANCE.start.gold;"),
    ("lives = state.lives ?? 20;", "lives = state.lives ?? TD_BALANCE.start.lives;"),
]

HEADER = """// ============================================================================
// БАЛАНС «ЦИТАДЕЛИ ОРДЫ» — все ручки настройки в одном файле.
//
// Здесь: стартовые ресурсы, мана, экономика (апгрейды/продажа/награды),
// масштабирование сложности, заклинания, башни, враги, боссы, составы волн.
// js/game.js читает window.TD_BALANCE при загрузке — менять можно прямо тут,
// без правок кода. Разбор «что на что влияет» и протокол замеров —
// docs/balance.md. Подключается в index.html ДО js/game.js.
//
// Иконки кнопок (SVG) и эмодзи/цвета существ едут вместе с определениями —
// это часть описания сущности, код их только читает.
// ============================================================================
window.TD_BALANCE = {

    // ---------- СТАРТ И РЕСУРСЫ ----------
    start: { gold: 200, lives: 20 },   // стартовые золото и жизни
    mana:  { max: 1000, regen: 15 },   // предел маны; реген 15/с — только во время волны
    spawnInterval: 0.3,                // интервал спавна тварей внутри волны, с
    bossGap: 2,                        // пауза между боссами в волне, с
    modsFromWave: 6,                   // с какой волны крутятся модификаторы (по кругу)

    // ---------- ЭКОНОМИКА ----------
    economy: {
        upgradeBase: 120, upgradeStep: 90,         // апгрейд: 120 + level*90 → 210/300/390
        sellRatio: 0.4,                            // продажа возвращает 40% вложенного
        rewardMult: 0.75,                          // награда за голову ×0.75 при спавне
        clearBonusBase: 30, clearBonusDecay: 0.25, // бонус зачистки: max(0, 30 − t×0.25)
        hpGrowth: 1.08,                            // HP врагов ×1.08^(волна−1): в10 ≈ ×2.0, в20 ≈ ×4.3, в30 ≈ ×9.3
        armorGrowth: 0.3                           // броня растёт втрое медленнее HP (чтобы не упираться в кап реза 60%)
    },
    // числовые эффекты модификаторов волн (сами моды — в waveMods ниже)
    waveFx: { speedMult: 1.25, armorAdd: 10, regenRate: 0.01, shieldCut: 0.25 },

    // ---------- ЗАКЛИНАНИЯ ----------
    // реген маны только во время волны; кастовать можно и между волнами
    spells: {
        lightning: { mana: 300, cd: 15, dmg: 200 },                                        // Гнев небес: урон всем врагам
        frost:     { mana: 400, cd: 18, dmg: 60, freeze: 2, slowFactor: 0.05, slowDur: 6 }, // Ледяной шторм: +заморозка и замедление до 5% скорости
        fireRain:  { mana: 500, cd: 22, dmg: 150, dot: 20, dotGrowth: 0.06, dotDur: 3 }     // Огненный дождь: +горение
    },
    spellDmgGrowth: 0.08,              // урон заклинаний ×(1 + волна×0.08)

    // ---------- БАШНИ, ВРАГИ, ВОЛНЫ ----------
"""


def die(msg):
    print("ОТКАЗ: " + msg)
    sys.exit(1)


def find_block(src, anchor, open_ch):
    """Возвращает (начало значения, конец значения) литерала после anchor."""
    i = src.index(anchor) + len(anchor)
    while src[i] in " \t\r\n":
        i += 1
    assert src[i] == open_ch, "ожидался %r после %r, найдено %r" % (open_ch, anchor, src[i:i + 20])
    close_ch = CLOSE[open_ch]
    depth = 0
    j = i
    while True:
        if j >= len(src):
            die("блок не закрыт до конца файла: " + anchor)
        c = src[j]
        if c == open_ch:
            depth += 1
        elif c == close_ch:
            depth -= 1
            if depth == 0:
                break
        # NB: комментарии внутри блоков не парсим — в них нет квадратных/фигурных скобок,
        # но точка с запятой встречается (комментарий к 7-й волне), поэтому сторожа на ';' нет.
        j += 1
    return i, j  # включительно


def dedent4(text):
    """12 пробелов внутри блоков game.js → 8 в balance.js (вложенность под ключ)."""
    out = []
    for ln in text.split("\n"):
        out.append(ln[4:] if ln.startswith("    ") else ln)
    return "\n".join(out)


def main():
    if BAL.exists():
        die("js/balance.js уже существует — скрипт уже отработал")
    src = GAME.read_text(encoding="utf-8")

    # 1) извлечь блоки
    found = {}
    for anchor, key, open_ch in BLOCKS:
        if anchor not in src:
            die("не найден якорь: " + anchor)
        i, j = find_block(src, anchor, open_ch)
        found[key] = (anchor, i, j)
    # пересечение блоков — признак ошибки разбора
    spans = sorted((i, j, k) for k, (_, i, j) in found.items())
    for (a1, b1, k1), (a2, b2, k2) in zip(spans, spans[1:]):
        if a2 <= b1:
            die("блоки %s и %s пересекаются" % (k1, k2))

    # 2) бэкапы
    ARCHIVE.mkdir(exist_ok=True)
    for f, pattern in ((GAME, "js_game_%s.js"), (HTML, "index_%s.html")):
        dst = ARCHIVE / (pattern % TODAY)
        n = 2
        while dst.exists():
            dst = ARCHIVE / (pattern.replace(".js", "-%d.js" % n).replace(".html", "-%d.html" % n) % TODAY)
            n += 1
        shutil.copy2(f, dst)
        print("бэкап: %s" % dst.relative_to(REPO))

    # 3) собрать balance.js
    parts = [HEADER]
    for anchor, key, _ in BLOCKS:
        _, i, j = found[key]
        value = dedent4(src[i:j + 1])
        parts.append("    %s: %s,\n\n" % (key, value))
    parts.append("};\n")
    BAL.write_text("".join(parts), encoding="utf-8")
    print("создан: js/balance.js (%d байт)" % BAL.stat().st_size)

    # 4) заменить блоки ссылками
    for anchor, key, _ in sorted(BLOCKS, key=lambda b: -found[b[1]][1]):  # с конца
        _, i, j = found[key]
        src = src[:i] + "TD_BALANCE.%s" % key + src[j + 1:]

    # 5) точечные замены
    for old, new in REPL:
        n = src.count(old)
        if n != 1:
            die("замена ожидает 1 вхождение, найдено %d: %r..." % (n, old[:60]))
        src = src.replace(old, new)
    GAME.write_text(src, encoding="utf-8")
    print("game.js: %d блока заменено ссылками, %d точечных правок" % (len(BLOCKS), len(REPL)))

    # 6) index.html: подключить конфиг до game.js
    html = HTML.read_text(encoding="utf-8")
    tag = '<script src="js/game.js"></script>'
    if html.count(tag) != 1:
        die("index.html: ожидался один тег game.js")
    html = html.replace(tag, '<script src="js/balance.js"></script>\n' + tag)
    HTML.write_text(html, encoding="utf-8")
    print("index.html: balance.js подключён до game.js")

    # 7) синтаксис
    for f in (BAL, GAME):
        r = subprocess.run(["node", "--check", str(f)], capture_output=True, text=True)
        if r.returncode != 0:
            die("node --check %s:\n%s" % (f.name, r.stderr))
        print("node --check ok: %s" % f.name)
    print("ГОТОВО")


if __name__ == "__main__":
    main()
