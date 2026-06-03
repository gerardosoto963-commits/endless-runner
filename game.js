const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// --- ELEMENTOS DEL DOM ---
const shopScreen = document.getElementById('shop-screen');
const difficultyScreen = document.getElementById('difficulty-screen');
const totalCoinsText = document.getElementById('total-coins');
const jumpLvlText = document.getElementById('jump-lvl');
const buyJumpBtn = document.getElementById('buy-jump');
const restartBtn = document.getElementById('restart-btn');
const equipHumanBtn = document.getElementById('equip-human');
const buySlimeBtn = document.getElementById('buy-slime'); 
const buySkeletonBtn = document.getElementById('buy-skeleton'); 
const audioIndicator = document.getElementById('audio-indicator');
const missionText = document.getElementById('mission-text');

let buyShieldBtn = document.getElementById('buy-shield');
if (!buyShieldBtn && buyJumpBtn && buyJumpBtn.parentNode) {
    buyShieldBtn = document.createElement('button');
    buyShieldBtn.id = 'buy-shield';
    buyShieldBtn.style.marginLeft = "10px";
    buyJumpBtn.parentNode.appendChild(buyShieldBtn);
}

// --- CONFIGURACIÓN DE LOS 3 DISTRITOS ---
const DISTRICTS = {
    1: {
        name: "NEON SLUMS",
        skyColors: ['#100216', '#2d0526', '#520331'],
        winColors: ['#ff0055', '#00ffff'],
        gridColor: 'rgba(0, 255, 102, 0.08)',
        laserColor: '#ff0055',
        baseBpm: 105,
        speedModifier: 1.0,
        xpRequired: 150
    },
    2: {
        name: "CORPORATE CORE",
        skyColors: ['#020b16', '#051833', '#0a2f5c'],
        winColors: ['#ffcc00', '#ffffff'],
        gridColor: 'rgba(0, 150, 255, 0.12)',
        laserColor: '#00ffff',
        baseBpm: 125,
        speedModifier: 1.25,
        xpRequired: 300
    },
    3: {
        name: "THE BLACK ICE",
        skyColors: ['#050000', '#140202', '#2d0505'],
        winColors: ['#00ff66', '#ff3300'],
        gridColor: 'rgba(255, 0, 50, 0.12)',
        laserColor: '#ff0000',
        baseBpm: 145,
        speedModifier: 1.5,
        xpRequired: 500
    }
};

// --- CALIBRACIÓN DE DIFICULTADES AJUSTADA ---
const DIFFICULTIES = {
    easy: { baseSpeed: 3.5, acceleration: 0.0012 },   // Fácil: Más lento y progresivo
    normal: { baseSpeed: 5.2, acceleration: 0.0025 }, // Normal: Balanceado y cómodo
    hard: { baseSpeed: 8.0, acceleration: 0.005 }    // Difícil: Hostil (Exclusivo con láseres)
};

// --- DECLARACIÓN DE VARIABLES DE ESTADO ---
let chosenDifficulty = 'normal';
let wallet = 0;
let currentDistrict = 1;
let playerXP = 0;
let districtTransitionTimer = 0;
let gameActive = false; 
let gameSpeed = 5.2;

let floorY = 0; 
let horizonY = 0; 
let activeCharacter = 'human'; 
let hasShield = false;
let dataCombo = 0; 
let scoreMultiplier = 1;
let score = 0; 
const gravity = 0.75;

let player = null; 
let obstacles = []; 
let coins = []; 
let particles = []; 
let floatingTexts = []; 
let powerups = [];
let spawnTimer = 0; 
let glitchEffectTimer = 0;
let adrenalineActive = false; 
let adrenalineTimer = 0;
let buildings = []; 
let floorGrid = null;

let upgrades = { jumpPower: { level: 1, cost: 15, value: -13.5 } };
let characters = {
    human: { unlocked: true, cost: 0, label: 'human' },
    slime: { unlocked: false, cost: 20, label: 'zombie' },     
    skeleton: { unlocked: false, cost: 40, label: 'android' }   
};

let saveState = {
    wallet: 0,
    currentDistrict: 1,
    playerXP: 0,
    jumpLevel: 1,
    unlockedChars: { human: true, slime: false, skeleton: false },
    activeCharacter: 'human'
};

// --- MATRICES PÍXEL DE SPRITES ---
const _ = null; const W = '#ffffff'; const K = '#000000'; const S = '#94a3b8'; 
const R = '#ff0055'; const P = '#ffedd5'; const B = '#00ffff'; const C = '#e2e8f0'; const O = '#ea580c';
const Z = '#39ff14'; const D = '#1e3a1e';

const spriteHuman = [[_,_,_,_,K,K,K,K],[_,_,_,K,S,B,B,S],[_,_,K,S,K,B,B,K],[_,_,K,S,S,S,S,S],[_,_,K,P,P,P,P,P],[_,_,K,P,K,P,P,K],[_,K,S,K,K,K,K,K],[_,K,S,S,R,S,S,R],[_,K,S,R,R,R,R,R],[_,K,S,S,S,S,S,S],[_,_,K,B,B,B,B,B],[_,_,K,K,K,_,_,K],[_,_,K,S,K,_,_,K],[_,_,K,K,_,_,_,_]];
const spriteZombie = [[_,_,_,K,K,K,K,_],[_,_,K,Z,Z,K,R,K],[_,K,Z,K,Z,Z,R,K],[_,K,Z,Z,Z,Z,K,_],[_,_,K,D,D,D,K,_],[_,K,K,Z,Z,Z,Z,K],[K,Z,K,K,K,K,K,K],[K,D,K,Z,R,Z,K,R],[K,Z,K,R,R,R,R,K],[_,K,K,D,D,D,D,K],[_,_,K,Z,Z,Z,Z,K],[_,_,K,K,K,_,K,K],[_,_,K,D,K,_,K,D],[_,_,K,K,_,_,K,K]];
const spriteAndroid = [[_,_,_,_,K,K,K,K],[_,_,_,K,C,C,C,C],[_,_,K,C,K,B,B,K],[_,_,K,C,B,B,B,B],[_,_,K,C,C,C,C,C],[_,_,K,K,K,K,K,K],[_,K,C,K,B,K,K,B],[_,K,C,C,C,C,C,C],[_,K,C,B,B,B,B,B],[_,K,C,C,C,C,C,C],[_,_,K,B,B,B,B,B],[_,_,K,K,K,_,_,K],[_,_,K,C,K,_,_,K],[_,_,K,K,_,_,_,_]];
const spriteDrone = [[_,_,K,K,_,_,_,_,K,K],[K,K,B,B,K,K,_,K,K,B,B],[_,_,K,K,S,S,K,K,S,S],[_,_,_,K,S,W,S,S,W,S],[_,_,K,S,S,S,R,R,S],[_,_,K,S,R,W,W,R,S],[_,_,_,K,S,S,R,R,S]];

function drawPixelMatrix(matrix, x, y, pSize) {
    for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
            if (matrix[r][c] !== _) { ctx.fillStyle = matrix[r][c]; ctx.fillRect(x + c * pSize, y + r * pSize, pSize, pSize); }
        }
    }
}

// --- MOTOR DE AUDIO CYBERPUNK INTERACTIVO Y RESPONSIVO ---
class CyberAudio {
    constructor() {
        this.ctx = null; this.timeout = null; this.beat = 0;
        this.progressions = {
            1: [[55.0, 110.0], [48.99, 97.99], [65.41, 130.81], [58.27, 116.54]], 
            2: [[58.27, 116.54], [51.91, 103.83], [61.74, 123.47], [69.30, 138.59]], 
            3: [[73.42, 146.83], [69.30, 138.59], [77.78, 155.56], [82.41, 164.81]]  
        };
    }
    init() {
        if (!this.ctx) { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.stop();
        this.playLoop();
    }
    stop() { if (this.timeout) clearTimeout(this.timeout); }
    playLoop() {
        if (!gameActive) return;
        const now = this.ctx.currentTime; this.beat++;
        
        const currentProg = this.progressions[currentDistrict] || this.progressions[1];
        const chord = currentProg[Math.floor(this.beat / 8) % currentProg.length];
        const distConfig = DISTRICTS[currentDistrict] || DISTRICTS[1];
        
        // 1. Bajo Synthwave
        const bass = this.ctx.createOscillator(); const bGain = this.ctx.createGain(); const bFilter = this.ctx.createBiquadFilter();
        const isJumping = player && !player.isGrounded;
        bass.type = 'sawtooth';
        bass.frequency.setValueAtTime(this.beat % 2 === 0 ? chord[0] : chord[1], now);
        bFilter.type = 'lowpass';
        bFilter.frequency.setValueAtTime(isJumping ? 850 : 450, now); // El filtro se abre si saltas
        bGain.gain.setValueAtTime(adrenalineActive ? 0.16 : 0.11, now);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        bass.connect(bFilter); bFilter.connect(bGain); bGain.connect(this.ctx.destination);
        bass.start(now); bass.stop(now + 0.2);

        // 2. Batería Rítmica Dinámica
        if (this.beat % 4 === 0) {
            const kick = this.ctx.createOscillator(); const kGain = this.ctx.createGain();
            kick.frequency.setValueAtTime(currentDistrict === 3 ? 160 : 130, now); kick.frequency.exponentialRampToValueAtTime(0.01, now + 0.12);
            kGain.gain.setValueAtTime(0.3, now); kGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            kick.connect(kGain); kGain.connect(this.ctx.destination);
            kick.start(now); kick.stop(now + 0.12);
        } else if (this.beat % 4 === 2 || (scoreMultiplier > 2 && this.beat % 4 === 3)) {
            const bufferSize = this.ctx.sampleRate * 0.08; const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0); for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
            const noise = this.ctx.createBufferSource(); noise.buffer = buffer;
            const nFilter = this.ctx.createBiquadFilter(); nFilter.type = 'bandpass'; nFilter.frequency.value = 1100;
            const nGain = this.ctx.createGain(); nGain.gain.setValueAtTime(this.beat % 4 === 3 ? 0.03 : 0.08, now); nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            noise.connect(nFilter); nFilter.connect(nGain); nGain.connect(this.ctx.destination);
            noise.start(now); noise.stop(now + 0.08);
        }

        // 3. Melodía Secundaria Reactiva
        if (this.beat % 2 === 0) {
            const arp = (adrenalineActive || scoreMultiplier > 3) ? [1, 1.33, 1.5, 1.8] : [1, 1.2, 1.5, 1.75];
            let freq = chord[1] * arp[this.beat % arp.length];
            if (player && player.isCrouching) freq /= 2; // Baja una octava si te agachas
            const lead = this.ctx.createOscillator(); const lGain = this.ctx.createGain();
            lead.type = currentDistrict === 2 ? 'square' : 'triangle';
            lead.frequency.setValueAtTime(freq, now);
            lGain.gain.setValueAtTime(adrenalineActive ? 0.05 : 0.03, now); lGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
            lead.connect(lGain); lGain.connect(this.ctx.destination);
            lead.start(now); lead.stop(now + 0.22);
        }

        let bpm = (adrenalineActive ? distConfig.baseBpm + 30 : distConfig.baseBpm) + Math.min(gameSpeed * 1.2, 25);
        if (audioIndicator) audioIndicator.innerText = `NET_AUDIO.OS: ${distConfig.name} @ ${Math.floor(bpm)} BPM`;
        this.timeout = setTimeout(() => this.playLoop(), (60 / bpm) * 500);
    }
    playSFX(type) {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
        osc.connect(gain); gain.connect(this.ctx.destination); const now = this.ctx.currentTime;

        if (type === 'jump') {
            osc.type = 'triangle'; osc.frequency.setValueAtTime(130, now); osc.frequency.exponentialRampToValueAtTime(450, now + 0.12);
            gain.gain.setValueAtTime(0.14, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            osc.start(now); osc.stop(now + 0.12);
        } else if (type === 'coin') {
            osc.type = 'sine'; osc.frequency.setValueAtTime(580, now); osc.frequency.exponentialRampToValueAtTime(880, now + 0.06); // Transición exponencial limpia
            gain.gain.setValueAtTime(0.08, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
            osc.start(now); osc.stop(now + 0.16);
        } else if (type === 'hit') {
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(180, now); osc.frequency.linearRampToValueAtTime(10, now + 0.4);
            gain.gain.setValueAtTime(0.25, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            osc.start(now); osc.stop(now + 0.4);
        } else if (type === 'levelup') {
            osc.type = 'sine'; osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(1200, now + 0.45);
            gain.gain.setValueAtTime(0.22, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
            osc.start(now); osc.stop(now + 0.45);
        } else if (type === 'powerup') {
            osc.type = 'square'; osc.frequency.setValueAtTime(200, now); osc.frequency.linearRampToValueAtTime(800, now + 0.3);
            gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc.start(now); osc.stop(now + 0.3);
        }
        osc.onended = () => { osc.disconnect(); gain.disconnect(); }; // Liberación de memoria
    }
}
const snd = new CyberAudio();

// --- PERSISTENCIA LOCALSTORAGE ---
function saveGameToBrowser() {
    saveState.wallet = wallet;
    saveState.currentDistrict = currentDistrict;
    saveState.playerXP = playerXP;
    saveState.jumpLevel = upgrades.jumpPower.level;
    saveState.activeCharacter = activeCharacter;
    saveState.unlockedChars = {
        human: characters.human.unlocked,
        slime: characters.slime.unlocked,
        skeleton: characters.skeleton.unlocked
    };
    localStorage.setItem('cyberrunner_browser_save', JSON.stringify(saveState));
}

function loadGameFromBrowser() {
    const rawData = localStorage.getItem('cyberrunner_browser_save');
    if (rawData) {
        try {
            const loaded = JSON.parse(rawData);
            wallet = loaded.wallet || 0;
            currentDistrict = loaded.currentDistrict || 1;
            playerXP = loaded.playerXP || 0;
            if (upgrades.jumpPower) {
                upgrades.jumpPower.level = loaded.jumpLevel || 1;
                upgrades.jumpPower.value = -13.5 - ((upgrades.jumpPower.level - 1) * 0.55);
                upgrades.jumpPower.cost = Math.floor(15 * Math.pow(1.5, upgrades.jumpPower.level - 1));
            }
            activeCharacter = loaded.activeCharacter || 'human';
            if (loaded.unlockedChars) {
                characters.human.unlocked = loaded.unlockedChars.human;
                characters.slime.unlocked = loaded.unlockedChars.slime;
                characters.skeleton.unlocked = loaded.unlockedChars.skeleton;
            }
        } catch (e) {
            console.error("Fallo de desfragmentación de memoria en LocalStorage.");
        }
    }
}

// --- CONTROLADORES DE ENTORNO ---
function setDifficulty(level) {
    chosenDifficulty = level;
    if (difficultyScreen) difficultyScreen.classList.add('hidden');
    snd.init();
    init();
}

function gainXP(amount) {
    if (!gameActive || districtTransitionTimer > 0) return;
    playerXP += amount;
    let dist = DISTRICTS[currentDistrict] || DISTRICTS[1];
    let required = dist.xpRequired;
    
    if (playerXP >= required) {
        if (DISTRICTS[currentDistrict + 1]) {
            playerXP = 0;
            currentDistrict++;
            districtTransitionTimer = 90; 
            snd.playSFX('levelup');
            let newDist = DISTRICTS[currentDistrict];
            gameSpeed = DIFFICULTIES[chosenDifficulty].baseSpeed * newDist.speedModifier; 
            saveGameToBrowser();
        } else {
            playerXP = required;
        }
    }
}

// --- PARALAJE DE EDIFICIOS ---
class BackgroundBuilding {
    constructor(layer) {
        this.layer = layer;
        this.width = layer === 'far' ? Math.random() * 60 + 60 : Math.random() * 80 + 90;
        this.height = layer === 'far' ? Math.random() * 100 + 120 : Math.random() * 80 + 70;
        this.x = Math.random() * canvas.width;
        this.windows = [];
        this.generateWindows();
    }
    generateWindows() {
        let cols = Math.floor(this.width / 14); let rows = Math.floor(this.height / 18);
        let dist = DISTRICTS[currentDistrict] || DISTRICTS[1];
        let currentColors = dist.winColors;
        this.windows = [];
        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < rows; r++) {
                if (Math.random() > 0.45) {
                    this.windows.push({ 
                        dx: c * 12 + 6, 
                        dy: r * 16 + 10, 
                        color: currentColors[Math.floor(Math.random() * currentColors.length)], 
                        active: Math.random() > 0.2 
                    });
                }
            }
        }
    }
    update() {
        let speed = this.layer === 'far' ? gameSpeed * 0.1 : gameSpeed * 0.3; this.x -= speed;
        if (this.x + this.width < 0) { 
            this.x = canvas.width + Math.random() * 50; 
            this.height = this.layer === 'far' ? Math.random() * 100 + 120 : Math.random() * 80 + 70;
            this.generateWindows(); 
        }
        if (Math.random() > 0.98 && this.windows.length > 0) { let win = this.windows[Math.floor(Math.random() * this.windows.length)]; win.active = !win.active; }
    }
    draw() {
        ctx.fillStyle = this.layer === 'far' ? '#070814' : '#02030a'; 
        let drawY = horizonY - this.height; ctx.fillRect(this.x, drawY, this.width, this.height);
        ctx.save();
        this.windows.forEach(w => { if (w.active) { ctx.fillStyle = w.color; ctx.globalAlpha = Math.random() * 0.4 + 0.4; ctx.fillRect(this.x + w.dx, drawY + w.dy, 5, 8); } });
        ctx.restore();
    }
}

class LaserGrid {
    constructor() { this.offset = 0; }
    update() { this.offset = (this.offset + gameSpeed) % 40; }
    draw() {
        ctx.save(); 
        let dist = DISTRICTS[currentDistrict] || DISTRICTS[1];
        ctx.strokeStyle = dist.gridColor; ctx.lineWidth = 1;
        let startY = floorY; for (let y = startY; y < canvas.height; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        for (let i = -100; i <= canvas.width + 100; i += 50) {
            ctx.beginPath(); ctx.moveTo(canvas.width / 2 + (i - canvas.width / 2) * 0.2, floorY); ctx.lineTo(i - this.offset * 1.5, canvas.height); ctx.stroke();
        }
        ctx.restore();
    }
}

function resizeCanvas() {
    canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight;
    floorY = Math.floor(canvas.height * 0.75); horizonY = floorY - 82;
    if (player) { player.x = Math.floor(canvas.width * 0.15); if (player.isGrounded) player.y = floorY - player.height; }
    buildings = [];
    for (let i = 0; i < 6; i++) buildings.push(new BackgroundBuilding('far'));
    for (let i = 0; i < 4; i++) buildings.push(new BackgroundBuilding('near'));
    floorGrid = new LaserGrid();
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
    draw() { ctx.save(); ctx.globalAlpha = this.alpha; ctx.fillStyle = this.color; ctx.font = "bold 11px 'Courier New'"; ctx.fillText(this.text, this.x, this.y); ctx.restore(); }
}

class PowerUp {
    constructor() { this.x = canvas.width + 10; this.y = floorY - 60 - Math.random() * 50; this.width = 20; this.height = 20; this.pulse = 0; }
    update() { this.x -= gameSpeed; this.pulse += 0.2; }
    draw() {
        ctx.save(); ctx.shadowBlur = 10; ctx.shadowColor = '#ff00aa';
        ctx.fillStyle = '#ff00aa'; ctx.fillRect(this.x, this.y + Math.sin(this.pulse)*3, this.width, this.height);
        ctx.fillStyle = '#ffffff'; ctx.font = "9px Arial"; ctx.fillText("⚡", this.x+5, this.y + 13 + Math.sin(this.pulse)*3);
        ctx.restore();
    }
}

// --- RECOMPENSAS Y CONTRATOS ---
let currentMission = { type: 'coins', target: 8, progress: 0, text: "Recolectar 8 datos de red" };
const missionPool = [
    { type: 'coins', target: 6, xp: 40, text: "Descargar 6 nucleos de datos" },
    { type: 'evade', target: 4, xp: 50, text: "Evadir 4 defensas de red" },
    { type: 'combo', target: 3, xp: 60, text: "Sincronizar Combo Nivel X3" }
];
function generateNewMission() {
    currentMission = {...missionPool[Math.floor(Math.random() * missionPool.length)], progress: 0};
    if (missionText) missionText.innerText = `CONTRATO: ${currentMission.text} (${currentMission.progress}/${currentMission.target})`;
}
function checkMissionProgress(type, amt = 1) {
    if (!gameActive || currentMission.type !== type) return;
    currentMission.progress = type === 'combo' ? amt : currentMission.progress + amt;
    if (currentMission.progress >= currentMission.target) {
        let rewardXP = currentMission.xp || 30; wallet += 50; 
        floatingTexts.push(new FloatingText(player ? player.x : 100, player ? player.y - 40 : 100, "¡CONTRATO COMPLETADO! +50 💰", '#00ff66'));
        gainXP(rewardXP); generateNewMission(); saveGameToBrowser();
    } else if (missionText) {
        missionText.innerText = `CONTRATO: ${currentMission.text} (${currentMission.progress}/${currentMission.target})`;
    }
}

// --- CLASE JUGADOR ---
class Player {
    constructor() { this.width = 32; this.height = 42; this.x = 120; this.y = floorY - this.height; this.vy = 0; this.isGrounded = false; this.isCrouching = false; this.immunityFrames = 0; }
    jump() { if (this.isGrounded && !this.isCrouching && districtTransitionTimer === 0) { this.vy = activeCharacter === 'slime' ? upgrades.jumpPower.value - 1.2 : upgrades.jumpPower.value; this.isGrounded = false; snd.playSFX('jump'); } }
    crouch(state) { if (this.isGrounded && districtTransitionTimer === 0) { this.isCrouching = state; this.height = state ? 24 : 42; this.y = floorY - this.height; } }
    update() {
        if (this.immunityFrames > 0) this.immunityFrames--;
        this.vy += (activeCharacter === 'slime' && this.vy > 0) ? gravity * 0.75 : gravity; this.y += this.vy;
        if (this.y >= floorY - this.height) { this.y = floorY - this.height; this.vy = 0; this.isGrounded = true; }
    }
    draw() {
        ctx.save(); if (this.immunityFrames % 4 > 2) { ctx.restore(); return; }
        let matrix = activeCharacter === 'slime' ? spriteZombie : (activeCharacter === 'skeleton' ? spriteAndroid : spriteHuman);
        if (this.isCrouching) { ctx.translate(this.x, this.y + 12); ctx.scale(1, 0.65); drawPixelMatrix(matrix, 0, 0, 3); }
        else { drawPixelMatrix(matrix, this.x, this.y, 3); }
        ctx.restore();
        if (hasShield && gameActive) {
            ctx.save(); ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 2; ctx.shadowBlur = 8; ctx.shadowColor = '#00ffff';
            ctx.beginPath(); ctx.arc(this.x + this.width/2, this.y + this.height/2, 28, 0, Math.PI*2); ctx.stroke(); ctx.restore();
        }
    }
}

// --- CLASE OBSTÁCULO (DIFICULTADES Y FILTRO TERRESTRE) ---
class Obstacle {
    constructor() {
        this.evaded = false;
        let rand = Math.random();
        
        // Alta variedad en obstáculos terrestres ('drone', 'bin', 'bag')
        this.type = rand < 0.25 ? 'laser' : (rand < 0.55 ? 'drone' : (rand < 0.80 ? 'bin' : 'bag'));
        
        // RESTRICCIÓN DE EXCLUSIVIDAD: Si es Láser pero NO está en Difícil, lo forzamos a Terrestre
        if (this.type === 'laser' && chosenDifficulty !== 'hard') {
            this.type = Math.random() > 0.5 ? 'bin' : 'bag';
        }

        if (this.type === 'laser') {
            this.z = 0.01; this.width = 2; this.height = 1; this.targetWidth = 70; this.targetHeight = 10; this.y = horizonY; this.targetY = floorY - 35;
        } else {
            this.x = canvas.width + 20; this.width = 32; 
            this.height = this.type === 'drone' ? 22 : (this.type === 'bin' ? 38 : 24);
            this.y = this.type === 'drone' ? floorY - 68 : floorY - this.height; // Los drones flotan un poco, el resto fijos al suelo
        }
    }
    update() {
        if (!player) return;
        if (this.type === 'laser') {
            this.z += 0.014 * (gameSpeed / 5.5); this.width = this.targetWidth * this.z; this.height = this.targetHeight * this.z;
            let startX = canvas.width / 2; let targetX = player.x - 10;
            this.x = startX + (targetX - startX) * this.z; this.y = horizonY + (this.targetY - horizonY) * this.z;
            if (this.z >= 1.0) this.x -= gameSpeed;
        } else {
            this.x -= gameSpeed;
            if (this.type === 'drone' && Math.random() > 0.6) particles.push(new Particle(this.x + this.width, this.y + 10, '#00ffff'));
        }
        if (!this.evaded && (this.type === 'laser' ? this.z > 1.15 : this.x + this.width < player.x)) {
            this.evaded = true; gainXP(20); checkMissionProgress('evade', 1);
        }
    }
    draw() {
        let dist = DISTRICTS[currentDistrict] || DISTRICTS[1];
        let currentLaserColor = dist.laserColor;
        if (this.type === 'laser') {
            ctx.save();
            if (this.z < 0.35 && player) {
                ctx.strokeStyle = `${currentLaserColor}66`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(canvas.width/2, horizonY); ctx.lineTo(player.x + 25, this.targetY); ctx.stroke();
            }
            ctx.shadowBlur = 12 * this.z; ctx.shadowColor = currentLaserColor; ctx.fillStyle = currentLaserColor; ctx.fillRect(this.x, this.y, this.width, this.height); 
            ctx.fillStyle = '#ffffff'; ctx.fillRect(this.x, this.y + (this.height * 0.3), this.width, this.height * 0.4); ctx.restore();
        } else if (this.type === 'drone') { drawPixelMatrix(spriteDrone, this.x, this.y, 2.5); }
        else {
            ctx.fillStyle = this.type === 'bin' ? '#111424' : '#1e1124'; ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.strokeStyle = this.type === 'bin' ? '#00ffff' : '#00ff66'; ctx.lineWidth = 1; ctx.strokeRect(this.x, this.y, this.width, this.height);
        }
    }
}

class Coin {
    constructor() { this.x = canvas.width + 40; this.y = floorY - 55 - Math.random() * 70; this.size = 12; }
    update() { 
        this.x -= gameSpeed; 
        if (adrenalineActive && player) { this.x -= 2; this.y += (player.y + 15 - this.y) * 0.15; } 
    } 
    draw() { ctx.fillStyle = '#00ffff'; ctx.fillRect(this.x, this.y, this.size, this.size); }
}

// --- RENDERIZADO DEL ENTORNO Y HUD ---
function drawBackground() {
    let w = canvas.width; let dist = DISTRICTS[currentDistrict] || DISTRICTS[1]; let colors = dist.skyColors;
    let sky = ctx.createLinearGradient(0, 0, 0, horizonY); sky.addColorStop(0, colors[0]); sky.addColorStop(0.6, colors[1]); sky.addColorStop(1, colors[2]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, horizonY);
    buildings.forEach(b => { if (b.layer === 'far') b.update(); b.draw(); });
    buildings.forEach(b => { if (b.layer === 'near') b.update(); b.draw(); });
    ctx.fillStyle = '#00ffff'; ctx.fillRect(0, horizonY, w, 2);
}

function drawCyberpunkHUD() {
    ctx.save(); ctx.fillStyle = 'rgba(4, 6, 14, 0.9)'; ctx.beginPath();
    ctx.moveTo(20, 20); ctx.lineTo(290, 20); ctx.lineTo(315, 45); ctx.lineTo(315, 105); ctx.lineTo(20, 105); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 1.5; ctx.stroke();
    
    let dist = DISTRICTS[currentDistrict] || DISTRICTS[1];
    ctx.fillStyle = '#00ffff'; ctx.font = "bold 11px 'Courier New'"; ctx.fillText(`NODE_LOC: DISTRITO 0${currentDistrict} [${dist.name}]`, 35, 36);
    ctx.fillStyle = '#ffff00'; ctx.fillText(`CRÉDITOS RUN: ${score} 💰`, 35, 52);
    ctx.fillStyle = scoreMultiplier > 1 ? '#00ff66' : 'rgba(0, 255, 255, 0.5)';
    ctx.fillText(`MULTIPLICADOR DE RED: X${scoreMultiplier} [${chosenDifficulty.toUpperCase()}]`, 35, 68);

    ctx.fillStyle = 'rgba(0, 255, 255, 0.1)'; ctx.fillRect(35, 76, 120, 4);
    ctx.fillStyle = adrenalineActive ? '#ff00aa' : (scoreMultiplier > 1 ? '#00ff66' : '#ff0055');
    let cap = adrenalineActive ? (adrenalineTimer / 30) : dataCombo;
    for (let i = 0; i < cap; i++) ctx.fillRect(35 + (i * 13), 76, 9, 4);

    let reqXP = dist.xpRequired; let xpPct = Math.min(playerXP / reqXP, 1);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)'; ctx.fillRect(35, 88, 250, 6);
    ctx.fillStyle = '#00ffff'; ctx.shadowBlur = 6; ctx.shadowColor = '#00ffff'; ctx.fillRect(35, 88, 250 * xpPct, 6);
    ctx.restore();
}

function triggerHit() {
    if (adrenalineActive || districtTransitionTimer > 0) return; 
    if (hasShield && player) {
        hasShield = false; player.immunityFrames = 65; snd.playSFX('hit');
        floatingTexts.push(new FloatingText(player.x, player.y - 20, "¡ESCUDO DE ENLACE DESTRUIDO!", '#ff0055'));
        spawnExplosion(player.x + 16, player.y + 16, '#00ffff', 25); updateShopUI();
    } else if (player && player.immunityFrames === 0) {
        gameActive = false; glitchEffectTimer = 25; snd.playSFX('hit'); snd.stop(); wallet += score;
        saveGameToBrowser(); dataCombo = 0; scoreMultiplier = 1;
        floatingTexts.push(new FloatingText(player.x, player.y - 20, "ENLACE DESCONECTADO", '#ff0055'));
    }
}

function updateShopUI() {
    if (totalCoinsText) totalCoinsText.innerText = wallet;
    if (jumpLvlText) jumpLvlText.innerText = upgrades.jumpPower.level;
    if (buyJumpBtn) { buyJumpBtn.innerText = `MEJORAR IMPULSORES (${upgrades.jumpPower.cost} 💰)`; buyJumpBtn.disabled = wallet < upgrades.jumpPower.cost; }
    if (buyShieldBtn) {
        if (hasShield) { buyShieldBtn.innerText = "🛡️ SEGURO ASIGNADO"; buyShieldBtn.disabled = true; } 
        else { buyShieldBtn.innerText = "COMPRAR ESCUDO (50 💰)"; buyShieldBtn.disabled = wallet < 50; }
    }
    if (equipHumanBtn) manageCharButton(equipHumanBtn, 'human');
    if (buySlimeBtn) manageCharButton(buySlimeBtn, 'slime');
    if (buySkeletonBtn) manageCharButton(buySkeletonBtn, 'skeleton');
}

function manageCharButton(btn, charKey) {
    if (!btn) return; let char = characters[charKey]; btn.className = 'char-btn';
    if (activeCharacter === charKey) { btn.innerText = "ENLAZADO"; btn.classList.add('equipped'); btn.disabled = true; } 
    else if (char.unlocked) { btn.innerText = "CONECTAR"; btn.disabled = false; } 
    else { btn.innerText = `${char.label.toUpperCase()} (${char.cost} 💰)`; btn.disabled = wallet < char.cost; }
}

function checkCollision(rect1, rect2) { return rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x && rect1.y < rect2.y + rect2.height && rect1.y + rect1.height > rect2.y; }

// --- BUCLE DE ACTUALIZACIÓN ---
function update() {
    for (let i = floatingTexts.length - 1; i >= 0; i--) { floatingTexts[i].update(); if (floatingTexts[i].alpha <= 0) floatingTexts.splice(i, 1); }
    for (let i = particles.length - 1; i >= 0; i--) { particles[i].update(); if (particles[i].alpha <= 0) particles.splice(i, 1); }
    
    if (!gameActive) {
        if (glitchEffectTimer > 0) { glitchEffectTimer--; if (glitchEffectTimer === 0) { updateShopUI(); if (shopScreen) shopScreen.classList.remove('hidden'); } }
        return;
    }

    if (districtTransitionTimer > 0) {
        districtTransitionTimer--; if (districtTransitionTimer === 0) { buildings.forEach(b => b.generateWindows()); snd.stop(); snd.init(); }
        return;
    }

    if (adrenalineActive && player) {
        adrenalineTimer--; if (Math.random() > 0.3) particles.push(new Particle(player.x, player.y + Math.random()*40, '#ff00aa'));
        if (adrenalineTimer <= 0) { adrenalineActive = false; gameSpeed /= 1.8; floatingTexts.push(new FloatingText(player.x, player.y - 40, "CRASH DE ADRENALINA", '#ff0055')); }
    }

    let diffConfig = DIFFICULTIES[chosenDifficulty] || DIFFICULTIES['normal'];
    gameSpeed += diffConfig.acceleration; if (player) player.update(); if (floorGrid) floorGrid.update(); spawnTimer++;

    // ALTA DENSIDAD: Reducido el ratio a 52 ciclos para inyectar más densidad terrestre en la matriz
    if (spawnTimer % 52 === 0) {
        let rng = Math.random();
        if (rng < 0.55) obstacles.push(new Obstacle()); // Alta prioridad de obstáculos
        else if (rng < 0.90) coins.push(new Coin());
        else if (!adrenalineActive && powerups.length === 0) powerups.push(new PowerUp());
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].update(); if (player && checkCollision(player, obstacles[i])) { triggerHit(); if (!gameActive) return; }
        if (obstacles[i].type === 'laser' ? obstacles[i].z > 1.4 : obstacles[i].x + obstacles[i].width < -40) obstacles.splice(i, 1);
    }

    for (let i = powerups.length - 1; i >= 0; i--) {
        powerups[i].update();
        if (player && checkCollision(player, powerups[i])) {
            adrenalineActive = true; adrenalineTimer = 300; gameSpeed *= 1.8; snd.playSFX('powerup');
            floatingTexts.push(new FloatingText(player.x, player.y - 30, "¡INYECCIÓN DE ADRENALINA!", '#ff00aa')); powerups.splice(i, 1); continue;
        }
        if (powerups[i].x < -30) powerups.splice(i, 1);
    }

    for (let i = coins.length - 1; i >= 0; i--) {
        coins[i].update(); let cBox = { x: coins[i].x, y: coins[i].y, width: coins[i].size, height: coins[i].size };
        if (player && checkCollision(player, cBox)) {
            let comboRequirement = (activeCharacter === 'human') ? 3 : 5; dataCombo++;
            if (dataCombo >= comboRequirement) { dataCombo = 0; if (scoreMultiplier < 5) { scoreMultiplier++; floatingTexts.push(new FloatingText(player.x, player.y - 20, `COMBO X${scoreMultiplier}`, '#00ff66')); } }
            score += (1 * scoreMultiplier); snd.playSFX('coin'); gainXP(12 * scoreMultiplier); 
            checkMissionProgress('coins', 1); checkMissionProgress('combo', scoreMultiplier);
            spawnExplosion(coins[i].x, coins[i].y, '#00ffff', 4); coins.splice(i, 1); continue;
        }
        if (coins[i].x < -20) coins.splice(i, 1);
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); drawBackground();
    ctx.fillStyle = '#040510'; ctx.fillRect(0, floorY, canvas.width, canvas.height);
    ctx.fillStyle = adrenalineActive ? '#ff00aa' : '#00ff66'; ctx.fillRect(0, floorY, canvas.width, 3);
    if (floorGrid) floorGrid.draw();
    powerups.forEach(p => p.draw()); coins.forEach(c => c.draw()); obstacles.forEach(o => o.draw()); 
    if (player) player.draw(); particles.forEach(p => p.draw()); floatingTexts.forEach(ft => ft.draw());
    drawCyberpunkHUD();

    if (adrenalineActive) { ctx.fillStyle = 'rgba(255, 0, 170, 0.05)'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    if (!gameActive && glitchEffectTimer > 0 && glitchEffectTimer % 4 > 1) { ctx.fillStyle = 'rgba(255, 0, 85, 0.25)'; ctx.fillRect(0, 0, canvas.width, canvas.height); }

    if (districtTransitionTimer > 0) {
        ctx.fillStyle = 'rgba(0, 255, 255, 0.15)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff'; ctx.font = "bold 20px 'Courier New'"; ctx.textAlign = "center";
        let dist = DISTRICTS[currentDistrict] || DISTRICTS[1];
        ctx.fillText(`HACKING NEXT NODE: ${dist.name}`, canvas.width / 2, canvas.height / 2);
        ctx.font = "12px 'Courier New'"; ctx.fillText("DESENCRIPTANDO MATRIZ DE ENTORNO...", canvas.width / 2, canvas.height / 2 + 30);
        ctx.textAlign = "left"; 
    }
}

function loop() { update(); draw(); requestAnimationFrame(loop); }

// --- ENTRADAS DE CONTROL ---
window.addEventListener('keydown', (e) => {
    if (!player) return;
    if (e.code === 'Space' || e.code === 'ArrowUp') player.jump();
    if (e.code === 'ArrowDown' || e.code === 'KeyS') player.crouch(true);
});
window.addEventListener('keyup', (e) => { 
    if (player && (e.code === 'ArrowDown' || e.code === 'KeyS')) player.crouch(false); 
});

if (buyJumpBtn) buyJumpBtn.addEventListener('click', () => {
    if (wallet >= upgrades.jumpPower.cost) { wallet -= upgrades.jumpPower.cost; upgrades.jumpPower.level++; upgrades.jumpPower.value -= 0.55; upgrades.jumpPower.cost = Math.floor(upgrades.jumpPower.cost * 1.5); updateShopUI(); saveGameToBrowser(); }
});
if (buyShieldBtn) buyShieldBtn.addEventListener('click', () => { if (wallet >= 50 && !hasShield) { wallet -= 50; hasShield = true; updateShopUI(); saveGameToBrowser(); } });

function handleCharAction(charKey) {
    let char = characters[charKey]; if (char.unlocked) activeCharacter = charKey;
    else if (wallet >= char.cost) { wallet -= char.cost; char.unlocked = true; activeCharacter = charKey; }
    updateShopUI(); saveGameToBrowser();
}

if (equipHumanBtn) equipHumanBtn.addEventListener('click', () => handleCharAction('human'));
if (buySlimeBtn) buySlimeBtn.addEventListener('click', () => handleCharAction('slime'));
if (buySkeletonBtn) buySkeletonBtn.addEventListener('click', () => handleCharAction('skeleton'));

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
    obstacles = []; coins = []; particles = []; powerups = []; floatingTexts = []; score = 0; 
    let diffConfig = DIFFICULTIES[chosenDifficulty] || DIFFICULTIES['normal'];
    let distConfig = DISTRICTS[currentDistrict] || DISTRICTS[1];
    
    gameSpeed = diffConfig.baseSpeed * distConfig.speedModifier; 
    gameActive = true; dataCombo = 0; scoreMultiplier = 1; adrenalineActive = false;
    hasShield = (activeCharacter === 'skeleton');
    if (shopScreen) shopScreen.classList.add('hidden');
    if (player) { player.y = floorY - player.height; player.vy = 0; player.isGrounded = true; player.immunityFrames = 0; }
    if (currentMission.progress >= currentMission.target || score === 0) generateNewMission();
}

// --- ORDEN DE ARRANQUE COMPATIBLE ---
loadGameFromBrowser(); 
player = new Player(); 
resizeCanvas(); 
generateNewMission(); 
loop();