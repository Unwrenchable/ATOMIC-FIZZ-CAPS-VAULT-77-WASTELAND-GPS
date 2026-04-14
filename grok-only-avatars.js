#!/usr/bin/env node

/**
 * Grok-Only Avatar Generation System
 * Uses ONLY your Grok API key to create authentic Fallout avatars
 * No external services required - maximizes your existing subscription
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

class GrokOnlyAvatarGenerator {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.outputDir = path.join(__dirname, 'public', 'assets', 'avatars-grok');

    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async makeGrokRequest(prompt, maxTokens = 2000) {
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
        temperature: 0.8, // Higher creativity for character design
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

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.choices && response.choices[0] && response.choices[0].message) {
              resolve(response.choices[0].message.content);
            } else {
              reject(new Error('Invalid response format from Grok API'));
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

  async generateCharacterConcept(characterType) {
    const prompt = `You are a master Fallout game character designer with deep knowledge of the Fallout universe, character archetypes, and post-apocalyptic aesthetics. Create a detailed character concept for a ${characterType} in the Fallout universe.

Requirements:
- Age-appropriate appearance with authentic wasteland weathering
- Detailed physical description including face, hair, eyes, build
- Specific scars, tattoos, or distinctive features that tell a story
- Clothing and equipment that reflects their background and survival
- Personality traits evident in their appearance and expression
- Backstory elements suggested by their physical condition

Character Type: ${characterType}

Provide a rich, detailed character description that could be used to create an authentic Fallout character portrait. Focus on visual details that would make this character feel real and lived-in.`;

    try {
      const concept = await this.makeGrokRequest(prompt, 1000);
      return concept.trim();
    } catch (error) {
      console.error(`Failed to generate concept for ${characterType}:`, error.message);
      return this.getFallbackConcept(characterType);
    }
  }

  getFallbackConcept(characterType) {
    const fallbacks = {
      'weathered male survivor': `A weathered male vault dweller survivor in his early 40s, with deep worry lines etched across his forehead from years of stress and radiation exposure. His face bears a jagged scar running from his left temple down to his jawline, a reminder of a close encounter with raiders. Salt-and-pepper stubble covers his strong jaw, and his piercing blue eyes reflect both wisdom and wariness. He wears tattered remnants of a vault suit, patched with leather and scrap metal, showing signs of extensive modification for survival in the wasteland.`,
      'female wasteland trader': `A middle-aged female wasteland trader in her late 30s, with braided dark hair streaked with gray from years of exposure to harsh elements. Her face shows the marks of a life spent negotiating dangerous trade routes - a small scar above her right eyebrow and weathered skin that speaks of too many nights under the stars. She wears practical leather armor reinforced with metal plates, and a pair of scratched goggles pushed up on her forehead. Her confident expression and calloused hands suggest she's as comfortable with a rifle as she is with barter.`,
      'young male scout': `A young male wasteland scout in his early 20s, with a buzzcut of brown hair and radiation burn scars visible on his neck and left cheek. His face is angular and determined, with sharp blue eyes that constantly scan for threats. He wears a pre-war leather jacket that's been modified with additional pockets and reinforced stitching, along with fingerless gloves that show the callouses of someone who's learned to survive by their wits and speed rather than brute force.`,
      'mature female raider': `A mature female raider in her early 50s, with a striking red mohawk that defies the gray creeping into her dark roots. Her face is a map of survival - tribal tattoos across her cheeks, a broken nose that's never been set properly, and piercing green eyes that burn with fierce determination. She wears power armor shoulder pieces scavenged from fallen Brotherhood knights, reinforced with spikes and additional plating. Her expression is one of barely contained aggression, tempered by the wisdom of someone who's lived through more firefights than she can count.`,
      'elderly male vault dweller': `An elderly male vault dweller in his late 60s, with thinning gray hair and a neatly trimmed beard that's more salt than pepper. His face shows the weight of years spent in intellectual pursuits followed by the harsh realities of surface life - wire-rimmed glasses with one cracked lens, and deep worry lines that speak of constant anxiety. He wears a once-white lab coat now stained and patched, with a vault suit visible underneath. His expression is one of quiet determination mixed with the haunted look of someone who's seen too much of the world's cruelty.`
    };

    return fallbacks[characterType] || `A ${characterType} in the Fallout universe, weathered by years of post-apocalyptic survival with distinctive features that tell their story of life in the wasteland.`;
  }

  async generateASCIIArt(characterConcept) {
    const prompt = `Based on this Fallout character description, create an ASCII art portrait that captures their essence:

${characterConcept}

Create a simple but evocative ASCII art representation (about 15-20 lines) that shows:
- Basic facial structure
- Key distinctive features (scars, hair, expression)
- Some indication of clothing or accessories
- A sense of their personality through the art

Keep it simple but recognizable as a character portrait. Use standard ASCII characters.`;

    try {
      const ascii = await this.makeGrokRequest(prompt, 500);
      return ascii.trim();
    } catch (error) {
      console.error('Failed to generate ASCII art:', error.message);
      return this.getFallbackASCII();
    }
  }

  getFallbackASCII() {
    return `
     .-'''''-.
    /         \\
   |  O   O   |
   |    ^     |
   |  \\___/  |
    \\_____/
     |   |
    /     \\
   |       |
   |  [ ]  |
    \\_____/
`;
  }

  async generateSVGAvatar(characterConcept, characterType) {
    const prompt = `You are an expert SVG designer specializing in Fallout-style character portraits. Create an SVG avatar based on this character description:

${characterConcept}

Requirements:
- 256x256 pixel viewBox
- Authentic Fallout color palette (muted, weathered tones)
- Simple but recognizable character features
- Include distinctive elements from the description
- Scalable vector graphics
- Clean, game-ready style

Generate ONLY the SVG code, no explanations or markdown. Start with <svg> and end with </svg>. Use appropriate colors for skin, hair, clothing, and background.`;

    try {
      const svgCode = await this.makeGrokRequest(prompt, 1500);

      // Clean up the response to extract just SVG
      const svgMatch = svgCode.match(/<svg[\s\S]*<\/svg>/);
      if (svgMatch) {
        return svgMatch[0];
      } else {
        throw new Error('No valid SVG found in response');
      }
    } catch (error) {
      console.error(`Failed to generate SVG for ${characterType}:`, error.message);
      return this.getFallbackSVG(characterType);
    }
  }

  getFallbackSVG(characterType) {
    // Create a simple algorithmic SVG based on character type
    const colors = {
      'weathered male survivor': { skin: '#D2B48C', hair: '#8B4513', clothes: '#696969' },
      'female wasteland trader': { skin: '#DEB887', hair: '#2F1B14', clothes: '#8B7355' },
      'young male scout': { skin: '#F4A460', hair: '#654321', clothes: '#8B4513' },
      'mature female raider': { skin: '#CD853F', hair: '#DC143C', clothes: '#2F2F2F' },
      'elderly male vault dweller': { skin: '#FAF0E6', hair: '#808080', clothes: '#F5F5F5' }
    };

    const color = colors[characterType] || { skin: '#D2B48C', hair: '#8B4513', clothes: '#696969' };

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
      <rect width="256" height="256" fill="#2F2F2F"/>
      <circle cx="128" cy="100" r="60" fill="${color.skin}"/>
      <circle cx="110" cy="85" r="8" fill="#000"/>
      <circle cx="146" cy="85" r="8" fill="#000"/>
      <ellipse cx="128" cy="110" rx="15" ry="8" fill="#000"/>
      <path d="M80 140 Q128 180 176 140 L176 200 L80 200 Z" fill="${color.clothes}"/>
      <circle cx="128" cy="70" r="25" fill="${color.hair}"/>
      <text x="128" y="240" text-anchor="middle" fill="#0F0" font-size="12">FALLOUT</text>
    </svg>`;
  }

  async convertSVGToPNG(svgContent, outputPath) {
    // Try to convert SVG to PNG if ImageMagick is available
    const tempSvgPath = outputPath.replace('.png', '_temp.svg');

    try {
      fs.writeFileSync(tempSvgPath, svgContent);

      const { execSync } = require('child_process');
      execSync(`convert "${tempSvgPath}" -resize 256x256! "${outputPath}"`, { stdio: 'pipe' });

      // Clean up temp file
      fs.unlinkSync(tempSvgPath);
      return true;
    } catch (error) {
      // ImageMagick not available or conversion failed
      console.log('⚠️  PNG conversion not available - SVG avatars ready');
      return false;
    }
  }

  async generateAllAvatars() {
    const characterTypes = [
      'weathered male survivor',
      'female wasteland trader',
      'young male scout',
      'mature female raider',
      'elderly male vault dweller'
    ];

    console.log('🤖 Generating Fallout avatars with Grok AI...');
    console.log('=' .repeat(50));

    for (let i = 0; i < characterTypes.length; i++) {
      const characterType = characterTypes[i];
      const avatarNum = String(i + 1).padStart(3, '0');

      console.log(`\n🎨 Generating Avatar ${avatarNum}: ${characterType}`);

      // Generate character concept
      console.log('📝 Creating character concept...');
      const concept = await this.generateCharacterConcept(characterType);
      fs.writeFileSync(path.join(this.outputDir, `concept_${avatarNum}.txt`), concept);

      // Generate ASCII art
      console.log('🎭 Creating ASCII art...');
      const ascii = await this.generateASCIIArt(concept);
      fs.writeFileSync(path.join(this.outputDir, `ascii_${avatarNum}.txt`), ascii);

      // Generate SVG avatar
      console.log('🎨 Designing SVG avatar...');
      const svg = await this.generateSVGAvatar(concept, characterType);
      const svgPath = path.join(this.outputDir, `avatar_${avatarNum}.svg`);
      fs.writeFileSync(svgPath, svg);

      // Try to convert to PNG
      console.log('🖼️  Converting to PNG...');
      const pngPath = path.join(this.outputDir, `avatar_${avatarNum}.png`);
      const pngSuccess = await this.convertSVGToPNG(svg, pngPath);

      if (pngSuccess) {
        console.log(`✅ Avatar ${avatarNum} complete! (SVG + PNG)`);
      } else {
        console.log(`✅ Avatar ${avatarNum} complete! (SVG only)`);
      }
    }
  }

  async run() {
    if (!this.apiKey) {
      console.log('❌ No Grok API key provided');
      console.log('Usage: node grok-only-avatars.js YOUR_GROK_API_KEY');
      console.log('');
      console.log('Get your API key from: https://console.x.ai/');
      console.log('Example: node grok-only-avatars.js xai-1234567890abcdef...');
      process.exit(1);
    }

    console.log('🚀 Grok-Only Avatar Generation System');
    console.log('Using ONLY your Grok API key - no extra services!');
    console.log('');

    try {
      await this.generateAllAvatars();

      console.log('\n🎉 Generation Complete!');
      console.log('📁 Check your avatars in: public/assets/avatars-grok/');
      console.log('');
      console.log('📋 Next steps:');
      console.log('1. Review the generated concepts and ASCII art');
      console.log('2. Run: ./integrate-grok-avatars.sh');
      console.log('3. Test: open test-raster-avatars.html');
      console.log('');
      console.log('🤖 All avatars created using only your Grok subscription!');

    } catch (error) {
      console.error('❌ Generation failed:', error.message);
      console.log('\n💡 Check your API key and internet connection');
      process.exit(1);
    }
  }
}

// Run the generator
const apiKey = process.argv[2];
const generator = new GrokOnlyAvatarGenerator(apiKey);
generator.run().catch(console.error);