'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: string;
}

interface SessionUI {
  id: string;
  title: string;
  timestamp: string;
  workingDirectory: string;
  createdAt: string;
}

interface DirectoryInfo {
  name: string;
  path: string;
}

interface ChatInterfaceProps {
  initialSessionId?: string;
}

export default function ChatInterface({ initialSessionId }: ChatInterfaceProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionsByDirectory, setSessionsByDirectory] = useState<{ [directory: string]: SessionUI[] }>({});
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showDirectorySelector, setShowDirectorySelector] = useState(false);
  const [selectedDirectory, setSelectedDirectory] = useState<string>('');
  const [availableDirectories, setAvailableDirectories] = useState<DirectoryInfo[]>([]);
  const [sessionId, setSessionId] = useState(() => 
    initialSessionId || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString())
  );
  const [currentWorkingDirectory, setCurrentWorkingDirectory] = useState<string>('');
  const [currentSessionName, setCurrentSessionName] = useState<string>('');
  const [editingSessionId, setEditingSessionId] = useState<string>('');
  const [editingSessionName, setEditingSessionName] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadSessions();
    // 初期セッションIDが指定されている場合、そのセッションの履歴を読み込む
    if (initialSessionId) {
      loadSessionHistory(initialSessionId);
    }
  }, []);

  useEffect(() => {
    // initialSessionIdが変更された場合、セッションを切り替える
    if (initialSessionId && initialSessionId !== sessionId) {
      setSessionId(initialSessionId);
      loadSessionHistory(initialSessionId);
    }
  }, [initialSessionId]);

  const loadSessions = async () => {
    try {
      const response = await fetch('/api/sessions');
      const data = await response.json();
      
      if (data.sessionsByDirectory) {
        setSessionsByDirectory(data.sessionsByDirectory);
      }
    } catch (error) {
      console.error('セッション読み込みエラー:', error);
    }
  };

  const loadDirectories = async (basePath?: string) => {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basePath })
      });
      const data = await response.json();
      
      if (data.directories) {
        setAvailableDirectories(data.directories);
        if (!selectedDirectory) {
          setSelectedDirectory(data.currentPath);
        }
      }
    } catch (error) {
      console.error('ディレクトリ読み込みエラー:', error);
    }
  };

  const loadSessionHistory = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      const data = await response.json();
      
      if (data.session && data.messages) {
        setCurrentSessionName(data.session.name);
        setCurrentWorkingDirectory(data.session.working_directory);
        
        const loadedMessages: Message[] = [];
        data.messages.forEach((msg: any) => {
          loadedMessages.push({
            id: `${msg.id}-user`,
            content: msg.user_input,
            sender: 'user',
            timestamp: msg.timestamp
          });
          loadedMessages.push({
            id: `${msg.id}-assistant`,
            content: msg.gemini_response,
            sender: 'assistant',
            timestamp: msg.timestamp
          });
        });
        setMessages(loadedMessages);
      }
    } catch (error) {
      console.error('履歴読み込みエラー:', error);
    }
  };

  const createNewSession = async (workingDirectory?: string, sessionName?: string) => {
    // 現在のセッションが空の場合（メッセージがない場合）は新しいセッションを作成せずに現在のセッションを再利用
    if (messages.length === 0 && sessionId) {
      // 既存の空のセッションがある場合は、ディレクトリやセッション名だけ更新
      const finalWorkingDir = workingDirectory || selectedDirectory || process.cwd();
      const finalSessionName = sessionName || currentSessionName || `新しいセッション ${new Date().toLocaleString('ja-JP')}`;
      
      setCurrentWorkingDirectory(finalWorkingDir);
      setCurrentSessionName(finalSessionName);
      setShowDirectorySelector(false);
      
      // セッション名やディレクトリが変更された場合はデータベースを更新
      if (workingDirectory || sessionName) {
        try {
          await fetch(`/api/sessions/${sessionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: finalSessionName,
              workingDirectory: finalWorkingDir
            })
          });
          loadSessions();
        } catch (error) {
          console.error('セッション更新エラー:', error);
        }
      }
      return;
    }

    const newSessionId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
    const finalWorkingDir = workingDirectory || selectedDirectory || process.cwd();
    const finalSessionName = sessionName || `新しいセッション ${new Date().toLocaleString('ja-JP')}`;
    
    try {
      // セッションをデータベースに作成
      await fetch('/api/sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: newSessionId,
          name: finalSessionName,
          workingDirectory: finalWorkingDir
        })
      });

      setSessionId(newSessionId);
      setMessages([]);
      setCurrentWorkingDirectory(finalWorkingDir);
      setCurrentSessionName(finalSessionName);
      setShowDirectorySelector(false);
      loadSessions();
      
      // 新しいセッションページに遷移
      router.push(`/chat/${newSessionId}`);
    } catch (error) {
      console.error('セッション作成エラー:', error);
    }
  };

  const selectSession = (session: SessionUI) => {
    // ページ遷移でセッションを切り替える
    router.push(`/chat/${session.id}`);
  };

  const openDirectorySelector = () => {
    setShowDirectorySelector(true);
    loadDirectories();
  };

  const startEditingSession = (session: SessionUI) => {
    setEditingSessionId(session.id);
    setEditingSessionName(session.title);
  };

  const saveSessionName = async () => {
    if (!editingSessionName.trim()) return;

    try {
      await fetch(`/api/sessions/${editingSessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingSessionName })
      });

      if (editingSessionId === sessionId) {
        setCurrentSessionName(editingSessionName);
      }

      setEditingSessionId('');
      setEditingSessionName('');
      loadSessions();
    } catch (error) {
      console.error('セッション名更新エラー:', error);
    }
  };

  const cancelEditingSession = () => {
    setEditingSessionId('');
    setEditingSessionName('');
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentInput,
          sessionId: sessionId,
          workingDirectory: currentWorkingDirectory
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        sender: 'assistant',
        timestamp: data.timestamp
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // セッションの最初のメッセージの場合、セッション名を自動更新
      if (messages.length === 0) {
        const newSessionName = currentInput.substring(0, 50) + (currentInput.length > 50 ? '...' : '');
        try {
          await fetch(`/api/sessions/${sessionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newSessionName })
          });
          setCurrentSessionName(newSessionName);
        } catch (error) {
          console.error('セッション名更新エラー:', error);
        }
      }
      
      loadSessions(); // セッション一覧を更新

    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `エラー: ${error instanceof Error ? error.message : '不明なエラーが発生しました'}`,
        sender: 'assistant',
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-screen bg-gray-800 text-white">
      {/* サイドバー */}
      <div className={`${isSidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-gray-900 border-r border-gray-700 flex flex-col overflow-hidden`}>
        <div className="p-4 border-b border-gray-700 space-y-2">
          <button
            onClick={() => createNewSession()}
            className="w-full bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <span>+</span>
            新しいチャット
          </button>
          <button
            onClick={openDirectorySelector}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <span>📁</span>
            ディレクトリを選択
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {Object.entries(sessionsByDirectory).map(([directory, sessions]) => (
            <div key={directory} className="mb-4">
              <div className="text-xs text-gray-400 px-2 py-1 font-medium truncate">
                📁 {directory.split('/').pop() || directory}
              </div>
              <div className="text-xs text-gray-500 px-2 mb-2 truncate">
                {directory}
              </div>
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`p-3 rounded-lg mb-2 ml-2 transition-colors group ${
                    session.id === sessionId 
                      ? 'bg-gray-700' 
                      : 'hover:bg-gray-800'
                  }`}
                >
                  {editingSessionId === session.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editingSessionName}
                        onChange={(e) => setEditingSessionName(e.target.value)}
                        className="w-full bg-gray-600 text-white px-2 py-1 rounded text-sm"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') saveSessionName();
                          if (e.key === 'Escape') cancelEditingSession();
                        }}
                        autoFocus
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={saveSessionName}
                          className="text-xs bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded"
                        >
                          保存
                        </button>
                        <button
                          onClick={cancelEditingSession}
                          className="text-xs bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded"
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div onClick={() => selectSession(session)} className="cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium truncate flex-1">{session.title}</div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingSession(session);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white ml-2 text-xs"
                        >
                          ✏️
                        </button>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(session.timestamp).toLocaleDateString('ja-JP')}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ディレクトリ選択モーダル */}
      {showDirectorySelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-96 max-h-96 overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-white">作業ディレクトリを選択</h3>
            
            <div className="mb-4">
              <input
                type="text"
                value={selectedDirectory}
                onChange={(e) => setSelectedDirectory(e.target.value)}
                placeholder="ディレクトリパスを入力..."
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>

            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {availableDirectories.map((dir) => (
                <div
                  key={dir.path}
                  onClick={() => setSelectedDirectory(dir.path)}
                  className="p-2 bg-gray-700 hover:bg-gray-600 rounded cursor-pointer transition-colors"
                >
                  <div className="text-sm text-white">📁 {dir.name}</div>
                  <div className="text-xs text-gray-400 truncate">{dir.path}</div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => createNewSession(selectedDirectory)}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 px-4 rounded transition-colors"
              >
                新しいチャットを開始
              </button>
              <button
                onClick={() => setShowDirectorySelector(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* メインコンテンツエリア */}
      <div className="flex-1 flex flex-col">
        {/* ヘッダー */}
        <div className="bg-gray-900 border-b border-gray-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <span className="text-lg">☰</span>
            </button>
            <div>
              <h1 className="text-lg font-semibold text-white">
                {currentSessionName || 'Gemini GUI'}
              </h1>
              <p className="text-sm text-gray-400">
                {currentWorkingDirectory ? 
                  `📁 ${currentWorkingDirectory.split('/').pop() || currentWorkingDirectory}` : 
                  'Gemini CLIのGUIラッパー'
                }
              </p>
              {currentWorkingDirectory && (
                <p className="text-xs text-gray-500 truncate max-w-md">
                  {currentWorkingDirectory}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* メッセージエリア */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-8">
              <p>Geminiに質問してみてください</p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[70%] ${message.sender === 'user' ? '' : 'flex gap-3'}`}>
                {message.sender === 'assistant' && (
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    G
                  </div>
                )}
                <div
                  className={`rounded-lg p-4 ${
                    message.sender === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-100'
                  }`}
                >
                  {message.sender === 'assistant' ? (
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown 
                        components={{
                          code: (props) => {
                            const { children, className } = props;
                            return (
                              <code className="bg-gray-800 text-green-400 px-1 py-0.5 rounded text-sm">
                                {children}
                              </code>
                            );
                          },
                          pre: (props) => {
                            const { children } = props;
                            return (
                              <pre className="bg-gray-800 text-green-400 p-3 rounded overflow-x-auto">
                                {children}
                              </pre>
                            );
                          }
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                  <div
                    className={`text-xs mt-2 ${
                      message.sender === 'user' ? 'text-blue-100' : 'text-gray-400'
                    }`}
                  >
                    {new Date(message.timestamp).toLocaleTimeString('ja-JP')}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  G
                </div>
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 入力エリア */}
        <div className="bg-gray-900 border-t border-gray-700 p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex space-x-2">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="メッセージを入力してください..."
                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400"
                rows={3}
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={!inputValue.trim() || isLoading}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
              >
                送信
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}