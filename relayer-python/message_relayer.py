"""
Message Relayer - 签名并中继跨链消息到目标链
"""

from web3 import Web3
from eth_account import Account
from typing import Dict, Any, List, Optional
import time
from datetime import datetime


class MessageRelayer:
    """消息中继器，负责签名和发送消息到目标链"""

    def __init__(self, chain_adapter, message_signer, message_store, config: dict):
        """
        初始化消息中继器

        Args:
            chain_adapter: ChainAdapter 实例
            message_signer: MessageSigner 实例
            message_store: MessageStore 实例
            config: 配置字典
        """
        self.chain_adapter = chain_adapter
        self.message_signer = message_signer
        self.message_store = message_store
        self.config = config
        self.threshold = config['threshold']
        self.required_confirmations = config.get('required_confirmations', 1)  # 本地测试 1 即可

        # 使用第一个 Relayer 作为交易发送者
        self.sender_account = Account.from_key(config['relayers'][0])
        print(f"[OK] Message relayer initialized with sender: {self.sender_account.address}")

    def process_pending_messages(self):
        """处理所有待处理的消息"""
        messages = self.message_store.get_pending_messages()

        for message_id, msg_data in messages.items():
            try:
                self._process_message(message_id, msg_data)
            except Exception as e:
                print(f"[ERROR] Error processing message {message_id}: {e}")

    def _process_message(self, message_id: str, msg_data: Dict[str, Any]):
        """
        处理单个消息的完整流程

        Args:
            message_id: 消息 ID
            msg_data: 消息数据
        """
        status = msg_data.get('status', 'pending')
        source_chain_id = msg_data['sourceChainId']
        target_chain_id = msg_data['targetChainId']

        # 1. 检查确认块数
        if status == 'pending':
            block_number = msg_data.get('blockNumber', 0)
            confirmations = self._get_confirmations(source_chain_id, block_number)
            msg_data['confirmations'] = confirmations

            if confirmations >= self.required_confirmations:
                msg_data['status'] = 'confirmed'
                self.message_store.save_message(message_id, msg_data)
                print(f"[OK] Message {message_id} confirmed ({confirmations} blocks)")

        # 2. 签名消息
        if status == 'confirmed':
            self._sign_message(message_id, msg_data)

        # 3. 中继到目标链
        if status == 'signed':
            self._relay_message(message_id, msg_data)

    def _get_confirmations(self, chain_id: str, block_number: int) -> int:
        """计算确认块数"""
        latest_block = self.chain_adapter.get_latest_block_number(chain_id)
        return max(0, latest_block - block_number)

    def _sign_message(self, message_id: str, msg_data: Dict[str, Any]):
        """
        签名消息

        Args:
            message_id: 消息 ID
            msg_data: 消息数据
        """
        try:
            # 构造跨链消息
            cross_chain_message = {
                'messageId': int(message_id, 16),  # bytes32 -> uint256
                'sourceChainId': int(msg_data['sourceChainId']),
                'targetChainId': int(msg_data['targetChainId']),
                'sender': Web3.to_checksum_address(msg_data['sender']),
                'receiver': Web3.to_checksum_address(msg_data['receiver']),
                'msgType': msg_data['msgType'],
                'data': bytes.fromhex(msg_data['data'].replace('0x', '')),
                'timestamp': msg_data['timestamp'],
                'timeout': msg_data['timeout']
            }

            # 签名（使用目标链的 verifier 做 EIP-712 domain）
            signatures = self.message_signer.sign_for_chain(cross_chain_message, msg_data['targetChainId'])

            # 保存签名
            msg_data['signatures_data'] = signatures
            msg_data['signatures'] = len(signatures)
            msg_data['status'] = 'signed'
            self.message_store.save_message(message_id, msg_data)

            print(f"[OK] Message {message_id} signed by {len(signatures)} relayers")

        except Exception as e:
            print(f"[ERROR] Failed to sign message {message_id}: {e}")
            msg_data['status'] = 'failed'
            self.message_store.save_message(message_id, msg_data)

    def _relay_message(self, message_id: str, msg_data: Dict[str, Any]):
        """
        中继消息到目标链

        Args:
            message_id: 消息 ID
            msg_data: 消息数据
        """
        target_chain_id = msg_data['targetChainId']
        msg_type = msg_data.get('msgType', 0)

        try:
            w3 = self.chain_adapter.get_web3(target_chain_id)
            if not w3:
                print(f"[ERROR] Target chain {target_chain_id} not available")
                return

            # 构造消息元组（匹配 CrossChainMessage 结构体 10 个字段）
            message_tuple = (
                int(message_id, 16),
                int(msg_data['sourceChainId']),
                int(msg_data['targetChainId']),
                Web3.to_checksum_address(msg_data['sender']),
                Web3.to_checksum_address(msg_data['receiver']),
                msg_type,
                bytes.fromhex(msg_data['data'].replace('0x', '')),
                msg_data['timestamp'],
                msg_data['timeout'],
                b''
            )

            # 提取签名
            signatures_data = msg_data.get('signatures_data', [])
            signatures_bytes = [bytes.fromhex(sig['signature'].replace('0x', '')) for sig in signatures_data]

            # 根据 msgType 选择目标合约和函数
            if msg_type == 0:  # BET_CREATED → registerRound
                target_contract = self.chain_adapter.get_contract(target_chain_id, 'settlement_manager')
                if not target_contract:
                    print(f"[ERROR] SettlementManager not available on chain {target_chain_id}")
                    return
                tx = target_contract.functions.registerRoundFromCrossChain(
                    message_tuple, signatures_bytes
                ).build_transaction({
                    'from': self.sender_account.address,
                    'nonce': w3.eth.get_transaction_count(self.sender_account.address),
                    'gas': 500000,
                    'gasPrice': w3.eth.gas_price
                })
            elif msg_type == 1:  # ROUND_RESULT → executeSettlement
                target_contract = self.chain_adapter.get_contract(target_chain_id, 'bet_manager')
                if not target_contract:
                    print(f"[ERROR] BetManager not available on chain {target_chain_id}")
                    return
                tx = target_contract.functions.executeSettlement(
                    message_tuple, signatures_bytes
                ).build_transaction({
                    'from': self.sender_account.address,
                    'nonce': w3.eth.get_transaction_count(self.sender_account.address),
                    'gas': 500000,
                    'gasPrice': w3.eth.gas_price
                })
            else:
                print(f"[ERROR] Unknown msgType: {msg_type}")
                return

            # 签名并发送交易
            signed_tx = self.sender_account.sign_transaction(tx)
            tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
            tx_hash_hex = tx_hash.hex()

            print(f"[SEND] Relaying message {message_id} to chain {target_chain_id}")
            print(f"   TxHash: {tx_hash_hex}")

            # 等待交易确认
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

            if receipt['status'] == 1:
                # 交易成功
                msg_data['status'] = 'delivered'
                msg_data['txHash'] = tx_hash_hex
                msg_data['deliveredAt'] = int(time.time())
                self.message_store.save_message(message_id, msg_data)

                print(f"[OK] Message {message_id} delivered successfully!")
                print(f"   Gas Used: {receipt['gasUsed']}")
            else:
                # 交易失败
                print(f"[ERROR] Transaction failed for message {message_id}")
                msg_data['status'] = 'failed'
                msg_data['txHash'] = tx_hash_hex
                self.message_store.save_message(message_id, msg_data)

        except Exception as e:
            print(f"[ERROR] Failed to relay message {message_id}: {e}")
            msg_data['status'] = 'failed'
            self.message_store.save_message(message_id, msg_data)
