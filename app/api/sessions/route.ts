import { NextRequest, NextResponse } from 'next/server';
import dbManager from '@/lib/database';
import { readdir } from 'fs/promises';
import path from 'path';

// セッション情報の取得（ディレクトリ別グループ化）
export async function GET() {
  try {
    dbManager.init();

    const sessionsByDir = dbManager.getSessionsByWorkingDirectory();
    
    // セッション情報を整理
    const formattedSessions: { [directory: string]: any[] } = {};
    
    for (const [directory, sessions] of Object.entries(sessionsByDir)) {
      formattedSessions[directory] = sessions.map(session => ({
        id: session.session_id,
        title: session.name,
        timestamp: session.updated_at,
        workingDirectory: session.working_directory,
        createdAt: session.created_at
      }));
    }

    return NextResponse.json({ sessionsByDirectory: formattedSessions });

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