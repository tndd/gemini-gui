import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// セッション情報の取得
export async function GET(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const params = await context.params;
    
    const session = await prisma.session.findUnique({
      where: { sessionId: params.sessionId },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' }
        }
      }
    });

    if (!session) {
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      session: {
        sessionId: session.sessionId,
        name: session.name,
        workingDirectory: session.workingDirectory,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString()
      },
      messages: session.messages.map(msg => ({
        id: msg.id,
        sessionId: msg.sessionId,
        user_input: msg.userInput,
        gemini_response: msg.geminiResponse,
        timestamp: msg.timestamp.toISOString()
      }))
    });

  } catch (error) {
    console.error('セッション取得エラー:', error);
    return NextResponse.json(
      { error: 'セッション情報の取得でエラーが発生しました' },
      { status: 500 }
    );
  }
}

// セッション情報の更新
export async function PATCH(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const params = await context.params;
    const { name, workingDirectory } = await request.json();

    if (!name && !workingDirectory) {
      return NextResponse.json(
        { error: 'セッション名または作業ディレクトリが必要です' },
        { status: 400 }
      );
    }

    const updateData: { name?: string; workingDirectory?: string } = {};
    if (name) updateData.name = name;
    if (workingDirectory) updateData.workingDirectory = workingDirectory;

    const session = await prisma.session.update({
      where: { sessionId: params.sessionId },
      data: updateData
    });

    return NextResponse.json({
      sessionId: session.sessionId,
      name: session.name,
      workingDirectory: session.workingDirectory,
      message: 'セッション情報が更新されました'
    });

  } catch (error) {
    console.error('セッション情報更新エラー:', error);
    return NextResponse.json(
      { error: 'セッション情報の更新でエラーが発生しました' },
      { status: 500 }
    );
  }
}