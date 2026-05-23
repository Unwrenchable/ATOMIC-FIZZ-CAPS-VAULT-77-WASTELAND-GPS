import express from 'express';
import { processSurvivalEvent } from './realai/brain';
import { generateNarration } from './overseer/terminal';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.testnet' });

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Main Event Endpoint - RealAI + World + Overseer
app.post('/api/event/player-survived', async (req, res) => {
  try {
    const { playerPubkey, eventId, context } = req.body;

    if (!playerPubkey) {
      return res.status(400).json({ error: "playerPubkey is required" });
    }

    console.log(`[OVERSEER] Event received: ${eventId || 'storm-001'}`);

    // RealAI decides + acts on chain
    const result = await processSurvivalEvent({
      eventId: eventId || 'storm-001',
      playerPubkey,
      context: context || { location: "Sector 7-G" }
    });

    // Overseer narrates
    const narration = generateNarration(result);

    console.log(narration);

    res.json({
      success: true,
      playerPubkey,
      capsMinted: result.plan.capsAmount,
      nftMinted: result.plan.issueNFT,
      narration: narration,
      txCaps: result.onChainResult.capsResult.signature,
      txNft: result.onChainResult.nftResult?.mint
    });

  } catch (error: any) {
    console.error("[ERROR]", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`
VAULT-77 OVERSEER ONLINE
Listening on http://localhost:${PORT}
Treasury: F1ZZ9EyV1ouMvqDcRNoqsKVoTE9DXrhe8VoaXCbjDR7F
CAPS Mint Authority: ACTIVE
RealAI Brain: AWAKE
FIZZ ON.
  `);
});
