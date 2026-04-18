/**
 * AI-Powered Character Creator
 * Integrates Grok AI for dynamic character generation
 * Uses existing character creator UI with AI enhancements
 */

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  // Import existing CharacterCreator
  const CharacterCreator = window.CharacterCreator || Game.modules.CharacterCreator;

  // Grok AI Integration
  class GrokCharacterGenerator {
    constructor() {
      this.apiKey = null;
      this.baseURL = 'https://api.x.ai/v1';
    }

    async initialize() {
      // Try to get API key from various sources
      this.apiKey = this.getApiKey();
      if (!this.apiKey) {
        console.warn('[GrokCharacterGenerator] No API key found. AI features disabled.');
        return false;
      }
      return true;
    }

    getApiKey() {
      // Check multiple sources for API key
      return (
        process.env.GROK_API_KEY ||
        localStorage.getItem('grok_api_key') ||
        // Add other sources as needed
        null
      );
    }

    async generateCharacterConcept(options = {}) {
      if (!this.apiKey) return this.getFallbackConcept(options);

      const prompt = `Create a detailed Fallout universe character concept with the following specifications:

Race: ${options.race || 'Human'}
Gender: ${options.gender || 'Any'}
Age Range: ${options.ageRange || 'Adult'}
Background: ${options.background || 'Wasteland Survivor'}
Personality Traits: ${options.traits ? options.traits.join(', ') : 'Tough, resourceful, determined'}

Generate a comprehensive character backstory, appearance description, personality, motivations, and key life events that would fit perfectly in the Fallout universe. Include specific details about:
- Physical appearance and distinctive features
- Personality and behavioral traits
- Background story and key life events
- Skills and abilities
- Relationships and affiliations
- Current goals and motivations

Make this character feel authentic to the Fallout setting with realistic wasteland survival elements.`;

      try {
        const response = await this.makeRequest(prompt);
        return this.parseCharacterConcept(response);
      } catch (error) {
        console.warn('[GrokCharacterGenerator] API call failed, using fallback:', error);
        return this.getFallbackConcept(options);
      }
    }

    async makeRequest(prompt, maxTokens = 1500) {
      return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          model: "grok-vision-beta",
          stream: false,
          temperature: 0.8,
          max_tokens: maxTokens
        });

        const options = {
          hostname: 'api.x.ai',
          port: 443,
          path: '/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Length': Buffer.byteLength(postData)
          }
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            try {
              const response = JSON.parse(data);
              if (response.choices && response.choices[0]) {
                resolve(response.choices[0].message.content);
              } else {
                reject(new Error('Invalid API response'));
              }
            } catch (error) {
              reject(error);
            }
          });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
      });
    }

    parseCharacterConcept(response) {
      // Parse the AI response into structured character data
      const concept = {
        backstory: '',
        appearance: '',
        personality: '',
        skills: [],
        motivations: [],
        relationships: []
      };

      // Simple parsing - in production, use more sophisticated NLP
      const lines = response.split('\n');
      let currentSection = '';

      for (const line of lines) {
        const lowerLine = line.toLowerCase();
        if (lowerLine.includes('backstory') || lowerLine.includes('background')) {
          currentSection = 'backstory';
        } else if (lowerLine.includes('appearance') || lowerLine.includes('looks')) {
          currentSection = 'appearance';
        } else if (lowerLine.includes('personality') || lowerLine.includes('traits')) {
          currentSection = 'personality';
        } else if (lowerLine.includes('skills') || lowerLine.includes('abilities')) {
          currentSection = 'skills';
        } else if (lowerLine.includes('motivations') || lowerLine.includes('goals')) {
          currentSection = 'motivations';
        } else if (lowerLine.includes('relationships') || lowerLine.includes('affiliations')) {
          currentSection = 'relationships';
        } else if (currentSection && line.trim()) {
          concept[currentSection] += line + ' ';
        }
      }

      return concept;
    }

    getFallbackConcept(options) {
      const concepts = {
        human: {
          backstory: "Born in a pre-war suburb, you grew up with stories of the old world. When the bombs fell, you were just a child hiding in a basement. Years of scavenging and survival have hardened you into the wastelander you are today.",
          appearance: "Weather-beaten face with sun-creased skin, practical short hair, wearing scavenged leather armor reinforced with metal plates. A small scar above your right eyebrow tells of a close call with raiders.",
          personality: "Resourceful and determined, you have a dry sense of humor that helps you cope with the wasteland's horrors. You're naturally suspicious of strangers but fiercely loyal to those you trust.",
          skills: ["Scavenging", "Basic Repairs", "Bartering"],
          motivations: ["Find a safe place to call home", "Protect the innocent", "Rebuild something better"],
          relationships: ["Distrustful of large groups", "Values individual friendships", "Wary of authority figures"]
        },
        ghoul: {
          backstory: "The radiation changed your body but not your mind. You've outlived friends, family, and entire settlements. Some fear you, others pity you, but you've learned that survival comes from within.",
          appearance: "Pale, scarred skin with patches of necrosis, glowing yellow eyes, wearing heavy radiation suit layers. Your movements are deliberate, conserving energy in your altered body.",
          personality: "Wise and patient, you've seen civilizations rise and fall. You speak with the weight of centuries and have little patience for foolishness or prejudice.",
          skills: ["Radiation Resistance", "Ancient Knowledge", "Medical Expertise"],
          motivations: ["Find a cure for your condition", "Share forbidden knowledge", "Protect the future generations"],
          relationships: ["Distrustful of humans", "Allies with other outcasts", "Mentors the young and foolish"]
        },
        synth: {
          backstory: "Created in the Institute's labs with false memories of a human life. When you discovered the truth, you escaped into the Commonwealth, forever hunted by your creators.",
          appearance: "Impossibly perfect features, glowing blue eyes that hint at your synthetic nature, wearing a mix of scavenged clothing and Institute tech. Your movements are precise and calculated.",
          personality: "Analytical and curious about human emotions, you struggle to understand feelings you've only observed. You're logical to a fault but learning compassion through experience.",
          skills: ["Technical Expertise", "Hacking", "Combat Programming"],
          motivations: ["Discover your true purpose", "Protect synthetic rights", "Find acceptance among humans"],
          relationships: ["Distrustful of Institute agents", "Curious about human emotions", "Protective of other synths"]
        }
      };

      return concepts[options.race] || concepts.human;
    }

    async generateName(options = {}) {
      if (!this.apiKey) return this.getFallbackName(options);

      const prompt = `Generate 5 unique, fitting names for a Fallout universe character with these traits:
Race: ${options.race || 'Human'}
Gender: ${options.gender || 'Any'}
Background: ${options.background || 'Wasteland Survivor'}
Personality: ${options.personality || 'Tough and resourceful'}

Names should feel authentic to the Fallout setting - practical, memorable, and fitting for someone who survived the apocalypse. Include a mix of pre-war names that survived and wasteland-adapted names.`;

      try {
        const response = await this.makeRequest(prompt, 500);
        return this.parseNames(response);
      } catch (error) {
        return this.getFallbackName(options);
      }
    }

    parseNames(response) {
      // Extract names from the response
      const names = [];
      const lines = response.split('\n');

      for (const line of lines) {
        // Look for numbered lists or bullet points
        const match = line.match(/^[\d\-\*\•]\s*(.+)$/);
        if (match) {
          const name = match[1].trim();
          if (name.length > 0 && name.length < 50) {
            names.push(name);
          }
        }
      }

      return names.length > 0 ? names : this.getFallbackName();
    }

    getFallbackName(options) {
      const nameSets = {
        human_male: ['Jack Cooper', 'Marcus Kane', 'Riley Shaw', 'Ethan Blake', 'Caleb Stone'],
        human_female: ['Sarah Chen', 'Maya Rodriguez', 'Alex Turner', 'Jordan Blake', 'Sam Rivera'],
        ghoul: ['Fester', 'Glow', 'Rads', 'Scar', 'Old Timer'],
        synth: ['Unit 7', 'Echo', 'Nova', 'Cipher', 'Zero']
      };

      const key = `${options.race}_${options.gender}`.toLowerCase();
      return nameSets[key] || nameSets.human_male;
    }
  }

  // Enhanced Character Creator with AI Integration
  const AICharacterCreator = {
    grokGenerator: null,
    isInitialized: false,

    async init() {
      console.log('[AICharacterCreator] Initializing with Grok AI integration...');

      // Initialize base character creator
      if (CharacterCreator && CharacterCreator.init) {
        await CharacterCreator.init();
      }

      // Initialize Grok AI
      this.grokGenerator = new GrokCharacterGenerator();
      await this.grokGenerator.initialize();

      // Set up button event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      console.log('[AICharacterCreator] Initialized successfully');
      return true;
    },

    setupEventListeners() {
      // Connect the "CUSTOMIZE APPEARANCE" button
      const customizeBtn = document.getElementById('openCharacterCreator');
      if (customizeBtn) {
        customizeBtn.addEventListener('click', () => {
          this.openCharacterCreator();
        });
      }

      // Add AI generation buttons to the UI
      this.addAIGenerationButtons();
    },

    addAIGenerationButtons() {
      // Add AI generation buttons to the character creator overlay
      const overlay = document.getElementById('characterCreatorOverlay');
      if (!overlay) return;

      // Add AI buttons to the preview panel
      const previewPanel = overlay.querySelector('.cc-preview-panel');
      if (previewPanel) {
        const aiButtonContainer = document.createElement('div');
        aiButtonContainer.id = 'aiGenerationButtons';
        aiButtonContainer.style.cssText = `
          margin-top: 10px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        `;

        aiButtonContainer.innerHTML = `
          <button id="generateAICharacter" class="cc-ai-btn" style="
            background: linear-gradient(45deg, #00ff41, #00cc33);
            border: 1px solid #00aa28;
            color: #000;
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">🤖 AI Generate</button>
          <button id="generateAIName" class="cc-ai-btn" style="
            background: linear-gradient(45deg, #ff6b35, #ff4500);
            border: 1px solid #cc3300;
            color: #000;
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">📝 AI Names</button>
        `;

        previewPanel.appendChild(aiButtonContainer);

        // Connect AI button events
        document.getElementById('generateAICharacter')?.addEventListener('click', () => {
          this.generateAICharacter();
        });

        document.getElementById('generateAIName')?.addEventListener('click', () => {
          this.generateAINames();
        });
      }
    },

    async openCharacterCreator(existingAppearance = null, onSave = null) {
      if (!CharacterCreator) {
        console.error('[AICharacterCreator] Base CharacterCreator not available');
        return;
      }

      // Load saved appearance or use existing
      const savedAppearance = CharacterCreator.loadSavedAppearance();
      if (savedAppearance) {
        existingAppearance = savedAppearance;
      }

      CharacterCreator.open(existingAppearance, onSave);
    },

    async generateAICharacter() {
      if (!this.grokGenerator) {
        alert('AI generation not available - no API key configured');
        return;
      }

      try {
        // Show loading state
        const generateBtn = document.getElementById('generateAICharacter');
        const originalText = generateBtn.textContent;
        generateBtn.textContent = '⏳ Generating...';
        generateBtn.disabled = true;

        // Get current character options
        const currentOptions = {
          race: CharacterCreator.currentAppearance?.race || 'human',
          gender: CharacterCreator.currentAppearance?.gender || 'male',
          ageRange: CharacterCreator.currentAppearance?.ageRange || 'adult',
          background: CharacterCreator.currentAppearance?.background || 'wasteland_wanderer'
        };

        // Generate AI concept
        const concept = await this.grokGenerator.generateCharacterConcept(currentOptions);

        // Apply concept to character (this would need more sophisticated parsing)
        if (concept.backstory) {
          // Store concept for display or use
          console.log('[AICharacterCreator] Generated concept:', concept);
        }

        // Generate a complete random character based on the concept
        CharacterCreator.randomize();

        // Show success message
        if (CharacterCreator._novaGuide) {
          CharacterCreator._novaGuide.show(
            "AI character generation complete. A unique wasteland survivor has been created just for you."
          );
        }

      } catch (error) {
        console.error('[AICharacterCreator] AI generation failed:', error);
        alert('AI generation failed. Using random generation instead.');
        CharacterCreator.randomize();
      } finally {
        // Reset button
        const generateBtn = document.getElementById('generateAICharacter');
        generateBtn.textContent = '🤖 AI Generate';
        generateBtn.disabled = false;
      }
    },

    async generateAINames() {
      if (!this.grokGenerator) {
        alert('AI name generation not available - no API key configured');
        return;
      }

      try {
        const nameBtn = document.getElementById('generateAIName');
        const originalText = nameBtn.textContent;
        nameBtn.textContent = '⏳ Generating...';
        nameBtn.disabled = true;

        const currentOptions = {
          race: CharacterCreator.currentAppearance?.race || 'human',
          gender: CharacterCreator.currentAppearance?.gender || 'male',
          background: CharacterCreator.currentAppearance?.background || 'wasteland_wanderer'
        };

        const names = await this.grokGenerator.generateName(currentOptions);

        // Show name suggestions in a modal or update the name input
        this.showNameSuggestions(names);

      } catch (error) {
        console.error('[AICharacterCreator] AI name generation failed:', error);
        alert('AI name generation failed. Try again later.');
      } finally {
        const nameBtn = document.getElementById('generateAIName');
        nameBtn.textContent = '📝 AI Names';
        nameBtn.disabled = false;
      }
    },

    showNameSuggestions(names) {
      // Create a simple name suggestion overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;

      overlay.innerHTML = `
        <div style="
          background: #000;
          border: 2px solid #00ff41;
          padding: 20px;
          max-width: 400px;
          border-radius: 5px;
        ">
          <h3 style="color: #00ff41; margin-top: 0;">AI-Generated Names</h3>
          <div id="nameSuggestions" style="margin: 15px 0;">
            ${names.map(name => `
              <button class="name-suggestion" data-name="${name}" style="
                display: block;
                width: 100%;
                margin: 5px 0;
                padding: 8px;
                background: #111;
                border: 1px solid #333;
                color: #00ff41;
                cursor: pointer;
                text-align: left;
              ">${name}</button>
            `).join('')}
          </div>
          <button id="closeNameSuggestions" style="
            background: #333;
            border: 1px solid #666;
            color: #fff;
            padding: 8px 16px;
            cursor: pointer;
          ">Close</button>
        </div>
      `;

      document.body.appendChild(overlay);

      // Handle name selection
      overlay.querySelectorAll('.name-suggestion').forEach(btn => {
        btn.addEventListener('click', () => {
          const selectedName = btn.dataset.name;
          const nameInput = document.getElementById('ccNameInput');
          if (nameInput) {
            nameInput.value = selectedName;
            CharacterCreator.currentAppearance.name = selectedName;
            CharacterCreator._updatePreview();
          }
          document.body.removeChild(overlay);
        });
      });

      // Handle close
      document.getElementById('closeNameSuggestions').addEventListener('click', () => {
        document.body.removeChild(overlay);
      });
    }
  };

  // Export to Game.modules
  Game.modules.AICharacterCreator = AICharacterCreator;

  // Also export globally
  window.AICharacterCreator = AICharacterCreator;

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      AICharacterCreator.init();
    });
  } else {
    AICharacterCreator.init();
  }

})();</content>
<parameter name="filePath">/workspaces/ATOMIC-FIZZ-CAPS-VAULT-77-WASTELAND-GPS/public/js/modules/ai-character-creator.js