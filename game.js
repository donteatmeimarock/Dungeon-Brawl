// Dungeon Brawl - Core Arena Combat Engine (Best of 5 PvP)

class GameEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 1200;
    this.height = 800;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.running = false;
    this.lastTime = 0;
    this.animationFrameId = null;

    // Match & Round State
    this.round = 1;
    this.maxRounds = 5;
    this.roundsToWin = 3;
    this.score = { local: 0, remote: 0 };
    this.state = 'LOBBY'; // LOBBY, COUNTDOWN, FIGHTING, ROUND_OVER, MATCH_OVER
    this.stateTimer = 0;
    this.roundWinner = null;
    this.matchWinner = null;

    // Arena Obstacles
    this.obstacles = [
      { x: 300, y: 240, w: 70, h: 70, type: 'pillar' },
      { x: 900, y: 240, w: 70, h: 70, type: 'pillar' },
      { x: 300, y: 560, w: 70, h: 70, type: 'pillar' },
      { x: 900, y: 560, w: 70, h: 70, type: 'pillar' }
    ];

    // Powerup Rune in center
    this.centerRune = {
      x: 600,
      y: 400,
      radius: 24,
      active: true,
      respawnTimer: 0,
      type: 'health' // 'health' or 'speed'
    };

    // Entities
    this.localPlayer = null;
    this.remotePlayer = null;
    this.projectiles = [];
    this.particles = [];
    this.floatingTexts = [];
    this.aoeEffects = [];

    // Horde Mode State
    this.gameMode = 'duel'; // 'duel' or 'horde'
    this.isCoop = false;
    this.zombies = [];
    this.hordeWave = 1;
    this.hordeTotalInWave = 0;
    this.hordeSpawnQueue = 0;
    this.hordeSpawnTimer = 0;
    this.hordeDropSize = 4;
    this.hordeTotalDrops = 3;
    this.hordeCurrentDrop = 0;
    this.hordeNextDropTimer = 0;
    this.hordeDropBannerTimer = 0;
    this.hordeWaveState = 'COUNTDOWN'; // 'COUNTDOWN', 'ACTIVE', 'WAVE_CLEARED', 'GAME_OVER'
    this.hordeWaveTimer = 0;
    this.hordeZombiesKilled = 0;
    this.hordePickups = [];
    this.reviveBeacons = [];

    // Screen Shake
    this.screenShake = 0;

    // Inputs
    this.keys = {};
    this.mouse = { x: 600, y: 400, down: false, rightDown: false };
    this.touchAim = { active: false, x: 0, y: 0 };
    this.touchMove = { active: false, x: 0, y: 0 };

    // Network Sync
    this.netTimer = 0;
    this.netRate = 1 / 30; // 30Hz network sync

    // Event hooks for UI
    this.onHUDUpdate = null;
    this.onRoundEnd = null;
    this.onMatchEnd = null;

    this.bindInputs();
  }

  bindInputs() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      this.keys[key] = true;
      if (['1', '2', '3', '4', '5', 'q', 'e', 'c', 'r', 'f', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        if (this.state === 'FIGHTING' || this.gameMode === 'horde' || key === ' ') {
          e.preventDefault();
        }
      }
    });

    window.addEventListener('wheel', (e) => {
      if (this.running && (this.state === 'FIGHTING' || this.gameMode === 'horde')) {
        e.preventDefault();
      }
    }, { passive: false });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.width / rect.width;
      const scaleY = this.height / rect.height;
      this.mouse.x = (e.clientX - rect.left) * scaleX;
      this.mouse.y = (e.clientY - rect.top) * scaleY;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouse.down = true;
      if (e.button === 2) {
        e.preventDefault();
        this.mouse.rightDown = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rightDown = false;
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  startMatch(localProfile, remoteProfile) {
    this.gameMode = 'duel';
    this.isCoop = false;
    this.round = 1;
    this.score = { local: 0, remote: 0 };
    this.matchWinner = null;
    this.roundWinner = null;

    this.localPlayer = new Fighter(this, 'local', localProfile, 200, 400, 0);
    this.remotePlayer = new Fighter(this, 'remote', remoteProfile, 1000, 400, Math.PI);

    this.projectiles = [];
    this.particles = [];
    this.floatingTexts = [];
    this.aoeEffects = [];
    this.zombies = [];
    this.hordePickups = [];
    this.reviveBeacons = [];
    this.centerRune.active = true;
    this.centerRune.respawnTimer = 0;

    this.startRound(1);

    if (!this.running) {
      this.running = true;
      this.lastTime = performance.now();
      this.loop(this.lastTime);
    }
  }

  startHordeMatch(localProfile, remoteProfile) {
    this.gameMode = 'horde';
    this.isCoop = !!remoteProfile;
    this.matchWinner = null;
    this.roundWinner = null;
    this.hordeWave = 1;
    this.hordeZombiesKilled = 0;
    this.hordePickups = [];
    this.reviveBeacons = [];
    this.zombies = [];
    this.projectiles = [];
    this.particles = [];
    this.floatingTexts = [];
    this.aoeEffects = [];
    this.centerRune.active = true;
    this.centerRune.respawnTimer = 0;

    if (this.isCoop) {
      this.localPlayer = new Fighter(this, 'heroes', localProfile, 520, 400, 0);
      this.remotePlayer = new Fighter(this, 'heroes', remoteProfile, 680, 400, Math.PI);
    } else {
      this.localPlayer = new Fighter(this, 'heroes', localProfile, 600, 400, 0);
      this.remotePlayer = null;
    }

    this.startHordeWave(1);

    if (!this.running) {
      this.running = true;
      this.lastTime = performance.now();
      this.loop(this.lastTime);
    }
  }

  startHordeWave(waveNumber) {
    this.hordeWave = waveNumber;
    this.hordeWaveState = 'COUNTDOWN';
    this.hordeWaveTimer = 3.0; // 3s countdown / wave intro
    this.state = 'FIGHTING';
    this.zombies = [];
    this.projectiles = [];
    this.aoeEffects = [];

    // Exactly 3 equal drops per wave:
    // Solo: Wave 1 = 3 drops of 4 (12 total), Wave 2 = 3 drops of 5 (15), Wave 3 = 3 drops of 6 (18)...
    // Co-op: Wave 1 = 3 drops of 6 (18 total), Wave 2 = 3 drops of 8 (24), Wave 3 = 3 drops of 10 (30)...
    const baseDrop = this.isCoop ? 6 : 4;
    const dropScale = this.isCoop ? 2 : 1;
    this.hordeDropSize = baseDrop + (this.hordeWave - 1) * dropScale;
    this.hordeTotalDrops = 3;
    this.hordeTotalInWave = this.hordeDropSize * 3;
    this.hordeCurrentDrop = 0;
    this.hordeSpawnQueue = this.hordeTotalInWave;
    this.hordeNextDropTimer = 0;
    this.hordeDropBannerTimer = 0;

    soundFX.playRoundStart();
    soundFX.playZombieGroan();

    if (network.isHost && !network.isBot && this.isCoop) {
      network.send({
        type: 'HORDE_WAVE_START',
        wave: this.hordeWave,
        totalInWave: this.hordeTotalInWave,
        dropSize: this.hordeDropSize,
        totalDrops: 3
      });
    }
  }

  triggerHordeDrop(dropNumber) {
    this.hordeCurrentDrop = dropNumber;
    const dropCount = this.hordeDropSize;

    // Spawn equal drop of zombies around perimeter
    for (let i = 0; i < dropCount; i++) {
      this.spawnZombiePerimeter();
    }

    const remainingDrops = Math.max(0, this.hordeTotalDrops - dropNumber);
    this.hordeSpawnQueue = remainingDrops * this.hordeDropSize;

    // 8.5 seconds until next drop
    this.hordeNextDropTimer = 8.5;
    this.hordeDropBannerTimer = 2.0;

    // Sensory alerts
    const label = dropNumber === 3 ? '⚠️ FINAL DROP 3/3! ⚠️' : `⚠️ DROP ${dropNumber}/3! ⚠️`;
    this.addFloatingText(600, 240, label, '#ff1744');
    soundFX.playZombieGroan();
    this.screenShake = 12;

    if (network.isHost && !network.isBot && this.isCoop) {
      network.send({
        type: 'HORDE_DROP_TRIGGERED',
        wave: this.hordeWave,
        drop: dropNumber,
        dropSize: dropCount,
        totalDrops: 3
      });
    }
  }

  startRound(roundNumber) {
    this.round = roundNumber;
    this.roundWinner = null;
    this.state = 'COUNTDOWN';
    this.stateTimer = 3.0; // 3 second countdown

    this.localPlayer.resetForRound(200, 400, 0);
    this.remotePlayer.resetForRound(1000, 400, Math.PI);

    this.projectiles = [];
    this.aoeEffects = [];

    soundFX.playRoundStart();

    if (network.isHost && !network.isBot) {
      network.send({
        type: 'ROUND_START',
        round: this.round,
        score: this.score
      });
    }
  }

  loop(currentTime) {
    if (!this.running) return;

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    this.update(dt);
    this.render();

    this.animationFrameId = requestAnimationFrame((t) => this.loop(t));
  }

  stop() {
    this.running = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  update(dt) {
    // Screen shake decay
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 30);
    }

    // Rune update
    if (!this.centerRune.active) {
      this.centerRune.respawnTimer -= dt;
      if (this.centerRune.respawnTimer <= 0) {
        this.centerRune.active = true;
        this.centerRune.type = Math.random() > 0.5 ? 'health' : 'speed';
        this.createRuneSpawnParticles(this.centerRune.x, this.centerRune.y);
      }
    }

    if (this.gameMode === 'horde') {
      this.updateHorde(dt);
    } else {
      // State machine: COUNTDOWN -> FIGHTING -> ROUND_OVER -> MATCH_OVER
      if (this.state === 'COUNTDOWN') {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = 'FIGHTING';
        }
      } else if (this.state === 'FIGHTING') {
        // Check for round winner
        if (this.localPlayer.hp <= 0 || this.remotePlayer.hp <= 0) {
          this.handleRoundFinish();
        }
      } else if (this.state === 'ROUND_OVER') {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          if (this.score.local >= this.roundsToWin || this.score.remote >= this.roundsToWin) {
            this.handleMatchFinish();
          } else {
            this.startRound(this.round + 1);
          }
        }
      }
    }

    // Update fighters
    if (this.localPlayer) {
      this.handleLocalInput(dt);
      this.localPlayer.update(dt);
    }

    if (this.remotePlayer) {
      if (network.isBot) {
        this.updateBotAI(dt);
      }
      this.remotePlayer.update(dt);
    }

    // Check Rune pickup
    if (this.centerRune.active) {
      [this.localPlayer, this.remotePlayer].forEach(p => {
        if (p && p.hp > 0) {
          const dist = Math.hypot(p.x - this.centerRune.x, p.y - this.centerRune.y);
          if (dist < p.radius + this.centerRune.radius) {
            this.centerRune.active = false;
            this.centerRune.respawnTimer = 22.0; // 22s respawn
            if (this.centerRune.type === 'health') {
              p.heal(200);
              this.addFloatingText(p.x, p.y - 20, '+200 HP RUNE!', '#00e676');
            } else {
              p.speedBuffTimer = 7.0;
              this.addFloatingText(p.x, p.y - 20, '+SPEED RUNE!', '#00e5ff');
            }
            soundFX.playHolyHeal();
          }
        }
      });
    }

    // Update AOE zones
    for (let i = this.aoeEffects.length - 1; i >= 0; i--) {
      const aoe = this.aoeEffects[i];
      aoe.duration -= dt;
      aoe.tickTimer = (aoe.tickTimer || 0) + dt;

      // Pulse damage / effects
      if (aoe.tickTimer >= 0.5) {
        aoe.tickTimer = 0;
        if (this.gameMode === 'horde') {
          for (const zombie of this.zombies) {
            if (zombie.hp <= 0) continue;
            const dist = Math.hypot(zombie.x - aoe.x, zombie.y - aoe.y);
            if (dist <= aoe.radius) {
              if (aoe.type === 'toxic_cloud') {
                zombie.takeDamage(aoe.damagePerTick || 6, 'poison', aoe.owner);
              } else if (aoe.type === 'vortex') {
                const pullAngle = Math.atan2(aoe.y - zombie.y, aoe.x - zombie.x);
                zombie.x += Math.cos(pullAngle) * 55;
                zombie.y += Math.sin(pullAngle) * 55;
                zombie.takeDamage(8, 'magic', aoe.owner);
              }
            }
          }
        } else {
          [this.localPlayer, this.remotePlayer].forEach(target => {
            if (target && target.team !== aoe.ownerTeam && target.hp > 0) {
              const dist = Math.hypot(target.x - aoe.x, target.y - aoe.y);
              if (dist <= aoe.radius) {
                if (aoe.type === 'toxic_cloud') {
                  target.takeDamage(aoe.damagePerTick || 6, 'poison', aoe.owner);
                } else if (aoe.type === 'vortex') {
                  // Pull toward center
                  const pullAngle = Math.atan2(aoe.y - target.y, aoe.x - target.x);
                  target.x += Math.cos(pullAngle) * 45;
                  target.y += Math.sin(pullAngle) * 45;
                  target.takeDamage(8, 'magic', aoe.owner);
                }
              }
            }
          });
        }
      }

      // Delayed meteor strike explosion
      if (aoe.type === 'meteor_strike' && aoe.duration <= 0 && !aoe.exploded) {
        aoe.exploded = true;
        this.screenShake = 16;
        soundFX.playExplosion();
        this.createExplosionParticles(aoe.x, aoe.y, aoe.radius, '#ff3d00');

        if (this.gameMode === 'horde') {
          for (const zombie of this.zombies) {
            if (zombie.hp <= 0) continue;
            const dist = Math.hypot(zombie.x - aoe.x, zombie.y - aoe.y);
            if (dist <= aoe.radius) {
              zombie.takeDamage(aoe.damage || 55, 'meteor', aoe.owner);
            }
          }
        } else {
          [this.localPlayer, this.remotePlayer].forEach(target => {
            if (target && target.team !== aoe.ownerTeam && target.hp > 0) {
              const dist = Math.hypot(target.x - aoe.x, target.y - aoe.y);
              if (dist <= aoe.radius) {
                target.takeDamage(aoe.damage || 55, 'meteor', aoe.owner);
              }
            }
          });
        }
      }

      if (aoe.duration <= 0) {
        this.aoeEffects.splice(i, 1);
      }
    }

    // Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.life -= dt;

      // Obstacle collision
      let hitWall = false;
      if (proj.x < 30 || proj.x > this.width - 30 || proj.y < 30 || proj.y > this.height - 30) {
        hitWall = true;
      } else if (!proj.pierce) {
        for (const obs of this.obstacles) {
          if (
            proj.x > obs.x - obs.w / 2 &&
            proj.x < obs.x + obs.w / 2 &&
            proj.y > obs.y - obs.h / 2 &&
            proj.y < obs.y + obs.h / 2
          ) {
            hitWall = true;
            break;
          }
        }
      }

      if (hitWall) {
        this.createHitSparks(proj.x, proj.y, proj.color);
        if (proj.effect === 'explosive' || proj.isFireball) {
          this.triggerExplosion(proj.x, proj.y, 80, proj.damage, proj.ownerTeam, proj.owner);
        }
        this.projectiles.splice(i, 1);
        continue;
      }

      // Check hit against opponent or zombies
      if (this.gameMode === 'horde') {
        let hitZombie = false;
        for (const zombie of this.zombies) {
          if (zombie.hp <= 0) continue;
          const dist = Math.hypot(zombie.x - proj.x, zombie.y - proj.y);
          if (dist < zombie.radius + proj.size) {
            this.handleProjectileHit(proj, zombie);
            if (!proj.pierce) {
              hitZombie = true;
              break;
            }
          }
        }
        if (hitZombie) {
          this.projectiles.splice(i, 1);
          continue;
        }
      } else {
        const target = proj.ownerTeam === 'local' ? this.remotePlayer : this.localPlayer;
        if (target && target.hp > 0) {
          const dist = Math.hypot(target.x - proj.x, target.y - proj.y);
          if (dist < target.radius + proj.size) {
            // HIT!
            this.handleProjectileHit(proj, target);
            this.projectiles.splice(i, 1);
            continue;
          }
        }
      }

      if (proj.life <= 0) {
        this.projectiles.splice(i, 1);
      }
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= dt * (p.decay || 1.8);
      p.size = Math.max(0, p.size - dt * (p.shrink || 3));
      if (p.alpha <= 0 || p.size <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update Floating text
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= dt * 45;
      ft.alpha -= dt * 1.1;
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // Network Sync Packet
    this.netTimer += dt;
    if (this.netTimer >= this.netRate) {
      this.netTimer = 0;
      this.sendNetworkSync();
    }

    // Notify UI HUD
    if (this.onHUDUpdate) {
      if (this.gameMode === 'horde') {
        const remaining = this.hordeSpawnQueue + this.zombies.length;
        this.onHUDUpdate({
          gameMode: 'horde',
          wave: this.hordeWave,
          waveState: this.hordeWaveState,
          waveTimer: Math.ceil(this.hordeWaveTimer),
          zombiesRemaining: remaining,
          zombiesTotal: this.hordeTotalInWave,
          zombiesKilled: this.hordeZombiesKilled,
          isCoop: this.isCoop,
          drop: this.hordeCurrentDrop || 1,
          totalDrops: 3,
          local: this.localPlayer ? this.localPlayer.getHUDStats() : null,
          remote: this.remotePlayer ? this.remotePlayer.getHUDStats() : null
        });
      } else {
        this.onHUDUpdate({
          gameMode: 'duel',
          state: this.state,
          round: this.round,
          maxRounds: this.maxRounds,
          roundsToWin: this.roundsToWin,
          stateTimer: Math.ceil(this.stateTimer),
          score: this.score,
          local: this.localPlayer ? this.localPlayer.getHUDStats() : null,
          remote: this.remotePlayer ? this.remotePlayer.getHUDStats() : null
        });
      }
    }
  }

  handleLocalInput(dt) {
    if (this.state !== 'FIGHTING' || this.localPlayer.hp <= 0) return;

    let dx = 0;
    let dy = 0;

    if (this.keys['w'] || this.keys['arrowup']) dy -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) dy += 1;
    if (this.keys['a'] || this.keys['arrowleft']) dx -= 1;
    if (this.keys['d'] || this.keys['arrowright']) dx += 1;

    // Mobile touch move joystick override
    if (this.touchMove.active) {
      dx = this.touchMove.x;
      dy = this.touchMove.y;
    }

    this.localPlayer.move(dx, dy, dt);

    // Aim facing angle
    let aimAngle = Math.atan2(this.mouse.y - this.localPlayer.y, this.mouse.x - this.localPlayer.x);
    if (this.touchAim.active) {
      aimAngle = Math.atan2(this.touchAim.y, this.touchAim.x);
    }
    this.localPlayer.angle = aimAngle;

    // 1. Equip Close Range Weapon: '1'
    if (this.keys['1']) {
      this.localPlayer.setWeapon('melee');
      this.keys['1'] = false;
    }

    // 2. Equip Ranged Weapon: '2'
    if (this.keys['2']) {
      this.localPlayer.setWeapon('ranged');
      this.keys['2'] = false;
    }

    // Attack on Click / Mouse Down:
    // Wherever you click shoots a projectile if ranged is equipped, or swings sword if melee is equipped!
    if (this.mouse.down) {
      if (this.localPlayer.activeWeapon === 'ranged') {
        this.localPlayer.attackBow();
      } else {
        this.localPlayer.attackSword();
      }
    }

    // Right Mouse or 'E' as alternate quick action:
    if (this.mouse.rightDown || this.keys['e']) {
      this.localPlayer.attackBow();
    }

    // 3. Spell 1: '3' or 'Q'
    if (this.keys['3'] || this.keys['q']) {
      this.localPlayer.castSpell(0);
      this.keys['3'] = false;
      this.keys['q'] = false;
    }

    // 4. Spell 2: '4' or 'C'
    if (this.keys['4'] || this.keys['c']) {
      this.localPlayer.castSpell(1);
      this.keys['4'] = false;
      this.keys['c'] = false;
    }

    // 5. Spell 3: '5', 'R', or 'F'
    if (this.keys['5'] || this.keys['r'] || this.keys['f']) {
      this.localPlayer.castSpell(2);
      this.keys['5'] = false;
      this.keys['r'] = false;
      this.keys['f'] = false;
    }

    // Mobility: Dash: Space
    if (this.keys[' ']) {
      this.localPlayer.dash();
      this.keys[' '] = false;
    }
  }

  getBotDamageMultiplier(team) {
    if (team !== 'remote' || !network.isBot) return 1.0;
    if (network.botDifficulty === 'nightmare') return 1.15;
    if (network.botDifficulty === 'hard') return 1.0;
    return 0.75; // normal (easy)
  }

  updateBotAI(dt) {
    if (this.state !== 'FIGHTING' || !this.remotePlayer || this.remotePlayer.hp <= 0) return;

    const bot = this.remotePlayer;
    const target = this.localPlayer;
    if (!target || target.hp <= 0) return;

    const difficulty = network.botDifficulty || 'normal';

    // Initialize bot AI state variables if needed
    if (bot.aiBowCooldown === undefined) {
      bot.aiBowCooldown = 1.5;
      bot.aiMeleeCooldown = 0.6;
      bot.aiSpellCooldown = 3.5;
      bot.aiPauseTimer = 2.0;
      bot.aiIsPausing = false;
    }

    const dist = Math.hypot(target.x - bot.x, target.y - bot.y);

    // Aim calculation (predictive on Nightmare)
    let aimTargetX = target.x;
    let aimTargetY = target.y;
    if (difficulty === 'nightmare') {
      const projSpeed = (bot.bow && bot.bow.projSpeed) || 640;
      const leadTime = Math.min(0.45, dist / projSpeed);
      aimTargetX += target.vx * leadTime;
      aimTargetY += target.vy * leadTime;
    }
    const targetAngle = Math.atan2(aimTargetY - bot.y, aimTargetX - bot.x);

    // Turn speed per difficulty
    let turnRate = 4.5;
    if (difficulty === 'hard') turnRate = 9.0;
    if (difficulty === 'nightmare') turnRate = 18.0;

    let angleDiff = targetAngle - bot.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    bot.angle += angleDiff * Math.min(1, dt * turnRate);

    // Dynamic weapon switching (Nightmare)
    if (difficulty === 'nightmare') {
      if (dist < 115 && bot.activeWeapon !== 'melee') {
        bot.setWeapon('melee');
      } else if (dist >= 145 && bot.activeWeapon !== 'ranged') {
        bot.setWeapon('ranged');
      }
    }

    // Hesitation / pause logic
    if (difficulty === 'normal') {
      bot.aiPauseTimer -= dt;
      if (bot.aiPauseTimer <= 0) {
        bot.aiIsPausing = !bot.aiIsPausing;
        bot.aiPauseTimer = bot.aiIsPausing ? (0.6 + Math.random() * 0.4) : (2.2 + Math.random() * 1.0);
      }
    } else if (difficulty === 'hard') {
      bot.aiPauseTimer -= dt;
      if (bot.aiPauseTimer <= 0) {
        bot.aiIsPausing = !bot.aiIsPausing;
        bot.aiPauseTimer = bot.aiIsPausing ? (0.2 + Math.random() * 0.15) : (4.5 + Math.random() * 2.0);
      }
    } else {
      // Nightmare never hesitates
      bot.aiIsPausing = false;
    }

    // Projectile Avoidance & Evasion
    let evadeX = 0;
    let evadeY = 0;
    let inDanger = false;
    let closestTimeToHit = Infinity;

    const dodgeChance = difficulty === 'nightmare' ? 0.90 : difficulty === 'hard' ? 0.65 : 0;

    if (dodgeChance > 0 && this.projectiles && this.projectiles.length > 0) {
      for (const proj of this.projectiles) {
        if (proj.ownerTeam === bot.team) continue;

        const pdx = bot.x - proj.x;
        const pdy = bot.y - proj.y;
        const pdist = Math.hypot(pdx, pdy);
        if (pdist > 380 || pdist < 15) continue;

        const pspeed = Math.hypot(proj.vx, proj.vy);
        if (pspeed < 30) continue;

        const pux = proj.vx / pspeed;
        const puy = proj.vy / pspeed;

        // Is projectile traveling towards bot?
        const dot = pdx * pux + pdy * puy;
        if (dot <= 0) continue; // Moving away

        // Perpendicular offset from trajectory to bot center
        const perpX = pdx - dot * pux;
        const perpY = pdy - dot * puy;
        const perpDistSq = perpX * perpX + perpY * perpY;
        const dangerRadius = bot.radius + (proj.size || 6) + 32;

        if (perpDistSq <= dangerRadius * dangerRadius) {
          const timeToHit = dot / pspeed;
          if (timeToHit < 0.70 && timeToHit < closestTimeToHit) {
            if (proj.botDodgeRoll === undefined) {
              proj.botDodgeRoll = Math.random() < dodgeChance;
            }

            if (proj.botDodgeRoll) {
              closestTimeToHit = timeToHit;
              inDanger = true;

              // Compute unit vector pointing away from trajectory
              let dirX = 0;
              let dirY = 0;
              const perpDist = Math.sqrt(perpDistSq);
              if (perpDist > 0.5) {
                dirX = perpX / perpDist;
                dirY = perpY / perpDist;
              } else {
                // Dead center hit: pick perpendicular normal
                dirX = -puy;
                dirY = pux;
              }

              // Check if dodging in this direction hits a wall; if so, flip
              if (bot.checkWallCollision(bot.x + dirX * 35, bot.y + dirY * 35)) {
                dirX = -dirX;
                dirY = -dirY;
              }

              evadeX += dirX * 1.5;
              evadeY += dirY * 1.5;

              // Dash evasion for imminent hit
              const dashProb = difficulty === 'nightmare' ? 0.70 : 0.35;
              if (timeToHit < 0.32 && bot.dashCooldown <= 0 && Math.random() < dashProb) {
                bot.dash(Math.atan2(dirY, dirX));
              }
            }
          }
        }
      }
    }

    // AoE zone avoidance (Hard & Nightmare)
    if (dodgeChance > 0 && this.aoeEffects && this.aoeEffects.length > 0) {
      for (const aoe of this.aoeEffects) {
        if (aoe.ownerTeam === bot.team) continue;
        const adx = bot.x - aoe.x;
        const ady = bot.y - aoe.y;
        const adist = Math.hypot(adx, ady);
        if (adist < aoe.radius + 25) {
          inDanger = true;
          if (adist > 0.5) {
            evadeX += (adx / adist) * 1.3;
            evadeY += (ady / adist) * 1.3;
          } else {
            evadeX += 1.3;
          }
        }
      }
    }

    let moveX = 0;
    let moveY = 0;

    if (inDanger) {
      bot.aiIsPausing = false;
      const evadeLen = Math.hypot(evadeX, evadeY);
      if (evadeLen > 0) {
        moveX = evadeX / evadeLen;
        moveY = evadeY / evadeLen;
      }
    } else if (!bot.aiIsPausing) {
      if (difficulty === 'nightmare') {
        // Nightmare tactical positioning: maintains optimal weapon distance
        if (dist > 280) {
          moveX = Math.cos(targetAngle);
          moveY = Math.sin(targetAngle);
        } else if (dist < 90) {
          // Back up slightly or flank
          moveX = -Math.cos(targetAngle) * 0.7 + -Math.sin(targetAngle) * 0.7;
          moveY = -Math.sin(targetAngle) * 0.7 + Math.cos(targetAngle) * 0.7;
        } else {
          // Aggressive strafe circling
          const strafeSign = (Math.floor(Date.now() / 1500) % 2 === 0) ? 1 : -1;
          moveX = -Math.sin(targetAngle) * strafeSign + Math.cos(targetAngle) * 0.2;
          moveY = Math.cos(targetAngle) * strafeSign + Math.sin(targetAngle) * 0.2;
        }
      } else if (difficulty === 'hard') {
        if (dist > 300) {
          moveX = Math.cos(targetAngle);
          moveY = Math.sin(targetAngle);
        } else if (dist < 110) {
          moveX = Math.cos(targetAngle + Math.PI * 0.5) * 0.8;
          moveY = Math.sin(targetAngle + Math.PI * 0.5) * 0.8;
        } else {
          moveX = -Math.sin(targetAngle) * 0.85;
          moveY = Math.cos(targetAngle) * 0.85;
        }
      } else {
        // Normal (relaxed)
        if (dist > 320) {
          moveX = Math.cos(targetAngle);
          moveY = Math.sin(targetAngle);
        } else if (dist < 120) {
          moveX = Math.cos(targetAngle + Math.PI * 0.5) * 0.6;
          moveY = Math.sin(targetAngle + Math.PI * 0.5) * 0.6;
        } else {
          moveX = -Math.sin(targetAngle) * 0.7;
          moveY = Math.cos(targetAngle) * 0.7;
        }
      }
    }

    bot.aiIsEvading = inDanger;
    bot.move(moveX, moveY, dt);

    // 1. Melee attack: only when close
    bot.aiMeleeCooldown -= dt;
    const meleeThreshold = (bot.sword && bot.sword.range) ? (bot.sword.range + 10) : 85;
    if (dist <= meleeThreshold) {
      if (bot.aiMeleeCooldown <= 0) {
        bot.attackSword();
        if (difficulty === 'nightmare') {
          bot.aiMeleeCooldown = 0.35 + Math.random() * 0.15;
        } else if (difficulty === 'hard') {
          bot.aiMeleeCooldown = 0.60 + Math.random() * 0.25;
        } else {
          bot.aiMeleeCooldown = 1.10 + Math.random() * 0.40;
        }
      }
    }

    // 2. Bow attack: ranged
    bot.aiBowCooldown -= dt;
    if (dist > 110 && dist < 650 && bot.aiBowCooldown <= 0) {
      let aimJitter = 0;
      if (difficulty === 'normal') {
        aimJitter = (Math.random() - 0.5) * 0.28;
      } else if (difficulty === 'hard') {
        aimJitter = (Math.random() - 0.5) * 0.08;
      }

      const prevAngle = bot.angle;
      bot.angle += aimJitter;
      bot.attackBow();
      bot.angle = prevAngle;

      if (difficulty === 'nightmare') {
        bot.aiBowCooldown = 0.85 + Math.random() * 0.30;
      } else if (difficulty === 'hard') {
        bot.aiBowCooldown = 1.35 + Math.random() * 0.45;
      } else {
        bot.aiBowCooldown = 2.40 + Math.random() * 0.80;
      }
    }

    // 3. Spells
    bot.aiSpellCooldown -= dt;
    if (bot.aiSpellCooldown <= 0) {
      let spellToCast = -1;
      // If low HP, prioritize healing
      if (bot.hp < bot.maxHp * 0.55) {
        const healIdx = bot.spells.findIndex((s, idx) => s && s.castType === 'self_heal' && bot.spellCooldowns[idx] <= 0);
        if (healIdx !== -1) spellToCast = healIdx;
      }
      if (spellToCast === -1 && dist < 480) {
        spellToCast = bot.spellCooldowns.findIndex(cd => cd <= 0);
      }
      if (spellToCast !== -1) {
        let tx = target.x;
        let ty = target.y;
        if (difficulty === 'nightmare') {
          tx += target.vx * 0.35;
          ty += target.vy * 0.35;
        }
        bot.castSpell(spellToCast, tx, ty);
        if (difficulty === 'nightmare') {
          bot.aiSpellCooldown = 2.5 + Math.random() * 0.8;
        } else if (difficulty === 'hard') {
          bot.aiSpellCooldown = 4.0 + Math.random() * 1.5;
        } else {
          bot.aiSpellCooldown = 6.5 + Math.random() * 2.5;
        }
      }
    }

    // 4. Panic / close dash if Normal
    if (difficulty === 'normal' && dist < 90 && Math.random() < 0.005) {
      bot.dash();
    }
  }

  handleProjectileHit(proj, target) {
    if (target.invulnerable || target.hp <= 0) return;

    soundFX.playArrowHit();
    this.createHitSparks(proj.x, proj.y, proj.color);

    let damage = proj.damage;
    if (proj.ownerTeam === 'remote' && network.isBot) {
      damage = Math.round(damage * this.getBotDamageMultiplier('remote'));
    }

    // Apply projectile damage
    target.takeDamage(damage, 'arrow', proj.owner);

    // Bow hit special effects
    if (proj.effect === 'poison') {
      target.applyPoison(4, 3, proj.owner); // 4 ticks of 3 dmg
    } else if (proj.effect === 'storm_hit') {
      this.strikeLightning(target.x, target.y, 12, proj.ownerTeam, proj.owner);
    } else if (proj.effect === 'explosive' || proj.isFireball) {
      this.triggerExplosion(proj.x, proj.y, 80, proj.damage, proj.ownerTeam, proj.owner);
    }
  }

  triggerExplosion(x, y, radius, damage, ownerTeam, owner) {
    this.screenShake = 12;
    soundFX.playExplosion();
    this.createExplosionParticles(x, y, radius, '#ff5722');

    let finalDamage = damage;
    if (ownerTeam === 'remote' && network.isBot) {
      finalDamage = Math.round(finalDamage * this.getBotDamageMultiplier(ownerTeam));
    }

    if (this.gameMode === 'horde') {
      for (const zombie of this.zombies) {
        if (zombie.hp <= 0) continue;
        const dist = Math.hypot(zombie.x - x, zombie.y - y);
        if (dist <= radius) {
          zombie.takeDamage(finalDamage, 'explosion', owner);
        }
      }
    } else {
      [this.localPlayer, this.remotePlayer].forEach(target => {
        if (target && target.team !== ownerTeam && target.hp > 0) {
          const dist = Math.hypot(target.x - x, target.y - y);
          if (dist <= radius) {
            target.takeDamage(finalDamage, 'explosion', owner);
          }
        }
      });
    }
  }

  strikeLightning(x, y, damage, ownerTeam, owner) {
    soundFX.playLightning();
    this.screenShake = 10;
    this.createLightningVFX(x, y);

    let finalDamage = damage;
    if (ownerTeam === 'remote' && network.isBot) {
      finalDamage = Math.round(finalDamage * this.getBotDamageMultiplier(ownerTeam));
    }

    if (this.gameMode === 'horde') {
      for (const zombie of this.zombies) {
        if (zombie.hp <= 0) continue;
        const dist = Math.hypot(zombie.x - x, zombie.y - y);
        if (dist <= 75) {
          zombie.takeDamage(finalDamage, 'lightning', owner);
          zombie.chillTimer = 0.5; // brief stun/slow
        }
      }
    } else {
      [this.localPlayer, this.remotePlayer].forEach(target => {
        if (target && target.team !== ownerTeam && target.hp > 0) {
          const dist = Math.hypot(target.x - x, target.y - y);
          if (dist <= 65) {
            target.takeDamage(finalDamage, 'lightning', owner);
            target.chillTimer = 0.5; // brief stun/slow
          }
        }
      });
    }
  }

  handleRoundFinish() {
    if (this.state !== 'FIGHTING') return;

    this.state = 'ROUND_OVER';
    this.stateTimer = 3.5;
    this.screenShake = 20;

    if (this.localPlayer.hp > 0) {
      this.roundWinner = 'local';
      this.score.local++;
      soundFX.playRoundWin();
    } else {
      this.roundWinner = 'remote';
      this.score.remote++;
      soundFX.playMatchDefeat();
    }

    if (this.onRoundEnd) {
      this.onRoundEnd({
        winner: this.roundWinner,
        round: this.round,
        score: this.score
      });
    }

    if (network.isHost && !network.isBot) {
      network.send({
        type: 'ROUND_OVER',
        winner: this.roundWinner,
        score: this.score
      });
    }
  }

  handleMatchFinish() {
    if (this.state === 'MATCH_OVER') return;
    this.state = 'MATCH_OVER';
    const isLocalWin = this.score.local >= this.roundsToWin;
    this.matchWinner = isLocalWin ? 'local' : 'remote';

    // Award Coins
    let coinsWon = 35; // Consolation on defeat
    if (isLocalWin) {
      if (network.isBot) {
        if (network.botDifficulty === 'nightmare') {
          coinsWon = 300;
        } else if (network.botDifficulty === 'hard') {
          coinsWon = 200;
        } else {
          coinsWon = 120;
        }
      } else {
        coinsWon = 120; // Standard PvP duel win
      }
    }
    playerStorage.addCoins(coinsWon);
    const matchRecord = playerStorage.recordMatch(isLocalWin, this.score.local);
    const dailyBonusEarned = matchRecord ? matchRecord.dailyBonusEarned : 0;

    if (isLocalWin) {
      soundFX.playMatchVictory();
    } else {
      soundFX.playMatchDefeat();
    }

    if (this.onMatchEnd) {
      this.onMatchEnd({
        winner: this.matchWinner,
        score: this.score,
        coinsEarned: coinsWon,
        dailyBonusEarned,
        dailyWins: matchRecord ? matchRecord.dailyWins : playerStorage.getDailyWinStatus(),
        isLocalWin
      });
    }

    if (network.isHost && !network.isBot) {
      network.send({
        type: 'MATCH_OVER',
        winner: this.matchWinner,
        score: this.score
      });
    }
  }

  sendNetworkSync() {
    if (network.isBot || !network.isConnected()) return;

    if (this.gameMode === 'horde' && this.isCoop) {
      if (network.isHost) {
        const syncZombies = this.zombies.slice(0, 35).map(z => ({
          id: z.id,
          x: Math.round(z.x),
          y: Math.round(z.y),
          hp: z.hp,
          maxHp: z.maxHp,
          angle: Number(z.angle.toFixed(2)),
          claw: z.clawAnimation > 0
        }));
        network.send({
          type: 'HORDE_SYNC',
          wave: this.hordeWave,
          waveState: this.hordeWaveState,
          waveTimer: Math.ceil(this.hordeWaveTimer),
          drop: this.hordeCurrentDrop || 1,
          totalDrops: 3,
          zombiesRemaining: this.hordeSpawnQueue + this.zombies.length,
          zombiesKilled: this.hordeZombiesKilled,
          zombies: syncZombies,
          reviveBeacons: this.reviveBeacons.map(b => ({
            targetRole: b.targetRole,
            x: Math.round(b.x),
            y: Math.round(b.y),
            progress: Number(b.progress.toFixed(2))
          })),
          localHp: this.localPlayer ? this.localPlayer.hp : 0,
          localShield: this.localPlayer ? this.localPlayer.shield : 0,
          localX: this.localPlayer ? Math.round(this.localPlayer.x) : 600,
          localY: this.localPlayer ? Math.round(this.localPlayer.y) : 400,
          localAngle: this.localPlayer ? Number(this.localPlayer.angle.toFixed(2)) : 0,
          activeWeapon: this.localPlayer ? (this.localPlayer.activeWeapon || 'melee') : 'melee'
        });
      } else {
        network.send({
          type: 'HORDE_GUEST_SYNC',
          x: this.localPlayer ? Math.round(this.localPlayer.x) : 600,
          y: this.localPlayer ? Math.round(this.localPlayer.y) : 400,
          angle: this.localPlayer ? Number(this.localPlayer.angle.toFixed(2)) : 0,
          hp: this.localPlayer ? this.localPlayer.hp : 0,
          shield: this.localPlayer ? this.localPlayer.shield : 0,
          activeWeapon: this.localPlayer ? (this.localPlayer.activeWeapon || 'melee') : 'melee'
        });
      }
      return;
    }

    // Send local fighter position and state (Duel)
    if (this.localPlayer) {
      network.send({
        type: 'STATE_SYNC',
        x: Math.round(this.localPlayer.x),
        y: Math.round(this.localPlayer.y),
        angle: Number(this.localPlayer.angle.toFixed(2)),
        hp: this.localPlayer.hp,
        shield: this.localPlayer.shield,
        state: this.state,
        round: this.round,
        activeWeapon: this.localPlayer.activeWeapon || 'melee'
      });
    }
  }

  handleNetworkPacket(packet) {
    if (!packet) return;

    if (packet.type === 'HORDE_SYNC') {
      this.hordeWave = packet.wave;
      this.hordeWaveState = packet.waveState;
      this.hordeWaveTimer = packet.waveTimer;
      if (packet.drop !== undefined) this.hordeCurrentDrop = packet.drop;
      if (!network.isHost && packet.zombiesKilled !== undefined) {
        while (this.hordeZombiesKilled < packet.zombiesKilled) {
          this.hordeZombiesKilled++;
          if (this.hordeZombiesKilled % 2 === 0) {
            playerStorage.addCoins(1);
            const coinEl = document.getElementById('header-coin-count');
            if (coinEl) coinEl.textContent = playerStorage.getCoins();
            soundFX.playCoinPickup();
          }
        }
      }
      if (this.remotePlayer) {
        this.remotePlayer.targetX = packet.localX;
        this.remotePlayer.targetY = packet.localY;
        this.remotePlayer.angle = packet.localAngle;
        this.remotePlayer.hp = packet.localHp;
        this.remotePlayer.shield = packet.localShield;
        if (packet.activeWeapon) this.remotePlayer.activeWeapon = packet.activeWeapon;
      }
      if (!network.isHost && packet.zombies) {
        const packetIds = new Set(packet.zombies.map(pz => pz.id));
        this.zombies = this.zombies.filter(z => packetIds.has(z.id));
        for (const pz of packet.zombies) {
          let existing = this.zombies.find(z => z.id === pz.id);
          if (!existing) {
            existing = new Zombie(this, pz.x, pz.y, this.hordeWave, pz.id);
            existing.targetX = pz.x;
            existing.targetY = pz.y;
            this.zombies.push(existing);
          } else {
            existing.targetX = pz.x;
            existing.targetY = pz.y;
          }
          existing.x += (pz.x - existing.x) * 0.45;
          existing.y += (pz.y - existing.y) * 0.45;
          existing.hp = pz.hp;
          existing.maxHp = pz.maxHp;
          existing.angle = pz.angle;
          if (pz.claw) existing.clawAnimation = 1.0;
        }
      }
      if (!network.isHost && packet.reviveBeacons) {
        const beaconRoles = new Set(packet.reviveBeacons.map(pb => pb.targetRole));
        this.reviveBeacons = this.reviveBeacons.filter(b => beaconRoles.has(b.targetRole));
        for (const pb of packet.reviveBeacons) {
          let existing = this.reviveBeacons.find(b => b.targetRole === pb.targetRole);
          if (!existing) {
            existing = {
              targetRole: pb.targetRole,
              x: pb.x,
              y: pb.y,
              progress: pb.progress,
              requiredTime: 2.0,
              radius: 46
            };
            this.reviveBeacons.push(existing);
          } else {
            if (existing.targetRole !== 'host') {
              existing.progress = pb.progress;
            }
          }
        }
      }
    } else if (packet.type === 'HORDE_REVIVE_DONE') {
      this.executeHeroRevive(packet.targetRole, packet.x, packet.y, true);
    } else if (packet.type === 'HORDE_GUEST_SYNC') {
      if (this.remotePlayer) {
        this.remotePlayer.targetX = packet.x;
        this.remotePlayer.targetY = packet.y;
        this.remotePlayer.angle = packet.angle;
        this.remotePlayer.hp = packet.hp;
        this.remotePlayer.shield = packet.shield;
        if (packet.activeWeapon) this.remotePlayer.activeWeapon = packet.activeWeapon;
      }
    } else if (packet.type === 'HORDE_DROP_TRIGGERED') {
      this.hordeCurrentDrop = packet.drop;
      this.hordeDropBannerTimer = 2.0;
      const label = packet.drop === 3 ? '⚠️ FINAL DROP 3/3! ⚠️' : `⚠️ DROP ${packet.drop}/3! ⚠️`;
      this.addFloatingText(600, 240, label, '#ff1744');
      soundFX.playZombieGroan();
      this.screenShake = 12;
    } else if (packet.type === 'HORDE_WAVE_START') {
      this.hordeWave = packet.wave;
      this.hordeTotalInWave = packet.totalInWave;
      this.hordeDropSize = packet.dropSize || Math.round(packet.totalInWave / 3);
      this.hordeTotalDrops = 3;
      this.hordeCurrentDrop = 0;
      this.hordeWaveState = 'COUNTDOWN';
      this.hordeWaveTimer = 3.0;
      this.zombies = [];
      soundFX.playRoundStart();
      soundFX.playZombieGroan();
    } else if (packet.type === 'HORDE_GAME_OVER') {
      this.handleHordeGameOver();
    } else if (packet.type === 'STATE_SYNC') {
      if (this.remotePlayer) {
        this.remotePlayer.targetX = packet.x;
        this.remotePlayer.targetY = packet.y;
        this.remotePlayer.angle = packet.angle;
        this.remotePlayer.hp = packet.hp;
        this.remotePlayer.shield = packet.shield;
        if (packet.activeWeapon) this.remotePlayer.activeWeapon = packet.activeWeapon;
      }
    } else if (packet.type === 'ACTION_SWORD') {
      if (this.remotePlayer) {
        this.remotePlayer.triggerSwordVFX();
      }
    } else if (packet.type === 'ACTION_BOW') {
      if (this.remotePlayer) {
        this.remotePlayer.triggerBowVFX(packet.angle);
      }
    } else if (packet.type === 'ACTION_SPELL') {
      if (this.remotePlayer) {
        this.remotePlayer.executeSpell(packet.spellId, packet.targetX, packet.targetY);
      }
    } else if (packet.type === 'ACTION_DASH') {
      if (this.remotePlayer) {
        this.remotePlayer.triggerDashVFX();
      }
    } else if (packet.type === 'ROUND_START') {
      this.score = packet.score;
      this.startRound(packet.round);
    } else if (packet.type === 'ROUND_OVER') {
      this.score = packet.score;
      this.roundWinner = packet.winner;
      this.state = 'ROUND_OVER';
      this.stateTimer = 3.5;
    } else if (packet.type === 'MATCH_OVER') {
      this.score = packet.score;
      this.handleMatchFinish();
    }
  }

  addFloatingText(x, y, text, color = '#ffffff') {
    this.floatingTexts.push({
      x,
      y,
      text,
      color,
      alpha: 1.0
    });
  }

  createHitSparks(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 120;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2.5 + Math.random() * 2,
        color: color || '#ffeb3b',
        alpha: 1.0,
        decay: 3.5
      });
    }
  }

  createExplosionParticles(x, y, radius, color) {
    for (let i = 0; i < 28; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius * 0.8;
      const speed = 40 + Math.random() * 150;
      this.particles.push({
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 5 + Math.random() * 7,
        color: color,
        alpha: 1.0,
        decay: 2.0
      });
    }
  }

  createRuneSpawnParticles(x, y) {
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * 50,
        vy: Math.sin(angle) * 50,
        size: 4,
        color: '#00e5ff',
        alpha: 1.0,
        decay: 1.5
      });
    }
  }

  createLightningVFX(x, y) {
    for (let i = 0; i < 20; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 160,
        vy: (Math.random() - 0.5) * 160,
        size: 3,
        color: '#ffd600',
        alpha: 1.0,
        decay: 4.0
      });
    }
  }

  // ================= CANVAS RENDERING =================
  render() {
    this.ctx.save();

    // Apply screen shake
    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      this.ctx.translate(sx, sy);
    }

    // Clear background
    this.ctx.fillStyle = '#0f111a';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Draw Arena Floor Tiles
    this.renderArenaFloor();

    // Draw Obstacles (Pillars)
    this.renderObstacles();

    // Draw Center Rune
    this.renderCenterRune();

    // Draw AOE Spell Zones
    this.renderAOEEffects();

    // Draw Projectiles
    this.renderProjectiles();

    // Draw Pickups (Horde mode)
    if (this.gameMode === 'horde') {
      this.renderHordePickups();
    }

    // Draw Revive Beacons (Horde Co-op mode)
    if (this.gameMode === 'horde') {
      this.renderReviveBeacons();
    }

    // Draw Zombies (Horde mode)
    if (this.gameMode === 'horde') {
      this.renderZombies();
    }

    // Draw Fighters
    if (this.remotePlayer) this.remotePlayer.render(this.ctx);
    if (this.localPlayer) this.localPlayer.render(this.ctx);

    // Draw Particles
    this.renderParticles();

    // Draw Floating Damage / Heal Numbers
    this.renderFloatingText();

    // Draw Arena Banners (Round intro / KO text / Wave banners)
    if (this.gameMode === 'horde') {
      this.renderHordeBanners();
    } else {
      this.renderRoundBanners();
    }

    this.ctx.restore();
  }

  renderArenaFloor() {
    // Subtle stone flagstones & colosseum ring
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    this.ctx.lineWidth = 1;

    const tileSize = 60;
    for (let x = 30; x < this.width - 30; x += tileSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 30);
      this.ctx.lineTo(x, this.height - 30);
      this.ctx.stroke();
    }
    for (let y = 30; y < this.height - 30; y += tileSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(30, y);
      this.ctx.lineTo(this.width - 30, y);
      this.ctx.stroke();
    }

    // Outer boundary wall
    this.ctx.strokeStyle = '#37474f';
    this.ctx.lineWidth = 6;
    this.ctx.strokeRect(30, 30, this.width - 60, this.height - 60);

    // Center arena battle ring
    this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.12)';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(600, 400, 180, 0, Math.PI * 2);
    this.ctx.stroke();

    // Torches in 4 corners
    const torches = [
      { x: 50, y: 50 },
      { x: this.width - 50, y: 50 },
      { x: 50, y: this.height - 50 },
      { x: this.width - 50, y: this.height - 50 }
    ];
    torches.forEach(t => {
      const grad = this.ctx.createRadialGradient(t.x, t.y, 5, t.x, t.y, 45);
      grad.addColorStop(0, 'rgba(255, 140, 0, 0.45)');
      grad.addColorStop(1, 'rgba(255, 87, 34, 0)');
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(t.x, t.y, 45, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = '#ff9800';
      this.ctx.beginPath();
      this.ctx.arc(t.x, t.y, 6, 0, Math.PI * 2);
      this.ctx.fill();
    });

    this.ctx.restore();
  }

  renderObstacles() {
    this.ctx.save();
    this.obstacles.forEach(obs => {
      // Shadow
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      this.ctx.fillRect(obs.x - obs.w / 2 + 5, obs.y - obs.h / 2 + 8, obs.w, obs.h);

      // Pillar Body
      this.ctx.fillStyle = '#263238';
      this.ctx.fillRect(obs.x - obs.w / 2, obs.y - obs.h / 2, obs.w, obs.h);

      // Pillar Border / Carvings
      this.ctx.strokeStyle = '#455a64';
      this.ctx.lineWidth = 3;
      this.ctx.strokeRect(obs.x - obs.w / 2, obs.y - obs.h / 2, obs.w, obs.h);

      this.ctx.fillStyle = '#37474f';
      this.ctx.fillRect(obs.x - obs.w / 4, obs.y - obs.h / 4, obs.w / 2, obs.h / 2);
    });
    this.ctx.restore();
  }

  renderCenterRune() {
    if (!this.centerRune.active) return;

    this.ctx.save();
    const r = this.centerRune;
    const pulse = Math.sin(performance.now() * 0.005) * 4;
    const color = r.type === 'health' ? '#00e676' : '#00e5ff';

    // Ambient glow
    const grad = this.ctx.createRadialGradient(r.x, r.y, 5, r.x, r.y, r.radius + 15 + pulse);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'transparent');
    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.arc(r.x, r.y, r.radius + 15 + pulse, 0, Math.PI * 2);
    this.ctx.fill();

    // Crystal Rune
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '20px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(r.type === 'health' ? '❤️' : '⚡', r.x, r.y);

    this.ctx.restore();
  }

  renderAOEEffects() {
    this.ctx.save();
    this.aoeEffects.forEach(aoe => {
      this.ctx.beginPath();
      this.ctx.arc(aoe.x, aoe.y, aoe.radius, 0, Math.PI * 2);

      if (aoe.type === 'meteor_strike') {
        // Red warning circle contracting
        this.ctx.strokeStyle = '#ff1744';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
        this.ctx.fillStyle = 'rgba(255, 23, 68, 0.2)';
        this.ctx.fill();
      } else if (aoe.type === 'toxic_cloud') {
        this.ctx.fillStyle = 'rgba(0, 230, 118, 0.25)';
        this.ctx.fill();
        this.ctx.strokeStyle = '#00e676';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
      } else if (aoe.type === 'vortex') {
        this.ctx.fillStyle = 'rgba(101, 31, 255, 0.28)';
        this.ctx.fill();
        this.ctx.strokeStyle = '#b388ff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
      }
    });
    this.ctx.restore();
  }

  renderProjectiles() {
    this.ctx.save();
    this.projectiles.forEach(proj => {
      this.ctx.save();
      this.ctx.translate(proj.x, proj.y);
      this.ctx.rotate(proj.angle);

      if (proj.isFireball) {
        // Glowing fireball
        this.ctx.fillStyle = '#ff9100';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, proj.size + 2, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#ff3d00';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, proj.size, 0, Math.PI * 2);
        this.ctx.fill();
      } else {
        // Arrow shape
        this.ctx.strokeStyle = proj.color || '#fff';
        this.ctx.lineWidth = 2.5;
        this.ctx.beginPath();
        this.ctx.moveTo(-12, 0);
        this.ctx.lineTo(8, 0);
        this.ctx.stroke();

        // Arrowhead
        this.ctx.fillStyle = proj.color || '#fff';
        this.ctx.beginPath();
        this.ctx.moveTo(8, -4);
        this.ctx.lineTo(13, 0);
        this.ctx.lineTo(8, 4);
        this.ctx.closePath();
        this.ctx.fill();
      }
      this.ctx.restore();
    });
    this.ctx.restore();
  }

  renderParticles() {
    this.ctx.save();
    this.particles.forEach(p => {
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    });
    this.ctx.restore();
  }

  renderFloatingText() {
    this.ctx.save();
    this.floatingTexts.forEach(ft => {
      this.ctx.globalAlpha = ft.alpha;
      this.ctx.font = 'bold 20px "Segoe UI", sans-serif';
      this.ctx.fillStyle = ft.color;
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 3;
      this.ctx.textAlign = 'center';
      this.ctx.strokeText(ft.text, ft.x, ft.y);
      this.ctx.fillText(ft.text, ft.x, ft.y);
    });
    this.ctx.restore();
  }

  renderRoundBanners() {
    this.ctx.save();
    if (this.state === 'COUNTDOWN') {
      const countdownSec = Math.ceil(this.stateTimer);
      const text = countdownSec > 0 ? `${countdownSec}` : 'FIGHT!';

      this.ctx.font = 'bold 64px "Segoe UI", sans-serif';
      this.ctx.fillStyle = '#ffd700';
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 6;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.strokeText(`ROUND ${this.round}`, 600, 340);
      this.ctx.fillText(`ROUND ${this.round}`, 600, 340);

      this.ctx.font = 'bold 84px "Segoe UI", sans-serif';
      this.ctx.fillStyle = '#ff1744';
      this.ctx.strokeText(text, 600, 430);
      this.ctx.fillText(text, 600, 430);
    } else if (this.state === 'ROUND_OVER') {
      const isWinnerLocal = this.roundWinner === 'local';
      const text = isWinnerLocal ? 'ROUND VICTORY!' : 'ROUND LOST!';
      const color = isWinnerLocal ? '#76ff03' : '#ff1744';

      this.ctx.font = 'bold 60px "Segoe UI", sans-serif';
      this.ctx.fillStyle = color;
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 6;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.strokeText(text, 600, 380);
      this.ctx.fillText(text, 600, 380);
    }
    this.ctx.restore();
  }

  updateHorde(dt) {
    const isAuthority = !this.isCoop || network.isHost;

    if (isAuthority) {
      if (this.hordeWaveState === 'COUNTDOWN') {
        this.hordeWaveTimer -= dt;
        if (this.hordeWaveTimer <= 0) {
          this.hordeWaveState = 'ACTIVE';
          // Trigger Drop 1 of 3 immediately upon wave activation
          this.triggerHordeDrop(1);
        }
      } else if (this.hordeWaveState === 'ACTIVE') {
        // Trigger subsequent drops (Drop 2 and Drop 3 of 3)
        if (this.hordeCurrentDrop < this.hordeTotalDrops) {
          this.hordeNextDropTimer -= dt;

          // If current drop is completely cleared, quickly trigger next drop
          if (this.zombies.length === 0 && this.hordeNextDropTimer > 1.5) {
            this.hordeNextDropTimer = 1.5;
          }

          if (this.hordeNextDropTimer <= 0) {
            this.triggerHordeDrop(this.hordeCurrentDrop + 1);
          }
        }

        // Check wave clear (all 3 drops deployed AND all zombies eliminated)
        if (this.hordeCurrentDrop >= this.hordeTotalDrops && this.zombies.length === 0) {
          this.hordeWaveState = 'WAVE_CLEARED';
          this.hordeWaveTimer = 3.5;
          soundFX.playWaveClear();

          const waveClearBonus = 30;
          playerStorage.addCoins(waveClearBonus);
          this.addFloatingText(600, 320, `+${waveClearBonus} WAVE CLEARED BONUS!`, '#ffd700');
        }

      } else if (this.hordeWaveState === 'WAVE_CLEARED') {
        this.hordeWaveTimer -= dt;
        if (this.hordeWaveTimer <= 0) {
          this.startHordeWave(this.hordeWave + 1);
        }
      }
    }

    if (this.hordeDropBannerTimer > 0) {
      this.hordeDropBannerTimer -= dt;
    }

    // Check game over (all players dead) across all wave states
    const localDead = !this.localPlayer || this.localPlayer.hp <= 0;
    const remoteDead = !this.remotePlayer || this.remotePlayer.hp <= 0;
    if (localDead && remoteDead && this.hordeWaveState !== 'GAME_OVER') {
      this.hordeWaveState = 'GAME_OVER';
      this.handleHordeGameOver();
      return;
    }

    // Check fallen heroes & create/maintain revive beacons in Co-op
    if (this.isCoop) {
      if (this.localPlayer && this.localPlayer.hp <= 0) {
        const myRole = network.isHost ? 'host' : 'guest';
        let b = this.reviveBeacons.find(beacon => beacon.targetRole === myRole);
        if (!b) {
          b = {
            targetRole: myRole,
            x: Math.round(this.localPlayer.x),
            y: Math.round(this.localPlayer.y),
            progress: 0,
            requiredTime: 2.0,
            radius: 46
          };
          this.reviveBeacons.push(b);
          this.addFloatingText(this.localPlayer.x, this.localPlayer.y - 30, 'HERO DOWN! ALLY CAN REVIVE YOU', '#ffd700');
        } else {
          this.localPlayer.x = b.x;
          this.localPlayer.y = b.y;
          this.localPlayer.vx = 0;
          this.localPlayer.vy = 0;
        }
      }

      if (this.remotePlayer && this.remotePlayer.hp <= 0) {
        const allyRole = network.isHost ? 'guest' : 'host';
        let b = this.reviveBeacons.find(beacon => beacon.targetRole === allyRole);
        if (!b) {
          b = {
            targetRole: allyRole,
            x: Math.round(this.remotePlayer.x),
            y: Math.round(this.remotePlayer.y),
            progress: 0,
            requiredTime: 2.0,
            radius: 46
          };
          this.reviveBeacons.push(b);
          this.addFloatingText(this.remotePlayer.x, this.remotePlayer.y - 30, 'ALLY DOWN! STAND ON REVIVE BEACON', '#ffd700');
        } else {
          this.remotePlayer.x = b.x;
          this.remotePlayer.y = b.y;
          this.remotePlayer.vx = 0;
          this.remotePlayer.vy = 0;
        }
      }

      // Update Revive Beacons (standing for 2 seconds to revive at 50% HP)
      this.updateReviveBeacons(dt);
    }

    // Update Zombies (Authority updates AI/movement; guest interpolates positions)
    if (isAuthority) {
      for (let i = this.zombies.length - 1; i >= 0; i--) {
        const z = this.zombies[i];
        z.update(dt);
        if (z.hp <= 0) {
          this.zombies.splice(i, 1);
        }
      }
    } else {
      for (const z of this.zombies) {
        if (z.targetX !== undefined) {
          z.x += (z.targetX - z.x) * 0.45;
          z.y += (z.targetY - z.y) * 0.45;
        }
        if (z.clawAnimation > 0) z.clawAnimation = Math.max(0, z.clawAnimation - dt * 4.0);
      }
    }

    // Update Pickups
    this.updateHordePickups(dt);
  }

  updateReviveBeacons(dt) {
    if (!this.isCoop || this.reviveBeacons.length === 0) return;

    for (let i = this.reviveBeacons.length - 1; i >= 0; i--) {
      const beacon = this.reviveBeacons[i];

      const isLocalTarget = network.isHost 
        ? (beacon.targetRole === 'host') 
        : (beacon.targetRole === 'guest');

      const targetPlayer = isLocalTarget ? this.localPlayer : this.remotePlayer;
      const rescuerPlayer = isLocalTarget ? this.remotePlayer : this.localPlayer;

      if (!targetPlayer || targetPlayer.hp > 0) {
        this.reviveBeacons.splice(i, 1);
        continue;
      }

      if (!rescuerPlayer || rescuerPlayer.hp <= 0) {
        continue;
      }

      // Lock target position to revive spot
      targetPlayer.x = beacon.x;
      targetPlayer.y = beacon.y;
      targetPlayer.vx = 0;
      targetPlayer.vy = 0;

      // Distance from rescuer to the revive beacon
      const dist = Math.hypot(rescuerPlayer.x - beacon.x, rescuerPlayer.y - beacon.y);
      if (dist <= beacon.radius) {
        // Rescuer is standing in the yellow light!
        beacon.progress += dt;

        // Visual golden sparks rising from revive spot
        if (Math.random() < 0.4) {
          this.particles.push({
            x: beacon.x + (Math.random() - 0.5) * (beacon.radius * 0.8),
            y: beacon.y + (Math.random() - 0.5) * (beacon.radius * 0.8),
            vx: (Math.random() - 0.5) * 20,
            vy: -50 - Math.random() * 40,
            size: 3 + Math.random() * 3,
            color: '#ffd700',
            alpha: 0.9,
            decay: 2.2
          });
        }

        // Check if 2 seconds reached
        if (beacon.progress >= beacon.requiredTime) {
          this.executeHeroRevive(beacon.targetRole, beacon.x, beacon.y);
        }
      } else {
        // Leaving the circle causes progress to decay back to 0
        beacon.progress = Math.max(0, beacon.progress - dt * 1.5);
      }
    }
  }

  executeHeroRevive(targetRole, x, y, isFromNetwork = false) {
    const isLocalTarget = network.isHost 
      ? (targetRole === 'host') 
      : (targetRole === 'guest');

    const targetPlayer = isLocalTarget ? this.localPlayer : this.remotePlayer;
    if (!targetPlayer) return;

    targetPlayer.hp = Math.round(targetPlayer.maxHp * 0.5);
    targetPlayer.x = x;
    targetPlayer.y = y;
    targetPlayer.vx = 0;
    targetPlayer.vy = 0;
    targetPlayer.invulnerableTimer = 2.0;
    targetPlayer.invulnerable = true;

    soundFX.playHolyHeal();
    this.createExplosionParticles(x, y, 60, '#ffd700');
    this.createExplosionParticles(x, y, 40, '#00e676');
    this.addFloatingText(x, y - 35, '✨ REVIVED AT 50% HP! ✨', '#00e676');

    this.reviveBeacons = this.reviveBeacons.filter(b => b.targetRole !== targetRole);

    if (!isFromNetwork && network.isConnected() && !network.isBot) {
      network.send({
        type: 'HORDE_REVIVE_DONE',
        targetRole,
        x,
        y
      });
    }
  }

  spawnZombiePerimeter() {
    const edge = Math.floor(Math.random() * 4);
    let x = 600;
    let y = 400;
    const margin = 52;
    if (edge === 0) {
      x = 60 + Math.random() * (this.width - 120);
      y = margin;
    } else if (edge === 1) {
      x = this.width - margin;
      y = 60 + Math.random() * (this.height - 120);
    } else if (edge === 2) {
      x = 60 + Math.random() * (this.width - 120);
      y = this.height - margin;
    } else {
      x = margin;
      y = 60 + Math.random() * (this.height - 120);
    }

    const zombie = new Zombie(this, x, y, this.hordeWave);
    this.zombies.push(zombie);
    this.createExplosionParticles(x, y, 16, '#2e7d32');
  }

  updateHordePickups(dt) {
    const players = [this.localPlayer, this.remotePlayer].filter(p => p && p.hp > 0);
    for (let i = this.hordePickups.length - 1; i >= 0; i--) {
      const p = this.hordePickups[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.hordePickups.splice(i, 1);
        continue;
      }

      for (const player of players) {
        const dist = Math.hypot(player.x - p.x, player.y - p.y);
        if (dist <= player.radius + p.radius) {
          if (p.type === 'health') {
            player.heal(p.value || 50);
            soundFX.playHolyHeal();
          } else if (p.type === 'coin') {
            playerStorage.addCoins(p.value || 2);
            this.addFloatingText(p.x, p.y - 15, `+${p.value || 2} COINS`, '#ffd700');
            soundFX.playCoinPickup();
          }
          this.hordePickups.splice(i, 1);
          break;
        }
      }
    }
  }

  handleHordeGameOver() {
    if (this.state === 'MATCH_OVER') return;
    this.state = 'MATCH_OVER';
    this.screenShake = 22;
    soundFX.playMatchDefeat();

    const wavesSurvived = Math.max(0, this.hordeWave - 1);
    const killCoins = Math.floor(this.hordeZombiesKilled / 2);
    const matchBonus = 20 + wavesSurvived * 30;
    // Add match bonus (kill coins were awarded in real-time during fighting)
    playerStorage.addCoins(matchBonus);

    const totalCoinsEarned = matchBonus + killCoins;

    const dailyWinEligible = this.hordeWave >= 3;
    const matchRecord = playerStorage.recordMatch(dailyWinEligible, wavesSurvived);
    const dailyBonusEarned = matchRecord ? matchRecord.dailyBonusEarned : 0;

    if (this.onMatchEnd) {
      this.onMatchEnd({
        gameMode: 'horde',
        wave: this.hordeWave,
        wavesSurvived,
        zombiesKilled: this.hordeZombiesKilled,
        coinsEarned: totalCoinsEarned,
        dailyBonusEarned,
        dailyWins: matchRecord ? matchRecord.dailyWins : playerStorage.getDailyWinStatus(),
        isLocalWin: wavesSurvived >= 3
      });
    }

    if (network.isHost && !network.isBot && this.isCoop) {
      network.send({
        type: 'HORDE_GAME_OVER',
        wave: this.hordeWave,
        wavesSurvived,
        zombiesKilled: this.hordeZombiesKilled
      });
    }
  }

  renderHordePickups() {
    this.ctx.save();
    const t = performance.now() * 0.005;
    this.hordePickups.forEach(p => {
      const bob = Math.sin(t + p.x) * 3;
      this.ctx.save();
      this.ctx.translate(p.x, p.y + bob);

      const color = p.type === 'health' ? '#00e676' : '#ffd700';
      this.ctx.shadowColor = color;
      this.ctx.shadowBlur = 8;

      this.ctx.font = '16px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(p.type === 'health' ? '🧪' : '🪙', 0, 0);

      this.ctx.restore();
    });
    this.ctx.restore();
  }

  renderReviveBeacons() {
    if (!this.isCoop || this.reviveBeacons.length === 0) return;

    this.ctx.save();
    const now = performance.now();

    for (const b of this.reviveBeacons) {
      const pulse = Math.sin(now * 0.006) * 5;

      // 1. Radiant Yellow Light on ground (glowing radial gradient)
      const grad = this.ctx.createRadialGradient(b.x, b.y, 4, b.x, b.y, b.radius + 12 + pulse);
      grad.addColorStop(0, 'rgba(255, 235, 59, 0.7)');
      grad.addColorStop(0.35, 'rgba(255, 215, 0, 0.38)');
      grad.addColorStop(0.75, 'rgba(255, 193, 7, 0.15)');
      grad.addColorStop(1, 'rgba(255, 193, 7, 0)');
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(b.x, b.y, b.radius + 12 + pulse, 0, Math.PI * 2);
      this.ctx.fill();

      // 2. Vertical yellow light column / beacon beam reaching upward
      const beamGrad = this.ctx.createLinearGradient(b.x, b.y + 10, b.x, b.y - 85);
      beamGrad.addColorStop(0, 'rgba(255, 235, 59, 0.35)');
      beamGrad.addColorStop(0.6, 'rgba(255, 215, 0, 0.15)');
      beamGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');
      this.ctx.fillStyle = beamGrad;
      this.ctx.fillRect(b.x - 20, b.y - 85, 40, 95);

      // 3. Ground energy ring
      this.ctx.strokeStyle = '#ffd700';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      this.ctx.stroke();

      // 4. Progress ring filling as hero stays there for 2s
      if (b.progress > 0) {
        const pct = Math.min(1.0, b.progress / b.requiredTime);
        this.ctx.strokeStyle = '#00e676';
        this.ctx.lineWidth = 6;
        this.ctx.beginPath();
        this.ctx.arc(b.x, b.y, b.radius + 4, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
        this.ctx.stroke();
      }

      // 5. The words "REVIVE" on top of the yellow light
      const textBob = Math.sin(now * 0.005) * 4;
      this.ctx.font = 'bold 18px "Segoe UI", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'bottom';
      this.ctx.fillStyle = '#ffd700';
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 4;

      const label = b.progress > 0 
        ? `REVIVING (${Math.round((b.progress / b.requiredTime) * 100)}%)` 
        : '💛 REVIVE 💛';

      const labelY = b.y - b.radius - 12 + textBob;
      this.ctx.strokeText(label, b.x, labelY);
      this.ctx.fillText(label, b.x, labelY);

      // Subtitle helper: "Stay for 2s"
      this.ctx.font = 'bold 11px "Segoe UI", sans-serif';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 3;
      const sub = b.progress > 0 ? `${(b.requiredTime - b.progress).toFixed(1)}s remaining` : 'Stay for 2s to revive';
      this.ctx.strokeText(sub, b.x, labelY + 14);
      this.ctx.fillText(sub, b.x, labelY + 14);
    }

    this.ctx.restore();
  }

  renderZombies() {
    for (const zombie of this.zombies) {
      zombie.render(this.ctx);
    }
  }

  renderHordeBanners() {
    this.ctx.save();
    if (this.hordeWaveState === 'COUNTDOWN') {
      const sec = Math.ceil(this.hordeWaveTimer);
      this.ctx.font = 'bold 56px "Segoe UI", sans-serif';
      this.ctx.fillStyle = '#66bb6a';
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 6;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.strokeText(`WAVE ${this.hordeWave}`, 600, 340);
      this.ctx.fillText(`WAVE ${this.hordeWave}`, 600, 340);

      this.ctx.font = 'bold 72px "Segoe UI", sans-serif';
      this.ctx.fillStyle = '#ff1744';
      this.ctx.strokeText(`${sec > 0 ? sec : 'INCOMING!'}`, 600, 420);
      this.ctx.fillText(`${sec > 0 ? sec : 'INCOMING!'}`, 600, 420);
    } else if (this.hordeWaveState === 'ACTIVE' && this.hordeDropBannerTimer > 0) {
      const alpha = Math.min(1.0, this.hordeDropBannerTimer / 0.4);
      this.ctx.globalAlpha = alpha;
      this.ctx.font = 'bold 44px "Segoe UI", sans-serif';
      this.ctx.fillStyle = '#ff1744';
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 6;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      const text = this.hordeCurrentDrop === 3 ? '⚠️ FINAL DROP 3/3! ⚠️' : `⚠️ DROP ${this.hordeCurrentDrop}/3! ⚠️`;
      this.ctx.strokeText(text, 600, 240);
      this.ctx.fillText(text, 600, 240);
    } else if (this.hordeWaveState === 'WAVE_CLEARED') {
      const sec = Math.ceil(this.hordeWaveTimer);
      this.ctx.font = 'bold 52px "Segoe UI", sans-serif';
      this.ctx.fillStyle = '#ffd700';
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 6;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.strokeText(`WAVE ${this.hordeWave} CLEARED!`, 600, 350);
      this.ctx.fillText(`WAVE ${this.hordeWave} CLEARED!`, 600, 350);

      this.ctx.font = 'bold 32px "Segoe UI", sans-serif';
      this.ctx.fillStyle = '#00e5ff';
      this.ctx.strokeText(`Next Wave in ${sec}s...`, 600, 415);
      this.ctx.fillText(`Next Wave in ${sec}s...`, 600, 415);
    }
    this.ctx.restore();
  }
}

// ================= ZOMBIE ENTITY (HORDE MODE) =================
class Zombie {
  constructor(game, x, y, wave, id) {
    this.game = game;
    this.id = id || Math.random().toString(36).substr(2, 9);
    this.x = x;
    this.y = y;
    this.wave = wave || 1;
    this.radius = 18;

    // Scaling per wave:
    this.maxHp = 50 + (this.wave - 1) * 12;
    this.hp = this.maxHp;

    // Base speed: 158 (just barely faster than player normal speed 150)
    this.baseSpeed = 158 + (this.wave - 1) * 1.5;
    this.speed = this.baseSpeed;

    // Damage: Exactly 20 damage base!
    this.damage = 20 + (this.wave - 1) * 2;

    this.clawCooldown = 0;
    this.clawMaxCooldown = 0.85;
    this.clawRange = 36;
    this.clawAnimation = 0;

    this.angle = 0;
    this.chillTimer = 0;
    this.burnTicks = 0;
    this.burnTimer = 0;
    this.poisonTicks = 0;
    this.poisonTimer = 0;

    this.wobble = Math.random() * Math.PI * 2;
    this.targetX = x;
    this.targetY = y;
  }

  update(dt) {
    if (this.hp <= 0) return;

    if (this.chillTimer > 0) this.chillTimer -= dt;
    if (this.clawCooldown > 0) this.clawCooldown -= dt;
    if (this.clawAnimation > 0) this.clawAnimation = Math.max(0, this.clawAnimation - dt * 4.0);

    // Burn damage over time
    if (this.burnTicks > 0) {
      this.burnTimer += dt;
      if (this.burnTimer >= 0.75) {
        this.burnTimer = 0;
        this.burnTicks--;
        this.takeDamage(5, 'burn', null);
      }
    }

    // Poison damage over time
    if (this.poisonTicks > 0) {
      this.poisonTimer += dt;
      if (this.poisonTimer >= 0.8) {
        this.poisonTimer = 0;
        this.poisonTicks--;
        this.takeDamage(3, 'poison', null);
      }
    }

    // No strategy: find nearest live player!
    const targets = [];
    if (this.game.localPlayer && this.game.localPlayer.hp > 0) targets.push(this.game.localPlayer);
    if (this.game.remotePlayer && this.game.remotePlayer.hp > 0) targets.push(this.game.remotePlayer);

    if (targets.length === 0) return;

    let nearestTarget = null;
    let minDist = Infinity;
    for (const t of targets) {
      const d = Math.hypot(t.x - this.x, t.y - this.y);
      if (d < minDist) {
        minDist = d;
        nearestTarget = t;
      }
    }

    if (!nearestTarget) return;

    // Face target
    this.angle = Math.atan2(nearestTarget.y - this.y, nearestTarget.x - this.x);

    // Compute speed (slowed if chilled)
    let curSpeed = this.speed;
    if (this.chillTimer > 0) curSpeed *= 0.55;

    // Shambling gait
    this.wobble += dt * 5.0;
    const wobbleOffset = Math.sin(this.wobble) * 0.12;
    const moveAngle = this.angle + wobbleOffset;

    // Movement bounds inside arena walls
    const minX = 30 + this.radius;
    const maxX = this.game.width - 30 - this.radius;
    const minY = 30 + this.radius;
    const maxY = this.game.height - 30 - this.radius;

    let nextX = this.x + Math.cos(moveAngle) * curSpeed * dt;
    let nextY = this.y + Math.sin(moveAngle) * curSpeed * dt;

    // Clamp inside playable arena so zombies never get stuck on borders
    nextX = Math.max(minX, Math.min(maxX, nextX));
    nextY = Math.max(minY, Math.min(maxY, nextY));

    // Obstacle (pillar) collision check
    const hitX = this.checkObstacleCollision(nextX, this.y);
    const hitY = this.checkObstacleCollision(this.x, nextY);

    if (!hitX) {
      this.x = nextX;
    }
    if (!hitY) {
      this.y = nextY;
    }

    // Slide around pillars if moving directly head-on into a pillar
    if (hitX && hitY) {
      const slideAngle = this.angle + (Math.sin(this.wobble) > 0 ? Math.PI / 2 : -Math.PI / 2);
      const slideX = Math.max(minX, Math.min(maxX, this.x + Math.cos(slideAngle) * curSpeed * dt));
      const slideY = Math.max(minY, Math.min(maxY, this.y + Math.sin(slideAngle) * curSpeed * dt));
      if (!this.checkObstacleCollision(slideX, this.y)) this.x = slideX;
      if (!this.checkObstacleCollision(this.x, slideY)) this.y = slideY;
    }

    // Extremely close range claw attack
    const attackDist = this.radius + nearestTarget.radius + 8;
    if (minDist <= attackDist && this.clawCooldown <= 0) {
      this.clawAttack(nearestTarget);
    }
  }

  clawAttack(target) {
    this.clawCooldown = this.clawMaxCooldown;
    this.clawAnimation = 1.0;
    soundFX.playZombieClaw();

    // Deal 20 base damage (scaled slightly by wave)
    target.takeDamage(this.damage, 'claw', this);
    this.game.createHitSparks(target.x, target.y, '#e53935');
  }

  checkObstacleCollision(x, y) {
    for (const obs of this.game.obstacles) {
      const halfW = obs.w / 2 + this.radius;
      const halfH = obs.h / 2 + this.radius;
      if (Math.abs(x - obs.x) < halfW && Math.abs(y - obs.y) < halfH) {
        return true;
      }
    }
    return false;
  }

  checkWallCollision(x, y) {
    const minX = 30 + this.radius;
    const maxX = this.game.width - 30 - this.radius;
    const minY = 30 + this.radius;
    const maxY = this.game.height - 30 - this.radius;
    if (x < minX || x > maxX || y < minY || y > maxY) return true;
    return this.checkObstacleCollision(x, y);
  }

  takeDamage(amount, type, attacker) {
    if (this.hp <= 0) return;
    this.hp = Math.max(0, this.hp - amount);

    const color = type === 'poison' ? '#76ff03' : type === 'burn' ? '#ff5722' : '#ffeb3b';
    this.game.addFloatingText(this.x, this.y - 15, `-${amount}`, color);
    this.game.createHitSparks(this.x, this.y, '#66bb6a');

    // Bloodstone Eye amulet lifesteal
    if (attacker && attacker.amulet && attacker.amulet.buffType === 'lifesteal') {
      const rate = attacker.amulet.value || 0.06;
      attacker.heal(Math.round(amount * rate));
    }

    if (this.hp <= 0) {
      this.die();
    }
  }

  applyPoison(ticks) {
    this.poisonTicks = ticks;
  }

  die() {
    this.game.hordeZombiesKilled++;
    this.game.createExplosionParticles(this.x, this.y, 24, '#2e7d32');
    soundFX.playSwordHit();

    // Reward: 1 coin after killing every other zombie (killing 2 zombies gives 1 coin)
    if (this.game.hordeZombiesKilled % 2 === 0) {
      playerStorage.addCoins(1);
      const coinEl = document.getElementById('header-coin-count');
      if (coinEl) coinEl.textContent = playerStorage.getCoins();
      this.game.addFloatingText(this.x, this.y - 20, '+1 COIN 🪙', '#ffd700');
      soundFX.playCoinPickup();
    }

    // Chance to drop mini health pickup
    const roll = Math.random();
    if (roll < 0.18) {
      this.game.hordePickups.push({
        x: this.x,
        y: this.y,
        type: 'health',
        value: 50,
        radius: 12,
        life: 15
      });
    }
  }

  render(ctx) {
    if (this.hp <= 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 12, this.radius * 0.85, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Face angle
    ctx.rotate(this.angle);

    // Zombie Body (rotted dark flesh)
    ctx.fillStyle = '#2e7d32';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Tattered tunic
    ctx.fillStyle = '#37474f';
    ctx.beginPath();
    ctx.arc(-2, 0, this.radius * 0.75, -Math.PI * 0.6, Math.PI * 0.6);
    ctx.fill();

    // Rot outline
    ctx.strokeStyle = '#1b5e20';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Head
    ctx.fillStyle = '#4caf50';
    ctx.beginPath();
    ctx.arc(4, 0, 9, 0, Math.PI * 2);
    ctx.fill();

    // Glowing Red Eyes
    ctx.fillStyle = '#ff1744';
    ctx.beginPath();
    ctx.arc(8, -3, 2, 0, Math.PI * 2);
    ctx.arc(8, 3, 2, 0, Math.PI * 2);
    ctx.fill();

    // Arms and claws outstretched
    const swipeOffset = this.clawAnimation > 0 ? (1 - this.clawAnimation) * 0.6 : 0;

    // Left claw arm
    ctx.save();
    ctx.translate(10, -10 + swipeOffset * 4);
    ctx.fillStyle = '#388e3c';
    ctx.fillRect(0, -2, 14, 4);
    ctx.fillStyle = '#b71c1c';
    ctx.fillRect(12, -3, 4, 6);
    ctx.restore();

    // Right claw arm
    ctx.save();
    ctx.translate(10, 10 - swipeOffset * 4);
    ctx.fillStyle = '#388e3c';
    ctx.fillRect(0, -2, 14, 4);
    ctx.fillStyle = '#b71c1c';
    ctx.fillRect(12, -3, 4, 6);
    ctx.restore();

    // Claw slash trail VFX
    if (this.clawAnimation > 0) {
      ctx.strokeStyle = 'rgba(239, 83, 80, 0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(14, 0, 22, -0.6, 0.6);
      ctx.stroke();
    }

    ctx.restore();

    // Mini overhead health bar
    if (this.hp < this.maxHp) {
      const barW = 32;
      const barH = 4;
      const barX = this.x - barW / 2;
      const barY = this.y - this.radius - 8;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

      const ratio = Math.max(0, this.hp / this.maxHp);
      ctx.fillStyle = ratio > 0.5 ? '#76ff03' : '#ff1744';
      ctx.fillRect(barX, barY, barW * ratio, barH);
    }
  }
}

// ================= FIGHTER ENTITY =================
class Fighter {
  constructor(game, team, profile, x, y, angle) {
    this.game = game;
    this.team = team; // 'local' or 'remote'
    this.profile = profile || {};
    this.name = profile.name || (team === 'local' ? 'Player 1' : 'Player 2');

    // Parse loadout items
    const equipped = profile.equipped || {};
    this.sword = getItem(equipped.sword) || getItem('sword_rusty');
    this.bow = getItem(equipped.bow) || getItem('bow_short');
    this.armor = getItem(equipped.armor) || getItem('armor_leather');
    this.amulet = getItem(equipped.amulet) || getItem('amulet_copper');
    this.spells = (equipped.spells || []).map(id => getItem(id)).filter(Boolean);

    // Derived stats
    this.baseHp = 1000 + (this.armor.hpBonus || 0);
    this.maxHp = this.baseHp;
    this.hp = this.maxHp;
    this.shield = 0;
    this.maxShield = 250;

    // Speeds (slower, more tactical pace)
    this.baseSpeed = 150 * (this.armor.speedMod || 1.0);
    if (this.amulet.buffType === 'speed_dash') {
      this.baseSpeed *= 1.15;
    }
    this.speed = this.baseSpeed;
    this.speedBuffTimer = 0;

    // Position & physics
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = 24;
    this.angle = angle || 0;

    // Cooldown timers
    this.swordCooldown = 0;
    this.bowCooldown = 0;
    this.dashCooldown = 0;
    this.dashMaxCooldown = this.amulet.buffType === 'speed_dash' ? 1.6 : 2.5;
    this.dashTimer = 0;
    this.invulnerable = false;
    this.invulnerableTimer = 0;

    // Spells cooldown array
    this.spellCooldowns = [0, 0, 0];

    // Status effects
    this.burnTicks = 0;
    this.burnTimer = 0;
    this.poisonTicks = 0;
    this.poisonTimer = 0;
    this.chillTimer = 0;
    this.regenTimer = 0;
    this.barrierTimer = 0;
    this.phoenixRevived = false;

    // Visual animation states
    this.swingProgress = 0; // 0 to 1 during sword swing
    this.drawBowProgress = 0;

    // Equipped weapon state: 'melee' (close range) or 'ranged' (bow)
    this.activeWeapon = 'melee';
  }

  setWeapon(type) {
    if (type !== 'melee' && type !== 'ranged') return;
    if (this.activeWeapon !== type) {
      this.activeWeapon = type;
      if (this.game && this.team === 'local') {
        const text = type === 'ranged' ? '🏹 Ranged Equipped' : '🗡️ Close Range Equipped';
        const color = type === 'ranged' ? '#00e5ff' : '#ff9800';
        this.game.addFloatingText(this.x, this.y - 30, text, color);
      }
    }
  }

  resetForRound(x, y, angle) {
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = angle;

    this.activeWeapon = 'melee';
    this.hp = this.maxHp;
    this.shield = 0;
    this.swordCooldown = 0;
    this.bowCooldown = 0;
    this.dashCooldown = 0;
    this.dashTimer = 0;
    this.invulnerable = false;
    this.invulnerableTimer = 0;
    this.spellCooldowns = [0, 0, 0];

    this.burnTicks = 0;
    this.poisonTicks = 0;
    this.chillTimer = 0;
    this.speedBuffTimer = 0;
    this.regenTimer = 0;
    this.barrierTimer = 0;
    this.phoenixRevived = false;
    this.swingProgress = 0;
    this.aiBowCooldown = undefined;
    this.aiMeleeCooldown = undefined;
    this.aiSpellCooldown = undefined;
    this.aiPauseTimer = undefined;
    this.aiIsPausing = undefined;
  }

  move(dx, dy, dt) {
    if (this.dashTimer > 0) return; // Locked in dash

    let currentSpeed = this.speed;
    if (this.chillTimer > 0) currentSpeed *= 0.65;
    if (this.speedBuffTimer > 0) currentSpeed *= 1.35;

    // Amulet Berserker speed bonus
    if (this.amulet.buffType === 'berserk' && this.hp < this.maxHp * 0.45) {
      currentSpeed *= 1.25;
    }

    // Bot difficulty speed scaling
    if (this.team === 'remote' && network.isBot) {
      const diff = network.botDifficulty || 'normal';
      if (diff === 'nightmare') {
        currentSpeed *= this.aiIsEvading ? 1.35 : 1.15;
      } else if (diff === 'hard') {
        currentSpeed *= this.aiIsEvading ? 1.20 : 1.0;
      } else {
        currentSpeed *= 0.80; // normal (easy)
      }
    }

    if (dx !== 0 && dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
    }

    const nextX = this.x + dx * currentSpeed * dt;
    const nextY = this.y + dy * currentSpeed * dt;

    if (!this.checkWallCollision(nextX, this.y)) {
      this.x = nextX;
    }
    if (!this.checkWallCollision(this.x, nextY)) {
      this.y = nextY;
    }
  }

  checkWallCollision(x, y) {
    if (x - this.radius < 30 || x + this.radius > this.game.width - 30) return true;
    if (y - this.radius < 30 || y + this.radius > this.game.height - 30) return true;

    for (const obs of this.game.obstacles) {
      const halfW = obs.w / 2 + this.radius;
      const halfH = obs.h / 2 + this.radius;
      if (Math.abs(x - obs.x) < halfW && Math.abs(y - obs.y) < halfH) {
        return true;
      }
    }
    return false;
  }

  update(dt) {
    // Cooldown countdowns
    if (this.swordCooldown > 0) this.swordCooldown -= dt;
    if (this.bowCooldown > 0) this.bowCooldown -= dt;
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    for (let i = 0; i < this.spellCooldowns.length; i++) {
      if (this.spellCooldowns[i] > 0) this.spellCooldowns[i] -= dt;
    }

    // Dash motion
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      const dashSpeed = 650;
      const nextX = this.x + Math.cos(this.dashAngle) * dashSpeed * dt;
      const nextY = this.y + Math.sin(this.dashAngle) * dashSpeed * dt;
      if (!this.checkWallCollision(nextX, nextY)) {
        this.x = nextX;
        this.y = nextY;
      }
      if (this.dashTimer <= 0 && this.invulnerableTimer <= 0) {
        this.invulnerable = false;
      }
    }

    // Invulnerability timer (e.g. post-revive immunity)
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
      this.invulnerable = true;
      if (this.invulnerableTimer <= 0 && this.dashTimer <= 0) {
        this.invulnerable = false;
      }
    }

    // Remote player interpolation
    if (this.team === 'remote' && !network.isBot) {
      this.x += (this.targetX - this.x) * 0.35;
      this.y += (this.targetY - this.y) * 0.35;
    }

    // Animation progress
    if (this.swingProgress > 0) {
      this.swingProgress = Math.max(0, this.swingProgress - dt * 4.5);
    }

    // Status effect timers
    if (this.chillTimer > 0) this.chillTimer -= dt;
    if (this.speedBuffTimer > 0) this.speedBuffTimer -= dt;

    // Burn damage over time
    if (this.burnTicks > 0) {
      this.burnTimer += dt;
      if (this.burnTimer >= 0.75) {
        this.burnTimer = 0;
        this.burnTicks--;
        this.takeDamage(5, 'burn', null);
      }
    }

    // Poison damage over time
    if (this.poisonTicks > 0) {
      this.poisonTimer += dt;
      if (this.poisonTimer >= 0.8) {
        this.poisonTimer = 0;
        this.poisonTicks--;
        this.takeDamage(3, 'poison', null);
      }
    }

    // Amulet Passive Regen
    if (this.amulet.buffType === 'regen' && this.hp < this.maxHp) {
      this.regenTimer += dt;
      if (this.regenTimer >= 3.0) {
        this.regenTimer = 0;
        this.heal(3);
      }
    }

    // Titan Obsidian Barrier Armor Passive
    if (this.armor.passive === 'barrier' && this.shield < 150) {
      this.barrierTimer += dt;
      if (this.barrierTimer >= 10.0) {
        this.barrierTimer = 0;
        this.shield = Math.min(150, this.shield + 75);
        this.game.addFloatingText(this.x, this.y - 25, '+150 BARRIER SHIELD', '#00b0ff');
      }
    }
  }

  attackSword() {
    if (this.swordCooldown > 0 || this.hp <= 0) return;

    let cd = this.sword.speed;
    if (this.amulet.buffType === 'berserk' && this.hp < this.maxHp * 0.45) {
      cd *= 0.75;
    }
    this.swordCooldown = cd;
    this.swingProgress = 1.0;

    soundFX.playSwordSwing(this.sword.effect);

    if (this.team === 'local' && network.isConnected() && !network.isBot) {
      network.send({ type: 'ACTION_SWORD' });
    }

    // Hit detection against opponent or zombies
    if (this.game.gameMode === 'horde') {
      let hitAny = false;
      for (const zombie of this.game.zombies) {
        if (zombie.hp <= 0) continue;
        const dist = Math.hypot(zombie.x - this.x, zombie.y - this.y);
        if (dist <= this.sword.range + zombie.radius) {
          const angleToZ = Math.atan2(zombie.y - this.y, zombie.x - this.x);
          let diff = Math.abs(angleToZ - this.angle);
          while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);

          if (diff <= this.sword.arc / 2) {
            hitAny = true;
            let dmg = this.sword.damage;
            if (this.amulet.buffType === 'berserk' && this.hp < this.maxHp * 0.45) {
              dmg = Math.round(dmg * 1.25);
            }
            zombie.takeDamage(dmg, 'sword', this);

            if (this.sword.effect === 'burn') {
              zombie.burnTicks = 4;
            } else if (this.sword.effect === 'lightning') {
              this.game.strikeLightning(zombie.x, zombie.y, 8, this.team, this);
            } else if (this.sword.effect === 'chill') {
              zombie.chillTimer = 2.0;
              this.game.addFloatingText(zombie.x, zombie.y - 20, 'SLOWED!', '#80d8ff');
            } else if (this.sword.effect === 'lifesteal') {
              this.heal(Math.round(dmg * 0.2));
            } else if (this.sword.effect === 'holy_burst') {
              this.game.createExplosionParticles(zombie.x, zombie.y, 45, '#ffd700');
              zombie.takeDamage(12, 'holy', this);
            }
          }
        }
      }
      if (hitAny) {
        soundFX.playSwordHit();
      }
    } else {
      const opponent = this.team === 'local' ? this.game.remotePlayer : this.game.localPlayer;
      if (opponent && opponent.hp > 0) {
        const dist = Math.hypot(opponent.x - this.x, opponent.y - this.y);
        if (dist <= this.sword.range + opponent.radius) {
          // Check angle inside swing arc
          const angleToOpponent = Math.atan2(opponent.y - this.y, opponent.x - this.x);
          let diff = Math.abs(angleToOpponent - this.angle);
          while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);

          if (diff <= this.sword.arc / 2) {
            // MELEE HIT!
            let dmg = this.sword.damage;
            if (this.amulet.buffType === 'berserk' && this.hp < this.maxHp * 0.45) {
              dmg = Math.round(dmg * 1.25);
            }
            if (this.team === 'remote' && network.isBot) {
              dmg = Math.round(dmg * this.game.getBotDamageMultiplier(this.team));
            }

            soundFX.playSwordHit();
            opponent.takeDamage(dmg, 'sword', this);

            // Apply sword unique effects
            if (this.sword.effect === 'burn') {
              opponent.burnTicks = 4;
            } else if (this.sword.effect === 'lightning') {
              this.game.strikeLightning(opponent.x, opponent.y, 8, this.team, this);
            } else if (this.sword.effect === 'chill') {
              opponent.chillTimer = 2.0;
              this.game.addFloatingText(opponent.x, opponent.y - 20, 'FROZEN / SLOWED!', '#80d8ff');
            } else if (this.sword.effect === 'lifesteal') {
              this.heal(Math.round(dmg * 0.2));
            } else if (this.sword.effect === 'holy_burst') {
              this.game.createExplosionParticles(opponent.x, opponent.y, 45, '#ffd700');
              opponent.takeDamage(12, 'holy', this);
            }

            // Thornmail armor passive check on opponent
            if (opponent.armor.passive === 'thorns') {
              const reflected = Math.round(dmg * 0.25);
              this.takeDamage(reflected, 'thorns', opponent);
              this.game.addFloatingText(this.x, this.y - 20, `THORNS -${reflected}`, '#ff5722');
            }
          }
        }
      }
    }
  }

  attackBow() {
    if (this.bowCooldown > 0 || this.hp <= 0) return;

    let cd = this.bow.cooldown;
    if (this.amulet.buffType === 'cooldown_reduction') {
      cd *= 0.75;
    }
    this.bowCooldown = cd;

    soundFX.playBowShot();

    if (this.team === 'local' && network.isConnected() && !network.isBot) {
      network.send({ type: 'ACTION_BOW', angle: this.angle });
    }

    const speed = this.bow.projSpeed;
    const isSpread = this.bow.effect === 'spread_3';

    if (isSpread) {
      // 3 arrows fan
      [-0.22, 0, 0.22].forEach(offset => {
        const a = this.angle + offset;
        this.game.projectiles.push({
          x: this.x + Math.cos(a) * 25,
          y: this.y + Math.sin(a) * 25,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          angle: a,
          damage: this.bow.damage,
          size: this.bow.projSize,
          color: this.bow.color,
          effect: this.bow.effect,
          pierce: false,
          life: 2.2,
          ownerTeam: this.team,
          owner: this
        });
      });
    } else {
      this.game.projectiles.push({
        x: this.x + Math.cos(this.angle) * 25,
        y: this.y + Math.sin(this.angle) * 25,
        vx: Math.cos(this.angle) * speed,
        vy: Math.sin(this.angle) * speed,
        angle: this.angle,
        damage: this.bow.damage,
        size: this.bow.projSize,
        color: this.bow.color,
        effect: this.bow.effect,
        pierce: this.bow.effect === 'pierce',
        life: 2.5,
        ownerTeam: this.team,
        owner: this
      });
    }
  }

  dash(customAngle) {
    if (this.dashCooldown > 0 || this.hp <= 0) return;

    this.dashCooldown = this.dashMaxCooldown;
    this.dashTimer = 0.18;
    this.dashAngle = customAngle !== undefined ? customAngle : this.angle;
    this.invulnerable = true;

    soundFX.playDash();

    // Spawn ghost shadow particles
    for (let i = 0; i < 5; i++) {
      this.game.particles.push({
        x: this.x,
        y: this.y,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
        size: this.radius * 0.8,
        color: 'rgba(255, 255, 255, 0.4)',
        alpha: 0.7,
        decay: 3.5
      });
    }

    if (this.team === 'local' && network.isConnected() && !network.isBot) {
      network.send({ type: 'ACTION_DASH' });
    }
  }

  castSpell(slotIdx, customTx, customTy) {
    if (slotIdx < 0 || slotIdx >= this.spells.length) return;
    const spell = this.spells[slotIdx];
    if (!spell || this.spellCooldowns[slotIdx] > 0 || this.hp <= 0) return;

    let cd = spell.cooldown;
    if (this.amulet.buffType === 'cooldown_reduction') {
      cd *= 0.75;
    }
    this.spellCooldowns[slotIdx] = cd;

    const targetX = customTx !== undefined ? customTx : (this.team === 'local' ? this.game.mouse.x : this.x + Math.cos(this.angle) * 200);
    const targetY = customTy !== undefined ? customTy : (this.team === 'local' ? this.game.mouse.y : this.y + Math.sin(this.angle) * 200);

    this.executeSpell(spell.id, targetX, targetY);

    if (this.team === 'local' && network.isConnected() && !network.isBot) {
      network.send({
        type: 'ACTION_SPELL',
        spellId: spell.id,
        targetX,
        targetY
      });
    }
  }

  executeSpell(spellId, tx, ty) {
    const spell = getItem(spellId);
    if (!spell) return;

    let bonusMultiplier = 1.0;
    if (this.amulet.buffType === 'spell_power') {
      bonusMultiplier = 1.35;
    }
    if (this.team === 'remote' && network.isBot) {
      bonusMultiplier *= this.game.getBotDamageMultiplier(this.team);
    }

    if (spell.castType === 'projectile' && spell.id === 'spell_fireball') {
      soundFX.playFireballCast();
      const a = Math.atan2(ty - this.y, tx - this.x);
      this.game.projectiles.push({
        x: this.x + Math.cos(a) * 25,
        y: this.y + Math.sin(a) * 25,
        vx: Math.cos(a) * spell.projSpeed,
        vy: Math.sin(a) * spell.projSpeed,
        angle: a,
        damage: Math.round(spell.damage * bonusMultiplier),
        size: 9,
        color: '#ff3d00',
        isFireball: true,
        life: 2.0,
        ownerTeam: this.team,
        owner: this
      });
    } else if (spell.castType === 'aoe_around' && spell.id === 'spell_frost_nova') {
      soundFX.playFrostNova();
      this.game.createExplosionParticles(this.x, this.y, spell.radius, '#00e5ff');

      if (this.game.gameMode === 'horde') {
        for (const zombie of this.game.zombies) {
          if (zombie.hp <= 0) continue;
          const dist = Math.hypot(zombie.x - this.x, zombie.y - this.y);
          if (dist <= spell.radius + zombie.radius) {
            zombie.takeDamage(Math.round(spell.damage * bonusMultiplier), 'ice', this);
            zombie.chillTimer = spell.freezeDuration || 2.5;
            this.game.addFloatingText(zombie.x, zombie.y - 20, 'FROZEN!', '#00e5ff');
          }
        }
      } else {
        const opponent = this.team === 'local' ? this.game.remotePlayer : this.game.localPlayer;
        if (opponent && opponent.hp > 0) {
          const dist = Math.hypot(opponent.x - this.x, opponent.y - this.y);
          if (dist <= spell.radius + opponent.radius) {
            opponent.takeDamage(Math.round(spell.damage * bonusMultiplier), 'ice', this);
            opponent.chillTimer = spell.freezeDuration;
            this.game.addFloatingText(opponent.x, opponent.y - 20, 'FROZEN!', '#00e5ff');
          }
        }
      }
    } else if (spell.castType === 'self_heal' && spell.id === 'spell_holy_mend') {
      soundFX.playHolyHeal();
      this.heal(spell.healAmount);
      this.game.createRuneSpawnParticles(this.x, this.y);
    } else if (spell.castType === 'teleport' && spell.id === 'spell_blink') {
      soundFX.playBlink();
      this.game.createExplosionParticles(this.x, this.y, 40, '#e040fb');
      const a = Math.atan2(ty - this.y, tx - this.x);
      const nextX = this.x + Math.cos(a) * spell.distance;
      const nextY = this.y + Math.sin(a) * spell.distance;
      if (!this.checkWallCollision(nextX, nextY)) {
        this.x = nextX;
        this.y = nextY;
      }
      this.game.createExplosionParticles(this.x, this.y, 40, '#e040fb');
    } else if (spell.castType === 'instant_point' && spell.id === 'spell_lightning') {
      this.game.strikeLightning(tx, ty, Math.round(spell.damage * bonusMultiplier), this.team, this);
    } else if (spell.castType === 'lobbed_cloud' && spell.id === 'spell_toxic_miasma') {
      soundFX.playExplosion();
      this.game.aoeEffects.push({
        x: tx,
        y: ty,
        radius: spell.radius,
        duration: spell.duration,
        type: 'toxic_cloud',
        damagePerTick: Math.round(spell.damagePerSec * 0.5 * bonusMultiplier),
        ownerTeam: this.team,
        owner: this
      });
    } else if (spell.castType === 'shield' && spell.id === 'spell_arcane_aegis') {
      soundFX.playShield();
      this.shield = spell.shieldAmount;
      this.game.addFloatingText(this.x, this.y - 25, `+${spell.shieldAmount} AEGIS SHIELD`, '#00b0ff');
    } else if (spell.castType === 'targeted_aoe' && spell.id === 'spell_meteor') {
      soundFX.playFireballCast();
      this.game.aoeEffects.push({
        x: tx,
        y: ty,
        radius: spell.radius,
        duration: spell.delay,
        type: 'meteor_strike',
        damage: Math.round(spell.damage * bonusMultiplier),
        exploded: false,
        ownerTeam: this.team,
        owner: this
      });
    } else if (spell.castType === 'vortex' && spell.id === 'spell_vortex') {
      soundFX.playExplosion();
      this.game.aoeEffects.push({
        x: tx,
        y: ty,
        radius: spell.radius,
        duration: spell.duration,
        type: 'vortex',
        ownerTeam: this.team,
        owner: this
      });
    }
  }

  takeDamage(amount, type, attacker) {
    if (this.invulnerable || this.hp <= 0) return;

    // Armor passive: Evasion check
    if (this.armor.passive === 'evasion' && Math.random() < 0.18) {
      this.game.addFloatingText(this.x, this.y - 25, 'DODGED!', '#ffffff');
      return;
    }

    // Armor Damage Reduction
    const reduction = this.armor.dmgReduction || 0;
    let actualDamage = Math.max(1, Math.round(amount * (1.0 - reduction)));

    // Blue Shield absorption first
    if (this.shield > 0) {
      if (this.shield >= actualDamage) {
        this.shield -= actualDamage;
        this.game.addFloatingText(this.x, this.y - 20, `-${actualDamage} (SHIELD)`, '#00b0ff');
        actualDamage = 0;
      } else {
        actualDamage -= this.shield;
        this.game.addFloatingText(this.x, this.y - 20, `-${this.shield} (SHIELD)`, '#00b0ff');
        this.shield = 0;
      }
    }

    if (actualDamage > 0) {
      this.hp = Math.max(0, this.hp - actualDamage);
      const color = type === 'poison' ? '#76ff03' : type === 'burn' ? '#ff5722' : '#ff1744';
      this.game.addFloatingText(this.x, this.y - 20, `-${actualDamage}`, color);

      // Bloodstone Eye amulet lifesteal for Sword, Bow, and Spell damage dealt
      if (
        type !== 'thorns' &&
        attacker &&
        attacker !== this &&
        attacker.amulet &&
        attacker.amulet.buffType === 'lifesteal'
      ) {
        const lifestealRate = attacker.amulet.value || 0.06;
        attacker.heal(Math.round(actualDamage * lifestealRate));
      }
    }

    // Check Phoenix Revive Armor passive upon death
    if (this.hp <= 0 && this.armor.passive === 'phoenix_revive' && !this.phoenixRevived) {
      this.phoenixRevived = true;
      this.hp = Math.round(this.maxHp * 0.35);
      soundFX.playHolyHeal();
      this.game.createExplosionParticles(this.x, this.y, 80, '#ff9100');
      this.game.addFloatingText(this.x, this.y - 35, '🔥 PHOENIX REBIRTH! 🔥', '#ffd700');
    }

    // Hit sparks
    this.game.createHitSparks(this.x, this.y, '#ff1744');
  }

  heal(amount) {
    if (this.hp <= 0) return;
    const oldHp = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const healed = this.hp - oldHp;
    if (healed > 0) {
      this.game.addFloatingText(this.x, this.y - 25, `+${healed}`, '#00e676');
    }
  }

  applyPoison(ticks, dmgPerTick, attacker) {
    this.poisonTicks = ticks;
  }

  triggerSwordVFX() {
    this.swingProgress = 1.0;
    soundFX.playSwordSwing(this.sword.effect);
  }

  triggerBowVFX(angle) {
    soundFX.playBowShot();
  }

  triggerDashVFX() {
    soundFX.playDash();
  }

  getHUDStats() {
    return {
      name: this.name,
      hp: this.hp,
      maxHp: this.maxHp,
      shield: this.shield,
      activeWeapon: this.activeWeapon || 'melee',
      swordCooldown: Math.max(0, this.swordCooldown),
      bowCooldown: Math.max(0, this.bowCooldown),
      dashCooldown: Math.max(0, this.dashCooldown),
      spellCooldowns: this.spellCooldowns.map(c => Math.max(0, c)),
      spells: this.spells,
      sword: this.sword,
      bow: this.bow,
      armor: this.armor,
      amulet: this.amulet
    };
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Downed pose in Horde Co-op mode
    if (this.hp <= 0 && this.game && this.game.gameMode === 'horde' && this.game.isCoop) {
      ctx.globalAlpha = 0.55;
      ctx.rotate(Math.PI * 0.45);
    }

    // Character Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 16, this.radius, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Shield Aura if active
    if (this.shield > 0) {
      ctx.strokeStyle = '#00b0ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Golden Invulnerability Aura (e.g. 2s post-revive immunity)
    if (this.invulnerable && this.invulnerableTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 8, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Rotate for character body & weapons
    ctx.rotate(this.angle);

    // Armor Body
    ctx.fillStyle = this.armor.id === 'armor_plate' ? '#78909c' :
                    this.armor.id === 'armor_shadow' ? '#212121' :
                    this.armor.id === 'armor_phoenix' ? '#d84315' :
                    this.armor.id === 'armor_titan' ? '#37474f' : '#8d6e63';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Team Accent Ring
    ctx.strokeStyle = this.team === 'local' ? '#29b6f6' : (this.team === 'heroes' ? '#00e676' : '#ef5350');
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Helmet / Head
    ctx.fillStyle = '#eceff1';
    ctx.beginPath();
    ctx.arc(4, 0, 11, 0, Math.PI * 2);
    ctx.fill();

    // Visor / Eyes
    ctx.fillStyle = this.team === 'local' ? '#00e5ff' : (this.team === 'heroes' ? '#69f0ae' : '#ff1744');
    ctx.fillRect(8, -4, 4, 8);

    // Render weapons based on active weapon ('melee' vs 'ranged')
    const isRanged = this.activeWeapon === 'ranged';

    // 1. Render Sword
    ctx.save();
    if (isRanged && this.swingProgress <= 0) {
      // Sword sheathed at hip
      ctx.translate(-6, 14);
      ctx.rotate(Math.PI * 0.7);
      ctx.fillStyle = this.sword.color || '#c0c0c0';
      ctx.fillRect(0, -2, 22, 3);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(0, -5, 3, 10);
    } else {
      // Sword drawn in primary ready stance
      ctx.translate(14, 12);
      const swingAngle = this.swingProgress > 0 ? (1.0 - this.swingProgress) * this.sword.arc - this.sword.arc / 2 : 0;
      ctx.rotate(swingAngle);

      // Blade
      ctx.fillStyle = this.sword.color || '#c0c0c0';
      ctx.fillRect(0, -2, 28, 4);

      // Crossguard
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(0, -6, 4, 12);

      // Sword Slash Arc VFX
      if (this.swingProgress > 0) {
        ctx.strokeStyle = this.sword.trailColor || 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, this.sword.range, -this.sword.arc / 2, this.sword.arc / 2);
        ctx.stroke();
      }
    }
    ctx.restore();

    // 2. Render Bow
    ctx.save();
    if (isRanged) {
      // Bow held in front in active aiming stance
      ctx.translate(18, 0);
      ctx.strokeStyle = '#8d6e63';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 14, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.stroke();

      // Bowstring
      ctx.strokeStyle = '#cfd8dc';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(10, -10);
      ctx.lineTo(10, 10);
      ctx.stroke();

      // Ready arrow nocked on string
      ctx.fillStyle = '#ff9800';
      ctx.fillRect(4, -1.5, 16, 3);
      ctx.beginPath();
      ctx.moveTo(20, -3.5);
      ctx.lineTo(24, 0);
      ctx.lineTo(20, 3.5);
      ctx.closePath();
      ctx.fillStyle = '#ffd700';
      ctx.fill();
    } else {
      // Bow slung across back
      ctx.translate(-8, -10);
      ctx.rotate(-Math.PI * 0.35);
      ctx.strokeStyle = '#8d6e63';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 12, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.stroke();

      ctx.strokeStyle = '#cfd8dc';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(8, -8);
      ctx.lineTo(8, 8);
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore(); // Undo rotate & translate

    // Draw Health Bar & Name over character head
    this.renderOverheadHUD(ctx);
  }

  renderOverheadHUD(ctx) {
    if (this.hp <= 0) {
      if (this.game && this.game.gameMode === 'horde' && this.game.isCoop) {
        ctx.save();
        ctx.font = 'bold 12px "Segoe UI", sans-serif';
        ctx.fillStyle = '#ffd700';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.textAlign = 'center';
        ctx.strokeText(`${this.name} (DOWN)`, this.x, this.y - this.radius - 12);
        ctx.fillText(`${this.name} (DOWN)`, this.x, this.y - this.radius - 12);
        ctx.restore();
      }
      return;
    }

    const barW = 60;
    const barH = 7;
    const barX = this.x - barW / 2;
    const barY = this.y - this.radius - 18;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

    // Health Fill
    const hpRatio = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = (this.team === 'local' || this.team === 'heroes') ? '#00e676' : '#ff5252';
    ctx.fillRect(barX, barY, barW * hpRatio, barH);

    // Shield overlay
    if (this.shield > 0) {
      const shieldRatio = Math.min(1.0, this.shield / this.maxShield);
      ctx.fillStyle = '#00b0ff';
      ctx.fillRect(barX, barY - 3, barW * shieldRatio, 2);
    }

    // Name tag & HP number
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.name} (${Math.round(this.hp)})`, this.x, barY - 6);
  }
}
