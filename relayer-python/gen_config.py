"""
Auto-generate relayer config.yaml from deployed-addresses.json
Usage: python gen_config.py [--output config.yaml]
"""

import json
import yaml
import os
import sys

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)

    # Read deployed addresses
    deployed_path = os.path.join(project_root, "network", "deployed-addresses.json")
    if not os.path.exists(deployed_path):
        print(f"[ERROR] deployed-addresses.json not found at {deployed_path}")
        print("Run 'start-dual.bat' in network/ first to deploy contracts.")
        sys.exit(1)

    with open(deployed_path, 'r') as f:
        deployed = json.load(f)

    # Build networks config
    networks = {}
    for chain_id_str, chain_data in deployed.items():
        if chain_id_str.startswith("_"):
            continue  # skip metadata

        chain_id = int(chain_id_str)
        contracts = chain_data["contracts"]
        networks[f"local_chain_{chain_id}"] = {
            "rpc_url": chain_data["rpcUrl"],
            "chain_id": chain_id,
            "verifier_address": contracts["MessageVerifier"],
            "bet_manager_address": contracts["BetManager"],
            "settlement_manager_address": contracts["SettlementManager"],
            "htlc_vault_address": contracts["HTLCVault"]
        }

    if not networks:
        print("[ERROR] No chain data found in deployed-addresses.json")
        sys.exit(1)

    config = {
        "networks": networks,
        "relayers": [
            "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",  # Hardhat Account #0
            "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"   # Hardhat Account #1
        ],
        "threshold": 2,
        "server": {
            "host": "0.0.0.0",
            "port": 8080
        },
        "logging": {
            "level": "INFO"
        }
    }

    output_path = sys.argv[2] if len(sys.argv) > 2 and sys.argv[1] == '--output' else os.path.join(script_dir, "config.yaml")

    # Write with custom formatting (no YAML !! tags)
    with open(output_path, 'w') as f:
        f.write("# Cross-Chain Relayer Configuration (Auto-generated)\n")
        f.write(f"# Chains: {list(networks.keys())}\n\n")
        yaml.dump(config, f, default_flow_style=False, allow_unicode=True, sort_keys=False)

    print(f"[OK] Config generated: {output_path}")
    print(f"   Chains: {list(networks.keys())}")
    for name, net in networks.items():
        print(f"   {name} (chain {net['chain_id']}): {net['rpc_url']}")

if __name__ == '__main__':
    main()
