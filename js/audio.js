// ============================================================================
// ЗВУК «ЦИТАДЕЛИ ОРДЫ» — процедурный синтез без аудиофайлов.
//
// Шапка (TD_SOUND) — пресеты всех звуков: каждый = массив слоёв.
//   {t:'tone',  f:частота, d:длина, w:волна, v:громкость, a:атака, f2:частота-в-конце}
//   {t:'noise', d, v, f:фильтр-старт, f2:фильтр-конец, ft:тип фильтра, a}
//   {t:'chord', f:[аккорд], d, w, v, st:разброс по голосам}
//   {t:'crackle', d, v, f} — серия коротких щелчков (искры, треск)
//   {delay:мс} — задержка слоя (секвенции фанфар/минорного спада)
// Громкости слоёв подстраиваются на реальном железе (в headless тишина).
//
// Движок ниже (window.TDAudio) читает ручки из js/config.js (TD_CONFIG.sound):
// defaultVolume, shootGap (троттлинг выстрелов), lowpassHz (срез грубых волн).
// Подключается ПОСЛЕ config.js и ДО game.js.
// ============================================================================
window.TD_SOUND = {

    click: [
        {t:'tone', f:900,  d:0.03,  w:'triangle', v:0.03,  a:0.001, f2:1400},
        {t:'noise', d:0.015, v:0.02, f:4000, ft:'highpass', a:0.001}
    ],
    error: [
        {t:'tone', f:150, d:0.18, w:'square', v:0.055, a:0.005, f2:110},
        {t:'tone', f:98,  d:0.18, w:'sine',   v:0.06,  a:0.005, f2:80}
    ],

    // выстрелы по породам башен (выбор через play('shoot', type))
    shoot: {
        archer:    [ // щелчок тетивы + свист
            {t:'tone', f:1500, d:0.05, w:'triangle', v:0.045, a:0.001, f2:700},
            {t:'noise', d:0.07, v:0.025, f:3000, f2:900, ft:'bandpass', a:0.002}
        ],
        cannon:    [ // пороховой выстрел: удар + давление
            {t:'noise', d:0.22, v:0.14, f:900,  f2:90,  ft:'lowpass', a:0.004},
            {t:'tone',  f:75,   d:0.22, w:'sine', v:0.12, a:0.004, f2:32},
            {t:'noise', d:0.05, v:0.05, f:2500, ft:'highpass', a:0.001}
        ],
        ice:       [ // стеклянный звон
            {t:'tone', f:1150, d:0.12, w:'sine', v:0.04,  a:0.002, f2:950},
            {t:'tone', f:1720, d:0.09, w:'sine', v:0.025, a:0.002, f2:1400},
            {t:'noise', d:0.09, v:0.018, f:5200, f2:2600, ft:'highpass', a:0.003}
        ],
        magic:     [ // нарастающее мерцание
            {t:'tone', f:420,  d:0.16, w:'triangle', v:0.035, a:0.01, f2:760},
            {t:'tone', f:630,  d:0.14, w:'sine', v:0.03,  a:0.02, f2:1140},
            {t:'tone', f:1260, d:0.1,  w:'sine', v:0.012, a:0.03, f2:1600}
        ],
        poison:    [ // плевок
            {t:'tone', f:310, d:0.09, w:'sine', v:0.05, a:0.004, f2:150},
            {t:'noise', d:0.08, v:0.03, f:900, f2:250, ft:'lowpass', a:0.003}
        ],
        lightning: [ // электрический разряд
            {t:'tone', f:2400, d:0.06, w:'sawtooth', v:0.035, a:0.001, f2:320},
            {t:'noise', d:0.08, v:0.035, f:3400, f2:700, ft:'highpass', a:0.001}
        ],
        _default: [ {t:'tone', f:800, d:0.06, w:'sine', v:0.05} ]
    },

    explosion: [ // бабах: суб-бас + падающий шум + осколки
        {t:'noise',   d:0.55, v:0.16, f:1100, f2:60, ft:'lowpass', a:0.005},
        {t:'tone',    f:58,   d:0.5,  w:'sine', v:0.14, a:0.005, f2:26},
        {t:'crackle', d:0.4,  v:0.02, f:2600}
    ],
    lightning: [ // треск разряда + раскат грома
        {t:'noise', d:0.18, v:0.09, f:4200, f2:500, ft:'highpass', a:0.001},
        {t:'tone',  f:1900, d:0.08, w:'sawtooth', v:0.05, a:0.001, f2:140},
        {t:'noise', d:0.7,  v:0.07, f:700,  f2:90,  ft:'lowpass', a:0.02},
        {t:'tone',  f:65,   d:0.7,  w:'sine', v:0.08, a:0.02, f2:38}
    ],
    frost: [ // ледяная вьюга + стылое сияние
        {t:'chord', f:[880,1175,1560,2090], d:0.5, w:'sine', v:0.03,  st:0.045},
        {t:'noise', d:0.8, v:0.05, f:3600, f2:1300, ft:'bandpass', a:0.06},
        {t:'tone',  f:220, d:0.5, w:'sine', v:0.045, a:0.02, f2:165}
    ],
    fire: [ // огненный гул + треск
        {t:'noise',   d:0.9, v:0.09, f:240, f2:1400, ft:'bandpass', a:0.05},
        {t:'tone',    f:85,  d:0.8, w:'sawtooth', v:0.05, a:0.02, f2:42},
        {t:'crackle', d:0.8, v:0.022, f:2200}
    ],
    build: [ // камень на камень
        {t:'tone',  f:170, d:0.09, w:'sine', v:0.08, a:0.003, f2:95},
        {t:'noise', d:0.06, v:0.05, f:420, f2:180, ft:'lowpass', a:0.002},
        {t:'tone',  f:510, d:0.06, w:'triangle', v:0.03, a:0.01, f2:640}
    ],
    upgrade: [ // восторженная лесенка
        {t:'chord', f:[523,659,784,1047], d:0.16, w:'triangle', v:0.04, st:0.035},
        {t:'tone',  f:2093, d:0.18, w:'sine', v:0.02, a:0.06, f2:1568}
    ],
    sell: [ // звон монет
        {t:'tone', f:1245, d:0.07, w:'sine', v:0.045, a:0.001, f2:1100},
        {delay:70, t:'tone', f:1865, d:0.1, w:'sine', v:0.04, a:0.001, f2:1600}
    ],
    waveStart: [ // боевой рог
        {t:'tone',  f:196, d:0.55, w:'sawtooth', v:0.07, a:0.09, f2:185},
        {t:'tone',  f:294, d:0.5,  w:'sawtooth', v:0.045, a:0.11, f2:277},
        {t:'tone',  f:98,  d:0.6,  w:'sine', v:0.08, a:0.05, f2:92},
        {t:'noise', d:0.5, v:0.02, f:600, f2:300, ft:'bandpass', a:0.08}
    ],
    victory: [ // фанфары
        {delay:0,   t:'tone', f:523,  d:0.22, w:'triangle', v:0.06, a:0.01},
        {delay:0,   t:'tone', f:1046, d:0.18, w:'sine', v:0.02, a:0.01},
        {delay:140, t:'tone', f:659,  d:0.22, w:'triangle', v:0.06, a:0.01},
        {delay:140, t:'tone', f:1318, d:0.18, w:'sine', v:0.02, a:0.01},
        {delay:280, t:'tone', f:784,  d:0.22, w:'triangle', v:0.06, a:0.01},
        {delay:280, t:'tone', f:1568, d:0.18, w:'sine', v:0.02, a:0.01},
        {delay:420, t:'tone', f:1047, d:0.22, w:'triangle', v:0.06, a:0.01},
        {delay:420, t:'tone', f:2094, d:0.18, w:'sine', v:0.02, a:0.01},
        {delay:620, t:'chord', f:[523,659,784,1047], d:0.7, w:'triangle', v:0.05, st:0.02}
    ],
    defeat: [ // минорный спад
        {delay:0,   t:'tone', f:330, d:0.5,  w:'sawtooth', v:0.05, a:0.02, f2:310},
        {delay:260, t:'tone', f:262, d:0.5,  w:'sawtooth', v:0.05, a:0.02, f2:246},
        {delay:520, t:'tone', f:220, d:0.5,  w:'sawtooth', v:0.05, a:0.02, f2:207},
        {delay:780, t:'tone', f:165, d:0.5,  w:'sawtooth', v:0.05, a:0.02, f2:155},
        {delay:0,   t:'tone', f:82,  d:1.6,  w:'sine', v:0.08, a:0.04, f2:41}
    ],
    leak: [ // прорыв: тревога
        {t:'tone',  f:392, d:0.14, w:'square', v:0.05, a:0.004, f2:350},
        {delay:130, t:'tone', f:311, d:0.2, w:'square', v:0.05, a:0.004, f2:260},
        {t:'noise', d:0.15, v:0.04, f:800, f2:250, ft:'lowpass', a:0.003}
    ],
    bossSpawn: [ // рёв: гроулинг-бас + рокот
        {t:'tone',    f:72,  d:1.0, w:'sawtooth', v:0.11, a:0.04, f2:40},
        {t:'tone',    f:108, d:0.8, w:'square',   v:0.05, a:0.06, f2:62},
        {t:'noise',   d:1.0, v:0.07, f:380, f2:90, ft:'lowpass', a:0.03},
        {t:'crackle', d:0.5, v:0.015, f:900}
    ],
    freeze: [ // хруст льда
        {t:'chord', f:[1568,2093,2637], d:0.18, w:'sine', v:0.03, st:0.012},
        {t:'noise', d:0.2, v:0.03, f:5200, f2:2000, ft:'highpass', a:0.002},
        {t:'tone',  f:1046, d:0.12, w:'sine', v:0.02, a:0.002, f2:880}
    ],
    poisonHit: [ // шипение
        {t:'noise', d:0.14, v:0.035, f:1300, f2:300, ft:'lowpass', a:0.002},
        {t:'tone',  f:230,  d:0.1,  w:'sine', v:0.04, a:0.004, f2:140}
    ]

};

// ============================================================================
// ДВИЖОК: AudioContext + компрессор + общий буфер шума + исполнение слоёв.
// ============================================================================
window.TDAudio = (function() {
    const SndCfg = (window.TD_CONFIG && window.TD_CONFIG.sound) || {};
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    let ctx = null, master = null, noiseBuf = null;
    let enabled = true;
    let volume = SndCfg.defaultVolume || 0.8;

    function init() {
        if (!ctx) {
            try {
                ctx = new AudioCtx();
                master = ctx.createGain();
                master.gain.value = volume * volume; // квадрат — плавнее слуху
                // компрессор склеивает слои и убирает перегруз на массовых звуках
                const comp = ctx.createDynamicsCompressor();
                comp.threshold.value = -18; comp.knee.value = 25;
                comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.18;
                master.connect(comp); comp.connect(ctx.destination);
                // общий 1-секундный буфер шума (не создаём на каждый звук)
                noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
                const d = noiseBuf.getChannelData(0);
                for (let i=0; i<d.length; i++) d[i] = Math.random()*2 - 1;
            } catch(e) { console.warn('Audio not supported'); }
        }
        // Браузер требует «разбудить» контекст жестом пользователя
        if (ctx && ctx.state === 'suspended') ctx.resume();
    }
    function setEnabled(v) { enabled = !!v; }
    function setVolume(v) {
        volume = Math.max(0, Math.min(1, v));
        if (master) master.gain.value = volume * volume;
    }

    function tone(freq, dur, type, vol, attack, freqEnd) {
        if (!ctx || !enabled) return;
        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, now);
            if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, now + dur);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.linearRampToValueAtTime(vol, now + (attack || 0.005));
            gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
            let node = osc;
            if (type === 'sawtooth' || type === 'square') {
                // для грубых волн срезаем верх, чтобы не звенело
                const lp = ctx.createBiquadFilter();
                lp.type = 'lowpass'; lp.frequency.value = SndCfg.lowpassHz || 2200; lp.Q.value = 0.6;
                osc.connect(lp); node = lp;
            }
            node.connect(gain); gain.connect(master || ctx.destination);
            osc.start(now); osc.stop(now + dur + 0.02);
        } catch(e) {}
    }
    function chord(freqs, dur, type, vol, stagger) {
        freqs.forEach((f, i) => tone(f, dur, type, vol, 0.01 + i * (stagger || 0)));
    }
    function noise(dur, vol, filterFreq, filterEnd, ftype, attack) {
        if (!ctx || !enabled || !noiseBuf) return;
        try {
            const now = ctx.currentTime;
            const src = ctx.createBufferSource();
            src.buffer = noiseBuf; src.loop = true;
            const f = ctx.createBiquadFilter();
            f.type = ftype || 'lowpass'; f.frequency.setValueAtTime(filterFreq, now);
            if (filterEnd) f.frequency.exponentialRampToValueAtTime(Math.max(30, filterEnd), now + dur);
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.0001, now);
            g.gain.linearRampToValueAtTime(vol, now + (attack || 0.005));
            g.gain.exponentialRampToValueAtTime(0.001, now + dur);
            src.connect(f); f.connect(g); g.connect(master || ctx.destination);
            src.start(now); src.stop(now + dur + 0.02);
        } catch(e) {}
    }
    function crackle(dur, vol, filterFreq) { // серия коротких щелчков
        if (!ctx || !enabled) return;
        const n = Math.floor(dur / 0.03);
        for (let i=0; i<n; i++) {
            setTimeout(() => noise(0.02, vol * (0.5 + Math.random()*0.5), filterFreq, null, 'highpass', 0.001), i*30 + Math.random()*15);
        }
    }
    function runLayer(L) {
        if (L.t === 'tone') tone(L.f, L.d, L.w || 'sine', L.v, L.a, L.f2);
        else if (L.t === 'chord') chord(L.f, L.d, L.w || 'sine', L.v, L.st);
        else if (L.t === 'noise') noise(L.d, L.v, L.f, L.f2, L.ft, L.a);
        else if (L.t === 'crackle') crackle(L.d, L.v, L.f);
    }
    function runPreset(layers) {
        (layers || []).forEach(L => { if (L.delay) setTimeout(() => runLayer(L), L.delay); else runLayer(L); });
    }
    function play(name, sub) {
        const p = TD_SOUND[name];
        if (!p) return;
        if (sub && p[sub]) runPreset(p[sub]);
        else if (Array.isArray(p)) runPreset(p);
        else runPreset(p._default);
    }
    // Троттлинг: при 30+ врагах звуки выстрелов сливаются в треск
    let lastShot = 0;
    function playShot(type) {
        const now = performance.now() / 1000;
        if (now - lastShot < (SndCfg.shootGap || 0.035)) return;
        lastShot = now;
        play('shoot', type);
    }
    return { init, setEnabled, setVolume, play, playShot };
})();
