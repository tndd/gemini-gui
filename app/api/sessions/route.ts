import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readdir, stat } from 'fs/promises';
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
    const directoryEntries = entries
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'));

    // 各ディレクトリの更新時刻を取得
    const directoriesWithStats = await Promise.all(
      directoryEntries.map(async (entry) => {
        const fullPath = path.join(targetPath, entry.name);
        const stats = await stat(fullPath);
        return {
          name: entry.name,
          path: fullPath,
          mtime: stats.mtime
        };
      })
    );

    // 更新時刻順（新しい順）でソート
    const directories = directoriesWithStats
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
      .map(({ name, path }) => ({ name, path }))
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