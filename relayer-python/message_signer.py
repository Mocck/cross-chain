"""
Message Signer - EIP-712 签名生成器
"""

from eth_account import Account
from eth_account.messages import encode_defunct
from typing import List, Dict, Any
from web3 import Web3
import time
import json
from eth_utils import keccak


class MessageSigner:
    """消息签名器，实现 EIP-712 标准签名"""

    def __init__(self, relayer_private_keys: List[str], verifier_address: str, chain_id: int):
        """
        初始化签名器

        Args:
            relayer_private_keys: Relayer 私钥列表
            verifier_address: MessageVerifier 合约地址（用于 EIP-712 domain）
            chain_id: 链 ID
        """
        self.accounts = [Account.from_key(pk) for pk in relayer_private_keys]
        self.verifier_address = Web3.to_checksum_address(verifier_address)
        self.chain_id = chain_id

        print(f"[OK] Initialized {len(self.accounts)} signers for chain {chain_id}")
        for i, account in enumerate(self.accounts):
            print(f"   Signer {i+1}: {account.address}")

    def build_eip712_message(self, cross_chain_message: Dict[str, Any]) -> Dict[str, Any]:
        """
        构造 EIP-712 结构化消息

        Args:
            cross_chain_message: 跨链消息数据
            {
                'messageId': bytes32,
                'sourceChainId': uint256,
                'targetChainId': uint256,
                'sender': address,
                'receiver': address,
                'msgType': uint8,
                'data': bytes,
                'timestamp': uint256,
                'timeout': uint256
            }

        Returns:
            EIP-712 结构化数据
        """
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
        """
        使用所有 Relayer 私钥签名消息

        Args:
            cross_chain_message: 跨链消息

        Returns:
            签名列表，每个签名包含 {address, signature}
        """
        # 手动构造 EIP-712 哈希
        sign_hash = self._get_eip712_hash(cross_chain_message)

        signatures = []
        for account in self.accounts:
            # 使用 eth_account 的底层签名功能
            signed = account.signHash(sign_hash)
            signatures.append({
                'address': account.address,
                'signature': signed.signature.hex()
            })

        # 按地址排序（合约要求）
        signatures.sort(key=lambda x: x['address'].lower())

        return signatures

    def _get_eip712_hash(self, cross_chain_message: Dict[str, Any]) -> bytes:
        """
        手动构造 EIP-712 签名哈希，匹配 Solidity 合约的 abi.encode 逻辑
        """
        from eth_abi import encode

        # Domain Separator
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

        # Message Struct Hash
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

        # EIP-712 签名哈希
        sign_hash = keccak(
            b'\x19\x01' + domain_separator + struct_hash
        )

        return sign_hash

    def get_signer_addresses(self) -> List[str]:
        """获取所有签名者地址"""
        return [account.address for account in self.accounts]


def parse_bet_created_event(event_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    解析 BetCreatedCrossChain 事件为跨链消息格式

    Args:
        event_data: 事件数据

    Returns:
        CrossChainMessage 格式的字典
    """
    args = event_data['args']

    # 构造跨链消息
    message = {
        'messageId': args['messageId'],  # uint256
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
