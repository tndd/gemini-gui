'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import SessionHistory from './SessionHistory';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: string;
}


interface ChatInterfaceProps {
  initialSessionId?: string;
}

export default function ChatInterface({ initialSessionId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sessionId, setSessionId] = useState(() => 
    initialSessionId || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString())
  );
  const [currentWorkingDirectory, setCurrentWorkingDirectory] = useState<string>('');
  const [currentSessionName, setCurrentSessionName] = useState<string>('');
  const [latestSessionId, setLatestSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 現在のセッションが最新（アクティブ）かどうかを判定
  // latestSessionIdがnullの場合は、アクティブセッションが存在しない状態とする
  const isActiveSession = latestSessionId !== null && sessionId === latestSessionId;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // 常にサーバーから最新セッションIDを取得
    loadLatestSessionId();
    
    // 初期セッションIDが指定されている場合、そのセッションの履歴を読み込む
    if (initialSessionId) {
      setSessionId(initialSessionId);
      loadSessionHistory(initialSessionId);
    }
  }, [initialSessionId]);

  const loadLatestSessionId = async () => {
    try {
      const response = await fetch('/api/sessions');
      const data = await response.json();
      setLatestSessionId(data.latestSessionId);
    } catch (error) {
      console.error('最新セッションID取得エラー:', error);
    }
  };

  useEffect(() => {
    // initialSessionIdが変更された場合、セッションを切り替える
    if (initialSessionId && initialSessionId !== sessionId) {
      setSessionId(initialSessionId);
      loadSessionHistory(initialSessionId);
    }
  }, [initialSessionId]);



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
      const response = await fetch('/api/terminal', {
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
      
      // サーバーのアクティブセッション情報を更新
      loadLatestSessionId();
      
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
    <div className="flex h-screen bg-gray-800 text-white overflow-hidden">
      {/* サイドバー */}
      {isSidebarOpen && (
        <SessionHistory
          className="w-1/4 bg-gray-900 border-r border-gray-700 flex flex-col transition-all duration-300"
        />
      )}


      {/* メインコンテンツエリア */}
      <div className="flex-1 flex flex-col min-w-0">
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
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6">
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
              <div className={`max-w-[70%] min-w-0 ${message.sender === 'user' ? '' : 'flex gap-3'}`}>
                {message.sender === 'assistant' && (
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    G
                  </div>
                )}
                <div
                  className={`rounded-lg p-4 break-words overflow-hidden ${
                    message.sender === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-100'
                  }`}
                >
                  {message.sender === 'assistant' ? (
                    <div className="prose prose-invert prose-sm max-w-none break-words">
                      <ReactMarkdown 
                        components={{
                          code: (props) => {
                            const { children } = props;
                            return (
                              <code className="bg-gray-800 text-green-400 px-1 py-0.5 rounded text-sm break-all">
                                {children}
                              </code>
                            );
                          },
                          pre: (props) => {
                            const { children } = props;
                            return (
                              <pre className="bg-gray-800 text-green-400 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words">
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
            {!isActiveSession && (
              <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                <p className="text-yellow-300 text-sm flex items-center gap-2">
                  <span>📚</span>
                  これは過去のセッション記録です。新しい対話はできません。
                </p>
              </div>
            )}
            
            <div className="flex space-x-2">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={isActiveSession ? "メッセージを入力してください..." : "過去のセッションでは入力できません"}
                className={`flex-1 border rounded-lg p-3 resize-none focus:outline-none text-white placeholder-gray-400 ${
                  isActiveSession 
                    ? "bg-gray-700 border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                    : "bg-gray-800 border-gray-500 cursor-not-allowed"
                }`}
                rows={3}
                disabled={isLoading || !isActiveSession}
              />
              <button
                onClick={sendMessage}
                disabled={!inputValue.trim() || isLoading || !isActiveSession}
                className={`text-white px-6 py-3 rounded-lg transition-colors ${
                  isActiveSession && !isLoading && inputValue.trim()
                    ? "bg-blue-600 hover:bg-blue-500"
                    : "bg-gray-600 cursor-not-allowed"
                }`}
              >
                {isLoading ? "送信中..." : "送信"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}