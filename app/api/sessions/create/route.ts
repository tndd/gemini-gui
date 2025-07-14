import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import SessionManager from '@/lib/sessionManager';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, name, workingDirectory } = await request.json();

    if (!sessionId || !name || !workingDirectory) {
      return NextResponse.json(
        { error: 'セッションID、名前、作業ディレクトリが必要です' },
        { status: 400 }
      );
    }

    const session = await prisma.session.create({
      data: {
        sessionId,
        name,
        workingDirectory,
      }
    });

    // 新しいセッションをアクティブに設定
    const sessionManager = SessionManager.getInstance();
    await sessionManager.setActiveSession(sessionId);

    return NextResponse.json({
      sessionId: session.sessionId,
      name: session.name,
      workingDirectory: session.workingDirectory,
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