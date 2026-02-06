/**
 * RED MENACE - Classic Arcade Game
 * A Fallout-inspired space shooter mini-game for the Overseer terminal
 * 
 * Controls:
 * - LEFT/RIGHT: Move ship
 * - FIRE: Shoot missiles
 */

(function () {
  "use strict";

  const RedMenace = {
    // Game state
    active: false,
    paused: false,
    gameOver: false,
    score: 0,
    level: 1,
    lives: 3,

    // Canvas and rendering
    canvas: null,
    ctx: null,
    width: 800,
    height: 600,

    // Game objects
    player: {
      x: 400,
      y: 550,
      width: 40,
      height: 30,
      speed: 5,
      color: "#00ff00"
    },

    missiles: [],
    enemies: [],
    explosions: [],

    // Enemy configuration
    enemyRows: 4,
    enemyCols: 8,
    enemyWidth: 30,
    enemyHeight: 20,
    enemySpacing: 10,
    enemySpeed: 1,
    enemyDirection: 1,
    enemyDropDistance: 20,

    // Timing
    lastEnemyMove: 0,
    enemyMoveInterval: 1000,
    lastEnemyFire: 0,
    enemyFireInterval: 2000,

    // Animation frame
    animationFrame: null,

    // Initialize the game
    init() {
      console.log("[RedMenace] Initializing...");

      // Create canvas if it doesn't exist
      let canvasContainer = document.getElementById("redMenaceCanvas");
      if (!canvasContainer) {
        canvasContainer = document.createElement("div");
        canvasContainer.id = "redMenaceCanvas";
        canvasContainer.style.display = "none";
        canvasContainer.style.marginTop = "20px";
        canvasContainer.style.textAlign = "center";
        document.body.appendChild(canvasContainer);
      }

      if (!this.canvas) {
        this.canvas = document.createElement("canvas");
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.canvas.style.border = "2px solid #00ff00";
        this.canvas.style.backgroundColor = "#000";
        canvasContainer.appendChild(this.canvas);
        this.ctx = this.canvas.getContext("2d");
      }

      console.log("[RedMenace] Canvas initialized");
    },

    // Start a new game
    start() {
      console.log("[RedMenace] Starting game...");
      this.active = true;
      this.paused = false;
      this.gameOver = false;
      this.score = 0;
      this.level = 1;
      this.lives = 3;

      this.missiles = [];
      this.explosions = [];

      this.resetPlayer();
      this.spawnEnemies();
      this.showCanvas();
      this.gameLoop();

      if (window.overseer) {
        window.overseer.print(">>> RED MENACE ACTIVATED <<<");
        window.overseer.print(`LEVEL ${this.level} | LIVES: ${this.lives} | SCORE: ${this.score}`);
      }
    },

    // Stop the game
    stop() {
      console.log("[RedMenace] Stopping game...");
      this.active = false;
      this.hideCanvas();
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }

      if (window.overseer) {
        window.overseer.print(">>> RED MENACE TERMINATED <<<");
        if (this.score > 0) {
          window.overseer.print(`FINAL SCORE: ${this.score}`);
        }
      }
    },

    // Handle input from controls
    handleInput(action) {
      if (!this.active || this.gameOver || this.paused) return;

      switch (action) {
        case "left":
          this.player.x = Math.max(0, this.player.x - this.player.speed * 3);
          break;
        case "right":
          this.player.x = Math.min(this.width - this.player.width, this.player.x + this.player.speed * 3);
          break;
        case "fire":
          this.fireMissile();
          break;
      }
    },

    // Reset player position
    resetPlayer() {
      this.player.x = this.width / 2 - this.player.width / 2;
      this.player.y = this.height - 50;
    },

    // Spawn enemy wave
    spawnEnemies() {
      this.enemies = [];
      const startX = 50;
      const startY = 50;

      for (let row = 0; row < this.enemyRows; row++) {
        for (let col = 0; col < this.enemyCols; col++) {
          this.enemies.push({
            x: startX + col * (this.enemyWidth + this.enemySpacing),
            y: startY + row * (this.enemyHeight + this.enemySpacing),
            width: this.enemyWidth,
            height: this.enemyHeight,
            alive: true,
            type: row < 2 ? "grunt" : "elite" // Bottom rows are tougher
          });
        }
      }

      // Speed increases with level
      this.enemySpeed = 1 + (this.level - 1) * 0.3;
      this.enemyMoveInterval = Math.max(300, 1000 - (this.level - 1) * 100);
    },

    // Fire player missile
    fireMissile() {
      // Limit to 3 missiles on screen
      if (this.missiles.length >= 3) return;

      this.missiles.push({
        x: this.player.x + this.player.width / 2 - 2,
        y: this.player.y,
        width: 4,
        height: 15,
        speed: 8,
        color: "#ffff00",
        fromPlayer: true
      });
    },

    // Enemy fires back
    enemyFire() {
      const aliveEnemies = this.enemies.filter(e => e.alive);
      if (aliveEnemies.length === 0) return;

      // Random enemy fires
      const shooter = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
      this.missiles.push({
        x: shooter.x + shooter.width / 2 - 2,
        y: shooter.y + shooter.height,
        width: 4,
        height: 15,
        speed: 5,
        color: "#ff0000",
        fromPlayer: false
      });
    },

    // Create explosion effect
    createExplosion(x, y, size = "normal") {
      this.explosions.push({
        x,
        y,
        radius: size === "large" ? 30 : 15,
        maxRadius: size === "large" ? 30 : 15,
        alpha: 1,
        color: size === "large" ? "#ff6600" : "#ffaa00"
      });
    },

    // Main game loop
    gameLoop() {
      if (!this.active) return;

      const now = Date.now();

      // Update
      this.updateMissiles();
      this.updateEnemies(now);
      this.updateExplosions();
      this.checkCollisions();
      this.checkWinLose();

      // Render
      this.render();

      // Continue loop
      this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    },

    // Update missiles
    updateMissiles() {
      for (let i = this.missiles.length - 1; i >= 0; i--) {
        const m = this.missiles[i];
        
        if (m.fromPlayer) {
          m.y -= m.speed;
          if (m.y < 0) this.missiles.splice(i, 1);
        } else {
          m.y += m.speed;
          if (m.y > this.height) this.missiles.splice(i, 1);
        }
      }
    },

    // Update enemies
    updateEnemies(now) {
      // Move enemies
      if (now - this.lastEnemyMove > this.enemyMoveInterval) {
        this.lastEnemyMove = now;

        let hitEdge = false;
        const aliveEnemies = this.enemies.filter(e => e.alive);

        // Check if any enemy hit the edge
        for (const enemy of aliveEnemies) {
          const newX = enemy.x + this.enemySpeed * this.enemyDirection;
          if (newX < 0 || newX + enemy.width > this.width) {
            hitEdge = true;
            break;
          }
        }

        if (hitEdge) {
          // Change direction and drop down
          this.enemyDirection *= -1;
          for (const enemy of this.enemies) {
            if (enemy.alive) {
              enemy.y += this.enemyDropDistance;
            }
          }
        } else {
          // Move horizontally
          for (const enemy of this.enemies) {
            if (enemy.alive) {
              enemy.x += this.enemySpeed * this.enemyDirection;
            }
          }
        }
      }

      // Enemy fire
      if (now - this.lastEnemyFire > this.enemyFireInterval) {
        this.lastEnemyFire = now;
        this.enemyFire();
      }
    },

    // Update explosions
    updateExplosions() {
      for (let i = this.explosions.length - 1; i >= 0; i--) {
        const exp = this.explosions[i];
        exp.alpha -= 0.05;
        exp.radius *= 0.95;
        
        if (exp.alpha <= 0) {
          this.explosions.splice(i, 1);
        }
      }
    },

    // Check collisions
    checkCollisions() {
      // Player missiles vs enemies
      for (let i = this.missiles.length - 1; i >= 0; i--) {
        const m = this.missiles[i];
        if (!m.fromPlayer) continue;

        for (const enemy of this.enemies) {
          if (!enemy.alive) continue;

          if (this.rectanglesCollide(m, enemy)) {
            enemy.alive = false;
            this.missiles.splice(i, 1);
            this.createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
            
            // Score based on enemy type
            const points = enemy.type === "elite" ? 20 : 10;
            this.score += points;
            
            if (window.overseer) {
              window.overseer.print(`[+${points}] COMMIE DESTROYED! SCORE: ${this.score}`);
            }
            break;
          }
        }
      }

      // Enemy missiles vs player
      for (let i = this.missiles.length - 1; i >= 0; i--) {
        const m = this.missiles[i];
        if (m.fromPlayer) continue;

        if (this.rectanglesCollide(m, this.player)) {
          this.missiles.splice(i, 1);
          this.playerHit();
          break;
        }
      }

      // Enemies reaching bottom
      for (const enemy of this.enemies) {
        if (enemy.alive && enemy.y + enemy.height >= this.player.y) {
          this.gameOver = true;
          if (window.overseer) {
            window.overseer.print(">>> INVASION! RED MENACE WINS! <<<");
          }
        }
      }
    },

    // Rectangle collision detection
    rectanglesCollide(a, b) {
      return a.x < b.x + b.width &&
             a.x + a.width > b.x &&
             a.y < b.y + b.height &&
             a.y + a.height > b.y;
    },

    // Player hit
    playerHit() {
      this.lives--;
      this.createExplosion(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, "large");
      
      if (window.overseer) {
        window.overseer.print(`>>> HIT! LIVES REMAINING: ${this.lives} <<<`);
      }

      if (this.lives <= 0) {
        this.gameOver = true;
        if (window.overseer) {
          window.overseer.print(">>> GAME OVER <<<");
          window.overseer.print(`FINAL SCORE: ${this.score}`);
        }
      } else {
        this.resetPlayer();
      }
    },

    // Check win/lose conditions
    checkWinLose() {
      if (this.gameOver) {
        setTimeout(() => this.stop(), 3000);
        return;
      }

      // All enemies destroyed
      const aliveEnemies = this.enemies.filter(e => e.alive);
      if (aliveEnemies.length === 0) {
        this.level++;
        this.score += this.level * 100; // Bonus for completing level
        
        if (window.overseer) {
          window.overseer.print(`>>> LEVEL ${this.level - 1} COMPLETE! <<<`);
          window.overseer.print(`BONUS: ${this.level * 100} | SCORE: ${this.score}`);
          window.overseer.print(`>>> LEVEL ${this.level} STARTING... <<<`);
        }
        
        this.spawnEnemies();
        this.missiles = [];
        this.resetPlayer();
      }
    },

    // Render game
    render() {
      if (!this.ctx) return;

      // Clear
      this.ctx.fillStyle = "#000";
      this.ctx.fillRect(0, 0, this.width, this.height);

      // Draw player
      this.ctx.fillStyle = this.player.color;
      this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
      
      // Draw player ship detail
      this.ctx.fillStyle = "#00aa00";
      this.ctx.fillRect(this.player.x + 15, this.player.y - 5, 10, 5); // Cockpit

      // Draw enemies
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        
        this.ctx.fillStyle = enemy.type === "elite" ? "#ff0000" : "#ff6666";
        this.ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
        
        // Enemy details
        this.ctx.fillStyle = enemy.type === "elite" ? "#aa0000" : "#cc0000";
        this.ctx.fillRect(enemy.x + 10, enemy.y + 5, 10, 10);
      }

      // Draw missiles
      for (const m of this.missiles) {
        this.ctx.fillStyle = m.color;
        this.ctx.fillRect(m.x, m.y, m.width, m.height);
      }

      // Draw explosions
      for (const exp of this.explosions) {
        this.ctx.globalAlpha = exp.alpha;
        this.ctx.fillStyle = exp.color;
        this.ctx.beginPath();
        this.ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1;
      }

      // Draw HUD
      this.ctx.fillStyle = "#00ff00";
      this.ctx.font = "16px monospace";
      this.ctx.fillText(`LEVEL: ${this.level}`, 10, 20);
      this.ctx.fillText(`SCORE: ${this.score}`, 10, 40);
      this.ctx.fillText(`LIVES: ${this.lives}`, 10, 60);

      if (this.gameOver) {
        this.ctx.fillStyle = "#ff0000";
        this.ctx.font = "48px monospace";
        this.ctx.fillText("GAME OVER", this.width / 2 - 150, this.height / 2);
      }
    },

    // Show canvas
    showCanvas() {
      const container = document.getElementById("redMenaceCanvas");
      if (container) container.style.display = "block";
    },

    // Hide canvas
    hideCanvas() {
      const container = document.getElementById("redMenaceCanvas");
      if (container) container.style.display = "none";
    }
  };

  // Export to global
  window.redMenace = RedMenace;

  // Initialize when loaded
  if (document.readyState === "complete" || document.readyState === "interactive") {
    RedMenace.init();
  } else {
    document.addEventListener("DOMContentLoaded", () => RedMenace.init());
  }

  console.log("[RedMenace] Module loaded");
})();
