'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: string;
}

interface Session {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
  workingDirectory?: string;
}

interface DirectoryInfo {
  name: string;
  path: string;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionsByDirectory, setSessionsByDirectory] = useState<{ [directory: string]: Session[] }>({});
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showDirectorySelector, setShowDirectorySelector] = useState(false);
  const [selectedDirectory, setSelectedDirectory] = useState<string>('');
  const [availableDirectories, setAvailableDirectories] = useState<DirectoryInfo[]>([]);
  const [sessionId, setSessionId] = useState(() => 
    crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()
  );
  const [currentWorkingDirectory, setCurrentWorkingDirectory] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadSessions();
  }, []);

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
      const response = await fetch(`/api/gemini?sessionId=${sessionId}`);
      const data = await response.json();
      
      if (data.history) {
        const loadedMessages: Message[] = [];
        data.history.forEach((conv: any) => {
          loadedMessages.push({
            id: `${conv.id}-user`,
            content: conv.user_input,
            sender: 'user',
            timestamp: conv.timestamp
          });
          loadedMessages.push({
            id: `${conv.id}-assistant`,
            content: conv.gemini_response,
            sender: 'assistant',
            timestamp: conv.timestamp
          });
        });
        setMessages(loadedMessages);
      }
    } catch (error) {
      console.error('履歴読み込みエラー:', error);
    }
  };

  const createNewSession = (workingDirectory?: string) => {
    const newSessionId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
    setSessionId(newSessionId);
    setMessages([]);
    setCurrentWorkingDirectory(workingDirectory || selectedDirectory || '');
    setShowDirectorySelector(false);
    loadSessions();
  };

  const selectSession = (session: Session) => {
    setSessionId(session.id);
    setCurrentWorkingDirectory(session.workingDirectory || '');
    loadSessionHistory(session.id);
  };

  const openDirectorySelector = () => {
    setShowDirectorySelector(true);
    loadDirectories();
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
      const response = await fetch('/api/gemini', {
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
                  onClick={() => selectSession(session)}
                  className={`p-3 rounded-lg cursor-pointer mb-2 ml-2 transition-colors ${
                    session.id === sessionId 
                      ? 'bg-gray-700' 
                      : 'hover:bg-gray-800'
                  }`}
                >
                  <div className="text-sm font-medium truncate">{session.title}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(session.timestamp).toLocaleDateString('ja-JP')}
                  </div>
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
              <h1 className="text-lg font-semibold text-white">Gemini GUI</h1>
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
                          code: ({node, inline, className, children, ...props}) => {
                            return inline ? (
                              <code className="bg-gray-800 text-green-400 px-1 py-0.5 rounded text-sm" {...props}>
                                {children}
                              </code>
                            ) : (
                              <pre className="bg-gray-800 text-green-400 p-3 rounded overflow-x-auto">
                                <code {...props}>{children}</code>
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