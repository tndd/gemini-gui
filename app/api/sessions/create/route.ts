import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { setActiveSessionId } from '@/lib/activeSession';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('sessions-create');

export async function POST(request: NextRequest) {
  try {
    const { sessionId, name, workingDirectory } = await request.json();
    
    logger.info('新しいセッション作成リクエスト', { sessionId, name, workingDirectory });

    if (!sessionId || !name || !workingDirectory) {
      logger.warn('セッション作成パラメータ不足', { sessionId: !!sessionId, name: !!name, workingDirectory: !!workingDirectory });
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
    setActiveSessionId(sessionId);
    logger.info('セッション作成完了', { sessionId });

    return NextResponse.json({
      sessionId: session.sessionId,
      name: session.name,
      workingDirectory: session.workingDirectory,
      message: 'セッションが作成されました'
    });

  } catch (error) {
    logger.error('セッション作成エラー', error as Error);
    return NextResponse.json(
      { error: 'セッションの作成でエラーが発生しました' },
      { status: 500 }
    );
  }
}