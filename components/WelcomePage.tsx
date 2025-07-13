'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface SessionUI {
  id: string;
  name: string;
  workingDirectory: string;
  createdAt: string;
  messageCount: number;
}

interface GroupedSessions {
  [directory: string]: SessionUI[];
}

export default function WelcomePage() {
  const [selectedDirectory, setSelectedDirectory] = useState('');
  const [availableDirectories, setAvailableDirectories] = useState<string[]>([]);
  const [groupedSessions, setGroupedSessions] = useState<GroupedSessions>({});
  const [showDirectoryInput, setShowDirectoryInput] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadSessions();
    loadAvailableDirectories();
  }, []);

  const loadSessions = async () => {
    try {
      const response = await fetch('/api/sessions');
      const data = await response.json();
      setGroupedSessions(data.groupedSessions || {});
    } catch (error) {
      console.error('セッション読み込みエラー:', error);
    }
  };

  const loadAvailableDirectories = async () => {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();
      setAvailableDirectories(data.availableDirectories || []);
    } catch (error) {
      console.error('ディレクトリ読み込みエラー:', error);
    }
  };

  const startNewChat = async (workingDirectory?: string) => {
    const newSessionId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
    const finalWorkingDir = workingDirectory || selectedDirectory || process.cwd();
    const sessionName = `新しいセッション ${new Date().toLocaleString('ja-JP')}`;
    
    try {
      await fetch('/api/sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: newSessionId,
          name: sessionName,
          workingDirectory: finalWorkingDir
        })
      });

      router.push(`/chat/${newSessionId}`);
    } catch (error) {
      console.error('セッション作成エラー:', error);
    }
  };

  const selectSession = (sessionId: string) => {
    router.push(`/chat/${sessionId}`);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      {/* 左側：セッション履歴 */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold">セッション履歴</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {Object.keys(groupedSessions).length === 0 ? (
            <p className="text-gray-400 text-center">まだセッションがありません</p>
          ) : (
            Object.entries(groupedSessions).map(([directory, sessions]) => (
              <div key={directory} className="mb-6">
                <h3 className="text-sm font-medium text-gray-300 mb-2 truncate" title={directory}>
                  📁 {directory}
                </h3>
                <div className="space-y-2">
                  {sessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => selectSession(session.id)}
                      className="w-full text-left p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      <div className="font-medium text-sm truncate">{session.name}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(session.createdAt).toLocaleDateString('ja-JP')} • {session.messageCount}件
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 右側：メインコンテンツ */}
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-2xl w-full p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">Gemini GUI</h1>
            <p className="text-gray-400">新しいチャットを開始するか、既存のセッションを選択してください</p>
          </div>

          <div className="space-y-6">
            {/* パス選択エリア */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">作業ディレクトリを選択</h2>
              
              {!showDirectoryInput ? (
                <div className="space-y-3">
                  {/* 最近使用したディレクトリ */}
                  {availableDirectories.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-300 mb-2">最近使用したディレクトリ</h3>
                      <div className="grid gap-2">
                        {availableDirectories.slice(0, 5).map((dir) => (
                          <button
                            key={dir}
                            onClick={() => startNewChat(dir)}
                            className="text-left p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                          >
                            <span className="text-sm">📁 {dir}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* 手動入力ボタン */}
                  <button
                    onClick={() => setShowDirectoryInput(true)}
                    className="w-full p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                  >
                    別のディレクトリを指定
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <input
                    type="text"
                    value={selectedDirectory}
                    onChange={(e) => setSelectedDirectory(e.target.value)}
                    placeholder="作業ディレクトリのパスを入力..."
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
                    autoFocus
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => startNewChat()}
                      disabled={!selectedDirectory}
                      className="flex-1 p-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                    >
                      チャットを開始
                    </button>
                    <button
                      onClick={() => setShowDirectoryInput(false)}
                      className="px-6 p-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* クイックアクション */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">クイックアクション</h2>
              <button
                onClick={() => startNewChat(process.cwd())}
                className="w-full p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-left"
              >
                <div className="font-medium">現在のディレクトリでチャット開始</div>
                <div className="text-sm text-gray-400 mt-1">すぐにチャットを始める</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}