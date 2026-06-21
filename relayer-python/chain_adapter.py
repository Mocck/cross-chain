"""
Chain Adapter - Web3 连接和合约交互层
"""

from web3 import Web3
from typing import Dict, Any, Optional
import json
import os


class ChainAdapter:
    """区块链适配器，管理 Web3 连接和合约实例"""

    def __init__(self, config: dict):
        self.config = config
        self.web3_instances: Dict[str, Web3] = {}
        self.contracts: Dict[str, Dict[str, Any]] = {}
        self._init_connections()

    def _init_connections(self):
        """初始化所有网络的 Web3 连接"""
        for network_name, network_config in self.config['networks'].items():
            rpc_url = network_config['rpc_url']
            chain_id = network_config['chain_id']

            # 创建 Web3 实例
            w3 = Web3(Web3.HTTPProvider(rpc_url))

            # 验证连接
            if not w3.is_connected():
                print(f"[WARN] Cannot connect to {network_name} at {rpc_url}")
                continue

            self.web3_instances[str(chain_id)] = w3

            # 加载合约
            self._load_contracts(str(chain_id), network_config)

            print(f"[OK] Connected to {network_name} (Chain ID: {chain_id})")

    def _load_contracts(self, chain_id: str, network_config: dict):
        """加载合约实例"""
        w3 = self.web3_instances[chain_id]

        # ABI 文件路径
        script_dir = os.path.dirname(os.path.abspath(__file__))
        abis_dir = os.path.join(script_dir, 'abis')

        contracts = {}

        # 加载 BetManager
        if 'bet_manager_address' in network_config:
            abi_path = os.path.join(abis_dir, 'BetManager.json')
            if os.path.exists(abi_path):
                with open(abi_path, 'r') as f:
                    abi = json.load(f)
                contracts['bet_manager'] = w3.eth.contract(
                    address=Web3.to_checksum_address(network_config['bet_manager_address']),
                    abi=abi
                )

        # 加载 MessageVerifier
        if 'verifier_address' in network_config:
            abi_path = os.path.join(abis_dir, 'MessageVerifier.json')
            if os.path.exists(abi_path):
                with open(abi_path, 'r') as f:
                    abi = json.load(f)
                contracts['verifier'] = w3.eth.contract(
                    address=Web3.to_checksum_address(network_config['verifier_address']),
                    abi=abi
                )

        # 加载 SettlementManager
        if 'settlement_manager_address' in network_config:
            abi_path = os.path.join(abis_dir, 'SettlementManager.json')
            if os.path.exists(abi_path):
                with open(abi_path, 'r') as f:
                    abi = json.load(f)
                contracts['settlement_manager'] = w3.eth.contract(
                    address=Web3.to_checksum_address(network_config['settlement_manager_address']),
                    abi=abi
                )

        self.contracts[chain_id] = contracts

    def get_web3(self, chain_id: str) -> Optional[Web3]:
        """获取指定链的 Web3 实例"""
        return self.web3_instances.get(chain_id)

    def get_contract(self, chain_id: str, contract_name: str) -> Optional[Any]:
        """获取指定链的合约实例"""
        return self.contracts.get(chain_id, {}).get(contract_name)

    def get_latest_block_number(self, chain_id: str) -> int:
        """获取最新区块号"""
        w3 = self.get_web3(chain_id)
        if w3:
            return w3.eth.block_number
        return 0

    def get_block_timestamp(self, chain_id: str, block_number: int) -> int:
        """获取区块时间戳"""
        w3 = self.get_web3(chain_id)
        if w3:
            block = w3.eth.get_block(block_number)
            return block['timestamp']
        return 0
