import { NextRequest, NextResponse } from 'next/server';
import dbManager from '@/lib/database';
import { readdir } from 'fs/promises';
import path from 'path';

// セッション情報の取得（ディレクトリ別グループ化）
export async function GET(request: NextRequest) {
  try {
    dbManager.init();

    const sessionsByDir = dbManager.getSessionsByWorkingDirectory();
    
    // セッション情報を整理
    const formattedSessions: { [directory: string]: any[] } = {};
    
    for (const [directory, conversations] of Object.entries(sessionsByDir)) {
      const sessionMap = new Map();
      
      conversations.forEach(conv => {
        if (!sessionMap.has(conv.session_id)) {
          sessionMap.set(conv.session_id, {
            id: conv.session_id,
            title: conv.user_input.substring(0, 30) + (conv.user_input.length > 30 ? '...' : ''),
            lastMessage: conv.user_input,
            timestamp: conv.timestamp,
            workingDirectory: conv.working_directory
          });
        }
      });
      
      formattedSessions[directory] = Array.from(sessionMap.values()).sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
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