import { NextRequest, NextResponse } from 'next/server';
import { spawn, ChildProcess } from 'child_process';
import { prisma } from '@/lib/prisma';
import { setActiveSessionId } from '@/lib/activeSession';

// セッションIDとGemini CLIプロセスのマッピング
const sessionProcesses = new Map<string, ChildProcess>();

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

    // セッションのコンテキスト取得（過去のメッセージ）
    const previousMessages = await prisma.message.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'asc' },
      take: 10 // 最新10件のメッセージをコンテキストとして使用
    });

    // コンテキストを含むプロンプトを構築
    let fullPrompt = message;
    if (previousMessages.length > 0) {
      const contextMessages = previousMessages.map(msg => 
        `ユーザー: ${msg.userInput}\nアシスタント: ${msg.geminiResponse}`
      ).join('\n\n');
      
      fullPrompt = `過去の会話:\n${contextMessages}\n\n現在のメッセージ:\n${message}`;
    }

    console.log('About to execute Gemini CLI...');
    const geminiResponse = await executeGeminiCli(fullPrompt, sessionId, finalWorkingDir);
    console.log('Gemini CLI response received:', geminiResponse);

    // セッションが存在しない場合は作成
    if (!session) {
      console.log('Creating new session...');
      const sessionName = message.substring(0, 50) + (message.length > 50 ? '...' : '');
      await prisma.session.create({
        data: {
          sessionId,
          name: sessionName,
          workingDirectory: finalWorkingDir,
        }
      });
      console.log('New session created');
    }

    // メッセージを保存
    console.log('Saving message to database...');
    try {
      await prisma.message.create({
        data: {
          sessionId,
          userInput: message,
          geminiResponse: geminiResponse,
        }
      });
      console.log('Message saved successfully');
    } catch (dbError) {
      console.error('Database save error:', dbError);
      throw dbError;
    }

    // セッションの更新時刻を更新
    console.log('Updating session timestamp...');
    await prisma.session.update({
      where: { sessionId },
      data: { updatedAt: new Date() }
    });
    console.log('Session timestamp updated');

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

function getOrCreateGeminiProcess(sessionId: string, workingDirectory?: string): ChildProcess {
  // 既存プロセスがあればそれを返す
  if (sessionProcesses.has(sessionId)) {
    const existingProcess = sessionProcesses.get(sessionId)!;
    // プロセスが生きているかチェック
    if (!existingProcess.killed) {
      return existingProcess;
    }
    // 死んでいれば削除
    sessionProcesses.delete(sessionId);
  }

  // 新しいプロセスを作成
  const geminiProcess = spawn('gemini', ['--model', 'gemini-2.5-flash'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: workingDirectory || process.cwd()
  });

  // プロセス終了時にマップから削除
  geminiProcess.on('exit', () => {
    sessionProcesses.delete(sessionId);
  });

  // マップに登録
  sessionProcesses.set(sessionId, geminiProcess);
  
  return geminiProcess;
}

function executeGeminiCli(message: string, sessionId: string, workingDirectory?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log('Executing Gemini CLI with message:', message);
    console.log('Working directory:', workingDirectory);
    
    // セッション別プロセスを取得（既存があれば再利用、なければ新規作成）
    const geminiProcess = getOrCreateGeminiProcess(sessionId, workingDirectory);

    let output = '';
    let errorOutput = '';
    let responseComplete = false;

    const onData = (data: Buffer) => {
      const chunk = data.toString();
      console.log('stdout chunk:', JSON.stringify(chunk));
      output += chunk;
      
      // Gemini CLIの応答完了を検知（プロンプトが戻ってきたら完了）
      if (chunk.includes('> ') || chunk.endsWith('> ')) {
        if (!responseComplete) {
          responseComplete = true;
          // リスナーを削除
          geminiProcess.stdout?.off('data', onData);
          geminiProcess.stderr?.off('data', onError);
          geminiProcess.off('exit', onExit);
          
          // プロンプト部分を除去して返答のみ抽出
          const cleanOutput = output
            .replace(/> $/, '')                     // 最後のプロンプトを削除
            .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '') // ANSIエスケープシーケンス
            .replace(/\x1b\[[0-9;]*m/g, '')         // カラーコード
            .replace(/\r\n/g, '\n')                 // Windows改行を正規化
            .replace(/\r/g, '\n')                   // Mac改行を正規化
            .trim();
          
          console.log('Cleaned output:', JSON.stringify(cleanOutput));
          resolve(cleanOutput);
        }
      }
    };

    const onError = (data: Buffer) => {
      const chunk = data.toString();
      console.log('stderr chunk:', JSON.stringify(chunk));
      errorOutput += chunk;
    };

    const onExit = () => {
      if (!responseComplete) {
        reject(new Error(`Gemini CLI プロセスが予期せず終了しました。エラー: ${errorOutput}`));
      }
    };

    geminiProcess.stdout?.on('data', onData);
    geminiProcess.stderr?.on('data', onError);
    geminiProcess.on('exit', onExit);

    geminiProcess.on('error', (error) => {
      console.log('Process error:', error);
      reject(new Error(`Gemini CLI実行エラー: ${error.message}`));
    });

    // メッセージを送信
    console.log('Writing message to stdin:', JSON.stringify(message));
    geminiProcess.stdin?.write(message + '\n');
    
    // タイムアウト処理（30秒）
    setTimeout(() => {
      if (!responseComplete) {
        responseComplete = true;
        geminiProcess.stdout?.off('data', onData);
        geminiProcess.stderr?.off('data', onError);
        geminiProcess.off('exit', onExit);
        reject(new Error('Gemini CLI応答タイムアウト'));
      }
    }, 30000);
  });
}

export const terminateSessionProcess = (sessionId: string): void => {
  const process = sessionProcesses.get(sessionId);
  if (process && !process.killed) {
    process.kill();
  }
  sessionProcesses.delete(sessionId);
};

export const terminateAllProcesses = (): void => {
  sessionProcesses.forEach((process) => {
    if (!process.killed) {
      process.kill();
    }
  });
  sessionProcesses.clear();
};