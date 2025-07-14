// セッション非アクティブ化API
import { NextRequest, NextResponse } from 'next/server';
import SessionManager from '@/lib/sessionManager';

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'セッションIDが必要です' },
        { status: 400 }
      );
    }

    const sessionManager = SessionManager.getInstance();
    await sessionManager.deactivateSession(sessionId);

    return NextResponse.json({
      success: true,
      message: 'セッションが非アクティブになりました'
    });

  } catch (error) {
    console.error('セッション非アクティブ化エラー:', error);
    return NextResponse.json(
      { error: 'セッションの非アクティブ化でエラーが発生しました' },
      { status: 500 }
    );
  }
}