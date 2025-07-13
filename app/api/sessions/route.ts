import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readdir } from 'fs/promises';
import path from 'path';
import { getActiveSessionId } from '@/lib/activeSession';

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

    return NextResponse.json({ 
      sessionsByDirectory: sessionsByDir,
      latestSessionId: getActiveSessionId()
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
    const repositoryPath = path.join(process.env.HOME || '~', 'Repository');
    const targetPath = basePath || repositoryPath;

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
      directories: directories,
      repositoryRoot: repositoryPath
    });

  } catch (error) {
    console.error('ディレクトリ取得エラー:', error);
    return NextResponse.json(
      { error: 'ディレクトリ情報の取得でエラーが発生しました' },
      { status: 500 }
    );
  }
}