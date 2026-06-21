"""
Cross-Chain Relayer API Server (Python)
使用 Flask 实现 HTTP API 服务器，与 SDK 对接
"""

from flask import Flask, jsonify, request
from dataclasses import dataclass, asdict
from typing import Dict, Optional
from datetime import datetime
import threading
import time
import yaml
import os
import sys

# 导入核心模块
from chain_adapter import ChainAdapter
from event_listener import EventListener
from message_signer import MessageSigner, MultiChainSigner
from message_relayer import MessageRelayer

app = Flask(__name__)

# 手动实现 CORS（无需 flask-cors）
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# 消息状态枚举
class MessageStatus:
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SIGNED = "signed"
    DELIVERED = "delivered"
    FAILED = "failed"

@dataclass
class RelayerMessageResponse:
    messageId: str
    status: str
    sourceChainId: str
    targetChainId: str
    msgType: int
    confirmations: int
    requiredConfirmations: int
    signatures: int
    requiredSignatures: int
    createdAt: int
    deliveredAt: int
    txHash: str

# 内存存储（简化实现）
class MessageStore:
    def __init__(self):
        self.messages: Dict[str, dict] = {}
        self.lock = threading.Lock()

    def save_message(self, message_id: str, data: dict):
        with self.lock:
            self.messages[message_id] = data

    def get_message(self, message_id: str) -> Optional[dict]:
        with self.lock:
            return self.messages.get(message_id)

    def mark_delivered(self, message_id: str, tx_hash: str):
        with self.lock:
            if message_id in self.messages:
                self.messages[message_id]['status'] = MessageStatus.DELIVERED
                self.messages[message_id]['txHash'] = tx_hash
                self.messages[message_id]['deliveredAt'] = int(time.time())

    def get_pending_messages(self) -> Dict[str, dict]:
        """获取所有未完成的消息（pending, confirmed, signed）"""
        with self.lock:
            return {
                msg_id: msg_data
                for msg_id, msg_data in self.messages.items()
                if msg_data.get('status') in [MessageStatus.PENDING, MessageStatus.CONFIRMED, MessageStatus.SIGNED]
            }

    def get_messages_by_round(self, round_id: str, target_chain_id: str) -> list:
        """根据 roundId 和目标链查找已中继的赌注，用于结算回传"""
        with self.lock:
            return [
                msg for msg in self.messages.values()
                if msg.get('roundId') == round_id and msg.get('targetChainId') == target_chain_id
            ]

# 全局存储实例
store = MessageStore()

# ============================================================
# 配置加载
# ============================================================

def load_config(config_path: str = 'config.yaml') -> dict:
    """加载 YAML 配置文件"""
    try:
        # 支持相对路径和绝对路径
        if not os.path.isabs(config_path):
            # 相对于脚本所在目录
            script_dir = os.path.dirname(os.path.abspath(__file__))
            config_path = os.path.join(script_dir, config_path)

        if not os.path.exists(config_path):
            print(f"[ERROR] Config file not found: {config_path}")
            sys.exit(1)

        with open(config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)

        print(f"[OK] Config loaded from: {config_path}")
        return config

    except Exception as e:
        print(f"[ERROR] Failed to load config: {e}")
        sys.exit(1)

def validate_config(config: dict) -> bool:
    """验证配置完整性"""
    required_fields = ['networks', 'relayers', 'threshold', 'server']

    for field in required_fields:
        if field not in config:
            print(f"[ERROR] Missing required config field: {field}")
            return False

    if not config['networks']:
        print("[ERROR] No networks configured")
        return False

    if not config['relayers']:
        print("[ERROR] No relayers configured")
        return False

    if config['threshold'] > len(config['relayers']):
        print(f"[ERROR] Threshold ({config['threshold']}) exceeds number of relayers ({len(config['relayers'])})")
        return False

    print(f"[OK] Config validation passed")
    print(f"   Networks: {len(config['networks'])}")
    print(f"   Relayers: {len(config['relayers'])}")
    print(f"   Threshold: {config['threshold']}/{len(config['relayers'])}")

    return True

# 加载配置
CONFIG = load_config()
if not validate_config(CONFIG):
    sys.exit(1)

# ============================================================
# API Routes
# ============================================================

@app.route('/api/v1/health', methods=['GET'])
def health_check():
    """健康检查"""
    return jsonify({
        'code': 0,
        'message': 'Relayer API is healthy',
        'data': {
            'timestamp': int(time.time()),
            'version': '1.0.0',
            'backend': 'Python/Flask'
        }
    })

@app.route('/api/v1/message/<message_id>', methods=['GET'])
def get_message_status(message_id: str):
    """查询消息状态"""

    # 验证 messageId 格式
    if not message_id.startswith('0x') or len(message_id) != 66:
        return jsonify({
            'code': 400,
            'message': 'Invalid messageId format'
        }), 400

    # 查询消息
    msg_data = store.get_message(message_id)

    if not msg_data:
        return jsonify({
            'code': 3002,
            'message': 'Message not found'
        }), 404

    # 构建响应
    response = RelayerMessageResponse(
        messageId=message_id,
        status=msg_data.get('status', MessageStatus.PENDING),
        sourceChainId=msg_data.get('sourceChainId', '31337'),
        targetChainId=msg_data.get('targetChainId', '31337'),
        msgType=msg_data.get('msgType', 1),
        confirmations=msg_data.get('confirmations', 0),
        requiredConfirmations=12,  # 固定值，实际应从链适配器获取
        signatures=msg_data.get('signatures', 0),
        requiredSignatures=CONFIG.get('threshold', 2),
        createdAt=msg_data.get('createdAt', int(time.time())),
        deliveredAt=msg_data.get('deliveredAt', 0),
        txHash=msg_data.get('txHash', '')
    )

    return jsonify({
        'code': 0,
        'data': asdict(response)
    })

@app.route('/api/v1/message', methods=['POST'])
def create_message():
    """创建消息（用于测试）"""
    data = request.get_json()

    message_id = data.get('messageId')
    if not message_id:
        return jsonify({'code': 400, 'message': 'messageId is required'}), 400

    # 保存消息
    msg_data = {
        'messageId': message_id,
        'status': MessageStatus.PENDING,
        'sourceChainId': data.get('sourceChainId', '31337'),
        'targetChainId': data.get('targetChainId', '31337'),
        'msgType': data.get('msgType', 1),
        'confirmations': 0,
        'signatures': 0,
        'createdAt': int(time.time()),
        'deliveredAt': 0,
        'txHash': ''
    }

    store.save_message(message_id, msg_data)

    return jsonify({
        'code': 0,
        'message': 'Message created',
        'data': {'messageId': message_id}
    })

# ============================================================
# 全局核心组件实例
# ============================================================

# 初始化链适配器
chain_adapter = None
event_listener = None
message_signer = None
message_relayer = None

def init_relayer_components():
    """初始化 Relayer 核心组件"""
    global chain_adapter, event_listener, message_signer, message_relayer

    print("\n[INIT] Initializing Relayer components...")

    # 1. 初始化链适配器
    chain_adapter = ChainAdapter(CONFIG)

    # 2. 初始化多链签名器（每条链独立的 EIP-712 domain）
    message_signer = MultiChainSigner(CONFIG['relayers'], CONFIG['networks'])

    # 3. 初始化事件监听器
    event_listener = EventListener(chain_adapter, store, CONFIG)

    # 4. 初始化消息中继器
    message_relayer = MessageRelayer(chain_adapter, message_signer, store, CONFIG)

    # 5. 启动事件监听
    event_listener.start()

    # 6. 启动消息处理循环
    relayer_thread = threading.Thread(target=message_relay_worker, daemon=True)
    relayer_thread.start()

    print("[OK] Relayer components initialized\n")

def message_relay_worker():
    """
    后台线程：处理待中继的消息
    """
    print("[START] Message relay worker started")

    while True:
        try:
            # 处理待处理的消息
            message_relayer.process_pending_messages()
        except Exception as e:
            print(f"[ERROR] Error in relay worker: {e}")

        # 每5秒检查一次
        time.sleep(5)

# ============================================================
# Main
# ============================================================

if __name__ == '__main__':
    print('====================================================')
    print('   Cross-Chain Relayer API Server (Python)')
    print('====================================================')

    # 显示配置信息
    server_config = CONFIG.get('server', {'host': '0.0.0.0', 'port': 8080})
    host = server_config.get('host', '0.0.0.0')
    port = server_config.get('port', 8080)

    print(f'[START] Starting server on http://{host}:{port}')
    print(f'   Health: http://localhost:{port}/api/v1/health')
    print(f'   Message: http://localhost:{port}/api/v1/message/:messageId')
    print(f'\n[CONFIG] Configuration:')
    print(f'   Networks: {list(CONFIG["networks"].keys())}')
    print(f'   Relayers: {len(CONFIG["relayers"])} configured')
    print(f'   Threshold: {CONFIG["threshold"]}/{len(CONFIG["relayers"])}')
    print('====================================================\n')

    # 初始化 Relayer 核心组件
    init_relayer_components()

    # 启动 Flask 服务器
    app.run(host=host, port=port, debug=False)
