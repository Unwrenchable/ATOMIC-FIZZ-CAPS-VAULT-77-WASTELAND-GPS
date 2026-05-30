import { mintCAPS, mintFizzCapNFT } from '../solana/actions';

export async function processSurvivalEvent(event: any) {
  console.log(`[REALAI] Processing event: ${event.eventId} for ${event.playerPubkey}`);

  const plan = {
    capsAmount: 50,
    issueNFT: true,
    nftName: "Fizz Cap - Storm Survivor #" + Date.now().toString().slice(-4),
    loreSeed: `Subject survived radiation storm in ${event.context?.location || 'unknown sector'}.`
  };

  // RealAI executes on world
  const capsResult = await mintCAPS(event.playerPubkey, plan.capsAmount);
  
  let nftResult = null;
  if (plan.issueNFT) {
    nftResult = await mintFizzCapNFT(event.playerPubkey, plan.nftName, plan.loreSeed);
  }

  return {
    plan,
    onChainResult: { capsResult, nftResult }
  };
}
