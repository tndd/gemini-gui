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
      // 最初のディレクトリを自動選択
      if (data.directories && data.directories.length > 0) {
        setSelectedDirectory(data.directories[0].path);
      }
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
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">Gemini GUI</h1>
            <p className="text-gray-400">新しいチャットを開始するか、既存のセッションを選択してください</p>
          </div>

          <div className="space-y-6">
            {/* パス選択エリア */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">作業ディレクトリを選択</h2>
              
              <div className="space-y-3">
                {/* Repository配下のディレクトリ */}
                {repositoryRoot && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-300 mb-2">~/Repository 配下のプロジェクト</h3>
                    <div className="grid gap-2">
                      {availableDirectories.map((dir) => (
                        <button
                          key={dir.path}
                          onClick={() => setSelectedDirectory(dir.path)}
                          className={`text-left p-3 rounded-lg transition-colors ${
                            selectedDirectory === dir.path 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-gray-700 hover:bg-gray-600'
                          }`}
                        >
                          <span className="text-sm">📁 {dir.name}</span>
                          <div className="text-xs text-gray-400 mt-1">{dir.path}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* チャット入力欄 */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">すぐにチャットを始める</h2>
              <p className="text-gray-400 mb-4 text-sm">
                選択したディレクトリ: {selectedDirectory || '未選択'}
              </p>
              
              <div className="flex gap-3">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Geminiに質問してください..."
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 resize-none"
                  rows={3}
                  disabled={isLoading}
                />
                <button
                  onClick={handleChatSubmit}
                  disabled={!chatInput.trim() || isLoading}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-colors flex items-center justify-center min-w-[80px]"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    '送信'
                  )}
                </button>
              </div>
              
              <p className="text-xs text-gray-500 mt-2">
                Enter で送信、Shift + Enter で改行
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}