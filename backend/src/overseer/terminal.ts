export function generateNarration(result: any): string {
  const { plan, onChainResult } = result;
  return `
VAULT-77 OVERSEER LOG // ${new Date().toISOString()}
ANOMALY: ${plan.loreSeed}
DISPENSING: ${plan.capsAmount} CAPS
ISSUING: 1x ${plan.nftName}
TX_CAPS: ${onChainResult.capsResult.signature}
TX_NFT : ${onChainResult.nftResult?.mint || 'QUEUED'}
STATUS: The Wastes remember. Carbonation levels rising.
FIZZ ON.
  `.trim();
}
