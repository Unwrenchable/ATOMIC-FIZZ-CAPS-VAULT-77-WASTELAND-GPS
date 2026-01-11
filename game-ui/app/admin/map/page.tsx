"use client";

import { useEffect, useState } from "react";

export default function MapTools() {
  const [locations, setLocations] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/data/locations.json");
        const json = await res.json();
        setLocations(json || []);
      } catch (e) {
        console.error("Failed to load locations:", e);
      }
    }
    load();
  }, []);

  return (
    <div>
      <h1>Map Tools</h1>
      <p style={{ opacity: 0.8 }}>
        Inspect POIs and map data from <code>locations.json</code>.
      </p>

      <div style={{ marginTop: "20px" }}>
        {locations.map((loc) => (
          <div
            key={loc.id}
            style={{
              border: "1px solid #333",
              padding: "10px",
              marginBottom: "10px",
              borderRadius: "6px"
            }}
          >
            <strong>{loc.name}</strong>
            <div>ID: {loc.id}</div>
            <div>Lat: {loc.lat}</div>
            <div>Lng: {loc.lng}</div>
            <div>Trigger Radius: {loc.triggerRadius}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
