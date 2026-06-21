"""
Event Listener - 监听链上事件并触发中继流程
"""

from web3 import Web3
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
            # 获取 BetCreatedCrossChain 事件
            event_filter = bet_manager.events.BetCreatedCrossChain.create_filter(
                fromBlock=from_block,
                toBlock=to_block
            )

            events = event_filter.get_all_entries()

            for event in events:
                self._handle_bet_created_event(chain_id, event)

            # 更新最后处理的区块
            self.last_processed_blocks[chain_id] = to_block

            if events:
                print(f"📦 Processed {len(events)} events from chain {chain_id}, blocks {from_block}-{to_block}")

        except Exception as e:
            print(f"[WARN]  Error processing blocks {from_block}-{to_block} on chain {chain_id}: {e}")

    def _handle_bet_created_event(self, source_chain_id: str, event: Any):
        """
        处理 BetCreatedCrossChain 事件

        Args:
            source_chain_id: 源链 ID
            event: 事件对象
        """
        args = event['args']

        # 提取事件参数
        message_id = hex(args['messageId'])
        bet_id = hex(args['betId'])
        target_chain_id = str(args['targetChainId'])

        print(f"\n🔔 New BetCreatedCrossChain Event:")
        print(f"   MessageID: {message_id}")
        print(f"   BetID: {bet_id}")
        print(f"   Source Chain: {source_chain_id}")
        print(f"   Target Chain: {target_chain_id}")

        # 构造消息数据
        msg_data = {
            'messageId': message_id,
            'betId': bet_id,
            'sourceChainId': source_chain_id,
            'targetChainId': target_chain_id,
            'sender': args['sender'],
            'receiver': args['receiver'],
            'msgType': args['msgType'],
            'data': args['data'].hex() if isinstance(args['data'], bytes) else args['data'],
            'timestamp': args['timestamp'],
            'timeout': args['timeout'],
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
