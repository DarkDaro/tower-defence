    (function() {
        // ---------- AUDIO ENGINE v2 (процедурный синтез: слои, фильтры, компрессор) ----------
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        let audioCtx = null;
        let soundEnabled = true;
        let masterGain = null;
        let volume = 0.8;
        let noiseBuf = null; // общий буфер белого шума
        function initAudio() {
            if (!audioCtx) {
                try {
                    audioCtx = new AudioCtx();
                    masterGain = audioCtx.createGain();
                    masterGain.gain.value = volume * volume;
                    // компрессор склеивает слои и убирает перегруз на массовых звуках
                    const comp = audioCtx.createDynamicsCompressor();
                    comp.threshold.value = -18; comp.knee.value = 25;
                    comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.18;
                    masterGain.connect(comp); comp.connect(audioCtx.destination);
                    // общий 1-секундный буфер шума (не создаём на каждый звук)
                    noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
                    const d = noiseBuf.getChannelData(0);
                    for (let i=0;i<d.length;i++) d[i] = Math.random()*2 - 1;
                } catch(e) { console.warn('Audio not supported'); }
            }
            // Браузер требует "разбудить" контекст жестом пользователя
            if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        }
        function audioInitOnce() { initAudio(); document.removeEventListener('pointerdown', audioInitOnce); document.removeEventListener('keydown', audioInitOnce); }
        document.addEventListener('pointerdown', audioInitOnce);
        document.addEventListener('keydown', audioInitOnce);
        // Троттлинг: при 30+ врагах звуки выстрелов сливаются в треск
        let lastShootSound = 0;
        const SHOOT_SOUND_MIN_GAP = 0.035;
        // Тон: для грубых волн срезаем верх низкочастотным фильтром, чтобы не звенело
        function playTone(freq, dur, type='sine', vol=0.08, attack=0.005, freqEnd=null) {
            if (!audioCtx || !soundEnabled) return;
            try {
                const now = audioCtx.currentTime;
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, now);
                if (freqEnd !== null && freqEnd > 0) osc.frequency.exponentialRampToValueAtTime(freqEnd, now + dur);
                gain.gain.setValueAtTime(0.0001, now);
                gain.gain.linearRampToValueAtTime(vol, now + attack);
                gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
                let node = osc;
                if (type === 'sawtooth' || type === 'square') {
                    const lp = audioCtx.createBiquadFilter();
                    lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 0.6;
                    osc.connect(lp); node = lp;
                }
                node.connect(gain); gain.connect(masterGain || audioCtx.destination);
                osc.start(now); osc.stop(now + dur + 0.02);
            } catch(e) {}
        }
        function playChord(freqs, dur, type='sine', vol=0.06, stagger=0) {
            if (!audioCtx || !soundEnabled) return;
            freqs.forEach((f, i) => playTone(f, dur, type, vol, 0.01 + i * stagger));
        }
        // Шум с движущимся фильтром: whoosh/boom/crackle задаётся диапазоном частот
        function playNoise(dur, vol=0.08, filterFreq=800, filterEnd=null, ftype='lowpass', attack=0.005) {
            if (!audioCtx || !soundEnabled || !noiseBuf) return;
            try {
                const now = audioCtx.currentTime;
                const src = audioCtx.createBufferSource();
                src.buffer = noiseBuf; src.loop = true;
                const f = audioCtx.createBiquadFilter();
                f.type = ftype; f.frequency.setValueAtTime(filterFreq, now);
                if (filterEnd !== null) f.frequency.exponentialRampToValueAtTime(Math.max(30, filterEnd), now + dur);
                const g = audioCtx.createGain();
                g.gain.setValueAtTime(0.0001, now);
                g.gain.linearRampToValueAtTime(vol, now + attack);
                g.gain.exponentialRampToValueAtTime(0.001, now + dur);
                src.connect(f); f.connect(g); g.connect(masterGain || audioCtx.destination);
                src.start(now); src.stop(now + dur + 0.02);
            } catch(e) {}
        }
        // Серия коротких щелчков: искры, треск огня, осколки
        function playCrackle(dur, vol=0.02, filterFreq=2200) {
            if (!audioCtx || !soundEnabled) return;
            const n = Math.floor(dur / 0.03);
            for (let i=0;i<n;i++) {
                setTimeout(() => playNoise(0.02, vol * (0.5 + Math.random()*0.5), filterFreq, null, 'highpass', 0.001), i*30 + Math.random()*15);
            }
        }
        function playError() { playTone(150, 0.18, 'square', 0.055, 0.005, 110); playTone(98, 0.18, 'sine', 0.06, 0.005, 80); }
        function playClick() { playTone(900, 0.03, 'triangle', 0.03, 0.001, 1400); playNoise(0.015, 0.02, 4000, null, 'highpass', 0.001); }
        function playShoot(type) {
            switch(type) {
                case 'archer': // щелчок тетивы + свист
                    playTone(1500, 0.05, 'triangle', 0.045, 0.001, 700);
                    playNoise(0.07, 0.025, 3000, 900, 'bandpass', 0.002);
                    break;
                case 'cannon': // пороховой выстрел: удар + давление
                    playNoise(0.22, 0.14, 900, 90, 'lowpass', 0.004);
                    playTone(75, 0.22, 'sine', 0.12, 0.004, 32);
                    playNoise(0.05, 0.05, 2500, null, 'highpass', 0.001);
                    break;
                case 'ice': // стеклянный звон
                    playTone(1150, 0.12, 'sine', 0.04, 0.002, 950);
                    playTone(1720, 0.09, 'sine', 0.025, 0.002, 1400);
                    playNoise(0.09, 0.018, 5200, 2600, 'highpass', 0.003);
                    break;
                case 'magic': // нарастающее мерцание
                    playTone(420, 0.16, 'triangle', 0.035, 0.01, 760);
                    playTone(630, 0.14, 'sine', 0.03, 0.02, 1140);
                    playTone(1260, 0.1, 'sine', 0.012, 0.03, 1600);
                    break;
                case 'poison': // плевок
                    playTone(310, 0.09, 'sine', 0.05, 0.004, 150);
                    playNoise(0.08, 0.03, 900, 250, 'lowpass', 0.003);
                    break;
                case 'lightning': // электрический разряд
                    playTone(2400, 0.06, 'sawtooth', 0.035, 0.001, 320);
                    playNoise(0.08, 0.035, 3400, 700, 'highpass', 0.001);
                    break;
                default: playTone(800, 0.06, 'sine', 0.05);
            }
        }
        function playShootThrottled(type) {
            const now = performance.now() / 1000;
            if (now - lastShootSound < SHOOT_SOUND_MIN_GAP) return;
            lastShootSound = now;
            playShoot(type);
        }
        function playExplosion() { // бабах: суб-бас + падающий шум + осколки
            playNoise(0.55, 0.16, 1100, 60, 'lowpass', 0.005);
            playTone(58, 0.5, 'sine', 0.14, 0.005, 26);
            playCrackle(0.4, 0.02, 2600);
        }
        function playLightning() { // треск разряда + раскат грома
            playNoise(0.18, 0.09, 4200, 500, 'highpass', 0.001);
            playTone(1900, 0.08, 'sawtooth', 0.05, 0.001, 140);
            playNoise(0.7, 0.07, 700, 90, 'lowpass', 0.02);
            playTone(65, 0.7, 'sine', 0.08, 0.02, 38);
        }
        function playFrost() { // ледяная вьюга + стылое сияние
            playChord([880, 1175, 1560, 2090], 0.5, 'sine', 0.03, 0.045);
            playNoise(0.8, 0.05, 3600, 1300, 'bandpass', 0.06);
            playTone(220, 0.5, 'sine', 0.045, 0.02, 165);
        }
        function playFire() { // огненный гул + треск
            playNoise(0.9, 0.09, 240, 1400, 'bandpass', 0.05);
            playTone(85, 0.8, 'sawtooth', 0.05, 0.02, 42);
            playCrackle(0.8, 0.022, 2200);
        }
        function playBuild() { // камень на камень
            playTone(170, 0.09, 'sine', 0.08, 0.003, 95);
            playNoise(0.06, 0.05, 420, 180, 'lowpass', 0.002);
            playTone(510, 0.06, 'triangle', 0.03, 0.01, 640);
        }
        function playUpgrade() { // восторженная лесенка
            playChord([523, 659, 784, 1047], 0.16, 'triangle', 0.04, 0.035);
            playTone(2093, 0.18, 'sine', 0.02, 0.06, 1568);
        }
        function playSell() { // звон монет
            playTone(1245, 0.07, 'sine', 0.045, 0.001, 1100);
            setTimeout(() => playTone(1865, 0.1, 'sine', 0.04, 0.001, 1600), 70);
        }
        function playWaveStart() { // боевой рог
            playTone(196, 0.55, 'sawtooth', 0.07, 0.09, 185);
            playTone(294, 0.5, 'sawtooth', 0.045, 0.11, 277);
            playTone(98, 0.6, 'sine', 0.08, 0.05, 92);
            playNoise(0.5, 0.02, 600, 300, 'bandpass', 0.08);
        }
        function playVictory() { // фанфары
            const fan = [523, 659, 784, 1047];
            fan.forEach((f, i) => setTimeout(() => { playTone(f, 0.22, 'triangle', 0.06, 0.01); playTone(f*2, 0.18, 'sine', 0.02, 0.01); }, i*140));
            setTimeout(() => playChord([523, 659, 784, 1047], 0.7, 'triangle', 0.05, 0.02), 620);
        }
        function playDefeat() { // минорный спад
            [330, 262, 220, 165].forEach((f, i) => setTimeout(() => playTone(f, 0.5, 'sawtooth', 0.05, 0.02, f*0.94), i*260));
            playTone(82, 1.6, 'sine', 0.08, 0.04, 41);
        }
        function playLeak() { // прорыв: тревога
            playTone(392, 0.14, 'square', 0.05, 0.004, 350);
            setTimeout(() => playTone(311, 0.2, 'square', 0.05, 0.004, 260), 130);
            playNoise(0.15, 0.04, 800, 250, 'lowpass', 0.003);
        }
        function playBossSpawn() { // рёв: гроулинг-бас + рокот
            playTone(72, 1.0, 'sawtooth', 0.11, 0.04, 40);
            playTone(108, 0.8, 'square', 0.05, 0.06, 62);
            playNoise(1.0, 0.07, 380, 90, 'lowpass', 0.03);
            playCrackle(0.5, 0.015, 900);
        }
        function playFreeze() { // хруст льда
            playChord([1568, 2093, 2637], 0.18, 'sine', 0.03, 0.012);
            playNoise(0.2, 0.03, 5200, 2000, 'highpass', 0.002);
            playTone(1046, 0.12, 'sine', 0.02, 0.002, 880);
        }
        function playPoisonHit() { // шипение
            playNoise(0.14, 0.035, 1300, 300, 'lowpass', 0.002);
            playTone(230, 0.1, 'sine', 0.04, 0.004, 140);
        }

        let toastTimer = null;
        function showToast(msg) {
            const t = document.getElementById('toast');
            t.innerHTML = msg;
            t.classList.add('show');
            if (toastTimer) clearTimeout(toastTimer);
            toastTimer = setTimeout(() => t.classList.remove('show'), 1500);
        }

        // ---------- CANVAS ----------
        const canvas = document.getElementById('game-canvas');
        const ctx = canvas.getContext('2d');
        const VW = 1792, VH = 1008;             // логический размер поля
        const DPR = Math.min(3, window.devicePixelRatio || 1); // плотность пикселей экрана
        canvas.width = VW * DPR; canvas.height = VH * DPR;     // физический буфер (чёткость)
        ctx.imageSmoothingQuality = 'high';
        const CELL = 56;
        const COLS = 32;
        const ROWS = 18;

        function resize() {
            const maxW = Math.min(window.innerWidth - 40, 1792);
            const maxH = Math.min(window.innerHeight - 280, 1008);
            const scale = Math.min(maxW / 1792, maxH / 1008);
            canvas.style.width = `${1792 * scale}px`;
            canvas.style.height = `${1008 * scale}px`;
        }
        window.addEventListener('resize', resize);
        resize();

        // ---------- GAME STATE ----------
        let gold = 200, lives = 20, waveNum = 0, waveActive = false, waveSpawningComplete = true, autoStart = false;
        let mana = 0, maxMana = 1000, manaRegen = 15;
        let enemies = [], towers = [], projectiles = [], effects = [], particles = [], floatingTexts = [];
        let screenShake = 0;
        let stats = { towersBuilt: 0, goldEarned: 0, enemiesKilled: 0, wavesCompleted: 0 };
        let selectedTower = null, selectedBuildType = null; let massSelType = null;
        let gameSpeed = 1, paused = false, gameOver = false, victory = false;
        let lightningCD = 0, frostCD = 0, fireRainCD = 0;
        let hoverCol = -1, hoverRow = -1;
        const killCount = Array(24).fill(0);
        // Очередь спавна в игровом времени (вместо setTimeout): работает с паузой,
        // ускорением и рестартом без гонок таймеров
        let spawnQueue = [];
        let spawnClock = 0;
        let waveElapsed = 0;
        let autoTimer = -1;
        let totalPlayTime = 0; // секунд чистой игры

        function clearSpawnQueue() { spawnQueue = []; spawnClock = 0; }

        // ---------- PATH ----------
        const rawPath = [
            [0,9],[1,9],[2,9],[3,9],[4,9],[5,9],[6,9],[7,9],[8,9],[9,9],[10,9],[11,9],[12,9],[13,9],
            [13,8],[13,7],[13,6],[13,5],[13,4],[13,3],[13,2],[13,1],[14,1],[15,1],[16,1],[17,1],[18,1],[19,1],[20,1],[21,1],
            [21,2],[21,3],[21,4],[21,5],[21,6],[21,7],[21,8],[21,9],[21,10],[21,11],[21,12],[21,13],
            [20,13],[19,13],[18,13],[17,13],[16,13],[15,13],[14,13],[13,13],[12,13],[11,13],[10,13],[9,13],[8,13],[7,13],
            [7,12],[7,11],[7,10],[7,9],[7,8],[7,7],[7,6],[7,5],[7,4],[7,3],[8,3],[9,3],[10,3],[11,3],[12,3],[13,3],[14,3],[15,3],[16,3],[17,3],[18,3],[19,3],[20,3],
            [20,4],[20,5],[20,6],[20,7],[20,8],[20,9],[20,10],[20,11],[20,12],[21,12],[22,12],[23,12],[24,12],[25,12],[26,12],[27,12],[28,12],[29,12],
            [29,13],[30,13],[31,13]
        ];
        const waypoints = rawPath.map(([x,y]) => ({x,y}));
        const pathPoints = waypoints.map(p => ({ x: p.x * CELL + CELL/2, y: p.y * CELL + CELL/2 }));
        const pathSet = new Set(waypoints.map(p => `${p.x},${p.y}`));

        const decorations = [];
        for (let i=0; i<COLS; i++) for (let j=0; j<ROWS; j++) {
            if (pathSet.has(`${i},${j}`) || Math.random() >= 0.18) continue;
            const roll = Math.random();
            const type = roll < 0.34 ? 'tree' : roll < 0.52 ? 'bush' : roll < 0.70 ? 'rock' : roll < 0.88 ? 'flowers' : 'skull';
            decorations.push({ col:i, row:j, type,
                ox: (Math.random()-0.5)*14, oy: (Math.random()-0.5)*10,
                s: 0.75 + Math.random()*0.5, hue: Math.random() });
        }
        const torches = [];
        // Факелы на обочине дороги: столбики рядом с путём (клетки дороги всё равно
        // незанятые для стройки — башням факелы не мешают)
        for (let i=6; i<pathPoints.length-2; i+=7) {
            const p = pathPoints[i], n = pathPoints[i+1];
            const dx = n.x - p.x, dy = n.y - p.y;
            const len = Math.hypot(dx, dy) || 1;
            const side = (Math.floor(i/7) % 2 === 0) ? 1 : -1;
            torches.push({
                x: p.x + (-dy/len) * CELL*0.3 * side,
                y: p.y + (dx/len) * CELL*0.3 * side,
                offset: Math.random()*Math.PI*2,
                h: 26 + Math.random()*8
            });
        }
        // банки тумана для модификатора "Туман"
        const fogBanks = [];
        for (let i=0; i<8; i++) fogBanks.push({ x: Math.random()*VW, y: Math.random()*VH, r: 130+Math.random()*170, vx: (Math.random()-0.5)*22, vy: (Math.random()-0.5)*14, ph: Math.random()*Math.PI*2 });

        // ---------- TOWERS ----------
        const towerDefs = {
            archer: { name:'Лучник', icon:'🏹', cost:60,
                damage:[20,34,50,70], range:[150,170,190,210], cooldown:[0.75,0.63,0.50,0.44], damageType:'physical',
                projColor:'#ffaa00', projSpeed:500, desc:'Быстрая атака, мультивыстрел на 4 ур.' },
            cannon: { name:'Пушка', icon:'💣', cost:90,
                damage:[40,62,88,120], range:[130,145,160,175], cooldown:[1.75,1.50,1.25,1.13], aoe:[55,65,75,90], damageType:'physical',
                projColor:'#ff4400', projSpeed:340, desc:'Взрывной урон по области' },
            ice: { name:'Ледяная', icon:'<span class="ic ic-blue"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><g stroke="#8ecbff" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M4 6l16 12M20 6L4 18"/></g></svg></span>', cost:70,
                damage:[16,30,46,64], range:[140,160,180,200], cooldown:[1.13,1.00,0.88,0.75], slow:[0.4,0.3,0.2,0.15], slowDur:2.5, damageType:'ice',
                projColor:'#88ccff', projSpeed:400, desc:'Замедление, шанс заморозки' },
            magic: { name:'Чернокнижник', icon:'<span class="ic ic-mana"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" fill="#a58cff" stroke="#3a2470" stroke-width="2"/><ellipse cx="9.5" cy="9" rx="2.6" ry="1.6" fill="#ffffff" opacity="0.75"/><path d="M6 19l6 3 6-3" fill="none" stroke="#3a2470" stroke-width="2" stroke-linecap="round"/></svg></span>', cost:110,
                damage:[45,72,102,140], range:[140,150,160,170], cooldown:[2.13,1.88,1.63,1.38], ignoreArmor:true, damageType:'magic',
                projColor:'#cc66ff', projSpeed:320, desc:'Игнорирует броню' },
            poison: { name:'Алхимик', icon:'🧪', cost:80,
                damage:[20,36,54,76], range:[130,145,160,175], cooldown:[1.25,1.13,1.00,0.88], dotDmg:[12,22,34,48], dotDur:3, damageType:'poison',
                projColor:'#88cc44', projSpeed:360, desc:'Яд на 3 сек., эпидемия на 4 ур.' },
            lightning: { name:'Шаман', icon:'<span class="ic ic-gold"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M13 2L5 14h5l-1.5 8L19 9h-5.5z" fill="#ffcf7a" stroke="#9a6a10" stroke-width="1.2"/></svg></span>', cost:100,
                damage:[30,48,70,95], range:[140,155,170,185], cooldown:[1.50,1.38,1.25,1.06], chain:3, chainRange:90, damageType:'lightning',
                projColor:'#ffdd00', projSpeed:550, desc:'Цепная молния до 3 целей' },
            buffer: { name:'Барабан', icon:'🥁', cost:120,
                damage:[0,0,0,0], range:[0,0,0,0], cooldown:[99,99,99,99], damageType:'none',
                auraBuff:[0.25,0.30,0.35,0.40], auraRadius:[120,140,160,180],
                projColor:'#ffcc00', projSpeed:0, desc:'Баффает урон соседних башен +25-40%' },
            siege: { name:'Осадная', icon:'⚔️', cost:100,
                damage:[32,52,76,105], range:[140,155,170,185], cooldown:[2.00,1.75,1.50,1.25], ignoreArmor:true, damageType:'physical',
                projColor:'#cccccc', projSpeed:380, desc:'Пробивает броню, высокий урон' }
        };

        // ---------- SPRITE ENGINE (тёмное фэнтези, процедурная живопись) ----------
        function hexShade(hex, k) {
            // k>0 — светлее, k<0 — темнее
            const n = parseInt(hex.slice(1), 16);
            let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
            if (k >= 0) { r += (255-r)*k; g += (255-g)*k; b += (255-b)*k; }
            else { r *= (1+k); g *= (1+k); b *= (1+k); }
            return `rgb(${r|0},${g|0},${b|0})`;
        }
        const SPRITE_Q = 3; // спрайты рендерятся в утроенном разрешении и уменьшаются при отрисовке
        function makeSprite(size, paint) {
            const c = document.createElement('canvas');
            c.width = size*SPRITE_Q; c.height = size*SPRITE_Q;
            paint(c.getContext('2d'), size*SPRITE_Q);
            return c;
        }
        // Существо: объёмное тело + глаза + черты по архетипу
        function paintCreature(g, s, d, kind, isBoss) {
            const cx = s/2, cy = s/2 + s*0.04, R = s*0.30;
            // каменная площадка-тень
            g.fillStyle = 'rgba(0,0,0,0.35)';
            g.beginPath(); g.ellipse(cx, s*0.82, R*0.95, R*0.32, 0, 0, 2*Math.PI); g.fill();
            if (kind === 'ghost') g.globalAlpha = 0.75;
            // крылья (летуны и призраки)
            if (kind === 'wyrm' || kind === 'ghost') {
                g.fillStyle = hexShade(d.color, kind === 'ghost' ? 0.25 : -0.25);
                for (const side of [-1, 1]) {
                    g.beginPath();
                    g.moveTo(cx + side*R*0.5, cy - R*0.3);
                    g.quadraticCurveTo(cx + side*R*1.6, cy - R*1.15, cx + side*R*1.75, cy - R*0.1);
                    g.quadraticCurveTo(cx + side*R*1.1, cy - R*0.15, cx + side*R*0.55, cy + R*0.25);
                    g.closePath(); g.fill();
                }
            }
            // тело
            const grad = g.createRadialGradient(cx - R*0.35, cy - R*0.45, R*0.15, cx, cy, R*1.05);
            grad.addColorStop(0, hexShade(d.color, 0.5));
            grad.addColorStop(0.55, d.color);
            grad.addColorStop(1, hexShade(d.color, -0.45));
            g.fillStyle = grad;
            g.beginPath();
            if (kind === 'spider') { g.ellipse(cx, cy, R*1.15, R*0.85, 0, 0, 2*Math.PI); }
            else if (kind === 'wisp') { g.arc(cx, cy, R*0.8, 0, 2*Math.PI); }
            else { g.arc(cx, cy, R, 0, 2*Math.PI); }
            g.fill();
            g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = Math.max(1.5, s*0.02); g.stroke();
            // контровый свет
            g.fillStyle = 'rgba(255,235,200,0.22)';
            g.beginPath(); g.ellipse(cx - R*0.35, cy - R*0.42, R*0.4, R*0.22, -0.5, 0, 2*Math.PI); g.fill();
            // лапы паука
            if (kind === 'spider') {
                g.strokeStyle = hexShade(d.color, -0.55); g.lineWidth = s*0.025; g.lineCap = 'round';
                for (const side of [-1,1]) for (let i=0;i<3;i++) {
                    const ay = cy - R*0.5 + i*R*0.5;
                    g.beginPath(); g.moveTo(cx + side*R*0.7, ay);
                    g.quadraticCurveTo(cx + side*R*1.5, ay - R*0.45, cx + side*R*1.45, ay + R*0.35);
                    g.stroke();
                }
            }
            // рога/клыки
            if (kind === 'orc' || kind === 'brute' || isBoss) {
                g.fillStyle = '#e8ddc8';
                for (const side of [-1,1]) {
                    g.beginPath();
                    g.moveTo(cx + side*R*0.55, cy - R*0.55);
                    g.quadraticCurveTo(cx + side*R*0.95, cy - R*1.05, cx + side*R*0.5, cy - R*1.15);
                    g.quadraticCurveTo(cx + side*R*0.6, cy - R*0.8, cx + side*R*0.32, cy - R*0.62);
                    g.closePath(); g.fill();
                }
            }
            // посох мага
            if (kind === 'mage') {
                g.strokeStyle = '#5a3a22'; g.lineWidth = s*0.035; g.lineCap = 'round';
                g.beginPath(); g.moveTo(cx + R*0.75, cy + R*0.9); g.lineTo(cx + R*0.95, cy - R*1.0); g.stroke();
                const og = g.createRadialGradient(cx + R*0.95, cy - R*1.05, 1, cx + R*0.95, cy - R*1.05, R*0.4);
                og.addColorStop(0, '#cc88ff'); og.addColorStop(1, 'rgba(120,20,200,0.15)');
                g.fillStyle = og;
                g.beginPath(); g.arc(cx + R*0.95, cy - R*1.05, R*0.34, 0, 2*Math.PI); g.fill();
            }
            // щит рыцаря
            if (kind === 'knight' || kind === 'sentinel') {
                g.fillStyle = kind === 'sentinel' ? '#5a6a7a' : '#b8a24a';
                g.beginPath();
                g.moveTo(cx - R*1.05, cy - R*0.35);
                g.lineTo(cx - R*0.1, cy - R*0.5);
                g.lineTo(cx - R*0.1, cy + R*0.5);
                g.quadraticCurveTo(cx - R*0.6, cy + R*1.0, cx - R*1.05, cy + R*0.55);
                g.closePath(); g.fill();
                g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = s*0.015; g.stroke();
            }
            // глаза
            const eyeC = kind === 'ghost' || kind === 'wisp' ? '#aaf0ff' : (isBoss ? '#ffdd33' : '#ffe9b0');
            g.shadowColor = eyeC; g.shadowBlur = s*0.06;
            g.fillStyle = eyeC;
            if (kind === 'spider') {
                for (const sx of [-1,0,1]) for (const sy of [-1,1]) {
                    g.beginPath(); g.arc(cx + sx*R*0.35, cy - R*0.25 + sy*R*0.12, s*0.022, 0, 2*Math.PI); g.fill();
                }
            } else {
                g.beginPath(); g.arc(cx - R*0.3, cy - R*0.15, s*0.032, 0, 2*Math.PI); g.arc(cx + R*0.3, cy - R*0.15, s*0.032, 0, 2*Math.PI); g.fill();
            }
            g.shadowBlur = 0;
            if (kind === 'ghost') g.globalAlpha = 1;
            // золотая отделка боссов
            if (isBoss) {
                g.strokeStyle = 'rgba(255,200,80,0.8)'; g.lineWidth = s*0.02;
                g.beginPath(); g.arc(cx, cy, R*1.12, 0, 2*Math.PI); g.stroke();
            }
        }
        function creatureKind(d) {
            if (d.healer) return 'mage';
            if (d.shield) return 'knight';
            if (d.poison) return 'spider';
            if (d.canInvisible) return 'ghost';
            if (d.auraSpeed) return 'wisp';
            if (d.flying) return 'wyrm';
            if (d.dmgShield) return 'sentinel';
            if (d.canInvuln || d.berserk) return 'brute';
            return 'beast';
        }
        // enemySprites/bossSprites создаются после объявления enemyBase/bossTypes
        const towerSprites = {};
        for (const key in towerDefs) towerSprites[key] = makeSprite(72, (g,s) => paintTowerSprite(g, s, key, towerDefs[key]));
        function paintTowerSprite(g, s, key, d) {
            const cx = s/2, baseY = s*0.68;
            // тень
            g.fillStyle = 'rgba(0,0,0,0.4)';
            g.beginPath(); g.ellipse(cx, s*0.82, s*0.34, s*0.12, 0, 0, 2*Math.PI); g.fill();
            // ствол башни (цилиндр)
            const bodyW = s*0.46, bodyH = s*0.42;
            const grad = g.createLinearGradient(cx - bodyW/2, 0, cx + bodyW/2, 0);
            grad.addColorStop(0, '#3a2a26'); grad.addColorStop(0.35, '#6a5248'); grad.addColorStop(0.7, '#54403a'); grad.addColorStop(1, '#2e211e');
            g.fillStyle = grad;
            g.fillRect(cx - bodyW/2, baseY - bodyH, bodyW, bodyH);
            // кирпичи
            g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1;
            for (let i=1;i<4;i++) { g.beginPath(); g.moveTo(cx-bodyW/2, baseY - bodyH*i/4); g.lineTo(cx+bodyW/2, baseY - bodyH*i/4); g.stroke(); }
            // верхняя площадка (эллипс)
            g.fillStyle = '#7a6258';
            g.beginPath(); g.ellipse(cx, baseY - bodyH, bodyW*0.62, bodyW*0.2, 0, 0, 2*Math.PI); g.fill();
            g.fillStyle = '#8d7468';
            g.beginPath(); g.ellipse(cx, baseY - bodyH - 2, bodyW*0.55, bodyW*0.17, 0, 0, 2*Math.PI); g.fill();
            // зубцы
            g.fillStyle = '#6a5248';
            for (let i=0;i<5;i++) {
                const zx = cx - bodyW*0.55 + i*bodyW*0.27;
                g.fillRect(zx, baseY - bodyH - s*0.09, bodyW*0.14, s*0.09);
            }
            // эмблема типа
            const cy = baseY - bodyH - s*0.20;
            g.lineWidth = s*0.03; g.lineCap = 'round'; g.lineJoin = 'round';
            const emblem = d.projColor;
            g.shadowColor = emblem; g.shadowBlur = s*0.06;
            g.strokeStyle = emblem; g.fillStyle = emblem;
            switch(key) {
                case 'archer':
                    g.beginPath(); g.arc(cx, cy, s*0.13, -1.2, 1.2); g.stroke();
                    g.beginPath(); g.moveTo(cx - s*0.02, cy - s*0.12); g.lineTo(cx - s*0.02, cy + s*0.12); g.stroke();
                    break;
                case 'cannon':
                    g.fillStyle = '#222'; g.fillRect(cx - s*0.04, cy - s*0.11, s*0.10, s*0.22);
                    g.beginPath(); g.arc(cx - s*0.04, cy, s*0.09, 0, 2*Math.PI); g.fill();
                    break;
                case 'ice':
                    g.beginPath(); g.moveTo(cx, cy - s*0.14); g.lineTo(cx + s*0.09, cy); g.lineTo(cx, cy + s*0.14); g.lineTo(cx - s*0.09, cy); g.closePath();
                    g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke();
                    break;
                case 'magic': {
                    const og = g.createRadialGradient(cx, cy, 1, cx, cy, s*0.14);
                    og.addColorStop(0, '#f0c8ff'); og.addColorStop(0.5, emblem); og.addColorStop(1, 'rgba(80,0,120,0.1)');
                    g.fillStyle = og; g.beginPath(); g.arc(cx, cy, s*0.13, 0, 2*Math.PI); g.fill();
                    break; }
                case 'poison':
                    g.beginPath(); g.arc(cx, cy + s*0.03, s*0.09, 0, 2*Math.PI); g.fill();
                    g.fillRect(cx - s*0.025, cy - s*0.15, s*0.05, s*0.09);
                    break;
                case 'lightning':
                    g.beginPath(); g.moveTo(cx + s*0.05, cy - s*0.14); g.lineTo(cx - s*0.06, cy + s*0.02); g.lineTo(cx + s*0.01, cy + s*0.02); g.lineTo(cx - s*0.05, cy + s*0.14); g.lineTo(cx + s*0.08, cy - s*0.03); g.lineTo(cx, cy - s*0.03); g.closePath(); g.fill();
                    break;
                case 'buffer':
                    g.beginPath(); g.ellipse(cx, cy, s*0.12, s*0.09, 0, 0, 2*Math.PI); g.fill();
                    g.strokeStyle = '#e8ddc8'; g.lineWidth = s*0.02;
                    g.beginPath(); g.moveTo(cx, cy - s*0.12); g.lineTo(cx, cy - s*0.18); g.stroke();
                    break;
                case 'siege':
                    for (const a of [-0.6, 0.6]) {
                        g.save(); g.translate(cx, cy); g.rotate(a);
                        g.beginPath(); g.moveTo(-s*0.11, 0); g.lineTo(s*0.11, 0); g.stroke();
                        g.restore();
                    }
                    break;
            }
            g.shadowBlur = 0;
        }

        const towerBtnsDiv = document.getElementById('tower-buttons');
        function createTowerButtons() {
            towerBtnsDiv.innerHTML = '';
            for (let key in towerDefs) {
                const d = towerDefs[key];
                const dps = d.damage[0] > 0 ? (d.damage[0] / d.cooldown[0]).toFixed(0) : '—';
                const btn = document.createElement('div');
                btn.className = 'tower-btn';
                btn.dataset.type = key;
                let tooltip;
                if (d.auraBuff) {
                    tooltip = `Бафф: +${d.auraBuff[0]*100}% | Радиус: ${d.auraRadius[0]}<br>${d.desc}`;
                } else {
                    tooltip = `Урон: ${d.damage[0]} | CD: ${d.cooldown[0]}с | DPS: ${dps}<br>${d.desc}`;
                }
                btn.innerHTML = `<img class="btn-sprite" src="${towerSprites[key].toDataURL()}" alt=""> ${d.name} (${d.cost}<span class="ic ic-gold"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" fill="#ffcf7a" stroke="#9a6a10" stroke-width="2"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="#9a6a10" stroke-width="1.5"/><path d="M12 9v6" stroke="#9a6a10" stroke-width="1.5"/></svg></span>)<div class="tower-tooltip">${tooltip}</div>`;
                btn.addEventListener('click', () => {
                    if (paused || gameOver || victory) return;
                    selectedBuildType = selectedBuildType === key ? null : key;
                    selectedTower = null;
                    updateSelectedInfo();
                    saveGame(); // помним выбранную башню между сессиями
                    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
                    if (selectedBuildType) btn.classList.add('active');
                });
                towerBtnsDiv.appendChild(btn);
            }
        }
        createTowerButtons();

        // ---------- ENEMIES ----------
        const enemyBase = [
            { name:'Кабан', emoji:'🐗', hp:100, speed:65, armor:0, resist:{}, reward:18, color:'#8B4513' },
            { name:'Волк', emoji:'🐺', hp:65, speed:105, armor:0, resist:{}, reward:15, color:'#A0A0A0' },
            { name:'Зомби', emoji:'🧟', hp:180, speed:55, armor:10, resist:{}, reward:22, color:'#2E7D32' },
            { name:'Мышь', emoji:'🦇', hp:55, speed:125, armor:0, resist:{}, reward:13, color:'#424242', flying:true },
            { name:'Скелет', emoji:'💀', hp:130, speed:70, armor:15, resist:{}, reward:25, color:'#ECEFF1' },
            { name:'Паук', emoji:'🕷️', hp:80, speed:95, armor:5, resist:{poison:0.5}, reward:17, color:'#880E4F' },
            { name:'Орк', emoji:'👹', hp:170, speed:75, armor:8, resist:{}, berserk:true, reward:30, color:'#4E342E' },
            { name:'Темный маг', emoji:'🧙‍♂️', hp:120, speed:58, armor:5, resist:{magic:0.3}, healer:true, reward:33, color:'#311B92' },
            { name:'Дрейк', emoji:'🐉', hp:260, speed:55, armor:12, resist:{fire:0.4}, reward:42, color:'#BF360C', flying:true },
            { name:'Рыцарь', emoji:'👑', hp:340, speed:45, armor:20, resist:{physical:0.25}, shield:true, reward:55, color:'#FFD700' },
            { name:'Призрак', emoji:'👻', hp:70, speed:90, armor:0, resist:{}, reward:20, color:'#88ccff', canInvisible:true },
            { name:'Берсерк', emoji:'🪓', hp:200, speed:85, armor:5, resist:{}, reward:28, color:'#cc3333', canInvuln:true, berserk:true },
            { name:'Страж', emoji:'🛡️', hp:250, speed:50, armor:15, resist:{}, reward:30, color:'#4488ff', dmgShield:true },
            { name:'Шаман ветра', emoji:'🌀', hp:120, speed:70, armor:0, resist:{}, reward:25, color:'#66ddaa', auraSpeed:1.3, auraRadius:100 },
            { name:'Горгулья', emoji:'🗿', hp:300, speed:45, armor:25, resist:{physical:0.2}, reward:35, color:'#888888', flying:true },
            { name:'Некромант', emoji:'💀', hp:150, speed:55, armor:5, resist:{magic:0.3}, healer:true, reward:35, color:'#660066' }
        ];
        const bossTypes = [
            { name:'Вождь орков', emoji:'👹', hp:1200, speed:42, armor:15, resist:{}, berserk:true, reward:130, color:'#8B0000', size:1.6 },
            { name:'Королева пауков', emoji:'🕷️', hp:1000, speed:48, armor:10, resist:{poison:0.7}, poison:true, reward:120, color:'#4A148C', size:1.6 },
            { name:'Драконий лорд', emoji:'🐉', hp:1500, speed:38, armor:20, resist:{fire:0.6}, aoeDamage:true, reward:160, color:'#B71C1C', size:1.8, flying:true },
            { name:'Лич-король', emoji:'🧙‍♂️', hp:1400, speed:40, armor:12, resist:{magic:0.5}, healer:true, reward:180, color:'#311B92', size:1.7 },
            { name:'Владыка демонов', emoji:'👑', hp:2200, speed:36, armor:25, resist:{physical:0.3}, shield:true, berserk:true, reward:260, color:'#1a1a1a', size:2.0 },
            { name:'Владыка теней', emoji:'👤', hp:1800, speed:45, armor:10, resist:{magic:0.3}, reward:200, color:'#1a1a3a', size:1.7, canInvisible:true },
            { name:'Железный голем', emoji:'🗿', hp:2500, speed:30, armor:30, resist:{physical:0.3}, reward:220, color:'#555555', size:2.0, dmgShield:true },
            { name:'Ходячий ветер', emoji:'💨', hp:1600, speed:55, armor:8, resist:{}, reward:240, color:'#88ddcc', size:1.6, auraSpeed:1.4, auraRadius:150, canInvuln:true, flying:true }
        ];
        // спрайты существ (нужны enemyBase/bossTypes)
        const enemySprites = enemyBase.map(d => makeSprite(64, (g,s) => paintCreature(g, s, d, creatureKind(d), false)));
        const bossSprites = bossTypes.map(d => makeSprite(80, (g,s) => paintCreature(g, s, d, creatureKind(d), true)));
        // dataURL спрайтов считаем ОДИН раз (иначе 24 toDataURL каждый кадр)
        const killIconUrls = [...enemySprites, ...bossSprites].map(c => c.toDataURL());

        function getDifficultyMultiplier(wave) {
            // плавная экспонента вместо ступеней: волна 10 ≈ ×2.0, 20 ≈ ×4.3, 30 ≈ ×9.3
            return Math.pow(1.08, wave - 1);
        }
        function getArmorMultiplier(wave) {
            // броня растёт втрое медленнее HP, чтобы не упираться в кап 60%
            return 1 + (getDifficultyMultiplier(wave) - 1) * 0.3;
        }

        class Enemy {
            constructor(typeIndex, waveNumber, isBoss=false) {
                const src = isBoss ? bossTypes[typeIndex] : enemyBase[typeIndex];
                if (!src) { this.emoji = '❓'; this.alive = false; return; }
                const mult = getDifficultyMultiplier(waveNumber);
                this.maxHp = Math.floor(src.hp * mult);
                this.hp = this.maxHp;
                this.baseSpeed = src.speed;
                this.armor = Math.floor(src.armor * getArmorMultiplier(waveNumber));
                // модификатор волны (waveNumber 0-based, getWaveMod ждёт номер с 1)
                const mod = getWaveMod(waveNumber + 1);
                if (mod) {
                    if (mod.id === 'speed') this.baseSpeed *= 1.25;
                    if (mod.id === 'armor') this.armor += 10;
                    if (mod.id === 'regen') this.regen = 0.01;
                    if (mod.id === 'shield') this.waveShield = 0.25;
                }
                this.resist = src.resist || {};
                this.reward = Math.max(1, Math.round(src.reward * 0.75)); // экономика строже
                this.color = src.color;
                this.size = src.size || 1.0;
                this.emoji = src.emoji || '❓';
                this.poison = src.poison || false;
                this.berserk = src.berserk || false;
                this.healer = src.healer || false;
                this.aoeDamage = src.aoeDamage || false;
                this.shield = src.shield || false;
                this.shieldActive = this.shield;
                this.canInvisible = src.canInvisible || false;
                this.canInvuln = src.canInvuln || false;
                this.dmgShield = src.dmgShield || false;
                this.auraSpeed = src.auraSpeed || 0;
                this.auraRadius = src.auraRadius || 0;
                this.invisible = false;
                this.invisibleTimer = 0;
                this.invisibleCD = 0;
                this.invuln = false;
                this.invulnTimer = 0;
                this.dmgShieldActive = false;
                this.dmgShieldTimer = 0;
                this.dmgShieldCD = 5;
                this.speedBoost = 1;
                this.isBoss = isBoss;
                this.typeIndex = typeIndex;
                this.pathIdx = 0;
                this.x = pathPoints[0].x;
                this.y = pathPoints[0].y;
                this.flying = src.flying || false;
                this.slowFactor = 1;
                this.slowTimer = 0;
                this.alive = true;
                this.healCD = 0;
                this.frozen = false;
                this.dotDamage = 0;
                this.dotTimer = 0;
                this.dotTickTimer = 0;
                this.frozenTimer = 0;
            }
            update(dt) {
                if (!this.alive) return;
                if (this.regen && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * this.regen * dt);
                if (this.invisible) { this.invisibleTimer -= dt; if (this.invisibleTimer <= 0) this.invisible = false; }
                if (this.invisibleCD > 0) this.invisibleCD -= dt;
                if (this.invuln) { this.invulnTimer -= dt; if (this.invulnTimer <= 0) this.invuln = false; }
                if (this.dmgShield) {
                    if (this.dmgShieldCD > 0) this.dmgShieldCD -= dt;
                    if (this.dmgShieldCD <= 0 && !this.dmgShieldActive) { this.dmgShieldActive = true; this.dmgShieldTimer = 3; this.dmgShieldCD = 8; }
                    if (this.dmgShieldActive) { this.dmgShieldTimer -= dt; if (this.dmgShieldTimer <= 0) this.dmgShieldActive = false; }
                }
                if (this.frozen) { this.frozenTimer -= dt; if (this.frozenTimer <= 0) this.frozen = false; return; }
                if (this.slowTimer > 0) { this.slowTimer -= dt; if (this.slowTimer <= 0) this.slowFactor = 1; }
                if (this.dotTimer > 0) {
                    this.dotTimer -= dt;
                    this.dotTickTimer += dt;
                    if (this.dotTickTimer >= 0.5) {
                        this.dotTickTimer -= 0.5;
                        this.takeDamage(this.dotDamage, 'poison', true, true);
                        if (!this.alive) return;
                    }
                }
                const baseForCalc = (this.berserk && this.hp < this.maxHp*0.5) ? this.baseSpeed*1.6 : this.baseSpeed;
                const effSpeed = baseForCalc * this.slowFactor * (this.speedBoost || 1);
                if (this.pathIdx >= pathPoints.length-1) {
                    this.alive = false;
                    const livesLost = this.isBoss ? 5 : 1;
                    lives -= livesLost;
                    playLeak();
                    if (lives <= 0) gameOver = true;
                    return;
                }
                const target = pathPoints[this.pathIdx+1];
                const dx = target.x - this.x, dy = target.y - this.y;
                const dist = Math.hypot(dx, dy);
                if (dist < 2) { this.pathIdx++; this.x = target.x; this.y = target.y; }
                else {
                    const step = Math.min(effSpeed * dt, dist);
                    this.x += (dx / dist) * step;
                    this.y += (dy / dist) * step;
                    if (step >= dist) this.pathIdx++;
                }
                if (this.healer) {
                    this.healCD -= dt;
                    if (this.healCD <= 0) {
                        this.healCD = 0.6;
                        enemies.forEach(e => { if (e!==this && e.alive && Math.hypot(this.x-e.x, this.y-e.y) < 80) e.hp = Math.min(e.maxHp, e.hp + 8); });
                    }
                }
            }
            takeDamage(amount, damageType='physical', ignoreArmor=false, fromDot=false) {
                if (!this.alive) return;
                if (this.invuln) return;
                if (!fromDot && this.shieldActive && this.shield) { this.shieldActive = false; return; }
                let dmg = amount;
                if (this.dmgShieldActive) dmg *= 0.5;
                if (this.waveShield) dmg *= (1 - this.waveShield);
                if (!ignoreArmor) {
                    const armorReduction = Math.min(0.6, this.armor / (this.armor + 50));
                    dmg *= (1 - armorReduction);
                }
                if (this.resist[damageType]) dmg *= (1 - this.resist[damageType]);
                if (dmg < 1) dmg = 1;
                this.hp -= dmg;
                if (this.hp <= 0) {
                    this.alive = false;
                    gold += this.reward;
                    stats.goldEarned += this.reward;
                    stats.enemiesKilled++;
                    const idx = this.isBoss ? 16 + this.typeIndex : this.typeIndex;
                    if (idx >= 0 && idx < killCount.length) killCount[idx]++;
                    playExplosion();
                    floatingTexts.push({ x: this.x, y: this.y - 10, text: '+' + this.reward, life: 1.0, vy: -40 });
                    for (let i = 0; i < (this.isBoss ? 25 : 12); i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = 30 + Math.random() * 60;
                        particles.push({ x: this.x, y: this.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.6 + Math.random() * 0.4, color: this.color });
                    }
                } else if (!fromDot) {
                    if (this.canInvisible && !this.invisible && this.invisibleCD <= 0) { this.invisible = true; this.invisibleTimer = 2; this.invisibleCD = 6; }
                    if (this.canInvuln && !this.invuln) { this.invuln = true; this.invulnTimer = 1; }
                }
            }
            applySlow(factor, dur) { if (factor < this.slowFactor || this.slowTimer <= 0) { this.slowFactor = factor; this.slowTimer = dur; } }
            applyFreeze(dur) { this.frozen = true; if (dur > this.frozenTimer) this.frozenTimer = dur; }
            applyDot(damagePerTick, totalDuration) { if (damagePerTick >= this.dotDamage || this.dotTimer <= 0) { this.dotDamage = damagePerTick; this.dotTimer = totalDuration; this.dotTickTimer = 0; } }
        }

        // ---------- TOWER CLASS ----------
        class Tower {
            constructor(col, row, type) { this.col=col; this.row=row; this.type=type; this.level=1; this.cdTimer=0; this.target=null; this.buffMult=1; }
            get cfg() {
                const d = towerDefs[this.type]; const l = this.level-1;
                return { damage:d.damage[l], range:d.range[l], cooldown:d.cooldown[l], aoe:d.aoe?d.aoe[l]:0, slow:d.slow?d.slow[l]:0,
                    slowDur:d.slowDur||2.5, ignoreArmor:d.ignoreArmor||false, dotDmg:d.dotDmg?d.dotDmg[l]:0, dotDur:d.dotDur||3,
                    chain:d.chain||0, chainRange:d.chainRange||80, damageType:d.damageType, projColor:d.projColor, projSpeed:d.projSpeed,
                    auraBuff:d.auraBuff?d.auraBuff[l]:0, auraRadius:d.auraRadius?d.auraRadius[l]:0,
                    level:this.level };
            }
            upgradeCost() { return this.level<4 ? 120 + this.level*90 : null; }
            sellValue() { let sum = towerDefs[this.type].cost; for (let i=1; i<this.level; i++) sum += 120 + i*90; return Math.floor(sum*0.4); }
            update(dt, enemiesList) {
                this.cdTimer -= dt; this.target = null;
                if (this.type === 'buffer') return;
                let best = Infinity;
                const cx = (this.col+0.5)*CELL, cy = (this.row+0.5)*CELL;
                const noFly = (this.type === 'cannon' || this.type === 'siege');
                for (let e of enemiesList) { if (!e.alive || e.invisible || (noFly && e.flying)) continue; const d = Math.hypot(cx - e.x, cy - e.y); if (d <= this.cfg.range && d < best) { best=d; this.target=e; } }
                if (this.target && this.cdTimer <= 0) { this.attack(this.target); this.cdTimer = this.cfg.cooldown; }
            }
            attack(primary) {
                const cfg = this.cfg; const sx = (this.col+0.5)*CELL, sy = (this.row+0.5)*CELL;
                const bcfg = Object.assign({}, cfg, { damage: cfg.damage * (this.buffMult || 1) });
                if (this.type === 'lightning') {
                    let targets = [primary]; let last = primary; let remaining = (this.level===4?5:3)-1;
                    let potential = enemies.filter(e => e.alive && e !== primary && !e.invisible);
                    while (remaining>0 && potential.length>0) {
                        potential.sort((a,b)=>Math.hypot(last.x-a.x,last.y-a.y)-Math.hypot(last.x-b.x,last.y-b.y));
                        const next = potential.find(e => Math.hypot(last.x-e.x,last.y-e.y) <= cfg.chainRange);
                        if (!next) break; targets.push(next); potential = potential.filter(e => e!==next); last = next; remaining--;
                    }
                    targets.forEach(t => projectiles.push(new Projectile(sx, sy, t, this.type, bcfg, true)));
                } else if (this.level===4 && this.type==='archer') {
                    // Multishot: always 3 projectiles
                    const inRange = enemies.filter(en => en.alive && en !== primary && !en.invisible && Math.hypot(sx - en.x, sy - en.y) <= cfg.range);
                    const targets = [primary];
                    for (let i=0; i<2; i++) {
                        if (inRange.length > 0) {
                            const idx = Math.floor(Math.random()*inRange.length);
                            targets.push(inRange[idx]);
                            inRange.splice(idx, 1);
                        } else {
                            targets.push(primary); // fallback to primary if no other targets
                        }
                    }
                    targets.forEach((tgt, i) => {
                        const ox = i===0 ? 0 : (i===1 ? -10 : 10);
                        const oy = i===0 ? 0 : -6;
                        projectiles.push(new Projectile(sx+ox, sy+oy, tgt, this.type, bcfg));
                    });
                    effects.push({type:'multishot', x:sx, y:sy, color:cfg.projColor, timer:0.3, maxTimer:0.3});
                } else { projectiles.push(new Projectile(sx, sy, primary, this.type, bcfg)); }
                playShootThrottled(this.type);
                effects.push({type:'muzzle', x:sx, y:sy, color:cfg.projColor, timer:0.15});
            }
        }

        class Projectile {
            constructor(x,y,target,type,cfg,chain=false) { this.x=x; this.y=y; this.target=target; this.type=type; this.speed=cfg.projSpeed; this.damage=cfg.damage; this.aoe=cfg.aoe||0; this.slow=cfg.slow||0; this.slowDur=cfg.slowDur||2.5; this.ignoreArmor=cfg.ignoreArmor||false; this.dotDmg=cfg.dotDmg||0; this.dotDur=cfg.dotDur||0; this.damageType=cfg.damageType; this.color=cfg.projColor; this.alive=true; this.level=cfg.level||1; this.trail=[]; }
            update(dt) {
                if (this.target && this.target.alive && !this.target.invisible) { this.tx = this.target.x; this.ty = this.target.y; }
                if (!this.target || !this.target.alive || this.target.invisible) {
                    // AOE-снаряд взрывается в последней точке цели, обычный исчезает
                    if (this.aoe > 0 && this.tx !== undefined) { this.hit(); return; }
                    this.alive=false; return;
                }
                // шлейф: последние позиции
                this.trail.push({x:this.x, y:this.y});
                if (this.trail.length > 7) this.trail.shift();
                const dx=this.target.x-this.x, dy=this.target.y-this.y, dist=Math.hypot(dx,dy);
                if (dist < 6) { this.hit(); return; }
                const step = Math.min(this.speed * dt, dist);
                this.x += (dx / dist) * step;
                this.y += (dy / dist) * step;
                if (step >= dist) this.hit();
            }
            hit() {
                const hx = this.tx !== undefined ? this.tx : this.target.x;
                const hy = this.ty !== undefined ? this.ty : this.target.y;
                if (this.aoe>0) {
                    effects.push({type:'explosion', x:hx, y:hy, radius:this.aoe, timer:0.5});
                    enemies.forEach(e=>{ if(!e.alive || e.invisible) return; if(Math.hypot(hx-e.x, hy-e.y)<=this.aoe) e.takeDamage(this.damage, this.damageType, this.ignoreArmor); });
                } else {
                    this.target.takeDamage(this.damage, this.damageType, this.ignoreArmor);
                    if (this.slow>0) this.target.applySlow(this.slow, this.slowDur);
                    if (this.dotDmg>0) {
                        if (this.type === 'poison') playPoisonHit();
                        this.target.applyDot(this.dotDmg/ (this.dotDur/0.5), this.dotDur);
                        if (this.type === 'poison' && this.level === 4) {
                            enemies.forEach(e => { if (e.alive && !e.invisible && e !== this.target && Math.hypot(this.target.x - e.x, this.target.y - e.y) <= 70) e.applyDot(this.dotDmg / (this.dotDur/0.5), this.dotDur); });
                        }
                    }
                    effects.push({type:'spark', x:this.target.x, y:this.target.y, color:this.color, timer:0.3});
                }
                if (this.type==='ice' && this.level===4 && Math.random()<0.35) { this.target.applyFreeze(1.5); playFreeze(); effects.push({type:'freeze', x:this.target.x, y:this.target.y, timer:1.0}); }
                this.alive=false;
            }
        }

        // ---------- WAVE MODIFIERS ----------
        const waveMods = [
            { id:'speed', icon:'<span class="ic ic-dim"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 9h11a2.5 2.5 0 10-2.5-2.5M3 13h15a2.5 2.5 0 11-2.5 2.5M3 17h8" fill="none" stroke="#c9c2b4" stroke-width="2" stroke-linecap="round"/></svg></span>', name:'Ураган: +25% скорости врагов' },
            { id:'armor', icon:'<span class="ic ic-blue"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3l7 3v5c0 5-3.2 8.4-7 10-3.8-1.6-7-5-7-10V6z" fill="#4a6a9a" stroke="#8ecbff" stroke-width="1.6"/><path d="M12 3v18" stroke="#8ecbff" stroke-width="1.2"/></svg></span>', name:'Панцирь: +10 брони врагам' },
            { id:'regen', icon:'<span class="ic"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 20C6 15 3.5 11.5 3.5 8.5 3.5 6 5.5 4 8 4c1.7 0 3.2 1 4 2.4C12.8 5 14.3 4 16 4c2.5 0 4.5 2 4.5 4.5 0 3-2.5 6.5-8.5 11.5z" fill="#7dd87a" stroke="#1d4a1d" stroke-width="1.4"/></svg></span>', name:'Регенерация: враги лечатся' },
            { id:'shield', icon:'<span class="ic ic-gold"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" fill="#ffcf7a"/><circle cx="19" cy="18" r="1.6" fill="#ffcf7a"/><circle cx="5" cy="17" r="1.2" fill="#ffcf7a"/></svg></span>', name:'Барьер: враги получают -25% урона' },
            { id:'night', icon:'<span class="ic ic-blue"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 14.5A8.5 8.5 0 019.5 4 8.5 8.5 0 1020 14.5z" fill="#8ecbff" stroke="#2a4a70" stroke-width="1.4"/></svg></span>', name:'Ночь: темно, светят факелы' },
            { id:'fog',   icon:'<span class="ic ic-dim"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 9c3 0 3-2 6-2s3 2 6 2 3-2 6-2M3 14c3 0 3-2 6-2s3 2 6 2 3-2 6-2M3 19c3 0 3-2 6-2s3 2 6 2 3-2 6-2" fill="none" stroke="#c9c2b4" stroke-width="1.8" stroke-linecap="round" opacity="0.85"/></svg></span>', name:'Туман: видимость снижена' },
        ];
        function getWaveMod(n) { return n >= 6 ? waveMods[(n - 6) % waveMods.length] : null; }

        // ---------- WAVES ----------
        const waves = [
            [{type:0,count:20}],
            [{type:1,count:24}],
            [{type:0,count:16},{type:2,count:12}],
            [{type:1,count:20},{type:3,count:16}],
            [{type:2,count:16},{type:4,count:12},{boss:0}],
            [{type:0,count:24},{type:3,count:16},{type:5,count:12},{type:10,count:8}],
            [{type:1,count:28},{type:4,count:16},{type:6,count:10},{type:11,count:6}],
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
        ];

        // ---------- GAME FLOW ----------
        function saveGame() {
            const state = { gold, lives, waveNum, mana, towers: towers.map(t => ({ col: t.col, row: t.row, type: t.type, level: t.level })), stats, autoStart, killCount, soundEnabled, gameSpeed, buildType: selectedBuildType, volume };
            localStorage.setItem('td_save', JSON.stringify(state));
        }

        function loadGame() {
            const saved = localStorage.getItem('td_save');
            if (!saved) return false;
            try {
                const state = JSON.parse(saved);
                gold = state.gold ?? 200;
                lives = state.lives ?? 20;
                waveNum = state.waveNum ?? 0;
                mana = state.mana ?? 0;
                stats = state.stats || { towersBuilt: 0, goldEarned: 0, enemiesKilled: 0, wavesCompleted: 0 };
                autoStart = state.autoStart ?? false;
                if (state.killCount) for (let i=0; i<killCount.length && i<state.killCount.length; i++) killCount[i] = state.killCount[i];
                if (state.soundEnabled !== undefined) {
                    soundEnabled = state.soundEnabled;
                    document.getElementById('sound-btn').innerHTML = soundEnabled ? '<span class="ic ic-gold"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 9v6h4l5 4V5L8 9z" fill="#c9c2b4"/><path d="M16 9a4 4 0 010 6" fill="none" stroke="#ffcf7a" stroke-width="2" stroke-linecap="round"/><path d="M18.5 6.5a8 8 0 010 11" fill="none" stroke="#ffcf7a" stroke-width="2" stroke-linecap="round"/></svg></span> Звук' : '<span class="ic ic-dim"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 9v6h4l5 4V5L8 9z" fill="#c9c2b4"/><path d="M16 9l6 6M22 9l-6 6" stroke="#ff5a4a" stroke-width="2.2" stroke-linecap="round"/></svg></span> Звук';
                }
                if (state.gameSpeed) { gameSpeed = state.gameSpeed; document.getElementById('speed-btn').innerHTML = speedBtnLabel(); }
                if (state.volume !== undefined) setVolume(state.volume);
                towers = (state.towers || []).map(t => { const tw = new Tower(t.col, t.row, t.type); tw.level = t.level; return tw; });
                if (state.buildType && towerDefs[state.buildType]) {
                    selectedBuildType = state.buildType;
                    const btn = document.querySelector('.tower-btn[data-type="' + state.buildType + '"]');
                    if (btn) btn.classList.add('active');
                }
                document.getElementById('auto-btn').innerHTML = autoStart ? '<span class="ic"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6 12a6 6 0 0110.5-4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/><path d="M17 4v4h-4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/><path d="M18 12a6 6 0 01-10.5 4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/><path d="M7 20v-4h4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/></svg></span> Авто: вкл' : '<span class="ic"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6 12a6 6 0 0110.5-4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/><path d="M17 4v4h-4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/><path d="M18 12a6 6 0 01-10.5 4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/><path d="M7 20v-4h4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/></svg></span> Авто: выкл';
                // заставляем updateUI перерисовать значения, иначе дисплей
                // показывает стартовые 200, хотя золото восстановлено
                prevGold = null; prevLives = null;
                return true;
            } catch(e) { return false; }
        }

        function resetGame() {
            clearSpawnQueue();
            autoTimer = -1; waveElapsed = 0;
            gold = 200; lives = 20; waveNum = 0; waveActive = false; waveSpawningComplete = true;
            enemies = []; towers = []; projectiles = []; effects = []; particles = []; floatingTexts = [];
            selectedTower = null; selectedBuildType = null; gameSpeed = 1; paused = false;
            gameOver = false; victory = false; lightningCD = 0; frostCD = 0; fireRainCD = 0;
            hoverCol = -1; hoverRow = -1; screenShake = 0;
            stats = { towersBuilt: 0, goldEarned: 0, enemiesKilled: 0, wavesCompleted: 0 };
            killCount.fill(0);
            mana = 0;
            totalPlayTime = 0;
            prevGold = null; prevLives = null; // updateUI перерисует значения
            localStorage.removeItem('td_save');
            document.getElementById('victory-overlay').style.display = 'none';
            document.getElementById('pause-overlay').style.display = 'none';
            document.getElementById('pause-btn').innerHTML = '<span class="ic"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="5" width="4.5" height="14" rx="1" fill="#c9c2b4"/><rect x="14.5" y="5" width="4.5" height="14" rx="1" fill="#c9c2b4"/></svg></span> Пауза';
            document.getElementById('speed-btn').innerHTML = '<span class="ic"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 4l9 8-9 8z" fill="#c9c2b4"/><path d="M12 4l9 8-9 8z" fill="#c9c2b4"/></svg></span> x1';
            document.getElementById('sound-btn').innerHTML = soundEnabled ? '<span class="ic ic-gold"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 9v6h4l5 4V5L8 9z" fill="#c9c2b4"/><path d="M16 9a4 4 0 010 6" fill="none" stroke="#ffcf7a" stroke-width="2" stroke-linecap="round"/><path d="M18.5 6.5a8 8 0 010 11" fill="none" stroke="#ffcf7a" stroke-width="2" stroke-linecap="round"/></svg></span> Звук' : '<span class="ic ic-dim"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 9v6h4l5 4V5L8 9z" fill="#c9c2b4"/><path d="M16 9l6 6M22 9l-6 6" stroke="#ff5a4a" stroke-width="2.2" stroke-linecap="round"/></svg></span> Звук';
            document.getElementById('start-wave-btn').disabled = false;
            document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
            updateUI(); updateSelectedInfo();
        }

        function startWave() {
            if (waveActive || waveNum >= waves.length || gameOver || victory || paused) return;
            clearSpawnQueue();
            waveActive = true; waveSpawningComplete = false;
            waveElapsed = 0;
            const defs = waves[waveNum]; enemies = []; projectiles = []; effects = [];
            let delay = 0; // секунды игрового времени
            defs.forEach(group => {
                if (group.boss !== undefined) {
                    spawnQueue.push({ t: delay, boss: group.boss });
                    delay += 2;
                } else {
                    for (let i=0; i<group.count; i++) spawnQueue.push({ t: delay + i*0.3, type: group.type });
                    delay += group.count * 0.3;
                }
            });
            spawnQueue.sort((a,b) => a.t - b.t);
            spawnClock = 0;
            const mod = getWaveMod(waveNum + 1);
            if (mod) {
                showToast(`${mod.icon} Волна ${waveNum + 1}: ${mod.name}`);
                effects.push({type:'modBanner', text: mod.name.split(':')[0].toUpperCase(), sub: mod.name.split(':')[1] || '', timer:2.6, maxTimer:2.6});
            }
            document.getElementById('start-wave-btn').disabled = true;
            playWaveStart();
        }

        function checkWaveEnd() {
            if (!waveActive || !waveSpawningComplete) return;
            if (enemies.every(e => !e.alive)) {
                waveActive = false;
                const bonusGold = Math.max(0, Math.floor(20 - waveElapsed));
                if (bonusGold > 0) {
                    gold += bonusGold;
                    floatingTexts.push({ x: VW/2, y: 100, text: `+${bonusGold} бонус!`, life: 1.5, vy: -30 });
                }
                stats.wavesCompleted++;
                waveNum++;
                saveGame();
                if (waveNum >= waves.length) {
                    victory = true;
                    document.getElementById('victory-overlay').style.display = 'flex';
                    document.getElementById('overlay-title').textContent = 'ПОБЕДА ОРДЫ!';
                    showEndStats();
                    document.getElementById('start-wave-btn').disabled = true;
                    playVictory();
                    localStorage.removeItem('td_save');
                } else {
                    document.getElementById('start-wave-btn').disabled = false;
                    if (autoStart && !paused && !gameOver) {
                        autoTimer = 0.5; // сек игрового времени до авто-старта
                    }
                }
            }
        }

        function castLightning() {
            if (paused || gameOver || victory) return;
            if (lightningCD>0) return;
            if (mana<300) { playError(); showToast('Нужно 300 маны'); return; }
            mana-=300; lightningCD=15; playLightning();
            const dmg = Math.floor(200 * (1 + waveNum * 0.08));
            // Гнев небес: залп ветвящихся молний + вспышка
            for (let i=0; i<16; i++) { const sx=Math.random()*VW, sy=100+Math.random()*(VH-200);
                effects.push({type:'lightningStrike', x:sx, y:sy, timer:0.45, maxTimer:0.45, seed:Math.random()*7});
                effects.push({type:'strikeGlow', x:sx, y:sy, timer:0.55, maxTimer:0.55});
            }
            effects.push({type:'spellTint', color:'255,255,180', timer:0.14, maxTimer:0.14});
            effects.push({type:'spellTint', color:'255,255,100', timer:0.55, maxTimer:0.55});
            enemies.forEach(e=>{
                if(e.alive && !e.invisible) {
                    e.takeDamage(dmg, 'lightning');
                    effects.push({type:'lightningBolt', x:e.x, y:e.y, timer:0.35, maxTimer:0.35, seed:Math.random()*7});
                    for (let i=0;i<10;i++) { const a=Math.random()*Math.PI*2, s=60+Math.random()*90; particles.push({x:e.x, y:e.y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:0.5+Math.random()*0.4, color:'#ffdd00'}); }
                }
            });
            for (let i=0; i<35; i++) particles.push({x:Math.random()*VW, y:0, vx:0, vy:100+Math.random()*140, life:1.0+Math.random()*0.5, color:'#ffcc44'});
        }
        function castFrost() {
            if (paused || gameOver || victory) return;
            if (frostCD>0) return;
            if (mana<400) { playError(); showToast('Нужно 400 маны'); return; }
            mana-=400; frostCD=18; playFrost();
            const dmg = Math.floor(60 * (1 + waveNum * 0.08));
            effects.push({type:'frostSpread', x:VW/2, y:VH/2, maxRadius:1150, timer:1.1, maxTimer:1.1});
            effects.push({type:'spellTint', color:'150,210,255', timer:0.7, maxTimer:0.7});
            // осколки льда с неба + морозные пятна
            for (let i=0; i<14; i++) effects.push({type:'iceShard', x:Math.random()*VW, y:-40-Math.random()*200, vx:60+Math.random()*80, vy:520+Math.random()*160, rot:Math.random()*2-1, timer:1.4, maxTimer:1.4});
            effects.push({type:'frostEdge', timer:2.2, maxTimer:2.2});
            for (let i=0; i<10; i++) effects.push({type:'frostPatch', x:Math.random()*VW, y:Math.random()*VH, r:50+Math.random()*70, timer:4, maxTimer:4});
            enemies.forEach(e=>{ if(e.alive && !e.invisible) { e.applySlow(0.05, 6); e.applyFreeze(2); e.takeDamage(dmg, 'ice');
                effects.push({type:'frostRing', x:e.x, y:e.y, maxRadius:60, timer:0.6, maxTimer:0.6});
                for (let i=0;i<8;i++) { const a=Math.random()*Math.PI*2, s=40+Math.random()*60; particles.push({x:e.x, y:e.y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:0.9, color:'#aaddff'}); }
            } });
            for (let i=0; i<45; i++) particles.push({x:Math.random()*VW, y:Math.random()*VH, vx:(Math.random()-0.5)*30, vy:20+Math.random()*40, life:1.5+Math.random()*1.2, color:'rgba(190,225,255,0.85)'});
        }
        function castFireRain() {
            if (paused || gameOver || victory) return;
            if (fireRainCD>0) return;
            if (mana<500) { playError(); showToast('Нужно 500 маны'); return; }
            mana-=500; fireRainCD=22; playFire();
            const dmg = Math.floor(150 * (1 + waveNum * 0.08));
            // Метеоритный дождь: больше снарядов + выжженная земля
            for (let i=0; i<30; i++) effects.push({type:'fireballFall', x:Math.random()*VW, y:0, targetY:100+Math.random()*(VH-200), timer:0.8+i*0.02, maxTimer:0.8+i*0.02, w:i});
            effects.push({type:'spellTint', color:'255,100,50', timer:0.8, maxTimer:0.8});
            for (let i=0; i<12; i++) effects.push({type:'scorch', x:Math.random()*VW, y:Math.random()*VH, r:34+Math.random()*46, timer:5, maxTimer:5});
            effects.push({type:'spellTint', color:'255,100,50', timer:0.7, maxTimer:0.7});
            enemies.forEach(e=>{ if(e.alive && !e.invisible) { e.takeDamage(dmg, 'fire'); e.applyDot(Math.round(20 * (1 + waveNum * 0.06)), 3);
                effects.push({type:'fireExplosion', x:e.x, y:e.y, timer:0.5, maxTimer:0.5});
                for (let i=0;i<10;i++) { const a=Math.random()*Math.PI*2, s=50+Math.random()*80; particles.push({x:e.x, y:e.y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:0.6+Math.random()*0.4, color:'#ff4400'}); }
            } });
            for (let i=0; i<25; i++) particles.push({x:Math.random()*VW, y:0, vx:(Math.random()-0.5)*40, vy:100+Math.random()*150, life:0.8+Math.random()*0.4, color:'#ff6600'});
        }

        // UI
        // Кнопки спеллов: контент меняется только при смене состояния (готов/КД),
        // цифра КД фиксированной ширины — иначе панель дёргается каждый кадр
        function initSpellBtn(id, tip) {
            const el = document.getElementById(id);
            el.dataset.ready = el.innerHTML;
            el.dataset.icon = el.querySelector('.ic') ? el.querySelector('.ic').outerHTML : '';
            el.dataset.tip = tip;
            el._last = null;
            return el;
        }
        function spellBtnUI(id, cd, cost) {
            const el = document.getElementById(id);
            if (!el.dataset.ready) initSpellBtn(id, '');
            const html = cd > 0
                ? el.dataset.icon + ' <span class="cd">' + String(Math.ceil(cd)).padStart(2,'0') + 'с</span>'
                : el.dataset.ready;
            el.disabled = cd > 0 || mana < cost;
            if (el._last !== html) { el.innerHTML = html; el._last = html; }
        }
        initSpellBtn('lightning-btn', 'Гнев небес — 200 урона всем врагам (+8% за волну). 300 маны, КД 15с');
        initSpellBtn('frost-btn', 'Ледяной шторм — 60 урона, заморозка 2с, замедление 95% на 6с. 400 маны, КД 18с');
        initSpellBtn('fire-rain-btn', 'Огненный дождь — 150 урона и горение, усиливается с волной. 500 маны, КД 22с');

        // Всплывающий тултип способностей
        const spellTip = document.getElementById('spell-tip');
        function showSpellTip(el) {
            const names = { 'lightning-btn': 'Молния', 'frost-btn': 'Ледяной шторм', 'fire-rain-btn': 'Огненный дождь' };
            spellTip.innerHTML = '<span class="tip-title">' + (names[el.id] || '') + '</span>' + el.dataset.tip;
            spellTip.style.display = 'block';
            const r = el.getBoundingClientRect();
            let x = r.left + r.width/2, y = r.bottom + 10;
            spellTip.style.left = '0px'; spellTip.style.top = '0px';
            const tr = spellTip.getBoundingClientRect();
            x = Math.max(10, Math.min(window.innerWidth - tr.width - 10, x));
            if (y + tr.height > window.innerHeight - 10) y = r.top - tr.height - 10;
            spellTip.style.left = x + 'px';
            spellTip.style.top = y + 'px';
        }
        function hideSpellTip() { spellTip.style.display = 'none'; }
        ['lightning-btn','frost-btn','fire-rain-btn'].forEach(id => {
            const el = document.getElementById(id);
            el.addEventListener('mouseenter', () => showSpellTip(el));
            el.addEventListener('mouseleave', hideSpellTip);
            el.addEventListener('click', hideSpellTip);
        });
        let prevGold = gold, prevLives = lives;
        function updateUI() {
            const goldEl = document.getElementById('gold-display');
            const livesEl = document.getElementById('lives-display');
            if (gold !== prevGold) {
                goldEl.textContent = gold;
                goldEl.parentElement.classList.remove('pulse');
                void goldEl.parentElement.offsetWidth;
                goldEl.parentElement.classList.add('pulse');
                prevGold = gold;
            }
            if (lives !== prevLives) {
                livesEl.textContent = lives;
                livesEl.parentElement.classList.remove('danger');
                void livesEl.parentElement.offsetWidth;
                livesEl.parentElement.classList.add(lives <= 5 ? 'danger' : 'pulse');
                prevLives = lives;
            }
            const curMod = getWaveMod(waveNum + (waveActive ? 1 : 0));
            document.getElementById('wave-display').innerHTML = `${waveNum}/${waves.length}${waveActive && curMod ? ' ' + curMod.icon : ''}`;
            // Mana bar (+ классы регена/полноты, недоделанные ранее)
            const manaPct = (mana / maxMana) * 100;
            const manaFill = document.getElementById('mana-bar-fill');
            manaFill.style.width = `${manaPct}%`;
            manaFill.classList.toggle('regen', waveActive && mana < maxMana);
            manaFill.classList.toggle('full', mana >= maxMana);
            document.getElementById('mana-text').textContent = `${Math.floor(mana)} / ${maxMana}`;
            // Spell buttons: перерисовка только при изменении, КД фиксированной ширины
            spellBtnUI('lightning-btn', lightningCD, 300);
            spellBtnUI('frost-btn', frostCD, 400);
            spellBtnUI('fire-rain-btn', fireRainCD, 500);
            const kl = document.getElementById('kill-list');
            let html = '';
            enemyBase.forEach((t,i)=> html += `<div class="kill-row"><span><img class="kill-icon" src="${killIconUrls[i]}">${t.name}</span><span>${killCount[i]}</span></div>`);
            bossTypes.forEach((t,i)=> html += `<div class="kill-row"><span><img class="kill-icon" src="${killIconUrls[16+i]}">${t.name}</span><span>${killCount[16+i]}</span></div>`);
            // Перерисовываем только при изменении, а не каждый кадр
            if (html !== updateUI.lastKillHtml) {
                updateUI.lastKillHtml = html;
                kl.innerHTML = html;
            }
            const sp = document.getElementById('stats-panel');
            if (sp) sp.innerHTML = `Башен: ${stats.towersBuilt}<br>Золота: ${stats.goldEarned}<br>Убито: ${stats.enemiesKilled}<br>Волн: ${stats.wavesCompleted}`;
        }

        function updateSelectedInfo() {
            const info = document.getElementById('selected-info');
            const goldIco = (n) => n + '<span class="ic ic-gold"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" fill="#ffcf7a" stroke="#9a6a10" stroke-width="2"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="#9a6a10" stroke-width="1.5"/><path d="M12 9v6" stroke="#9a6a10" stroke-width="1.5"/></svg></span>';
            // Массовый режим: все башни одного типа
            if (massSelType && !selectedTower) {
                const d = towerDefs[massSelType];
                const list = towers.filter(t => t.type === massSelType);
                const upg = list.filter(t => t.level < 4);
                const upgCost = upg.reduce((s,t) => s + t.upgradeCost(), 0);
                const sellSum = list.reduce((s,t) => s + t.sellValue(), 0);
                let html = `<b>${d.icon} ${d.name}</b> — выбрано ${list.length}, на максимуме ${list.length - upg.length} `;
                html += `<button class="btn" id="upg-all-btn" ${upg.length ? '' : 'disabled title="Все на максимуме"'}>Улучшить все (${goldIco(upgCost)})</button>`;
                html += `<button class="btn" id="sell-all-btn" ${list.length ? '' : 'disabled'}>Продать все (+${goldIco(sellSum)})</button>`;
                html += `<button class="btn" id="mass-done-btn">Готово</button>`;
                info.innerHTML = html;
                document.getElementById('upg-all-btn')?.addEventListener('click', (e)=>{ e.stopPropagation();
                    if (!upg.length) return;
                    if (gold < upgCost) { playError(); showToast('Нужно ' + upgCost + ' золота'); return; }
                    gold -= upgCost; upg.forEach(t => t.level++); playUpgrade(); updateSelectedInfo(); saveGame(); });
                document.getElementById('sell-all-btn')?.addEventListener('click', (e)=>{ e.stopPropagation();
                    if (!list.length) return;
                    gold += sellSum; towers = towers.filter(t => t.type !== massSelType); playSell(); updateSelectedInfo(); saveGame(); });
                document.getElementById('mass-done-btn')?.addEventListener('click', (e)=>{ e.stopPropagation(); massSelType = null; updateSelectedInfo(); });
                return;
            }
            if (selectedTower) {
                const t = selectedTower; const d = towerDefs[t.type]; const cfg = t.cfg;
                let html;
                if (t.type === 'buffer') {
                    html = `${d.icon} ${d.name} ур.${t.level} | Бафф: +${Math.round(cfg.auraBuff*100)}% | Радиус: ${cfg.auraRadius} `;
                } else {
                    const dps = (cfg.damage / cfg.cooldown).toFixed(0);
                    html = `${d.icon} ${d.name} ур.${t.level} | Урон:${cfg.damage} | CD:${cfg.cooldown}с | DPS:${dps} `;
                }
                if (t.level < 4) html += `<button class="btn" id="upg-btn">Улучшить (${goldIco(t.upgradeCost())})</button>`;
                else html += `<button class="btn" id="upg-btn" disabled title="Максимальный уровень">Макс. уровень</button>`;
                html += `<button class="btn" id="sell-btn">Продать (${goldIco(t.sellValue())})</button>`;
                html += `<button class="btn" id="mass-btn" title="Выбрать все башни этого типа">Все такие (${towers.filter(x => x.type === t.type).length})</button>`;
                info.innerHTML = html;
                document.getElementById('upg-btn')?.addEventListener('click', (e)=>{ e.stopPropagation(); if (gold >= t.upgradeCost()) { gold -= t.upgradeCost(); t.level++; playUpgrade(); updateSelectedInfo(); saveGame(); } else { playError(); showToast('Недостаточно золота'); } });
                document.getElementById('sell-btn')?.addEventListener('click', (e)=>{ e.stopPropagation(); gold += t.sellValue(); towers = towers.filter(tw => tw !== t); selectedTower = null; info.innerHTML = ''; playSell(); saveGame(); });
                document.getElementById('mass-btn')?.addEventListener('click', (e)=>{ e.stopPropagation(); selectedTower = null; massSelType = t.type; updateSelectedInfo(); });
            } else info.innerHTML = selectedBuildType ? `Строим: ${towerDefs[selectedBuildType].name}` : '';
        }

        // ---------- PAUSE MENU ----------
        function syncPauseMenu() {
            document.getElementById('pm-speed').innerHTML = `<span class="ic"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 4l9 8-9 8z" fill="#c9c2b4"/><path d="M12 4l9 8-9 8z" fill="#c9c2b4"/></svg></span> Скорость: x${gameSpeed}`;
            document.getElementById('pm-sound').innerHTML = soundEnabled ? '<span class="ic ic-gold"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 9v6h4l5 4V5L8 9z" fill="#c9c2b4"/><path d="M16 9a4 4 0 010 6" fill="none" stroke="#ffcf7a" stroke-width="2" stroke-linecap="round"/><path d="M18.5 6.5a8 8 0 010 11" fill="none" stroke="#ffcf7a" stroke-width="2" stroke-linecap="round"/></svg></span> Звук: вкл' : '<span class="ic ic-dim"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 9v6h4l5 4V5L8 9z" fill="#c9c2b4"/><path d="M16 9l6 6M22 9l-6 6" stroke="#ff5a4a" stroke-width="2.2" stroke-linecap="round"/></svg></span> Звук: выкл';
            document.getElementById('pm-auto').innerHTML = autoStart ? '<span class="ic"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6 12a6 6 0 0110.5-4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/><path d="M17 4v4h-4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/><path d="M18 12a6 6 0 01-10.5 4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/><path d="M7 20v-4h4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/></svg></span> Авто-волна: вкл' : '<span class="ic"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6 12a6 6 0 0110.5-4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/><path d="M17 4v4h-4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/><path d="M18 12a6 6 0 01-10.5 4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/><path d="M7 20v-4h4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/></svg></span> Авто-волна: выкл';
        }
        function setPaused(v) {
            if (gameOver || victory) return;
            paused = v;
            document.getElementById('pause-btn').innerHTML = paused ? '<span class="ic"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M7 4l13 8-13 8z" fill="#c9c2b4"/></svg></span> Играть' : '<span class="ic"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="5" width="4.5" height="14" rx="1" fill="#c9c2b4"/><rect x="14.5" y="5" width="4.5" height="14" rx="1" fill="#c9c2b4"/></svg></span> Пауза';
            document.getElementById('pause-overlay').style.display = paused ? 'flex' : 'none';
            if (paused) syncPauseMenu();
        }
        document.getElementById('pm-resume').onclick = () => setPaused(false);
        document.getElementById('pm-speed').onclick = () => {
            gameSpeed = gameSpeed === 1 ? 2 : gameSpeed === 2 ? 3 : 1;
            document.getElementById('speed-btn').innerHTML = `<span class="ic"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 4l9 8-9 8z" fill="#c9c2b4"/><path d="M12 4l9 8-9 8z" fill="#c9c2b4"/></svg></span> x${gameSpeed}`;
            syncPauseMenu();
            saveGame();
        };
        document.getElementById('pm-sound').onclick = () => {
            soundEnabled = !soundEnabled;
            document.getElementById('sound-btn').innerHTML = soundEnabled ? '<span class="ic ic-gold"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 9v6h4l5 4V5L8 9z" fill="#c9c2b4"/><path d="M16 9a4 4 0 010 6" fill="none" stroke="#ffcf7a" stroke-width="2" stroke-linecap="round"/><path d="M18.5 6.5a8 8 0 010 11" fill="none" stroke="#ffcf7a" stroke-width="2" stroke-linecap="round"/></svg></span> Звук' : '<span class="ic ic-dim"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 9v6h4l5 4V5L8 9z" fill="#c9c2b4"/><path d="M16 9l6 6M22 9l-6 6" stroke="#ff5a4a" stroke-width="2.2" stroke-linecap="round"/></svg></span> Звук';
            saveGame(); syncPauseMenu();
        };
        document.getElementById('pm-auto').onclick = () => {
            autoStart = !autoStart;
            document.getElementById('auto-btn').innerHTML = autoStart ? '<span class="ic"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6 12a6 6 0 0110.5-4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/><path d="M17 4v4h-4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/><path d="M18 12a6 6 0 01-10.5 4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/><path d="M7 20v-4h4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/></svg></span> Авто: вкл' : '<span class="ic"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6 12a6 6 0 0110.5-4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/><path d="M17 4v4h-4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/><path d="M18 12a6 6 0 01-10.5 4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/><path d="M7 20v-4h4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/></svg></span> Авто: выкл';
            saveGame(); syncPauseMenu();
        };
        document.getElementById('pm-restart').onclick = () => resetGame();

        document.getElementById('pause-btn').onclick = ()=>{ setPaused(!paused); };
        document.getElementById('speed-btn').onclick = ()=>{ gameSpeed = gameSpeed===1 ? 2 : gameSpeed===2 ? 3 : 1; document.getElementById('speed-btn').innerHTML = speedBtnLabel(); saveGame(); };
        document.getElementById('auto-btn').onclick = ()=>{ autoStart = !autoStart; document.getElementById('auto-btn').innerHTML = autoStart ? '<span class="ic"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6 12a6 6 0 0110.5-4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/><path d="M17 4v4h-4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/><path d="M18 12a6 6 0 01-10.5 4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/><path d="M7 20v-4h4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/></svg></span> Авто: вкл' : '<span class="ic"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6 12a6 6 0 0110.5-4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/><path d="M17 4v4h-4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/><path d="M18 12a6 6 0 01-10.5 4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/><path d="M7 20v-4h4" fill="none" stroke="#c9c2b4" stroke-width="2.4" stroke-linecap="round"/></svg></span> Авто: выкл'; saveGame(); };
        document.getElementById('lightning-btn').onclick = castLightning;
        document.getElementById('frost-btn').onclick = castFrost;
        document.getElementById('fire-rain-btn').onclick = castFireRain;
        document.getElementById('start-wave-btn').onclick = startWave;
        document.getElementById('restart-btn').onclick = resetGame;
        document.getElementById('restart-overlay-btn').onclick = resetGame;

        function showEndStats() {
            const mm = String(Math.floor(totalPlayTime/60)).padStart(2,'0');
            const ss = String(Math.floor(totalPlayTime%60)).padStart(2,'0');
            const score = stats.enemiesKilled*10 + stats.wavesCompleted*500 + Math.max(0,lives)*100;
            document.getElementById('overlay-stats').innerHTML =
                `<div class="stat-line"><span>Время игры</span><b>${mm}:${ss}</b></div>` +
                `<div class="stat-line"><span>Счёт</span><b>${score.toLocaleString('ru-RU')}</b></div>` +
                `<div class="stat-line"><span>Волн пройдено</span><b>${stats.wavesCompleted} / ${waves.length}</b></div>` +
                `<div class="stat-line"><span>Врагов убито</span><b>${stats.enemiesKilled.toLocaleString('ru-RU')}</b></div>` +
                `<div class="stat-line"><span>Жизней сохранено</span><b>${Math.max(0,lives)} / 20</b></div>`;
        }
        function speedBtnLabel() {
            return `<span class="ic"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 4l9 8-9 8z" fill="#c9c2b4"/><path d="M12 4l9 8-9 8z" fill="#c9c2b4"/></svg></span> x${gameSpeed}`;
        }
        function soundBtnLabel() {
            return soundEnabled
                ? '<span class="ic ic-gold"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 9v6h4l5 4V5L8 9z" fill="#c9c2b4"/><path d="M16 9a4 4 0 010 6" fill="none" stroke="#ffcf7a" stroke-width="2" stroke-linecap="round"/><path d="M18.5 6.5a8 8 0 010 11" fill="none" stroke="#ffcf7a" stroke-width="2" stroke-linecap="round"/></svg></span> Звук'
                : '<span class="ic ic-dim"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 9v6h4l5 4V5L8 9z" fill="#c9c2b4"/><path d="M16 9l6 6M22 9l-6 6" stroke="#ff5a4a" stroke-width="2.2" stroke-linecap="round"/></svg></span> Звук';
        }
        function setVolume(v) {
            volume = Math.max(0, Math.min(1, v));
            const sl = document.getElementById('volume-slider');
            if (+sl.value !== Math.round(volume*100)) sl.value = Math.round(volume*100);
            if (masterGain) masterGain.gain.value = volume * volume;
            if ((volume <= 0.001) === soundEnabled) {
                soundEnabled = !(volume <= 0.001);
                document.getElementById('sound-btn').innerHTML = soundBtnLabel();
            }
        }
        document.getElementById('volume-slider').addEventListener('input', (e) => { setVolume(e.target.value/100); saveGame(); });
        document.getElementById('sound-btn').onclick = ()=>{ soundEnabled = !soundEnabled; document.getElementById('sound-btn').innerHTML = soundEnabled ? '<span class="ic ic-gold"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 9v6h4l5 4V5L8 9z" fill="#c9c2b4"/><path d="M16 9a4 4 0 010 6" fill="none" stroke="#ffcf7a" stroke-width="2" stroke-linecap="round"/><path d="M18.5 6.5a8 8 0 010 11" fill="none" stroke="#ffcf7a" stroke-width="2" stroke-linecap="round"/></svg></span> Звук' : '<span class="ic ic-dim"><svg class="sicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 9v6h4l5 4V5L8 9z" fill="#c9c2b4"/><path d="M16 9l6 6M22 9l-6 6" stroke="#ff5a4a" stroke-width="2.2" stroke-linecap="round"/></svg></span> Звук'; saveGame(); };

        // Звук клика для всех кнопок интерфейса
        document.querySelectorAll('.btn, .tower-btn').forEach(b => b.addEventListener('click', () => playClick()));

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (selectedBuildType) {
                    selectedBuildType = null;
                    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
                    updateSelectedInfo();
                } else if (!gameOver && !victory) {
                    setPaused(!paused);
                }
            }
            if ((e.key === 'u' || e.key === 'U') && !paused && selectedTower && selectedTower.level < 4) {
                if (gold >= selectedTower.upgradeCost()) {
                    gold -= selectedTower.upgradeCost();
                    selectedTower.level++;
                    playUpgrade();
                    updateSelectedInfo();
                    saveGame();
                } else {
                    playError();
                    showToast('Недостаточно золота');
                }
            }
            if (e.key === ' ' && !waveActive && !gameOver && !victory) {
                e.preventDefault();
                startWave();
            }
            // R — быстрый рестарт после поражения/победы
            if ((e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') && (gameOver || victory)) {
                resetGame();
            }
        });

        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (selectedBuildType) {
                selectedBuildType = null;
                document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
                updateSelectedInfo();
            }
        });

        canvas.addEventListener('click', function audioInit() {
            initAudio();
            canvas.removeEventListener('click', audioInit);
        });

        canvas.addEventListener('click', (e) => {
            if (paused || gameOver || victory) return;
            const rect = canvas.getBoundingClientRect();
            const scaleX = VW / rect.width, scaleY = VH / rect.height;
            const mx = (e.clientX - rect.left) * scaleX, my = (e.clientY - rect.top) * scaleY;
            const col = Math.floor(mx / CELL), row = Math.floor(my / CELL);
            if (col<0||col>=COLS||row<0||row>=ROWS) return;
            const clicked = towers.find(t=>t.col===col && t.row===row);
            if (clicked) { selectedTower = clicked; selectedBuildType = null; document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active')); updateSelectedInfo(); return; }
            if (selectedBuildType) {
                if (pathSet.has(`${col},${row}`)) { playError(); showToast('Нельзя строить на дороге'); return; }
                if (towers.some(t=>t.col===col && t.row===row)) { playError(); showToast('Клетка занята'); return; }
                const cost = towerDefs[selectedBuildType].cost;
                if (gold < cost) { playError(); showToast('Мало золота'); return; }
                gold -= cost; towers.push(new Tower(col, row, selectedBuildType)); playBuild(); stats.towersBuilt++; saveGame();
                selectedBuildType = null; document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active')); selectedTower = null; updateSelectedInfo();
                return;
            }
            selectedTower = null; updateSelectedInfo();
        });

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = VW / rect.width, scaleY = VH / rect.height;
            const mx = (e.clientX - rect.left) * scaleX, my = (e.clientY - rect.top) * scaleY;
            hoverCol = Math.floor(mx / CELL);
            hoverRow = Math.floor(my / CELL);
        });
        canvas.addEventListener('mouseleave', () => { hoverCol = -1; hoverRow = -1; });

        // Отрисовка
        function drawScene(now) {
            ctx.setTransform(DPR,0,0,DPR,0,0); // логические координаты при HiDPI-буфере
            ctx.clearRect(0,0,VW,VH);
            ctx.save();
            if (screenShake > 0) {
                const shakeX = (Math.random() - 0.5) * screenShake * 20;
                const shakeY = (Math.random() - 0.5) * screenShake * 20;
                ctx.translate(shakeX, shakeY);
            }
            for (let row=0; row<ROWS; row++) for (let col=0; col<COLS; col++) {
                ctx.fillStyle = ((col+row)%2===0) ? '#2d1f1a' : '#251812';
                ctx.fillRect(col*CELL, row*CELL, CELL, CELL);
            }
            decorations.forEach(d => {
                const x = d.col*CELL+CELL/2 + d.ox, y = d.row*CELL+CELL/2 + d.oy;
                const s = d.s;
                ctx.save(); ctx.shadowColor='black'; ctx.shadowBlur=6;
                if (d.type==='tree') {
                    const trunkH = 13*s;
                    ctx.fillStyle='#4a2e1a'; ctx.fillRect(x-2*s, y-2, 4*s, trunkH);
                    ctx.fillStyle = d.hue < 0.5 ? '#2d4a1e' : '#243d18';
                    ctx.beginPath(); ctx.arc(x, y-6*s, 11*s, 0, 2*Math.PI); ctx.fill();
                    ctx.fillStyle = 'rgba(90,140,60,0.35)';
                    ctx.beginPath(); ctx.arc(x-3*s, y-9*s, 5*s, 0, 2*Math.PI); ctx.fill();
                } else if (d.type==='bush') {
                    ctx.fillStyle='#2c451c';
                    ctx.beginPath(); ctx.arc(x-4*s, y, 6*s, 0, 2*Math.PI); ctx.arc(x+4*s, y, 6*s, 0, 2*Math.PI); ctx.arc(x, y-4*s, 6*s, 0, 2*Math.PI); ctx.fill();
                } else if (d.type==='rock') {
                    ctx.fillStyle='#3a3030';
                    ctx.beginPath(); ctx.ellipse(x, y+2, 8*s, 6*s, d.hue, 0, 2*Math.PI); ctx.fill();
                    ctx.fillStyle='rgba(255,255,255,0.08)';
                    ctx.beginPath(); ctx.ellipse(x-2*s, y, 3*s, 2*s, d.hue, 0, 2*Math.PI); ctx.fill();
                } else if (d.type==='flowers') {
                    ctx.strokeStyle='#2c451c'; ctx.lineWidth=1.5;
                    for (let f=0; f<3; f++) {
                        const fx = x + (f-1)*6*s, fy = y + (f%2)*3;
                        ctx.beginPath(); ctx.moveTo(fx, y+5); ctx.lineTo(fx, fy); ctx.stroke();
                        ctx.fillStyle = ['#ff6688','#ffcc44','#cc88ff'][f];
                        ctx.beginPath(); ctx.arc(fx, fy, 2.4*s, 0, 2*Math.PI); ctx.fill();
                    }
                } else { // skull
                    ctx.fillStyle='#c8c2b0';
                    ctx.beginPath(); ctx.arc(x, y-1, 4.5*s, 0, 2*Math.PI); ctx.fill();
                    ctx.fillRect(x-3*s, y+1, 6*s, 3*s);
                    ctx.fillStyle='#333';
                    ctx.fillRect(x-2.4*s, y-2.5, 1.6*s, 1.8*s); ctx.fillRect(x+0.8*s, y-2.5, 1.6*s, 1.8*s);
                }
                ctx.restore();
            });
            // Факелы-декорации: столб, чаша, живое пламя
            torches.forEach(t => {
                const flicker = 0.75 + 0.25 * Math.sin(now * 0.006 + t.offset);
                const sway = Math.sin(now * 0.004 + t.offset) * 1.5;
                const fy = t.y - t.h; // верх столба
                // тень столба
                ctx.fillStyle = 'rgba(0,0,0,0.35)';
                ctx.beginPath(); ctx.ellipse(t.x + 3, t.y + 2, 7, 3, 0, 0, 2*Math.PI); ctx.fill();
                // деревянный столб
                ctx.fillStyle = '#4a3018'; ctx.fillRect(t.x - 2.5, fy, 5, t.h);
                ctx.fillStyle = '#2e1c0c'; ctx.fillRect(t.x + 0.5, fy, 2, t.h);
                // металлическая чаша
                ctx.fillStyle = '#5a4a3a';
                ctx.beginPath(); ctx.ellipse(t.x, fy, 9, 4.5, 0, 0, 2*Math.PI); ctx.fill();
                ctx.fillStyle = '#6a5a4a';
                ctx.beginPath(); ctx.ellipse(t.x, fy - 2, 8, 3.5, 0, 0, 2*Math.PI); ctx.fill();
                // пламя (день — скромное, ночью разгорается в блоке света ниже)
                const fr = 6 * flicker;
                const fg = ctx.createRadialGradient(t.x + sway, fy - 8, 1, t.x + sway, fy - 8, fr*2.4);
                fg.addColorStop(0, 'rgba(255,240,180,0.95)');
                fg.addColorStop(0.45, 'rgba(255,150,40,0.85)');
                fg.addColorStop(1, 'rgba(255,80,0,0)');
                ctx.fillStyle = fg;
                ctx.beginPath(); ctx.arc(t.x + sway, fy - 8, fr*2.4, 0, 2*Math.PI); ctx.fill();
                ctx.fillStyle = `rgba(255,220,120,${0.85*flicker})`;
                ctx.beginPath(); ctx.arc(t.x + sway*0.6, fy - 7, fr*0.55, 0, 2*Math.PI); ctx.fill();
                // искры
                if (Math.random() < 0.06) particles.push({x: t.x + sway, y: fy - 10, vx: (Math.random()-0.5)*14, vy: -26 - Math.random()*20, life: 0.7 + Math.random()*0.5, color: 'rgba(255,180,80,0.9)'});
            });
            pathSet.forEach(c => { const [col,row] = c.split(',').map(Number); ctx.fillStyle='#5a3a2a'; ctx.fillRect(col*CELL+2, row*CELL+2, CELL-4, CELL-4); ctx.fillStyle='#3a2218'; ctx.fillRect(col*CELL+4, row*CELL+4, CELL-8, CELL-8); });
            ctx.strokeStyle='#ff9966'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(pathPoints[0].x, pathPoints[0].y); for (let i=1;i<pathPoints.length;i++) ctx.lineTo(pathPoints[i].x, pathPoints[i].y); ctx.stroke();
            const end = pathPoints[pathPoints.length-1];
            const prev = pathPoints[pathPoints.length-2];
            const gateAng = Math.atan2(end.y-prev.y, end.x-prev.x);
            const portalPulse = 0.5 + 0.5 * Math.sin(now * 0.004);
            ctx.save();
            ctx.translate(end.x, end.y); ctx.rotate(gateAng);
            // каменные врата
            ctx.fillStyle='#4a3a3a';
            ctx.fillRect(-10, -26, 12, 52);
            ctx.fillStyle='#5c4848';
            ctx.fillRect(-12, -30, 16, 8); ctx.fillRect(-12, 22, 16, 8);
            // вьющийся тёмный портал
            const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
            grad.addColorStop(0, `rgba(120,20,160,${0.75 + portalPulse*0.25})`);
            grad.addColorStop(0.6, `rgba(70,10,110,${0.5 + portalPulse*0.2})`);
            grad.addColorStop(1, 'rgba(30,0,50,0)');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(0, 0, 22, 0, 2*Math.PI); ctx.fill();
            ctx.strokeStyle = `rgba(200,80,255,${0.4 + portalPulse*0.4})`;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, 14 + portalPulse*3, 0, 2*Math.PI); ctx.stroke();
            ctx.restore();
            // --- Врата спавна: красное пекло там, откуда выходят враги ---
            const st = pathPoints[0], st2 = pathPoints[1];
            const stAng = Math.atan2(st2.y - st.y, st2.x - st.x);
            const spawnPulse = 0.5 + 0.5 * Math.sin(now * 0.005);
            ctx.save();
            ctx.translate(st.x, st.y); ctx.rotate(stAng);
            ctx.fillStyle='#4a3434';
            ctx.fillRect(-10, -26, 12, 52);
            ctx.fillStyle='#5f4343';
            ctx.fillRect(-12, -30, 16, 8); ctx.fillRect(-12, 22, 16, 8);
            const gradS = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
            gradS.addColorStop(0, `rgba(255,90,40,${0.75 + spawnPulse*0.25})`);
            gradS.addColorStop(0.6, `rgba(150,30,10,${0.5 + spawnPulse*0.2})`);
            gradS.addColorStop(1, 'rgba(60,0,0,0)');
            ctx.fillStyle = gradS;
            ctx.beginPath(); ctx.arc(0, 0, 22, 0, 2*Math.PI); ctx.fill();
            ctx.strokeStyle = `rgba(255,140,80,${0.4 + spawnPulse*0.4})`;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, 14 + spawnPulse*3, 0, 2*Math.PI); ctx.stroke();
            ctx.restore();
            // --- Шевроны по пути: куда идут враги ---
            const chevShift = (now * 0.0012) % 1;
            for (let i = 0; i < pathPoints.length - 1; i++) {
                const a = pathPoints[i], b = pathPoints[i+1];
                const segLen = Math.hypot(b.x - a.x, b.y - a.y);
                const steps = Math.max(1, Math.round(segLen / CELL));
                const ang = Math.atan2(b.y - a.y, b.x - a.x);
                for (let k = 0; k < steps; k++) {
                    const t = (k + chevShift) / steps;
                    if (t > 1) continue;
                    const cx = a.x + (b.x - a.x) * t, cy = a.y + (b.y - a.y) * t;
                    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
                    ctx.strokeStyle = `rgba(255,120,60,${0.28 + 0.18 * Math.sin(now * 0.004 + i * 1.3)})`;
                    ctx.lineWidth = 2; ctx.beginPath();
                    ctx.moveTo(-5, -6); ctx.lineTo(2, 0); ctx.lineTo(-5, 6);
                    ctx.stroke(); ctx.restore();
                }
            }
            // --- Подписи целей (с удержанием в границах канвы) ---
            ctx.font = 'bold 15px Cormorant, serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(255,170,110,0.95)';
            ctx.fillText('ВХОД ОРДЫ', Math.max(80, Math.min(VW - 80, st.x)), Math.max(24, st.y - 44));
            ctx.fillStyle = 'rgba(210,140,255,0.95)';
            ctx.fillText('ЦИТАДЕЛЬ — ОХРАНЯТЬ', Math.max(100, Math.min(VW - 100, end.x)), Math.max(24, end.y - 44));
            towers.forEach(t => {
                const x = t.col*CELL+CELL/2, y = t.row*CELL+CELL/2;
                if (t.type === 'buffer') {
                    const pulse = 0.5 + 0.5 * Math.sin(now * 0.003);
                    ctx.beginPath(); ctx.arc(x, y, t.cfg.auraRadius, 0, 2*Math.PI);
                    ctx.fillStyle = `rgba(255,200,100,${0.03 + pulse*0.02})`; ctx.fill();
                    ctx.strokeStyle = `rgba(255,200,100,${0.15 + pulse*0.1})`; ctx.lineWidth=1; ctx.stroke();
                }
                const spr = towerSprites[t.type];
                if (spr) ctx.drawImage(spr, x - spr.width*0.65/SPRITE_Q, y - spr.height*0.72/SPRITE_Q, spr.width*1.3/SPRITE_Q, spr.height*1.3/SPRITE_Q);
                ctx.fillStyle='#ffaa00'; ctx.font='bold 12px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='alphabetic';
                for (let i=0;i<t.level;i++) ctx.fillText('★', x-16 + i*11, y-24);
                if (selectedTower===t) {
                    const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.005);
                    ctx.beginPath(); ctx.arc(x, y, t.cfg.range, 0, 2*Math.PI);
                    ctx.strokeStyle=`rgba(255,100,100,${0.3 + pulse * 0.3})`;
                    ctx.lineWidth=3; ctx.stroke();
                    ctx.beginPath(); ctx.arc(x, y, 18, 0, 2*Math.PI);
                    ctx.strokeStyle=`rgba(255,200,100,${0.5 + pulse * 0.5})`;
                    ctx.lineWidth=2; ctx.stroke();
                }
            });
            if (selectedBuildType && hoverCol >= 0 && hoverCol < COLS && hoverRow >= 0 && hoverRow < ROWS) {
                const hx = (hoverCol+0.5)*CELL, hy = (hoverRow+0.5)*CELL;
                const range = towerDefs[selectedBuildType].range[0];
                const canBuild = !pathSet.has(`${hoverCol},${hoverRow}`) && !towers.some(t=>t.col===hoverCol && t.row===hoverRow) && gold >= towerDefs[selectedBuildType].cost;
                ctx.beginPath(); ctx.arc(hx, hy, range, 0, 2*Math.PI);
                ctx.fillStyle = canBuild ? 'rgba(100,255,100,0.1)' : 'rgba(255,50,50,0.15)';
                ctx.fill();
                ctx.strokeStyle = canBuild ? 'rgba(100,255,100,0.5)' : 'rgba(255,50,50,0.5)';
                ctx.lineWidth = 2; ctx.stroke();
                ctx.strokeStyle = canBuild ? '#44ff44' : '#ff4444';
                ctx.lineWidth = 2;
                ctx.strokeRect(hoverCol*CELL+2, hoverRow*CELL+2, CELL-4, CELL-4);
            }
            enemies.forEach(e => {
                if (!e.emoji) return;
                ctx.save();
                if (e.invisible) ctx.globalAlpha = 0.25;
                const ex = e.x, ey = e.flying ? e.y - 16 : e.y;
                if (e.flying) {
                    // тень на земле
                    ctx.fillStyle = 'rgba(0,0,0,0.3)';
                    ctx.beginPath(); ctx.ellipse(e.x, e.y + e.size*8, e.size*8, e.size*3.5, 0, 0, 2*Math.PI); ctx.fill();
                }
                const spr = e.isBoss ? bossSprites[e.typeIndex] : enemySprites[e.typeIndex];
                if (spr) {
                    const w = e.size * 44;
                    ctx.drawImage(spr, ex - w/2, ey - w/2, w, w);
                }
                if (e.hp < e.maxHp) {
                    const w = e.size*22;
                    ctx.fillStyle='#1a1a1a';
                    ctx.fillRect(ex-w/2-1, ey-e.size*14-5, w+2, 6);
                    const hpGrad = ctx.createLinearGradient(ex-w/2, 0, ex-w/2+w*(e.hp/e.maxHp), 0);
                    hpGrad.addColorStop(0, '#ff3333');
                    hpGrad.addColorStop(1, '#ff6666');
                    ctx.fillStyle = hpGrad;
                    ctx.fillRect(ex-w/2, ey-e.size*14-4, w*(e.hp/e.maxHp), 4);
                    ctx.font = 'bold 10px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(`${Math.ceil(e.hp)}/${e.maxHp}`, ex, ey - e.size*14 - 8);
                }
                if (e.shieldActive) { ctx.strokeStyle='#ffaa00'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(ex, ey, e.size*13, 0, 2*Math.PI); ctx.stroke(); }
                if (e.dmgShieldActive) { ctx.strokeStyle='#4488ff'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(ex, ey, e.size*13, 0, 2*Math.PI); ctx.stroke(); }
                if (e.invuln) { ctx.strokeStyle='#ffdd00'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(ex, ey, e.size*14, 0, 2*Math.PI); ctx.stroke(); }
                if (e.berserk && e.hp < e.maxHp*0.5) { ctx.strokeStyle='red'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(ex, ey, e.size*15, 0, 2*Math.PI); ctx.stroke(); }
                ctx.restore();
            });
            projectiles.forEach(p => {
                ctx.save();
                // шлейф
                if (p.trail && p.trail.length > 1) {
                    for (let i = 1; i < p.trail.length; i++) {
                        const a = (i / p.trail.length) * 0.35;
                        ctx.globalAlpha = a;
                        ctx.strokeStyle = p.color;
                        ctx.lineWidth = 3 + i;
                        ctx.beginPath();
                        ctx.moveTo(p.trail[i-1].x, p.trail[i-1].y);
                        ctx.lineTo(p.trail[i].x, p.trail[i].y);
                        ctx.stroke();
                    }
                    ctx.globalAlpha = 1;
                }
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 12;
                ctx.fillStyle = p.color;
                ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, 2*Math.PI); ctx.fill();
                ctx.globalAlpha = 0.4;
                ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, 2*Math.PI); ctx.fill();
                ctx.globalAlpha = 0.15;
                ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, 2*Math.PI); ctx.fill();
                ctx.restore();
            });
            effects.forEach(ef => {
                if (ef.type==='muzzle') { ctx.fillStyle = ef.color; ctx.beginPath(); ctx.arc(ef.x, ef.y, 8, 0, 2*Math.PI); ctx.fill(); }
                else if (ef.type==='explosion') { const a = ef.timer/0.5; ctx.fillStyle = `rgba(255,80,0,${a})`; ctx.beginPath(); ctx.arc(ef.x, ef.y, ef.radius*(1-ef.timer/0.5+0.2), 0, 2*Math.PI); ctx.fill(); }
                else if (ef.type==='spark') { ctx.fillStyle = ef.color; for (let i=0;i<6;i++) ctx.fillRect(ef.x+Math.cos(i*1.05)*8-1, ef.y+Math.sin(i*1.05)*8-1, 3,3); }
                else if (ef.type==='freeze') { ctx.strokeStyle='#88ccff'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(ef.x, ef.y, 22, 0, 2*Math.PI); ctx.stroke(); }
                else if (ef.type==='multishot') { const a = ef.timer/ef.maxTimer; ctx.strokeStyle=`rgba(255,200,0,${a})`; ctx.lineWidth=2; for (let i=-1;i<=1;i++) { ctx.beginPath(); ctx.moveTo(ef.x, ef.y); ctx.lineTo(ef.x+i*25, ef.y-35); ctx.stroke(); } }
                else if (ef.type==='lightningBolt') { const a = ef.timer/ef.maxTimer; ctx.strokeStyle=`rgba(255,255,100,${a})`; ctx.lineWidth=3; ctx.shadowColor='#ffaa00'; ctx.shadowBlur=15; ctx.beginPath(); ctx.moveTo(ef.x, 0); let cx=ef.x; for (let y=0;y<ef.y;y+=20) { cx+=(Math.random()-0.5)*30; ctx.lineTo(cx, y); } ctx.lineTo(ef.x, ef.y); ctx.stroke(); ctx.shadowBlur=0; }
                else if (ef.type==='frostRing') { const a = ef.timer/ef.maxTimer; const r = ef.maxRadius*(1-a); ctx.strokeStyle=`rgba(150,200,255,${a*0.7})`; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(ef.x, ef.y, r, 0, 2*Math.PI); ctx.stroke(); ctx.strokeStyle=`rgba(200,230,255,${a*0.3})`; ctx.lineWidth=8; ctx.beginPath(); ctx.arc(ef.x, ef.y, r, 0, 2*Math.PI); ctx.stroke(); }
                else if (ef.type==='fireExplosion') { const a = ef.timer/ef.maxTimer; const r = 30*(1-a+0.3); ctx.fillStyle=`rgba(255,${100+Math.random()*100},0,${a*0.6})`; ctx.beginPath(); ctx.arc(ef.x, ef.y, r, 0, 2*Math.PI); ctx.fill(); ctx.strokeStyle=`rgba(255,200,0,${a})`; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(ef.x, ef.y, r, 0, 2*Math.PI); ctx.stroke(); }
                else if (ef.type==='lightningStrike') { const a = ef.timer/ef.maxTimer; ctx.strokeStyle=`rgba(255,255,150,${a})`; ctx.lineWidth=2; ctx.shadowColor='#ffaa00'; ctx.shadowBlur=10; ctx.beginPath(); ctx.moveTo(ef.x, 0); let cx=ef.x; for (let y=0;y<ef.y;y+=15) { cx+=(Math.random()-0.5)*25; ctx.lineTo(cx, y); } ctx.lineTo(ef.x, ef.y); ctx.stroke(); ctx.shadowBlur=0; }
                else if (ef.type==='frostSpread') { const a = ef.timer/ef.maxTimer; const r = ef.maxRadius*(1-a); ctx.strokeStyle=`rgba(150,200,255,${a*0.4})`; ctx.lineWidth=6; ctx.beginPath(); ctx.arc(ef.x, ef.y, r, 0, 2*Math.PI); ctx.stroke(); ctx.strokeStyle=`rgba(200,230,255,${a*0.2})`; ctx.lineWidth=14; ctx.beginPath(); ctx.arc(ef.x, ef.y, r, 0, 2*Math.PI); ctx.stroke(); }
                else if (ef.type==='fireballFall') {
                    const a = ef.timer/ef.maxTimer; const cy = ef.y + (ef.targetY - ef.y) * (1-a);
                    // дымный шлейф
                    ctx.fillStyle = `rgba(120,60,40,${a*0.35})`;
                    ctx.beginPath(); ctx.arc(ef.x - 6, cy - 26*(1-a) - 10, 8*(1-a)+3, 0, 2*Math.PI); ctx.fill();
                    ctx.fillStyle=`rgba(255,${100+Math.random()*100},0,${a})`; ctx.shadowColor='#ff4400'; ctx.shadowBlur=14;
                    ctx.beginPath(); ctx.arc(ef.x, cy, 6+Math.random()*3, 0, 2*Math.PI); ctx.fill();
                    ctx.fillStyle=`rgba(255,220,0,${a*0.7})`;
                    ctx.beginPath(); ctx.arc(ef.x, cy, 3.5+Math.random()*2, 0, 2*Math.PI); ctx.fill();
                    // удар о землю — вспышка
                    if (a < 0.18) {
                        const ia = (0.18 - a) / 0.18;
                        ctx.strokeStyle = `rgba(255,180,60,${ia*0.9})`; ctx.lineWidth = 3;
                        ctx.beginPath(); ctx.arc(ef.x, ef.targetY, 10 + ia*34, 0, 2*Math.PI); ctx.stroke();
                        ctx.fillStyle = `rgba(255,140,30,${ia*0.4})`;
                        ctx.beginPath(); ctx.arc(ef.x, ef.targetY, 6 + ia*20, 0, 2*Math.PI); ctx.fill();
                    }
                    ctx.shadowBlur=0;
                }
                else if (ef.type==='iceShard') {
                    const a = Math.min(1, ef.timer/ef.maxTimer*1.6);
                    const x = ef.x + ef.vx * (ef.maxTimer - ef.timer), y = ef.y + ef.vy * (ef.maxTimer - ef.timer);
                    ctx.save(); ctx.translate(x, y); ctx.rotate(ef.rot);
                    ctx.strokeStyle = `rgba(190,235,255,${a})`; ctx.lineWidth = 3;
                    ctx.shadowColor = '#aaddff'; ctx.shadowBlur = 8;
                    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.stroke();
                    ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 1.2;
                    ctx.beginPath(); ctx.moveTo(-12, -3); ctx.lineTo(12, -3); ctx.stroke();
                    ctx.restore();
                }
                else if (ef.type==='frostPatch') {
                    const a = ef.timer/ef.maxTimer;
                    ctx.fillStyle = `rgba(160,215,255,${a*0.18})`;
                    ctx.beginPath(); ctx.ellipse(ef.x, ef.y, ef.r, ef.r*0.55, 0, 0, 2*Math.PI); ctx.fill();
                    ctx.strokeStyle = `rgba(220,245,255,${a*0.3})`; ctx.lineWidth = 1.5; ctx.stroke();
                }
                else if (ef.type==='scorch') {
                    const a = ef.timer/ef.maxTimer;
                    ctx.fillStyle = `rgba(15,8,5,${a*0.55})`;
                    ctx.beginPath(); ctx.ellipse(ef.x, ef.y, ef.r, ef.r*0.5, 0, 0, 2*Math.PI); ctx.fill();
                    ctx.strokeStyle = `rgba(255,90,20,${a*0.35})`; ctx.lineWidth = 2; ctx.stroke();
                }
                else if (ef.type==='strikeGlow') {
                    const a = ef.timer/ef.maxTimer;
                    const g = ctx.createRadialGradient(ef.x, ef.y, 2, ef.x, ef.y, 60);
                    g.addColorStop(0, `rgba(255,255,200,${a*0.7})`);
                    g.addColorStop(1, 'rgba(255,200,60,0)');
                    ctx.fillStyle = g;
                    ctx.beginPath(); ctx.arc(ef.x, ef.y, 60, 0, 2*Math.PI); ctx.fill();
                }
                else if (ef.type==='frostEdge') {
                    const a = ef.timer/ef.maxTimer;
                    const eg = ctx.createLinearGradient(0, 0, 0, VH);
                    eg.addColorStop(0, `rgba(190,230,255,${a*0.4})`);
                    eg.addColorStop(0.18, 'rgba(190,230,255,0)');
                    eg.addColorStop(0.82, 'rgba(190,230,255,0)');
                    eg.addColorStop(1, `rgba(190,230,255,${a*0.4})`);
                    ctx.fillStyle = eg; ctx.fillRect(0, 0, VW, VH);
                    const eg2 = ctx.createLinearGradient(0, 0, VW, 0);
                    eg2.addColorStop(0, `rgba(190,230,255,${a*0.35})`);
                    eg2.addColorStop(0.14, 'rgba(190,230,255,0)');
                    eg2.addColorStop(0.86, 'rgba(190,230,255,0)');
                    eg2.addColorStop(1, `rgba(190,230,255,${a*0.35})`);
                    ctx.fillStyle = eg2; ctx.fillRect(0, 0, VW, VH);
                }
                else if (ef.type==='spellTint') { const a = ef.timer/ef.maxTimer; ctx.fillStyle=`rgba(${ef.color},${a*0.08})`; ctx.fillRect(0,0,VW,VH); }
            });
            particles.forEach(p => { ctx.fillStyle = p.color; ctx.globalAlpha = p.life*0.9; ctx.fillRect(p.x-2, p.y-2, 4, 4); ctx.globalAlpha=1; });
            floatingTexts.forEach(t => {
                ctx.font = "bold 16px 'Cinzel', sans-serif";
                ctx.textAlign = 'center';
                ctx.fillStyle = '#ffdd00';
                ctx.globalAlpha = Math.min(1, t.life * 2);
                ctx.shadowColor = '#ff8800';
                ctx.shadowBlur = 8;
                ctx.fillText(t.text, t.x, t.y);
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 1;
            });
            // модификаторы-погода: ночь и туман
            const activeMod = getWaveMod(waveNum + (waveActive ? 1 : 0));
            if (activeMod && (activeMod.id === 'night' || activeMod.id === 'fog')) {
                if (activeMod.id === 'night') {
                    ctx.fillStyle = 'rgba(8,8,35,0.5)';
                    ctx.fillRect(0, 0, VW, VH);
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    torches.forEach(t => {
                        const flicker = 0.6 + 0.4 * Math.sin(now * 0.006 + t.offset);
                        const fy = t.y - t.h - 8;
                        const R = 130 + flicker*26;
                        // световое пятно на земле вокруг основания
                        const gp = ctx.createRadialGradient(t.x, t.y, 4, t.x, t.y, R*0.75);
                        gp.addColorStop(0, `rgba(255,170,70,${0.26 + flicker*0.10})`);
                        gp.addColorStop(1, 'rgba(255,120,20,0)');
                        ctx.fillStyle = gp;
                        ctx.beginPath(); ctx.ellipse(t.x, t.y, R*0.75, R*0.4, 0, 0, 2*Math.PI); ctx.fill();
                        // сияние пламени
                        const g = ctx.createRadialGradient(t.x, fy, 4, t.x, fy, R);
                        g.addColorStop(0, `rgba(255,200,90,${0.42 + flicker*0.16})`);
                        g.addColorStop(0.5, 'rgba(255,140,30,0.16)');
                        g.addColorStop(1, 'rgba(255,120,20,0)');
                        ctx.fillStyle = g;
                        ctx.beginPath(); ctx.arc(t.x, fy, R, 0, 2*Math.PI); ctx.fill();
                    });
                    const eg = ctx.createRadialGradient(end.x, end.y, 6, end.x, end.y, 140);
                    eg.addColorStop(0, 'rgba(180,60,255,0.25)');
                    eg.addColorStop(1, 'rgba(120,20,200,0)');
                    ctx.fillStyle = eg;
                    ctx.beginPath(); ctx.arc(end.x, end.y, 140, 0, 2*Math.PI); ctx.fill();
                    ctx.restore();
                }
                if (activeMod.id === 'fog') {
                    fogBanks.forEach(f => {
                        const a = 0.10 + 0.05 * Math.sin(f.ph);
                        const g = ctx.createRadialGradient(f.x, f.y, f.r*0.2, f.x, f.y, f.r);
                        g.addColorStop(0, `rgba(200,205,220,${a})`);
                        g.addColorStop(1, 'rgba(200,205,220,0)');
                        ctx.fillStyle = g;
                        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 2*Math.PI); ctx.fill();
                    });
                }
            }
            // баннер модификатора волны
            effects.forEach(ef => {
                if (ef.type !== 'modBanner') return;
                const t = 1 - ef.timer/ef.maxTimer;
                const a = t < 0.15 ? t/0.15 : (t > 0.8 ? (1-t)/0.2 : 1);
                ctx.save();
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.font = "900 92px 'Grenze Gotisch', serif";
                ctx.fillStyle = `rgba(255,60,40,${a*0.85})`;
                ctx.shadowColor = 'rgba(255,0,0,0.8)'; ctx.shadowBlur = 30;
                ctx.fillText(ef.text, VW/2, VH*0.32);
                if (ef.sub) {
                    ctx.font = "600 30px 'Grenze Gotisch', serif";
                    ctx.shadowBlur = 8;
                    ctx.fillStyle = `rgba(255,220,180,${a*0.9})`;
                    ctx.fillText(ef.sub.trim(), VW/2, VH*0.32 + 58);
                }
                ctx.restore();
            });
            // виньетка (кэшированный градиент)
            if (!drawScene._vignette || drawScene._vignetteW !== VW) {
                const vg = ctx.createRadialGradient(VW/2, VH/2, VH*0.45, VW/2, VH/2, VW*0.72);
                vg.addColorStop(0, 'rgba(0,0,0,0)');
                vg.addColorStop(1, 'rgba(0,0,0,0.5)');
                drawScene._vignette = vg;
                drawScene._vignetteW = VW;
            }
            ctx.fillStyle = drawScene._vignette;
            ctx.fillRect(0, 0, VW, VH);
            if (gameOver) {
                ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0,0,VW,VH);
                ctx.font = "bold 48px 'Cinzel', serif"; ctx.fillStyle = '#ff3333'; ctx.textAlign = 'center'; ctx.fillText('ПОРАЖЕНИЕ', VW/2, VH/2);
            }
            ctx.restore();
        }

        let lastTime = 0;
        function loop(ts) {
            if (!lastTime) lastTime = ts;
            let dt = Math.min(0.1, (ts - lastTime)/1000);
            lastTime = ts;
            if (!paused && !gameOver && !victory) {
                const eDt = dt * gameSpeed;
                if (lightningCD>0) lightningCD -= eDt; if (frostCD>0) frostCD -= eDt; if (fireRainCD>0) fireRainCD -= eDt;
                if (waveActive) { mana = Math.min(maxMana, mana + manaRegen * eDt); waveElapsed += eDt; }
                // Спавн по игровому времени: останавливается на паузе,
                // масштабируется ускорением, сбрасывается рестартом
                if (waveActive && !waveSpawningComplete) {
                    spawnClock += eDt;
                    while (spawnQueue.length && spawnQueue[0].t <= spawnClock) {
                        const item = spawnQueue.shift();
                        if (item.boss !== undefined) { enemies.push(new Enemy(item.boss, waveNum, true)); screenShake = Math.max(screenShake, 0.5); playBossSpawn(); }
                        else enemies.push(new Enemy(item.type, waveNum));
                    }
                    if (!spawnQueue.length) waveSpawningComplete = true;
                }
                // Авто-старт следующей волны
                if (autoTimer >= 0) { autoTimer -= eDt; if (autoTimer < 0) { autoTimer = -1; if (autoStart && !waveActive) startWave(); } }
                // Reset speed boosts
                enemies.forEach(e => { e.speedBoost = 1; });
                // Apply speed auras
                enemies.forEach(e => {
                    if (e.auraSpeed && e.alive) {
                        enemies.forEach(o => {
                            if (o !== e && o.alive && Math.hypot(e.x-o.x, e.y-o.y) < e.auraRadius) o.speedBoost = Math.max(o.speedBoost, e.auraSpeed);
                        });
                    }
                });
                enemies.forEach(e=>e.update(eDt)); enemies = enemies.filter(e=>e.alive);
                // Apply buffer tower auras
                towers.forEach(t => { t.buffMult = 1; });
                towers.forEach(b => {
                    if (b.type === 'buffer') {
                        const bx = (b.col+0.5)*CELL, by = (b.row+0.5)*CELL;
                        const cfg = b.cfg;
                        towers.forEach(t => {
                            if (t !== b) {
                                const d = Math.hypot((t.col+0.5)*CELL - bx, (t.row+0.5)*CELL - by);
                                if (d <= cfg.auraRadius) t.buffMult = Math.max(t.buffMult, 1 + cfg.auraBuff);
                            }
                        });
                    }
                });
                towers.forEach(t=>t.update(eDt, enemies));
                projectiles.forEach(p=>p.update(eDt)); projectiles = projectiles.filter(p=>p.alive);
                effects = effects.filter(e=>{ e.timer-=eDt; return e.timer>0; });
                particles = particles.filter(p=>{ p.life-=eDt; p.x+=p.vx*eDt; p.y+=p.vy*eDt; return p.life>0; });
                floatingTexts = floatingTexts.filter(t => { t.y += t.vy * eDt; t.life -= eDt; return t.life > 0; });
                if (screenShake > 0) screenShake -= eDt;
                totalPlayTime += eDt;
                // дрейф тумана
                fogBanks.forEach(f => {
                    f.x += f.vx * eDt; f.y += f.vy * eDt; f.ph += eDt;
                    if (f.x < -f.r) f.x = VW + f.r; if (f.x > VW + f.r) f.x = -f.r;
                    if (f.y < -f.r) f.y = VH + f.r; if (f.y > VH + f.r) f.y = -f.r;
                });
                checkWaveEnd();
                if (Math.random()<0.3) particles.push({x:Math.random()*VW, y:VH, vx:(Math.random()-0.5)*5, vy:-12-Math.random()*22, life:2+Math.random()*3, color:'rgba(255,100,100,0.06)'});
                if (gameOver && document.getElementById('victory-overlay').style.display === 'none') {
                    document.getElementById('victory-overlay').style.display = 'flex';
                    document.getElementById('overlay-title').textContent = 'ПОРАЖЕНИЕ';
                    showEndStats();
                    playDefeat();
                }
            }
            drawScene(performance.now());
            updateUI();
            requestAnimationFrame(loop);
        }

        if (!loadGame()) resetGame();
        // отладочный доступ к состоянию (для тестов)
        window.__TD = { get state() { return { enemies: enemies.length, alive: enemies.filter(e=>e.alive).length, queue: spawnQueue.length, clock: spawnClock, waveActive, waveSpawningComplete, lives, gold, paused, gameOver, victory }; } };
        requestAnimationFrame(loop);
    })();
