import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateTerminal, sendToTerminal } from '@/lib/terminalManager';
import { prisma } from '@/lib/prisma';
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

    // ターミナルを取得または作成
    const terminal = getOrCreateTerminal(sessionId, finalWorkingDir);

    // 応答を待つためのPromise
    const response = await new Promise<string>((resolve, reject) => {
      let output = '';
      let responseStarted = false;
      
      const timeout = setTimeout(() => {
        reject(new Error('応答タイムアウト'));
      }, 30000);

      const onData = (data: string) => {
        output += data;
        
        // プロンプトが表示されたら応答完了
        if (data.includes('> ') && responseStarted) {
          clearTimeout(timeout);
          // プロンプト部分を除去
          const cleanOutput = output.replace(/> $/, '').trim();
          // 最後の応答部分のみ抽出（前回のプロンプト以降）
          const lastPromptIndex = cleanOutput.lastIndexOf('> ');
          const finalResponse = lastPromptIndex !== -1 
            ? cleanOutput.substring(lastPromptIndex + 2).trim()
            : cleanOutput;
          resolve(finalResponse);
        }
        
        // 初回プロンプト確認後、応答開始フラグを立てる
        if (data.includes('> ') && !responseStarted) {
          responseStarted = true;
        }
      };

      terminal.onData(onData);
      
      // メッセージを送信
      sendToTerminal(sessionId, message + '\r');
    });

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
        geminiResponse: response,
      }
    });

    // セッションの更新時刻を更新
    await prisma.session.update({
      where: { sessionId },
      data: { updatedAt: new Date() }
    });

    return NextResponse.json({
      response: response,
      workingDirectory: finalWorkingDir,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('ターミナル実行エラー:', error);
    return NextResponse.json(
      { error: 'ターミナルとの通信でエラーが発生しました' },
      { status: 500 }
    );
  }
}