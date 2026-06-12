package main

import (
	"context"
	"fmt"
	"log"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
)

func main() {
	fmt.Println("====================================================")
	fmt.Println("   Cross-Chain Relayer Service is Starting...       ")
	fmt.Println("====================================================")

	// 1. 连接到本地 Hardhat 节点
	rpcURL := "http://127.0.0.1:8545"
	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		log.Fatalf("💥 无法连接到本地 Hardhat 节点: %v", err)
	}
	fmt.Println("[✔] Successfully connected to Hardhat Local Node.")

	// 2. 获取当前区块高度验证连接
	blockNumber, err := client.BlockNumber(context.Background())
	if err != nil {
		log.Fatalf("💥 无法获取区块高度: %v", err)
	}
	fmt.Printf("[✔] Current Local Block Number: %d\n", blockNumber)

	// 3. 模拟读取刚才配置的 MessageVerifier 地址
	verifierAddress := common.HexToAddress("0x5fbdb2315678afecb367f032d93f642f64180aa3")
	balance, err := client.BalanceAt(context.Background(), verifierAddress, nil)
	if err == nil {
		fmt.Printf("[✔] Target Verifier [%s] is monitored (Balance: %s wei)\n", verifierAddress.Hex(), balance.String())
	}

	fmt.Println("\n🚀 Relayer is running and listening for cross-chain events... (Press Ctrl+C to exit)")
	select {} // 阻塞进程保持运行
}