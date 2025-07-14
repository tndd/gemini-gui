// アクティブセッション管理用のReactフック
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export interface UseActiveSessionOptions {
  autoActivateOnMount?: boolean;
  deactivateOnUnmount?: boolean;
}

export const useActiveSession = (
  sessionId: string,
  options: UseActiveSessionOptions = {}
) => {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  // セッションをアクティブに設定
  const activateSession = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/sessions/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });

      if (response.ok) {
        setIsActive(true);
        
        // URLを更新（オプション）
        if (typeof window !== 'undefined' && window.location.pathname === '/') {
          router.push(`/chat/${sessionId}`);
        }
      }
    } catch (error) {
      console.error('セッションアクティブ化エラー:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, router]);

  // セッションを非アクティブに設定
  const deactivateSession = useCallback(async () => {
    try {
      await fetch('/api/sessions/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      
      setIsActive(false);
    } catch (error) {
      console.error('セッション非アクティブ化エラー:', error);
    }
  }, [sessionId]);

  // アクティブセッション状態を確認
  const checkActiveStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/active`);
      const data = await response.json();
      
      setIsActive(data.activeSessionId === sessionId);
    } catch (error) {
      console.error('アクティブセッション状態確認エラー:', error);
      setIsActive(false);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // 初期化
  useEffect(() => {
    if (options.autoActivateOnMount) {
      // まずアクティブ状態をチェックし、非アクティブな場合のみアクティブ化
      checkActiveStatus().then(() => {
        // 少し待ってから再度チェック（状態の同期待ち）
        setTimeout(() => {
          if (!isActive) {
            activateSession();
          }
        }, 100);
      });
    } else {
      checkActiveStatus();
    }
  }, [sessionId]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (options.deactivateOnUnmount && isActive) {
        deactivateSession();
      }
    };
  }, [deactivateSession, isActive, options.deactivateOnUnmount]);

  // セッションアクセス時刻の更新
  const touchSession = useCallback(async () => {
    try {
      await fetch('/api/sessions/touch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
    } catch (error) {
      console.error('セッションタッチエラー:', error);
    }
  }, [sessionId]);

  return {
    isActive,
    isLoading,
    activateSession,
    deactivateSession,
    touchSession,
    checkActiveStatus
  };
};