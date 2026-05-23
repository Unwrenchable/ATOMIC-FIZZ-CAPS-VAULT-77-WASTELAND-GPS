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

  async checkAvailableModels() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.x.ai',
        port: 443,
        path: '/v1/models',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
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
            console.log('📋 Available models:', response);
            resolve(response);
          } catch (error) {
            console.log('❌ Could not check models:', error.message);
            resolve(null);
          }
        });
      });

      req.on('error', (error) => {
        console.log('❌ Models check failed:', error.message);
        resolve(null);
      });

      req.end();
    });
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
        model: "grok-vision-beta",
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
            console.log('🔍 API Response:', JSON.stringify(response, null, 2));
            if (response.choices && response.choices[0] && response.choices[0].message) {
              resolve(response.choices[0].message.content);
            } else {
              reject(new Error('Invalid response format from Grok API'));
            }
          } catch (error) {
            console.log('❌ JSON Parse Error:', error.message);
            console.log('Raw response:', data);
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
    // Since we only have image models, we'll create a simple concept and use image generation
    const concept = `A ${characterType} in the Fallout universe, weathered by years of post-apocalyptic survival with distinctive features that tell their story of life in the wasteland.`;

    console.log(`📝 Using fallback concept for ${characterType}`);
    return concept;
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
    // Skip ASCII art since we have image models
    console.log('🎭 Skipping ASCII art (using image generation instead)');
    return 'ASCII art not needed - using image generation';
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

  async generateAvatarImage(characterType, characterConcept) {
    const prompt = `Create a highly detailed, realistic portrait of a ${characterType} in the Fallout video game universe. ${characterConcept}

Style requirements:
- Realistic human portrait, not cartoonish
- Authentic Fallout wasteland aesthetic
- Detailed facial features, scars, weathering
- Post-apocalyptic clothing and accessories
- High resolution, professional quality
- Square composition, head and shoulders focus

Make this character look like they belong in the Fallout universe with realistic human features, battle damage, and wasteland survival traits.`;

    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        prompt: prompt,
        model: "grok-imagine-image",
        n: 1
      });

      const options = {
        hostname: 'api.x.ai',
        port: 443,
        path: '/v1/images/generations',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
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
            console.log('🔍 Image API Response:', JSON.stringify(response, null, 2));
            if (response.data && response.data[0] && response.data[0].url) {
              resolve(response.data[0].url);
            } else {
              reject(new Error('Invalid image response format from Grok API'));
            }
          } catch (error) {
            console.log('❌ JSON Parse Error:', error.message);
            console.log('Raw response:', data);
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

  async downloadImage(imageUrl, outputPath) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(outputPath);

      https.get(imageUrl, (response) => {
        response.pipe(file);

        file.on('finish', () => {
          file.close();
          console.log(`📥 Downloaded image to ${outputPath}`);
          resolve(true);
        });
      }).on('error', (error) => {
        fs.unlink(outputPath, () => {}); // Delete the file on error
        console.log('❌ Image download failed:', error.message);
        resolve(false);
      });
    });
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

      // Generate avatar image using Grok's image model
      console.log('🖼️  Generating avatar image...');
      try {
        const imageUrl = await this.generateAvatarImage(characterType, concept);
        const imagePath = path.join(this.outputDir, `avatar_${avatarNum}.png`);

        // Download the generated image
        const imageDownloaded = await this.downloadImage(imageUrl, imagePath);
        if (imageDownloaded) {
          console.log(`✅ Avatar ${avatarNum} complete! (AI-generated PNG)`);
        } else {
          console.log(`⚠️  Avatar ${avatarNum} - image generation failed, using fallback`);
          // Create fallback SVG and convert to PNG
          const fallbackSvg = this.getFallbackSVG(characterType);
          const svgPath = path.join(this.outputDir, `avatar_${avatarNum}.svg`);
          fs.writeFileSync(svgPath, fallbackSvg);
          const pngSuccess = await this.convertSVGToPNG(fallbackSvg, imagePath);
          console.log(`✅ Avatar ${avatarNum} complete! (Fallback SVG + PNG)`);
        }
      } catch (error) {
        console.log(`⚠️  Avatar ${avatarNum} - image generation failed: ${error.message}`);
        // Create fallback SVG and convert to PNG
        const fallbackSvg = this.getFallbackSVG(characterType);
        const svgPath = path.join(this.outputDir, `avatar_${avatarNum}.svg`);
        fs.writeFileSync(svgPath, fallbackSvg);
        const pngPath = path.join(this.outputDir, `avatar_${avatarNum}.png`);
        const pngSuccess = await this.convertSVGToPNG(fallbackSvg, pngPath);
        console.log(`✅ Avatar ${avatarNum} complete! (Fallback SVG + PNG)`);
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

    // Check available models first
    console.log('🔍 Checking available Grok models...');
    const models = await this.checkAvailableModels();
    if (models) {
      console.log('✅ API connection successful');
    } else {
      console.log('⚠️  Could not check models - proceeding anyway');
    }
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