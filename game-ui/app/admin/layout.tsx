"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { label: "Dashboard", href: "/admin" },
    { label: "NFT Viewer", href: "/admin/nfts" },
    { label: "Player Inspector", href: "/admin/player" },
    { label: "Mintables Manager", href: "/admin/mintables" },
    { label: "Quest Editor", href: "/admin/quests" },
    { label: "Map Tools", href: "/admin/map" },
    { label: "System Debug", href: "/admin/debug" }
  ];

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      background: "#0a0a0a",
      color: "#e0e0e0",
      fontFamily: "Consolas, monospace"
    }}>
      
      {/* SIDEBAR */}
      <aside style={{
        width: "240px",
        background: "#111",
        borderRight: "1px solid #333",
        padding: "20px 14px",
        display: "flex",
        flexDirection: "column",
        gap: "14px"
      }}>
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{
            margin: 0,
            fontSize: "18px",
            color: "#00ff99",
            letterSpacing: "0.1em"
          }}>
            ADMIN PANEL
          </h2>
          <div style={{ fontSize: "11px", opacity: 0.7 }}>
            Vault‑Tec Overseer Console
          </div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: "8px 10px",
                  borderRadius: "4px",
                  textDecoration: "none",
                  color: active ? "#000" : "#e0e0e0",
                  background: active ? "#00ff99" : "transparent",
                  fontSize: "13px",
                  letterSpacing: "0.05em",
                  border: "1px solid #333"
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main style={{
        flex: 1,
        padding: "24px",
        overflowY: "auto"
      }}>
        {children}
      </main>
    </div>
  );
}
