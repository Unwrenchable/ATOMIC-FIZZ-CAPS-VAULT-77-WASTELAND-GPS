#!/usr/bin/env bash
# Fail unless exactly one of localnet/devnet/mainnet is enabled.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "cargo check --features localnet"
cargo check -p fizzcaps_onchain --features localnet
echo "cargo check --features devnet"
cargo check -p fizzcaps_onchain --features devnet
echo "cargo check --features mainnet"
cargo check -p fizzcaps_onchain --features mainnet

set +e
cargo check -p fizzcaps_onchain > /tmp/fizzcaps-no-feature.txt 2>&1
no_code=$?
cargo check -p fizzcaps_onchain --features devnet,localnet > /tmp/fizzcaps-two-feature.txt 2>&1
two_code=$?
set -e

if [ "$no_code" -eq 0 ]; then
  echo "FAIL: cargo check with zero cluster features succeeded"
  exit 1
fi
if [ "$two_code" -eq 0 ]; then
  echo "FAIL: cargo check with devnet and localnet succeeded"
  exit 1
fi
grep -q "exactly one of features localnet, devnet, mainnet must be set" /tmp/fizzcaps-no-feature.txt
grep -q "exactly one of features localnet, devnet, mainnet must be set" /tmp/fizzcaps-two-feature.txt
echo "cluster feature gate ok"
