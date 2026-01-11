"use client";

import React from "react";

interface NFT {
  mint: string;
  name: string;
  image: string | null;
  attributes: any[];
}

export default function NFTGrid({ nfts }: { nfts: NFT[] }) {
  if (!nfts || nfts.length === 0) {
    return (
      <div style={{ padding: 20, opacity: 0.7 }}>
        <p>No NFTs found for this wallet.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: "20px",
        padding: "20px"
      }}
    >
      {nfts.map((nft) => (
        <div
          key={nft.mint}
          style={{
            background: "#111",
            border: "1px solid #333",
            borderRadius: "8px",
            padding: "12px",
            color: "#e0e0e0"
          }}
        >
          {/* NFT Image */}
          {nft.image ? (
            <img
              src={nft.image}
              alt={nft.name}
              style={{
                width: "100%",
                height: "160px",
                objectFit: "cover",
                borderRadius: "6px",
                marginBottom: "10px"
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "160px",
                background: "#222",
                borderRadius: "6px",
                marginBottom: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0.5
              }}
            >
              No Image
            </div>
          )}

          {/* NFT Name */}
          <div style={{ fontWeight: "bold", marginBottom: "6px" }}>
            {nft.name || "Unnamed NFT"}
          </div>

          {/* Mint Address */}
          <div
            style={{
              fontSize: "0.75rem",
              opacity: 0.7,
              marginBottom: "8px",
              wordBreak: "break-all"
            }}
          >
            {nft.mint}
          </div>

          {/* Attributes */}
          {nft.attributes && nft.attributes.length > 0 && (
            <div style={{ fontSize: "0.8rem", marginTop: "8px" }}>
              {nft.attributes.slice(0, 3).map((attr, i) => (
                <div key={i}>
                  <strong>{attr.trait_type}:</strong> {attr.value}
                </div>
              ))}
              {nft.attributes.length > 3 && (
                <div style={{ opacity: 0.6 }}>+ more…</div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
 
