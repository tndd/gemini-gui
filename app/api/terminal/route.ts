import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
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
    const geminiResponse = await executeGeminiCli(fullPrompt, finalWorkingDir);
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

function executeGeminiCli(message: string, workingDirectory?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log('Executing Gemini CLI with message:', message);
    console.log('Working directory:', workingDirectory);
    
    const geminiProcess = spawn('gemini', ['--model', 'gemini-2.5-flash'], {
      cwd: workingDirectory || process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    geminiProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      console.log('stdout chunk:', JSON.stringify(chunk));
      output += chunk;
    });

    geminiProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      console.log('stderr chunk:', JSON.stringify(chunk));
      errorOutput += chunk;
    });

    geminiProcess.on('close', (code) => {
      console.log('Process closed with code:', code);
      console.log('Final output:', JSON.stringify(output));
      console.log('Final error:', JSON.stringify(errorOutput));
      
      if (code === 0) {
        // 最小限のクリーンアップ
        const cleanOutput = output
          .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '') // ANSIエスケープシーケンス
          .replace(/\x1b\[[0-9;]*m/g, '')         // カラーコード
          .replace(/\r\n/g, '\n')                 // Windows改行を正規化
          .replace(/\r/g, '\n')                   // Mac改行を正規化
          .trim();
        
        console.log('Cleaned output:', JSON.stringify(cleanOutput));
        resolve(cleanOutput);
      } else {
        reject(new Error(`Gemini CLI実行エラー (code ${code}): ${errorOutput}`));
      }
    });

    geminiProcess.on('error', (error) => {
      console.log('Process error:', error);
      reject(new Error(`Gemini CLI実行エラー: ${error.message}`));
    });

    // メッセージを送信して入力を終了
    console.log('Writing message to stdin:', JSON.stringify(message));
    geminiProcess.stdin.write(message);
    geminiProcess.stdin.end();
    console.log('Message sent and stdin closed');
  });
}