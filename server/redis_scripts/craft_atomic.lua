-- craft_atomic.lua
-- Atomic Redis Lua script for crafting:
-- KEYS:
--   1 = playerKey (e.g., "player:<wallet>")
--   2 = cdKey     (e.g., "craft:cd:<wallet>:<recipeId>")
-- ARGV:
--   1 = recipeJson (JSON string: { materials:[{itemId,qty}], output:{itemId,qty}, cooldownSeconds })
--   2 = amount     (integer)
--   3 = nowTs      (ms timestamp)
-- Returns JSON string: { ok=true, inventory={...} } or { ok=false, error="...", missing="itemId" }

local cjson = cjson
local playerKey = KEYS[1]
local cdKey = KEYS[2]
local recipe = cjson.decode(ARGV[1])
local amount = tonumber(ARGV[2]) or 1

-- Validate amount
if amount <= 0 then
  return cjson.encode({ ok = false, error = "invalid_amount" })
end

-- Check cooldown
if redis.call("GET", cdKey) then
  return cjson.encode({ ok = false, error = "cooldown" })
end

-- Load player data
local raw = redis.call("GET", playerKey)
local player = {}
if raw and raw ~= false then
  player = cjson.decode(raw)
else
  player = { inventory = {} }
end
if not player.inventory then player.inventory = {} end

-- Ensure recipe materials table exists
local materials = recipe.materials or {}
for i = 1, #materials do
  local m = materials[i]
  if not m.itemId or not m.qty then
    return cjson.encode({ ok = false, error = "invalid_recipe" })
  end
end

-- Check materials availability
for i = 1, #materials do
  local m = materials[i]
  local need = tonumber(m.qty) * amount
  local have = tonumber(player.inventory[m.itemId] or 0)
  if have < need then
    return cjson.encode({ ok = false, error = "insufficient", missing = m.itemId })
  end
end

-- Deduct materials
for i = 1, #materials do
  local m = materials[i]
  local need = tonumber(m.qty) * amount
  local cur = tonumber(player.inventory[m.itemId] or 0) - need
  if cur <= 0 then
    player.inventory[m.itemId] = nil
  else
    player.inventory[m.itemId] = cur
  end
end

-- Add output
local out = recipe.output or { itemId = "unknown", qty = 1 }
local outQty = (tonumber(out.qty) or 1) * amount
player.inventory[out.itemId] = (tonumber(player.inventory[out.itemId] or 0) + outQty)

-- Persist player
redis.call("SET", playerKey, cjson.encode(player))

-- Set cooldown if present
if recipe.cooldownSeconds and tonumber(recipe.cooldownSeconds) > 0 then
  redis.call("SET", cdKey, "1", "EX", tonumber(recipe.cooldownSeconds))
end

-- Return success and updated inventory
return cjson.encode({ ok = true, inventory = player.inventory })
