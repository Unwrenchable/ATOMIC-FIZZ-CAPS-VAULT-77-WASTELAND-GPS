#!/usr/bin/env python3
"""Atomic Fizz unique-gold scan — same method as RealAI.

Walk a checkout (default: cwd). Classify source files by content SHA:
  unique  — SHA appears once (gold candidate)
  twin    — same SHA at 2+ paths (keep canonical, shelf the rest)
  stub    — empty or tiny placeholder
  nested  — extra .git directories (gitlinks / nested clones)

Does not rewrite the tree. Flatten first with scripts/flatten_nested_git.ps1.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

SKIP_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "build",
    "target",
    ".anchor",
    ".next",
    "coverage",
    "__pycache__",
    ".venv",
    "venv",
    ".cache",
}
SOURCE_EXT = {
    ".js",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    ".jsx",
    ".py",
    ".rs",
    ".toml",
    ".json",
    ".html",
    ".css",
    ".md",
    ".sh",
    ".ps1",
    ".yml",
    ".yaml",
}
CANON_PREFIX = (
    "backend/api/",
    "backend/lib/",
    "backend/middleware/",
    "backend/realai-client/",
    "frontend/js/modules/",
    "programs/fizzcaps_onchain/",
    "scripts/realai/",
    "systems/",
    "workers/",
)
STUB_BYTES = 400


def iter_files(root: Path):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [
            d
            for d in dirnames
            if d not in SKIP_DIRS and not d.startswith(".git")
        ]
        for name in filenames:
            yield Path(dirpath) / name


def sha256_file(path: Path, limit: int = 8_000_000) -> str | None:
    try:
        h = hashlib.sha256()
        with path.open("rb") as f:
            n = 0
            while True:
                chunk = f.read(1024 * 256)
                if not chunk:
                    break
                n += len(chunk)
                if n > limit:
                    return f"too-large:{path.stat().st_size}"
                h.update(chunk)
        return h.hexdigest()
    except OSError:
        return None


def find_nested_git(root: Path) -> list[str]:
    hits = []
    for dirpath, dirnames, _ in os.walk(root):
        if Path(dirpath) == root:
            continue
        if ".git" in dirnames or (Path(dirpath) / ".git").exists():
            rel = os.path.relpath(dirpath, root).replace("\\", "/")
            hits.append(rel)
            dirnames[:] = [d for d in dirnames if d != ".git"]
    return sorted(set(hits))


def is_source(path: Path) -> bool:
    return path.suffix.lower() in SOURCE_EXT


def canon_score(rel: str) -> int:
    score = 0
    for p in CANON_PREFIX:
        if rel.startswith(p):
            score += 50
    if "/legacy/" in f"/{rel}" or rel.startswith("legacy/"):
        score -= 40
    if rel.startswith("scripts/") and "realai" not in rel:
        score -= 5
    if rel.endswith(".min.js"):
        score -= 80
    return score


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--root",
        default=".",
        help="Checkout root (Windows: C:\\Users\\tsmit\\ATOMIC-FIZZ-CAPS-VAULT-77-WASTELAND-GPS)",
    )
    ap.add_argument("--out", default="docs/unification/UNIQUE_GOLD_SCAN.json")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    nested = find_nested_git(root)
    by_sha: dict[str, list[dict]] = defaultdict(list)
    stubs = []
    scanned = 0

    for path in iter_files(root):
        if not is_source(path):
            continue
        rel = path.relative_to(root).as_posix()
        try:
            size = path.stat().st_size
        except OSError:
            continue
        scanned += 1
        digest = sha256_file(path)
        rec = {"path": rel, "size": size, "sha256": digest}
        if size == 0 or size < STUB_BYTES:
            stubs.append(rec)
        if digest:
            by_sha[digest].append(rec)

    unique = []
    twins = []
    for digest, recs in by_sha.items():
        if digest.startswith("too-large:"):
            continue
        if len(recs) == 1:
            unique.append(recs[0])
        else:
            ranked = sorted(
                recs,
                key=lambda r: (-canon_score(r["path"]), -r["size"], r["path"]),
            )
            twins.append(
                {
                    "sha256": digest,
                    "size": ranked[0]["size"],
                    "gold": ranked[0]["path"],
                    "twins": [r["path"] for r in ranked[1:]],
                }
            )

    unique.sort(key=lambda r: r["path"])
    twins.sort(key=lambda r: (-len(r["twins"]), r["gold"]))
    stubs.sort(key=lambda r: r["path"])

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "root": str(root),
        "scanned_source_files": scanned,
        "unique_sha_count": len(unique),
        "twin_groups": len(twins),
        "stub_count": len(stubs),
        "nested_git": nested,
        "twins": twins,
        "stubs": stubs,
        "unique_sample": unique[:400],
    }

    out = Path(args.out)
    if not out.is_absolute():
        out = root / out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    md = out.with_suffix(".md")
    lines = [
        "# Unique gold scan — Atomic Fizz Caps",
        "",
        f"- Root: `{root}`",
        f"- When: {report['generated_at']}",
        f"- Source files: {scanned}",
        f"- Unique SHAs: {len(unique)}",
        f"- Twin groups: {len(twins)}",
        f"- Stubs (<{STUB_BYTES}B): {len(stubs)}",
        f"- Nested `.git`: {len(nested)}",
        "",
        "## Nested repos (flatten these first)",
        "",
    ]
    if nested:
        for n in nested:
            lines.append(f"- `{n}`")
    else:
        lines.append("- none on this checkout")
    lines += ["", "## Twin groups (same SHA, extra paths)", ""]
    for t in twins[:80]:
        extra = ", ".join(f"`{x}`" for x in t["twins"])
        lines.append(f"- gold `{t['gold']}` ← {extra}")
    lines += ["", "## Stubs / empty placeholders", ""]
    for s in stubs[:80]:
        lines.append(f"- `{s['path']}` ({s['size']} bytes)")
    md.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"scanned={scanned} unique={len(unique)} twins={len(twins)} stubs={len(stubs)} nested={len(nested)}")
    print(f"wrote {out}")
    print(f"wrote {md}")
    if nested:
        print("NESTED GIT FOUND — run scripts/flatten_nested_git.ps1")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
