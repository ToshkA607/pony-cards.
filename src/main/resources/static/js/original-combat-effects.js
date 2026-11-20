/* Original combat effects ported from the supplied HTML demos. Rendering code and particle algorithms are retained. */

        const createOriginalProjectileEffect = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            let width = 1, height = 1;
            function resize(w, h) { width = Math.max(1,w); height = Math.max(1,h); canvas.width = width; canvas.height = height; }

            // ============================================================
            // БАЗОВЫЙ КЛАСС СНАРЯДА
            // ============================================================
            class Projectile {
                constructor(x, y, targetX, targetY) {
                    this.x = x;
                    this.y = y;
                    const dx = targetX - x;
                    const dy = targetY - y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const speed = 16;
                    this.vx = (dx / dist) * speed;
                    this.vy = (dy / dist) * speed;
                    this.angle = Math.atan2(dy, dx);
                    this.targetX = targetX;
                    this.targetY = targetY;
                    this.life = 240;
                    this.dead = false;
                    this.trail = [];
                    this.trailMax = 10;
                }
                update(scale = 1) {
                    this.x += this.vx * scale;
                    this.y += this.vy * scale;
                    this.trail.push({x: this.x, y: this.y});
                    if (this.trail.length > this.trailMax) this.trail.shift();
                    this.life -= scale;
                    // The game can test the projectile against moving targets on every frame.
                    if (this.onUpdate && this.onUpdate(this)) {
                        this.dead = true;
                        this.onHit && this.onHit();
                    }
                    if (!this.dead && Math.hypot(this.x - this.targetX, this.y - this.targetY) < 15) {
                        this.dead = true;
                        this.onHit && this.onHit();
                    }
                    if (this.x < -100 || this.x > width + 100 || this.y < -100 || this.y > height + 100) {
                        this.dead = true;
                    }
                }
                draw() {}
            }

            // ============================================================
            // 1. ЭНЕРГЕТИЧЕСКАЯ СФЕРА (фиолетовая с кольцами)
            // ============================================================
            class EnergySphere extends Projectile {
                constructor(x, y, tx, ty) {
                    super(x, y, tx, ty);
                    this.size = 11;
                    this.time = 0;
                    this.rings = [];
                    for (let i = 0; i < 3; i++) {
                        this.rings.push({
                            offset: i * Math.PI / 3,
                            speed: 1 + i * 0.5,
                            size: 1.5 + i * 0.4
                        });
                    }
                }
                update(scale = 1) {
                    super.update(scale);
                    this.time += 0.1;
                }
                draw() {
                    ctx.save();
                    for (let i = 0; i < this.trail.length; i++) {
                        const p = this.trail[i];
                        const a = (i / this.trail.length) * 0.4;
                        const s = (i / this.trail.length) * this.size * 1.5;
                        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
                        g.addColorStop(0, 'rgba(200, 0, 255, 0.8)');
                        g.addColorStop(1, 'rgba(100, 0, 150, 0)');
                        ctx.globalAlpha = a;
                        ctx.fillStyle = g;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 3.5);
                    grad.addColorStop(0, 'rgba(255, 100, 255, 0.8)');
                    grad.addColorStop(0.4, 'rgba(180, 0, 255, 0.5)');
                    grad.addColorStop(1, 'rgba(80, 0, 150, 0)');
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.size * 3.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#ffffff';
                    ctx.shadowColor = '#ff88ff';
                    ctx.shadowBlur = 25;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.size * 0.7, 0, Math.PI * 2);
                    ctx.fill();
                    for (const ring of this.rings) {
                        const a = this.time * ring.speed + ring.offset;
                        ctx.save();
                        ctx.translate(this.x, this.y);
                        ctx.rotate(a);
                        ctx.scale(ring.size, 1);
                        ctx.strokeStyle = 'rgba(255, 150, 255, 0.8)';
                        ctx.lineWidth = 2;
                        ctx.shadowColor = '#ff00ff';
                        ctx.shadowBlur = 15;
                        ctx.beginPath();
                        ctx.arc(0, 0, this.size * 1.3, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.restore();
                    }
                    ctx.restore();
                }
            }

            // ============================================================
            // 2. КИСЛОТНЫЙ ШАР (зелёный с каплями)
            // ============================================================
            class AcidBall extends Projectile {
                constructor(x, y, tx, ty) {
                    super(x, y, tx, ty);
                    this.size = 10;
                    this.time = 0;
                    this.drops = [];
                }
                update(scale = 1) {
                    super.update(scale);
                    this.time += 0.15;
                    if (Math.random() < 0.5) {
                        this.drops.push({
                            x: this.x + (Math.random() - 0.5) * 15,
                            y: this.y + (Math.random() - 0.5) * 15,
                            vx: -this.vx * 0.2 + (Math.random() - 0.5) * 2,
                            vy: -this.vy * 0.2 + (Math.random() - 0.5) * 2 + 1,
                            life: 25,
                            maxLife: 25,
                            size: 2 + Math.random() * 3
                        });
                    }
                    for (let i = this.drops.length - 1; i >= 0; i--) {
                        const d = this.drops[i];
                        d.x += d.vx;
                        d.y += d.vy;
                        d.vy += 0.1;
                        d.life--;
                        if (d.life <= 0) this.drops.splice(i, 1);
                    }
                }
                draw() {
                    for (let i = 0; i < this.trail.length; i++) {
                        const p = this.trail[i];
                        const a = (i / this.trail.length) * 0.5;
                        const s = (i / this.trail.length) * this.size;
                        ctx.globalAlpha = a;
                        ctx.fillStyle = '#44ff44';
                        ctx.shadowColor = '#44ff44';
                        ctx.shadowBlur = 10;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.globalAlpha = 1;
                    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 3);
                    grad.addColorStop(0, 'rgba(150, 255, 100, 0.9)');
                    grad.addColorStop(0.4, 'rgba(50, 200, 50, 0.5)');
                    grad.addColorStop(1, 'rgba(0, 100, 0, 0)');
                    ctx.fillStyle = grad;
                    ctx.shadowColor = '#00ff00';
                    ctx.shadowBlur = 25;
                    ctx.beginPath();
                    const points = 12;
                    for (let i = 0; i < points; i++) {
                        const a = (i / points) * Math.PI * 2;
                        const r = this.size * 3 * (0.9 + Math.sin(this.time * 3 + i) * 0.1);
                        const px = this.x + Math.cos(a) * r;
                        const py = this.y + Math.sin(a) * r;
                        if (i === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.fillStyle = '#ccff88';
                    ctx.shadowColor = '#ffffff';
                    ctx.shadowBlur = 15;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.size * 0.6, 0, Math.PI * 2);
                    ctx.fill();
                    for (const d of this.drops) {
                        const a = d.life / d.maxLife;
                        ctx.globalAlpha = a;
                        ctx.fillStyle = '#66ff66';
                        ctx.shadowColor = '#00ff00';
                        ctx.shadowBlur = 8;
                        ctx.beginPath();
                        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }

            // ============================================================
            // 3. ТЁМНАЯ МАТЕРИЯ (чёрный шар с фиолетовым ореолом)
            // ============================================================
            class DarkMatter extends Projectile {
                constructor(x, y, tx, ty) {
                    super(x, y, tx, ty);
                    this.size = 11;
                    this.time = 0;
                }
                update(scale = 1) {
                    super.update(scale);
                    this.time += 0.12;
                }
                draw() {
                    ctx.save();
                    for (let i = 0; i < this.trail.length; i++) {
                        const p = this.trail[i];
                        const a = (i / this.trail.length) * 0.4;
                        ctx.globalAlpha = a;
                        ctx.fillStyle = '#330066';
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, (i / this.trail.length) * this.size * 1.2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.globalAlpha = 1;
                    const glow = ctx.createRadialGradient(this.x, this.y, this.size, this.x, this.y, this.size * 3);
                    glow.addColorStop(0, 'rgba(180, 0, 255, 0.7)');
                    glow.addColorStop(0.5, 'rgba(100, 0, 200, 0.4)');
                    glow.addColorStop(1, 'rgba(50, 0, 100, 0)');
                    ctx.fillStyle = glow;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowColor = '#cc00ff';
                    ctx.shadowBlur = 30;
                    const bodyGrad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
                    bodyGrad.addColorStop(0, '#000000');
                    bodyGrad.addColorStop(0.8, '#0a001a');
                    bodyGrad.addColorStop(1, '#330066');
                    ctx.fillStyle = bodyGrad;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#cc00ff';
                    ctx.lineWidth = 1.5;
                    ctx.shadowColor = '#ff00ff';
                    ctx.shadowBlur = 20;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.size * 1.1, 0, Math.PI * 2);
                    ctx.stroke();
                    for (let i = 0; i < 4; i++) {
                        const a = this.time * 2 + i * Math.PI / 2;
                        const r = this.size * 1.8;
                        const px = this.x + Math.cos(a) * r;
                        const py = this.y + Math.sin(a) * r;
                        ctx.fillStyle = '#ff88ff';
                        ctx.shadowColor = '#ff00ff';
                        ctx.shadowBlur = 10;
                        ctx.beginPath();
                        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.restore();
                }
            }

            // ============================================================
            // 4. БИРЮЗОВАЯ МОЛНИЯ (шар с электрическими дугами)
            // ============================================================
            class TurquoiseLightning extends Projectile {
                constructor(x, y, tx, ty) {
                    super(x, y, tx, ty);
                    this.size = 10;
                    this.time = 0;
                    this.bolts = [];
                }
                update(scale = 1) {
                    super.update(scale);
                    this.time += 0.2;
                    if (Math.random() < 0.5 || this.bolts.length === 0) {
                        this.bolts = [];
                        for (let i = 0; i < 5; i++) {
                            const points = [];
                            const angle = Math.random() * Math.PI * 2;
                            const len = 15 + Math.random() * 25;
                            let cx = 0, cy = 0;
                            points.push({x: 0, y: 0});
                            for (let j = 0; j < 4; j++) {
                                const t = (j + 1) / 4;
                                cx = Math.cos(angle) * len * t + (Math.random() - 0.5) * 12;
                                cy = Math.sin(angle) * len * t + (Math.random() - 0.5) * 12;
                                points.push({x: cx, y: cy});
                            }
                            this.bolts.push(points);
                        }
                    }
                }
                draw() {
                    ctx.save();
                    for (let i = 0; i < this.trail.length; i++) {
                        const p = this.trail[i];
                        const a = (i / this.trail.length) * 0.5;
                        ctx.globalAlpha = a;
                        ctx.fillStyle = '#00ffcc';
                        ctx.shadowColor = '#00ffcc';
                        ctx.shadowBlur = 15;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, (i/this.trail.length) * this.size * 0.8, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.globalAlpha = 1;
                    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 3);
                    grad.addColorStop(0, 'rgba(150, 255, 220, 0.9)');
                    grad.addColorStop(0.4, 'rgba(0, 230, 200, 0.5)');
                    grad.addColorStop(1, 'rgba(0, 100, 100, 0)');
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#ffffff';
                    ctx.shadowColor = '#00ffcc';
                    ctx.shadowBlur = 25;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.size * 0.7, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#aaffee';
                    ctx.lineWidth = 2;
                    ctx.shadowColor = '#ffffff';
                    ctx.shadowBlur = 15;
                    for (const bolt of this.bolts) {
                        ctx.beginPath();
                        for (let i = 0; i < bolt.length; i++) {
                            const px = this.x + bolt[i].x;
                            const py = this.y + bolt[i].y;
                            if (i === 0) ctx.moveTo(px, py);
                            else ctx.lineTo(px, py);
                        }
                        ctx.stroke();
                    }
                    ctx.restore();
                }
            }

            // ============================================================
            // 5. РАДУЖНЫЙ ШАР (разноцветный)
            // ============================================================
            class RainbowOrb extends Projectile {
                constructor(x, y, tx, ty) {
                    super(x, y, tx, ty);
                    this.size = 11;
                    this.time = 0;
                }
                update(scale = 1) {
                    super.update(scale);
                    this.time += 0.15;
                }
                draw() {
                    ctx.save();
                    for (let i = 0; i < this.trail.length; i++) {
                        const p = this.trail[i];
                        const a = (i / this.trail.length) * 0.5;
                        const hue = (this.time * 60 + i * 30) % 360;
                        ctx.globalAlpha = a;
                        ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
                        ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
                        ctx.shadowBlur = 15;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, (i/this.trail.length) * this.size * 1.2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.globalAlpha = 1;
                    const hue = (this.time * 60) % 360;
                    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 3.5);
                    grad.addColorStop(0, `hsla(${hue}, 100%, 70%, 0.9)`);
                    grad.addColorStop(0.4, `hsla(${(hue + 60) % 360}, 100%, 60%, 0.5)`);
                    grad.addColorStop(1, `hsla(${(hue + 120) % 360}, 100%, 50%, 0)`);
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.size * 3.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#ffffff';
                    ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
                    ctx.shadowBlur = 25;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.size * 0.7, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            }

            // ============================================================
            // СПИСОК СНАРЯДОВ
            // ============================================================
            const projectileTypes = [
                { name: '🔮 Энергия', class: EnergySphere, color: '#cc00ff', electric: false },
                { name: '☣ Кислота', class: AcidBall, color: '#44ff44', electric: false },
                { name: '🌑 Тьма', class: DarkMatter, color: '#cc00ff', electric: false },
                { name: '⚡ Молния', class: TurquoiseLightning, color: '#00ffcc', electric: true },
                { name: '🌈 Радуга', class: RainbowOrb, color: '#ffffff', electric: false }
            ];

            let currentTypeIndex = 0;

            // ---- Игровое состояние ----
            const projectiles = [];
            const explosions = [];

            class Explosion {
                constructor(x, y, color) {
                    this.x = x;
                    this.y = y;
                    this.color = color;
                    this.time = 0;
                    this.maxTime = 25;
                    this.particles = [];
                    for (let i = 0; i < 20; i++) {
                        const a = Math.random() * Math.PI * 2;
                        const speed = 2 + Math.random() * 5;
                        this.particles.push({
                            x: x, y: y,
                            vx: Math.cos(a) * speed,
                            vy: Math.sin(a) * speed,
                            life: 20 + Math.random() * 15,
                            maxLife: 35,
                            size: 2 + Math.random() * 3
                        });
                    }
                }
                update() {
                    this.time++;
                    for (let i = this.particles.length - 1; i >= 0; i--) {
                        const p = this.particles[i];
                        p.x += p.vx;
                        p.y += p.vy;
                        p.vx *= 0.94;
                        p.vy *= 0.94;
                        p.life--;
                        if (p.life <= 0) this.particles.splice(i, 1);
                    }
                }
                draw() {
                    if (this.time < 8) {
                        const a = 1 - this.time / 8;
                        const r = 10 + this.time * 8;
                        const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r);
                        g.addColorStop(0, `rgba(255, 255, 255, ${a})`);
                        g.addColorStop(0.5, this.color.replace(')', `, ${a * 0.6})`).replace('rgb', 'rgba'));
                        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
                        ctx.fillStyle = g;
                        ctx.beginPath();
                        ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    for (const p of this.particles) {
                        const a = p.life / p.maxLife;
                        ctx.globalAlpha = a;
                        ctx.fillStyle = this.color;
                        ctx.shadowColor = this.color;
                        ctx.shadowBlur = 10;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
                get dead() { return this.time >= this.maxTime; }
            }

            
function renderFrame(scale = 1) {
    ctx.clearRect(0, 0, width, height);
    for (let i = projectiles.length - 1; i >= 0; i--) {
        projectiles[i].update(scale); projectiles[i].draw();
        if (projectiles[i].dead) projectiles.splice(i, 1);
    }
    for (let i = explosions.length - 1; i >= 0; i--) {
        explosions[i].update(); explosions[i].draw();
        if (explosions[i].dead) explosions.splice(i, 1);
    }
}
return {
 canvas,
 resize,
 renderFrame,
 spawn(typeIndex, sx, sy, tx, ty, onHit) {
   const type = projectileTypes[((typeIndex % projectileTypes.length) + projectileTypes.length) % projectileTypes.length];
   const projectile = new type.class(sx, sy, tx, ty);
   projectile.onHit = () => { explosions.push(new Explosion(projectile.x, projectile.y, type.color)); if (onHit) onHit(projectile); };
   projectiles.push(projectile);
   return projectile;
 },
 getProjectiles(){ return projectiles; },
 clear(){ projectiles.length=0; explosions.length=0; }
};
};

        const createOriginalBlackHoleEffect = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            let width = 1, height = 1;
            function resize(w, h) { width = Math.max(1,w); height = Math.max(1,h); const renderScale=0.72; canvas.width=Math.max(1,Math.round(width*renderScale));canvas.height=Math.max(1,Math.round(height*renderScale));ctx.setTransform(renderScale,0,0,renderScale,0,0); }

            // ---- Состояние чёрной дыры ----
            const blackHole = {
                active: false,
                x: 0,
                y: 0,
                vx: 0,
                radius: 0,
                targetRadius: 55,
                rotation: 0,
                rotationSpeed: 0.06,
                life: 0,
                maxLife: 300,
                phase: 0,
                progress: 0,
                particles: [],
                spiralPhase: 0,
                collapseScale: 1,
                nebulaBlobs: [],
                innerNebulaBlobs: [],
                visualRadius: 0,
                // Глобальное время для анимации туманности
                nebulaTime: 0
            };

            // ---- Туманность (внешняя) ----
            function generateNebulaBlobs(count) {
                const blobs = [];
                for (let i = 0; i < count; i++) {
                    const distFactor = Math.pow(Math.random(), 2.5);
                    const angle = Math.random() * Math.PI * 2;
                    const sizeFactor = (1 - distFactor * 0.7) * (0.6 + Math.random() * 0.5);
                    const brightness = (1 - distFactor * 0.5) * (0.5 + Math.random() * 0.5);
                    
                    const colors = [
                        'rgba(180, 0, 255, ',
                        'rgba(130, 0, 220, ',
                        'rgba(90, 0, 170, ',
                        'rgba(60, 0, 120, ',
                        'rgba(210, 80, 255, '
                    ];
                    const colorBase = colors[Math.floor(Math.random() * colors.length)];
                    
                    blobs.push({
                        baseAngle: angle,
                        baseDist: distFactor,
                        sizeFactor: sizeFactor,
                        brightness: brightness,
                        colorBase: colorBase,
                        // Несколько независимых фаз для хаотичного движения
                        phaseX: Math.random() * Math.PI * 2,
                        phaseY: Math.random() * Math.PI * 2,
                        phaseA: Math.random() * Math.PI * 2,
                        phaseR: Math.random() * Math.PI * 2,
                        speedX: 0.5 + Math.random() * 1.0,
                        speedY: 0.5 + Math.random() * 1.0,
                        speedA: 0.4 + Math.random() * 0.8,
                        speedR: 0.4 + Math.random() * 0.8,
                        ampX: 0.3 + Math.random() * 0.5,   // амплитуда дрейфа по X (в долях r)
                        ampY: 0.3 + Math.random() * 0.5,   // амплитуда дрейфа по Y
                        ampA: 0.15 + Math.random() * 0.25, // амплитуда по углу
                        ampR: 0.1 + Math.random() * 0.2    // амплитуда по радиусу
                    });
                }
                return blobs;
            }

            // ---- Туманность внутри чёрного круга ----
            function generateInnerNebulaBlobs(count) {
                const blobs = [];
                for (let i = 0; i < count; i++) {
                    const distFactor = Math.pow(Math.random(), 1.5);
                    const angle = Math.random() * Math.PI * 2;
                    const sizeFactor = 0.4 + Math.random() * 0.6;
                    const brightness = 0.3 + Math.random() * 0.5;
                    
                    const colors = [
                        'rgba(120, 0, 200, ',
                        'rgba(80, 0, 160, ',
                        'rgba(160, 0, 240, ',
                        'rgba(50, 0, 100, '
                    ];
                    const colorBase = colors[Math.floor(Math.random() * colors.length)];
                    
                    blobs.push({
                        baseAngle: angle,
                        baseDist: distFactor,
                        sizeFactor: sizeFactor,
                        brightness: brightness,
                        colorBase: colorBase,
                        phaseX: Math.random() * Math.PI * 2,
                        phaseY: Math.random() * Math.PI * 2,
                        phaseA: Math.random() * Math.PI * 2,
                        phaseR: Math.random() * Math.PI * 2,
                        speedX: 0.6 + Math.random() * 1.2,
                        speedY: 0.6 + Math.random() * 1.2,
                        speedA: 0.5 + Math.random() * 0.9,
                        speedR: 0.5 + Math.random() * 0.9,
                        ampX: 0.15 + Math.random() * 0.2,
                        ampY: 0.15 + Math.random() * 0.2,
                        ampA: 0.2 + Math.random() * 0.3,
                        ampR: 0.1 + Math.random() * 0.15
                    });
                }
                return blobs;
            }

            // ---- Частица-искра ----
            class Particle {
                constructor(x, y, angle, speed, life, color, size) {
                    this.x = x;
                    this.y = y;
                    this.vx = Math.cos(angle) * speed;
                    this.vy = Math.sin(angle) * speed;
                    this.life = life;
                    this.maxLife = life;
                    this.color = color;
                    this.size = size;
                    this.decay = 0.96 + Math.random() * 0.03;
                }
                update(bh, maxRadius) {
                    this.x += this.vx;
                    this.y += this.vy;
                    this.vx *= this.decay;
                    this.vy *= this.decay;
                    if (bh.active) {
                        const dx = bh.x - this.x;
                        const dy = bh.y - this.y;
                        const dist = Math.sqrt(dx * dx + dy * dy) + 1;
                        const force = 250 / (dist * dist + 50);
                        this.vx += (dx / dist) * force;
                        this.vy += (dy / dist) * force;
                    }
                    if (maxRadius > 0 && bh.active) {
                        const dx = this.x - bh.x;
                        const dy = this.y - bh.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist > maxRadius) {
                            const k = maxRadius / dist;
                            this.x = bh.x + dx * k;
                            this.y = bh.y + dy * k;
                            this.vx *= 0.5;
                            this.vy *= 0.5;
                        }
                    }
                    this.life--;
                    this.size *= 0.98;
                }
                draw(ctx) {
                    const alpha = Math.max(0, this.life / this.maxLife);
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = this.color;
                    ctx.shadowColor = this.color;
                    ctx.shadowBlur = 10;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, Math.max(0.1, this.size), 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // ---- Орбитальная частица ----
            class OrbitingParticle {
                constructor(bh, orbitRadius, orbitAngle, orbitSpeed, color, size) {
                    this.orbitRadius = orbitRadius;
                    this.orbitAngle = orbitAngle;
                    this.orbitSpeed = orbitSpeed;
                    this.color = color;
                    this.size = size;
                    this.life = 999999;
                    this.maxLife = 999999;
                    this.alpha = 1;
                    this.decay = 1;
                }
                update(bh, maxRadius) {
                    this.orbitAngle += this.orbitSpeed;
                    this.orbitRadius *= 0.9985;
                    
                    const visualLimit = maxRadius * 0.85;
                    if (this.orbitRadius > visualLimit) {
                        this.orbitRadius = visualLimit;
                    }
                    
                    this.x = bh.x + Math.cos(this.orbitAngle) * this.orbitRadius;
                    this.y = bh.y + Math.sin(this.orbitAngle) * this.orbitRadius;
                    
                    if (this.orbitRadius < bh.radius * 1.2) {
                        this.orbitRadius = bh.radius * (2.0 + Math.random() * 1.5);
                        if (this.orbitRadius > visualLimit) this.orbitRadius = visualLimit;
                        this.orbitAngle = Math.random() * Math.PI * 2;
                    }
                }
                draw(ctx) {
                    ctx.globalAlpha = this.alpha;
                    ctx.fillStyle = this.color;
                    ctx.shadowColor = this.color;
                    ctx.shadowBlur = 12;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            function spawnBlackHole(spawnX = -80, spawnY = height / 2) {
                blackHole.active = true;
                blackHole.x = spawnX;
                blackHole.y = spawnY;
                blackHole.vx = -3.2;
                blackHole.radius = 0.65;
                blackHole.targetRadius = 55 + Math.random() * 15;
                blackHole.rotation = 0;
                blackHole.rotationSpeed = 0.06 + Math.random() * 0.03;
                blackHole.life = 0;
                blackHole.maxLife = Number.POSITIVE_INFINITY;
                blackHole.phase = 1;
                blackHole.progress = 0;
                blackHole.spiralPhase = 0;
                blackHole.collapseScale = 1;
                blackHole.particles = [];
                blackHole.nebulaTime = 0;
                blackHole.nebulaBlobs = generateNebulaBlobs(28);
                blackHole.innerNebulaBlobs = generateInnerNebulaBlobs(14);
                blackHole.visualRadius = 0.65 * 3.2;
                
                const orbColors = ['#ffffff', '#e066ff', '#cc00ff', '#ff88ff', '#9900cc'];
                for (let i = 0; i < 8; i++) {
                    const orbR = blackHole.targetRadius * (1.6 + Math.random() * 0.7);
                    const orbAngle = Math.random() * Math.PI * 2;
                    const orbSpeed = (0.015 + Math.random() * 0.03) * (Math.random() < 0.5 ? 1 : -1);
                    const color = orbColors[Math.floor(Math.random() * orbColors.length)];
                    const size = 1.5 + Math.random() * 2;
                    blackHole.particles.push(new OrbitingParticle(blackHole, orbR, orbAngle, orbSpeed, color, size));
                }
            }

            function spawnBlackHoleParticles() {
                const bh = blackHole;
                const colors = ['#1a0033', '#330066', '#660099', '#9900cc', '#cc00ff', '#e066ff', '#ff88ff'];
                
                if (Math.random() < 0.4) {
                    const angle = Math.random() * Math.PI * 2;
                    const rad = bh.radius * 1.2;
                    const px = bh.x + Math.cos(angle) * rad;
                    const py = bh.y + Math.sin(angle) * rad;
                    const outAngle = angle + (Math.random() - 0.5) * 0.5;
                    const speed = 1 + Math.random() * 3;
                    const color = colors[Math.floor(Math.random() * colors.length)];
                    bh.particles.push(new Particle(px, py, outAngle, speed, 20 + Math.random() * 25, color, 1 + Math.random() * 2));
                }
            }

            function updateBlackHole() {
                const bh = blackHole;
                if (!bh.active) return;

                bh.rotation += bh.rotationSpeed;
                bh.spiralPhase += 0.06;
                // Глобальное время туманности растёт независимо — это ключевое
                bh.nebulaTime += 0.016;

                if (bh.phase === 1) {
                    // It enters as a tiny singularity and grows while travelling in from Discord.
                    bh.progress = Math.min(1, bh.progress + 0.0065);
                    const t = bh.progress * bh.progress * (3 - 2 * bh.progress);
                    bh.radius = 0.65 + t * (bh.targetRadius - 0.65);
                    bh.x += bh.vx;
                    bh.visualRadius = bh.radius * 3.2;
                    
                    if (bh.progress >= 1) {
                        bh.phase = 2;
                        bh.progress = 0;
                        bh.radius = bh.targetRadius;
                    }
                } else if (bh.phase === 2) {
                    bh.x += bh.vx;
                    bh.life++;
                    spawnBlackHoleParticles();
                    
                    // Do not time out: begin collapsing only after the whole hole has
                    // crossed the player's lane and moved beyond the left side of them.
                    const playerLane = width * 0.22;
                    if (bh.x + bh.visualRadius < playerLane - 24) {
                        bh.phase = 3;
                        bh.progress = 0;
                    }
                } else if (bh.phase === 3) {
                    bh.progress = Math.min(1, bh.progress + 0.02);
                    const t = bh.progress;
                    bh.collapseScale = 1 - t;
                    bh.x += bh.vx * (1 - t * 0.8);
                    bh.rotation += bh.rotationSpeed * (1 + t * 3);
                    bh.visualRadius = bh.radius * bh.collapseScale * 3.2;
                    
                    for (let p of bh.particles) {
                        if (p instanceof OrbitingParticle) {
                            p.alpha = Math.max(0, 1 - t * 1.5);
                        }
                    }
                    
                    if (bh.progress >= 1) {
                        bh.active = false;
                        bh.phase = 0;
                        bh.particles = [];
                    }
                }

                for (let i = bh.particles.length - 1; i >= 0; i--) {
                    bh.particles[i].update(bh, bh.visualRadius);
                    if (bh.particles[i].life <= 0) {
                        bh.particles.splice(i, 1);
                    }
                }
            }

            // ---- Спиральный рукав ----
            function drawSpiralArm(cx, cy, baseR, turns, color, lineWidth, startAngle, alpha) {
                ctx.beginPath();
                let first = true;
                const steps = 90;
                for (let s = 0; s <= steps; s++) {
                    const t = s / steps;
                    const angle = startAngle + t * Math.PI * 2 * turns;
                    const rad = baseR * (0.1 + t * 0.9);
                    const px = cx + Math.cos(angle) * rad;
                    const py = cy + Math.sin(angle) * rad;
                    if (first) { ctx.moveTo(px, py); first = false; }
                    else ctx.lineTo(px, py);
                }
                ctx.strokeStyle = color;
                ctx.lineWidth = lineWidth;
                ctx.globalAlpha = alpha;
                ctx.stroke();
            }

            // ---- Туманность (внешняя) — ХАОТИЧНОЕ БЛУЖДАНИЕ ----
            function drawNebula(bh, x, y, r, scale) {
                ctx.save();
                const t = bh.nebulaTime;
                
                const outerGlow = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 2.6);
                outerGlow.addColorStop(0, `rgba(70, 0, 140, ${0.35 * scale})`);
                outerGlow.addColorStop(0.5, `rgba(35, 0, 80, ${0.18 * scale})`);
                outerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = outerGlow;
                ctx.beginPath();
                ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
                ctx.fill();
                
                const sortedBlobs = bh.nebulaBlobs.slice().sort((a, b) => b.baseDist - a.baseDist);
                
                for (const blob of sortedBlobs) {
                    // ХАОТИЧНОЕ БЛУЖДАНИЕ:
                    // 1) Смещение по X и Y в декартовых координатах (независимые фазы)
                    // 2) Смещение по углу и радиусу
                    // Каждое пятно качается по своим траекториям с большой амплитудой
                    
                    const basePx = Math.cos(blob.baseAngle) * (1.0 + blob.baseDist * 1.4);
                    const basePy = Math.sin(blob.baseAngle) * (1.0 + blob.baseDist * 1.4);
                    
                    // Декартовы колебания — 2 независимые синусоиды
                    const dx = Math.sin(t * blob.speedX + blob.phaseX) * blob.ampX;
                    const dy = Math.cos(t * blob.speedY + blob.phaseY) * blob.ampY;
                    
                    // Плюс колебание по углу и радиусу
                    const angleOffset = Math.sin(t * blob.speedA + blob.phaseA) * blob.ampA;
                    const radOffset = Math.cos(t * blob.speedR + blob.phaseR) * blob.ampR;
                    
                    const finalAngle = blob.baseAngle + angleOffset;
                    const finalDist = (1.0 + blob.baseDist * 1.4) + radOffset;
                    
                    const localX = Math.cos(finalAngle) * finalDist + dx;
                    const localY = Math.sin(finalAngle) * finalDist + dy;
                    
                    const px = x + localX * r;
                    const py = y + localY * r;
                    
                    const breathe = 1 + Math.sin(t * 1.5 + blob.phaseX) * 0.15;
                    const blobSize = r * blob.sizeFactor * (0.9 + blob.baseDist * 0.8) * breathe;
                    const alpha = blob.brightness * scale * 0.5 * (1 - blob.baseDist * 0.5);
                    
                    const grad = ctx.createRadialGradient(px, py, 0, px, py, blobSize);
                    grad.addColorStop(0, blob.colorBase + `${alpha * 0.8})`);
                    grad.addColorStop(0.5, blob.colorBase + `${alpha * 0.35})`);
                    grad.addColorStop(1, blob.colorBase + '0)');
                    
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(px, py, blobSize, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }

            // ---- Туманность внутри — ХАОТИЧНОЕ БЛУЖДАНИЕ ----
            function drawInnerNebula(bh, x, y, r, scale) {
                ctx.save();
                const t = bh.nebulaTime;
                
                const innerGlow = ctx.createRadialGradient(x, y, 0, x, y, r * 0.95);
                innerGlow.addColorStop(0, `rgba(0, 0, 0, ${1 * scale})`);
                innerGlow.addColorStop(0.6, `rgba(10, 0, 30, ${1 * scale})`);
                innerGlow.addColorStop(0.85, `rgba(40, 0, 80, ${0.8 * scale})`);
                innerGlow.addColorStop(1, `rgba(100, 0, 180, ${0.4 * scale})`);
                ctx.fillStyle = innerGlow;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
                
                for (const blob of bh.innerNebulaBlobs) {
                    const basePx = Math.cos(blob.baseAngle) * (0.3 + blob.baseDist * 0.6);
                    const basePy = Math.sin(blob.baseAngle) * (0.3 + blob.baseDist * 0.6);
                    
                    const dx = Math.sin(t * blob.speedX + blob.phaseX) * blob.ampX;
                    const dy = Math.cos(t * blob.speedY + blob.phaseY) * blob.ampY;
                    
                    const angleOffset = Math.sin(t * blob.speedA + blob.phaseA) * blob.ampA;
                    const radOffset = Math.cos(t * blob.speedR + blob.phaseR) * blob.ampR;
                    
                    const finalAngle = blob.baseAngle + angleOffset;
                    const finalDist = (0.3 + blob.baseDist * 0.6) + radOffset;
                    
                    const localX = Math.cos(finalAngle) * finalDist + dx;
                    const localY = Math.sin(finalAngle) * finalDist + dy;
                    
                    const px = x + localX * r;
                    const py = y + localY * r;
                    
                    const breathe = 1 + Math.sin(t * 1.8 + blob.phaseX) * 0.2;
                    const blobSize = r * blob.sizeFactor * 0.5 * breathe;
                    const alpha = blob.brightness * scale * 0.35 * (0.5 + blob.baseDist * 0.5);
                    
                    const grad = ctx.createRadialGradient(px, py, 0, px, py, blobSize);
                    grad.addColorStop(0, blob.colorBase + `${alpha})`);
                    grad.addColorStop(0.5, blob.colorBase + `${alpha * 0.4})`);
                    grad.addColorStop(1, blob.colorBase + '0)');
                    
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(px, py, blobSize, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }

            function drawBlackHole() {
                const bh = blackHole;
                if (!bh.active) return;

                const x = bh.x;
                const y = bh.y;
                const scale = bh.collapseScale;
                const r = bh.radius * scale;
                const rot = bh.rotation;

                ctx.save();
                ctx.shadowBlur = 0;
                ctx.shadowColor = 'transparent';
                for (let p of bh.particles) {
                    if (p instanceof Particle) {
                        p.draw(ctx);
                    }
                }
                ctx.restore();

                // 1. Внешняя туманность
                drawNebula(bh, x, y, r, scale);

                // 2. Спирали
                ctx.save();
                ctx.translate(x, y);
                
                const numSpirals = 8;
                for (let i = 0; i < numSpirals; i++) {
                    const baseAngle = (i / numSpirals) * Math.PI * 2;
                    const direction = i % 2 === 0 ? 1 : -1;
                    const spin = rot * 1.3 * direction + baseAngle;
                    
                    const radius = r * 2.8;
                    const turns = 2.2 + (i % 3) * 0.6;
                    
                    ctx.shadowColor = '#9900cc';
                    ctx.shadowBlur = 20;
                    drawSpiralArm(0, 0, radius, turns, '#440077', 3.2, spin, 0.32 * scale);
                    
                    ctx.shadowBlur = 15;
                    drawSpiralArm(0, 0, radius * 0.85, turns, '#7700aa', 2.2, spin + 0.2 * direction, 0.48 * scale);
                    
                    ctx.shadowBlur = 10;
                    drawSpiralArm(0, 0, radius * 0.68, turns, '#cc00ff', 1.2, spin + 0.4 * direction, 0.65 * scale);
                    
                    ctx.shadowBlur = 6;
                    drawSpiralArm(0, 0, radius * 0.55, turns, '#ff88ff', 0.5, spin + 0.6 * direction, 0.45 * scale);
                }
                ctx.restore();

                // 3. Искажение
                ctx.save();
                for (let i = 0; i < 3; i++) {
                    const offsetX = (Math.random() - 0.5) * 10 * (i + 1);
                    const offsetY = (Math.random() - 0.5) * 10 * (i + 1);
                    const distortR = r * (3.2 + i * 0.6);
                    const distortGrad = ctx.createRadialGradient(
                        x + offsetX, y + offsetY, r * 1.2,
                        x + offsetX, y + offsetY, distortR
                    );
                    distortGrad.addColorStop(0, `rgba(160, 0, 255, ${0.06 * scale})`);
                    distortGrad.addColorStop(0.5, `rgba(70, 0, 150, ${0.04 * scale})`);
                    distortGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    ctx.fillStyle = distortGrad;
                    ctx.beginPath();
                    ctx.arc(x + offsetX, y + offsetY, distortR, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();

                // 4. Внутренний диск
                ctx.save();
                const diskGrad = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 2.2);
                diskGrad.addColorStop(0, `rgba(200, 0, 255, ${0.7 * scale})`);
                diskGrad.addColorStop(0.3, `rgba(150, 0, 200, ${0.35 * scale})`);
                diskGrad.addColorStop(0.7, `rgba(80, 0, 120, ${0.12 * scale})`);
                diskGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = diskGrad;
                ctx.beginPath();
                ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                // 5. Кольцо
                ctx.save();
                const ringGrad = ctx.createRadialGradient(x, y, r * 0.85, x, y, r * 1.4);
                ringGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
                ringGrad.addColorStop(0.5, `rgba(180, 0, 255, ${0.9 * scale})`);
                ringGrad.addColorStop(0.8, `rgba(100, 0, 180, ${0.6 * scale})`);
                ringGrad.addColorStop(1, 'rgba(50, 0, 100, 0)');
                ctx.fillStyle = ringGrad;
                ctx.beginPath();
                ctx.arc(x, y, r * 1.4, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                // 6. Горизонт
                ctx.save();
                ctx.shadowColor = '#cc00ff';
                ctx.shadowBlur = 40;
                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                // 7. Внутренняя туманность
                drawInnerNebula(bh, x, y, r, scale);

                // 8. Внутреннее свечение края
                ctx.save();
                const edgeGlow = ctx.createRadialGradient(x, y, r * 0.7, x, y, r);
                edgeGlow.addColorStop(0, 'rgba(0, 0, 0, 0)');
                edgeGlow.addColorStop(0.7, `rgba(30, 0, 60, ${0.5 * scale})`);
                edgeGlow.addColorStop(0.92, `rgba(150, 0, 240, ${0.7 * scale})`);
                edgeGlow.addColorStop(1, `rgba(200, 0, 255, ${0.5 * scale})`);
                ctx.fillStyle = edgeGlow;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                // 9. Кольцо
                ctx.save();
                ctx.strokeStyle = '#cc00ff';
                ctx.lineWidth = 2 * scale;
                ctx.shadowColor = '#e066ff';
                ctx.shadowBlur = 25;
                ctx.globalAlpha = 0.7 * scale;
                ctx.beginPath();
                ctx.arc(x, y, r * 1.05, 0, Math.PI * 2);
                ctx.stroke();
                
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 0.8 * scale;
                ctx.shadowColor = '#ffffff';
                ctx.shadowBlur = 12;
                ctx.globalAlpha = 0.5 * scale;
                ctx.beginPath();
                ctx.arc(x, y, r * 1.02, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();

                // 10. Орбитальные частицы
                ctx.save();
                for (let p of bh.particles) {
                    if (p instanceof OrbitingParticle) {
                        p.draw(ctx);
                    }
                }
                ctx.restore();
            }

            
function renderFrame() {
 updateBlackHole();
 ctx.clearRect(0, 0, width, height);
 drawBlackHole();
}
return {canvas, resize, spawn: spawnBlackHole, renderFrame, getState(){return blackHole;}, clear(){blackHole.active=false;blackHole.particles=[];}};
};

        const createOriginalLaserEffect = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            let width = 1, height = 1;
            function resize(w, h) { width = Math.max(1,w); height = Math.max(1,h); canvas.width = width; canvas.height = height; }

            // ---- Состояние лазера ----
            let laser = {
                active: false,
                phase: 0,          // 0: idle, 1: charging, 2: firing, 3: fading
                progress: 0,
                startX: 0,
                startY: 0,
                endX: 0,
                endY: 0,
                coreWidth: 0,
                glowWidth: 0,
                phase1Duration: 42,
                phase2Duration: 50,
                phase3Duration: 32,
                frameCounter: 0,
                colorCore: '#ffffff',
                colorInner: '#e066ff',
                colorOuter: '#cc00ff',
                colorGlow: '#8800cc',
                particles: [],
                chargeRingRadius: 0,
                chargeRingAlpha: 0
            };

            // ---- Частицы ----
            class Particle {
                constructor(x, y, angle, speed, life, color, size) {
                    this.x = x;
                    this.y = y;
                    this.vx = Math.cos(angle) * speed;
                    this.vy = Math.sin(angle) * speed;
                    this.life = life;
                    this.maxLife = life;
                    this.color = color;
                    this.size = size;
                    this.decay = 0.94 + Math.random() * 0.04;
                }
                update(scale = 1) {
                    this.x += this.vx * scale;
                    this.y += this.vy * scale;
                    this.vx *= this.decay;
                    this.vy *= this.decay;
                    this.life--;
                    this.size *= 0.97;
                }
                draw(ctx) {
                    const alpha = Math.max(0, this.life / this.maxLife);
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = this.color;
                    ctx.shadowColor = this.color;
                    ctx.shadowBlur = 12;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            function fireLaser(startX, startY, endX, endY) {
                laser.particles = [];
                laser.startX = startX;
                laser.startY = startY;
                laser.endX = endX;
                laser.endY = endY;
                laser.phase = 1;
                laser.progress = 0;
                laser.frameCounter = 0;
                laser.coreWidth = 1;
                laser.glowWidth = 4;
                laser.active = true;
                laser.chargeRingRadius = 0;
                laser.chargeRingAlpha = 1;
            }

            function spawnLaserParticles(intensity = 1) {
                const dx = laser.endX - laser.startX;
                const dy = laser.endY - laser.startY;
                const length = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx);
                
                const count = Math.floor(length / 24 * intensity) + 2;
                
                for (let i = 0; i < count; i++) {
                    const t = Math.random();
                    const px = laser.startX + dx * t;
                    const py = laser.startY + dy * t;
                    
                    const spreadAngle = angle + (Math.random() - 0.5) * 1.0;
                    const speed = 1 + Math.random() * 4;
                    const life = 10 + Math.floor(Math.random() * 18);
                    
                    const colors = ['#ffffff', '#e066ff', '#cc00ff', '#9900cc', '#6600aa', '#ff88ff'];
                    const color = colors[Math.floor(Math.random() * colors.length)];
                    const size = 1 + Math.random() * 2.5;
                    
                    laser.particles.push(new Particle(px, py, spreadAngle, speed, life, color, size));
                }
            }

            function updateLaser() {
                if (!laser.active) return;

                laser.frameCounter++;

                if (laser.phase === 1) {
                    laser.progress = laser.frameCounter / laser.phase1Duration;
                    const t = Math.min(1, laser.progress);
                    laser.coreWidth = 1 + t * 2;
                    laser.glowWidth = 3 + t * 5;
                    
                    laser.chargeRingRadius = 10 + t * 40;
                    laser.chargeRingAlpha = 1 - t * 0.7;
                    
                    if (laser.frameCounter % 2 === 0) {
                        const ang = Math.random() * Math.PI * 2;
                        const dist = 30 + Math.random() * 30;
                        const px = laser.startX + Math.cos(ang) * dist;
                        const py = laser.startY + Math.sin(ang) * dist;
                        const toCenterAngle = Math.atan2(laser.startY - py, laser.startX - px);
                        const speed = 2 + Math.random() * 2;
                        const life = 12 + Math.floor(Math.random() * 8);
                        const colors = ['#e066ff', '#cc00ff', '#ff88ff', '#ffffff'];
                        const color = colors[Math.floor(Math.random() * colors.length)];
                        laser.particles.push(new Particle(px, py, toCenterAngle, speed, life, color, 1.5 + Math.random() * 2));
                    }
                    
                    if (laser.progress >= 1) {
                        laser.phase = 2;
                        laser.progress = 0;
                        laser.frameCounter = 0;
                        spawnLaserParticles(1.2);
                    }
                }
                else if (laser.phase === 2) {
                    laser.progress = laser.frameCounter / laser.phase2Duration;
                    const pulse = Math.sin(laser.frameCounter * 0.35) * 0.3 + 0.7;
                    laser.coreWidth = 4 + pulse * 3.5;
                    laser.glowWidth = 10 + pulse * 9;
                    
                    if (laser.frameCounter % 3 === 0) {
                        spawnLaserParticles(0.5);
                    }
                    
                    if (laser.frameCounter % 4 === 0) {
                        const ang = Math.random() * Math.PI * 2;
                        const px = laser.startX + Math.cos(ang) * 50;
                        const py = laser.startY + Math.sin(ang) * 50;
                        const outAngle = Math.atan2(py - laser.startY, px - laser.startX);
                        const colors = ['#cc00ff', '#e066ff', '#ff88ff'];
                        laser.particles.push(new Particle(px, py, outAngle, 3 + Math.random() * 3, 15, colors[Math.floor(Math.random() * 3)], 2));
                    }
                    
                    if (laser.progress >= 1) {
                        laser.phase = 3;
                        laser.progress = 0;
                        laser.frameCounter = 0;
                    }
                }
                else if (laser.phase === 3) {
                    laser.progress = laser.frameCounter / laser.phase3Duration;
                    const t = 1 - laser.progress;
                    laser.coreWidth = 1 + t * 5;
                    laser.glowWidth = 2 + t * 15;
                    
                    if (laser.progress >= 1) {
                        laser.active = false;
                        laser.phase = 0;
                        laser.coreWidth = 0;
                        laser.glowWidth = 0;
                        laser.particles = [];
                    }
                }

                for (let i = laser.particles.length - 1; i >= 0; i--) {
                    laser.particles[i].update();
                    if (laser.particles[i].life <= 0) {
                        laser.particles.splice(i, 1);
                    }
                }
            }

            function drawLaser() {
                if (!laser.active && laser.particles.length === 0) return;

                const startX = laser.startX;
                const startY = laser.startY;
                const endX = laser.endX;
                const endY = laser.endY;

                ctx.save();
                ctx.shadowBlur = 0;
                ctx.shadowColor = 'transparent';
                for (let p of laser.particles) {
                    p.draw(ctx);
                }
                ctx.restore();

                if (laser.active && laser.coreWidth > 0.5) {
                    if (laser.phase === 1 && laser.chargeRingAlpha > 0.01) {
                        ctx.save();
                        ctx.strokeStyle = laser.colorInner;
                        ctx.lineWidth = 3;
                        ctx.shadowColor = laser.colorOuter;
                        ctx.shadowBlur = 25;
                        ctx.globalAlpha = laser.chargeRingAlpha;
                        ctx.beginPath();
                        ctx.arc(startX, startY, laser.chargeRingRadius, 0, Math.PI * 2);
                        ctx.stroke();
                        
                        ctx.globalAlpha = laser.chargeRingAlpha * 0.5;
                        ctx.lineWidth = 1.5;
                        ctx.beginPath();
                        ctx.arc(startX, startY, laser.chargeRingRadius * 0.6, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.restore();
                    }

                    if (laser.phase === 1) {
                        ctx.save();
                        const pulse = 0.45 + Math.sin(Date.now() * 0.018) * 0.22;
                        ctx.setLineDash([10, 9]);
                        ctx.lineDashOffset = -Date.now() * 0.035;
                        ctx.strokeStyle = '#ffe66b';
                        ctx.lineWidth = 3;
                        ctx.shadowColor = '#ffe66b';
                        ctx.shadowBlur = 9;
                        ctx.globalAlpha = pulse;
                        ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(endX, endY); ctx.stroke();
                        ctx.restore();
                    }

                    // --- 1. Широкое внешнее свечение ---
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(endX, endY);
                    ctx.strokeStyle = laser.colorGlow;
                    ctx.lineWidth = laser.glowWidth * 3;
                    ctx.shadowColor = laser.colorGlow;
                    ctx.shadowBlur = 50;
                    ctx.globalAlpha = 0.2;
                    ctx.stroke();
                    ctx.restore();

                    // --- 2. Среднее свечение ---
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(endX, endY);
                    ctx.strokeStyle = laser.colorOuter;
                    ctx.lineWidth = laser.glowWidth;
                    ctx.shadowColor = laser.colorOuter;
                    ctx.shadowBlur = 35;
                    ctx.globalAlpha = 0.65;
                    ctx.stroke();
                    ctx.restore();

                    // --- 3. Внутренний луч ---
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(endX, endY);
                    ctx.strokeStyle = laser.colorInner;
                    ctx.lineWidth = laser.coreWidth * 1.8;
                    ctx.shadowColor = laser.colorInner;
                    ctx.shadowBlur = 25;
                    ctx.globalAlpha = 0.9;
                    ctx.stroke();
                    ctx.restore();

                    // --- 4. Ядро ---
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(endX, endY);
                    ctx.strokeStyle = laser.colorCore;
                    ctx.lineWidth = laser.coreWidth * 0.8;
                    ctx.shadowColor = laser.colorCore;
                    ctx.shadowBlur = 18;
                    ctx.globalAlpha = 1.0;
                    ctx.stroke();
                    ctx.restore();

                    // --- 5. Параллельные энергетические линии ---
                    if (laser.phase === 2) {
                        const dx = endX - startX;
                        const dy = endY - startY;
                        const len = Math.sqrt(dx * dx + dy * dy);
                        const perpX = -dy / len;
                        const perpY = dx / len;
                        const t = Date.now() * 0.005;
                        
                        ctx.save();
                        ctx.shadowBlur = 15;
                        ctx.shadowColor = laser.colorInner;
                        for (let side = -1; side <= 1; side += 2) {
                            const offsetBase = laser.glowWidth * 0.8 * side;
                            ctx.beginPath();
                            for (let s = 0; s <= 1; s += 0.05) {
                                const px = startX + dx * s + perpX * (offsetBase + Math.sin(t + s * 10) * 3);
                                const py = startY + dy * s + perpY * (offsetBase + Math.sin(t + s * 10) * 3);
                                if (s === 0) ctx.moveTo(px, py);
                                else ctx.lineTo(px, py);
                            }
                            ctx.strokeStyle = laser.colorInner;
                            ctx.lineWidth = 1.5;
                            ctx.globalAlpha = 0.4;
                            ctx.stroke();
                        }
                        ctx.restore();
                    }

                    // --- 6. Молнии/разряды вокруг луча ---
                    if (laser.phase === 2) {
                        const dx = endX - startX;
                        const dy = endY - startY;
                        const len = Math.sqrt(dx * dx + dy * dy);
                        const perpX = -dy / len;
                        const perpY = dx / len;
                        
                        ctx.save();
                        ctx.shadowBlur = 20;
                        ctx.shadowColor = laser.colorOuter;
                        ctx.strokeStyle = laser.colorInner;
                        ctx.lineWidth = 2;
                        
                        const numBolts = 4;
                        for (let b = 0; b < numBolts; b++) {
                            const segStart = Math.random() * 0.8;
                            const segEnd = segStart + 0.15 + Math.random() * 0.1;
                            
                            ctx.beginPath();
                            let first = true;
                            for (let s = segStart; s <= segEnd; s += 0.03) {
                                const px = startX + dx * s;
                                const py = startY + dy * s;
                                const side = (Math.random() - 0.5) * laser.glowWidth * 2.5;
                                const fx = px + perpX * side;
                                const fy = py + perpY * side;
                                if (first) { ctx.moveTo(fx, fy); first = false; }
                                else ctx.lineTo(fx, fy);
                            }
                            ctx.globalAlpha = 0.5 + Math.random() * 0.3;
                            ctx.stroke();
                        }
                        ctx.restore();
                    }
                }
            }

            
function renderFrame() {
 updateLaser();
 ctx.clearRect(0, 0, width, height);
 drawLaser();
}
return {canvas, resize, fire: fireLaser, renderFrame, getState(){return laser;}, clear(){laser.active=false;laser.particles=[];}};
};
window.PonyOriginalCombatEffects = {
 projectiles: createOriginalProjectileEffect(),
 blackHole: createOriginalBlackHoleEffect(),
 laser: createOriginalLaserEffect(),
 createLaserEffect: createOriginalLaserEffect
};
