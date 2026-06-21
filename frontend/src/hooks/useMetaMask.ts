import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

// 声明 window.ethereum 类型
declare global {
  interface Window {
    ethereum?: any;
  }
}

export function useMetaMask() {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);

  // 连接钱包
  const connect = async () => {
    if (!window.ethereum) {
      alert('请安装 MetaMask 插件');
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const chain = await window.ethereum.request({ method: 'eth_chainId' });
      setAccount(ethers.utils.getAddress(accounts[0])); // 转为 checksum 地址
      setChainId(parseInt(chain, 16).toString());
      setIsActive(true);
    } catch (error) {
      console.error('连接失败', error);
    }
  };

  // 断开连接（仅清除本地状态，MetaMask 本身无法强制断开）
  const disconnect = () => {
    setAccount(null);
    setChainId(null);
    setIsActive(false);
  };

  // 监听账户/网络变化
  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        setAccount(ethers.utils.getAddress(accounts[0]));
        setIsActive(true);
      }
    };
    const handleChainChanged = (chainIdHex: string) => {
      setChainId(parseInt(chainIdHex, 16).toString());
      window.location.reload(); // 推荐刷新页面避免状态混乱
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, []);

  return { connect, disconnect, account, chainId, isActive };
}