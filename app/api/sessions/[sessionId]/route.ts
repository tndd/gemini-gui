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

    // 既存のセッション情報を取得
    const existingSession = await prisma.session.findUnique({
      where: { sessionId: params.sessionId }
    });

    if (!existingSession) {
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      );
    }

    const updateData: { name?: string; workingDirectory?: string; updatedAt?: Date } = {};
    if (name) updateData.name = name;
    if (workingDirectory) updateData.workingDirectory = workingDirectory;
    
    // セッション名のみの変更の場合、updatedAtを元の値に保持
    if (name && !workingDirectory) {
      updateData.updatedAt = existingSession.updatedAt;
    }

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

// セッションの削除
export async function DELETE(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const params = await context.params;
    
    // セッションが存在するかチェック
    const existingSession = await prisma.session.findUnique({
      where: { sessionId: params.sessionId }
    });

    if (!existingSession) {
      return NextResponse.json(
        { error: 'セッションが見つかりません' },
        { status: 404 }
      );
    }

    // セッションを削除（関連するメッセージも自動削除される：Prismaのcascade設定）
    await prisma.session.delete({
      where: { sessionId: params.sessionId }
    });

    return NextResponse.json({
      message: 'セッションが削除されました',
      sessionId: params.sessionId
    });

  } catch (error) {
    console.error('セッション削除エラー:', error);
    return NextResponse.json(
      { error: 'セッションの削除でエラーが発生しました' },
      { status: 500 }
    );
  }
}