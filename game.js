const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// Safari iOS 15 polyfill for roundRect
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        r = Math.min(r, w/2, h/2);
        this.beginPath();
        this.moveTo(x+r, y);
        this.lineTo(x+w-r, y); this.quadraticCurveTo(x+w, y, x+w, y+r);
        this.lineTo(x+w, y+h-r); this.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
        this.lineTo(x+r, y+h); this.quadraticCurveTo(x, y+h, x, y+h-r);
        this.lineTo(x, y+r); this.quadraticCurveTo(x, y, x+r, y);
        this.closePath();
    };
}

// --- ELEMENTOS DEL DOM ---
const shopScreen      = document.getElementById('shop-screen');
const difficultyScreen= document.getElementById('difficulty-screen');
const totalCoinsText  = document.getElementById('total-coins');
const restartBtn      = document.getElementById('restart-btn');
const equipHumanBtn   = document.getElementById('equip-human');
const buySlimeBtn     = document.getElementById('buy-slime');
const buySkeletonBtn  = document.getElementById('buy-skeleton');
const audioIndicator  = document.getElementById('audio-indicator');
const missionText     = document.getElementById('mission-text');
// Score display
const elLastScore    = document.getElementById('last-score');
const elLastDistance = document.getElementById('last-distance');
const elLastDistrict = document.getElementById('last-district');
const elBestScore    = document.getElementById('best-score');
const elBestDistance = document.getElementById('best-distance');
const elTotalRuns    = document.getElementById('total-runs');

let buyShieldBtn = document.getElementById('buy-shield');

// --- CONFIGURACIÓN DE LOS 4 DISTRITOS ---
const DISTRICTS = {
    1: {
        name: "NEON SLUMS",
        skyColors: ['#08011a', '#1a0530', '#380820', '#6b0a28'],
        skyStops: [0, 0.35, 0.72, 1.0],
        winColors: ['#ff0055', '#ff3388', '#00ffff', '#ff00aa'],
        gridColor: 'rgba(0, 255, 102, 0.10)',
        gridColor2: 'rgba(255, 0, 136, 0.06)',
        laserColor: '#ff0055',
        fogColor: 'rgba(120, 0, 60, 0.18)',
        moonColor: '#ff88aa',
        baseBpm: 105,
        speedModifier: 1.0,
        xpRequired: 150
    },
    2: {
        name: "CORPORATE CORE",
        skyColors: ['#010810', '#021526', '#042040', '#083060'],
        skyStops: [0, 0.3, 0.65, 1.0],
        winColors: ['#ffcc00', '#ffffff', '#88ccff', '#00aaff'],
        gridColor: 'rgba(0, 160, 255, 0.12)',
        gridColor2: 'rgba(0, 255, 255, 0.06)',
        laserColor: '#00ffff',
        fogColor: 'rgba(0, 40, 100, 0.20)',
        moonColor: '#aaddff',
        baseBpm: 125,
        speedModifier: 1.25,
        xpRequired: 300
    },
    3: {
        name: "THE BLACK ICE",
        skyColors: ['#060000', '#120000', '#220205', '#3d0408'],
        skyStops: [0, 0.3, 0.65, 1.0],
        winColors: ['#00ff66', '#ff3300', '#ff8800', '#00ffaa'],
        gridColor: 'rgba(255, 0, 50, 0.14)',
        gridColor2: 'rgba(255, 60, 0, 0.07)',
        laserColor: '#ff2200',
        fogColor: 'rgba(80, 0, 0, 0.22)',
        moonColor: '#ff4422',
        baseBpm: 148,
        speedModifier: 1.6,   // rápido pero no máximo
        xpRequired: 500
    },
    4: {
        name: "VOID PROTOCOL",
        skyColors: ['#000000', '#000008', '#000510', '#020018'],
        skyStops: [0, 0.3, 0.65, 1.0],
        winColors: ['#aa00ff', '#ff00ff', '#ffffff', '#00aaff'],
        gridColor: 'rgba(170, 0, 255, 0.18)',
        gridColor2: 'rgba(255, 0, 255, 0.10)',
        laserColor: '#cc00ff',
        fogColor: 'rgba(80, 0, 120, 0.28)',
        moonColor: '#cc44ff',
        baseBpm: 170,
        speedModifier: 2.2,   // velocidad máxima
        xpRequired: 999,
        secret: true          // se desbloquea al completar D3
    }
};

// --- CALIBRACIÓN DE DIFICULTADES — cada una ancla a su distrito ---
const DIFFICULTIES = {
    easy:   { baseSpeed: 3.5,  acceleration: 0.0010, district: 1 },
    normal: { baseSpeed: 5.2,  acceleration: 0.0022, district: 2 },
    hard:   { baseSpeed: 7.5,  acceleration: 0.0045, district: 3 }
};

// Estado de desbloqueo del D4
let d4Unlocked = false;

// --- DECLARACIÓN DE VARIABLES DE ESTADO ---
let chosenDifficulty = 'normal';
let wallet = 0;
let currentDistrict = 2;
let playerXP = 0;
let districtTransitionTimer = 0;
let districtTimer = 0;          // frames en el distrito actual → transición a los 40s
const DISTRICT_DURATION = 3600; // 60s × 60fps
let gameActive = false;
let gamePaused = false;         // sistema de pausa
let gameSpeed = 5.2;

let floorY = 0;
let horizonY = 0;
let activeCharacter = 'human';
let hasShield = false;
let dataCombo = 0;
let scoreMultiplier = 1;
let score = 0;
let distanceTraveled = 0;
let coinsCollected = 0;
const gravity = 0.75;

// Sin sistema de vidas — muerte directa al primer golpe

// Evento aleatorio activo
let activeEvent = null;       // { type, timer, label, color }
let eventTimer = 0;
const EVENT_DURATION = 600;   // 10s por evento (60fps)

// Impact puffs al aterrizar
let impactPuffs = [];

// Árbol de habilidades
let skillTree = {
    // Nodo raíz → se desbloquean según nivel de wallet gastado
    empSkill:  { level: 0, maxLevel: 1, cost: [80],                  label: 'PULSO EMP',    desc: 'Desbloquea el Pulso EMP permanentemente' },
    coinBonus: { level: 0, maxLevel: 5, cost: [60,140,280,560,1000], label: 'RECOLECTOR',   desc: 'Monedas valen +10% por nivel' },
    comboLen:  { level: 0, maxLevel: 3, cost: [80,200,450],          label: 'COMBO RÁPIDO', desc: 'Requiere 1 moneda menos para combo' },
    shieldCD:  { level: 0, maxLevel: 3, cost: [100,220,480],         label: 'ESCUDO PLUS',  desc: 'Escudo se regenera entre runs' },
    magRange:  { level: 0, maxLevel: 3, cost: [90,200,420],          label: 'IMÁN RANGO',   desc: 'Radio del imán +50px por nivel' },
    xpBonus:   { level: 0, maxLevel: 4, cost: [70,160,340,700],      label: 'HACKEADOR',    desc: 'XP ganada +15% por nivel' },
};

// Logros
// Records locales — top 5 runs
let localRecords = [];

// Modo desafío semanal
let weeklyChallenge = null;
let weeklyScore = 0;

// Variables para logros en partida
let noDmgDistance = 0;

// --- ESTADÍSTICAS PERSISTENTES ---
let runStats = {
    bestScore: 0, bestDistance: 0, totalRuns: 0,
    bestCombo: 0, bestNoDmgDist: 0,
    chipsCollected: 0, weeklyClear: 0
};

let player = null; 
let obstacles = []; 
let coins = []; 
let particles = []; 
let floatingTexts = []; 
let powerups = [];
let collectibles = [];
let chips = [];        // coleccionables de chips secretos
let fireballs = [];    // bolas de fuego del Pyro
let spawnTimer = 0; 
let glitchEffectTimer = 0;
let adrenalineActive = false; 
let adrenalineTimer = 0;
let buildings = []; 
let floorGrid = null;

let upgrades = {
    emp: {
        level: 1,
        cost: 60,          // era 20 — más caro desde el inicio
        chargeTime: 30
    },
    magnet: {
        level: 1,
        cost: 80,          // era 30
        duration: 300
    },
    invuln: {
        level: 1,
        cost: 100,         // era 40
        duration: 180
    }
};

// Estado del EMP en partida
let empReady = true;
let empCooldown = 0;
let empCharging = false;
let empChargeTimer = 0;
const EMP_COOLDOWN_FRAMES = 300;

// Estado del imán en partida
let magnetActive = false;
let magnetTimer   = 0;

// Estado de invulnerabilidad en partida
let invulnActive = false;
let invulnTimer  = 0;

// Revivir
let canRevive = false;
let tutorialSeen = false;  // se setea true tras ver el tutorial una vez
// Cada uno tiene: costo, habilidad pasiva, descripción
const CHAR_DEFS = {
    human:     { cost: 0,    label: 'HUMANO',    trait: 'Combo x3 rápido',              ability: 'fast_combo',   color: '#00ffff' },
    slime:     { cost: 80,   label: 'CAZADOR',   trait: 'Dash + rebote de pared',        ability: 'wall_bounce',  color: '#39ff14' },
    skeleton:  { cost: 150,  label: 'ANDROIDE',  trait: 'Escudo inicial',                ability: 'start_shield', color: '#aaddff' },
    specter:   { cost: 280,  label: 'ESPECTRO',  trait: 'Doble salto',                  ability: 'double_jump',  color: '#cc88ff' },
    pyro:      { cost: 420,  label: 'PYRO',      trait: 'Lanza bolas de fuego cada 7s', ability: 'fireball',     color: '#ff6600' },
    netrunner: { cost: 580,  label: 'NETRUNNER', trait: 'Monedas valen x2',             ability: 'double_coins', color: '#ffdd00' },
    titan:     { cost: 750,  label: 'TITAN',     trait: 'Destruye 3 obstáculos/run',    ability: 'smash',        color: '#aaaaaa' },
    ghost:     { cost: 950,  label: 'GHOST',     trait: 'Phase cada 7s',                ability: 'phase',        color: '#eeeeff' }
};

let characters = {
    human:     { unlocked: true  },
    slime:     { unlocked: false },
    skeleton:  { unlocked: false },
    specter:   { unlocked: false },
    pyro:      { unlocked: false },
    netrunner: { unlocked: false },
    titan:     { unlocked: false },
    ghost:     { unlocked: false }
};

// Estado de habilidades por personaje que se resetean por partida
let specterJumpsLeft = 1;
let titanSmashLeft   = 3;   // ← 3 smashes por partida
let ghostPhaseLeft   = 0;
let ghostPhaseCooldown = 0;
let pyroShieldActive = false;
let pyroShieldTimer  = 0;
// Pyro fireball
let pyroFireballCooldown = 0;
const PYRO_FIREBALL_CD = 420; // 7s a 60fps

let saveState = {
    wallet: 0,
    empLevel: 1, magnetLevel: 1, invulnLevel: 1,
    unlockedChars: { human:true, slime:false, skeleton:false, specter:false, pyro:false, netrunner:false, titan:false, ghost:false },
    activeCharacter: 'human',
    runStats: { bestScore:0, bestDistance:0, totalRuns:0, bestCombo:0, bestNoDmgDist:0, chipsCollected:0, weeklyClear:0 },
    empPermanent: false,
    skillTree: {},
    achievements: [],
    localRecords: [],
    weeklyChallenge: null,
    tutorialSeen: false
};

// --- MATRICES PÍXEL DE SPRITES ---
const _ = null; const W = '#ffffff'; const K = '#000000'; const S = '#94a3b8'; 
const R = '#ff0055'; const P = '#ffedd5'; const B = '#00ffff'; const C = '#e2e8f0'; const O = '#ea580c';
const Z = '#39ff14'; const D = '#1e3a1e';

const spriteHuman    = [[_,_,_,_,K,K,K,K],[_,_,_,K,S,B,B,S],[_,_,K,S,K,B,B,K],[_,_,K,S,S,S,S,S],[_,_,K,P,P,P,P,P],[_,_,K,P,K,P,P,K],[_,K,S,K,K,K,K,K],[_,K,S,S,R,S,S,R],[_,K,S,R,R,R,R,R],[_,K,S,S,S,S,S,S],[_,_,K,B,B,B,B,B],[_,_,K,K,K,_,_,K],[_,_,K,S,K,_,_,K],[_,_,K,K,_,_,_,_]];
const spriteZombie   = [[_,_,_,K,K,K,K,_],[_,_,K,Z,Z,K,R,K],[_,K,Z,K,Z,Z,R,K],[_,K,Z,Z,Z,Z,K,_],[_,_,K,D,D,D,K,_],[_,K,K,Z,Z,Z,Z,K],[K,Z,K,K,K,K,K,K],[K,D,K,Z,R,Z,K,R],[K,Z,K,R,R,R,R,K],[_,K,K,D,D,D,D,K],[_,_,K,Z,Z,Z,Z,K],[_,_,K,K,K,_,K,K],[_,_,K,D,K,_,K,D],[_,_,K,K,_,_,K,K]];
const spriteAndroid  = [[_,_,_,_,K,K,K,K],[_,_,_,K,C,C,C,C],[_,_,K,C,K,B,B,K],[_,_,K,C,B,B,B,B],[_,_,K,C,C,C,C,C],[_,_,K,K,K,K,K,K],[_,K,C,K,B,K,K,B],[_,K,C,C,C,C,C,C],[_,K,C,B,B,B,B,B],[_,K,C,C,C,C,C,C],[_,_,K,B,B,B,B,B],[_,_,K,K,K,_,_,K],[_,_,K,C,K,_,_,K],[_,_,K,K,_,_,_,_]];
const spriteDrone    = [[_,_,K,K,_,_,_,_,K,K],[K,K,B,B,K,K,_,K,K,B,B],[_,_,K,K,S,S,K,K,S,S],[_,_,_,K,S,W,S,S,W,S],[_,_,K,S,S,S,R,R,S],[_,_,K,S,R,W,W,R,S],[_,_,_,K,S,S,R,R,S]];

// Espectro — translúcido violeta con corona de energía
const V = '#cc88ff'; const V2 = '#8833cc'; const V3 = '#ff88ff';
const spriteSpecter  = [[_,_,_,V3,V,V,V3,_],[_,_,V,V2,V,V,V2,V],[_,V,V2,K,V3,V3,K,V2],[_,V,V,V3,V,V,V3,V],[_,V,V,V,V,V,V,V],[_,_,V,K,V,V,K,V],[_,V,V2,K,K,K,K,V2],[_,V,V,V,V,V,V,V],[_,V,V,V,V3,V,V,V],[V,V,V,V2,V2,V2,V,V],[_,_,V,V3,V,V,V3,_],[_,_,_,V2,V,V,_,_],[_,_,V,V,V,V,V,_],[_,_,V,_,_,V,V,_]];

// Pyro — rojo/naranja con llamas
const F = '#ff6600'; const F2 = '#ffaa00'; const F3 = '#ff2200';
const spritePyro     = [[_,_,F2,F,F2,F,_,_],[_,F,F2,F,F,F2,F,_],[_,F,K,F3,F3,K,F,_],[_,F,F2,F,F,F2,F,_],[_,_,F3,P,P,F3,_,_],[_,F,F,P,K,P,F,_],[F,F,F,K,K,K,F,F],[F,F3,F,F,F,F,F3,F],[F,F,F3,F,F,F3,F,F],[_,F,F,F,F,F,F,_],[_,_,F3,F,F,F3,_,_],[_,_,F,F,_,F,F,_],[_,F,F,K,_,K,F,_],[_,F,F,_,_,_,F,_]];

// Netrunner — amarillo/morado, gafas holográficas
const N = '#ffdd00'; const N2 = '#9900ff'; const N3 = '#ffff88';
const spriteNetrunner= [[_,_,_,K,K,K,K,_],[_,_,K,N,N,N,N,K],[_,K,N,K,N3,N3,K,N],[_,K,N,N2,N2,N2,N2,N],[_,K,N,N,N,N,N,N],[_,_,K,K,K,K,K,K],[_,K,N,N,N2,N,N2,K],[K,N,K,N,N,N,N,K],[_,K,N2,N,N,N,N2,K],[_,K,N,N,N,N,N,K],[_,_,K,N,N2,N,N,K],[_,_,K,K,K,_,K,K],[_,_,K,N,K,_,K,N],[_,_,K,K,_,_,K,K]];

// Titan — gris/dorado, corpulento
const T = '#888888'; const T2 = '#cccccc'; const T3 = '#ffcc00';
const spriteTitan    = [[_,_,K,K,K,K,K,K],[_,K,T2,T,T,T,T2,K],[K,T2,K,T3,T3,K,T2,K],[K,T,T3,T,T,T3,T,K],[K,T,T,T2,T2,T,T,K],[K,T,K,T,T,K,T,K],[K,T,T,K,K,T,T,K],[K,T2,T,T3,T3,T,T2,K],[K,T,T,T,T,T,T,K],[K,T2,T,T,T,T,T2,K],[_,K,T3,T,T,T3,K,_],[_,K,T,K,_,K,T,K],[_,K,T2,K,_,K,T2,K],[_,K,K,_,_,_,K,K]];

// Ghost — blanco/azul muy claro, etéreo
const G = '#ddeeff'; const G2 = '#aaccff'; const G3 = '#ffffff';
const spriteGhost    = [[_,_,G2,G,G,G2,_,_],[_,G,G3,G,G,G3,G,_],[G,G2,K,G3,G3,K,G2,G],[G,G,G2,G,G,G2,G,G],[G,G,G,G3,G3,G,G,G],[_,G,K,G,G,K,G,_],[_,G2,G,K,K,G,G2,_],[G,G,G2,G,G,G2,G,G],[_,G,G,G,G,G,G,_],[_,G2,G,G,G,G,G2,_],[_,_,G,G3,G,G,_,_],[_,_,G2,K,_,K,G2,_],[_,G,G,_,_,_,G,G],[_,G,_,_,_,_,_,G]];

function drawPixelMatrix(matrix, x, y, pSize) {
    for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
            if (matrix[r][c] !== _) { ctx.fillStyle = matrix[r][c]; ctx.fillRect(x + c * pSize, y + r * pSize, pSize, pSize); }
        }
    }
}

// ═══════════════════════════════════════════════════════════════
//  CYBERAUDIO v3 — Motor de música cyberpunk con scheduling preciso
//  Web Audio API lookahead scheduler — sin setTimeout drift
//  Tres pistas distintas, una por distrito
// ═══════════════════════════════════════════════════════════════
class CyberAudio {
    constructor() {
        this.ac    = null;   // AudioContext
        this.out   = null;   // masterGain  → destination
        this.rev   = null;   // ConvolverNode (reverb)
        this.dly   = null;   // DelayNode (delay tap)
        this.comp  = null;   // DynamicsCompressor
        this._raf  = null;   // requestAnimationFrame handle
        this._nextBeatTime = 0;
        this._beat = 0;
        this._bpm  = 110;
        this._running = false;
        this._lookahead = 0.1;   // segundos adelante que programamos
        this._scheduleInterval = 0.04; // comprobamos cada 40ms
        this._lastCheck = 0;

        // ── PISTAS POR DISTRITO ─────────────────────────────
        // Cada pista define: bpm, escala (frecuencias base), patrones rítmicos,
        // progresión de acordes, timbre de lead, intensidad.
        this.tracks = {
            1: {  // NEON SLUMS — dark synthwave, Perturbator vibes
                bpm: 108,
                // Am pentatónica baja — oscuro y tenso
                scale:  [55.00, 61.74, 65.41, 73.42, 82.41, 110.00, 123.47, 130.81],
                // Progresión Am - F - C - G (i-VI-III-VII)
                chords: [
                    [55.00, 82.41, 110.00],  // Am
                    [43.65, 65.41, 87.31],   // F
                    [65.41, 98.00, 130.81],  // C
                    [49.00, 73.42, 98.00]    // G
                ],
                // Patrón de bajo: 16 pasos, 1=golpe, 0=silencio, 2=octava baja
                bassPattern:  [2,0,0,0, 1,0,0,1, 2,0,1,0, 1,0,0,1],
                // Kick: cada 4 pulsos + variación
                kickPattern:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,1,0],
                snarePattern: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,1],
                hatPattern:   [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
                // Melodía: offset en semitonos desde raíz del acorde
                melody:  [0,0,3,0, 7,0,3,0, 5,0,3,7, 0,0,-2,0],
                leadType: 'sawtooth',
                leadFilter: 900,  // cutoff del filtro lead
                padGain: 0.018,
                color: '#ff0055'
            },
            2: {  // CORPORATE CORE — electro futurista, Carpenter Brut vibes
                bpm: 128,
                // Dm dorian — más tenso y cromático
                scale:  [73.42, 82.41, 87.31, 98.00, 110.00, 123.47, 130.81, 146.83],
                chords: [
                    [73.42, 110.00, 146.83],  // Dm
                    [58.27, 87.31, 116.54],   // Bb
                    [65.41, 98.00, 130.81],   // C
                    [55.00, 82.41, 110.00]    // Am
                ],
                bassPattern:  [2,0,1,0, 2,0,0,1, 2,0,1,0, 2,1,0,1],
                kickPattern:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,1],
                snarePattern: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,1,1,0],
                hatPattern:   [1,0,1,0, 1,0,1,1, 1,0,1,0, 1,1,1,0],
                melody:  [0,0,5,0, 3,5,7,0, 0,0,5,3, 7,5,3,0],
                leadType: 'square',
                leadFilter: 1400,
                padGain: 0.015,
                color: '#00ffff'
            },
            3: {  // THE BLACK ICE — industrial agresivo, rápido
                bpm: 148,
                scale:  [82.41, 87.31, 98.00, 103.83, 116.54, 123.47, 138.59, 164.81],
                chords: [
                    [82.41, 116.54, 164.81],
                    [61.74, 98.00, 123.47],
                    [73.42, 110.00, 146.83],
                    [77.78, 116.54, 155.56]
                ],
                bassPattern:  [2,0,2,0, 1,0,2,1, 2,0,1,0, 2,1,0,2],
                kickPattern:  [1,0,0,1, 1,0,0,0, 1,0,1,0, 1,0,0,1],
                snarePattern: [0,0,1,0, 0,1,1,0, 0,0,1,0, 0,0,1,1],
                hatPattern:   [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
                melody:  [0,7,0,5, 3,0,7,5, 0,3,5,0, 7,5,3,7],
                leadType: 'sawtooth', leadFilter: 1800, padGain: 0.012, color: '#ff2200'
            },
            4: {  // VOID PROTOCOL — velocidad máxima, hyper-industrial
                bpm: 178,
                scale:  [55.00, 61.74, 77.78, 82.41, 103.83, 116.54, 155.56, 164.81],
                chords: [
                    [55.00, 87.31, 138.59],
                    [61.74, 103.83, 155.56],
                    [73.42, 116.54, 174.61],
                    [82.41, 130.81, 207.65]
                ],
                bassPattern:  [2,1,0,1, 2,0,1,2, 1,0,2,1, 2,1,2,0],
                kickPattern:  [1,0,1,0, 1,0,0,1, 1,1,0,0, 1,0,1,1],
                snarePattern: [0,1,1,0, 0,0,1,0, 1,0,1,0, 0,1,1,0],
                hatPattern:   [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
                melody:  [0,5,3,7, 5,3,0,7, 3,5,7,0, 7,3,5,3],
                leadType: 'sawtooth', leadFilter: 2400, padGain: 0.022, color: '#cc00ff'
            }
        };
    }

    // ── CADENA DE EFECTOS ──────────────────────────────────
    _buildChain() {
        const ac = this.ac;

        // Compresor master
        this.comp = ac.createDynamicsCompressor();
        this.comp.threshold.value = -18;
        this.comp.knee.value      = 12;
        this.comp.ratio.value     = 4;
        this.comp.attack.value    = 0.003;
        this.comp.release.value   = 0.15;

        // Master gain
        this.out = ac.createGain();
        this.out.gain.value = 0.82;

        // Reverb (IR sintético)
        this.rev = ac.createConvolver();
        const sr = ac.sampleRate, len = sr * 2.2;
        const buf = ac.createBuffer(2, len, sr);
        for (let c = 0; c < 2; c++) {
            const ch = buf.getChannelData(c);
            for (let i = 0; i < len; i++) ch[i] = (Math.random()*2-1) * Math.pow(1 - i/len, 2.8);
        }
        this.rev.buffer = buf;

        // Delay tap (stereo feel)
        this.dly = ac.createDelay(0.5);
        this.dly.delayTime.value = 0.0;   // se ajusta al bpm en init
        const dlyGain = ac.createGain(); dlyGain.gain.value = 0.22;
        const dlyFilt = ac.createBiquadFilter(); dlyFilt.type = 'highpass'; dlyFilt.frequency.value = 600;

        // Reverb gain (wet send)
        const revGain = ac.createGain(); revGain.gain.value = 0.28;

        // Cadena: out → comp → destination
        //         out → revGain → rev → comp
        //         out → dly → dlyFilt → dlyGain → comp
        this.out.connect(this.comp);
        this.out.connect(revGain);
        revGain.connect(this.rev);
        this.rev.connect(this.comp);
        this.out.connect(this.dly);
        this.dly.connect(dlyFilt);
        dlyFilt.connect(dlyGain);
        dlyGain.connect(this.comp);
        this.comp.connect(ac.destination);
    }

    // ── OSCILADOR RÁPIDO ───────────────────────────────────
    _osc(type, freq, gain, dur, t, detune = 0, filterHz = 0) {
        const ac  = this.ac;
        const osc = ac.createOscillator();
        const g   = ac.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (detune) osc.detune.setValueAtTime(detune, t);
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        if (filterHz) {
            const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterHz; f.Q.value = 2;
            osc.connect(f); f.connect(g);
        } else {
            osc.connect(g);
        }
        g.connect(this.out);
        osc.start(t); osc.stop(t + dur + 0.01);
        osc.onended = () => { try { osc.disconnect(); g.disconnect(); } catch(e){} };
    }

    // ── RUIDO ──────────────────────────────────────────────
    _noise(gain, dur, t, loF, hiF) {
        const ac  = this.ac;
        const sr  = ac.sampleRate;
        const len = Math.ceil(sr * Math.max(dur, 0.01)) + 4;
        const buf = ac.createBuffer(1, len, sr);
        const d   = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random()*2-1;
        const src = ac.createBufferSource(); src.buffer = buf;
        const g   = ac.createGain();
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        const filt = ac.createBiquadFilter();
        if (loF) {
            filt.type = 'bandpass';
            filt.frequency.value = (loF + hiF) / 2;
            filt.Q.value = 0.8;
        } else {
            filt.type = 'highpass';
            filt.frequency.value = hiF || 8000;
        }
        src.connect(filt); filt.connect(g); g.connect(this.out);
        try { src.start(t); src.stop(t + dur + 0.01); } catch(e) {}
        src.onended = () => { try { src.disconnect(); filt.disconnect(); g.disconnect(); } catch(e){} };
    }

    // ── PROGRAMADOR DE BEATS (lookahead scheduling) ────────
    _schedule(timestamp) {
        if (!this._running) return;
        if (timestamp - this._lastCheck < this._scheduleInterval * 1000) {
            this._raf = requestAnimationFrame(ts => this._schedule(ts));
            return;
        }
        this._lastCheck = timestamp;

        const ahead = this.ac.currentTime + this._lookahead;
        while (this._nextBeatTime < ahead) {
            this._scheduleBeat(this._nextBeatTime);
            this._beat++;
            const spd = Math.min(gameSpeed, 18);
            const dynamicBpm = this._bpm + spd * 0.6 + (adrenalineActive ? 18 : 0);
            this._nextBeatTime += 60 / (dynamicBpm * 4); // paso = 1 semi-corchea
        }

        this._raf = requestAnimationFrame(ts => this._schedule(ts));
    }

    // ── UN BEAT ────────────────────────────────────────────
    _scheduleBeat(t) {
        const track = this.tracks[currentDistrict] || this.tracks[1];
        const step  = this._beat % 16;                        // 0-15 dentro del compás
        const chord = track.chords[Math.floor(this._beat / 16) % track.chords.length];
        const bLen  = 60 / (this._bpm * 4);                  // duración de una semicorchea

        // ── KICK ──────────────────────────────────────────
        if (track.kickPattern[step]) {
            const vel = step === 0 ? 0.55 : 0.40;
            const kFreq = currentDistrict === 3 ? 175 : 145;
            const ko = this.ac.createOscillator(); const kg = this.ac.createGain();
            ko.type = 'sine';
            ko.frequency.setValueAtTime(kFreq, t);
            ko.frequency.exponentialRampToValueAtTime(0.01, t + 0.14);
            kg.gain.setValueAtTime(vel, t);
            kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
            ko.connect(kg); kg.connect(this.comp);
            ko.start(t); ko.stop(t + 0.15);
            ko.onended = () => { try{ko.disconnect();kg.disconnect();}catch(e){} };
            // Click de ataque
            this._osc('square', 90, 0.06, 0.015, t);
        }

        // ── SNARE ─────────────────────────────────────────
        if (track.snarePattern[step]) {
            const vel = step === 15 ? 0.07 : 0.13;  // ghost en step 15
            this._noise(vel, 0.09, t, 1400, 2800);
            this._osc('triangle', 185, 0.045, 0.06, t);
        }

        // ── HI-HAT ────────────────────────────────────────
        if (track.hatPattern[step]) {
            const open = step % 4 === 3;
            this._noise(open ? 0.028 : 0.018, open ? 0.12 : 0.04, t, 0, 9000);
        }

        // ── BAJO ──────────────────────────────────────────
        if (track.bassPattern[step]) {
            const root   = chord[0];
            const freq   = track.bassPattern[step] === 2 ? root * 0.5 : root;
            const bDur   = bLen * (track.bassPattern[step] === 2 ? 3.2 : 1.8);
            // Sub sine
            this._osc('sine', freq * 0.5, adrenalineActive ? 0.22 : 0.16, bDur, t);
            // Sawtooth filtrado
            const isJump = player && !player.isGrounded;
            this._osc('sawtooth', freq, adrenalineActive ? 0.13 : 0.09, bDur, t, 0,
                       isJump ? 1100 : 520);
        }

        // ── MELODÍA LEAD (cada 2 semicorcheas) ───────────
        if (step % 2 === 0) {
            const melSemi = track.melody[step % track.melody.length];
            const root    = chord[1];
            const mFreq   = root * Math.pow(2, melSemi / 12);
            const mDur    = bLen * 1.6;
            const mGain   = adrenalineActive ? 0.072 : 0.048;
            this._osc(track.leadType, mFreq, mGain, mDur, t, 0, track.leadFilter);
            // Chorus voice
            if (scoreMultiplier > 1 || adrenalineActive) {
                this._osc(track.leadType, mFreq, mGain * 0.35, mDur, t, 12, track.leadFilter);
            }
        }

        // ── PAD AMBIENTAL (primer beat del compás) ────────
        if (step === 0) {
            const padDur = bLen * 16; // dura todo el compás
            chord.forEach((f, i) => {
                const po = this.ac.createOscillator(); const pg = this.ac.createGain();
                po.type = 'sine';
                po.frequency.setValueAtTime(f * 2, t);
                po.detune.setValueAtTime((i - 1) * 6, t);
                pg.gain.setValueAtTime(0, t);
                pg.gain.linearRampToValueAtTime(track.padGain, t + 0.4);
                pg.gain.setValueAtTime(track.padGain, t + padDur - 0.4);
                pg.gain.exponentialRampToValueAtTime(0.0001, t + padDur);
                po.connect(pg); pg.connect(this.rev);
                po.start(t); po.stop(t + padDur + 0.05);
                po.onended = () => { try{po.disconnect();pg.disconnect();}catch(e){} };
            });
        }

        // ── ACENTO DE ADRENALINA ──────────────────────────
        if (adrenalineActive && step % 4 === 0) {
            this._osc('square', chord[2] * 2, 0.06, bLen * 0.5, t, 0, 2400);
        }

        // ── ACTUALIZAR INDICADOR ──────────────────────────
        if (step === 0 && audioIndicator) {
            const spd = Math.min(gameSpeed, 18);
            const liveBpm = Math.floor(this._bpm + spd * 0.6 + (adrenalineActive ? 18 : 0));
            const dName   = (DISTRICTS[currentDistrict] || DISTRICTS[1]).name;
            audioIndicator.innerText = `◈ ${dName} — ${liveBpm} BPM`;
        }
    }

    // ── API PÚBLICA ────────────────────────────────────────
    init() {
        try {
            if (!this.ac) {
                this.ac = new (window.AudioContext || window.webkitAudioContext)();
                this._buildChain();
            }
            // Reanudar siempre — el navegador lo suspende si no hay gesto reciente
            const resume = this.ac.state === 'suspended'
                ? this.ac.resume()
                : Promise.resolve();
            resume.then(() => {
                this.stop();
                this._beat  = 0;
                this._running = true;
                const track = this.tracks[currentDistrict] || this.tracks[1];
                this._bpm   = track.bpm;
                if (this.dly) this.dly.delayTime.value = (60 / this._bpm) * 0.75;
                this._nextBeatTime = this.ac.currentTime + 0.08;
                this._lastCheck    = 0;
                this._raf = requestAnimationFrame(ts => this._schedule(ts));
            });
        } catch(e) {
            console.warn('Audio init failed:', e);
        }
    }

    stop() {
        this._running = false;
        if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
        // Fade out suave en lugar de corte abrupto
        if (this.out && this.ac) {
            const now = this.ac.currentTime;
            this.out.gain.setValueAtTime(this.out.gain.value, now);
            this.out.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
            setTimeout(() => { if (this.out) this.out.gain.value = 0.82; }, 400);
        }
    }

    // ── SFX ────────────────────────────────────────────────
    playSFX(type) {
        if (!this.ac || this.ac.state === 'suspended') return;
        const t = this.ac.currentTime;
        if (type === 'jump') {
            this._osc('triangle', 200, 0.18, 0.12, t);
            this._osc('triangle', 400, 0.08, 0.08, t + 0.04);
        } else if (type === 'coin') {
            [700, 900, 1200].forEach((f, i) => this._osc('sine', f, 0.08, 0.10, t + i*0.04));
        } else if (type === 'hit') {
            this._osc('sawtooth', 180, 0.30, 0.45, t, 0, 800);
            this._noise(0.32, 0.08, t, 800, 2000);
        } else if (type === 'levelup') {
            [300, 400, 600, 800, 1200].forEach((f, i) => this._osc('sine', f, 0.18, 0.20, t + i*0.07));
        } else if (type === 'powerup') {
            this._osc('square', 200, 0.14, 0.30, t, 0, 1200);
            this._osc('square', 400, 0.08, 0.20, t + 0.08, 0, 1200);
            this._osc('square', 600, 0.06, 0.15, t + 0.16, 0, 1200);
        }
    }
}
const snd = new CyberAudio();

// --- PERSISTENCIA LOCALSTORAGE ---
function saveGameToBrowser() {
    saveState.wallet = wallet;
    saveState.empLevel = upgrades.emp.level;
    saveState.magnetLevel = upgrades.magnet.level;
    saveState.invulnLevel = upgrades.invuln.level;
    saveState.activeCharacter = activeCharacter;
    const uc = {}; Object.keys(characters).forEach(k => uc[k] = characters[k].unlocked);
    saveState.unlockedChars = uc;
    saveState.runStats = { ...runStats, chipsCollected: runStats.chipsCollected || 0 };
    saveState.tutorialSeen = tutorialSeen;
    saveState.d4Unlocked = d4Unlocked;
    // Skill tree levels
    const st = {}; Object.keys(skillTree).forEach(k => st[k] = skillTree[k].level);
    saveState.skillTree = st;
    // Achievements unlocked ids
    saveState.achievements = ACHIEVEMENTS.filter(a => a.unlocked).map(a => a.id);
    saveState.localRecords = localRecords;
    saveState.weeklyChallenge = weeklyChallenge;
    localStorage.setItem('cyberrunner_browser_save', JSON.stringify(saveState));
}

function loadGameFromBrowser() {
    const rawData = localStorage.getItem('cyberrunner_browser_save');
    if (rawData) {
        try {
            const loaded = JSON.parse(rawData);
            wallet = loaded.wallet || 0;
            if (loaded.empLevel) {
                upgrades.emp.level = loaded.empLevel;
                upgrades.emp.chargeTime = Math.max(10, 30 - (upgrades.emp.level-1)*4);
                upgrades.emp.cost = Math.floor(60 * Math.pow(2.2, upgrades.emp.level-1));
            }
            if (loaded.magnetLevel) {
                upgrades.magnet.level = loaded.magnetLevel;
                upgrades.magnet.duration = 300 + (upgrades.magnet.level-1)*60;
                upgrades.magnet.cost = Math.floor(80 * Math.pow(2.0, upgrades.magnet.level-1));
            }
            if (loaded.invulnLevel) {
                upgrades.invuln.level = loaded.invulnLevel;
                upgrades.invuln.duration = 180 + (upgrades.invuln.level-1)*60;
                upgrades.invuln.cost = Math.floor(100 * Math.pow(2.0, upgrades.invuln.level-1));
            }
            activeCharacter = loaded.activeCharacter || 'human';
            if (loaded.unlockedChars) {
                Object.keys(characters).forEach(k => {
                    if (loaded.unlockedChars[k] !== undefined) characters[k].unlocked = loaded.unlockedChars[k];
                });
            }
            if (loaded.runStats) {
                runStats = { ...runStats, ...loaded.runStats };
                runStats.chipsCollected = loaded.runStats.chipsCollected || 0;
            }
            if (loaded.tutorialSeen) tutorialSeen = true;
            if (loaded.d4Unlocked) d4Unlocked = true;
            if (loaded.skillTree) {
                Object.keys(loaded.skillTree).forEach(k => {
                    if (skillTree[k]) skillTree[k].level = loaded.skillTree[k] || 0;
                });
            }
            if (loaded.achievements) {
                ACHIEVEMENTS.forEach(a => { if (loaded.achievements.includes(a.id)) a.unlocked = true; });
            }
            if (loaded.localRecords) localRecords = loaded.localRecords;
            if (loaded.weeklyChallenge) weeklyChallenge = loaded.weeklyChallenge;
        } catch(e) { console.error('Error cargando save.'); }
    }
    // Generar/verificar desafío semanal
    initWeeklyChallenge();
}

// ════════════════════════════════════════════════════════════════
//  SISTEMA DE CINEMÁTICA + TUTORIAL
// ════════════════════════════════════════════════════════════════
const CINEMATIC = {
    phase: 'idle',  // 'intro' | 'tutorial' | 'done' | 'idle'
    frame: 0,
    slide: 0,
    typeIndex: 0,
    lastType: 0,

    // ── LÍNEAS DE INTRO ──────────────────────────────────────
    introLines: [
        { text: '> DEEP NETWORK OS v4.2.1', color: '#00ffff', delay: 0 },
        { text: '> INICIALIZANDO CONEXIÓN...', color: '#00ff88', delay: 40 },
        { text: '> USUARIO DETECTADO: RAFA', color: '#00ffff', delay: 80 },
        { text: '> ACCESO CONCEDIDO', color: '#00ff88', delay: 120 },
        { text: '', delay: 160 },
        { text: '  La red está infestada de guardianes.', color: '#ffffff', delay: 180 },
        { text: '  Esquiva, corre, sobrevive.', color: '#ffffff', delay: 220 },
        { text: '  Llega al núcleo o muere en el intento.', color: '#ff0055', delay: 260 },
    ],

    // ── SLIDES DE TUTORIAL ────────────────────────────────────
    slides: [
        {
            title: 'CONTROLES',
            lines: ['▲ SALTAR — Tecla arriba / Espacio / Botón ▲', '▼ AGACHARSE — Tecla abajo / Botón ▼', '   Mantén agachado 0.5s para activar EMP'],
            demoType: 'jump'
        },
        {
            title: 'OBSTÁCULOS',
            lines: ['CONO / BARRIL / BOLSA — Saltar encima', 'DRON — Agacharse para esquivar', 'LÁSER — Saltar o agacharse (solo D3)'],
            demoType: 'obstacles'
        },
        {
            title: 'COLECCIONABLES',
            lines: ['◈  MONEDAS — Acumulan créditos y combo', '◎  IMÁN — Atrae monedas automáticamente', '✦  INVULN — Sin daño por unos segundos', '⚡  ADRENALINA — Velocidad extrema'],
            demoType: 'collectibles'
        },
        {
            title: 'AGENTES',
            lines: ['Cada personaje tiene una habilidad única:', 'ESPECTRO → Doble salto en el aire', 'PYRO → Heat shield al agacharse', 'TITAN → Destruye 1 obstáculo por partida', 'GHOST → Atraviesa obstáculos cada 10s'],
            demoType: 'agents'
        }
    ],

    // Objetos animados en el tutorial
    demoObjs: [],
    demoPlayer: { x: 0, y: 0, vy: 0, grounded: true, frame: 0 },

    start() {
        this.phase = 'intro'; this.frame = 0; this.typeIndex = 0; this.lastType = 0;
        if (difficultyScreen) difficultyScreen.classList.add('hidden');
        const skipBtn = document.getElementById('cinematic-skip-btn');
        if (skipBtn) skipBtn.classList.remove('hidden');
    },

    skip() {
        tutorialSeen = true; saveGameToBrowser();
        this.phase = 'done';
        if (difficultyScreen) difficultyScreen.classList.remove('hidden');
        const skipBtn = document.getElementById('cinematic-skip-btn');
        if (skipBtn) skipBtn.classList.add('hidden');
    },

    nextSlide() {
        this.slide++;
        if (this.slide >= this.slides.length) { this.skip(); }
        else { this.frame = 0; this.demoObjs = []; }
    },

    update() {
        this.frame++;
        if (this.phase === 'intro') {
            // Avanzar el tipeo de texto
            if (this.frame - this.lastType > 2) { this.typeIndex++; this.lastType = this.frame; }
            // Comprobar si podemos pasar al tutorial
            const lastLine = this.introLines[this.introLines.length - 1];
            const allShown = this.frame > lastLine.delay + this.introLines[this.introLines.length-1].text.length * 2 + 80;
            if (allShown && this.frame > lastLine.delay + 120) {
                this.phase = 'tutorial'; this.slide = 0; this.frame = 0; this.demoObjs = [];
            }
        } else if (this.phase === 'tutorial') {
            // Animar el demo player
            const dp = this.demoPlayer;
            const slide = this.slides[this.slide];
            dp.frame++;
            if (slide.demoType === 'jump') {
                // Ciclo: esperar → saltar → aterrizar
                if (dp.grounded && dp.frame % 90 === 40) { dp.vy = -10; dp.grounded = false; }
                dp.vy += 0.5; dp.y += dp.vy;
                if (dp.y >= 0) { dp.y = 0; dp.vy = 0; dp.grounded = true; }
            }
            // Mover objetos de demo
            this.demoObjs.forEach(o => { o.x -= 2.5; });
            this.demoObjs = this.demoObjs.filter(o => o.x > -40);
            if (slide.demoType === 'obstacles' && this.frame % 80 === 0) {
                const types = ['cone','barrel','trash_bag','drone'];
                this.demoObjs.push({ type: types[Math.floor(Math.random()*types.length)], x: canvas.width*0.8, y: 0 });
            }
            if (slide.demoType === 'collectibles' && this.frame % 60 === 0) {
                const types = ['coin','magnet','invuln','adrenaline'];
                this.demoObjs.push({ type: types[Math.floor(this.frame/60)%types.length], x: canvas.width*0.8, y: Math.random()*30 - 40 });
            }
        }
    },

    draw() {
        if (this.phase === 'idle' || this.phase === 'done') return;
        const CW = canvas.width, CH = canvas.height;
        const scale = Math.min(CW/800, CH/450, 1.4);

        // Fondo oscuro con gradiente
        ctx.fillStyle = 'rgba(2,3,8,0.96)';
        ctx.fillRect(0,0,CW,CH);
        // Scanlines
        ctx.fillStyle = 'rgba(0,255,255,0.015)';
        for (let y=0; y<CH; y+=4) ctx.fillRect(0,y,CW,2);

        if (this.phase === 'intro') this._drawIntro(CW,CH,scale);
        else if (this.phase === 'tutorial') this._drawTutorial(CW,CH,scale);

        // SKIP siempre visible
        ctx.save();
        ctx.font = `${Math.round(10*scale)}px 'Share Tech Mono', monospace`;
        ctx.fillStyle = 'rgba(0,255,255,0.4)';
        ctx.textAlign = 'right';
        ctx.fillText('[ PULSA ESPACIO / TAP PARA SALTAR ▶ ]', CW - 20*scale, CH - 16*scale);
        ctx.textAlign = 'left'; ctx.restore();
    },

    _drawIntro(CW, CH, scale) {
        const fs = Math.round(14*scale);
        const lh = fs + 8*scale;
        let startY = CH*0.25;
        // Logo
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = `bold ${Math.round(28*scale)}px 'Share Tech Mono', monospace`;
        ctx.shadowBlur = 20; ctx.shadowColor = '#ff0055';
        ctx.fillStyle = '#ff0055';
        ctx.fillText('CYBERRUN.EXE', CW/2, CH*0.14);
        ctx.shadowBlur = 0; ctx.textAlign = 'left';

        ctx.font = `${fs}px 'Share Tech Mono', monospace`;
        let charsDone = 0;
        this.introLines.forEach((line, i) => {
            if (this.frame < line.delay) return;
            const charsSinceDelay = Math.min(this.frame - line.delay, line.text.length);
            const visible = line.text.slice(0, charsSinceDelay);
            ctx.fillStyle = line.color || '#00ffff';
            ctx.fillText(visible, CW*0.12, startY + i*lh);
            // Cursor parpadeante en la última línea activa
            if (i === this.introLines.filter(l=>this.frame>=l.delay).length-1 && this.frame%20<10) {
                ctx.fillStyle = '#00ffff';
                ctx.fillText('█', CW*0.12 + ctx.measureText(visible).width + 2, startY + i*lh);
            }
        });
        ctx.restore();
    },

    _drawTutorial(CW, CH, scale) {
        const slide = this.slides[this.slide];
        const fs = Math.round(12*scale);
        const lh = fs + 7*scale;

        // Título
        ctx.save();
        ctx.font = `bold ${Math.round(20*scale)}px 'Share Tech Mono', monospace`;
        ctx.fillStyle = '#00ffff'; ctx.shadowBlur = 12; ctx.shadowColor = '#00ffff';
        ctx.textAlign = 'center';
        ctx.fillText(`[ ${slide.title} ]`, CW/2, CH*0.12);
        ctx.shadowBlur = 0; ctx.textAlign = 'left';

        // Líneas de texto con aparición progresiva
        const linesPerFrame = 40;
        slide.lines.forEach((line, i) => {
            if (this.frame < i * linesPerFrame) return;
            ctx.font = `${fs}px 'Share Tech Mono', monospace`;
            ctx.fillStyle = line.startsWith('  ') ? 'rgba(255,255,255,0.55)' : '#ffffff';
            ctx.fillText(line, CW*0.08, CH*0.28 + i*lh);
        });

        // Área de demo (mitad derecha / inferior)
        const demoX = CW * 0.55, demoY = CH * 0.55, demoW = CW * 0.38, demoH = CH * 0.32;
        ctx.strokeStyle = 'rgba(0,255,255,0.2)'; ctx.lineWidth = 1;
        ctx.strokeRect(demoX, demoY - demoH, demoW, demoH);
        ctx.fillStyle = 'rgba(0,255,255,0.03)';
        ctx.fillRect(demoX, demoY - demoH, demoW, demoH);
        // Suelo del demo
        ctx.fillStyle = 'rgba(0,255,255,0.3)';
        ctx.fillRect(demoX, demoY, demoW, 2);

        // Dibujar player de demo
        const dp = this.demoPlayer;
        const dpX = demoX + demoW*0.25, dpY = demoY + dp.y - 28;
        ctx.fillStyle = '#00ffff';
        // Cuerpo simple: círculo + líneas
        ctx.beginPath(); ctx.arc(dpX, dpY, 8*scale, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 2*scale;
        ctx.beginPath(); ctx.moveTo(dpX, dpY+8*scale); ctx.lineTo(dpX, dpY+20*scale); ctx.stroke();
        // Piernas animadas
        const legAnim = Math.sin(dp.frame * 0.2) * 8*scale;
        ctx.beginPath(); ctx.moveTo(dpX, dpY+20*scale); ctx.lineTo(dpX-6*scale+legAnim, dpY+32*scale); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(dpX, dpY+20*scale); ctx.lineTo(dpX+6*scale-legAnim, dpY+32*scale); ctx.stroke();

        // Objetos de demo
        this.demoObjs.forEach(o => {
            const ox = demoX + (o.x - CW*0.8 + demoW*0.8);
            const oy = demoY + (o.y || 0);
            ctx.save();
            if (o.type==='coin') {
                ctx.strokeStyle='#00ffff'; ctx.lineWidth=1.5; ctx.shadowBlur=6; ctx.shadowColor='#00ffff';
                ctx.beginPath(); ctx.arc(ox,-20+oy,7*scale,0,Math.PI*2); ctx.stroke();
                ctx.fillStyle='rgba(0,255,255,0.2)'; ctx.fill();
            } else if (o.type==='magnet') {
                ctx.fillStyle='#004488'; ctx.beginPath(); ctx.arc(ox,-20+oy,8*scale,0,Math.PI*2); ctx.fill();
                ctx.strokeStyle='#00ccff'; ctx.lineWidth=1.5; ctx.stroke();
                ctx.fillStyle='#00ccff'; ctx.font=`${Math.round(10*scale)}px monospace`; ctx.textAlign='center'; ctx.textBaseline='middle';
                ctx.fillText('◎',ox,-20+oy);
            } else if (o.type==='invuln') {
                ctx.fillStyle='#553300'; ctx.beginPath(); ctx.arc(ox,-20+oy,8*scale,0,Math.PI*2); ctx.fill();
                ctx.strokeStyle='#ffaa00'; ctx.lineWidth=1.5; ctx.stroke();
                ctx.fillStyle='#ffaa00'; ctx.font=`${Math.round(10*scale)}px monospace`; ctx.textAlign='center'; ctx.textBaseline='middle';
                ctx.fillText('✦',ox,-20+oy);
            } else if (o.type==='adrenaline') {
                ctx.strokeStyle='#ff00aa'; ctx.lineWidth=1.5; ctx.shadowBlur=6; ctx.shadowColor='#ff00aa';
                ctx.beginPath(); ctx.arc(ox,-20+oy,8*scale,0,Math.PI*2); ctx.stroke();
                ctx.fillStyle='rgba(40,0,30,0.8)'; ctx.fill();
                ctx.fillStyle='#ff88cc'; ctx.font=`${Math.round(10*scale)}px monospace`; ctx.textAlign='center'; ctx.textBaseline='middle';
                ctx.fillText('⚡',ox,-20+oy);
            } else if (o.type==='cone') {
                ctx.fillStyle='#cc4400'; ctx.beginPath(); ctx.moveTo(ox,oy-24*scale); ctx.lineTo(ox+8*scale,oy); ctx.lineTo(ox-8*scale,oy); ctx.closePath(); ctx.fill();
                ctx.fillStyle='rgba(255,220,0,0.85)'; ctx.fillRect(ox-6*scale,oy-14*scale,12*scale,3*scale);
            } else if (o.type==='barrel') {
                ctx.strokeStyle='#00ff88'; ctx.lineWidth=1; ctx.fillStyle='#060e08';
                ctx.beginPath(); ctx.rect(ox-8*scale,oy-22*scale,16*scale,22*scale); ctx.fill(); ctx.stroke();
                [0.3,0.6,0.85].forEach(t=>{ ctx.beginPath(); ctx.moveTo(ox-8*scale,oy-22*scale+22*scale*t); ctx.lineTo(ox+8*scale,oy-22*scale+22*scale*t); ctx.stroke(); });
            } else if (o.type==='drone') {
                ctx.fillStyle='#001122'; ctx.fillRect(ox-12*scale,oy-16*scale,24*scale,10*scale);
                ctx.strokeStyle='#00ffff'; ctx.lineWidth=1; ctx.strokeRect(ox-12*scale,oy-16*scale,24*scale,10*scale);
                ctx.fillStyle='#ff2200'; ctx.beginPath(); ctx.arc(ox,oy-16*scale,3*scale,0,Math.PI*2); ctx.fill();
            } else if (o.type==='trash_bag') {
                ctx.fillStyle='#0c1a10'; ctx.strokeStyle='rgba(0,255,136,0.4)'; ctx.lineWidth=1;
                ctx.beginPath(); ctx.moveTo(ox,oy-18*scale); ctx.quadraticCurveTo(ox+10*scale,oy-22*scale,ox+10*scale,oy); ctx.quadraticCurveTo(ox,oy+3*scale,ox-10*scale,oy); ctx.quadraticCurveTo(ox-10*scale,oy-22*scale,ox,oy-18*scale); ctx.fill(); ctx.stroke();
            }
            ctx.restore();
        });

        // Si es slide de agentes, mostrar mini cards de los 5 especiales
        if (slide.demoType==='agents') {
            const chars2show = ['specter','pyro','titan','ghost','netrunner'];
            chars2show.forEach((ch,i) => {
                const def = CHAR_DEFS[ch];
                const cx2 = CW*0.08 + (i % 3)*(CW*0.28);
                const cy2 = CH*0.72 + Math.floor(i/3)*(lh*2.5);
                ctx.font=`${Math.round(9*scale)}px 'Share Tech Mono', monospace`;
                ctx.fillStyle=def.color; ctx.shadowBlur=4; ctx.shadowColor=def.color;
                ctx.fillText(`${def.label}`, cx2, cy2);
                ctx.shadowBlur=0; ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.font=`${Math.round(8*scale)}px monospace`;
                ctx.fillText(def.trait, cx2, cy2+lh*0.9);
            });
        }

        // Indicador de progreso
        ctx.fillStyle='rgba(0,255,255,0.1)';
        ctx.fillRect(CW*0.08, CH*0.92, CW*0.84, 3*scale);
        ctx.fillStyle='#00ffff'; ctx.shadowBlur=4; ctx.shadowColor='#00ffff';
        ctx.fillRect(CW*0.08, CH*0.92, CW*0.84*((this.slide+1)/this.slides.length), 3*scale);
        ctx.shadowBlur=0;
        ctx.font=`${Math.round(9*scale)}px monospace`; ctx.fillStyle='rgba(0,255,255,0.4)';
        ctx.textAlign='center';
        ctx.fillText(`${this.slide+1} / ${this.slides.length}`, CW/2, CH*0.96);
        ctx.textAlign='left';
        ctx.restore();
    }
};

// ── CONTROLES DE LA CINEMÁTICA ────────────────────────────────
window.addEventListener('keydown', (e) => {
    if (CINEMATIC.phase === 'intro') {
        if (e.code==='Space'||e.code==='Enter'||e.code==='ArrowRight') { CINEMATIC.phase='tutorial'; CINEMATIC.slide=0; CINEMATIC.frame=0; CINEMATIC.demoObjs=[]; }
        if (e.code==='Escape') CINEMATIC.skip();
    } else if (CINEMATIC.phase === 'tutorial') {
        if (e.code==='Space'||e.code==='Enter'||e.code==='ArrowRight') CINEMATIC.nextSlide();
        if (e.code==='Escape') CINEMATIC.skip();
    }
}, true); // capture=true para que se procese antes que los controles del juego

canvas.addEventListener('click', () => {
    if (CINEMATIC.phase==='intro') { CINEMATIC.phase='tutorial'; CINEMATIC.slide=0; CINEMATIC.frame=0; CINEMATIC.demoObjs=[]; }
    else if (CINEMATIC.phase==='tutorial') CINEMATIC.nextSlide();
});

// ════════════════════════════════════════════════════════════════
//  ÁRBOL DE HABILIDADES VISUAL — Canvas 2D con hexágonos
// ════════════════════════════════════════════════════════════════
const SKILL_ICONS = {
    empSkill:  { icon: '⚡', color: '#ffdd00', glow: 'rgba(255,220,0,0.8)',   label: 'PULSO EMP',   shortDesc: 'Desbloquea el EMP para todas las partidas' },
    coinBonus: { icon: '◈',  color: '#00ffff', glow: 'rgba(0,255,255,0.8)',   label: 'RECOLECTOR',  shortDesc: 'Monedas +10% / nivel' },
    comboLen:  { icon: '✦',  color: '#00ff88', glow: 'rgba(0,255,136,0.8)',   label: 'COMBO',       shortDesc: 'Combo 1 menos por nivel' },
    shieldCD:  { icon: '🛡', color: '#aaddff', glow: 'rgba(170,220,255,0.8)', label: 'ESCUDO+',     shortDesc: 'Escudo entre runs' },
    magRange:  { icon: '◎',  color: '#00ccff', glow: 'rgba(0,200,255,0.8)',   label: 'IMÁN',        shortDesc: 'Radio imán +50px / nivel' },
    xpBonus:   { icon: '⬢',  color: '#cc88ff', glow: 'rgba(200,136,255,0.8)', label: 'HACK XP',     shortDesc: 'XP ganada +15% / nivel' },
};

// Árbol piramidal: 1 raíz → 2 ramas → 3 hojas
// Cada nodo tiene posición normalizada [x 0-1, y 0-1]
const SKILL_LAYOUT = {
    empSkill:  { x: 0.50, y: 0.13 },  // RAÍZ — centro arriba
    coinBonus: { x: 0.28, y: 0.45 },  // RAMA izquierda
    comboLen:  { x: 0.72, y: 0.45 },  // RAMA derecha
    shieldCD:  { x: 0.12, y: 0.78 },  // HOJA izquierda
    magRange:  { x: 0.50, y: 0.78 },  // HOJA centro
    xpBonus:   { x: 0.88, y: 0.78 },  // HOJA derecha
};

const SKILL_CONNECTIONS = [
    ['empSkill','coinBonus'],
    ['empSkill','comboLen'],
    ['coinBonus','shieldCD'],
    ['coinBonus','magRange'],
    ['comboLen','magRange'],
    ['comboLen','xpBonus'],
];

let _stClickHandler = null;
let _stHoverKey = null;
let _stPulse = 0;  // animación de glow

function drawSkillTree(stCanvas) {
    const parent = stCanvas.parentElement;
    const W = parent ? (parent.clientWidth  || 440) : 440;
    const H = parent ? (parent.clientHeight || 440) : 440;

    // Resize canvas to fill container
    if (stCanvas.width !== W || stCanvas.height !== H) {
        stCanvas.width  = W;
        stCanvas.height = H;
    }
    const c = stCanvas.getContext('2d');
    c.clearRect(0, 0, W, H);

    _stPulse += 0.025;

    // Tamaño de nodo — ocupa bien el espacio disponible
    const R = Math.min(W * 0.13, H * 0.13, 58);
    const pad = R * 1.1;

    // Área de dibujo dentro del padding
    const areaX = pad, areaY = pad;
    const areaW = W - pad*2, areaH = H - pad*2 - 22; // 22px para footer

    // Posiciones absolutas
    const pos = {};
    Object.entries(SKILL_LAYOUT).forEach(([key, {x, y}]) => {
        pos[key] = { x: areaX + x * areaW, y: areaY + y * areaH };
    });

    // ── FONDO ────────────────────────────────────────────────
    // Gradiente de fondo
    const bgGrad = c.createRadialGradient(W*0.5, H*0.35, 0, W*0.5, H*0.5, W*0.7);
    bgGrad.addColorStop(0, 'rgba(0,8,24,0.98)');
    bgGrad.addColorStop(1, 'rgba(0,2,8,0.98)');
    c.fillStyle = bgGrad;
    c.fillRect(0, 0, W, H);

    // Grid de puntos sutil
    c.save();
    c.fillStyle = 'rgba(0,255,255,0.06)';
    for (let gx = 0; gx < W; gx += 32) {
        for (let gy = 0; gy < H; gy += 32) {
            c.beginPath();
            c.arc(gx, gy, 1, 0, Math.PI*2);
            c.fill();
        }
    }
    c.restore();

    // ── CONEXIONES ───────────────────────────────────────────
    SKILL_CONNECTIONS.forEach(([a, b]) => {
        if (!pos[a] || !pos[b]) return;
        const pa = pos[a], pb = pos[b];
        const na = skillTree[a], nb = skillTree[b];
        const lit = na && nb && na.level > 0 && nb.level > 0;
        const metaA = SKILL_ICONS[a];
        c.save();
        if (lit) {
            // Línea brillante con glow
            c.shadowBlur = 12;
            c.shadowColor = metaA.color;
            c.strokeStyle = metaA.color;
            c.lineWidth = 2.5;
            c.globalAlpha = 0.65 + Math.sin(_stPulse) * 0.15;
        } else {
            c.strokeStyle = 'rgba(0,255,255,0.10)';
            c.lineWidth = 1.5;
            c.setLineDash([6, 6]);
            c.globalAlpha = 0.5;
        }
        c.beginPath();
        c.moveTo(pa.x, pa.y);
        c.lineTo(pb.x, pb.y);
        c.stroke();
        c.restore();

        // Partícula de flujo en líneas activas
        if (lit) {
            const t = (_stPulse * 0.4) % 1;
            const px2 = pa.x + (pb.x - pa.x) * t;
            const py2 = pa.y + (pb.y - pa.y) * t;
            c.save();
            c.fillStyle = metaA.color;
            c.shadowBlur = 8; c.shadowColor = metaA.color;
            c.globalAlpha = 0.8 * Math.sin(t * Math.PI);
            c.beginPath(); c.arc(px2, py2, 3, 0, Math.PI*2); c.fill();
            c.restore();
        }
    });

    // ── NODOS ────────────────────────────────────────────────
    Object.entries(SKILL_LAYOUT).forEach(([key]) => {
        const node = skillTree[key];
        const p    = pos[key];
        const meta = SKILL_ICONS[key];
        if (!node || !p || !meta) return;

        const maxed   = node.level >= node.maxLevel;
        const active  = node.level > 0;
        const canBuy  = !maxed && wallet >= (node.cost[node.level] ?? Infinity);
        const hov     = _stHoverKey === key;
        const pulse   = Math.sin(_stPulse + Object.keys(SKILL_LAYOUT).indexOf(key) * 0.8);

        // Outer halo (sin de tiempo)
        if (canBuy || hov) {
            const haloR = R * (1.4 + pulse * 0.08);
            c.save();
            c.globalAlpha = (hov ? 0.28 : 0.14) + pulse * 0.08;
            const halo = c.createRadialGradient(p.x, p.y, R*0.5, p.x, p.y, haloR);
            halo.addColorStop(0, meta.color);
            halo.addColorStop(1, 'transparent');
            c.fillStyle = halo;
            c.beginPath(); c.arc(p.x, p.y, haloR, 0, Math.PI*2); c.fill();
            c.restore();
        }

        // ── Hexágono ─────────────────────────────────────────
        c.save();
        if (active || hov) {
            c.shadowBlur = hov ? 28 : (maxed ? 22 : 14);
            c.shadowColor = meta.glow;
        }

        // Dibujar hexágono
        const hexPath = () => {
            c.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI/3)*i - Math.PI/6;
                const hx = p.x + R * Math.cos(a);
                const hy = p.y + R * Math.sin(a);
                i===0 ? c.moveTo(hx,hy) : c.lineTo(hx,hy);
            }
            c.closePath();
        };

        // Relleno con gradiente radial
        hexPath();
        const gr = c.createRadialGradient(p.x - R*0.3, p.y - R*0.3, 0, p.x, p.y, R*1.1);
        if (maxed) {
            gr.addColorStop(0, meta.color + 'ff');
            gr.addColorStop(0.45, meta.color + '88');
            gr.addColorStop(1, meta.color + '22');
        } else if (active) {
            gr.addColorStop(0, meta.color + '55');
            gr.addColorStop(0.6, meta.color + '22');
            gr.addColorStop(1, '#010a1e');
        } else if (canBuy) {
            gr.addColorStop(0, 'rgba(0,255,255,0.12)');
            gr.addColorStop(1, '#010a1e');
        } else {
            gr.addColorStop(0, '#0a1228');
            gr.addColorStop(1, '#02040c');
        }
        c.fillStyle = gr;
        c.fill();

        // Borde
        hexPath();
        c.strokeStyle = maxed ? meta.color
            : active   ? meta.color + 'cc'
            : canBuy   ? meta.color + '77'
            : 'rgba(0,255,255,0.18)';
        c.lineWidth = maxed ? 3 : active ? 2 : 1.2;
        c.stroke();
        c.restore();

        // ── Icono ─────────────────────────────────────────────
        c.save();
        const iconSize = Math.round(R * 0.78);
        c.font = `${iconSize}px serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.globalAlpha = maxed ? 1 : active ? 0.95 : canBuy ? 0.55 : 0.22;
        if (active || hov) { c.shadowBlur = 14; c.shadowColor = meta.glow; }
        c.fillStyle = maxed ? '#ffffff' : meta.color;
        c.fillText(meta.icon, p.x, p.y - R * 0.06);
        c.restore();

        // ── Level pips ────────────────────────────────────────
        const pipGap = Math.min(R * 0.3, 14);
        const pipR   = Math.min(R * 0.10, 5);
        const pipY   = p.y + R * 0.55;
        const pipsStartX = p.x - ((node.maxLevel - 1) * pipGap) / 2;
        for (let i = 0; i < node.maxLevel; i++) {
            c.save();
            const filled = i < node.level;
            c.fillStyle = filled ? meta.color : 'rgba(255,255,255,0.12)';
            c.strokeStyle = filled ? meta.color : 'rgba(255,255,255,0.08)';
            c.lineWidth = 1;
            if (filled) { c.shadowBlur = 6; c.shadowColor = meta.color; }
            c.beginPath();
            c.arc(pipsStartX + i * pipGap, pipY, pipR, 0, Math.PI*2);
            c.fill();
            c.restore();
        }

        // ── Nombre ────────────────────────────────────────────
        const nameY = pipY + pipR + 6;
        c.save();
        c.font = `bold ${Math.round(R * 0.27)}px 'Share Tech Mono','Courier New'`;
        c.textAlign = 'center'; c.textBaseline = 'top';
        c.fillStyle = active ? meta.color : 'rgba(255,255,255,0.30)';
        if (active) { c.shadowBlur = 5; c.shadowColor = meta.color; }
        c.fillText(meta.label, p.x, nameY);

        // ── Costo / MAX / nivel ───────────────────────────────
        const costY = nameY + Math.round(R * 0.30) + 2;
        c.font = `${Math.round(R * 0.24)}px 'Share Tech Mono','Courier New'`;
        if (maxed) {
            c.fillStyle = meta.color;
            c.shadowBlur = 6; c.shadowColor = meta.color;
            c.fillText('MAX ★', p.x, costY);
        } else {
            const cost = node.cost[node.level];
            c.fillStyle = canBuy ? '#ffdd00' : 'rgba(255,255,255,0.22)';
            c.shadowBlur = canBuy ? 4 : 0; c.shadowColor = '#ffdd00';
            c.fillText(cost != null ? cost+'◈' : '', p.x, costY);
        }
        c.shadowBlur = 0;
        c.restore();

        // ── Tooltip al hover ─────────────────────────────────
        if (hov) {
            const tipPad  = 10;
            const tipFont = Math.round(R * 0.27);
            const tipW    = Math.min(W * 0.7, R * 3.8);
            const tipH    = tipFont * 2.8 + tipPad * 2;
            let tipX = p.x - tipW/2;
            let tipY2 = p.y - R - tipH - 10;
            // Clamp dentro del canvas
            tipX  = Math.max(8, Math.min(W - tipW - 8, tipX));
            tipY2 = Math.max(8, tipY2);

            c.save();
            // Fondo
            c.fillStyle = 'rgba(2,6,20,0.96)';
            c.strokeStyle = meta.color;
            c.lineWidth = 1.5;
            c.shadowBlur = 12; c.shadowColor = meta.glow;
            c.beginPath();
            c.roundRect(tipX, tipY2, tipW, tipH, 6);
            c.fill(); c.stroke();
            c.shadowBlur = 0;

            // Nombre del skill
            c.font = `bold ${tipFont}px 'Share Tech Mono','Courier New'`;
            c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillStyle = meta.color;
            c.fillText(meta.label, tipX + tipW/2, tipY2 + tipPad + tipFont * 0.6);

            // Descripción
            c.font = `${Math.round(tipFont * 0.82)}px 'Share Tech Mono','Courier New'`;
            c.fillStyle = 'rgba(255,255,255,0.72)';
            c.fillText(meta.shortDesc, tipX + tipW/2, tipY2 + tipPad + tipFont * 1.85);

            // Nivel actual
            c.font = `${Math.round(tipFont * 0.75)}px 'Share Tech Mono','Courier New'`;
            c.fillStyle = 'rgba(255,255,255,0.35)';
            c.fillText(`LVL ${node.level} / ${node.maxLevel}`, tipX + tipW/2, tipY2 + tipH - tipPad - 4);
            c.restore();
        }
    });

    // ── HEADER ───────────────────────────────────────────────
    c.save();
    c.font = `bold ${Math.round(Math.min(W,H)*0.033)}px 'Share Tech Mono','Courier New'`;
    c.textAlign = 'left'; c.textBaseline = 'top';
    c.fillStyle = 'rgba(0,255,255,0.5)';
    c.fillText('// ÁRBOL DE HABILIDADES', 14, 10);
    // Créditos disponibles
    c.textAlign = 'right';
    c.fillStyle = '#ffdd00';
    c.shadowBlur = 6; c.shadowColor = '#ffdd00';
    c.fillText(`${wallet} ◈ disponibles`, W - 14, 10);
    c.shadowBlur = 0;

    // Footer
    c.font = `${Math.round(Math.min(W,H)*0.026)}px 'Share Tech Mono','Courier New'`;
    c.textAlign = 'center'; c.textBaseline = 'bottom';
    c.fillStyle = 'rgba(0,255,255,0.25)';
    c.fillText('Toca o haz clic en un nodo para mejorarlo', W/2, H - 4);
    c.restore();

    // ── EVENT HANDLERS ────────────────────────────────────────
    if (_stClickHandler) {
        stCanvas.removeEventListener('click', _stClickHandler);
        stCanvas.removeEventListener('mousemove', _stClickHandler._move);
        stCanvas.removeEventListener('touchstart', _stClickHandler._touch);
    }
    _stClickHandler = (e) => {
        const rect = stCanvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (W / rect.width);
        const my = (e.clientY - rect.top)  * (H / rect.height);
        Object.keys(SKILL_LAYOUT).forEach(key => {
            const p2 = pos[key]; if (!p2) return;
            if (Math.hypot(mx - p2.x, my - p2.y) < R) {
                const node2 = skillTree[key]; if (!node2 || node2.level >= node2.maxLevel) return;
                const cost = node2.cost[node2.level];
                if (wallet >= cost) {
                    wallet -= cost; node2.level++;
                    applySkillTree(); snd.playSFX('levelup'); haptic([60,30,80]);
                    saveGameToBrowser(); updateShopUI();
                }
            }
        });
    };
    _stClickHandler._move = (e) => {
        const rect = stCanvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (W / rect.width);
        const my = (e.clientY - rect.top)  * (H / rect.height);
        let found = null;
        Object.keys(SKILL_LAYOUT).forEach(key => {
            const p2 = pos[key];
            if (p2 && Math.hypot(mx - p2.x, my - p2.y) < R * 1.3) found = key;
        });
        if (found !== _stHoverKey) { _stHoverKey = found; drawSkillTree(stCanvas); }
    };
    _stClickHandler._touch = (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        const rect = stCanvas.getBoundingClientRect();
        const mx = (t.clientX - rect.left) * (W / rect.width);
        const my = (t.clientY - rect.top)  * (H / rect.height);
        Object.keys(SKILL_LAYOUT).forEach(key => {
            const p2 = pos[key]; if (!p2) return;
            if (Math.hypot(mx - p2.x, my - p2.y) < R * 1.3) {
                const node2 = skillTree[key]; if (!node2 || node2.level >= node2.maxLevel) return;
                const cost = node2.cost[node2.level];
                if (wallet >= cost) {
                    wallet -= cost; node2.level++;
                    applySkillTree(); snd.playSFX('levelup'); haptic([60,30,80]);
                    saveGameToBrowser(); updateShopUI();
                }
            }
        });
    };
    stCanvas.addEventListener('click', _stClickHandler);
    stCanvas.addEventListener('mousemove', _stClickHandler._move);
    stCanvas.addEventListener('touchstart', _stClickHandler._touch, { passive: false });
}

// Animación continua del árbol mientras la tab está abierta
let _stAnimFrame = null;
function startSkillTreeAnimation() {
    const stCanvas = document.getElementById('skill-tree-canvas');
    if (!stCanvas) return;
    const animate = () => {
        drawSkillTree(stCanvas);
        _stAnimFrame = requestAnimationFrame(animate);
    };
    if (_stAnimFrame) cancelAnimationFrame(_stAnimFrame);
    _stAnimFrame = requestAnimationFrame(animate);
}
function stopSkillTreeAnimation() {
    if (_stAnimFrame) { cancelAnimationFrame(_stAnimFrame); _stAnimFrame = null; }
}
function haptic(pattern) {
    if ('vibrate' in navigator) { try { navigator.vibrate(pattern); } catch(e){} }
}

function applySkillTree() {
    window.EMP_PERMANENTLY_UNLOCKED = !!(skillTree.empSkill && skillTree.empSkill.level > 0);
    window.MAGNET_RANGE  = 200 + (skillTree.magRange  ? skillTree.magRange.level  * 50  : 0);
    window.XP_BONUS      = 1   + (skillTree.xpBonus   ? skillTree.xpBonus.level   * 0.15: 0);
    window.COIN_BONUS    = 1   + (skillTree.coinBonus  ? skillTree.coinBonus.level * 0.10: 0);
    window.COMBO_REQ_BONUS = skillTree.comboLen ? skillTree.comboLen.level : 0;
}

const DISTRICT_EVENTS = {
    1: [
        { type: 'rush',    label: '🔥 HORA PUNTA',        color: '#ff6600', desc: 'x2 monedas por 10s' },
        { type: 'glitch',  label: '⚡ INTERFERENCIA',    color: '#ff00aa', desc: 'Obstáculos parpadean' },
        { type: 'rain',    label: '☣ LLUVIA DE DATOS',   color: '#00ff44', desc: 'Monedas extra del cielo' },
    ],
    2: [
        { type: 'lockdown',label: '🔒 CERROJO',          color: '#00ffff', desc: 'Velocidad -25% por 10s' },
        { type: 'bonus',   label: '◈ TRANSFERENCIA',     color: '#ffdd00', desc: 'x2 créditos por 10s' },
        { type: 'drone',   label: '⬡ ENJAMBRE',          color: '#00aaff', desc: 'Solo drones por 10s' },
    ],
    3: [
        { type: 'overdrive',label:'⚡ OVERDRIVE',         color: '#ff2200', desc: 'Velocidad +50% por 10s' },
        { type: 'purge',   label: '☠ PURGE',             color: '#ff0055', desc: 'Láseres cada spawn' },
        { type: 'matrix',  label: '◈ MATRIX GLITCH',     color: '#00ff88', desc: 'Ralentí + x3 monedas' },
    ],
    4: [
        { type: 'void_surge',  label: '◈ VACÍO ABSOLUTO',  color: '#cc00ff', desc: 'Todo al máximo por 8s' },
        { type: 'ghost_wave',  label: '👻 OLEADA FANTASMA', color: '#aa88ff', desc: 'Obstáculos invisibles 5s' },
        { type: 'data_storm',  label: '⚡ TORMENTA DE DATOS', color: '#ff88ff', desc: 'x4 monedas 8s' },
    ]
};
let eventCooldown = 0;

function tryTriggerEvent() {
    if (activeEvent || eventCooldown > 0 || Math.random() > 0.003) return;
    const pool = DISTRICT_EVENTS[currentDistrict] || DISTRICT_EVENTS[1];
    const evt = { ...pool[Math.floor(Math.random()*pool.length)], timer: EVENT_DURATION };
    activeEvent = evt;
    eventCooldown = 1200;
    floatingTexts.push(new FloatingText(canvas.width*0.2, canvas.height*0.3, `${evt.label}`, evt.color));
    haptic([50,30,80]);
    if (evt.type === 'lockdown') gameSpeed = Math.max(2, gameSpeed * 0.75);
    if (evt.type === 'overdrive') gameSpeed *= 1.5;
}

function updateEvent() {
    if (eventCooldown > 0) eventCooldown--;
    if (!activeEvent) return;
    activeEvent.timer--;
    if (activeEvent.type === 'rain' && Math.random() > 0.85) {
        coins.push(new Coin());
    }
    if (activeEvent.timer <= 0) {
        if (activeEvent.type === 'lockdown') gameSpeed /= 0.75;
        if (activeEvent.type === 'overdrive') gameSpeed /= 1.5;
        activeEvent = null;
    }
}

function spawnComboObstacle() {
    const r = Math.random();
    const makeObs = (type, x, w, h, y) => {
        const o = new Obstacle(); o.type=type; o.x=x; o.width=w; o.height=h; o.y=y; return o;
    };
    if (r < 0.33) {
        obstacles.push(makeObs('trash_bag', canvas.width+20,  28,30,floorY-30));
        obstacles.push(makeObs('cone',      canvas.width+130, 22,36,floorY-36));
    } else if (r < 0.66) {
        obstacles.push(makeObs('barrel', canvas.width+20,  28,38,floorY-38));
        obstacles.push(makeObs('drone',  canvas.width+150, 32,22,floorY-72));
    } else {
        obstacles.push(makeObs('hydrant', canvas.width+20,  22,32,floorY-32));
        obstacles.push(makeObs('cone',    canvas.width+110, 22,36,floorY-36));
        obstacles.push(makeObs('drone',   canvas.width+230, 32,22,floorY-72));
    }
}

class ImpactPuff {
    constructor(x, y) {
        this.alive = true;
        const col = (DISTRICTS[currentDistrict]||DISTRICTS[1]).laserColor;
        this.parts = Array.from({length:8}, () => {
            const a = Math.PI + Math.random()*Math.PI;
            return { x, y, vx:Math.cos(a)*Math.random()*3, vy:-Math.random()*2-0.5,
                     alpha:0.75, color:col, size:Math.random()*3+1 };
        });
    }
    update() {
        this.parts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.18;p.alpha-=0.055;});
        if (this.parts.every(p=>p.alpha<=0)) this.alive=false;
    }
    draw() {
        this.parts.forEach(p=>{
            if (p.alpha<=0) return;
            ctx.save(); ctx.globalAlpha=p.alpha; ctx.fillStyle=p.color;
            ctx.shadowBlur=4; ctx.shadowColor=p.color;
            ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill(); ctx.restore();
        });
    }
}

const WEEKLY_TYPES = [
    { id:'dist_challenge',  label:'SPRINT SEMANAL',         desc:'Llega a 2000m en una partida',                   target:2000,  type:'distance',    reward:300 },
    { id:'coin_challenge',  label:'RECAUDADOR',              desc:'Acumula 80 créditos en una partida',             target:80,    type:'score',       reward:250 },
    { id:'no_dmg',          label:'INTOCABLE',               desc:'Recorre 800m sin recibir daño',                  target:800,   type:'nodmg',       reward:400 },
    { id:'chip_run',        label:'RASTREADOR',              desc:'Recoge 2 chips en una misma partida',            target:2,     type:'chips_run',   reward:350 },
    { id:'combo_run',       label:'SINCRONIZADOR',           desc:'Mantén combo x4 durante 10 segundos',            target:600,   type:'combo_time',  reward:300 },
    { id:'d3_survivor',     label:'SUPERVIVIENTE BLACK ICE', desc:'Sobrevive 60s en The Black Ice',                 target:3600,  type:'d3_time',     reward:500 },
    { id:'full_run',        label:'CORREDOR COMPLETO',       desc:'Visita los 3 distritos en una partida',          target:3,     type:'districts',   reward:450 },
    { id:'speedrun',        label:'VELOCISTA',               desc:'Llega a 500m en menos de 30 segundos',           target:500,   type:'speedrun',    reward:380 },
    { id:'chip_collector',  label:'RECOLECTOR DE CHIPS',     desc:'Recoge 5 chips en total esta semana',            target:5,     type:'chips_week',  reward:420 },
    { id:'emp_master',      label:'MAESTRO EMP',             desc:'Destruye 8 obstáculos con el EMP en una semana', target:8,     type:'emp_kills',   reward:460 },
    { id:'void_survivor',   label:'PROTOCOLO VOID',          desc:'Sobrevive 30s en VOID PROTOCOL',                 target:1800,  type:'d4_time',     reward:600 },
];
let weeklyChipsThisRun = 0;
let weeklyComboTimer   = 0;

function initWeeklyChallenge() {
    const weekNum = Math.floor(Date.now() / (7*24*3600*1000));
    if (!weeklyChallenge || weeklyChallenge.weekNum !== weekNum) {
        const idx = weekNum % WEEKLY_TYPES.length;
        weeklyChallenge = { ...WEEKLY_TYPES[idx], weekNum, progress:0, cleared:false };
    }
}

function updateWeeklyProgress(type, amount) {
    if (!weeklyChallenge||weeklyChallenge.cleared) return;
    if (weeklyChallenge.type !== type) return;
    weeklyChallenge.progress = (weeklyChallenge.progress||0) + amount;
    if (weeklyChallenge.progress >= weeklyChallenge.target) {
        weeklyChallenge.cleared = true;
        wallet += weeklyChallenge.reward;
        runStats.weeklyClear = (runStats.weeklyClear||0)+1;
        floatingTexts.push(new FloatingText(canvas.width*0.15, canvas.height*0.38,
            `★ DESAFÍO SEMANAL! +${weeklyChallenge.reward}◈`, '#ffdd00'));
        haptic([100,50,100,50,200]);
        checkAchievements(); saveGameToBrowser();
    }
}

const ACHIEVEMENTS = [
    { id:'first_run',  label:'¡PRIMERA CONEXIÓN!', desc:'Completa tu primera partida',       icon:'▶', reward:30,  unlocked:false, check:s=>s.totalRuns>=1 },
    { id:'combo5',     label:'ONDA DE DATOS',       desc:'Alcanza combo ×5',                  icon:'✦', reward:50,  unlocked:false, check:s=>s.bestCombo>=5 },
    { id:'dist1000',   label:'CORREDOR DIGITAL',    desc:'Llega a 1000m',                     icon:'◈', reward:80,  unlocked:false, check:s=>s.bestDistance>=1000 },
    { id:'dist5000',   label:'LEYENDA DE LA RED',   desc:'Llega a 5000m',                     icon:'★', reward:200, unlocked:false, check:s=>s.bestDistance>=5000 },
    { id:'score500',   label:'EXTRACTOR',           desc:'500 créditos en una partida',       icon:'◎', reward:100, unlocked:false, check:s=>s.bestScore>=500 },
    { id:'score2000',  label:'MAESTRO DE LA RED',   desc:'2000 créditos en una partida',      icon:'⬢', reward:300, unlocked:false, check:s=>s.bestScore>=2000 },
    { id:'runs10',     label:'PERSISTENCIA',        desc:'Juega 10 partidas',                 icon:'◻', reward:60,  unlocked:false, check:s=>s.totalRuns>=10 },
    { id:'runs50',     label:'ENLACE PERMANENTE',   desc:'Juega 50 partidas',                 icon:'⬡', reward:200, unlocked:false, check:s=>s.totalRuns>=50 },
    { id:'chip5',      label:'FRAGMENTADO',         desc:'Recoge 5 chips',                    icon:'◈', reward:100, unlocked:false, check:s=>(s.chipsCollected||0)>=5 },
    { id:'chip20',     label:'PROTOCOLO SECRETO',   desc:'Completa los 20 chips',             icon:'🔓', reward:500, unlocked:false, check:s=>(s.chipsCollected||0)>=20 },
    { id:'all_chars',  label:'COLECCIÓN COMPLETA',  desc:'Desbloquea todos los agentes',      icon:'★', reward:400, unlocked:false, check:(s,c)=>c&&Object.values(c).every(x=>x.unlocked) },
    { id:'no_hit_run', label:'FANTASMA DE LA RED',  desc:'500m sin recibir daño',             icon:'👻', reward:150, unlocked:false, check:s=>s.bestNoDmgDist>=500 },
    { id:'weekly1',    label:'DESAFIANTE',          desc:'Completa un desafío semanal',       icon:'◈', reward:200, unlocked:false, check:s=>(s.weeklyClear||0)>=1 },
];

function checkAchievements() {
    let any = false;
    ACHIEVEMENTS.forEach(a => {
        if (a.unlocked) return;
        const ok = a.id==='all_chars' ? a.check(runStats,characters) : a.check(runStats);
        if (ok) { a.unlocked=true; wallet+=a.reward; any=true;
            floatingTexts.push(new FloatingText(canvas.width*0.15,canvas.height*0.28,
                `🏆 ${a.label} +${a.reward}◈`,'#ffdd00'));
            haptic([80,40,120]); }
    });
    if (any) saveGameToBrowser();
}

function addLocalRecord() {
    localRecords.push({ score, distance:Math.floor(distanceTraveled/10),
        character:activeCharacter, district:(DISTRICTS[currentDistrict]||DISTRICTS[1]).name,
        date:new Date().toLocaleDateString('es',{day:'2-digit',month:'2-digit'}) });
    localRecords.sort((a,b)=>b.score-a.score);
    if (localRecords.length>5) localRecords=localRecords.slice(0,5);
}

function togglePause() {
    if (!gameActive) return;
    gamePaused = !gamePaused;
    if (gamePaused) {
        snd.stop(); haptic(40);
        const pd = document.getElementById('pause-dist');
        const ps = document.getElementById('pause-score');
        if (pd) pd.innerText = `DISTANCIA: ${Math.floor(distanceTraveled/10)}m`;
        if (ps) ps.innerText = `CRÉDITOS: ${score} ◈`;
    } else {
        snd.init();
    }
    const el = document.getElementById('pause-overlay');
    if (el) el.classList.toggle('hidden', !gamePaused);
}

// ── SETDIFFICULTY ─
function setDifficulty(level) {
    chosenDifficulty = level;
    currentDistrict = DIFFICULTIES[level].district;
    if (difficultyScreen) difficultyScreen.classList.add('hidden');
    snd.init();
    init();
}

function gainXP(amount) {
    if (!gameActive) return;
    playerXP += amount;
    const dist = DISTRICTS[currentDistrict] || DISTRICTS[1];
    if (playerXP >= dist.xpRequired) playerXP = dist.xpRequired;
}

// --- SECRETO: 20 CHIPS ---
function unlockSecret() {
    // Al llegar a 20 chips, el personaje GHOST se desbloquea gratis
    // y la velocidad máxima aumenta permanentemente (modo LEYENDA)
    characters.ghost.unlocked = true;
    floatingTexts.push(new FloatingText(canvas.width/2 - 80, canvas.height/2, '🔓 SECRETO DESBLOQUEADO', '#ff00ff'));
    // Mostrar overlay especial
    setTimeout(() => {
        if (!gameActive) return;
        floatingTexts.push(new FloatingText(canvas.width/2 - 100, canvas.height/2 - 30, 'GHOST LIBRE · MODO LEYENDA', '#ff88ff'));
    }, 1200);
    DIFFICULTIES.easy.baseSpeed  *= 1.12;
    DIFFICULTIES.normal.baseSpeed *= 1.12;
    DIFFICULTIES.hard.baseSpeed   *= 1.12;
    saveGameToBrowser();
}

// --- SISTEMA DE ESTRELLAS ---
let starField = [];
function generateStars() {
    starField = [];
    for (let i = 0; i < 120; i++) {
        starField.push({
            x: Math.random(),  // fracción del ancho
            y: Math.random(),  // fracción del horizonY
            size: Math.random() * 1.5 + 0.3,
            alpha: Math.random() * 0.7 + 0.2,
            twinkle: Math.random() * Math.PI * 2,
            speed: Math.random() * 0.02 + 0.005
        });
    }
}

let bgTime = 0; // timer global para animaciones de fondo

// --- PARALAJE DE EDIFICIOS (REDISEÑO) ---
class BackgroundBuilding {
    constructor(layer) {
        this.layer = layer;
        // 3 capas: 'deep' (muy al fondo), 'far', 'near'
        if (layer === 'deep') {
            this.width = Math.random() * 45 + 30;
            this.height = Math.random() * 160 + 100;
        } else if (layer === 'far') {
            this.width = Math.random() * 70 + 55;
            this.height = Math.random() * 130 + 110;
        } else {
            this.width = Math.random() * 95 + 80;
            this.height = Math.random() * 100 + 80;
        }
        this.x = Math.random() * canvas.width;
        this.windows = [];
        this.antennaH = (!layer || layer === 'near') && Math.random() > 0.5 ? Math.random() * 20 + 8 : 0;
        this.billboard = layer === 'near' && Math.random() > 0.65;
        this.generateWindows();
    }
    generateWindows() {
        let cols = Math.floor(this.width / 13); let rows = Math.floor(this.height / 16);
        let dist = DISTRICTS[currentDistrict] || DISTRICTS[1];
        let currentColors = dist.winColors;
        this.windows = [];
        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < rows; r++) {
                if (Math.random() > 0.42) {
                    this.windows.push({
                        dx: c * 11 + 5,
                        dy: r * 14 + 8,
                        color: currentColors[Math.floor(Math.random() * currentColors.length)],
                        active: Math.random() > 0.25,
                        flicker: Math.random() > 0.85
                    });
                }
            }
        }
    }
    update() {
        const speeds = { deep: 0.03, far: 0.08, near: 0.28 };
        const speed = (speeds[this.layer] || 0.28) * gameSpeed;
        this.x -= speed;
        if (this.x + this.width < 0) {
            this.x = canvas.width + Math.random() * 60;
            if (this.layer === 'deep')      { this.height = Math.random() * 160 + 100; }
            else if (this.layer === 'far')  { this.height = Math.random() * 130 + 110; }
            else                            { this.height = Math.random() * 100 + 80; }
            this.antennaH = this.layer === 'near' && Math.random() > 0.5 ? Math.random() * 20 + 8 : 0;
            this.generateWindows();
        }
        if (Math.random() > 0.97 && this.windows.length > 0) {
            const w = this.windows[Math.floor(Math.random() * this.windows.length)];
            w.active = !w.active;
        }
    }
    draw() {
        const drawY = horizonY - this.height;
        const isDeep = this.layer === 'deep';
        const isFar  = this.layer === 'far';
        const dist   = DISTRICTS[currentDistrict] || DISTRICTS[1];
        ctx.save();
        if (!isFar && !isDeep) { ctx.shadowBlur = 12; ctx.shadowColor = dist.fogColor; }
        const bGrad = ctx.createLinearGradient(this.x, drawY, this.x + this.width, drawY + this.height);
        if (isDeep) {
            // Capa profunda — muy oscura y opaca
            bGrad.addColorStop(0, '#03040a'); bGrad.addColorStop(1, '#020308');
            ctx.globalAlpha = 0.55;
        } else if (isFar) {
            bGrad.addColorStop(0, '#060810'); bGrad.addColorStop(1, '#030508');
        } else {
            bGrad.addColorStop(0, '#0a0c18'); bGrad.addColorStop(0.5, '#05060f'); bGrad.addColorStop(1, '#020308');
        }
        ctx.fillStyle = bGrad;
        ctx.fillRect(this.x, drawY, this.width, this.height);
        ctx.globalAlpha = 1;
        if (!isFar && !isDeep) {
            ctx.strokeStyle = 'rgba(0,255,255,0.06)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(this.x, drawY); ctx.lineTo(this.x, drawY + this.height); ctx.stroke();
        }
        ctx.restore();
        ctx.save();
        const winAlpha = isDeep ? 0.3 : (isFar ? 0.55 : 1.0);
        this.windows.forEach(w => {
            if (!w.active) return;
            const alpha = w.flicker ? (Math.random() * 0.3 + 0.4) : 0.65;
            ctx.globalAlpha = alpha * winAlpha;
            ctx.fillStyle = w.color;
            ctx.shadowBlur = isDeep ? 0 : (isFar ? 0 : 4);
            ctx.shadowColor = w.color;
            const ws = isDeep ? 2 : (isFar ? 4 : 5);
            const hs = isDeep ? 3 : (isFar ? 6 : 8);
            ctx.fillRect(this.x + w.dx, drawY + w.dy, ws, hs);
        });
        ctx.restore();
        if (!isFar && !isDeep && this.antennaH > 0) {
            ctx.save(); ctx.strokeStyle = 'rgba(0,255,255,0.3)'; ctx.lineWidth = 1;
            const antX = this.x + this.width * 0.5;
            ctx.beginPath(); ctx.moveTo(antX, drawY); ctx.lineTo(antX, drawY - this.antennaH); ctx.stroke();
            ctx.fillStyle = Math.sin(bgTime * 0.05) > 0 ? '#ff2200' : 'transparent';
            ctx.shadowBlur = 6; ctx.shadowColor = '#ff2200';
            ctx.beginPath(); ctx.arc(antX, drawY - this.antennaH, 1.5, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }
        if (!isFar && !isDeep && this.billboard && this.width > 60) {
            const bx=this.x+6, by=drawY+10, bw=this.width-12, bh=14;
            ctx.save();
            ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(bx,by,bw,bh);
            ctx.strokeStyle=dist.winColors[0]; ctx.lineWidth=1;
            ctx.shadowBlur=6; ctx.shadowColor=dist.winColors[0];
            ctx.strokeRect(bx,by,bw,bh); ctx.restore();
        }
    }
}

function drawBackground() {
    bgTime++;
    const w = canvas.width;
    const dist = DISTRICTS[currentDistrict] || DISTRICTS[1];

    // ── SKY con múltiples paradas de gradiente ──────────────
    const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
    const stops = dist.skyStops;
    const colors = dist.skyColors;
    for (let i = 0; i < stops.length; i++) sky.addColorStop(stops[i], colors[i]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, horizonY);

    // ── NEBULOSA / NUBES DE FONDO ───────────────────────────
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 3; i++) {
        const nx = ((bgTime * 0.12 * (i+0.5)) % (w + 400)) - 200;
        const ny = horizonY * (0.2 + i * 0.18);
        const nr = 80 + i * 40;
        const nebula = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
        nebula.addColorStop(0, dist.fogColor.replace('0.', '0.0'));
        nebula.addColorStop(0.4, dist.fogColor);
        nebula.addColorStop(1, 'transparent');
        ctx.fillStyle = nebula;
        ctx.beginPath(); ctx.ellipse(nx, ny, nr * 2.5, nr * 0.8, 0, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    // ── LUNA / SOL ──────────────────────────────────────────
    const moonX = w * 0.82;
    const moonY = horizonY * 0.28;
    const moonR = Math.min(w, canvas.height) * 0.028;
    ctx.save();
    const moonGrad = ctx.createRadialGradient(moonX-moonR*0.3, moonY-moonR*0.3, moonR*0.1, moonX, moonY, moonR);
    moonGrad.addColorStop(0, dist.moonColor);
    moonGrad.addColorStop(0.7, dist.moonColor + '99');
    moonGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = moonGrad;
    ctx.shadowBlur = moonR * 3;
    ctx.shadowColor = dist.moonColor;
    ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    // ── ESTRELLAS ───────────────────────────────────────────
    if (starField.length === 0) generateStars();
    ctx.save();
    starField.forEach(s => {
        s.twinkle += s.speed;
        const alpha = s.alpha * (0.6 + 0.4 * Math.sin(s.twinkle));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = dist.moonColor;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * horizonY, s.size, 0, Math.PI*2);
        ctx.fill();
    });
    ctx.restore();

    // ── EDIFICIOS ──────────────────────────────────────────
    buildings.forEach(b => { if (b.layer === 'deep') { b.update(); b.draw(); } });
    buildings.forEach(b => { if (b.layer === 'far')  { b.update(); b.draw(); } });
    buildings.forEach(b => { if (b.layer === 'near') { b.update(); b.draw(); } });

    // ── LÍNEA DE HORIZONTE con glow ─────────────────────────
    ctx.save();
    ctx.shadowBlur = 8; ctx.shadowColor = dist.laserColor;
    const horizGrad = ctx.createLinearGradient(0, horizonY, w, horizonY);
    horizGrad.addColorStop(0, 'transparent');
    horizGrad.addColorStop(0.2, dist.laserColor + 'aa');
    horizGrad.addColorStop(0.5, dist.laserColor);
    horizGrad.addColorStop(0.8, dist.laserColor + 'aa');
    horizGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = horizGrad;
    ctx.fillRect(0, horizonY - 1, w, 3);
    ctx.restore();

    // ── NIEBLA EN EL HORIZONTE ──────────────────────────────
    const fogGrad = ctx.createLinearGradient(0, horizonY - 30, 0, horizonY + 20);
    fogGrad.addColorStop(0, 'transparent');
    fogGrad.addColorStop(0.5, dist.fogColor);
    fogGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = fogGrad;
    ctx.fillRect(0, horizonY - 30, w, 50);
}class LaserGrid {
    constructor() { this.offset = 0; }
    update() { this.offset = (this.offset + gameSpeed * 0.8) % 40; }
    draw() {
        ctx.save();
        const dist = DISTRICTS[currentDistrict] || DISTRICTS[1];
        const floorH = canvas.height - floorY;

        // Fondo del suelo — gradiente oscuro
        const floorGrad = ctx.createLinearGradient(0, floorY, 0, canvas.height);
        floorGrad.addColorStop(0, '#050710');
        floorGrad.addColorStop(1, '#020308');
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, floorY, canvas.width, floorH);

        // Líneas horizontales con perspectiva (más separadas cerca)
        ctx.strokeStyle = dist.gridColor; ctx.lineWidth = 1;
        for (let y = floorY + (this.offset % 12); y < canvas.height; y += 12) {
            const t = (y - floorY) / floorH;
            ctx.globalAlpha = t * 0.9;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }

        // Líneas de perspectiva (radiales desde vanishing point)
        ctx.globalAlpha = 1;
        ctx.strokeStyle = dist.gridColor2 || 'rgba(255,255,255,0.04)';
        const vx = canvas.width / 2;
        for (let i = -8; i <= 8; i++) {
            const tx = vx + i * (canvas.width / 8);
            const bx = tx - (this.offset * (tx - vx) / canvas.height * 2);
            ctx.globalAlpha = 0.5;
            ctx.beginPath(); ctx.moveTo(vx + (tx-vx)*0.05, floorY); ctx.lineTo(bx, canvas.height); ctx.stroke();
        }

        // Reflejo especular en la línea del suelo
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 6; ctx.shadowColor = dist.laserColor || '#00ff66';
        ctx.strokeStyle = adrenalineActive ? '#ff00aa' : (dist.gridColor.replace('0.1', '0.6'));
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(canvas.width, floorY); ctx.stroke();

        ctx.restore();
    }
}

function resizeCanvas() {
    canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight;
    floorY = Math.floor(canvas.height * 0.75); horizonY = floorY - 82;
    if (player) { player.x = Math.floor(canvas.width * 0.15); if (player.isGrounded) player.y = floorY - player.height; }
    buildings = [];
    for (let i = 0; i < 8; i++) buildings.push(new BackgroundBuilding('deep'));
    for (let i = 0; i < 6; i++) buildings.push(new BackgroundBuilding('far'));
    for (let i = 0; i < 4; i++) buildings.push(new BackgroundBuilding('near'));
    floorGrid = new LaserGrid();
    generateStars();

    // Mostrar controles táctiles solo en dispositivos touch pequeños
    const touchControls = document.getElementById('touch-controls');
    if (touchControls) {
        const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        const isSmallScreen = window.innerWidth < 768;
        touchControls.style.display = (isTouchDevice && isSmallScreen) ? 'flex' : 'none';
    }
}
window.addEventListener('resize', resizeCanvas);

// --- ENTIDADES Y PARTICULAS ---
class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        this.vx = (Math.random() - 0.5) * 4 - 2; this.vy = (Math.random() - 0.5) * 4;
        this.alpha = 1; this.size = Math.random() * 3 + 1;
    }
    update() { this.x += this.vx; this.y += this.vy; this.alpha -= 0.03; }
    draw() { ctx.save(); ctx.globalAlpha = this.alpha; ctx.fillStyle = this.color; ctx.fillRect(this.x, this.y, this.size, this.size); ctx.restore(); }
}
function spawnExplosion(x, y, color, count) { for (let i = 0; i < count; i++) particles.push(new Particle(x, y, color)); }

class FloatingText {
    constructor(x, y, text, color) { this.x = x; this.y = y; this.text = text; this.color = color; this.alpha = 1; this.vy = -1.5; }
    update() { this.y += this.vy; this.alpha -= 0.025; }
    draw() {
        const fs = Math.max(9, Math.round(11 * Math.min(canvas.width / 800, 1.4)));
        ctx.save(); ctx.globalAlpha = this.alpha; ctx.fillStyle = this.color;
        ctx.font = `bold ${fs}px 'Courier New'`; ctx.fillText(this.text, this.x, this.y); ctx.restore();
    }
}

class PowerUp {
    constructor() { this.x = canvas.width + 10; this.y = floorY - 60 - Math.random() * 50; this.width = 22; this.height = 22; this.pulse = 0; }
    update() { this.x -= gameSpeed; this.pulse += 0.15; }
    draw() {
        const p = Math.sin(this.pulse);
        const cx = this.x + this.width/2, cy = this.y + this.height/2 + p * 2;
        ctx.save();
        ctx.shadowBlur = (14+p*6)*2; ctx.shadowColor = '#ff00aa';
        ctx.globalAlpha = 0.15+Math.abs(p)*0.1; ctx.fillStyle='#ff00aa';
        ctx.beginPath(); ctx.arc(cx,cy,this.width*0.85,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha=1; ctx.shadowBlur=14+p*6;
        ctx.strokeStyle='#ff00aa'; ctx.lineWidth=1.5; ctx.fillStyle='rgba(40,0,30,0.85)';
        ctx.beginPath();
        for(let i=0;i<6;i++){const a=(Math.PI/3)*i-Math.PI/6+this.pulse*0.1,r=this.width*0.52; i===0?ctx.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r):ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);}
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.shadowBlur=4; ctx.fillStyle='#ff88cc';
        ctx.font=`bold ${Math.round(this.width*0.6)}px 'Courier New'`;
        ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('⚡',cx,cy);
        ctx.textAlign='left'; ctx.textBaseline='alphabetic'; ctx.restore();
    }
}

// --- COLECCIONABLES: IMÁN E INVULNERABILIDAD ---
class Collectible {
    constructor(type) {
        this.type = type; // 'magnet' | 'invuln'
        this.x = canvas.width + 10;
        this.y = floorY - 65 - Math.random() * 55;
        this.width = 30; this.height = 30;   // ← más grande (era 22)
        this.pulse = Math.random() * Math.PI * 2;
        this.bobOffset = 0;
    }
    update() {
        this.x -= gameSpeed;
        this.pulse += 0.10;
        this.bobOffset = Math.sin(this.pulse) * 5; // rebote vertical
    }
    draw() {
        const p = Math.sin(this.pulse);
        const cx = this.x + this.width/2;
        const cy = this.y + this.height/2 + this.bobOffset;
        const isMagnet = this.type === 'magnet';
        const color  = isMagnet ? '#00ccff' : '#ffaa00';
        const color2 = isMagnet ? '#001833' : '#331800';
        const symbol = isMagnet ? '◎' : '✦';
        ctx.save();
        // Glow exterior más pronunciado
        ctx.shadowBlur = 20 + Math.abs(p) * 8; ctx.shadowColor = color;
        // Anillo exterior pulsante
        ctx.globalAlpha = 0.2 + Math.abs(p) * 0.25;
        ctx.strokeStyle = color; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, cy, this.width * 0.90, 0, Math.PI*2); ctx.stroke();
        ctx.globalAlpha = 1;
        // Círculo de fondo
        const grad = ctx.createRadialGradient(cx-this.width*0.15, cy-this.height*0.15, 0, cx, cy, this.width*0.55);
        grad.addColorStop(0, color + '55');
        grad.addColorStop(1, color2);
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(cx, cy, this.width * 0.55, 0, Math.PI*2); ctx.fill();
        // Borde
        ctx.strokeStyle = color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, this.width * 0.55, 0, Math.PI*2); ctx.stroke();
        // Símbolo
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 6; ctx.shadowColor = color;
        ctx.font = `bold ${Math.round(this.width * 0.65)}px 'Courier New'`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(symbol, cx, cy);
        // Etiqueta abajo
        ctx.font = `${Math.round(this.width * 0.30)}px 'Share Tech Mono', monospace`;
        ctx.fillStyle = color;
        ctx.shadowBlur = 4;
        ctx.fillText(isMagnet ? 'IMÁN' : 'INVULN', cx, cy + this.width * 0.78);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.restore();
    }
}
// collectibles array declared at top of file

// --- BOLA DE FUEGO (habilidad del PYRO) ---
class Fireball {
    constructor(x, y, target) {
        this.x = x; this.y = y;
        this.target = target;
        this.size = 10;
        this.speed = 9;
        this.done = false;
        this.pulse = 0;
    }
    update() {
        this.pulse += 0.25;
        if (!this.target || this.target.done) { this.done = true; return; }
        const dx = (this.target.x + (this.target.width||20)/2) - this.x;
        const dy = (this.target.y + (this.target.height||20)/2) - this.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < this.speed + 8) {
            // Impacto — destruir obstáculo
            spawnExplosion(this.target.x+(this.target.width||20)/2, this.target.y+(this.target.height||20)/2, '#ff6600', 18);
            const idx = obstacles.indexOf(this.target);
            if (idx !== -1) obstacles.splice(idx, 1);
            this.done = true;
        } else {
            this.x += (dx/d)*this.speed;
            this.y += (dy/d)*this.speed;
        }
    }
    draw() {
        if (this.done) return;
        const p = Math.sin(this.pulse);
        ctx.save();
        ctx.shadowBlur = 14 + Math.abs(p)*6; ctx.shadowColor = '#ff6600';
        // Núcleo
        const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size*(1+Math.abs(p)*0.2));
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.35, '#ffcc00');
        grad.addColorStop(0.7, '#ff4400');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size*(1+Math.abs(p)*0.2), 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

// --- CHIP SECRETO — coleccionable raro (max 20 para desbloquear secreto) ---
class Chip {
    constructor() {
        this.x = canvas.width + 20;
        this.y = floorY - 65 - Math.random() * 80;
        this.size = 18;
        this.pulse = Math.random() * Math.PI * 2;
        this.rotation = 0;
    }
    update() {
        this.x -= gameSpeed * 0.9;
        this.pulse += 0.08;
        this.rotation += 0.025;
    }
    draw() {
        const cx = this.x + this.size/2;
        const cy = this.y + this.size/2;
        const p  = Math.sin(this.pulse);
        const s  = this.size * 0.5 * (1 + Math.abs(p) * 0.1);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.rotation);

        // Glow exterior pulsante
        ctx.shadowBlur = 16 + Math.abs(p)*8; ctx.shadowColor = '#ff00ff';

        // Cuerpo del chip (rectángulo redondeado en canvas)
        ctx.fillStyle = '#1a0028';
        ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 1.5;
        const hw = s*1.1, hh = s*0.75;
        ctx.beginPath();
        ctx.moveTo(-hw+4, -hh); ctx.lineTo(hw-4, -hh);
        ctx.quadraticCurveTo(hw, -hh, hw, -hh+4);
        ctx.lineTo(hw, hh-4); ctx.quadraticCurveTo(hw, hh, hw-4, hh);
        ctx.lineTo(-hw+4, hh); ctx.quadraticCurveTo(-hw, hh, -hw, hh-4);
        ctx.lineTo(-hw, -hh+4); ctx.quadraticCurveTo(-hw, -hh, -hw+4, -hh);
        ctx.closePath(); ctx.fill(); ctx.stroke();

        // Pines del chip (top y bottom)
        ctx.strokeStyle = '#cc88ff'; ctx.lineWidth = 1;
        [-0.5, 0, 0.5].forEach(offset => {
            const px = offset * hw * 1.1;
            // Top pin
            ctx.beginPath(); ctx.moveTo(px, -hh); ctx.lineTo(px, -hh-5); ctx.stroke();
            ctx.fillStyle = '#cc88ff';
            ctx.fillRect(px-1.5, -hh-7, 3, 2);
            // Bottom pin
            ctx.beginPath(); ctx.moveTo(px, hh); ctx.lineTo(px, hh+5); ctx.stroke();
            ctx.fillRect(px-1.5, hh+5, 3, 2);
        });

        // Circuito interior
        ctx.strokeStyle = 'rgba(255,0,255,0.5)'; ctx.lineWidth = 0.6;
        ctx.strokeRect(-hw*0.55, -hh*0.55, hw*1.1, hh*1.1);
        ctx.beginPath();
        ctx.moveTo(-hw*0.3, -hh*0.55); ctx.lineTo(-hw*0.3, hh*0.55); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(hw*0.3, -hh*0.55); ctx.lineTo(hw*0.3, hh*0.55); ctx.stroke();

        // Centro brillante
        ctx.fillStyle = '#ff88ff';
        ctx.shadowBlur = 6; ctx.shadowColor = '#ff00ff';
        ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.fill();

        ctx.restore();
    }
}

// --- RECOMPENSAS Y CONTRATOS ---
let currentMission = { type: 'coins', target: 10, reward: 20, progress: 0, text: "Recolectar 10 núcleos de datos" };
const missionPool = [
    // Monedas — fáciles, recompensa baja
    { type: 'coins',    target: 10,  reward: 20, xp: 30,  text: "Recolectar 10 núcleos de datos" },
    { type: 'coins',    target: 20,  reward: 35, xp: 45,  text: "Descargar 20 paquetes de red" },
    { type: 'coins',    target: 35,  reward: 55, xp: 60,  text: "Extraer 35 fragmentos de código" },
    // Evasiones — medias
    { type: 'evade',    target: 5,   reward: 30, xp: 40,  text: "Evadir 5 defensas enemigas" },
    { type: 'evade',    target: 10,  reward: 50, xp: 65,  text: "Esquivar 10 protocolos de seguridad" },
    { type: 'evade',    target: 15,  reward: 75, xp: 85,  text: "Superar 15 barreras corporativas" },
    // Combo — difíciles, alta recompensa
    { type: 'combo',    target: 3,   reward: 40, xp: 50,  text: "Sincronizar Combo Nivel X3" },
    { type: 'combo',    target: 4,   reward: 65, xp: 75,  text: "Alcanzar Combo Nivel X4" },
    { type: 'combo',    target: 5,   reward: 90, xp: 100, text: "Lograr Combo Máximo X5" },
    // Distancia — raramente asignados, muy buena paga
    { type: 'distance', target: 500, reward: 60, xp: 70,  text: "Recorrer 500m en la red" },
    { type: 'distance', target: 1000,reward: 100,xp: 120, text: "Cruzar 1000m sin desconectarse" },
    // Chips — especial
    { type: 'chips',    target: 3,   reward: 80, xp: 90,  text: "Recolectar 3 chips de la red oscura" },
];
function generateNewMission() {
    currentMission = {...missionPool[Math.floor(Math.random() * missionPool.length)], progress: 0};
    if (missionText) missionText.innerText = `CONTRATO: ${currentMission.text} (${currentMission.progress}/${currentMission.target})`;
}
function checkMissionProgress(type, amt = 1) {
    if (!gameActive || currentMission.type !== type) return;
    if (type === 'combo') { currentMission.progress = amt; }
    else { currentMission.progress += amt; }
    if (currentMission.progress >= currentMission.target) {
        const reward = currentMission.reward || 25;
        wallet += reward;
        floatingTexts.push(new FloatingText(player ? player.x : 100, player ? player.y-40 : 100, `¡CONTRATO! +${reward} ◈`, '#00ff88'));
        gainXP(currentMission.xp || 30); generateNewMission(); saveGameToBrowser();
    } else if (missionText) {
        const prog = type==='distance'
            ? `${Math.floor(currentMission.progress)}/${currentMission.target}m`
            : `${Math.floor(currentMission.progress)}/${currentMission.target}`;
        missionText.innerText = `CONTRATO: ${currentMission.text} (${prog})`;
    }
}

// --- CLASE JUGADOR ---
class Player {
    constructor() {
        this.width=32; this.height=42; this.x=120; this.y=floorY-this.height;
        this.vy=0; this.isGrounded=false; this.isCrouching=false; this.immunityFrames=0;
    }
    jump() {
        if (this.isCrouching || districtTransitionTimer!==0) return;
        if (this.isGrounded) {
            this.vy = (activeCharacter==='slime') ? -14.5 : -14.0;
            this.isGrounded=false; specterJumpsLeft=1; snd.playSFX('jump');
        } else if (activeCharacter==='specter' && specterJumpsLeft>0) {
            this.vy=-13.0; specterJumpsLeft--;
            snd.playSFX('jump');
            spawnExplosion(this.x+this.width/2,this.y+this.height/2,'#cc88ff',10);
            floatingTexts.push(new FloatingText(this.x,this.y-10,'DOBLE SALTO','#cc88ff'));
        } else if (activeCharacter==='slime' && !this.isGrounded) {
            // WALL BOUNCE — frena la caída y da un boost lateral (evita obstáculos)
            if (this.vy > 0) {
                this.vy = -9.0;  // rebote hacia arriba
                spawnExplosion(this.x+this.width/2, this.y+this.height, '#39ff14', 8);
                floatingTexts.push(new FloatingText(this.x, this.y-10, 'REBOTE', '#39ff14'));
                snd.playSFX('jump');
            }
        }
    }
    crouch(state) {
        if (districtTransitionTimer>0) return;
        if (state && this.isGrounded) {
            this.isCrouching=true; this.height=24; this.y=floorY-this.height;
            if (empReady&&!empCharging&&(window.EMP_PERMANENTLY_UNLOCKED||(skillTree.empSkill&&skillTree.empSkill.level>0))){empCharging=true;empChargeTimer=0;}
            if (activeCharacter==='pyro'&&!pyroShieldActive) {
                pyroShieldActive=true; pyroShieldTimer=60; this.immunityFrames=60;
                floatingTexts.push(new FloatingText(this.x,this.y-20,'🔥 HEAT SHIELD','#ff6600'));
            }
        } else if (!state) {
            this.isCrouching=false; this.height=42; this.y=floorY-this.height;
            if (empCharging){empCharging=false;empChargeTimer=0;}
        }
    }
    update() {
        if (this.immunityFrames>0) this.immunityFrames--;
        // GHOST phase — cada 7s (420f)
        if (activeCharacter==='ghost') {
            if (ghostPhaseLeft>0) ghostPhaseLeft--;
            if (ghostPhaseCooldown>0) ghostPhaseCooldown--;
            if (ghostPhaseCooldown===0&&ghostPhaseLeft===0) {
                ghostPhaseLeft=45; ghostPhaseCooldown=420; // 7s
                floatingTexts.push(new FloatingText(this.x,this.y-20,'👻 PHASE','#eeeeff'));
            }
        }
        // PYRO fireball cooldown
        if (activeCharacter==='pyro') {
            if (pyroFireballCooldown>0) {
                pyroFireballCooldown--;
            } else {
                // Auto-lanzar bola de fuego al obstáculo más cercano
                let closest=null; let minDist=Infinity;
                obstacles.forEach(o=>{
                    const d=o.x-(this.x+this.width);
                    if(d>0&&d<minDist){minDist=d;closest=o;}
                });
                if(closest&&minDist<canvas.width*0.65){
                    pyroFireballCooldown=PYRO_FIREBALL_CD;
                    fireballs.push(new Fireball(this.x+this.width, this.y+this.height*0.4, closest));
                    floatingTexts.push(new FloatingText(this.x,this.y-20,'🔥 BOLA DE FUEGO','#ff6600'));
                    snd.playSFX('powerup');
                }
            }
        }
        if (pyroShieldActive){pyroShieldTimer--;if(pyroShieldTimer<=0)pyroShieldActive=false;}
        const gMult=(activeCharacter==='slime'&&this.vy>0)?0.75:1.0;
        this.vy+=gravity*gMult; this.y+=this.vy;
        const wasGrounded = this.isGrounded;
        if (this.y>=floorY-this.height){
            this.y=floorY-this.height; 
            if (!wasGrounded && Math.abs(this.vy) > 4) {
                impactPuffs.push(new ImpactPuff(this.x + this.width/2, floorY));
                haptic(20);
            }
            this.vy=0; this.isGrounded=true; specterJumpsLeft=1;
        }
    }
    draw() {
        ctx.save();
        if (this.immunityFrames%4>2){ctx.restore();return;}
        if (activeCharacter==='ghost'&&ghostPhaseLeft>0) ctx.globalAlpha=0.35+0.2*Math.sin(Date.now()*0.02);
        const spriteMap={human:spriteHuman,slime:spriteZombie,skeleton:spriteAndroid,
            specter:spriteSpecter,pyro:spritePyro,netrunner:spriteNetrunner,titan:spriteTitan,ghost:spriteGhost};
        const matrix=spriteMap[activeCharacter]||spriteHuman;
        if (this.isCrouching){ctx.translate(this.x,this.y+12);ctx.scale(1,0.65);drawPixelMatrix(matrix,0,0,3);}
        else{drawPixelMatrix(matrix,this.x,this.y,3);}
        ctx.restore();
        // Escudo
        if (hasShield&&gameActive){ctx.save();ctx.strokeStyle='#00ffff';ctx.lineWidth=2;ctx.shadowBlur=8;ctx.shadowColor='#00ffff';ctx.beginPath();ctx.arc(this.x+this.width/2,this.y+this.height/2,28,0,Math.PI*2);ctx.stroke();ctx.restore();}
        // Pyro heat shield
        if (pyroShieldActive){ctx.save();ctx.strokeStyle='#ff6600';ctx.lineWidth=2;ctx.shadowBlur=12;ctx.shadowColor='#ff6600';ctx.globalAlpha=0.6+0.3*Math.sin(Date.now()*0.03);ctx.beginPath();ctx.arc(this.x+this.width/2,this.y+this.height/2,24,0,Math.PI*2);ctx.stroke();ctx.restore();}
        // Ghost phase aura
        if (activeCharacter==='ghost'&&ghostPhaseLeft>0){ctx.save();ctx.strokeStyle='#eeeeff';ctx.lineWidth=1;ctx.shadowBlur=14;ctx.shadowColor='#aaccff';ctx.globalAlpha=0.4;ctx.beginPath();ctx.arc(this.x+this.width/2,this.y+this.height/2,26,0,Math.PI*2);ctx.stroke();ctx.restore();}
        // Titan smash ring
        if (activeCharacter==='titan'&&titanSmashLeft>0){ctx.save();ctx.strokeStyle='#ffcc00';ctx.lineWidth=1.5;ctx.shadowBlur=6;ctx.shadowColor='#ffcc00';ctx.beginPath();ctx.arc(this.x+this.width/2,this.y+this.height/2,22,0,Math.PI*2);ctx.stroke();ctx.restore();}
        // Specter 2nd jump glow
        if (activeCharacter==='specter'&&!this.isGrounded&&specterJumpsLeft>0){ctx.save();ctx.strokeStyle='#cc88ff';ctx.lineWidth=1;ctx.shadowBlur=8;ctx.shadowColor='#cc88ff';ctx.globalAlpha=0.5+0.3*Math.sin(Date.now()*0.025);ctx.beginPath();ctx.arc(this.x+this.width/2,this.y+this.height/2,20,0,Math.PI*2);ctx.stroke();ctx.restore();}
        // EMP charge arc
        if (empCharging&&empReady){
            const prog=empChargeTimer/upgrades.emp.chargeTime;
            const cx2=this.x+this.width/2,cy2=this.y-10;
            ctx.save();ctx.strokeStyle='rgba(255,224,0,0.2)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx2,cy2,14,-Math.PI/2,Math.PI*2-Math.PI/2);ctx.stroke();
            ctx.strokeStyle='#ffe000';ctx.shadowBlur=8;ctx.shadowColor='#ffe000';ctx.beginPath();ctx.arc(cx2,cy2,14,-Math.PI/2,Math.PI*2*prog-Math.PI/2);ctx.stroke();ctx.restore();
        }
        // EMP cooldown bar
        if (!empReady){const pct=1-empCooldown/EMP_COOLDOWN_FRAMES;ctx.save();ctx.fillStyle='rgba(255,255,255,0.08)';ctx.fillRect(this.x,floorY+4,this.width,3);ctx.fillStyle='#ffe000';ctx.shadowBlur=4;ctx.shadowColor='#ffe000';ctx.fillRect(this.x,floorY+4,this.width*pct,3);ctx.restore();}
    }
}

// --- CLASE OBSTÁCULO URBANO CYBERPUNK ---
class Obstacle {
    constructor() {
        this.evaded = false;
        let types, rand = Math.random();
        if (chosenDifficulty === 'easy') {
            types = ['trash_bag', 'cone', 'hydrant', 'barrel'];
            this.type = types[Math.floor(Math.random() * types.length)];
        } else if (chosenDifficulty === 'normal') {
            types = ['trash_bag', 'cone', 'hydrant', 'barrel', 'drone', 'drone'];
            this.type = types[Math.floor(Math.random() * types.length)];
        } else {
            if (rand < 0.28) this.type = 'laser';
            else {
                types = ['trash_bag', 'cone', 'hydrant', 'barrel', 'drone'];
                this.type = types[Math.floor(Math.random() * types.length)];
            }
        }
        if (this.type === 'laser') {
            this.z = 0.01; this.width = 2; this.height = 1;
            this.targetWidth = 70; this.targetHeight = 10;
            this.y = horizonY; this.targetY = floorY - 35;
        } else {
            this.x = canvas.width + 20;
            if (this.type === 'drone')     { this.width = 32; this.height = 22; this.y = floorY - 72; }
            else if (this.type === 'cone') { this.width = 22; this.height = 36; this.y = floorY - 36; }
            else if (this.type === 'hydrant') { this.width = 22; this.height = 32; this.y = floorY - 32; }
            else if (this.type === 'barrel')  { this.width = 28; this.height = 38; this.y = floorY - 38; }
            else /* trash_bag */           { this.width = 28; this.height = 30; this.y = floorY - 30; }
        }
    }
    update() {
        if (!player) return;
        if (this.type === 'laser') {
            this.z += 0.014 * (gameSpeed / 5.5);
            this.width = this.targetWidth * this.z; this.height = this.targetHeight * this.z;
            let startX = canvas.width / 2; let targetX = player.x - 10;
            this.x = startX + (targetX - startX) * this.z;
            this.y = horizonY + (this.targetY - horizonY) * this.z;
            if (this.z >= 1.0) this.x -= gameSpeed;
        } else {
            this.x -= gameSpeed;
            if (this.type === 'drone' && Math.random() > 0.6)
                particles.push(new Particle(this.x + this.width, this.y + 10, '#00ffff'));
        }
        if (!this.evaded && (this.type === 'laser' ? this.z > 1.15 : this.x + this.width < player.x)) {
            this.evaded = true; gainXP(20); checkMissionProgress('evade', 1);
        }
    }
    draw() {
        const dist = DISTRICTS[currentDistrict] || DISTRICTS[1];
        const lc = dist.laserColor;
        // ── INDICADOR DE ACCIÓN ──────────────────────────────
        if (this.type !== 'laser' && player) {
            const obX = this.x + (this.width||24)/2;
            const obY = this.y - 16;
            const playerDist = obX - (player.x + player.width);
            if (playerDist > 20 && playerDist < canvas.width * 0.55 && (runStats.totalRuns||0) < 3) {
                const alpha = Math.min(1, (1 - playerDist/(canvas.width*0.55)) * 2);
                const isJump = this.type !== 'drone';
                ctx.save();
                ctx.globalAlpha = alpha * 0.85;
                ctx.font = `bold ${Math.max(11, Math.round(canvas.width/55))}px 'Share Tech Mono', monospace`;
                ctx.textAlign = 'center';
                const hint = isJump ? '▲ SALTA' : '▼ AGÁCHATE';
                const hintColor = isJump ? '#00ff88' : '#ffdd00';
                ctx.fillStyle = hintColor;
                ctx.shadowBlur = 8; ctx.shadowColor = hintColor;
                ctx.fillText(hint, obX, obY);
                ctx.restore();
            }
        }
        ctx.save();
        if (this.type === 'laser') {
            if (this.z < 0.35 && player) {
                ctx.strokeStyle = lc + '44'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(canvas.width/2, horizonY);
                ctx.lineTo(player.x + 25, this.targetY); ctx.stroke();
            }
            ctx.shadowBlur = 18*this.z; ctx.shadowColor = lc; ctx.fillStyle = lc;
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.shadowBlur = 6; ctx.fillStyle = '#ffffff';
            ctx.fillRect(this.x+this.width*0.1, this.y+this.height*0.25, this.width*0.8, this.height*0.5);
            ctx.globalAlpha = 0.25*this.z; ctx.fillStyle = lc;
            ctx.fillRect(this.x-3, this.y-3, this.width+6, this.height+6);
        } else if (this.type === 'drone') {
            drawPixelMatrix(spriteDrone, this.x, this.y, 2.5);
            ctx.shadowBlur = 8; ctx.shadowColor = '#00ffff'; ctx.fillStyle = '#00ffff';
            ctx.beginPath(); ctx.arc(this.x+2, this.y+8, 2, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#ff2200'; ctx.shadowColor = '#ff2200';
            ctx.beginPath(); ctx.arc(this.x+this.width*2.5-2, this.y+8, 2, 0, Math.PI*2); ctx.fill();
        } else if (this.type === 'cone') {
            const bx=this.x, by=this.y, bw=this.width, bh=this.height;
            ctx.fillStyle = '#1a0a00'; ctx.fillRect(bx-2, by+bh-6, bw+4, 6);
            ctx.strokeStyle = 'rgba(255,100,0,0.5)'; ctx.lineWidth=0.5; ctx.strokeRect(bx-2, by+bh-6, bw+4, 6);
            ctx.shadowBlur=8; ctx.shadowColor='#ff6600'; ctx.fillStyle='#cc4400';
            ctx.beginPath(); ctx.moveTo(bx+bw/2,by); ctx.lineTo(bx+bw+2,by+bh-6); ctx.lineTo(bx-2,by+bh-6); ctx.closePath(); ctx.fill();
            [0.28, 0.54].forEach(t => {
                const sy=by+bh*t, sw=bw*(1-t)*0.88, sx=bx+(bw-sw)/2;
                ctx.fillStyle='rgba(255,220,0,0.85)'; ctx.fillRect(sx, sy, sw, bh*0.1);
            });
            ctx.shadowBlur=12; ctx.shadowColor='#ffaa00'; ctx.fillStyle='#ffaa00';
            ctx.beginPath(); ctx.arc(bx+bw/2, by+3, 3, 0, Math.PI*2); ctx.fill();
        } else if (this.type === 'hydrant') {
            const bx=this.x, by=this.y, bw=this.width, bh=this.height;
            const color = currentDistrict===2 ? '#00aaff' : (currentDistrict===3 ? '#ff2200' : '#cc0055');
            ctx.shadowBlur=10; ctx.shadowColor=color;
            const hGrad=ctx.createLinearGradient(bx,by,bx+bw,by);
            hGrad.addColorStop(0,'#0a0a14'); hGrad.addColorStop(0.4,color+'88'); hGrad.addColorStop(1,'#0a0a14');
            ctx.fillStyle=hGrad;
            ctx.beginPath();
            ctx.moveTo(bx-2,by+bh); ctx.lineTo(bx+bw+2,by+bh);
            ctx.lineTo(bx+bw,by+bh*0.6); ctx.lineTo(bx+bw*0.75,by+bh*0.4);
            ctx.lineTo(bx+bw*0.75,by+bh*0.15); ctx.lineTo(bx+bw*0.9,by);
            ctx.lineTo(bx+bw*0.1,by); ctx.lineTo(bx+bw*0.25,by+bh*0.15);
            ctx.lineTo(bx+bw*0.25,by+bh*0.4); ctx.lineTo(bx,by+bh*0.6);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle=color; ctx.lineWidth=1; ctx.stroke();
            [-1,1].forEach(side => {
                const mx=bx+bw/2+side*(bw*0.48), my=by+bh*0.48;
                ctx.fillStyle='#111'; ctx.fillRect(mx-4,my,8,6);
                ctx.strokeStyle=color; ctx.lineWidth=0.8; ctx.strokeRect(mx-4,my,8,6);
            });
        } else if (this.type === 'barrel') {
            const bx=this.x, by=this.y, bw=this.width, bh=this.height;
            const bc = currentDistrict===3 ? '#ff4400' : '#00ff88';
            ctx.shadowBlur=8; ctx.shadowColor=bc;
            const bGrad=ctx.createLinearGradient(bx,by,bx+bw,by);
            bGrad.addColorStop(0,'#060e08'); bGrad.addColorStop(0.35,'#101810'); bGrad.addColorStop(0.65,'#101810'); bGrad.addColorStop(1,'#060e08');
            ctx.fillStyle=bGrad;
            ctx.beginPath(); ctx.moveTo(bx+3,by+4); ctx.lineTo(bx+bw-3,by+4);
            ctx.lineTo(bx+bw+1,by+bh-4); ctx.lineTo(bx-1,by+bh-4); ctx.closePath(); ctx.fill();
            ctx.strokeStyle=bc; ctx.lineWidth=1;
            [0.18,0.42,0.66,0.88].forEach(t => {
                const fy=by+bh*t, fw=bw*(0.85+0.15*Math.sin(t*Math.PI)), fx=bx+(bw-fw)/2;
                ctx.beginPath(); ctx.moveTo(fx,fy); ctx.lineTo(fx+fw,fy); ctx.stroke();
            });
            const cx2=bx+bw/2, cy2=by+bh*0.52;
            ctx.strokeStyle=bc+'aa'; ctx.lineWidth=0.8;
            ctx.beginPath(); ctx.arc(cx2,cy2,6,0,Math.PI*2); ctx.stroke();
            ctx.beginPath(); ctx.arc(cx2,cy2,2.5,0,Math.PI*2); ctx.stroke();
            for(let i=0;i<3;i++){const a=(Math.PI*2/3)*i-Math.PI/2; ctx.beginPath(); ctx.moveTo(cx2+Math.cos(a)*2.5,cy2+Math.sin(a)*2.5); ctx.lineTo(cx2+Math.cos(a)*6,cy2+Math.sin(a)*6); ctx.stroke();}
        } else {
            // trash_bag
            const bx=this.x, by=this.y, bw=this.width, bh=this.height;
            ctx.shadowBlur=5; ctx.shadowColor='rgba(0,255,136,0.4)';
            const bagGrad=ctx.createLinearGradient(bx,by,bx+bw,by+bh);
            bagGrad.addColorStop(0,'#0c1a10'); bagGrad.addColorStop(1,'#060e08');
            ctx.fillStyle=bagGrad;
            ctx.beginPath();
            ctx.moveTo(bx+bw*0.15,by+4);
            ctx.quadraticCurveTo(bx+bw/2,by-4,bx+bw*0.85,by+4);
            ctx.lineTo(bx+bw+2,by+bh-4);
            ctx.quadraticCurveTo(bx+bw/2,by+bh+3,bx-2,by+bh-4);
            ctx.lineTo(bx+bw*0.15,by+4);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle='rgba(0,255,136,0.4)'; ctx.lineWidth=1; ctx.stroke();
            ctx.fillStyle='rgba(0,255,136,0.25)';
            ctx.beginPath(); ctx.arc(bx+bw/2,by+4,4,0,Math.PI*2); ctx.fill();
            ctx.strokeStyle='rgba(0,255,136,0.6)'; ctx.lineWidth=0.8;
            ctx.beginPath(); ctx.arc(bx+bw/2,by+4,4,0,Math.PI*2); ctx.stroke();
            ctx.strokeStyle='rgba(0,255,136,0.15)'; ctx.lineWidth=0.5;
            ctx.beginPath(); ctx.moveTo(bx+bw*0.3,by+bh*0.25); ctx.lineTo(bx+bw*0.25,by+bh*0.7); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx+bw*0.7,by+bh*0.2); ctx.lineTo(bx+bw*0.72,by+bh*0.68); ctx.stroke();
        }
        ctx.restore();
    }
}

class Coin {
    constructor() {
        this.x = canvas.width + 40;
        this.y = floorY - 55 - Math.random() * 70;
        this.size = 14;
        this.pulse = Math.random() * Math.PI * 2;
    }
    update() {
        this.x -= gameSpeed;
        this.pulse += 0.12;
        if (adrenalineActive && player) { this.x -= 2; this.y += (player.y + 15 - this.y) * 0.15; }
    }
    draw() {
        const p = Math.sin(this.pulse) * 0.15 + 0.85;
        const s = this.size * p;
        const cx = this.x + this.size/2;
        const cy = this.y + this.size/2;
        ctx.save();
        // Glow exterior
        ctx.shadowBlur = 10; ctx.shadowColor = '#00ffff';
        // Rombo neón
        ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 1.5;
        ctx.fillStyle = 'rgba(0,255,255,0.15)';
        ctx.beginPath();
        ctx.moveTo(cx, cy - s*0.7);
        ctx.lineTo(cx + s*0.5, cy);
        ctx.lineTo(cx, cy + s*0.7);
        ctx.lineTo(cx - s*0.5, cy);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Cruz interior
        ctx.strokeStyle = 'rgba(0,255,255,0.6)'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(cx-s*0.3, cy); ctx.lineTo(cx+s*0.3, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy-s*0.4); ctx.lineTo(cx, cy+s*0.4); ctx.stroke();
        ctx.restore();
    }
}

// Redibujamos el draw de Obstacle dentro de su clase existente
// (usamos patch en la función draw)

// --- RENDERIZADO DEL ENTORNO Y HUD ---
function drawCyberpunkHUD() {
    const CW = canvas.width;
    const CH = canvas.height;
    const scale = Math.min(CW / 800, CH / 450, 1.5);
    const px = 18 * scale;
    const py = 16 * scale;
    const hudW = 310 * scale;
    const fs  = Math.max(10, Math.round(12 * scale));
    const fsS = Math.max(8,  Math.round(9  * scale));
    const lh  = fs + 7;

    const dist = DISTRICTS[currentDistrict] || DISTRICTS[1];
    ctx.save();

    // ── PANEL PRINCIPAL ──────────────────────────────────
    const panelH = lh * 5.6 + py * 0.5;
    ctx.fillStyle = 'rgba(2, 5, 16, 0.82)';
    // Forma con esquina recortada
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + hudW - 22*scale, py);
    ctx.lineTo(px + hudW, py + 22*scale);
    ctx.lineTo(px + hudW, py + panelH);
    ctx.lineTo(px, py + panelH);
    ctx.closePath();
    ctx.fill();

    // Borde neón con glow
    ctx.shadowBlur = 8 * scale; ctx.shadowColor = dist.laserColor;
    ctx.strokeStyle = dist.laserColor + '88'; ctx.lineWidth = 1 * scale;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Línea lateral izquierda accentuada
    ctx.fillStyle = dist.laserColor;
    ctx.fillRect(px, py, 2*scale, panelH);

    const tx = px + 14*scale;
    let ty = py + lh;

    // ── LÍNEA 1: DISTRITO ───────────────────────────────
    ctx.font = `bold ${fsS}px 'Share Tech Mono', 'Courier New'`;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('NODE', tx, ty - lh*0.5);

    ctx.font = `bold ${fs}px 'Share Tech Mono', 'Courier New'`;
    ctx.shadowBlur = 6*scale; ctx.shadowColor = dist.laserColor;
    ctx.fillStyle = dist.laserColor;
    ctx.fillText(`D0${currentDistrict}  ${dist.name}${dist.secret&&d4Unlocked?" [VOID]":""}`, tx + 32*scale, ty - lh*0.4);
    ctx.shadowBlur = 0;

    // ── LÍNEA 2: SCORE + DISTANCIA (en dos columnas) ───
    ctx.font = `bold ${fsS}px 'Share Tech Mono', 'Courier New'`;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('CRED', tx, ty + lh*0.5);
    ctx.fillText('DIST', tx + hudW*0.52, ty + lh*0.5);

    ctx.font = `bold ${Math.round(fs*1.1)}px 'Share Tech Mono', 'Courier New'`;
    ctx.shadowBlur = 8*scale; ctx.shadowColor = '#ffe000';
    ctx.fillStyle = '#ffe000';
    ctx.fillText(`${score}`, tx + 36*scale, ty + lh*0.55);
    ctx.shadowBlur = 4*scale; ctx.shadowColor = '#00ff88';
    ctx.fillStyle = '#00ff88';
    ctx.fillText(`${Math.floor(distanceTraveled / 10)}m`, tx + hudW*0.52 + 28*scale, ty + lh*0.55);
    ctx.shadowBlur = 0;

    // ── LÍNEA 3: MULTIPLICADOR Y DIFICULTAD ────────────
    ty += lh * 1.15;
    const multColor = adrenalineActive ? '#ff00aa' : (scoreMultiplier > 1 ? '#00ff88' : 'rgba(255,255,255,0.3)');
    ctx.font = `bold ${fs}px 'Share Tech Mono', 'Courier New'`;
    ctx.shadowBlur = scoreMultiplier > 1 ? 8*scale : 0; ctx.shadowColor = multColor;
    ctx.fillStyle = multColor;
    ctx.fillText(`×${scoreMultiplier}`, tx, ty);
    ctx.shadowBlur = 0;

    // Dificultad a la derecha
    const diffColors = { easy: '#00ff88', normal: '#00ffff', hard: '#ff2244' };
    ctx.fillStyle = diffColors[chosenDifficulty] || '#00ffff';
    ctx.font = `${fsS}px 'Share Tech Mono', 'Courier New'`;
    ctx.fillText(`[${chosenDifficulty.toUpperCase()}]`, tx + 36*scale, ty);

    ty += lh * 0.75;

    // ── BARRA DE COMBO ──────────────────────────────────
    const comboW = hudW - 26*scale;
    const dotW = 8*scale; const dotGap = 12*scale;
    // Label
    ctx.font = `${fsS}px 'Share Tech Mono', 'Courier New'`;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('COMBO', tx, ty);
    ty += fsS + 2;
    // Track
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(tx, ty, comboW, 3*scale);
    // Dots
    const comboColor = adrenalineActive ? '#ff00aa' : (scoreMultiplier > 1 ? '#00ff88' : '#ff2244');
    ctx.shadowBlur = 5*scale; ctx.shadowColor = comboColor;
    ctx.fillStyle = comboColor;
    let cap = adrenalineActive ? Math.floor(adrenalineTimer / 30) : dataCombo;
    for (let i = 0; i < cap; i++) ctx.fillRect(tx + i*dotGap, ty, dotW, 3*scale);
    ctx.shadowBlur = 0;

    ty += lh * 0.75;

    // ── BARRA DE XP ─────────────────────────────────────
    const reqXP = dist.xpRequired;
    const xpPct = Math.min(playerXP / reqXP, 1);
    const xpW = hudW - 26*scale;
    // Label
    ctx.font = `${fsS}px 'Share Tech Mono', 'Courier New'`;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText(`XP  ${Math.floor(playerXP)}/${reqXP}`, tx, ty);
    ty += fsS + 2;
    // Track
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(tx, ty, xpW, 4*scale);
    // Fill con gradiente
    const xpGrad = ctx.createLinearGradient(tx, ty, tx + xpW * xpPct, ty);
    xpGrad.addColorStop(0, '#00aaff');
    xpGrad.addColorStop(1, '#00ffff');
    ctx.shadowBlur = 6*scale; ctx.shadowColor = '#00ffff';
    ctx.fillStyle = xpGrad;
    ctx.fillRect(tx, ty, xpW * xpPct, 4*scale);
    ctx.shadowBlur = 0;

    // ── ESCUDO (si activo) ──────────────────────────────
    if (hasShield) {
        ctx.font = `${fsS}px 'Share Tech Mono', 'Courier New'`;
        ctx.shadowBlur = 6*scale; ctx.shadowColor = '#00ffff';
        ctx.fillStyle = '#00ffff';
        ctx.fillText('🛡 SHIELD ONLINE', tx, ty + lh * 0.9);
        ctx.shadowBlur = 0;
    }

    // ── BARRA DE PERKS ACTIVOS (horizontal, debajo del panel HUD) ──
    {
        const perks = [];
        if (magnetActive)     perks.push({icon:'◎', color:'#00ccff', pct:magnetTimer/upgrades.magnet.duration,     label:'IMAN '+Math.ceil(magnetTimer/60)+'s'});
        if (invulnActive)     perks.push({icon:'✦', color:'#ffaa00', pct:invulnTimer/upgrades.invuln.duration,     label:'INV '+Math.ceil(invulnTimer/60)+'s'});
        if (canRevive)        perks.push({icon:'↺', color:'#ff0080', pct:1,                                         label:'REVIVE'});
        if (adrenalineActive) perks.push({icon:'⚡', color:'#ff00aa', pct:adrenalineTimer/300,                     label:'ADR '+Math.ceil(adrenalineTimer/60)+'s'});
        if (ghostPhaseLeft>0) perks.push({icon:'👻', color:'#eeeeff', pct:ghostPhaseLeft/45,                       label:'PHASE'});
        if (pyroShieldActive) perks.push({icon:'🔥', color:'#ff6600', pct:pyroShieldTimer/60,                      label:'HEAT'});
        if (!empReady)        perks.push({icon:'⚡', color:'#ffe000', pct:1-(empCooldown/EMP_COOLDOWN_FRAMES),     label:'EMP '+Math.ceil(empCooldown/60)+'s'});

        if (perks.length > 0) {
            const bw = 54*scale, bh = 26*scale, gap = 5*scale;
            let bx = px;
            const by = py + panelH + 5*scale;
            ctx.save();
            perks.forEach(pk => {
                ctx.fillStyle = pk.color+'16';
                ctx.strokeStyle = pk.color+'55'; ctx.lineWidth = 1;
                ctx.fillRect(bx, by, bw, bh); ctx.strokeRect(bx, by, bw, bh);
                // progress bar at bottom
                ctx.fillStyle = pk.color+'22'; ctx.fillRect(bx, by+bh-3*scale, bw, 3*scale);
                ctx.fillStyle = pk.color; ctx.shadowBlur=3; ctx.shadowColor=pk.color;
                ctx.fillRect(bx, by+bh-3*scale, bw*pk.pct, 3*scale);
                ctx.shadowBlur=0;
                // icon
                ctx.font = `${Math.max(9,Math.round(10*scale))}px serif`;
                ctx.textAlign='center'; ctx.textBaseline='middle';
                ctx.fillStyle=pk.color; ctx.fillText(pk.icon, bx+bw*0.28, by+bh*0.44);
                // label
                ctx.font = `${Math.max(7,Math.round(7.5*scale))}px 'Share Tech Mono',monospace`;
                ctx.fillStyle='rgba(255,255,255,0.82)'; ctx.fillText(pk.label, bx+bw*0.67, by+bh*0.44);
                bx += bw+gap;
            });
            ctx.textAlign='left'; ctx.textBaseline='alphabetic';
            ctx.restore();
        }
    }

    // ── CONTADOR DE CHIPS (esquina inferior derecha del HUD) ─
    if (runStats.chipsCollected > 0 || true) {
        const chipCount = runStats.chipsCollected || 0;
        const chipX = CW - 14*scale;
        const chipY = CH - Math.max(30*scale, 30);
        ctx.save();
        ctx.font = `${Math.max(9, Math.round(10*scale))}px 'Share Tech Mono','Courier New'`;
        ctx.textAlign = 'right';
        ctx.fillStyle = chipCount >= 20 ? '#ff00ff' : 'rgba(255,0,255,0.55)';
        ctx.shadowBlur = chipCount >= 20 ? 8*scale : 3*scale;
        ctx.shadowColor = '#ff00ff';
        ctx.fillText(`◈ CHIPS ${chipCount}/20`, chipX, chipY);
        ctx.shadowBlur = 0; ctx.textAlign = 'left';
        ctx.restore();
    }
    if (adrenalineActive) {
        const ax = CW - 160*scale; const ay = py;
        const aW = 150*scale; const aH = 40*scale;
        ctx.fillStyle = 'rgba(40,0,25,0.85)';
        ctx.fillRect(ax, ay, aW, aH);
        ctx.strokeStyle = '#ff00aa'; ctx.lineWidth = 1*scale;
        ctx.shadowBlur = 10*scale; ctx.shadowColor = '#ff00aa';
        ctx.strokeRect(ax, ay, aW, aH);
        ctx.fillStyle = '#ff00aa';
        ctx.font = `bold ${fs}px 'Share Tech Mono', 'Courier New'`;
        ctx.textAlign = 'center';
        ctx.fillText('⚡ ADRENALINA', ax + aW/2, ay + aH*0.45);
        ctx.font = `${fsS}px 'Share Tech Mono', 'Courier New'`;
        ctx.fillStyle = 'rgba(255,0,170,0.7)';
        ctx.fillText(`${Math.ceil(adrenalineTimer/60)}s`, ax + aW/2, ay + aH*0.8);
        ctx.textAlign = 'left';
        ctx.shadowBlur = 0;
    }

    // (sistema de vidas eliminado — muerte directa)

    // ── EVENTO ACTIVO ────────────────────────────────────────
    if (activeEvent) {
        const evPct = activeEvent.timer / EVENT_DURATION;
        const evW   = CW * 0.28; const evH = 30 * scale;
        const evX   = (CW - evW) / 2; const evY = py;
        ctx.save();
        ctx.fillStyle   = 'rgba(2,4,14,0.88)';
        ctx.strokeStyle = activeEvent.color;
        ctx.lineWidth   = 1.5 * scale;
        ctx.shadowBlur  = 8; ctx.shadowColor = activeEvent.color;
        ctx.beginPath();
        ctx.moveTo(evX+8*scale, evY); ctx.lineTo(evX+evW-8*scale, evY);
        ctx.lineTo(evX+evW, evY+evH*0.4); ctx.lineTo(evX+evW-8*scale, evY+evH);
        ctx.lineTo(evX+8*scale, evY+evH); ctx.lineTo(evX, evY+evH*0.4);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle   = activeEvent.color;
        ctx.shadowBlur  = 0;
        ctx.font        = `bold ${Math.max(9, Math.round(10*scale))}px 'Share Tech Mono','Courier New'`;
        ctx.textAlign   = 'center';
        ctx.fillText(activeEvent.label, CW/2, evY + evH*0.58);
        // Barra de tiempo restante
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(evX, evY+evH+2*scale, evW, 2*scale);
        ctx.fillStyle = activeEvent.color;
        ctx.fillRect(evX, evY+evH+2*scale, evW*evPct, 2*scale);
        ctx.textAlign = 'left'; ctx.restore();
    }

    // ── TEMPORIZADOR DE DISTRITO ─────────────────────────────
    {
        const pct = 1 - (districtTimer / DISTRICT_DURATION);
        const bw  = 80*scale; const bx = CW - bw - 14*scale;
        const by  = CH - 16*scale;
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(bx, by, bw, 3*scale);
        ctx.fillStyle = pct < 0.2 ? '#ff2244' : dist.laserColor;
        ctx.shadowBlur = 4; ctx.shadowColor = dist.laserColor;
        ctx.fillRect(bx, by, bw*pct, 3*scale);
        ctx.shadowBlur = 0;
        ctx.font = `${Math.max(7, Math.round(8*scale))}px 'Share Tech Mono','Courier New'`;
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.textAlign = 'right';
        ctx.fillText('ZONA', CW - 14*scale, by - 2*scale);
        ctx.textAlign = 'left'; ctx.restore();
    }

    ctx.restore();
}

function triggerHit() {
    if (adrenalineActive || invulnActive || districtTransitionTimer > 0) return;
    if (activeCharacter === 'ghost' && ghostPhaseLeft > 0) return;
    if (activeCharacter === 'titan' && titanSmashLeft > 0) {
        titanSmashLeft--;
        snd.playSFX('levelup');
        spawnExplosion(player.x+16, player.y+16, '#ffcc00', 25);
        floatingTexts.push(new FloatingText(player.x, player.y-30, 'TITAN SMASH ['+titanSmashLeft+' restantes]', '#ffcc00'));
        if (obstacles.length > 0) obstacles.shift();
        player.immunityFrames = 90; return;
    }
    // Combo break helper
    const breakCombo = () => {
        if (scoreMultiplier > 1) {
            floatingTexts.push(new FloatingText(player.x, player.y-42, 'COMBO PERDIDO x'+scoreMultiplier, '#ff4444'));
            dataCombo = 0; scoreMultiplier = 1;
            snd.playSFX('hit');
        }
    };
    if (hasShield && player) {
        breakCombo();
        hasShield = false; player.immunityFrames = 65; snd.playSFX('hit');
        floatingTexts.push(new FloatingText(player.x, player.y-22, 'ESCUDO DESTRUIDO!', '#ff0055'));
        spawnExplosion(player.x+16, player.y+16, '#00ffff', 25);
        haptic([60,30,60]); return;
    }
    if (player && player.immunityFrames === 0) {
        if (canRevive) {
            breakCombo();
            canRevive = false; invulnActive = true; invulnTimer = 180;
            player.immunityFrames = 180; snd.playSFX('levelup');
            spawnExplosion(player.x+16, player.y+16, '#ff0080', 30);
            floatingTexts.push(new FloatingText(player.x, player.y-35, 'REVIVIDO', '#ff0080'));
            haptic([100,50,200]); return;
        }
        breakCombo();
        gameActive = false; glitchEffectTimer = 25; snd.stop();
        wallet += Math.floor(score * 0.4);
        runStats.totalRuns++;
        if (score > runStats.bestScore) runStats.bestScore = score;
        const distM = Math.floor(distanceTraveled / 10);
        if (distM > runStats.bestDistance) runStats.bestDistance = distM;
        const ndm = Math.floor(noDmgDistance/10);
        if (ndm > (runStats.bestNoDmgDist||0)) runStats.bestNoDmgDist = ndm;
        if (dataCombo > (runStats.bestCombo||0)) runStats.bestCombo = dataCombo;
        addLocalRecord(); checkAchievements();
        updateWeeklyProgress('score', score);
        updateWeeklyProgress('nodmg', ndm);
        updateWeeklyProgress('chips_run', weeklyChipsThisRun);
        saveGameToBrowser();
        haptic([200,100,200]);
        // Muerte: SFX dramático descendente
        if (snd.ac) {
            const t = snd.ac.currentTime;
            const o = snd.ac.createOscillator(); const g = snd.ac.createGain();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(20, t+1.4);
            g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t+1.4);
            const dest = snd.comp || snd.ac.destination;
            o.connect(g); g.connect(dest); o.start(t); o.stop(t+1.4);
            o.onended = () => { try{o.disconnect();g.disconnect();}catch(e){} };
        }
    }
}
function updateShopUI() {
    if (totalCoinsText) totalCoinsText.innerText = wallet;

    // ── EMP ────────────────────────────────────────────────
    const empLvlEl  = document.getElementById('emp-lvl');
    const empDescEl = document.getElementById('emp-desc');
    const buyEmpBtn2 = document.getElementById('buy-emp');
    const empUnlocked = !!(skillTree.empSkill && skillTree.empSkill.level > 0);
    const chargeSec = (upgrades.emp.chargeTime / 60).toFixed(1);
    if (empLvlEl)  empLvlEl.innerText  = upgrades.emp.level;
    if (empDescEl) {
        empDescEl.innerText = empUnlocked
            ? `Agáchate ${chargeSec}s · Destruye obstáculo · 5s cd`
            : `⚠ Requiere PULSO EMP en el Árbol de Habilidades`;
        empDescEl.style.color = empUnlocked ? '' : 'rgba(255,100,50,0.8)';
    }
    if (buyEmpBtn2) {
        buyEmpBtn2.innerText  = empUnlocked ? `MEJORAR (${upgrades.emp.cost} ◈)` : `BLOQUEADO`;
        buyEmpBtn2.disabled   = !empUnlocked || wallet < upgrades.emp.cost;
        buyEmpBtn2.style.borderColor = empUnlocked ? '' : 'rgba(255,100,50,0.4)';
        buyEmpBtn2.style.color = empUnlocked ? '' : 'rgba(255,100,50,0.7)';
    }

    // ── IMÁN ───────────────────────────────────────────────
    const magnetLvlEl  = document.getElementById('magnet-lvl');
    const magnetDescEl = document.getElementById('magnet-desc');
    const buyMagnetBtn = document.getElementById('buy-magnet');
    const magSec = (upgrades.magnet.duration / 60).toFixed(0);
    if (magnetLvlEl)  magnetLvlEl.innerText  = upgrades.magnet.level;
    if (magnetDescEl) magnetDescEl.innerText = `Atrae monedas cercanas · Dura ${magSec}s`;
    if (buyMagnetBtn) { buyMagnetBtn.innerText = `MEJORAR (${upgrades.magnet.cost} ◈)`; buyMagnetBtn.disabled = wallet < upgrades.magnet.cost; }

    // ── INVULN ─────────────────────────────────────────────
    const invulnLvlEl  = document.getElementById('invuln-lvl');
    const invulnDescEl = document.getElementById('invuln-desc');
    const buyInvulnBtn = document.getElementById('buy-invuln');
    const invSec = (upgrades.invuln.duration / 60).toFixed(0);
    if (invulnLvlEl)  invulnLvlEl.innerText  = upgrades.invuln.level;
    if (invulnDescEl) invulnDescEl.innerText = `Recoge orbe dorado · Sin daño ${invSec}s`;
    if (buyInvulnBtn) { buyInvulnBtn.innerText = `MEJORAR (${upgrades.invuln.cost} ◈)`; buyInvulnBtn.disabled = wallet < upgrades.invuln.cost; }

    // ── SHIELD ─────────────────────────────────────────────
    if (buyShieldBtn) {
        if (hasShield) { buyShieldBtn.innerText = '🛡 ESCUDO ACTIVO'; buyShieldBtn.disabled = true; buyShieldBtn.style.borderColor = 'rgba(0,255,255,0.5)'; }
        else { buyShieldBtn.innerText = `COMPRAR (50 ◈)`; buyShieldBtn.disabled = wallet < 50; buyShieldBtn.style.borderColor = ''; }
    }

    // ── REVIVIR ────────────────────────────────────────────
    const buyReviveBtn = document.getElementById('buy-revive');
    if (buyReviveBtn) {
        if (canRevive) { buyReviveBtn.innerText = '↺ REVIVE ACTIVO'; buyReviveBtn.disabled = true; buyReviveBtn.style.borderColor = 'rgba(255,0,128,0.5)'; buyReviveBtn.style.color = 'var(--pink)'; }
        else { buyReviveBtn.innerText = `COMPRAR (60 ◈)`; buyReviveBtn.disabled = wallet < 60; buyReviveBtn.style.borderColor = ''; buyReviveBtn.style.color = ''; }
    }

    // ── AGENTES ────────────────────────────────────────────
    Object.entries(CHAR_DEFS).forEach(([key, def]) => {
        const btn  = document.getElementById(key === 'human' ? 'equip-human' : `buy-${key}`);
        const card = document.getElementById(`agent-${key}`);
        if (!btn) return;
        if (card) card.classList.toggle('active-agent', activeCharacter === key);
        if (activeCharacter === key) {
            btn.innerText = 'ENLAZADO'; btn.disabled = true;
            btn.style.color = def.color; btn.style.borderColor = def.color;
        } else if (characters[key].unlocked) {
            btn.innerText = 'CONECTAR'; btn.disabled = false;
            btn.style.color = ''; btn.style.borderColor = '';
        } else {
            btn.innerText = `${def.cost} ◈`;
            btn.disabled = wallet < def.cost;
            btn.style.color = ''; btn.style.borderColor = '';
        }
    });

    // ── CHIPS PANEL ─────────────────────────────────────────
    const collected = runStats.chipsCollected || 0;
    const chipsEl = document.getElementById('chips-collected');
    const chipsBar = document.getElementById('chips-bar');
    const chipsGrid = document.getElementById('chips-grid');
    const chipsSecret = document.getElementById('chips-secret');
    if (chipsEl) chipsEl.innerText = collected;
    if (chipsBar) chipsBar.style.width = Math.min(100, (collected/20)*100) + '%';
    if (chipsGrid && chipsGrid.children.length !== 20) {
        chipsGrid.innerHTML = '';
        for (let i = 0; i < 20; i++) {
            const slot = document.createElement('div');
            slot.className = 'chip-slot' + (i < collected ? ' collected' : '');
            slot.innerHTML = i < collected ? '◈' : '·';
            chipsGrid.appendChild(slot);
        }
    } else if (chipsGrid) {
        Array.from(chipsGrid.children).forEach((slot, i) => {
            slot.className = 'chip-slot' + (i < collected ? ' collected' : '');
            slot.innerHTML = i < collected ? '◈' : '·';
        });
    }
    if (chipsSecret) {
        if (collected >= 20) {
            chipsSecret.classList.add('unlocked');
            chipsSecret.querySelector('.chips-secret-icon').innerText = '🔓';
            chipsSecret.querySelector('.chips-secret-text').innerHTML =
                'SECRETO ACTIVO<br><span>GHOST LIBRE · MODO LEYENDA DESBLOQUEADO</span>';
        }
    }
    const distM    = Math.floor(distanceTraveled / 10);
    const distName = (DISTRICTS[currentDistrict] || DISTRICTS[1]).name;
    if (elLastScore)    elLastScore.innerText    = score > 0 ? `${score} ◈` : '—';
    if (elLastDistance) elLastDistance.innerText = distanceTraveled > 0 ? `${distM}m` : '—';
    if (elLastDistrict) elLastDistrict.innerText = distanceTraveled > 0 ? distName : '—';
    if (elBestScore)    elBestScore.innerText    = runStats.bestScore > 0 ? `${runStats.bestScore} ◈` : '—';
    if (elBestDistance) elBestDistance.innerText = runStats.bestDistance > 0 ? `${runStats.bestDistance}m` : '—';
    if (elTotalRuns)    elTotalRuns.innerText    = runStats.totalRuns > 0 ? runStats.totalRuns : '—';

    // ── TOP 5 INLINE en tab-stats ────────────────────────────
    const statsTopList = document.getElementById('stats-top-list');
    if (statsTopList) {
        if (localRecords.length === 0) {
            statsTopList.innerHTML = '<div class="stats-empty">Sin partidas registradas</div>';
        } else {
            statsTopList.innerHTML = localRecords.map((r, i) => `
                <div class="stats-top-row ${i===0?'stats-top-gold':''}">
                    <span class="stp-rank">#${i+1}</span>
                    <span class="stp-score neon-text-blue">${r.score}◈</span>
                    <span class="stp-dist neon-text-green">${r.distance}m</span>
                    <span class="stp-char">${(CHAR_DEFS[r.character]||{label:'?'}).label}</span>
                    <span class="stp-date">${r.date||''}</span>
                </div>`).join('');
        }
    }

    // ── ÁRBOL DE HABILIDADES — visual con hexágonos e iconos ─
    // ── ÁRBOL DE HABILIDADES (canvas renderizado) ───────────
    const stCanvas = document.getElementById('skill-tree-canvas');
    if (stCanvas && !_stAnimFrame) {
        // Solo dibujar directamente si la animación no está corriendo
        drawSkillTree(stCanvas);
    }

    // ── LOGROS con barras de progreso ───────────────────────
    const achievGrid = document.getElementById('achiev-grid');
    if (achievGrid) {
        achievGrid.innerHTML = '';
        ACHIEVEMENTS.forEach(a => {
            const el = document.createElement('div');
            el.className = `achiev-item ${a.unlocked?'unlocked':'locked'}`;

            // Calcular progreso para logros bloqueados
            let progressHtml = '';
            if (!a.unlocked) {
                let cur = 0, max = 1;
                if (a.id==='first_run'||a.id==='runs10'||a.id==='runs50') { cur=runStats.totalRuns||0; max=a.check.toString().match(/\d+/)?.[0]||1; }
                else if (a.id==='combo5') { cur=runStats.bestCombo||0; max=5; }
                else if (a.id==='dist1000') { cur=runStats.bestDistance||0; max=1000; }
                else if (a.id==='dist5000') { cur=runStats.bestDistance||0; max=5000; }
                else if (a.id==='score500') { cur=runStats.bestScore||0; max=500; }
                else if (a.id==='score2000') { cur=runStats.bestScore||0; max=2000; }
                else if (a.id==='chip5'||a.id==='chip20') { cur=runStats.chipsCollected||0; max=a.id==='chip5'?5:20; }
                else if (a.id==='no_hit_run') { cur=runStats.bestNoDmgDist||0; max=500; }
                else if (a.id==='weekly1') { cur=runStats.weeklyClear||0; max=1; }
                const pct = Math.min(1, cur/max);
                if (pct > 0) {
                    progressHtml = `<div class="achiev-progress-wrap"><div class="achiev-progress-bar" style="width:${Math.round(pct*100)}%"></div><span class="achiev-progress-label">${typeof cur==='number'?Math.floor(cur):cur}/${max}</span></div>`;
                }
            }

            el.innerHTML = `
                <div class="achiev-icon">${a.unlocked?a.icon:'?'}</div>
                <div class="achiev-info">
                    <div class="achiev-label">${a.label}</div>
                    <div class="achiev-desc">${a.unlocked?a.desc:'???'}</div>
                    ${progressHtml}
                </div>
                <div class="achiev-reward">${a.reward}◈</div>`;
            achievGrid.appendChild(el);
        });
    }

    // ── RÉCORDS ──────────────────────────────────────────────
    const recordsList = document.getElementById('records-list');
    if (recordsList) {
        recordsList.innerHTML = localRecords.length === 0
            ? '<div class="records-empty">// Sin partidas registradas aún</div>'
            : localRecords.map((r,i) => `<div class="record-row"><div class="record-rank">#${i+1}</div><div class="record-score">${r.score}◈</div><div class="record-dist">${r.distance}m</div><div class="record-char">${(CHAR_DEFS[r.character]||{label:'?'}).label}</div><div class="record-date">${r.date}</div></div>`).join('');
    }

    // ── DESAFÍO SEMANAL con días restantes ──────────────────
    const weeklyCard = document.getElementById('weekly-card');
    if (weeklyCard && weeklyChallenge) {
        const pct = Math.min(1, (weeklyChallenge.progress||0) / weeklyChallenge.target);
        // Calcular días restantes
        const msPerWeek = 7*24*3600*1000;
        const weekStart = weeklyChallenge.weekNum * msPerWeek;
        const msLeft = (weekStart + msPerWeek) - Date.now();
        const daysLeft = Math.max(0, Math.ceil(msLeft / (24*3600*1000)));
        const hoursLeft = Math.max(0, Math.ceil(msLeft / 3600000));
        const renewStr = daysLeft > 0
            ? `Renueva en ${daysLeft} día${daysLeft!==1?'s':''}`
            : `Renueva en ${hoursLeft}h`;

        weeklyCard.innerHTML = weeklyChallenge.cleared
            ? `<div class="weekly-label">${weeklyChallenge.label}</div>
               <div class="weekly-cleared">★ COMPLETADO ★</div>
               <div class="weekly-reward">Recompensa cobrada: ${weeklyChallenge.reward}◈</div>
               <div class="weekly-renew">${renewStr}</div>`
            : `<div class="weekly-label">${weeklyChallenge.label}</div>
               <div class="weekly-desc">${weeklyChallenge.desc}</div>
               <div class="weekly-progress-wrap">
                   <div class="weekly-prog-bar"><div class="weekly-prog-fill" style="width:${Math.round(pct*100)}%"></div></div>
                   <div class="weekly-prog-label">${Math.floor(weeklyChallenge.progress||0)} / ${weeklyChallenge.target}</div>
               </div>
               <div class="weekly-reward">Recompensa: ${weeklyChallenge.reward}◈</div>
               <div class="weekly-renew">${renewStr}</div>`;
    }
}

function checkCollision(rect1, rect2) { return rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x && rect1.y < rect2.y + rect2.height && rect1.y + rect1.height > rect2.y; }

// --- BUCLE DE ACTUALIZACIÓN ---
function update() {
    for (let i = floatingTexts.length - 1; i >= 0; i--) { floatingTexts[i].update(); if (floatingTexts[i].alpha <= 0) floatingTexts.splice(i, 1); }
    for (let i = particles.length - 1; i >= 0; i--) { particles[i].update(); if (particles[i].alpha <= 0) particles.splice(i, 1); }
    
    if (!gameActive) {
        if (glitchEffectTimer > 0) {
            glitchEffectTimer--;
            if (glitchEffectTimer === 0) {
                openShopWithStats();
            }
        }
        return;
    }

    if (districtTransitionTimer > 0) {
        districtTransitionTimer--;
        if (districtTransitionTimer === 0) {
            buildings.forEach(b => b.generateWindows()); generateStars(); snd.stop(); snd.init();
        }
        return;
    }

    // Pausa
    if (gamePaused) return;

    // Temporizador de distrito — transición automática cada 60s
    districtTimer++;
    if (districtTimer >= DISTRICT_DURATION) {
        districtTimer = 0;
        const maxDistrict = d4Unlocked ? 4 : 3;
        const nextDistrict = (currentDistrict % maxDistrict) + 1;
        // Desbloquear D4 la primera vez que se completa D3
        if (currentDistrict === 3 && !d4Unlocked) {
            d4Unlocked = true;
            saveGameToBrowser();
            floatingTexts.push(new FloatingText(canvas.width*0.15, canvas.height*0.35,
                'VOID PROTOCOL DESBLOQUEADO', '#cc00ff'));
        }
        currentDistrict = nextDistrict;
        districtTransitionTimer = 90;
        snd.playSFX('levelup');
        updateWeeklyProgress('districts', 1);  // cuenta distritos visitados
        const nextName = (DISTRICTS[nextDistrict]||DISTRICTS[1]).name;
        const nextColor = nextDistrict === 4 ? '#cc00ff' : '#00ffff';
        floatingTexts.push(new FloatingText(canvas.width*0.2, canvas.height*0.4,
            'ACCEDIENDO A: ' + nextName, nextColor));
    }

    // Eventos aleatorios
    tryTriggerEvent();
    updateEvent();

    if (adrenalineActive && player) {
        adrenalineTimer--; if (Math.random() > 0.3) particles.push(new Particle(player.x, player.y + Math.random()*40, '#ff00aa'));
        if (adrenalineTimer <= 0) { adrenalineActive = false; gameSpeed /= 1.8; floatingTexts.push(new FloatingText(player.x, player.y - 40, "CRASH DE ADRENALINA", '#ff0055')); }
    }

    // ── IMÁN ────────────────────────────────────────────────
    if (magnetActive) {
        magnetTimer--;
        if (magnetTimer <= 0) { magnetActive = false; floatingTexts.push(new FloatingText(player ? player.x : 100, player ? player.y-30 : 100, 'IMÁN DESACTIVADO', '#00ccff')); }
        // Atraer monedas hacia el jugador
        if (player) coins.forEach(c => {
            const dx = (player.x + player.width/2) - (c.x + c.size/2);
            const dy = (player.y + player.height/2) - (c.y + c.size/2);
            const d = Math.sqrt(dx*dx + dy*dy);
            if (d < 200) { c.x += dx/d * 6; c.y += dy/d * 6; }
        });
    }

    // ── INVULNERABILIDAD ────────────────────────────────────
    if (invulnActive) {
        invulnTimer--;
        if (invulnTimer <= 0) { invulnActive = false; floatingTexts.push(new FloatingText(player ? player.x : 100, player ? player.y-30 : 100, 'INVULNERABILIDAD TERMINADA', '#ffaa00')); }
        if (player) player.immunityFrames = 2; // mantiene inmunidad activa
    }

    // ── LÓGICA EMP ──────────────────────────────────────────
    if (empCooldown > 0) { empCooldown--; if (empCooldown === 0) empReady = true; }
    if (empCharging && player && player.isCrouching) {
        empChargeTimer++;
        if (empChargeTimer >= upgrades.emp.chargeTime) {
            empCharging = false; empReady = false; empCooldown = EMP_COOLDOWN_FRAMES;
            empChargeTimer = 0;
            let closest = null; let minDist = Infinity;
            obstacles.forEach(o => {
                const dist = o.x - (player.x + player.width);
                if (dist > -10 && dist < minDist) { minDist = dist; closest = o; }
            });
            if (closest) {
                const idx = obstacles.indexOf(closest);
                if (idx !== -1) { spawnExplosion(closest.x+(closest.width||20)/2, closest.y+(closest.height||20)/2, '#ffe000', 20); obstacles.splice(idx, 1); }
            }
            glitchEffectTimer = 0;
            floatingTexts.push(new FloatingText(player.x, player.y-35, '⚡ EMP ACTIVADO', '#ffe000'));
            if (closest) updateWeeklyProgress('emp_kills', 1);
            snd.playSFX('levelup');
        }
    } // fin EMP

    // Special D4 events
    if (activeEvent) {
        if (activeEvent.type === 'void_surge') gameSpeed = Math.min(gameSpeed * 1.001, 20);
        if (activeEvent.type === 'data_storm' && Math.random() > 0.7) coins.push(new Coin());
    }

    // Weekly: speedrun (distancia en tiempo)
    if (weeklyChallenge && weeklyChallenge.type === 'speedrun') {
        if (!weeklyChallenge._startDist) weeklyChallenge._startDist = distanceTraveled;
        if (!weeklyChallenge._startTime) weeklyChallenge._startTime = Date.now();
        const elapsed = (Date.now() - weeklyChallenge._startTime) / 1000;
        const distCovered = (distanceTraveled - weeklyChallenge._startDist) / 10;
        if (distCovered >= weeklyChallenge.target && elapsed <= 30) {
            updateWeeklyProgress('speedrun', weeklyChallenge.target);
        }
    }

    // Weekly: D4 survival time
    if (currentDistrict === 4 && gameActive) {
        updateWeeklyProgress('d4_time', 1);
    }
    // Weekly: D3 survival time
    if (currentDistrict === 3 && gameActive) {
        updateWeeklyProgress('d3_time', 1);
    }

    let diffConfig = DIFFICULTIES[chosenDifficulty] || DIFFICULTIES['normal'];
    gameSpeed += diffConfig.acceleration;
    distanceTraveled += gameSpeed;
    noDmgDistance   += gameSpeed;  // reset on hit

    // Weekly progress: distancia y combo_time y d3_time
    updateWeeklyProgress('distance', gameSpeed / 10);
    if (currentDistrict === 3) updateWeeklyProgress('d3_time', 1);
    if (scoreMultiplier >= 4) {
        weeklyComboTimer += 1;
        updateWeeklyProgress('combo_time', 1);
    } else { weeklyComboTimer = 0; }

    // Impact puffs
    for (let i = impactPuffs.length-1; i>=0; i--) {
        impactPuffs[i].update();
        if (!impactPuffs[i].alive) impactPuffs.splice(i,1);
    }

    if (currentMission.type === 'distance') checkMissionProgress('distance', gameSpeed);
    if (player) player.update(); if (floorGrid) floorGrid.update(); spawnTimer++;

    // Spawn de objetos — combinaciones cada ~8 spawns normales
    if (spawnTimer % 52 === 0) {
        const rng = Math.random();
        const useCombo = rng < 0.12 && distanceTraveled > 1500; // combos tras 1500m
        if (useCombo) { spawnComboObstacle(); }
        else if (rng < 0.52) obstacles.push(new Obstacle());
        else if (rng < 0.78) coins.push(new Coin());
        else if (rng < 0.88 && !adrenalineActive && powerups.length === 0) powerups.push(new PowerUp());
        else if (rng < 0.93 && collectibles.length < 2) collectibles.push(new Collectible(Math.random() < 0.5 ? 'magnet' : 'invuln'));
        else if (rng < 0.97 && chips.length < 1 && (runStats.chipsCollected||0) < 20) chips.push(new Chip());
    }

    // Obstáculos
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].update();
        if (player && !invulnActive && checkCollision(player, obstacles[i])) { triggerHit(); if (!gameActive) return; }
        if (obstacles[i].type === 'laser' ? obstacles[i].z > 1.4 : obstacles[i].x + obstacles[i].width < -40) obstacles.splice(i, 1);
    }

    // PowerUps (adrenalina)
    for (let i = powerups.length - 1; i >= 0; i--) {
        powerups[i].update();
        if (player && checkCollision(player, powerups[i])) {
            adrenalineActive = true; adrenalineTimer = 300; gameSpeed *= 1.8; snd.playSFX('powerup');
            floatingTexts.push(new FloatingText(player.x, player.y-30, '⚡ ADRENALINA', '#ff00aa')); powerups.splice(i, 1); continue;
        }
        if (powerups[i].x < -30) powerups.splice(i, 1);
    }

    // Coleccionables (imán / invuln)
    for (let i = collectibles.length - 1; i >= 0; i--) {
        collectibles[i].update();
        if (player && checkCollision(player, collectibles[i])) {
            const col = collectibles[i];
            if (col.type === 'magnet') {
                magnetActive = true; magnetTimer = upgrades.magnet.duration;
                floatingTexts.push(new FloatingText(player.x, player.y-30, `◎ IMÁN ACTIVADO (${(upgrades.magnet.duration/60).toFixed(0)}s)`, '#00ccff'));
            } else {
                invulnActive = true; invulnTimer = upgrades.invuln.duration;
                floatingTexts.push(new FloatingText(player.x, player.y-30, `✦ INVULNERABLE (${(upgrades.invuln.duration/60).toFixed(0)}s)`, '#ffaa00'));
            }
            snd.playSFX('coin'); spawnExplosion(col.x+11, col.y+11, col.type==='magnet'?'#00ccff':'#ffaa00', 12);
            collectibles.splice(i, 1); continue;
        }
        if (collectibles[i].x < -30) collectibles.splice(i, 1);
    }

    // Monedas
    for (let i = coins.length - 1; i >= 0; i--) {
        coins[i].update();
        const cBox = { x: coins[i].x, y: coins[i].y, width: coins[i].size, height: coins[i].size };
        if (player && checkCollision(player, cBox)) {
            const comboReq = (activeCharacter === 'human') ? 3 : 5; dataCombo++; coinsCollected++;
            if (dataCombo >= comboReq) { dataCombo = 0; if (scoreMultiplier < 5) { scoreMultiplier++; floatingTexts.push(new FloatingText(player.x, player.y-20, `COMBO X${scoreMultiplier}`, '#00ff88')); } }
            const coinVal = (activeCharacter === 'netrunner') ? 2 : 1;
            score += coinVal * scoreMultiplier; snd.playSFX('coin'); gainXP(12 * scoreMultiplier);
            checkMissionProgress('coins', 1); checkMissionProgress('combo', scoreMultiplier);
            spawnExplosion(coins[i].x, coins[i].y, '#00ffff', 4); coins.splice(i, 1); continue;
        }
        if (coins[i].x < -20) coins.splice(i, 1);
    }

    // Fireballs del Pyro
    for (let i = fireballs.length - 1; i >= 0; i--) {
        fireballs[i].update();
        if (fireballs[i].done) fireballs.splice(i, 1);
    }

    // Chips secretos
    for (let i = chips.length - 1; i >= 0; i--) {
        chips[i].update();
        const cb = { x: chips[i].x, y: chips[i].y, width: chips[i].size, height: chips[i].size };
        if (player && checkCollision(player, cb)) {
            runStats.chipsCollected = (runStats.chipsCollected || 0) + 1;
            spawnExplosion(chips[i].x + chips[i].size/2, chips[i].y + chips[i].size/2, '#ff00ff', 16);
            snd.playSFX('levelup');
            floatingTexts.push(new FloatingText(player.x, player.y - 35,
                `◈ CHIP [${runStats.chipsCollected}/20]`, '#ff00ff'));
            checkMissionProgress('chips', 1);
            weeklyChipsThisRun++;
            updateWeeklyProgress('chips_week', 1);
            if (runStats.chipsCollected >= 20) unlockSecret();
            saveGameToBrowser(); updateShopUI(); chips.splice(i, 1); continue;
        }
        if (chips[i].x < -30) chips.splice(i, 1);
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Cinemática — tapa todo mientras esté activa
    if (CINEMATIC.phase !== 'idle' && CINEMATIC.phase !== 'done') {
        drawBackground();
        CINEMATIC.draw();
        return;
    }

    drawBackground();

    if (floorGrid) floorGrid.draw();

    // Solo dibujar entidades de juego cuando hay partida activa o glitch
    if (gameActive || glitchEffectTimer > 0) {
        powerups.forEach(p => p.draw());
        collectibles.forEach(c => c.draw());
        chips.forEach(c => c.draw());
        fireballs.forEach(f => f.draw());
        coins.forEach(c => c.draw());
        obstacles.forEach(o => o.draw());
        if (player) player.draw();
        particles.forEach(p => p.draw());
        impactPuffs.forEach(p => p.draw());
        floatingTexts.forEach(ft => ft.draw());
        drawCyberpunkHUD();
    }

    // Overlay de adrenalina — viñeta rosa en bordes
    if (adrenalineActive) {
        const vgn = ctx.createRadialGradient(
            canvas.width/2, canvas.height/2, canvas.height*0.3,
            canvas.width/2, canvas.height/2, canvas.height*0.85
        );
        vgn.addColorStop(0, 'transparent');
        vgn.addColorStop(1, 'rgba(255,0,170,0.18)');
        ctx.fillStyle = vgn;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Glitch de muerte — flash rojo
    if (!gameActive && glitchEffectTimer > 0) {
        if (glitchEffectTimer % 4 > 1) {
            ctx.fillStyle = `rgba(255, 0, 60, ${0.1 + (glitchEffectTimer/25)*0.2})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        // Líneas de glitch horizontales
        if (glitchEffectTimer % 3 === 0) {
            for (let i = 0; i < 4; i++) {
                const gy = Math.random() * canvas.height;
                const gh = Math.random() * 6 + 2;
                ctx.fillStyle = `rgba(255,0,60,0.2)`;
                ctx.fillRect(0, gy, canvas.width, gh);
            }
        }
    }

    // Pantalla de transición de distrito
    if (districtTransitionTimer > 0) {
        const tScale = Math.min(canvas.width / 800, 1.4);
        const fsBig = Math.max(16, Math.round(22 * tScale));
        const fsSml = Math.max(10, Math.round(11 * tScale));
        const dist  = DISTRICTS[currentDistrict] || DISTRICTS[1];
        const prog  = 1 - (districtTransitionTimer / 90);

        // Fondo de transición con gradiente del nuevo distrito
        const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
        sky.addColorStop(0, dist.skyColors[0] + 'dd');
        sky.addColorStop(1, dist.skyColors[dist.skyColors.length-1] + 'dd');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // D4 — efecto de aberración cromática en bordes
        if (currentDistrict === 4) {
            const glitchAmt = Math.sin(districtTransitionTimer * 0.4) * 8 * tScale;
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = 0.18;
            ctx.fillStyle = '#ff0088';
            ctx.fillRect(glitchAmt, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#00ffff';
            ctx.fillRect(-glitchAmt, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
            // Líneas de glitch aleatorias
            if (Math.random() > 0.4) {
                for (let i = 0; i < 4; i++) {
                    const gy = Math.random() * canvas.height;
                    ctx.fillStyle = `rgba(${Math.random()>0.5?'255,0,200':'0,255,255'},0.15)`;
                    ctx.fillRect(0, gy, canvas.width, Math.random() * 4 + 1);
                }
            }
            ctx.restore();
        }

        // Barra de progreso de transición
        const bW = canvas.width * 0.5; const bH = 3 * tScale;
        const bX = (canvas.width - bW) / 2; const bY = canvas.height/2 + fsBig * 3.2;
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(bX, bY, bW, bH);
        ctx.shadowBlur = 8; ctx.shadowColor = dist.laserColor;
        ctx.fillStyle = dist.laserColor; ctx.fillRect(bX, bY, bW * prog, bH);
        ctx.shadowBlur = 0;

        // Texto principal
        ctx.textAlign = 'center';
        ctx.shadowBlur = 16; ctx.shadowColor = dist.laserColor;
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${fsBig}px 'Share Tech Mono', 'Courier New'`;
        ctx.fillText(`ACCEDIENDO A: ${dist.name}`, canvas.width/2, canvas.height/2 - fsBig*0.5);

        // Historia narrativa por distrito
        const storyLines = {
            1: ['Los Neon Slums nunca duermen.', 'Ruido. Caos. Oportunidad.'],
            2: ['Las torres corporativas vigilan cada byte.', 'Aquí la red es un campo de batalla.'],
            3: ['The Black ICE es el límite del sistema.', 'Más allá... solo silencio y velocidad.'],
            4: ['VOID PROTOCOL — territorio sin mapear.', 'Nada aquí sigue las reglas. Corre.']
        };
        const lines = storyLines[currentDistrict] || storyLines[1];
        ctx.font = `${fsSml}px 'Share Tech Mono', 'Courier New'`;
        ctx.shadowBlur = 4; ctx.shadowColor = dist.laserColor + '88';
        ctx.fillStyle = dist.laserColor + 'cc';
        ctx.fillText(lines[0], canvas.width/2, canvas.height/2 + fsBig * 0.8);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.shadowBlur = 0;
        ctx.fillText(lines[1], canvas.width/2, canvas.height/2 + fsBig * 1.6);
        ctx.textAlign = 'left';
    }

    // D4 — glitch sutil permanente durante gameplay
    if (gameActive && currentDistrict === 4 && Math.random() > 0.82) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.05 + Math.random() * 0.07;
        const gy = Math.random() * canvas.height;
        const gh = Math.random() * 3 + 1;
        ctx.fillStyle = Math.random() > 0.5 ? '#ff00cc' : '#00ffff';
        ctx.fillRect((Math.random()-0.5)*8, gy, canvas.width, gh);
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }
}

// --- BUGS TÉCNICOS: VISIBILITYCHANGE + DELTA TIME ---
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (gameActive && !gamePaused) { snd.stop(); }
    } else {
        if (snd.ac && snd.ac.state === 'suspended') snd.ac.resume();
        if (gameActive && !gamePaused) { snd.init(); }
    }
});

// --- LOOP PRINCIPAL CON DELTA TIME CAP ---
let _lastFrameTime = 0;
function loop(ts) {
    const delta = ts - _lastFrameTime;
    _lastFrameTime = ts;
    // Cap: si el tab estuvo en segundo plano (delta > 100ms) no acumular física
    if (delta < 100) {
        if (CINEMATIC.phase !== 'idle' && CINEMATIC.phase !== 'done') {
            CINEMATIC.update();
        } else if (!gamePaused && (gameActive || glitchEffectTimer > 0)) {
            update();
        }
    }
    draw();
    requestAnimationFrame(loop);
}

// --- ENTRADAS DE CONTROL: TECLADO ---
window.addEventListener('keydown', (e) => {
    if (CINEMATIC.phase !== 'idle' && CINEMATIC.phase !== 'done') return;
    if (e.code === 'KeyP' || (e.code === 'Escape' && gameActive)) { togglePause(); return; }
    if (gamePaused) return;
    if (!player) return;
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); player.jump(); }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); player.crouch(true); }
});
window.addEventListener('keyup', (e) => { 
    if (player && (e.code === 'ArrowDown' || e.code === 'KeyS')) player.crouch(false); 
});

// --- ENTRADAS DE CONTROL: TÁCTIL ---

// ── Canvas touchstart — maneja TANTO cinemática COMO gameplay ──
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();

    // Durante cinemática: tap avanza slide (igual que click)
    if (CINEMATIC.phase === 'intro') {
        CINEMATIC.phase = 'tutorial';
        CINEMATIC.slide = 0;
        CINEMATIC.frame = 0;
        CINEMATIC.demoObjs = [];
        return;
    }
    if (CINEMATIC.phase === 'tutorial') {
        CINEMATIC.nextSlide();
        return;
    }

    // Durante partida: mitad derecha = saltar, mitad izquierda = agacharse
    if (!player || !gameActive || gamePaused) return;
    const touch = e.changedTouches[0];
    const rect  = canvas.getBoundingClientRect();
    const relX  = touch.clientX - rect.left;
    if (relX > rect.width / 2) { player.jump(); }
    else { player.crouch(true); }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (CINEMATIC.phase !== 'idle' && CINEMATIC.phase !== 'done') return;
    if (player) player.crouch(false);
}, { passive: false });

// ── Botones táctiles dedicados ──────────────────────────────
const touchJumpBtn   = document.getElementById('touch-jump');
const touchCrouchBtn = document.getElementById('touch-crouch');

if (touchJumpBtn) {
    touchJumpBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (player && gameActive && !gamePaused) player.jump();
    }, { passive: false });
}
if (touchCrouchBtn) {
    touchCrouchBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (player && gameActive && !gamePaused) player.crouch(true);
    }, { passive: false });
    touchCrouchBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (player) player.crouch(false);
    }, { passive: false });
}

// --- SISTEMA DE TABS EN EL SHOP ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    const panel = document.getElementById(`tab-${tabId}`);
    if (btn)   btn.classList.add('active');
    if (panel) panel.classList.add('active');
    // Start/stop skill tree animation
    if (tabId === 'skills') {
        updateShopUI(); // draw once first so canvas is sized
        setTimeout(() => startSkillTreeAnimation(), 30);
    } else {
        stopSkillTreeAnimation();
    }
    if (tabId === 'chips') updateShopUI();
}

// --- REAJUSTE AL GIRAR / REDIMENSIONAR ---
// El layout landscape se maneja 100% en CSS.
// Aquí solo recalibramos el canvas.
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 200));
window.addEventListener('resize', resizeCanvas);

// ── HANDLER: EMP ───────────────────────────────────────────
const buyEmpBtn = document.getElementById('buy-emp');
if (buyEmpBtn) buyEmpBtn.addEventListener('click', () => {
    if (wallet >= upgrades.emp.cost) {
        wallet -= upgrades.emp.cost; upgrades.emp.level++;
        upgrades.emp.chargeTime = Math.max(10, 30 - (upgrades.emp.level-1)*4);
        upgrades.emp.cost = Math.floor(60 * Math.pow(2.2, upgrades.emp.level-1));
        snd.playSFX('levelup'); updateShopUI(); saveGameToBrowser();
    }
});

// ── HANDLER: IMÁN ──────────────────────────────────────────
const buyMagnetBtn = document.getElementById('buy-magnet');
if (buyMagnetBtn) buyMagnetBtn.addEventListener('click', () => {
    if (wallet >= upgrades.magnet.cost) {
        wallet -= upgrades.magnet.cost; upgrades.magnet.level++;
        upgrades.magnet.duration = 300 + (upgrades.magnet.level-1)*60;
        upgrades.magnet.cost = Math.floor(80 * Math.pow(2.0, upgrades.magnet.level-1));
        snd.playSFX('levelup'); updateShopUI(); saveGameToBrowser();
    }
});

// ── HANDLER: INVULN ─────────────────────────────────────────
const buyInvulnBtn = document.getElementById('buy-invuln');
if (buyInvulnBtn) buyInvulnBtn.addEventListener('click', () => {
    if (wallet >= upgrades.invuln.cost) {
        wallet -= upgrades.invuln.cost; upgrades.invuln.level++;
        upgrades.invuln.duration = 180 + (upgrades.invuln.level-1)*60;
        upgrades.invuln.cost = Math.floor(100 * Math.pow(2.0, upgrades.invuln.level-1));
        snd.playSFX('levelup'); updateShopUI(); saveGameToBrowser();
    }
});

// ── HANDLER: SHIELD ────────────────────────────────────────
if (buyShieldBtn) buyShieldBtn.addEventListener('click', () => {
    if (wallet >= 50 && !hasShield) { wallet -= 50; hasShield = true; updateShopUI(); saveGameToBrowser(); }
});

// ── HANDLER: REVIVIR ───────────────────────────────────────
const buyReviveBtn = document.getElementById('buy-revive');
if (buyReviveBtn) buyReviveBtn.addEventListener('click', () => {
    if (wallet >= 60 && !canRevive) { wallet -= 60; canRevive = true; updateShopUI(); saveGameToBrowser(); }
});

// ── HANDLERS: AGENTES (dinámico para los 8 personajes) ────────
Object.entries(CHAR_DEFS).forEach(([key, def]) => {
    const btnId = key === 'human' ? 'equip-human' : `buy-${key}`;
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', () => {
        if (activeCharacter === key) return;
        if (characters[key].unlocked) {
            activeCharacter = key; saveGameToBrowser(); updateShopUI();
        } else if (wallet >= def.cost) {
            wallet -= def.cost; characters[key].unlocked = true;
            activeCharacter = key; snd.playSFX('levelup');
            saveGameToBrowser(); updateShopUI();
        }
    });
});

if (restartBtn) restartBtn.addEventListener('click', () => {
    snd.stop(); if (shopScreen) shopScreen.classList.add('hidden');
    if (difficultyScreen) difficultyScreen.classList.remove('hidden');
});

// --- API NATIVA DE PANTALLA COMPLETA ---
function toggleFullscreen() {
    const container = document.getElementById('game-container');
    const btn = document.getElementById('fullscreen-btn');
    if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
        if (container.requestFullscreen) container.requestFullscreen();
        else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();
        else if (container.msRequestFullscreen) container.msRequestFullscreen();
        if (btn) btn.innerText = "[ SALIR DE RED: WINDOWED ]";
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
        if (btn) btn.innerText = "[ ENLACE TOTAL: FULLSCREEN ]";
    }
    setTimeout(resizeCanvas, 150);
}

document.addEventListener('fullscreenchange', () => {
    const btn = document.getElementById('fullscreen-btn');
    if (!document.fullscreenElement && btn) btn.innerText = "[ ENLACE TOTAL: FULLSCREEN ]";
    setTimeout(resizeCanvas, 100);
});

function init() {
    applySkillTree();
    obstacles=[]; coins=[]; particles=[]; powerups=[]; floatingTexts=[];
    collectibles=[]; chips=[]; fireballs=[]; impactPuffs=[];
    score=0; distanceTraveled=0; coinsCollected=0; playerXP=0;
    empReady=true; empCooldown=0; empCharging=false; empChargeTimer=0;
    magnetActive=false; magnetTimer=0; invulnActive=false; invulnTimer=0;
    canRevive=false; activeEvent=null; eventCooldown=0;
    weeklyChipsThisRun=0; weeklyComboTimer=0; noDmgDistance=0;
    if (weeklyChallenge) { delete weeklyChallenge._startDist; delete weeklyChallenge._startTime; }
    specterJumpsLeft=1; titanSmashLeft=3;
    ghostPhaseLeft=0; ghostPhaseCooldown=0;
    pyroShieldActive=false; pyroShieldTimer=0;
    pyroFireballCooldown=PYRO_FIREBALL_CD;
    districtTimer=0; gamePaused=false; weeklyChipsThisRun=0;

    const diffConfig=DIFFICULTIES[chosenDifficulty]||DIFFICULTIES['normal'];
    window.EMP_PERMANENTLY_UNLOCKED = !!(skillTree.empSkill && skillTree.empSkill.level > 0);
    gameSpeed=diffConfig.baseSpeed;

    gameActive=true; dataCombo=0; scoreMultiplier=1; adrenalineActive=false;
    hasShield=(activeCharacter==='skeleton');
    if (shopScreen) shopScreen.classList.add('hidden');
    const pauseEl = document.getElementById('pause-overlay');
    if (pauseEl) pauseEl.classList.add('hidden');
    if (player){player.y=floorY-player.height;player.vy=0;player.isGrounded=true;player.immunityFrames=0;}
    if (currentMission.progress>=currentMission.target||score===0) generateNewMission();
}

function openShopWithStats() {
    stopSkillTreeAnimation();
    switchTab('stats');
    updateShopUI();
    if (shopScreen) shopScreen.classList.remove('hidden');
}

// --- ORDEN DE ARRANQUE ---
loadGameFromBrowser();
player = new Player();
resizeCanvas();
generateNewMission();
applySkillTree();
if (!tutorialSeen) { CINEMATIC.start(); } else { CINEMATIC.phase = 'done'; }
requestAnimationFrame(loop);