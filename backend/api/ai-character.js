/**
 * AI Character Generation API
 * Server-side endpoint for Grok AI character generation
 */

const https = require('https');

class GrokAICharacterService {
  constructor() {
    this.apiKey = this.getApiKey();
    this.baseURL = 'https://api.x.ai/v1';
  }

  getApiKey() {
    // Check environment variables for API key
    return process.env.GROK_API_KEY || process.env.XAI_API_KEY;
  }

  async makeGrokRequest(prompt, maxTokens = 1500) {
    if (!this.apiKey) {
      throw new Error('Grok API key not configured');
    }

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
            if (response.choices && response.choices[0] && response.choices[0].message) {
              resolve(response.choices[0].message.content);
            } else {
              reject(new Error('Invalid response format from Grok API'));
            }
          } catch (error) {
            console.error('Grok API JSON parse error:', error.message);
            console.error('Raw response:', data);
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        console.error('Grok API request error:', error.message);
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  async generateCharacterConcept(options = {}) {
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

Make this character feel authentic to the Fallout setting with realistic wasteland survival elements.

Format your response as a JSON object with these keys:
{
  "backstory": "string",
  "appearance": "string",
  "personality": "string",
  "skills": ["array", "of", "skills"],
  "motivations": ["array", "of", "motivations"],
  "relationships": ["array", "of", "relationship", "descriptions"]
}`;

    try {
      const response = await this.makeGrokRequest(prompt, 2000);

      // Try to parse as JSON first
      try {
        return JSON.parse(response);
      } catch (jsonError) {
        // If not JSON, parse the text response
        return this.parseCharacterConceptText(response);
      }
    } catch (error) {
      console.error('Character concept generation failed:', error);
      return this.getFallbackConcept(options);
    }
  }

  parseCharacterConceptText(response) {
    // Parse text response into structured format
    const concept = {
      backstory: '',
      appearance: '',
      personality: '',
      skills: [],
      motivations: [],
      relationships: []
    };

    const lines = response.split('\n');
    let currentSection = '';

    for (const line of lines) {
      const lowerLine = line.toLowerCase().trim();

      if (lowerLine.includes('backstory') || lowerLine.includes('background')) {
        currentSection = 'backstory';
      } else if (lowerLine.includes('appearance') || lowerLine.includes('looks') || lowerLine.includes('physical')) {
        currentSection = 'appearance';
      } else if (lowerLine.includes('personality') || lowerLine.includes('behavior') || lowerLine.includes('traits')) {
        currentSection = 'personality';
      } else if (lowerLine.includes('skills') || lowerLine.includes('abilities')) {
        currentSection = 'skills';
      } else if (lowerLine.includes('motivations') || lowerLine.includes('goals')) {
        currentSection = 'motivations';
      } else if (lowerLine.includes('relationships') || lowerLine.includes('affiliations')) {
        currentSection = 'relationships';
      } else if (currentSection && line.trim() && !line.startsWith('-') && !line.startsWith('*')) {
        // Add content to current section
        if (Array.isArray(concept[currentSection])) {
          // Split by commas or bullets for arrays
          const items = line.split(/[,•\-*]/).map(item => item.trim()).filter(item => item.length > 0);
          concept[currentSection].push(...items);
        } else {
          concept[currentSection] += line + ' ';
        }
      }
    }

    // Clean up strings
    Object.keys(concept).forEach(key => {
      if (typeof concept[key] === 'string') {
        concept[key] = concept[key].trim();
      }
    });

    return concept;
  }

  async generateNames(options = {}) {
    const prompt = `Generate 5 unique, fitting names for a Fallout universe character with these traits:
Race: ${options.race || 'Human'}
Gender: ${options.gender || 'Any'}
Background: ${options.background || 'Wasteland Survivor'}
Personality: ${options.personality || 'Tough and resourceful'}

Names should feel authentic to the Fallout setting - practical, memorable, and fitting for someone who survived the apocalypse. Include a mix of pre-war names that survived and wasteland-adapted names.

Return only the 5 names, one per line, no numbering or bullets.`;

    try {
      const response = await this.makeGrokRequest(prompt, 500);
      return this.parseNames(response);
    } catch (error) {
      console.error('Name generation failed:', error);
      return this.getFallbackNames(options);
    }
  }

  parseNames(response) {
    const names = [];
    const lines = response.split('\n');

    for (const line of lines) {
      const cleanLine = line.trim();
      // Remove numbering/bullets if present
      const nameMatch = cleanLine.match(/^[\d\-*•.\s]*(.+)$/);
      const name = nameMatch ? nameMatch[1].trim() : cleanLine;

      if (name.length > 0 && name.length < 50 && !name.toLowerCase().includes('name')) {
        names.push(name);
      }

      if (names.length >= 5) break;
    }

    return names.length > 0 ? names : this.getFallbackNames();
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

  getFallbackNames(options) {
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

// Create service instance
const grokService = new GrokAICharacterService();

// API Routes
function setupAICharacterRoutes(app) {
  // Generate character concept
  app.post('/generate-concept', async (req, res) => {
    try {
      const options = req.body || {};
      const concept = await grokService.generateCharacterConcept(options);

      res.json({
        ok: true,
        concept: concept
      });
    } catch (error) {
      console.error('AI character concept generation error:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to generate character concept',
        fallback: grokService.getFallbackConcept(req.body || {})
      });
    }
  });

  // Generate character names
  app.post('/generate-names', async (req, res) => {
    try {
      const options = req.body || {};
      const names = await grokService.generateNames(options);

      res.json({
        ok: true,
        names: names
      });
    } catch (error) {
      console.error('AI name generation error:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to generate names',
        names: grokService.getFallbackNames(req.body || {})
      });
    }
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      hasApiKey: !!grokService.apiKey,
      timestamp: new Date().toISOString()
    });
  });
}

module.exports = {
  setupAICharacterRoutes,
  GrokAICharacterService,
  router: (() => {
    const express = require('express');
    const r = express.Router();
    setupAICharacterRoutes(r);
    return r;
  })()
};