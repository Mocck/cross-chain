// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ICrossChain.sol";

/**
 * @title MessageVerifier
 * @notice 负责多签 Relayer 验证、EIP-712 签名解析以及跨链防重放攻击
 */
contract MessageVerifier is ICrossChain, Ownable {
    using ECDSA for bytes32;

    uint256 public threshold;
    mapping(address => bool) public isRelayer;
    mapping(bytes32 => bool) public processedMessages;

    bytes32 public constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    bytes32 public constant MESSAGE_TYPEHASH = keccak256(
        "CrossChainMessage(uint256 messageId,uint256 sourceChainId,uint256 targetChainId,address sender,address receiver,uint8 msgType,bytes data,uint256 timestamp,uint256 timeout)"
    );
    
    bytes32 public immutable DOMAIN_SEPARATOR;

    event RelayerStatusChanged(address indexed relayer, bool status);
    event ThresholdChanged(uint256 newThreshold);
    event MessageVerified(bytes32 indexed messageId, uint256 sourceChainId);

    constructor(address[] memory _relayers, uint256 _threshold) Ownable(msg.sender) {
        require(_threshold > 0 && _threshold <= _relayers.length, "Invalid threshold");
        for (uint256 i = 0; i < _relayers.length; i++) {
            require(_relayers[i] != address(0), "Zero address detection");
            isRelayer[_relayers[i]] = true;
        }
        threshold = _threshold;

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256("CrossChainBetting"),
                keccak256("1.0.0"),
                block.chainid,
                address(this)
            )
        );
    }

    function setRelayer(address _relayer, bool _status) external onlyOwner {
        isRelayer[_relayer] = _status;
        emit RelayerStatusChanged(_relayer, _status);
    }

    function setThreshold(uint256 _threshold) external onlyOwner {
        threshold = _threshold;
        emit ThresholdChanged(_threshold);
    }

    /**
     * @notice 计算符合 EIP-712 标准的签名哈希值
     */
    function getEIP712SignHash(CrossChainMessage memory message) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                MESSAGE_TYPEHASH,
                message.messageId,
                message.sourceChainId,
                message.targetChainId,
                message.sender,
                message.receiver,
                message.msgType,
                keccak256(message.data),
                message.timestamp,
                message.timeout
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    }

    /**
     * @notice 校验门限聚合签名并防止重放攻击
     */
    function verifyMessage(
        CrossChainMessage calldata message,
        bytes[] calldata signatures
    ) external returns (bool) {
        require(message.targetChainId == block.chainid, "Wrong target chain");
        require(message.timeout > block.timestamp, "Message expired");
        require(!processedMessages[bytes32(message.messageId)], "Message already processed");
        require(signatures.length >= threshold, "Insufficient signatures");

        bytes32 signHash = getEIP712SignHash(message);
        address lastSigner = address(0);

        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = signHash.recover(signatures[i]);
            require(isRelayer[signer], "Invalid relayer signature");
            require(signer > lastSigner, "Signatures must be sorted by signer address"); // 严格去重新规
            lastSigner = signer;
        }

        processedMessages[bytes32(message.messageId)] = true;
        emit MessageVerified(bytes32(message.messageId), message.sourceChainId);
        return true;
    }
}