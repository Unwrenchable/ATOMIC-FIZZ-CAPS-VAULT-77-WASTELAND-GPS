#!/usr/bin/env node

/**
 * Grok-Powered Avatar Generation
 * Uses xAI's Grok API to help generate Fallout-style avatars
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

class GrokAvatarGenerator {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.x.ai/v1';
  }

  async makeGrokRequest(prompt, maxTokens = 1000) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        model: "grok-beta",
        stream: false,
        temperature: 0.7
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

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.choices && response.choices[0]) {
              resolve(response.choices[0].message.content);
            } else {
              reject(new Error('Invalid Grok API response'));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  async generateAvatarPrompt(characterType) {
    const basePrompt = `You are an expert Fallout game character designer. Create a detailed, realistic prompt for generating a ${characterType} character portrait that would fit perfectly in the Fallout universe.

Requirements:
- Age-appropriate appearance with authentic wasteland weathering
- Realistic facial features, scars, and imperfections
- Practical post-apocalyptic clothing and accessories
- Square format (256x256 pixels)
- Photorealistic style, NOT cartoon or anime
- Include specific details about: face shape, skin condition, hair, eyes, clothing, expression, and any scars/tattoos

Character type: ${characterType}

Generate a complete Midjourney/DALL-E prompt that would create an authentic Fallout character portrait.`;

    try {
      const grokResponse = await this.makeGrokRequest(basePrompt);
      return grokResponse.trim();
    } catch (error) {
      console.error('Grok API error:', error.message);
      return this.getFallbackPrompt(characterType);
    }
  }

  getFallbackPrompt(characterType) {
    const fallbacks = {
      'weathered male survivor': "A weathered male wasteland survivor in his 40s, rugged face with scars and stubble, wearing remnants of a vault suit, dirty blonde hair, piercing blue eyes, post-apocalyptic grit, realistic portrait, Fallout style, high detail, 256x256",
      'female wasteland trader': "Middle-aged female wasteland trader in her 30s, braided dark hair, wearing goggles on head, leather armor with trader patches, confident expression, realistic portrait, Fallout caravan merchant, authentic wasteland survivor, 256x256",
      'young male scout': "Young male wasteland scout in his 20s, buzzcut brown hair, radiation burn scars on face, wearing pre-war leather jacket, determined expression, realistic portrait, Fallout universe, authentic wasteland survivor, 256x256",
      'mature female raider': "Mature female raider in her 50s, mohawk hairstyle dyed red, facial tattoos, wearing power armor shoulder pieces, fierce expression, realistic portrait, Fallout raider aesthetic, post-apocalyptic warrior, 256x256",
      'elderly male vault dweller': "Elderly male vault dweller in his 60s, gray hair and beard, wearing cracked glasses and lab coat, worried expression, realistic portrait, Fallout vault aesthetic, post-apocalyptic scientist, 256x256"
    };

    return fallbacks[characterType] || "Realistic Fallout wasteland survivor portrait, weathered appearance, authentic post-apocalyptic style, 256x256";
  }

  async generateAllPrompts() {
    const characterTypes = [
      'weathered male survivor',
      'female wasteland trader',
      'young male scout',
      'mature female raider',
      'elderly male vault dweller'
    ];

    console.log('🤖 Generating AI prompts with Grok...\n');

    const prompts = {};
    for (const type of characterTypes) {
      console.log(`Generating prompt for: ${type}`);
      const prompt = await this.generateAvatarPrompt(type);
      prompts[type] = prompt;
      console.log(`✅ Generated: ${prompt.substring(0, 80)}...\n`);
    }

    return prompts;
  }

  savePromptsToFile(prompts) {
    const output = `# Grok-Generated Fallout Avatar Prompts
# Generated on ${new Date().toISOString()}

${Object.entries(prompts).map(([type, prompt], index) => {
  const avatarNum = String(index + 1).padStart(3, '0');
  return `## Avatar ${avatarNum}: ${type.charAt(0).toUpperCase() + type.slice(1)}
**Prompt:**
\`\`\`
${prompt}
\`\`\`

**Midjourney Command:**
\`\`\`
/imagine prompt: ${prompt} --ar 1:1 --v 6
\`\`\`

**DALL-E Prompt:**
\`\`\`
${prompt.replace('--ar 1:1 --v 6', '').replace('256x256', 'square format')}
\`\`\`
`;
}).join('\n')}

## Usage Instructions

1. **Copy the prompt** for your desired character
2. **Use with Midjourney** (recommended):
   - Paste after \`/imagine prompt:\`
   - Add \`--ar 1:1 --v 6\` for square format and latest model

3. **Use with DALL-E**:
   - Paste directly into ChatGPT with DALL-E selected
   - Remove Midjourney-specific parameters

4. **Save generated images** as \`avatar_001.png\`, \`avatar_002.png\`, etc.

## Tips for Best Results
- If results look too cartoonish, add "hyper-realistic" or "photorealistic"
- For more authentic Fallout feel, add "in the style of Fallout 4 character portraits"
- Generate 2-3 variations and pick the best one
`;

    fs.writeFileSync('grok-generated-prompts.md', output);
    console.log('📄 Saved prompts to: grok-generated-prompts.md');
  }

  async run() {
    if (!this.apiKey) {
      console.log('❌ No Grok API key provided');
      console.log('Usage: node grok-avatars.js YOUR_API_KEY');
      process.exit(1);
    }

    console.log('🚀 Grok Avatar Prompt Generator');
    console.log('================================');

    try {
      const prompts = await this.generateAllPrompts();
      this.savePromptsToFile(prompts);

      console.log('\n🎉 Success! Generated AI prompts using Grok.');
      console.log('📖 Check grok-generated-prompts.md for your custom prompts');
      console.log('🎨 Use these with Midjourney or DALL-E for authentic Fallout avatars');

    } catch (error) {
      console.error('❌ Error:', error.message);
      console.log('\n💡 Falling back to standard prompts...');
      const fallbackPrompts = {};
      const types = ['weathered male survivor', 'female wasteland trader', 'young male scout', 'mature female raider', 'elderly male vault dweller'];
      types.forEach(type => {
        fallbackPrompts[type] = this.getFallbackPrompt(type);
      });
      this.savePromptsToFile(fallbackPrompts);
    }
  }
}

// Check for API key argument
const apiKey = process.argv[2];
if (!apiKey) {
  console.log('🤖 Grok Avatar Generator');
  console.log('Usage: node grok-avatars.js YOUR_GROK_API_KEY');
  console.log('');
  console.log('Get your API key from: https://console.x.ai/');
  console.log('');
  console.log('Example:');
  console.log('node grok-avatars.js xai-1234567890abcdef...');
  process.exit(1);
}

const generator = new GrokAvatarGenerator(apiKey);
generator.run().catch(console.error);