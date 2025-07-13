import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { prisma } from '@/lib/prisma';

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

    const geminiResponse = await executeGeminiCli(message, finalWorkingDir);

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

    geminiProcess.stdin.write(message + '\n');
    geminiProcess.stdin.end();
  });
}