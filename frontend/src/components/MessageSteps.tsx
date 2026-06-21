import { useEffect, useState } from 'react';
import { useSDK } from '../context/SDKContext';

interface Props {
  messageId: string;
}

export function MessageSteps({ messageId }: Props) {
  const sdk = useSDK();
  const [status, setStatus] = useState<string>('pending');

  useEffect(() => {
    if (!messageId || !sdk) return;
    const interval = setInterval(async () => {
      try {
        const res = await sdk.getMessageStatus({ messageId });
        setStatus(res.status);
        if (res.status === 'delivered' || res.status === 'failed') clearInterval(interval);
      } catch (err) {
        console.error('获取消息状态失败', err);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [messageId, sdk]);

  return (
    <div style={{ marginTop: '1rem', padding: '0.5rem', background: '#f0f0f0' }}>
      跨链消息状态: {status}
    </div>
  );
}