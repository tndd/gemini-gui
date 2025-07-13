// アクティブセッションIDを管理（メモリ上のみ）
let activeSessionId: string | null = null;

export const getActiveSessionId = (): string | null => {
  return activeSessionId;
};

export const setActiveSessionId = (sessionId: string): void => {
  activeSessionId = sessionId;
};