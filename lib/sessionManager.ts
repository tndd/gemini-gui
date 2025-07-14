// 洗練されたセッション管理システム
import { prisma } from '@/lib/prisma';

export interface SessionState {
  sessionId: string;
  isActive: boolean;
  lastAccessed: Date;
  tabId?: string; // マルチタブ対応
}

class SessionManager {
  private static instance: SessionManager;
  private activeSession: string | null = null;
  private sessionStates: Map<string, SessionState> = new Map();

  private constructor() {}

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  // セッションをアクティブに設定
  async setActiveSession(sessionId: string, tabId?: string): Promise<void> {
    // 前のアクティブセッションを非アクティブに
    if (this.activeSession && this.activeSession !== sessionId) {
      await this.deactivateSession(this.activeSession);
    }

    this.activeSession = sessionId;
    
    // データベースを更新
    await this.updateSessionInDatabase(sessionId, true);
    
    // メモリ内の状態を更新
    this.sessionStates.set(sessionId, {
      sessionId,
      isActive: true,
      lastAccessed: new Date(),
      tabId
    });
  }

  // セッションを非アクティブに設定
  async deactivateSession(sessionId: string): Promise<void> {
    if (this.activeSession === sessionId) {
      this.activeSession = null;
    }

    await this.updateSessionInDatabase(sessionId, false);
    
    const state = this.sessionStates.get(sessionId);
    if (state) {
      this.sessionStates.set(sessionId, {
        ...state,
        isActive: false
      });
    }
  }

  // アクティブセッションを取得
  getActiveSession(): string | null {
    return this.activeSession;
  }

  // セッションがアクティブかどうかを判定
  isSessionActive(sessionId: string): boolean {
    return this.activeSession === sessionId;
  }

  // データベースからアクティブセッションを復元
  async restoreActiveSession(): Promise<string | null> {
    try {
      const activeSession = await prisma.session.findFirst({
        where: { isActive: true },
        orderBy: { lastAccessed: 'desc' }
      });

      if (activeSession) {
        this.activeSession = activeSession.sessionId;
        
        // メモリ内の状態も更新
        this.sessionStates.set(activeSession.sessionId, {
          sessionId: activeSession.sessionId,
          isActive: true,
          lastAccessed: activeSession.lastAccessed,
        });
        
        return activeSession.sessionId;
      }
    } catch (error) {
      console.error('アクティブセッション復元エラー:', error);
    }
    
    return null;
  }

  // セッションのアクセス時刻を更新
  async touchSession(sessionId: string): Promise<void> {
    const now = new Date();
    
    // データベースを更新
    await prisma.session.update({
      where: { sessionId },
      data: { lastAccessed: now }
    });

    // メモリ内の状態を更新
    const state = this.sessionStates.get(sessionId);
    if (state) {
      this.sessionStates.set(sessionId, {
        ...state,
        lastAccessed: now
      });
    }
  }

  // 複数のセッションを一括で非アクティブに設定
  async deactivateAllSessions(): Promise<void> {
    await prisma.session.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });
    
    this.activeSession = null;
    this.sessionStates.clear();
  }

  // プライベートメソッド: データベースのセッション状態を更新
  private async updateSessionInDatabase(sessionId: string, isActive: boolean): Promise<void> {
    try {
      await prisma.session.update({
        where: { sessionId },
        data: { 
          isActive,
          lastAccessed: new Date()
        }
      });
    } catch (error) {
      console.error('セッション状態更新エラー:', error);
    }
  }
}

export default SessionManager;