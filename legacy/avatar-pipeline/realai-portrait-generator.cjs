#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

class RealAIPortraitGenerator {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.outputDir = path.join(__dirname, 'public', 'assets', 'portraits-realai');

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  buildPrompt(characterType, characterConcept) {
    return `
Create a stylized Fallout-inspired wasteland portrait in the Atomic Fizz Caps visual style.

Character: ${characterType}
Concept: ${characterConcept}

STYLE REQUIREMENTS:
- Stylized concept art, NOT photorealistic
- Neon green Pip-Boy glow around edges
- Subtle CRT distortion and scanlines
- High contrast shadows and gritty shading
- Slight grain and vignette
- Thick outlines around face and clothing
- Muted color palette except green highlights
- Retro-futuristic wasteland aesthetic
- Bust-up framing (head + shoulders)
- Centered composition
- 4:5 portrait aspect ratio
- Should look like it belongs inside a Pip-Boy UI screen

AVOID:
- Modern clothing
- Clean backgrounds
- Photorealistic skin
- Bright saturated colors
`;
  }

  async generateImage(characterType, characterConcept, outputPath) {
    const prompt = this.buildPrompt(characterType, characterConcept);

    const postData = JSON.stringify({
      model: "image",
      prompt: prompt,
      size: "1024x1024"
    });

    const options = {
      hostname: 'localhost',
      port: 8000,
      path: '/v1/images',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';

        res.on('data', chunk => data += chunk);

        res.on('end', () => {
          try {
            const response = JSON.parse(data);

            if (!response.data || !response.data[0] || !response.data[0].b64_json) {
              return reject(new Error("RealAI did not return b64_json"));
            }

            const buffer = Buffer.from(response.data[0].b64_json, 'base64');
            fs.writeFileSync(outputPath, buffer);

            console.log(`📥 Saved portrait → ${outputPath}`);
            resolve(true);

          } catch (err) {
            console.log("❌ JSON parse error:", err.message);
            console.log("Raw response:", data);
            reject(err);
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  async run() {
    const characters = [
      { type: "weathered male survivor", concept: "A hardened wasteland wanderer with scars and grit." },
      { type: "female wasteland trader", concept: "A savvy merchant who travels dangerous routes." },
      { type: "young male scout", concept: "A fast-moving recon scout with sharp instincts." },
      { type: "mature female raider", concept: "A brutal raider matriarch with battle trophies." },
      { type: "elderly male vault dweller", concept: "A wise old vault scientist forced into the wasteland." }
    ];

    console.log("🚀 RealAI Portrait Generator");
    console.log("Generating Atomic Fizz Caps style portraits...\n");

    for (let i = 0; i < characters.length; i++) {
      const npc = characters[i];
      const num = String(i + 1).padStart(3, '0');
      const outputPath = path.join(this.outputDir, `portrait_${num}.png`);

      console.log(`🎨 Generating portrait ${num}: ${npc.type}`);

      try {
        await this.generateImage(npc.type, npc.concept, outputPath);
      } catch (err) {
        console.log(`⚠️ Failed to generate portrait ${num}:`, err.message);
      }
    }

    console.log("\n🎉 All portraits generated!");
    console.log("📁 Output folder: public/assets/portraits-realai/");
  }
}

const apiKey = process.argv[2] || "local";
new RealAIPortraitGenerator(apiKey).run();
