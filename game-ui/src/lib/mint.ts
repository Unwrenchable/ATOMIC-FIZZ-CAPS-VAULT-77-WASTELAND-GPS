import { redis } from "./redis";

export async function mintItem() {
  const id = "item_" + Math.random().toString(36).slice(2);
  await redis.set(`mint:${id}`, Date.now());
  return id;
}
