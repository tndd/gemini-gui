import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import dbManager from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { message, sessionId, workingDirectory } = await request.json();

    if (!message || !sessionId) {
      return NextResponse.json(
        { error: 'メッセージとセッションIDが必要です' },
        { status: 400 }
      );
    }

    // データベースの初期化
    dbManager.init();

    // 既存セッションの作業ディレクトリを取得、なければ引数から、それもなければ現在のディレクトリ
    const sessionWorkingDir = dbManager.getSessionWorkingDirectory(sessionId);
    const finalWorkingDir = sessionWorkingDir || workingDirectory || process.cwd();

    // gemini-cliを実行
    const geminiResponse = await executeGeminiCli(message, finalWorkingDir);

    // 結果をデータベースに保存
    dbManager.saveConversation(message, geminiResponse, sessionId, finalWorkingDir);

    return NextResponse.json({
      response: geminiResponse,
      workingDirectory: finalWorkingDir,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Gemini CLI実行エラー:', error);
    return NextResponse.json(
      { error: 'Geminiとの通信でエラーが発生しました' },
      { status: 500 }
    );
  }
}

function executeGeminiCli(message: string, workingDirectory?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const geminiProcess = spawn('gemini', {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: workingDirectory || process.cwd()
    });

    let output = '';
    let errorOutput = '';

    geminiProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    geminiProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    geminiProcess.on('close', (code) => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(new Error(`Gemini CLI終了コード: ${code}, エラー: ${errorOutput}`));
      }
    });

    geminiProcess.on('error', (error) => {
      reject(new Error(`Gemini CLI実行エラー: ${error.message}`));
    });

    // メッセージを送信
    geminiProcess.stdin.write(message + '\n');
    geminiProcess.stdin.end();
  });
}

// 履歴取得用のGETエンドポイント
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    dbManager.init();

    if (sessionId) {
      const history = dbManager.getConversationHistory(sessionId);
      return NextResponse.json({ history });
    } else {
      const allConversations = dbManager.getAllConversations();
      return NextResponse.json({ conversations: allConversations });
    }

  } catch (error) {
    console.error('履歴取得エラー:', error);
    return NextResponse.json(
      { error: '履歴の取得でエラーが発生しました' },
      { status: 500 }
    );
  }
}