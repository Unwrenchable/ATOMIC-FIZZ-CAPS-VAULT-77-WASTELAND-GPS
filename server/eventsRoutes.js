// server/eventsRoutes.js

import express from "express";
import { rollEventLoot, rollRandomInt } from "./lootRoller.js";
import { getActiveEventsForPOI, isEventActive } from "./eventsScheduler.js";

export function createEventsRouter(gameData) {
  const router = express.Router();

  router.get("/active", (req, res) => {
    const poi = req.query.poi;
    const events = getActiveEventsForPOI(gameData, poi);
    res.json({ events });
  });

  router.post("/resolve", async (req, res) => {
    const { eventId, playerId, poi } = req.body || {};

    if (!eventId || !playerId) {
      return res.status(400).json({ error: "eventId and playerId required" });
    }

    const ev = gameData.eventsById.get(eventId);
    if (!ev) return res.status(404).json({ error: "Event not found" });
    if (!isEventActive(eventId)) {
      return res.status(400).json({ error: "Event not active" });
    }

    if (poi && ev.spawnPOI !== poi) {
      return res.status(400).json({ error: "Not at event location" });
    }

    const rewardsConfig = ev.rewards || {};
    const items = ev.rewards?.lootTableId
      ? rollEventLoot(gameData, ev.rewards.lootTableId)
      : [];

    const fizzCaps = rollRandomInt(
      rewardsConfig.fizzCapsMin || 0,
      rewardsConfig.fizzCapsMax || 0
    );

    const xp = rollRandomInt(
      rewardsConfig.xpMin || 0,
      rewardsConfig.xpMax || 0
    );

    res.json({
      eventId: ev.id,
      rewards: {
        fizzCaps,
        xp,
        items
      }
    });
  });

  return router;
}
