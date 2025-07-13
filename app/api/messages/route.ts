import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrCreateGeminiProcess } from '@/lib/geminiProcessManager';
import { setActiveSessionId } from '@/lib/activeSession';

export async function POST(request: NextRequest) {
  try {
    const { message, sessionId, workingDirectory } = await request.json();

    if (!message || !sessionId) {
      return NextResponse.json(
        { error: 'メッセージとセッションIDが必要です' },
        { status: 400 }
      );
    }

    // セッション情報を取得
    const session = await prisma.session.findUnique({
      where: { sessionId }
    });

    const finalWorkingDir = session?.workingDirectory || workingDirectory || process.cwd();

    // メッセージ送信でこのセッションをアクティブに設定
    setActiveSessionId(sessionId);

    const geminiResponse = await executeGeminiCli(message, sessionId, finalWorkingDir);

    // セッションが存在しない場合は作成
    if (!session) {
      const sessionName = message.substring(0, 50) + (message.length > 50 ? '...' : '');
      await prisma.session.create({
        data: {
          sessionId,
          name: sessionName,
          workingDirectory: finalWorkingDir,
        }
      });
    }

    // メッセージを保存
    await prisma.message.create({
      data: {
        sessionId,
        userInput: message,
        geminiResponse,
      }
    });

    // セッションの更新時刻を更新
    await prisma.session.update({
      where: { sessionId },
      data: { updatedAt: new Date() }
    });

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

function executeGeminiCli(message: string, sessionId: string, workingDirectory?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // セッション別プロセスを取得（既存があれば再利用、なければ新規作成）
    const geminiProcess = getOrCreateGeminiProcess(sessionId, workingDirectory);

    let output = '';
    let errorOutput = '';
    let responseComplete = false;

    const onData = (data: Buffer) => {
      const text = data.toString();
      output += text;
      
      // Gemini CLIの応答完了を検知（プロンプトが戻ってきたら完了）
      // これはgemini cliの出力パターンに依存するため、調整が必要かもしれません
      if (text.includes('> ') || text.endsWith('> ')) {
        if (!responseComplete) {
          responseComplete = true;
          // リスナーを削除
          geminiProcess.stdout.off('data', onData);
          geminiProcess.stderr.off('data', onError);
          
          // プロンプト部分を除去して返答のみ抽出
          const response = output.replace(/> $/, '').trim();
          resolve(response);
        }
      }
    };

    const onError = (data: Buffer) => {
      errorOutput += data.toString();
    };

    const onExit = () => {
      if (!responseComplete) {
        reject(new Error(`Gemini CLI プロセスが予期せず終了しました。エラー: ${errorOutput}`));
      }
    };

    geminiProcess.stdout.on('data', onData);
    geminiProcess.stderr.on('data', onError);
    geminiProcess.on('exit', onExit);

    geminiProcess.on('error', (error) => {
      reject(new Error(`Gemini CLI実行エラー: ${error.message}`));
    });

    // メッセージ送信
    geminiProcess.stdin.write(message + '\n');
    
    // タイムアウト処理（30秒）
    setTimeout(() => {
      if (!responseComplete) {
        responseComplete = true;
        geminiProcess.stdout.off('data', onData);
        geminiProcess.stderr.off('data', onError);
        geminiProcess.off('exit', onExit);
        reject(new Error('Gemini CLI応答タイムアウト'));
      }
    }, 30000);
  });
}