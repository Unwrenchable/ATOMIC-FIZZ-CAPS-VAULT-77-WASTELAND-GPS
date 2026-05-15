(function () {
  'use strict';

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value == null ? '' : value);
    return div.innerHTML;
  }

  function getCharacterCreator() {
    return window.CharacterCreator || (window.Game && Game.modules && Game.modules.CharacterCreator) || null;
  }

  function getSessionHeaders() {
    const headers = { 'Content-Type': 'application/json' };

    try {
      const sessionId = localStorage.getItem('sessionId') || '';
      if (sessionId) {
        headers.Authorization = `Bearer ${sessionId}`;
      }
    } catch (error) {
      console.warn('[AICharacterCreator] session header unavailable', error);
    }

    return headers;
  }

  function buildCurrentPayload(extra) {
    const CharacterCreator = getCharacterCreator();
    const appearance = CharacterCreator && typeof CharacterCreator.getAppearance === 'function'
      ? CharacterCreator.getAppearance()
      : {};

    return {
      ...(extra || {}),
      name: appearance.name || '',
      race: appearance.race || 'human',
      gender: appearance.gender || 'male',
      ageRange: appearance.ageRange || 'adult',
      background: appearance.background || '',
      personality: appearance.expression || '',
      notes: Array.isArray(appearance.selectedTraits) ? appearance.selectedTraits.join(', ') : ''
    };
  }

  async function postJson(path, payload) {
    const response = await fetch(path, {
      method: 'POST',
      headers: getSessionHeaders(),
      body: JSON.stringify(payload || {})
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data || data.ok === false) {
      throw new Error((data && data.error) || `Request failed (${response.status})`);
    }

    return data;
  }

  function setButtonState(id, busyText, isBusy) {
    const button = document.getElementById(id);
    if (!button) return '';
    const original = button.dataset.originalLabel || button.textContent;
    button.dataset.originalLabel = original;
    button.textContent = isBusy ? busyText : original;
    button.disabled = !!isBusy;
    return original;
  }

  function showModal(title, bodyHtml, footerHtml) {
    const existing = document.getElementById('overseerCharacterModal');
    if (existing) {
      existing.remove();
    }

    const overlay = document.createElement('div');
    overlay.id = 'overseerCharacterModal';
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'background:rgba(0,0,0,0.82)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'z-index:10050',
      'padding:16px'
    ].join(';');

    overlay.innerHTML = `
      <div style="width:min(720px,100%);max-height:90vh;overflow:auto;background:#071207;border:1px solid #00ff41;box-shadow:0 0 18px rgba(0,255,65,0.25);padding:18px;color:#9affae;font-family:VT323,monospace;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px;">
          <h3 style="margin:0;color:#00ff41;font-size:30px;letter-spacing:1px;">${escapeHtml(title)}</h3>
          <button id="overseerCharacterModalClose" style="background:#102510;border:1px solid #00ff41;color:#00ff41;padding:6px 10px;cursor:pointer;">CLOSE</button>
        </div>
        <div style="display:grid;gap:12px;">${bodyHtml}</div>
        ${footerHtml ? `<div style="margin-top:14px;">${footerHtml}</div>` : ''}
      </div>
    `;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) overlay.remove();
    });
    document.getElementById('overseerCharacterModalClose')?.addEventListener('click', () => overlay.remove());

    return overlay;
  }

  function renderList(title, items) {
    const values = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!values.length) return '';
    return `
      <section>
        <div style="color:#00ff41;font-size:22px;margin-bottom:4px;">${escapeHtml(title)}</div>
        <ul style="margin:0;padding-left:20px;">
          ${values.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </section>
    `;
  }

  function showConceptModal(concept) {
    const bodyHtml = `
      <section>
        <div style="color:#00ff41;font-size:22px;margin-bottom:4px;">Suggested Identity</div>
        <div>${escapeHtml(concept.suggestedName || 'Wastelander')}</div>
      </section>
      <section>
        <div style="color:#00ff41;font-size:22px;margin-bottom:4px;">Backstory</div>
        <div>${escapeHtml(concept.backstory || '')}</div>
      </section>
      <section>
        <div style="color:#00ff41;font-size:22px;margin-bottom:4px;">Appearance</div>
        <div>${escapeHtml(concept.appearance || '')}</div>
      </section>
      <section>
        <div style="color:#00ff41;font-size:22px;margin-bottom:4px;">Personality</div>
        <div>${escapeHtml(concept.personality || '')}</div>
      </section>
      ${renderList('Skills', concept.skills)}
      ${renderList('Motivations', concept.motivations)}
      ${renderList('Relationships', concept.relationships)}
    `;

    showModal('OVERSEER CHARACTER DOSSIER', bodyHtml, '');
  }

  function showNpcModal(npc) {
    const jsonBlob = escapeHtml(JSON.stringify(npc, null, 2));
    const overlay = showModal(
      'OVERSEER NPC DOSSIER',
      `
        <section>
          <div style="color:#00ff41;font-size:22px;margin-bottom:4px;">${escapeHtml(npc.name || 'Unknown Contact')}</div>
          <div>${escapeHtml((npc.role || 'Wasteland Contact') + ' // ' + (npc.faction || 'Independent'))}</div>
        </section>
        <section>
          <div style="color:#00ff41;font-size:22px;margin-bottom:4px;">Description</div>
          <div>${escapeHtml(npc.description || '')}</div>
        </section>
        <section>
          <div style="color:#00ff41;font-size:22px;margin-bottom:4px;">Personality</div>
          <div>${escapeHtml(npc.personality || '')}</div>
        </section>
        ${renderList('Approach Lines', npc.dialog && npc.dialog.approach)}
        ${renderList('Idle Lines', npc.dialog && npc.dialog.idle)}
        ${renderList('Motivations', npc.motivations)}
        <section>
          <div style="color:#00ff41;font-size:22px;margin-bottom:4px;">JSON</div>
          <pre id="overseerNpcJson" style="margin:0;white-space:pre-wrap;background:#020702;border:1px solid #184118;padding:10px;overflow:auto;">${jsonBlob}</pre>
        </section>
      `,
      '<button id="copyNpcJsonBtn" style="background:#102510;border:1px solid #00ff41;color:#00ff41;padding:8px 12px;cursor:pointer;">COPY JSON</button>'
    );

    overlay.querySelector('#copyNpcJsonBtn')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(npc, null, 2));
      } catch (error) {
        console.warn('[AICharacterCreator] clipboard copy failed', error);
      }
    });
  }

  function showNameSuggestions(names) {
    const list = Array.isArray(names) ? names.filter(Boolean) : [];
    if (!list.length) return;

    const overlay = showModal(
      'OVERSEER NAME ROSTER',
      `
        <section>
          <div style="display:grid;gap:8px;">
            ${list.map((name) => `
              <button class="overseer-name-suggestion" data-name="${escapeHtml(name)}" style="background:#102510;border:1px solid #00ff41;color:#9affae;padding:8px 10px;cursor:pointer;text-align:left;">
                ${escapeHtml(name)}
              </button>
            `).join('')}
          </div>
        </section>
      `,
      ''
    );

    overlay.querySelectorAll('.overseer-name-suggestion').forEach((button) => {
      button.addEventListener('click', () => {
        const CharacterCreator = getCharacterCreator();
        const selectedName = button.getAttribute('data-name') || '';
        if (!CharacterCreator || !selectedName) return;
        const appearance = CharacterCreator.getAppearance ? CharacterCreator.getAppearance() : {};
        CharacterCreator.setAppearance({ ...appearance, name: selectedName });
        overlay.remove();
      });
    });
  }

  function applyConceptToCharacter(concept) {
    const CharacterCreator = getCharacterCreator();
    if (!CharacterCreator || typeof CharacterCreator.getAppearance !== 'function') return;

    const currentAppearance = CharacterCreator.getAppearance() || {};
    let generatedAppearance = {};

    if (typeof CharacterCreator.generateNPCAppearance === 'function') {
      generatedAppearance = CharacterCreator.generateNPCAppearance(concept.appearanceHints || {});
    }

    const nextAppearance = {
      ...currentAppearance,
      ...generatedAppearance,
      ...(concept.appearanceHints || {}),
      name: concept.suggestedName || currentAppearance.name || 'Wanderer'
    };

    CharacterCreator.setAppearance(nextAppearance);
  }

  const AICharacterCreator = {
    isInitialized: false,

    async init() {
      if (this.isInitialized) return true;

      const CharacterCreator = getCharacterCreator();
      if (!CharacterCreator || typeof CharacterCreator.init !== 'function') {
        console.warn('[AICharacterCreator] CharacterCreator missing');
        return false;
      }

      await CharacterCreator.init();
      this.setupButtons();
      this.isInitialized = true;
      return true;
    },

    setupButtons() {
      const overlay = document.getElementById('characterCreatorOverlay');
      if (!overlay || document.getElementById('aiGenerationButtons')) return;

      const previewPanel = overlay.querySelector('.cc-preview-panel');
      if (!previewPanel) return;

      const buttonContainer = document.createElement('div');
      buttonContainer.id = 'aiGenerationButtons';
      buttonContainer.style.cssText = 'margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;';
      buttonContainer.innerHTML = `
        <button id="generateAICharacter" style="background:#00ff41;border:1px solid #0a8028;color:#021802;padding:6px 10px;cursor:pointer;font-weight:bold;">OVERSEER BUILD</button>
        <button id="generateAIName" style="background:#ffb347;border:1px solid #bb7b22;color:#1b1200;padding:6px 10px;cursor:pointer;font-weight:bold;">NAME ROSTER</button>
        <button id="generateAINpc" style="background:#7fd4f5;border:1px solid #3f8eb0;color:#04131a;padding:6px 10px;cursor:pointer;font-weight:bold;">NPC DOSSIER</button>
      `;

      previewPanel.appendChild(buttonContainer);
      document.getElementById('generateAICharacter')?.addEventListener('click', () => this.generateAICharacter());
      document.getElementById('generateAIName')?.addEventListener('click', () => this.generateAINames());
      document.getElementById('generateAINpc')?.addEventListener('click', () => this.generateAINpc());
    },

    async openCharacterCreator(existingAppearance, onSave) {
      const CharacterCreator = getCharacterCreator();
      if (!CharacterCreator || typeof CharacterCreator.open !== 'function') return;
      CharacterCreator.open(existingAppearance || null, onSave || null);
      this.setupButtons();
    },

    async generateAICharacter() {
      const CharacterCreator = getCharacterCreator();
      if (!CharacterCreator) return;

      try {
        setButtonState('generateAICharacter', 'FORGING...', true);
        const result = await postJson('/api/ai-character/generate-concept', buildCurrentPayload());
        const concept = result.concept || {};
        applyConceptToCharacter(concept);
        if (CharacterCreator._novaGuide && typeof CharacterCreator._novaGuide.show === 'function') {
          CharacterCreator._novaGuide.show('Overseer dossier synced. Your wasteland profile now carries terminal-born scars and secrets.');
        }
        showConceptModal(concept);
      } catch (error) {
        console.error('[AICharacterCreator] character generation failed', error);
        if (CharacterCreator._novaGuide && typeof CharacterCreator._novaGuide.show === 'function') {
          CharacterCreator._novaGuide.show('Overseer uplink coughed static. Character forge aborted.');
        }
      } finally {
        setButtonState('generateAICharacter', '', false);
      }
    },

    async generateAINames() {
      try {
        setButtonState('generateAIName', 'SCANNING...', true);
        const result = await postJson('/api/ai-character/generate-names', buildCurrentPayload());
        showNameSuggestions(result.names || []);
      } catch (error) {
        console.error('[AICharacterCreator] name generation failed', error);
      } finally {
        setButtonState('generateAIName', '', false);
      }
    },

    async generateAINpc() {
      try {
        setButtonState('generateAINpc', 'FORGING...', true);
        const result = await postJson('/api/ai-character/generate-npc', buildCurrentPayload());
        showNpcModal(result.npc || {});
      } catch (error) {
        console.error('[AICharacterCreator] NPC generation failed', error);
      } finally {
        setButtonState('generateAINpc', '', false);
      }
    }
  };

  Game.modules.AICharacterCreator = AICharacterCreator;
  window.AICharacterCreator = AICharacterCreator;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      AICharacterCreator.init();
    });
  } else {
    AICharacterCreator.init();
  }
})();
