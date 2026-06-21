"""
Message Signer - EIP-712 签名生成器
"""

from eth_account import Account
from eth_account.messages import encode_typed_data
from typing import List, Dict, Any
from web3 import Web3
from eth_abi import encode
from eth_utils import keccak
import json


class MessageSigner:
    """消息签名器，实现 EIP-712 标准签名（单链）"""

    def __init__(self, relayer_private_keys: List[str], verifier_address: str, chain_id: int):
        self.accounts = [Account.from_key(pk) for pk in relayer_private_keys]
        self.verifier_address = Web3.to_checksum_address(verifier_address)
        self.chain_id = chain_id

        print(f"[OK] Signer initialized for chain {chain_id} with {len(self.accounts)} keys")
        for i, account in enumerate(self.accounts):
            print(f"   Signer {i+1}: {account.address}")

    def build_eip712_message(self, cross_chain_message: Dict[str, Any]) -> Dict[str, Any]:
        """构造 EIP-712 结构化消息"""
        return {
            "types": {
                "EIP712Domain": [
                    {"name": "name", "type": "string"},
                    {"name": "version", "type": "string"},
                    {"name": "chainId", "type": "uint256"},
                    {"name": "verifyingContract", "type": "address"}
                ],
                "CrossChainMessage": [
                    {"name": "messageId", "type": "uint256"},
                    {"name": "sourceChainId", "type": "uint256"},
                    {"name": "targetChainId", "type": "uint256"},
                    {"name": "sender", "type": "address"},
                    {"name": "receiver", "type": "address"},
                    {"name": "msgType", "type": "uint8"},
                    {"name": "data", "type": "bytes"},
                    {"name": "timestamp", "type": "uint256"},
                    {"name": "timeout", "type": "uint256"}
                ]
            },
            "primaryType": "CrossChainMessage",
            "domain": {
                "name": "CrossChainBetting",
                "version": "1.0.0",
                "chainId": self.chain_id,
                "verifyingContract": self.verifier_address
            },
            "message": cross_chain_message
        }

    def sign_message(self, cross_chain_message: Dict[str, Any]) -> List[Dict[str, Any]]:
        """使用所有 Relayer 私钥签名消息"""
        eip712_msg = self.build_eip712_message(cross_chain_message)
        encoded = encode_typed_data(full_message=eip712_msg)

        signatures = []
        for account in self.accounts:
            signed = account.sign_message(encoded)
            signatures.append({
                'address': account.address,
                'signature': signed.signature.hex()
            })

        signatures.sort(key=lambda x: x['address'].lower())
        return signatures

    def _get_eip712_hash(self, cross_chain_message: Dict[str, Any]) -> bytes:
        """手动构造 EIP-712 签名哈希"""
        DOMAIN_TYPEHASH = keccak(text="EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")

        domain_separator = keccak(
            encode(
                ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
                [
                    DOMAIN_TYPEHASH,
                    keccak(text="CrossChainBetting"),
                    keccak(text="1.0.0"),
                    self.chain_id,
                    self.verifier_address
                ]
            )
        )

        MESSAGE_TYPEHASH = keccak(text="CrossChainMessage(uint256 messageId,uint256 sourceChainId,uint256 targetChainId,address sender,address receiver,uint8 msgType,bytes data,uint256 timestamp,uint256 timeout)")

        struct_hash = keccak(
            encode(
                ['bytes32', 'uint256', 'uint256', 'uint256', 'address', 'address', 'uint8', 'bytes32', 'uint256', 'uint256'],
                [
                    MESSAGE_TYPEHASH,
                    cross_chain_message['messageId'],
                    cross_chain_message['sourceChainId'],
                    cross_chain_message['targetChainId'],
                    cross_chain_message['sender'],
                    cross_chain_message['receiver'],
                    cross_chain_message['msgType'],
                    keccak(cross_chain_message['data']),
                    cross_chain_message['timestamp'],
                    cross_chain_message['timeout']
                ]
            )
        )

        sign_hash = keccak(b'\x19\x01' + domain_separator + struct_hash)
        return sign_hash

    def get_signer_addresses(self) -> List[str]:
        """获取所有签名者地址"""
        return [account.address for account in self.accounts]


class MultiChainSigner:
    """多链签名管理器，按链 ID 管理多个 MessageSigner"""

    def __init__(self, relayer_private_keys: List[str], chain_configs: Dict[str, Dict[str, any]]):
        self.accounts = [Account.from_key(pk) for pk in relayer_private_keys]
        self.signers: Dict[str, MessageSigner] = {}

        for chain_id_str, network_cfg in chain_configs.items():
            chain_id = network_cfg['chain_id']
            verifier = network_cfg['verifier_address']
            self.signers[str(chain_id)] = MessageSigner(relayer_private_keys, verifier, chain_id)

        print(f"[OK] MultiChainSigner initialized for chains: {list(self.signers.keys())}")

    def get_signer(self, chain_id: str) -> MessageSigner:
        chain_id = str(chain_id)
        if chain_id not in self.signers:
            raise ValueError(f"No signer configured for chain {chain_id}")
        return self.signers[chain_id]

    def sign_for_chain(self, cross_chain_message: Dict[str, Any], chain_id: str) -> List[Dict[str, Any]]:
        """为指定链签名消息"""
        signer = self.get_signer(chain_id)
        return signer.sign_message(cross_chain_message)


def parse_bet_created_event(event_data: Dict[str, Any]) -> Dict[str, Any]:
    """解析 BetCreatedCrossChain 事件为跨链消息格式"""
    args = event_data['args']

    message = {
        'messageId': args['messageId'],
        'sourceChainId': args['sourceChainId'],
        'targetChainId': args['targetChainId'],
        'sender': args['sender'],
        'receiver': args['receiver'],
        'msgType': args['msgType'],
        'data': args['data'],
        'timestamp': args['timestamp'],
        'timeout': args['timeout']
    }

    return message
