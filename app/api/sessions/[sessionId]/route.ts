import { NextRequest, NextResponse } from 'next/server';
import dbManager from '@/lib/database';

// セッション情報の取得
export async function GET(request: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    dbManager.init();
    
    const session = dbManager.getSession(params.sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      );
    }

    const messages = dbManager.getSessionMessages(params.sessionId);

    return NextResponse.json({
      session,
      messages
    });

  } catch (error) {
    console.error('セッション取得エラー:', error);
    return NextResponse.json(
      { error: 'セッション情報の取得でエラーが発生しました' },
      { status: 500 }
    );
  }
}

// セッション名の更新
export async function PATCH(request: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const { name } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'セッション名が必要です' },
        { status: 400 }
      );
    }

    dbManager.init();
    dbManager.updateSessionName(params.sessionId, name);

    return NextResponse.json({
      sessionId: params.sessionId,
      name,
      message: 'セッション名が更新されました'
    });

  } catch (error) {
    console.error('セッション名更新エラー:', error);
    return NextResponse.json(
      { error: 'セッション名の更新でエラーが発生しました' },
      { status: 500 }
    );
  }
}