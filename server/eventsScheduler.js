// server/eventsScheduler.js

const activeEvents = new Map();      // eventId -> { startedAt, endsAt }
const lastActivation = new Map();    // eventId -> timestamp

function nowLocalHour() {
  return new Date().getHours();
}

function canActivateEvent(ev, now = new Date()) {
  const hour = nowLocalHour();
  const { activeWindow, cooldownMinutes, flags = {} } = ev;

  if (activeWindow) {
    const start = activeWindow.startHourLocal;
    const end = activeWindow.endHourLocal;

    if (start < end) {
      if (hour < start || hour >= end) return false;
    } else {
      if (!(hour >= start || hour < end)) return false;
    }
  }

  const last = lastActivation.get(ev.id);
  if (last) {
    const diffMin = (now - last) / 60000;
    if (diffMin < cooldownMinutes) return false;
  }

  if (flags.uniquePerDay && last) {
    const lastDate = new Date(last);
    const lastDayKey = lastDate.toISOString().slice(0, 10);
    const todayKey = now.toISOString().slice(0, 10);
    if (lastDayKey === todayKey) return false;
  }

  return true;
}

function cleanupExpiredEvents(now = new Date()) {
  for (const [id, state] of activeEvents.entries()) {
    if (state.endsAt <= now) activeEvents.delete(id);
  }
}

function activateEvent(ev, now = new Date()) {
  const endsAt = new Date(now.getTime() + ev.durationMinutes * 60000);
  activeEvents.set(ev.id, { startedAt: now, endsAt });
  lastActivation.set(ev.id, now.getTime());
}

export function startEventScheduler(gameData) {
  const now = new Date();
  for (const ev of gameData.events) {
    if (canActivateEvent(ev, now)) activateEvent(ev, now);
  }

  setInterval(() => {
    const tickNow = new Date();
    cleanupExpiredEvents(tickNow);

    for (const ev of gameData.events) {
      if (!activeEvents.has(ev.id) && canActivateEvent(ev, tickNow)) {
        activateEvent(ev, tickNow);
      }
    }
  }, 60 * 1000);
}

export function getActiveEventsForPOI(gameData, poi) {
  const now = new Date();
  const result = [];

  for (const [id, state] of activeEvents.entries()) {
    const ev = gameData.eventsById.get(id);
    if (!ev) continue;
    if (state.endsAt <= now) continue;
    if (poi && ev.spawnPOI !== poi) continue;

    result.push({
      id: ev.id,
      type: ev.type,
      displayName: ev.displayName,
      description: ev.description,
      spawnPOI: ev.spawnPOI,
      rarity: ev.rarity,
      endsAt: state.endsAt,
      durationMinutes: ev.durationMinutes
    });
  }

  return result;
}

export function isEventActive(eventId) {
  return activeEvents.has(eventId);
}
