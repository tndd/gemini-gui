import { NextRequest, NextResponse } from 'next/server';
import dbManager from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, name, workingDirectory } = await request.json();

    if (!sessionId || !name || !workingDirectory) {
      return NextResponse.json(
        { error: 'セッションID、名前、作業ディレクトリが必要です' },
        { status: 400 }
      );
    }

    dbManager.init();
    dbManager.createSession(sessionId, name, workingDirectory);

    return NextResponse.json({
      sessionId,
      name,
      workingDirectory,
      message: 'セッションが作成されました'
    });

  } catch (error) {
    console.error('セッション作成エラー:', error);
    return NextResponse.json(
      { error: 'セッションの作成でエラーが発生しました' },
      { status: 500 }
    );
  }
}