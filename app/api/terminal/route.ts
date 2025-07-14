import { NextRequest, NextResponse } from 'next/server';
import { spawn, ChildProcess } from 'child_process';
import { prisma } from '@/lib/prisma';
import { createModuleLogger, createSessionLogger, timeStart, timeEnd } from '@/lib/logger';

// セッションIDとGemini CLIプロセスのマッピング（将来の機能拡張用）
// const sessionProcesses = new Map<string, ChildProcess>();

const logger = createModuleLogger('terminal-api');

export async function POST(request: NextRequest) {
  const startTime = timeStart('terminal-request');
  
  try {
    const { message, sessionId, workingDirectory } = await request.json();
    const sessionLogger = createSessionLogger(sessionId);

    if (!message || !sessionId) {
      logger.warn('リクエストに必要なパラメータが不足', { message: !!message, sessionId: !!sessionId });
      return NextResponse.json(
        { error: 'メッセージとセッションIDが必要です' },
        { status: 400 }
      );
    }

    sessionLogger.info('Gemini CLI実行開始', { messageLength: message.length, workingDirectory });

    // セッション情報を取得
    const session = await prisma.session.findUnique({
      where: { sessionId }
    });

    const finalWorkingDir = session?.workingDirectory || workingDirectory || process.cwd();
    sessionLogger.debug('作業ディレクトリ決定', { finalWorkingDir });

    // セッションのコンテキスト取得（過去のメッセージ）
    const previousMessages = await prisma.message.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'asc' },
      take: 10 // 最新10件のメッセージをコンテキストとして使用
    });

    sessionLogger.debug('コンテキスト取得完了', { previousMessagesCount: previousMessages.length });

    // コンテキストを含むプロンプトを構築
    let fullPrompt = message;
    if (previousMessages.length > 0) {
      const contextMessages = previousMessages.map(msg => 
        `ユーザー: ${msg.userInput}\nアシスタント: ${msg.geminiResponse}`
      ).join('\n\n');
      
      fullPrompt = `過去の会話:\n${contextMessages}\n\n現在のメッセージ:\n${message}`;
      sessionLogger.debug('コンテキスト付きプロンプト構築完了');
    }

    sessionLogger.debug('Gemini CLI実行中', { contextMessagesCount: previousMessages.length });
    const geminiResponse = await executeGeminiCli(fullPrompt, sessionId, finalWorkingDir);
    sessionLogger.info('Gemini CLI実行完了', { responseLength: geminiResponse.length });

    // セッションが存在しない場合は作成
    if (!session) {
      sessionLogger.info('新しいセッション作成中');
      const sessionName = message.substring(0, 50) + (message.length > 50 ? '...' : '');
      await prisma.session.create({
        data: {
          sessionId,
          name: sessionName,
          workingDirectory: finalWorkingDir,
        }
      });
      sessionLogger.info('新しいセッション作成完了', { sessionName });
    }

    // メッセージを保存
    sessionLogger.debug('メッセージをデータベースに保存中');
    try {
      await prisma.message.create({
        data: {
          sessionId,
          userInput: message,
          geminiResponse: geminiResponse,
        }
      });
      sessionLogger.debug('メッセージ保存完了');
    } catch (dbError) {
      sessionLogger.error('データベース保存エラー', dbError as Error);
      throw dbError;
    }

    // セッションの更新時刻を更新
    sessionLogger.debug('セッションタイムスタンプ更新中');
    await prisma.session.update({
      where: { sessionId },
      data: { updatedAt: new Date() }
    });
    sessionLogger.debug('セッションタイムスタンプ更新完了');

    timeEnd('terminal-request', startTime);
    sessionLogger.info('リクエスト処理完了');
    
    return NextResponse.json({
      response: geminiResponse,
      workingDirectory: finalWorkingDir,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Gemini CLI実行エラー', error as Error, { sessionId: request.url });
    timeEnd('terminal-request', startTime);
    return NextResponse.json(
      { error: 'Geminiとの通信でエラーが発生しました' },
      { status: 500 }
    );
  }
}

// プロセス再利用機能は将来の機能拡張用（現在は無効）
// function getOrCreateGeminiProcess(sessionId: string, workingDirectory?: string): ChildProcess {
//   // 既存プロセスがあればそれを返す
//   if (sessionProcesses.has(sessionId)) {
//     const existingProcess = sessionProcesses.get(sessionId)!;
//     // プロセスが生きているかチェック
//     if (!existingProcess.killed) {
//       return existingProcess;
//     }
//     // 死んでいれば削除
//     sessionProcesses.delete(sessionId);
//   }

//   // 新しいプロセスを作成
//   const geminiProcess = spawn('gemini', ['--model', 'gemini-2.5-flash'], {
//     stdio: ['pipe', 'pipe', 'pipe'],
//     cwd: workingDirectory || process.cwd()
//   });

//   // プロセス終了時にマップから削除
//   geminiProcess.on('exit', () => {
//     sessionProcesses.delete(sessionId);
//   });

//   // マップに登録
//   sessionProcesses.set(sessionId, geminiProcess);
  
//   return geminiProcess;
// }

function executeGeminiCli(message: string, sessionId: string, workingDirectory?: string): Promise<string> {
  const sessionLogger = createSessionLogger(sessionId);
  
  return new Promise((resolve, reject) => {
    sessionLogger.debug('Gemini CLIプロセス開始', { 
      messageLength: message.length, 
      workingDirectory 
    });
    
    const geminiProcess = spawn('gemini', ['--model', 'gemini-2.5-flash'], {
      cwd: workingDirectory || process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    geminiProcess.stdout?.on('data', (data) => {
      const chunk = data.toString();
      sessionLogger.debug('stdout chunk受信', { chunkLength: chunk.length });
      output += chunk;
    });

    geminiProcess.stderr?.on('data', (data) => {
      const chunk = data.toString();
      sessionLogger.debug('stderr chunk受信', { chunkLength: chunk.length });
      errorOutput += chunk;
    });

    geminiProcess.on('close', (code) => {
      sessionLogger.debug('Gemini CLIプロセス終了', { 
        exitCode: code,
        outputLength: output.length,
        errorLength: errorOutput.length
      });
      
      if (code === 0) {
        // 最小限のクリーンアップ
        const cleanOutput = output
          .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '') // ANSIエスケープシーケンス
          .replace(/\x1b\[[0-9;]*m/g, '')         // カラーコード
          .replace(/\r\n/g, '\n')                 // Windows改行を正規化
          .replace(/\r/g, '\n')                   // Mac改行を正規化
          .replace(/^Loaded cached credentials\.\s*/gm, '') // クレデンシャルロードメッセージを除去
          .trim();
        
        sessionLogger.debug('出力クリーンアップ完了', { 
          originalLength: output.length,
          cleanedLength: cleanOutput.length
        });
        resolve(cleanOutput);
      } else {
        sessionLogger.error('Gemini CLIプロセスエラー', new Error(`Exit code: ${code}`), { 
          exitCode: code,
          errorOutput 
        });
        reject(new Error(`Gemini CLI実行エラー (code ${code}): ${errorOutput}`));
      }
    });

    geminiProcess.on('error', (error) => {
      sessionLogger.error('Gemini CLIプロセスエラー', error);
      reject(new Error(`Gemini CLI実行エラー: ${error.message}`));
    });

    // メッセージを送信して入力を終了
    sessionLogger.debug('メッセージを stdin に送信', { messageLength: message.length });
    geminiProcess.stdin?.write(message);
    geminiProcess.stdin?.end();
    sessionLogger.debug('stdin 送信完了');
  });
}

// セッションプロセス終了のユーティリティ関数（将来の機能拡張用）
// const terminateSessionProcess = (sessionId: string): void => {
//   const process = sessionProcesses.get(sessionId);
//   if (process && !process.killed) {
//     process.kill();
//   }
//   sessionProcesses.delete(sessionId);
// };

// const terminateAllProcesses = (): void => {
//   sessionProcesses.forEach((process) => {
//     if (!process.killed) {
//       process.kill();
//     }
//   });
//   sessionProcesses.clear();
// };