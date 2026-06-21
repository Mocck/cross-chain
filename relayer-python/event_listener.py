"""
Event Listener - 监听链上事件并触发中继流程
"""

from web3 import Web3
from eth_abi import encode
from eth_utils import keccak
from typing import Callable, Dict, Any, Optional
import threading
import time
from datetime import datetime


class EventListener:
    """事件监听器，监听 BetCreatedCrossChain 事件"""

    def __init__(self, chain_adapter, message_store, config: dict):
        """
        初始化事件监听器

        Args:
            chain_adapter: ChainAdapter 实例
            message_store: MessageStore 实例
            config: 配置字典
        """
        self.chain_adapter = chain_adapter
        self.message_store = message_store
        self.config = config
        self.is_running = False
        self.listener_threads = []

        # 每个链的最后处理区块
        self.last_processed_blocks: Dict[str, int] = {}

    def start(self):
        """启动所有链的事件监听"""
        self.is_running = True

        for chain_id in self.chain_adapter.web3_instances.keys():
            # 获取当前区块作为起始点
            current_block = self.chain_adapter.get_latest_block_number(chain_id)
            self.last_processed_blocks[chain_id] = current_block

            # 为每条链启动独立的监听线程
            thread = threading.Thread(
                target=self._listen_chain,
                args=(chain_id,),
                daemon=True
            )
            thread.start()
            self.listener_threads.append(thread)

            print(f"[LISTEN] Event listener started for chain {chain_id} from block {current_block}")

    def stop(self):
        """停止所有事件监听"""
        self.is_running = False
        print("🛑 Stopping event listeners...")

    def _listen_chain(self, chain_id: str):
        """
        监听指定链的事件

        Args:
            chain_id: 链 ID
        """
        poll_interval = 5  # 每5秒轮询一次

        while self.is_running:
            try:
                self._process_new_blocks(chain_id)
            except Exception as e:
                print(f"[ERROR] Error listening chain {chain_id}: {e}")

            time.sleep(poll_interval)

    def _process_new_blocks(self, chain_id: str):
        """
        处理新区块中的事件

        Args:
            chain_id: 链 ID
        """
        w3 = self.chain_adapter.get_web3(chain_id)
        bet_manager = self.chain_adapter.get_contract(chain_id, 'bet_manager')

        if not w3 or not bet_manager:
            return

        # 获取最新区块
        latest_block = w3.eth.block_number
        last_processed = self.last_processed_blocks.get(chain_id, latest_block)

        # 如果没有新区块，直接返回
        if latest_block <= last_processed:
            return

        # 获取事件过滤器
        from_block = last_processed + 1
        to_block = min(from_block + 100, latest_block)  # 每次最多处理100个区块

        try:
            # 1. 监听 BetCreatedCrossChain (BetManager)
            bet_events = bet_manager.events.BetCreatedCrossChain.get_logs(
                from_block=from_block,
                to_block=to_block
            )
            for event in bet_events:
                self._handle_bet_created_event(chain_id, event)

            # 2. 监听 RoundFinished (SettlementManager)
            round_events = []
            settlement_mgr = self.chain_adapter.get_contract(chain_id, 'settlement_manager')
            if settlement_mgr:
                try:
                    round_events = settlement_mgr.events.RoundFinished.get_logs(
                        from_block=from_block,
                        to_block=to_block
                    )
                    for event in round_events:
                        self._handle_round_finished_event(chain_id, event)
                except Exception as e:
                    print(f"[DEBUG] No RoundFinished events or error: {e}")

            # 更新最后处理的区块
            self.last_processed_blocks[chain_id] = to_block

            total = len(bet_events) + (len(round_events) if settlement_mgr else 0)
            if total:
                print(f"📦 Processed {total} events from chain {chain_id}, blocks {from_block}-{to_block}")

        except Exception as e:
            print(f"[WARN]  Error processing blocks {from_block}-{to_block} on chain {chain_id}: {e}")

    def _handle_bet_created_event(self, source_chain_id: str, event: Any):
        """
        处理 BetCreatedCrossChain 事件
        实际事件签名: BetCreatedCrossChain(bytes32 indexed betId, address indexed player, uint256 amount, uint256 targetChainId)

        Args:
            source_chain_id: 源链 ID
            event: 事件对象
        """
        args = event['args']

        # 从事件提取
        bet_id_bytes = args['betId']
        bet_id = '0x' + bet_id_bytes.hex() if isinstance(bet_id_bytes, bytes) else hex(bet_id_bytes)
        player = args['player']
        target_chain_id = str(args['targetChainId'])

        print(f"\n🔔 BetCreatedCrossChain Event:")
        print(f"   BetID: {bet_id}")
        print(f"   Player: {player}")
        print(f"   Source Chain: {source_chain_id}")
        print(f"   Target Chain: {target_chain_id}")

        w3 = self.chain_adapter.get_web3(source_chain_id)
        bet_manager = self.chain_adapter.get_contract(source_chain_id, 'bet_manager')
        if not w3 or not bet_manager:
            print(f"[ERROR] Cannot get chain adapter for {source_chain_id}")
            return

        # 查询 BetManager 获取赌注详情
        try:
            bet = bet_manager.functions.bets(bet_id_bytes).call()
            prediction = bet[3]   # uint8 prediction
            round_id = bet[4]     # uint256 roundId
            timeout = bet[5]      # uint256 timeout
            amount = bet[2]       # uint256 amount

            # 获取 nonce (用于 messageId)
            nonce = bet_manager.functions.nonce().call()
        except Exception as e:
            print(f"[ERROR] Failed to query bet from contract: {e}")
            return

        # 获取目标链配置
        target_chain_cfg = self.config['networks'].get(f'chain_{target_chain_id}') or \
                           next((n for n in self.config['networks'].values() if str(n['chain_id']) == target_chain_id), None)

        if not target_chain_cfg:
            print(f"[ERROR] No config for target chain {target_chain_id}")
            return

        receiver = target_chain_cfg.get('settlement_manager_address', '0x0000000000000000000000000000000000000000')

        msg_type = 0  # Solidity enum: MessageType.BET_CREATED = 0

        # 构造 data = abi.encode(betId, player, amount, roundId)
        data_bytes = encode(
            ['bytes32', 'address', 'uint256', 'uint256'],
            [bet_id_bytes, Web3.to_checksum_address(player), amount, round_id]
        )
        data_hex = '0x' + data_bytes.hex()

        # 构造 messageId
        data_hash = keccak(data_bytes)
        packed = encode(
            ['uint256', 'uint256', 'uint8', 'bytes32'],
            [int(source_chain_id), nonce, msg_type, data_hash]
        )
        message_id_bytes = keccak(packed)
        message_id = '0x' + message_id_bytes.hex()

        block = w3.eth.get_block(event['blockNumber'])
        timestamp = block['timestamp']

        msg_data = {
            'messageId': message_id,
            'betId': bet_id,
            'roundId': str(round_id),
            'sourceChainId': source_chain_id,
            'targetChainId': target_chain_id,
            'sender': Web3.to_checksum_address(player),
            'receiver': Web3.to_checksum_address(receiver),
            'msgType': msg_type,
            'data': data_hex,
            'timestamp': timestamp,
            'timeout': timeout,
            'status': 'pending',
            'confirmations': 0,
            'signatures': 0,
            'createdAt': int(time.time()),
            'deliveredAt': 0,
            'txHash': '',
            'blockNumber': event['blockNumber']
        }

        # 保存到存储
        self.message_store.save_message(message_id, msg_data)
        print(f"[OK] Message {message_id} saved to store")

    def _handle_round_finished_event(self, settlement_chain_id: str, event: Any):
        """
        处理 RoundFinished 事件，生成结算消息回传源链
        事件签名: RoundFinished(uint256 indexed roundId, uint8 result)
        """
        args = event['args']
        round_id = str(args['roundId'])
        result = args['result']

        print(f"\n🏁 RoundFinished Event:")
        print(f"   Round: {round_id}, Result: {result}")
        print(f"   Chain: {settlement_chain_id}")

        # 找到所有已 relay 到这条链、且属于这个 round 的 bet
        related = self.message_store.get_messages_by_round(round_id, settlement_chain_id)
        if not related:
            print(f"   No bets found for round {round_id} on chain {settlement_chain_id}")
            return

        print(f"   Found {len(related)} bet(s) to settle")

        for msg in related:
            if msg.get('status') != 'delivered':
                continue

            bet_id = msg['betId']
            bet_id_bytes = bytes.fromhex(bet_id.replace('0x', ''))
            source_chain_id = msg['sourceChainId']  # 原始下注链

            # 获取 source chain 的配置
            source_cfg = self.config['networks'].get(f'chain_{source_chain_id}') or \
                         next((n for n in self.config['networks'].values() if str(n['chain_id']) == source_chain_id), None)
            if not source_cfg:
                print(f"   [ERROR] No config for source chain {source_chain_id}")
                continue

            receiver = source_cfg.get('bet_manager_address', '0x0000000000000000000000000000000000000000')
            settlement_addr = self.config['networks'].get(f'chain_{settlement_chain_id}', {}). \
                get('settlement_manager_address', '0x0000000000000000000000000000000000000000')

            # 构造结算 data = abi.encode(betId, winningResult)
            settlement_data = encode(
                ['bytes32', 'uint8'],
                [bet_id_bytes, result]
            )
            settlement_data_hex = '0x' + settlement_data.hex()

            # 构造 messageId
            w3 = self.chain_adapter.get_web3(settlement_chain_id)
            bet_mgr = self.chain_adapter.get_contract(source_chain_id, 'bet_manager')
            nonce = 0
            if bet_mgr:
                try:
                    nonce = bet_mgr.functions.nonce().call()
                except:
                    pass

            data_hash = keccak(settlement_data)
            packed = encode(
                ['uint256', 'uint256', 'uint8', 'bytes32'],
                [int(settlement_chain_id), nonce, 1, data_hash]  # msgType=1 (ROUND_RESULT)
            )
            msg_id_bytes = keccak(packed)
            msg_id = '0x' + msg_id_bytes.hex()

            block = w3.eth.get_block(event['blockNumber'])
            timestamp = block['timestamp']

            settle_msg = {
                'messageId': msg_id,
                'betId': bet_id,
                'roundId': round_id,
                'sourceChainId': settlement_chain_id,  # 结算链发出
                'targetChainId': source_chain_id,       # 回传原始下注链
                'sender': Web3.to_checksum_address(settlement_addr),
                'receiver': Web3.to_checksum_address(receiver),
                'msgType': 1,  # ROUND_RESULT
                'data': settlement_data_hex,
                'timestamp': timestamp,
                'timeout': int(time.time()) + 3600,
                'status': 'pending',
                'confirmations': 0,
                'signatures': 0,
                'createdAt': int(time.time()),
                'deliveredAt': 0,
                'txHash': '',
                'blockNumber': event['blockNumber']
            }

            self.message_store.save_message(msg_id, settle_msg)
            print(f"   ➤ Settlement message {msg_id} created → chain {source_chain_id}")

    def get_message_confirmations(self, chain_id: str, block_number: int) -> int:
        """
        计算消息的确认块数

        Args:
            chain_id: 链 ID
            block_number: 消息所在区块号

        Returns:
            确认块数
        """
        latest_block = self.chain_adapter.get_latest_block_number(chain_id)
        return max(0, latest_block - block_number)
