import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readdir } from 'fs/promises';
import path from 'path';

// セッション情報の取得（ディレクトリ別グループ化）
export async function GET() {
  try {
    const sessions = await prisma.session.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    // ディレクトリ別にグループ化
    const sessionsByDir: { [directory: string]: any[] } = {};
    
    sessions.forEach(session => {
      const dir = session.workingDirectory;
      if (!sessionsByDir[dir]) {
        sessionsByDir[dir] = [];
      }
      sessionsByDir[dir].push({
        id: session.sessionId,
        title: session.name,
        timestamp: session.updatedAt.toISOString(),
        workingDirectory: session.workingDirectory,
        createdAt: session.createdAt.toISOString()
      });
    });

    // 最新セッション（最後にメッセージが送信されたセッション）を特定
    const latestMessage = await prisma.message.findFirst({
      orderBy: { timestamp: 'desc' },
      include: { session: true }
    });
    
    const latestSession = latestMessage?.session || null;
    
    return NextResponse.json({ 
      sessionsByDirectory: sessionsByDir,
      latestSessionId: latestSession?.sessionId || null
    });

  } catch (error) {
    console.error('セッション取得エラー:', error);
    return NextResponse.json(
      { error: 'セッション情報の取得でエラーが発生しました' },
      { status: 500 }
    );
  }
}

// 指定ディレクトリの作業ディレクトリ候補を取得
export async function POST(request: NextRequest) {
  try {
    const { basePath } = await request.json();
    const targetPath = basePath || process.cwd();

    const entries = await readdir(targetPath, { withFileTypes: true });
    const directories = entries
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
      .map(entry => ({
        name: entry.name,
        path: path.join(targetPath, entry.name)
      }))
      .slice(0, 20); // 最大20個まで

    return NextResponse.json({
      currentPath: targetPath,
      directories: directories
    });

  } catch (error) {
    console.error('ディレクトリ取得エラー:', error);
    return NextResponse.json(
      { error: 'ディレクトリ情報の取得でエラーが発生しました' },
      { status: 500 }
    );
  }
}