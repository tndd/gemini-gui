'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SessionHistory from './SessionHistory';

export default function WelcomePage() {
  const [selectedDirectory, setSelectedDirectory] = useState('');
  const [availableDirectories, setAvailableDirectories] = useState<{name: string, path: string}[]>([]);
  const [showDirectoryInput, setShowDirectoryInput] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [repositoryRoot, setRepositoryRoot] = useState('');
  const router = useRouter();

  useEffect(() => {
    loadAvailableDirectories();
  }, []);

  const loadAvailableDirectories = async () => {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();
      setAvailableDirectories(data.directories || []);
      setRepositoryRoot(data.repositoryRoot || '');
      // 最初は未選択状態にする
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

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || isLoading) return;
    if (!selectedDirectory) {
      alert('作業ディレクトリを選択してください');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // 新しいセッションを作成
      const newSessionId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
      const sessionName = chatInput.substring(0, 50) + (chatInput.length > 50 ? '...' : '');
      
      await fetch('/api/sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: newSessionId,
          name: sessionName,
          workingDirectory: selectedDirectory
        })
      });

      // メッセージを送信
      await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: newSessionId,
          message: chatInput.trim(),
          workingDirectory: selectedDirectory
        })
      });

      // チャットページに遷移
      router.push(`/chat/${newSessionId}`);
    } catch (error) {
      console.error('チャット開始エラー:', error);
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      {/* 左側：セッション履歴 */}
      <SessionHistory showNewChatButton={false} />

      {/* 右側：メインコンテンツ */}
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-2xl w-full p-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Gemini GUI</h1>
            <p className="text-gray-400">新しいチャットを開始するか、既存のセッションを選択してください</p>
          </div>

          {/* チャット入力欄 - 中央配置 */}
          <div className="bg-gray-800 rounded-lg p-8 max-w-xl mx-auto">
            <h2 className="text-2xl font-semibold mb-6 text-center">新しいチャットを開始</h2>
            
            <div className="space-y-4">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Geminiに質問してください..."
                className="w-full p-4 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 resize-none text-base"
                rows={3}
                disabled={isLoading}
              />
              <div className="flex justify-between items-center">
                <button
                  onClick={() => setShowDirectoryInput(true)}
                  className="text-xs text-gray-400 hover:text-gray-300 transition-colors flex items-center gap-1"
                >
                  📁 {selectedDirectory ? selectedDirectory.split('/').pop() : 'ディレクトリを選択'}
                  <span className="text-gray-500">▼</span>
                </button>
                <button
                  onClick={handleChatSubmit}
                  disabled={!chatInput.trim() || !selectedDirectory || isLoading}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {isLoading ? '送信中...' : '送信'}
                </button>
              </div>
            </div>
          </div>

          {/* ディレクトリ選択モーダル */}
          {showDirectoryInput && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-semibold mb-4">作業ディレクトリを選択</h3>
                
                {repositoryRoot && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-400 mb-3">~/Repository 配下のプロジェクト:</p>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {availableDirectories.map((dir) => (
                        <button
                          key={dir.path}
                          onClick={() => {
                            setSelectedDirectory(dir.path);
                            setShowDirectoryInput(false);
                          }}
                          className="w-full text-left p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                        >
                          <div className="font-medium">📁 {dir.name}</div>
                          <div className="text-xs text-gray-400">{dir.path}</div>
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => setShowDirectoryInput(false)}
                        className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}