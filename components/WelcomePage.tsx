'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SessionHistory from './SessionHistory';

export default function WelcomePage() {
  const [selectedDirectory, setSelectedDirectory] = useState('');
  const [availableDirectories, setAvailableDirectories] = useState<string[]>([]);
  const [showDirectoryInput, setShowDirectoryInput] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentDirectory, setCurrentDirectory] = useState('');
  const router = useRouter();

  useEffect(() => {
    loadAvailableDirectories();
    // 現在のディレクトリを取得
    if (typeof window !== 'undefined') {
      setCurrentDirectory('ブラウザ環境（サーバーの作業ディレクトリを使用）');
    }
  }, []);

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

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || isLoading) return;
    
    setIsLoading(true);
    const currentDirectory = process.cwd();
    
    try {
      // 新しいセッションを作成
      const newSessionId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
      const sessionName = `新しいセッション ${new Date().toLocaleString('ja-JP')}`;
      
      await fetch('/api/sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: newSessionId,
          name: sessionName,
          workingDirectory: currentDirectory
        })
      });

      // メッセージを送信
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: newSessionId,
          message: chatInput.trim()
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

            {/* チャット入力欄 */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">すぐにチャットを始める</h2>
              <p className="text-gray-400 mb-4 text-sm">
                {currentDirectory || 'サーバーの作業ディレクトリ'}でチャットを開始します
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