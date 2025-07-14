// セッションアクセス時刻更新API
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
    await sessionManager.touchSession(sessionId);

    return NextResponse.json({
      success: true,
      message: 'セッションのアクセス時刻が更新されました'
    });

  } catch (error) {
    console.error('セッションタッチエラー:', error);
    return NextResponse.json(
      { error: 'セッションのタッチでエラーが発生しました' },
      { status: 500 }
    );
  }
}