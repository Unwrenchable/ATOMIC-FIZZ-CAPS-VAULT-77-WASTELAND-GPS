# 🤖 **Using Your Grok API Key for Avatar Generation**

## 🎯 **Grok Can Help In Two Ways:**

### **Method 1: Grok-Generated Custom Prompts (Text-Only)**
Grok can create **hyper-optimized prompts** for Midjourney/DALL-E that are tailored specifically for Fallout aesthetics.

### **Method 2: Grok-Assisted Workflow (If Image Gen Available)**
If xAI has added image generation to Grok, you could potentially generate images directly.

---

## 🚀 **Method 1: Custom Prompt Generation (Recommended)**

### **Run the Grok Script:**
```bash
# Replace YOUR_API_KEY with your actual Grok API key
node grok-avatars.js YOUR_GROK_API_KEY
```

### **What It Does:**
- Uses Grok to analyze Fallout character design principles
- Generates 5 custom prompts optimized for authentic wasteland aesthetics
- Creates `grok-generated-prompts.md` with ready-to-use prompts

### **Example Output:**
```
## Avatar 001: Weathered male survivor
**Prompt:**
A battle-hardened male survivor in his mid-40s with deep-set worry lines,
radiation scars across his left cheek, unkempt stubble salt-and-pepper beard,
wearing a patched vault suit with leather reinforcements, piercing steel-gray
eyes that have seen too much, weathered skin with premature aging from
radiation exposure, Fallout 4 character portrait style, hyper-realistic,
post-apocalyptic grit, 256x256 square format
```

### **Then Use With Midjourney/DALL-E:**
```bash
# Copy the Grok-generated prompt
/imagine prompt: [paste grok prompt here] --ar 1:1 --v 6
```

---

## 🎨 **Method 2: Direct Image Generation (If Available)**

### **Check Grok's Image Capabilities:**
```bash
# Test if Grok has image generation
curl -X POST "https://api.x.ai/v1/images/generations" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "test image generation",
    "n": 1,
    "size": "256x256"
  }'
```

### **If Image Gen Works:**
```bash
# Use the script to generate directly
node grok-image-gen.js YOUR_API_KEY
```

### **Fallback:** Use Grok for prompt optimization only.

---

## 🔑 **Getting Your Grok API Key**

1. **Visit**: [console.x.ai](https://console.x.ai/)
2. **Sign in** with your xAI account
3. **Navigate** to API Keys section
4. **Create** a new API key
5. **Copy** the key (format: `xai-...`)

---

## 📋 **Complete Workflow with Grok**

### **Step 1: Generate Custom Prompts**
```bash
node grok-avatars.js YOUR_GROK_API_KEY
```

### **Step 2: Review Generated Prompts**
```bash
cat grok-generated-prompts.md
```

### **Step 3: Use Best Prompts with AI Image Generator**
- **Midjourney**: Copy prompts after `/imagine prompt:`
- **DALL-E**: Paste prompts directly in ChatGPT

### **Step 4: Download & Integrate**
```bash
# Place PNGs in downloads/ folder
./integrate-avatars.sh
```

---

## 💡 **Why Grok Helps**

### **Grok's Advantages:**
- **Deep Fallout Lore Knowledge**: Trained on extensive game data
- **Creative Prompt Engineering**: Can craft nuanced, detailed prompts
- **Authentic Character Design**: Understands wasteland survivor archetypes
- **Iterative Refinement**: Can improve prompts based on results

### **Example Grok Prompt Engineering:**
```
Input: "Create a weathered male survivor prompt"
Grok Output: Detailed 50-word prompt with specific scars, clothing details,
facial features, and Fallout-specific terminology
```

---

## 🧪 **Testing Grok Integration**

### **Test API Connection:**
```bash
curl -X POST "https://api.x.ai/v1/chat/completions" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello, test Fallout avatar prompt"}],
    "model": "grok-beta"
  }'
```

### **Expected Response:**
```json
{
  "choices": [{
    "message": {
      "content": "A grizzled wasteland survivor with radiation scars..."
    }
  }]
}
```

---

## 🎯 **Best Results Strategy**

1. **Use Grok** to generate custom prompts (✅ Works now)
2. **Use Midjourney/DALL-E** for actual image generation (✅ Proven)
3. **Combine** Grok's Fallout expertise with dedicated AI image tools

**Result**: Hyper-authentic Fallout character portraits with AI assistance! 🤖🎨

---

## 📚 **Files Created:**
- `grok-avatars.js` - Script to generate custom prompts
- `grok-generated-prompts.md` - Your custom AI prompts (after running script)

**Ready to generate Fallout avatars with Grok's help?** 🚀