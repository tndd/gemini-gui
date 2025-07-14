// セッションアクティブ化API
import { NextRequest, NextResponse } from 'next/server';
import SessionManager from '@/lib/sessionManager';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, tabId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'セッションIDが必要です' },
        { status: 400 }
      );
    }

    const sessionManager = SessionManager.getInstance();
    await sessionManager.setActiveSession(sessionId, tabId);

    return NextResponse.json({
      success: true,
      activeSessionId: sessionId,
      message: 'セッションがアクティブになりました'
    });

  } catch (error) {
    console.error('セッションアクティブ化エラー:', error);
    return NextResponse.json(
      { error: 'セッションのアクティブ化でエラーが発生しました' },
      { status: 500 }
    );
  }
}