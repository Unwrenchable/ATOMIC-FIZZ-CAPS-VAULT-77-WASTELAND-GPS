// public/js/modules/vats.js - VATS-Inspired Combat System
(function () {
  'use strict';

  const VATS = {
    enabled: false,
    targetingMode: false,
    actionPoints: 100,
    maxActionPoints: 100,
    targets: [],
    queuedShots: []
  };

  const BODY_PARTS = [
    { id: 'head', name: 'Head', hitChance: 0.35, damageMultiplier: 2.5, apCost: 35 },
    { id: 'torso', name: 'Torso', hitChance: 0.75, damageMultiplier: 1.0, apCost: 20 },
    { id: 'left_arm', name: 'Left Arm', hitChance: 0.55, damageMultiplier: 0.8, apCost: 25 },
    { id: 'right_arm', name: 'Right Arm', hitChance: 0.55, damageMultiplier: 0.8, apCost: 25 },
    { id: 'left_leg', name: 'Left Leg', hitChance: 0.60, damageMultiplier: 0.7, apCost: 20 },
    { id: 'right_leg', name: 'Right Leg', hitChance: 0.60, damageMultiplier: 0.7, apCost: 20 }
  ];

  function calculateHitChance(bodyPart, distance, playerPerception, weaponAccuracy) {
    let baseChance = bodyPart.hitChance;
    
    // Distance modifier
    if (distance > 50) baseChance *= 0.7;
    else if (distance > 20) baseChance *= 0.85;
    
    // Perception bonus (default to 5 if not provided)
    const perception = typeof playerPerception === 'number' ? playerPerception : 5;
    const perceptionBonus = (perception - 5) * 0.05;
    baseChance += perceptionBonus;
    
    // Weapon accuracy (default to 1.0 if not provided)
    const accuracy = typeof weaponAccuracy === 'number' ? weaponAccuracy : 1.0;
    baseChance *= accuracy;
    
    return Math.min(0.95, Math.max(0.05, baseChance));
  }

  function enterVATS(nearbyEnemies) {
    if (!nearbyEnemies || nearbyEnemies.length === 0) {
      console.log('[VATS] No targets available');
      return false;
    }

    VATS.enabled = true;
    VATS.targetingMode = true;
    VATS.targets = nearbyEnemies;
    VATS.queuedShots = [];
    
    // Pause game time
    if (window.Game && window.Game.pause) {
      window.Game.pause();
    }

    showVATSInterface();
    return true;
  }

  function exitVATS() {
    VATS.enabled = false;
    VATS.targetingMode = false;
    VATS.targets = [];
    
    // Resume game time
    if (window.Game && window.Game.resume) {
      window.Game.resume();
    }

    hideVATSInterface();
  }

  function queueShot(enemy, bodyPart) {
    const apCost = bodyPart.apCost;
    
    if (VATS.actionPoints < apCost) {
      console.log('[VATS] Not enough Action Points');
      return false;
    }

    const hitChance = calculateHitChance(
      bodyPart,
      enemy.distance || 10,
      window.PLAYER?.special?.P || 5,
      1.0
    );

    VATS.queuedShots.push({
      enemy: enemy,
      bodyPart: bodyPart,
      hitChance: hitChance,
      apCost: apCost
    });

    VATS.actionPoints -= apCost;
    updateVATSInterface();

    return true;
  }

  async function executeVATS() {
    if (VATS.queuedShots.length === 0) {
      exitVATS();
      return;
    }

    // Play dramatic camera animation
    showVATSAnimation();

    for (const shot of VATS.queuedShots) {
      await executeShot(shot);
      await sleep(500); // Delay between shots
    }

    // Regenerate some AP after execution
    VATS.actionPoints = Math.min(
      VATS.maxActionPoints,
      VATS.actionPoints + 20
    );

    VATS.queuedShots = [];
    exitVATS();
  }

  async function executeShot(shot) {
    const roll = Math.random();
    const hit = roll <= shot.hitChance;

    if (hit) {
      const damage = calculateDamage(shot.bodyPart, shot.enemy);
      applyDamage(shot.enemy, shot.bodyPart, damage);
      
      console.log(`[VATS] HIT ${shot.enemy.name} in ${shot.bodyPart.name} for ${damage} damage`);
      
      // Visual feedback
      showHitMarker(shot.enemy, shot.bodyPart, damage);
    } else {
      console.log(`[VATS] MISSED ${shot.enemy.name}`);
      showMissMarker(shot.enemy);
    }
  }

  function calculateDamage(bodyPart, enemy) {
    // Safely get base damage with proper fallback
    let baseDamage = 20; // Default damage
    
    if (window.PLAYER && window.PLAYER.weapon && typeof window.PLAYER.weapon.damage === 'number') {
      baseDamage = window.PLAYER.weapon.damage;
    }
    
    return Math.floor(baseDamage * bodyPart.damageMultiplier);
  }

  function applyDamage(enemy, bodyPart, damage) {
    if (!enemy.health) enemy.health = enemy.maxHealth || 100;
    
    enemy.health -= damage;
    
    // Cripple limb if applicable
    if (bodyPart.id !== 'torso' && bodyPart.id !== 'head') {
      if (!enemy.crippledLimbs) enemy.crippledLimbs = {};
      
      if (Math.random() < 0.3) {
        enemy.crippledLimbs[bodyPart.id] = true;
        console.log(`[VATS] ${enemy.name}'s ${bodyPart.name} is crippled!`);
      }
    }

    // Check for death
    if (enemy.health <= 0) {
      console.log(`[VATS] ${enemy.name} is dead!`);
      if (window.Game && window.Game.modules && window.Game.modules.npcEncounter) {
        window.Game.modules.npcEncounter.removeEnemy(enemy.id);
      }
    }
  }

  function showVATSInterface() {
    // Create VATS UI overlay
    const overlay = document.createElement('div');
    overlay.id = 'vatsOverlay';
    overlay.className = 'vats-overlay';
    overlay.innerHTML = `
      <div class="vats-container">
        <div class="vats-header">
          <span class="vats-title">V.A.T.S.</span>
          <span class="vats-ap">AP: <span id="vatsAPValue">${VATS.actionPoints}</span>/${VATS.maxActionPoints}</span>
        </div>
        <div class="vats-targets" id="vatsTargets"></div>
        <div class="vats-queue" id="vatsQueue"></div>
        <div class="vats-controls">
          <button id="vatsExecute" class="pipboy-button">EXECUTE</button>
          <button id="vatsCancel" class="pipboy-button">CANCEL</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Bind events
    document.getElementById('vatsExecute').addEventListener('click', executeVATS);
    document.getElementById('vatsCancel').addEventListener('click', exitVATS);

    updateVATSInterface();
  }

  function updateVATSInterface() {
    const targetsDiv = document.getElementById('vatsTargets');
    const queueDiv = document.getElementById('vatsQueue');
    const apValue = document.getElementById('vatsAPValue');

    if (!targetsDiv) return;

    // Update AP
    apValue.textContent = Math.floor(VATS.actionPoints);

    // Clear previous content
    targetsDiv.innerHTML = '';

    // Update targets
    VATS.targets.forEach((enemy, idx) => {
      const targetDiv = document.createElement('div');
      targetDiv.className = 'vats-target';
      targetDiv.setAttribute('data-enemy-id', idx);

      const enemyName = document.createElement('strong');
      enemyName.textContent = enemy.name;
      targetDiv.appendChild(enemyName);

      const bodyPartsDiv = document.createElement('div');
      bodyPartsDiv.className = 'vats-body-parts';

      BODY_PARTS.forEach(part => {
        const hitChance = calculateHitChance(
          part, 
          enemy.distance || 10, 
          (window.PLAYER && window.PLAYER.special && window.PLAYER.special.P) || 5, 
          1.0
        );
        
        const button = document.createElement('button');
        button.className = 'vats-body-part';
        button.textContent = `${part.name}: ${Math.floor(hitChance * 100)}% (${part.apCost} AP)`;
        button.setAttribute('data-enemy-id', idx);
        button.setAttribute('data-body-part', part.id);
        
        if (VATS.actionPoints < part.apCost) {
          button.classList.add('disabled');
          button.disabled = true;
        }
        
        // Safe event binding instead of inline onclick
        button.addEventListener('click', function() {
          if (!button.disabled) {
            queueShot(VATS.targets[idx], part);
          }
        });

        bodyPartsDiv.appendChild(button);
      });

      targetDiv.appendChild(bodyPartsDiv);
      targetsDiv.appendChild(targetDiv);
    });

    // Update queue
    queueDiv.innerHTML = VATS.queuedShots.length > 0
      ? `<strong>Queued Shots:</strong> ${VATS.queuedShots.map(s => `${s.bodyPart.name} (${Math.floor(s.hitChance * 100)}%)`).join(', ')}`
      : '';
  }

  function hideVATSInterface() {
    const overlay = document.getElementById('vatsOverlay');
    if (overlay) {
      overlay.remove();
    }
  }

  function showVATSAnimation() {
    console.log('[VATS] Playing cinematic camera...');
    // TODO: Implement camera animation
  }

  function showHitMarker(enemy, bodyPart, damage) {
    console.log(`[VATS] Hit marker: ${bodyPart.name} -${damage}HP`);
    // TODO: Visual feedback
  }

  function showMissMarker(enemy) {
    console.log(`[VATS] Miss marker`);
    // TODO: Visual feedback
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public API
  window.Game = window.Game || {};
  window.Game.modules = window.Game.modules || {};
  window.Game.modules.vats = {
    enter: enterVATS,
    exit: exitVATS,
    queue: queueShot,
    execute: executeVATS,
    getTargets: () => VATS.targets,
    queueShot: queueShot,
    isActive: () => VATS.enabled
  };

  console.log('[VATS] Module loaded');
})();
