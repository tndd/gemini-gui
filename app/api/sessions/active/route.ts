// アクティブセッション取得API
import { NextRequest, NextResponse } from 'next/server';
import SessionManager from '@/lib/sessionManager';

export async function GET(request: NextRequest) {
  try {
    const sessionManager = SessionManager.getInstance();
    
    // サーバー起動時にデータベースからアクティブセッションを復元
    let activeSessionId = sessionManager.getActiveSession();
    
    if (!activeSessionId) {
      activeSessionId = await sessionManager.restoreActiveSession();
    }

    return NextResponse.json({
      activeSessionId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('アクティブセッション取得エラー:', error);
    return NextResponse.json(
      { error: 'アクティブセッションの取得でエラーが発生しました' },
      { status: 500 }
    );
  }
}