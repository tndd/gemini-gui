'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface SessionUI {
  id: string;
  title: string;
  workingDirectory: string;
  createdAt: string;
  timestamp: string;
}

interface GroupedSessions {
  [directory: string]: SessionUI[];
}

interface SessionHistoryProps {
  showNewChatButton?: boolean;
  className?: string;
}

export default function SessionHistory({
  showNewChatButton = true,
  className = "w-80 bg-gray-800 border-r border-gray-700 flex flex-col"
}: SessionHistoryProps) {
  const [groupedSessions, setGroupedSessions] = useState<GroupedSessions>({});
  const [editingSessionId, setEditingSessionId] = useState<string>('');
  const [editingSessionName, setEditingSessionName] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const response = await fetch('/api/sessions');
      const data = await response.json();
      setGroupedSessions(data.sessionsByDirectory || {});
    } catch (error) {
      console.error('セッション読み込みエラー:', error);
    }
  };

  const selectSession = (sessionId: string) => {
    router.push(`/chat/${sessionId}`);
  };


  const startEditingSession = (sessionId: string, currentTitle: string) => {
    setEditingSessionId(sessionId);
    setEditingSessionName(currentTitle);
  };

  const saveSessionName = async (sessionId: string) => {
    if (!editingSessionName.trim()) return;
    
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editingSessionName })
      });
      
      setEditingSessionId('');
      setEditingSessionName('');
      loadSessions();
    } catch (error) {
      console.error('セッション名更新エラー:', error);
    }
  };

  const cancelEditing = () => {
    setEditingSessionId('');
    setEditingSessionName('');
  };

  const handleNewChatClick = () => {
    router.push('/');
  };

  return (
    <div className={className}>
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold">セッション履歴</h2>
      </div>
      
      <div className="p-4 border-b border-gray-700">
        {showNewChatButton && (
          <button
            onClick={handleNewChatClick}
            className="w-full bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <span>+</span>
            新しいチャット
          </button>
        )}
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
                  <div
                    key={session.id}
                    className="bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    {editingSessionId === session.id ? (
                      <div className="p-3">
                        <input
                          type="text"
                          value={editingSessionName}
                          onChange={(e) => setEditingSessionName(e.target.value)}
                          className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveSessionName(session.id);
                            if (e.key === 'Escape') cancelEditing();
                          }}
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => saveSessionName(session.id)}
                            className="text-xs bg-green-600 hover:bg-green-500 px-2 py-1 rounded"
                          >
                            保存
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="text-xs bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded"
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="p-3 cursor-pointer flex justify-between items-start group"
                        onClick={() => selectSession(session.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{session.title}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(session.createdAt).toLocaleDateString('ja-JP')}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingSession(session.id, session.title);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white text-xs p-1"
                          title="編集"
                        >
                          ✏️
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}