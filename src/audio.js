// ─── AUDIO ENGINE ────────────────────────────────────────────
export const AudioEngine = (() => {
  let ctx = null;
  let masterGain = null;        // nodo gain globale — volume istantaneo su tutto
  let bgIntervalId = null;
  let switchTimeoutId = null;
  let currentTheme = null;
  let pendingTheme = null;      // tema in attesa nel debounce (fix race A→B→A)
  let masterVolume = 0.7;

  const getCtx = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  };

  // Tutti i suoni passano per questo nodo — cambiare gain = volume immediato
  const getMaster = () => {
    const ac = getCtx();
    if (!masterGain || masterGain.context.state === "closed") {
      masterGain = ac.createGain();
      masterGain.gain.value = masterVolume;
      masterGain.connect(ac.destination);
    }
    return masterGain;
  };

  // Suona un tono — il volume individuale è relativo, masterGain gestisce il livello globale
  const playTone = (freq, dur, type="square", vol=0.08, startTime=0) => {
    if (masterVolume === 0) return;
    try {
      const ac = getCtx();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(getMaster());
      osc.type = type; osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ac.currentTime + startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + startTime + dur);
      osc.start(ac.currentTime + startTime);
      osc.stop(ac.currentTime + startTime + dur + 0.01);
    } catch(e) {}
  };

  // Zelda-style harp pluck: attacco istantaneo, decay risonante, shimmer all'ottava
  const playHarp = (freq, vol = 0.05, startTime = 0) => {
    if (masterVolume === 0) return;
    try {
      const ac = getCtx();
      const t = ac.currentTime + startTime;
      // Corpo principale — triangle (caldo, armonico)
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = "triangle"; osc.frequency.value = freq;
      osc.connect(g); g.connect(getMaster());
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.start(t); osc.stop(t + 0.55);
      // Shimmer ottava — sine tenue, ritardo 40ms (effetto riverbero naturale)
      const osc2 = ac.createOscillator();
      const g2 = ac.createGain();
      osc2.type = "sine"; osc2.frequency.value = freq * 2;
      osc2.connect(g2); g2.connect(getMaster());
      g2.gain.setValueAtTime(0, t + 0.04);
      g2.gain.linearRampToValueAtTime(vol * 0.2, t + 0.06);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc2.start(t + 0.04); osc2.stop(t + 0.55);
    } catch(e) {}
  };

  return {
    scratch: () => {
      if (masterVolume === 0) return;
      try {
        const ac = getCtx();
        const bufSize = Math.floor(ac.sampleRate * 0.08);
        const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random()*2-1) * 0.25;
        const src = ac.createBufferSource();
        src.buffer = buf;
        const filt = ac.createBiquadFilter();
        filt.type = "bandpass"; filt.frequency.value = 2500 + Math.random()*2000; filt.Q.value = 0.5;
        const gain = ac.createGain(); gain.gain.value = 0.4;
        src.connect(filt); filt.connect(gain); gain.connect(getMaster());
        src.start(); src.stop(ac.currentTime + 0.09);
      } catch(e) {}
    },
    win: () => {
      [523,659,784,1047].forEach((f,i) => setTimeout(()=>playTone(f,0.3,"square",0.12), i*110));
    },
    lose: () => {
      [330,220,150].forEach((f,i) => setTimeout(()=>playTone(f,0.25,"sawtooth",0.1), i*120));
    },
    click: () => playTone(600, 0.04, "square", 0.06),
    // Scatto meccanico della mappa — "slot reel stop"
    mapTick: () => {
      playTone(300, 0.022, "square", 0.11);
      playTone(620, 0.012, "square", 0.05, 0.008);
    },
    dialogueTick: () => playTone(520 + Math.random()*160, 0.018, "square", 0.018),
    cash: () => {
      // Ka-ching! coin drop + register bell
      playTone(1200, 0.06, "square", 0.10);
      playTone(1800, 0.08, "square", 0.08, 0.06);
      playTone(2400, 0.12, "triangle", 0.06, 0.12);
      playHarp(1568, 0.08, 0.10); // G6 shimmer
    },
    // ─── SFX COMBATTIMENTO ─────────────────────────────────────
    heal: () => {
      // Cura: chime caldo ascendente + sparkle — sensazione positiva
      [523, 659, 880].forEach((f, i) => playHarp(f, 0.06, i * 0.07));
      playTone(1760, 0.18, "sine", 0.05, 0.14);
    },
    hitEnemy: () => {
      // Colpo inflitto: impatto secco "thud" + crack corto (diverso dal dolore player)
      playTone(180, 0.07, "square", 0.16);
      playTone(95, 0.13, "sawtooth", 0.13, 0.02);
      if (masterVolume === 0) return;
      try {
        const ac = getCtx();
        const bufSize = Math.floor(ac.sampleRate * 0.05);
        const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * 0.35 * (1 - i / bufSize);
        const src = ac.createBufferSource(); src.buffer = buf;
        const g = ac.createGain(); g.gain.value = 0.5;
        src.connect(g); g.connect(getMaster()); src.start();
      } catch {}
    },
    perfectHit: () => {
      // Colpo PERFETTO: doppio ding brillante + shimmer
      playTone(1320, 0.08, "triangle", 0.12);
      playTone(1980, 0.14, "triangle", 0.09, 0.06);
      playHarp(2637, 0.06, 0.02);
    },
    parry: () => {
      // Parata riuscita: "cling" metallico acuto e corto
      playTone(2400, 0.05, "square", 0.10);
      playTone(3300, 0.10, "triangle", 0.07, 0.03);
      playTone(1600, 0.06, "square", 0.05, 0.01);
    },
    nailCrack: () => {
      // Crack secco + eco quando un'unghia si rompe
      playTone(80, 0.15, "sawtooth", 0.20);
      playTone(60, 0.25, "square", 0.12, 0.08);
      playTone(40, 0.4, "sawtooth", 0.06, 0.15);
    },
    china: () => {
      // Melodia pentatonica cinese — scale Do Re Mi Sol La
      const notes = [523, 587, 659, 784, 880, 784, 659, 523];
      notes.forEach((f, i) => playHarp(f, 0.08, i * 0.15));
      // Gong finale
      playTone(130, 1.5, "triangle", 0.12, notes.length * 0.15);
    },
    bossEntrance: () => {
      // Chord drammatico — minore, pesante
      [130, 156, 196, 262].forEach((f, i) => playTone(f, 0.8, "sawtooth", 0.10, i * 0.08));
      playTone(65, 1.2, "square", 0.08, 0.3); // sub bass
    },
    achievementJingle: () => {
      // 4 note ascendenti brillanti
      [523, 659, 784, 1047].forEach((f, i) => playHarp(f, 0.10, i * 0.12));
      playTone(1047, 0.4, "triangle", 0.06, 0.5); // sustain finale
    },
    scratchVariant: () => {
      // 3 varianti random di grattata
      if (masterVolume === 0) return;
      try {
        const ac = getCtx();
        const dur = 0.06 + Math.random() * 0.04;
        const bufSize = Math.floor(ac.sampleRate * dur);
        const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
        const data = buf.getChannelData(0);
        const pitch = 0.8 + Math.random() * 0.4;
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random()*2-1) * 0.20 * pitch;
        const src = ac.createBufferSource();
        src.buffer = buf; src.connect(getMaster()); src.start();
      } catch {}
    },
    painScream: () => {
      if (masterVolume === 0) return;
      try {
        const ac = getCtx();
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain); gain.connect(getMaster());
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(520, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(140, ac.currentTime + 0.55);
        gain.gain.setValueAtTime(0.28, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.65);
        osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.7);
        const bufSize = Math.floor(ac.sampleRate * 0.12);
        const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = (Math.random()*2-1) * 0.5;
        const src = ac.createBufferSource(); src.buffer = buf;
        const ng = ac.createGain();
        ng.gain.setValueAtTime(0.4, ac.currentTime);
        ng.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12);
        src.connect(ng); ng.connect(getMaster());
        src.start(); src.stop(ac.currentTime + 0.15);
      } catch(e) {}
    },
    // ── Ambient music ─────────────────────────────────────────
    playMusic: (theme) => {
      // Guard doppio: stessa pending O stesso tema già attivo → non ripartire
      if (theme === pendingTheme || (theme === currentTheme && pendingTheme === null)) return;
      pendingTheme = theme;
      clearTimeout(switchTimeoutId);
      switchTimeoutId = setTimeout(() => {
        clearInterval(bgIntervalId); bgIntervalId = null;
        currentTheme = theme;
        pendingTheme = null;
        if (theme) AudioEngine._startTheme(theme);
      }, 180);
    },
    _startTheme: (theme) => {
      // Bug fix: assicura che nessun interval precedente sopravviva (zombie fix)
      clearInterval(bgIntervalId); bgIntervalId = null;

      // ── 6 temi con atmosfera distinta ──────────────────────────
      // Note: tutte le frequenze in Hz, scala temperata
      const T = {
        // ESPLORAZIONE — C pentatonica, 75 BPM, calmo e curioso (mappa, pre-scratch)
        explore: {
          mel: [523,659,784,659, 523,440,392,440, 587,659,523,440, 392,523,440,392],
          har: [329,440,523,440, 329,277,261,277, 392,440,329,277, 261,329,277,261],
          bas: [130,196,130,196, 146,220,146,220],
          mv:0.030, hv:0.013, bv:0.022, t:400,
        },
        // CONCENTRAZIONE — D minore, 90 BPM, leggera tensione (durante la grattata)
        scratch: {
          mel: [587,659,698,659, 587,523,494,523, 587,698,784,698, 659,587,523,494],
          har: [349,392,440,392, 349,311,294,311, 349,440,523,440, 392,349,311,294],
          bas: [146,220,146,220, 123,185,123,185],
          mv:0.028, hv:0.012, bv:0.020, t:333,
        },
        // TABACCHERIA — Sol maggiore, 65 BPM, caldo e commerciale (shop)
        shop: {
          mel: [392,440,494,440, 392,330,294,330, 440,494,523,587, 523,494,440,392],
          har: [196,261,294,261, 196,196,196,196, 261,294,329,392, 329,294,261,220],
          bas: [98,146,98,146, 98,146,98,146],
          mv:0.026, hv:0.012, bv:0.020, t:462,
        },
        // LOCANDA — Fa maggiore, 60 BPM, rilassato e caldo (locanda, riposo)
        locanda: {
          mel: [349,392,440,392, 349,311,261,311, 392,440,523,440, 392,349,311,349],
          har: [220,246,277,246, 220,196,164,196, 246,277,329,277, 246,220,196,220],
          bas: [87,130,87,130, 87,130,87,130],
          mv:0.024, hv:0.011, bv:0.018, t:500,
        },
        // COMBATTIMENTO — La minore, 110 BPM, teso e ritmico (sfide, eventi)
        combat: {
          mel: [440,440,494,523, 440,392,330,349, 440,392,349,330, 294,330,349,392],
          har: [220,220,294,329, 220,196,164,174, 220,196,174,164, 147,164,174,196],
          bas: [110,110,165,110, 110,165,110,110],
          mv:0.036, hv:0.017, bv:0.028, t:272,
        },
        // BOSS — La frigio, 130 BPM, epico e inevitabile (Il Broker)
        boss: {
          mel: [440,392,349,294, 330,349,392,440, 494,440,392,349, 330,294,261,220],
          har: [220,196,174,147, 165,174,196,220, 247,220,196,174, 165,147,130,110],
          bas: [110,110,165,110, 110,146,110,110],
          mv:0.040, hv:0.020, bv:0.030, t:230,
        },
        // 🇨🇳 Quartiere Cinese — pentatonica C-D-E-G-A, arpa lenta, atmosfera zen
        chinaTown: {
          mel: [523,659,784,880,784, 659,523,440, 523,587,659,784, 880,784,659,523],
          har: [261,329,392,440,392, 329,261,220, 261,294,329,392, 440,392,329,261],
          bas: [130,196,130,196, 110,165,110,165],
          mv:0.028, hv:0.012, bv:0.020, t:420,
        },
        // 🐲 Boss Drago d'Oro — pentatonica minore aggressiva
        bossDrago: {
          mel: [440,523,587,659,784, 659,587,523, 440,392,349,440, 523,587,659,784],
          har: [220,261,294,329,392, 329,294,261, 220,196,174,220, 261,294,329,392],
          bas: [110,130,110,146, 110,130,110,98],
          mv:0.045, hv:0.022, bv:0.035, t:200,
        },
      };

      const th = T[theme] || T.explore;
      let i = 0;
      const step = () => {
        playHarp(th.mel[i % th.mel.length], th.mv);
        playTone(th.har[i % th.har.length], th.t / 1000 * 0.50, "sine", th.hv);
        if (i % 2 === 0) playHarp(th.bas[Math.floor(i / 2) % th.bas.length], th.bv);
        // Sparkle ogni 8 step — solo sui temi calmi (non combat/boss/china)
        if (i % 8 === 0 && (theme === "explore" || theme === "shop" || theme === "locanda" || theme === "chinaTown")) {
          playTone(th.mel[i % th.mel.length] * 2, 0.10, "sine", th.mv * 0.22);
        }
        i++;
      };
      step();
      bgIntervalId = setInterval(step, th.t);
    },
    stopMusic: () => {
      clearTimeout(switchTimeoutId); switchTimeoutId = null;
      clearInterval(bgIntervalId); bgIntervalId = null;
      currentTheme = null; pendingTheme = null;
    },
    // Volume: assegnazione diretta — effetto immediato, niente race conditions
    setVolume: (v) => {
      masterVolume = Math.max(0, Math.min(1, v));
      if (masterGain) {
        masterGain.gain.cancelScheduledValues(getCtx().currentTime);
        masterGain.gain.value = masterVolume;
      }
    },
    getVolume: () => masterVolume,
    init: () => { try { getCtx(); } catch(e) {} },
  };
})();

// ─── PARTICLE SYSTEM (glitter silver dust) ───────────────────
export const ParticleSystem = (() => {
  let canvas = null;
  let ctx = null;
  let particles = [];
  let animId = null;
  const COLORS = ["#c8c8c8","#e8e8e8","#ffffff","#d4af37","#f0f0f0","#fffacd","#aaaaaa","#b8b8b8"];

  const init = () => {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9998;";
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    const onResize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener("resize", onResize);
  };

  const tick = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => p.alpha > 0.02);
    for (const p of particles) {
      p.vy += p.gravity;
      p.vx *= 0.98;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotSpeed;
      p.alpha -= 0.018 + Math.random() * 0.012;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      if (p.rect) {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (particles.length > 0) {
      animId = requestAnimationFrame(tick);
    } else {
      animId = null;
    }
  };

  const BLOOD_COLORS = ["#ff0000","#cc0000","#8b0000","#ff2222","#dd0011","#aa0000","#ff4444"];
  return {
    spawn(x, y, count = 10, bloodMode = false) {
      init();
      const palette = bloodMode ? BLOOD_COLORS : COLORS;
      for (let i = 0; i < count; i++) {
        const rect = Math.random() > 0.4;
        particles.push({
          x: x + (Math.random() - 0.5) * 24,
          y: y + (Math.random() - 0.5) * 12,
          vx: (Math.random() - 0.5) * 4.5,
          vy: -(Math.random() * 3 + 1),
          gravity: 0.08 + Math.random() * 0.1,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.25,
          color: palette[Math.floor(Math.random() * palette.length)],
          alpha: 0.85 + Math.random() * 0.15,
          rect,
          w: rect ? Math.random() * 5 + 2 : 0,
          h: rect ? Math.random() * 3 + 1 : 0,
          r: rect ? 0 : Math.random() * 2 + 1,
        });
      }
      if (!animId) animId = requestAnimationFrame(tick);
    },
  };
})();
