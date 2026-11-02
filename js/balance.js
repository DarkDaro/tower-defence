// ============================================================================
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

    // ---------- СПОСОБНОСТИ ВРАГОВ ----------
    // числовые ручки врождённых способностей; флаги «у кого есть» — в таблицах
    // enemies/bosses выше. Крутятся так же, как остальной баланс.
    abilities: {
        berserk:   { hpThreshold: 0.5, speedMult: 1.6 },     // ярость: HP ниже 50% → скорость ×1.6
        healer:    { cd: 0.6, radius: 80, power: 8 },        // лекарь: тик 0.6с, +8 HP соседям в радиусе 80
        invisible: { dur: 2, cd: 6 },                        // призрак: после урона невидим 2с, КД 6с
        invuln:    { dur: 1 },                               // неуязвимость 1с после полученного урона
        dmgShield: { startCd: 5, dur: 3, cd: 8, cut: 0.5 },  // страж: через 5с включается на 3с, КД 8с, −50% урона
        armorK: 50, armorCap: 0.6,                           // рез брони = armor/(armor+50), не выше 60%
        dotTick: 0.5,                                        // тик яда/горения, с
        leakLives: 1, leakLivesBoss: 5,                      // жизни за прорыв: обычный / босс
        minDamage: 1                                         // броня не делает врага бессмертным
    },

    // ---------- ЗАКЛИНАНИЯ ----------
    // реген маны только во время волны; кастовать можно и между волнами
    spells: {
        lightning: { mana: 300, cd: 15, dmg: 200 },                                        // Гнев небес: урон всем врагам
        frost:     { mana: 400, cd: 18, dmg: 60, freeze: 2, slowFactor: 0.05, slowDur: 6 }, // Ледяной шторм: +заморозка и замедление до 5% скорости
        fireRain:  { mana: 500, cd: 22, dmg: 150, dot: 20, dotGrowth: 0.06, dotDur: 3 }     // Огненный дождь: +горение
    },
    spellDmgGrowth: 0.08,              // урон заклинаний ×(1 + волна×0.08)

    // ---------- БАШНИ, ВРАГИ, ВОЛНЫ ----------
    towers: {
        archer: { name:'Лучник', icon:'🏹', cost:60,
            damage:[20,34,50,70], range:[150,170,190,210], cooldown:[0.75,0.63,0.50,0.44], multishot:[1,1,1,3], damageType:'physical',
            projColor:'#ffaa00', projSpeed:500, desc:'Быстрая атака, мультивыстрел (3 стрелы) на 4 ур.' },
        cannon: { name:'Пушка', icon:'💣', cost:90,
            damage:[40,62,88,120], range:[130,145,160,175], cooldown:[1.75,1.50,1.25,1.13], aoe:[55,65,75,90], damageType:'physical', targets:'ground',
            projColor:'#ff4400', projSpeed:340, desc:'Взрывной урон по области, не бьёт летунов' },
        ice: { name:'Ледяная', icon:'<span class="ic ic-blue"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><g stroke="#8ecbff" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M4 6l16 12M20 6L4 18"/></g></svg></span>', cost:70,
            damage:[16,30,46,64], range:[140,160,180,200], cooldown:[1.13,1.00,0.88,0.75], slow:[0.4,0.3,0.2,0.15], slowDur:2.5, freezeChance:[0,0,0,0.35], freezeDur:[0,0,0,1.5], damageType:'ice',
            projColor:'#88ccff', projSpeed:400, desc:'Замедление, шанс заморозки на 4 ур.' },
        magic: { name:'Чернокнижник', icon:'<span class="ic ic-mana"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" fill="#a58cff" stroke="#3a2470" stroke-width="2"/><ellipse cx="9.5" cy="9" rx="2.6" ry="1.6" fill="#ffffff" opacity="0.75"/><path d="M6 19l6 3 6-3" fill="none" stroke="#3a2470" stroke-width="2" stroke-linecap="round"/></svg></span>', cost:110,
            damage:[45,72,102,140], range:[140,150,160,170], cooldown:[2.13,1.88,1.63,1.38], ignoreArmor:true, damageType:'magic',
            projColor:'#cc66ff', projSpeed:320, desc:'Игнорирует броню' },
        poison: { name:'Алхимик', icon:'🧪', cost:80,
            damage:[20,36,54,76], range:[130,145,160,175], cooldown:[1.25,1.13,1.00,0.88], dotDmg:[12,22,34,48], dotDur:3, epidemic:[0,0,0,70], damageType:'poison',
            projColor:'#88cc44', projSpeed:360, desc:'Яд на 3 сек., эпидемия по соседям на 4 ур.' },
        lightning: { name:'Шаман', icon:'<span class="ic ic-gold"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M13 2L5 14h5l-1.5 8L19 9h-5.5z" fill="#ffcf7a" stroke="#9a6a10" stroke-width="1.2"/></svg></span>', cost:100,
            damage:[30,48,70,95], range:[140,155,170,185], cooldown:[1.50,1.38,1.25,1.06], chain:[3,3,3,5], chainRange:90, damageType:'lightning',
            projColor:'#ffdd00', projSpeed:550, desc:'Цепная молния: 3 цели, на 4 ур. — 5' },
        buffer: { name:'Барабан', icon:'🥁', cost:120,
            damage:[0,0,0,0], range:[0,0,0,0], cooldown:[99,99,99,99], damageType:'none',
            auraBuff:[0.25,0.30,0.35,0.40], auraRadius:[120,140,160,180],
            projColor:'#ffcc00', projSpeed:0, desc:'Баффает урон соседних башен +25-40%' },
        siege: { name:'Осадная', icon:'⚔️', cost:100,
            damage:[32,52,76,105], range:[140,155,170,185], cooldown:[2.00,1.75,1.50,1.25], ignoreArmor:true, damageType:'physical', targets:'ground',
            projColor:'#cccccc', projSpeed:380, desc:'Пробивает броню, не бьёт летунов' }
    },

    enemies: [
        { name:'Кабан', emoji:'🐗', hp:100, speed:65, armor:0, resist:{}, reward:18, color:'#8B4513' },
        { name:'Волк', emoji:'🐺', hp:65, speed:105, armor:0, resist:{}, reward:15, color:'#A0A0A0' },
        { name:'Зомби', emoji:'🧟', hp:180, speed:55, armor:10, resist:{}, reward:22, color:'#2E7D32' },
        { name:'Мышь', emoji:'🦇', hp:55, speed:125, armor:0, resist:{}, reward:13, color:'#424242', flying:true },
        { name:'Скелет', emoji:'💀', hp:130, speed:70, armor:15, resist:{}, reward:25, color:'#ECEFF1' },
        { name:'Паук', emoji:'🕷️', hp:80, speed:95, armor:5, resist:{poison:0.5}, reward:17, color:'#880E4F' },
        { name:'Орк', emoji:'👹', hp:170, speed:75, armor:8, resist:{}, berserk:true, reward:20, color:'#4E342E' },
        { name:'Темный маг', emoji:'🧙‍♂️', hp:120, speed:58, armor:5, resist:{magic:0.3}, healer:true, reward:22, color:'#311B92' },
        { name:'Дрейк', emoji:'🐉', hp:260, speed:55, armor:12, resist:{fire:0.4}, reward:16, color:'#BF360C', flying:true },
        { name:'Рыцарь', emoji:'👑', hp:340, speed:45, armor:20, resist:{physical:0.25}, shield:true, reward:20, color:'#FFD700' },
        { name:'Призрак', emoji:'👻', hp:70, speed:90, armor:0, resist:{}, reward:14, color:'#88ccff', canInvisible:true },
        { name:'Берсерк', emoji:'🪓', hp:200, speed:85, armor:5, resist:{}, reward:14, color:'#cc3333', canInvuln:true, berserk:true, size:0.85 },
        { name:'Страж', emoji:'🛡️', hp:250, speed:50, armor:15, resist:{}, reward:16, color:'#4488ff', dmgShield:true },
        { name:'Шаман ветра', emoji:'🌀', hp:120, speed:70, armor:0, resist:{}, reward:16, color:'#66ddaa', auraSpeed:1.3, auraRadius:100 },
        { name:'Горгулья', emoji:'🗿', hp:300, speed:45, armor:25, resist:{physical:0.2}, reward:18, color:'#888888', flying:true },
        { name:'Некромант', emoji:'💀', hp:150, speed:55, armor:5, resist:{magic:0.3}, healer:true, reward:12, color:'#660066' }
    ],

    bosses: [
        { name:'Вождь орков', emoji:'👹', hp:1200, speed:42, armor:15, resist:{}, berserk:true, reward:110, color:'#8B0000', size:1.6 },
        { name:'Королева пауков', emoji:'🕷️', hp:1000, speed:48, armor:10, resist:{poison:0.7}, poison:true, reward:85, color:'#4A148C', size:1.6 },
        { name:'Драконий лорд', emoji:'🐉', hp:1500, speed:38, armor:20, resist:{fire:0.6}, aoeDamage:true, reward:50, color:'#B71C1C', size:1.8, flying:true },
        { name:'Лич-король', emoji:'🧙‍♂️', hp:1400, speed:40, armor:12, resist:{magic:0.5}, healer:true, reward:130, color:'#311B92', size:1.7 },
        { name:'Владыка демонов', emoji:'👑', hp:2200, speed:36, armor:25, resist:{physical:0.3}, shield:true, berserk:true, reward:180, color:'#1a1a1a', size:2.0 },
        { name:'Владыка теней', emoji:'👤', hp:1800, speed:45, armor:10, resist:{magic:0.3}, reward:145, color:'#1a1a3a', size:1.7, canInvisible:true },
        { name:'Железный голем', emoji:'🗿', hp:2500, speed:30, armor:30, resist:{physical:0.3}, reward:160, color:'#555555', size:2.0, dmgShield:true },
        { name:'Ходячий ветер', emoji:'💨', hp:1600, speed:55, armor:8, resist:{}, reward:170, color:'#88ddcc', size:1.6, auraSpeed:1.4, auraRadius:150, canInvuln:true, flying:true }
    ],

    // модификаторы волн: name/sub — отдельные поля (баннер и тост читают их напрямую,
    // раньше парсили человекочитаемую строку по двоеточию)
    waveMods: [
        { id:'speed', icon:'<span class="ic ic-dim"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 9h11a2.5 2.5 0 10-2.5-2.5M3 13h15a2.5 2.5 0 11-2.5 2.5M3 17h8" fill="none" stroke="#c9c2b4" stroke-width="2" stroke-linecap="round"/></svg></span>', name:'Ураган', sub:'+25% скорости врагов' },
        { id:'armor', icon:'<span class="ic ic-blue"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3l7 3v5c0 5-3.2 8.4-7 10-3.8-1.6-7-5-7-10V6z" fill="#4a6a9a" stroke="#8ecbff" stroke-width="1.6"/><path d="M12 3v18" stroke="#8ecbff" stroke-width="1.2"/></svg></span>', name:'Панцирь', sub:'+10 брони врагам' },
        { id:'regen', icon:'<span class="ic"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 20C6 15 3.5 11.5 3.5 8.5 3.5 6 5.5 4 8 4c1.7 0 3.2 1 4 2.4C12.8 5 14.3 4 16 4c2.5 0 4.5 2 4.5 4.5 0 3-2.5 6.5-8.5 11.5z" fill="#7dd87a" stroke="#1d4a1d" stroke-width="1.4"/></svg></span>', name:'Регенерация', sub:'враги лечатся' },
        { id:'shield', icon:'<span class="ic ic-gold"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" fill="#ffcf7a"/><circle cx="19" cy="18" r="1.6" fill="#ffcf7a"/><circle cx="5" cy="17" r="1.2" fill="#ffcf7a"/></svg></span>', name:'Барьер', sub:'враги получают -25% урона' },
        { id:'night', icon:'<span class="ic ic-blue"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 14.5A8.5 8.5 0 019.5 4 8.5 8.5 0 1020 14.5z" fill="#8ecbff" stroke="#2a4a70" stroke-width="1.4"/></svg></span>', name:'Ночь', sub:'темно, светят факелы' },
        { id:'fog',   icon:'<span class="ic ic-dim"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 9c3 0 3-2 6-2s3 2 6 2 3-2 6-2M3 14c3 0 3-2 6-2s3 2 6 2 3-2 6-2M3 19c3 0 3-2 6-2s3 2 6 2 3-2 6-2" fill="none" stroke="#c9c2b4" stroke-width="1.8" stroke-linecap="round" opacity="0.85"/></svg></span>', name:'Туман', sub:'видимость снижена' },
    ],

    waves: [
        // волны 1-3 урезаны по замеру: 3 лучника (весь старт-бюджет) убивали лишь 5 из 12
        // (стрельба фокусом на переднего + перелёт), 7 протечек = поражение. 8 кабанов ≈ 3 протечки.
        [{type:0,count:8}],
        [{type:1,count:12}], // волки 105px/s: при 18 шт. массовая протечка даже с добором башен
        [{type:0,count:12},{type:2,count:9}],
        [{type:1,count:20},{type:3,count:16}],
        [{type:2,count:16},{type:4,count:12},{boss:0}],
        [{type:0,count:24},{type:3,count:16},{type:5,count:12},{type:10,count:8}],
        [{type:1,count:24},{type:4,count:13},{type:6,count:8},{type:11,count:5}], // волна 7 сглажена: было 28/16/10/6 = 60 — шип −9…−11 жизней при недостроенной защите; стало 50
        [{type:2,count:24},{type:5,count:16},{type:7,count:10},{type:12,count:6}],
        [{type:3,count:28},{type:6,count:16},{type:8,count:8},{type:13,count:6}],
        [{type:0,count:28},{type:4,count:20},{type:9,count:10},{type:10,count:8},{boss:1}],
        [{type:1,count:32},{type:5,count:24},{type:8,count:12},{type:11,count:8}],
        [{type:2,count:28},{type:6,count:20},{type:9,count:12},{type:12,count:8},{type:13,count:6}],
        [{type:3,count:32},{type:7,count:20},{type:8,count:16},{type:10,count:10},{type:14,count:6}],
        [{type:4,count:28},{type:8,count:20},{type:9,count:16},{type:11,count:8},{type:15,count:6}],
        [{type:5,count:32},{type:6,count:24},{type:7,count:20},{type:12,count:10},{boss:2}],
        [{type:0,count:36},{type:4,count:28},{type:8,count:20},{type:10,count:12},{type:14,count:8}],
        [{type:1,count:40},{type:5,count:28},{type:9,count:20},{type:11,count:10},{type:13,count:8}],
        [{type:2,count:36},{type:6,count:28},{type:8,count:24},{type:12,count:10},{type:15,count:8}],
        [{type:3,count:40},{type:7,count:28},{type:9,count:24},{type:10,count:12},{type:14,count:8}],
        [{type:4,count:36},{type:6,count:32},{type:8,count:28},{type:11,count:12},{boss:3}],
        [{type:5,count:40},{type:7,count:32},{type:9,count:28},{type:12,count:12},{type:13,count:10}],
        [{type:0,count:44},{type:6,count:36},{type:8,count:28},{type:10,count:14},{type:15,count:10}],
        [{type:1,count:48},{type:7,count:36},{type:9,count:28},{type:11,count:14},{type:14,count:10}],
        [{type:2,count:44},{type:6,count:40},{type:8,count:32},{type:12,count:14},{boss:0},{boss:1}],
        [{type:3,count:48},{type:7,count:40},{type:9,count:32},{type:13,count:12},{boss:2},{boss:5}],
        [{type:4,count:44},{type:8,count:36},{type:9,count:32},{type:10,count:16},{boss:0},{boss:2}],
        [{type:5,count:48},{type:7,count:40},{type:9,count:36},{type:11,count:16},{boss:1},{boss:3}],
        [{type:6,count:52},{type:8,count:40},{type:9,count:36},{type:12,count:16},{boss:0},{boss:1},{boss:2}],
        [{type:7,count:52},{type:8,count:44},{type:9,count:40},{type:14,count:16},{boss:0},{boss:1},{boss:2},{boss:5}],
        [{type:8,count:48},{type:9,count:44},{type:15,count:20},{boss:0},{boss:1},{boss:2},{boss:3},{boss:4},{boss:5},{boss:6}]
    ],

};
