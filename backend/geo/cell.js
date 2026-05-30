"use strict";

const CELL_SIZE_DEGREES = 0.0005;

function normalizeCoordinate(value, label, min, max) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
    throw new Error(`${label} is out of range.`);
  }

  return numeric;
}

function quantizeToCellId(lat, lng, cellSizeDegrees = CELL_SIZE_DEGREES) {
  const latitude = normalizeCoordinate(lat, "gps.lat", -90, 90);
  const longitude = normalizeCoordinate(lng, "gps.lng", -180, 180);
  const safeCellSize = Number(cellSizeDegrees);

  if (!Number.isFinite(safeCellSize) || safeCellSize <= 0) {
    throw new Error("Cell size must be a positive number.");
  }

  const latBucket = Math.floor((latitude + 90) / safeCellSize);
  const lngBucket = Math.floor((longitude + 180) / safeCellSize);

  return `cell-${latBucket.toString(36)}-${lngBucket.toString(36)}`;
}

module.exports = {
  CELL_SIZE_DEGREES,
  quantizeToCellId
};
