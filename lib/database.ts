import Database from 'better-sqlite3';
import path from 'path';

export interface SessionEntry {
  session_id: string;
  name: string;
  working_directory: string;
  created_at: string;
  updated_at: string;
}

export interface MessageEntry {
  id: number;
  session_id: string;
  user_input: string;
  gemini_response: string;
  timestamp: string;
}

// 旧インターフェースは互換性のため残す
export interface ConversationEntry {
  id: number;
  timestamp: string;
  user_input: string;
  gemini_response: string;
  session_id: string;
  working_directory: string;
}

class DatabaseManager {
  private db: Database.Database | null = null;

  init(): void {
    if (this.db) return;

    // データベースファイルをプロジェクトルートに作成
    const dbPath = path.join(process.cwd(), 'conversations.db');
    this.db = new Database(dbPath);

    // セッションテーブル作成
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        working_directory TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // メッセージテーブル作成
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        user_input TEXT NOT NULL,
        gemini_response TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions (session_id) ON DELETE CASCADE
      )
    `);

    // 旧conversationsテーブルからのマイグレーション
    try {
      const hasOldTable = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='conversations'
      `).get();

      if (hasOldTable) {
        console.log('旧データベースからマイグレーション中...');
        this.migrateFromOldSchema();
      }
    } catch (error) {
      console.error('マイグレーションエラー:', error);
    }
  }

  private migrateFromOldSchema(): void {
    if (!this.db) return;

    try {
      const oldConversations = this.db.prepare('SELECT * FROM conversations').all() as any[];
      
      // セッションごとにグループ化
      const sessionMap = new Map<string, { name: string; workingDirectory: string; conversations: any[] }>();
      
      oldConversations.forEach(conv => {
        if (!sessionMap.has(conv.session_id)) {
          sessionMap.set(conv.session_id, {
            name: conv.user_input.substring(0, 50) + (conv.user_input.length > 50 ? '...' : ''),
            workingDirectory: conv.working_directory || process.cwd(),
            conversations: []
          });
        }
        sessionMap.get(conv.session_id)!.conversations.push(conv);
      });

      // 新しいスキーマにデータを移行
      for (const [sessionId, sessionData] of sessionMap) {
        // セッション作成
        this.createSession(sessionId, sessionData.name, sessionData.workingDirectory);
        
        // メッセージ移行
        sessionData.conversations.forEach(conv => {
          this.saveMessage(sessionId, conv.user_input, conv.gemini_response, conv.timestamp);
        });
      }

      // 旧テーブルをリネーム（削除ではなく保持）
      this.db.exec('ALTER TABLE conversations RENAME TO conversations_backup');
      console.log('マイグレーション完了。旧データはconversations_backupテーブルに保存されました。');
      
    } catch (error) {
      console.error('マイグレーション中のエラー:', error);
    }
  }

  createSession(sessionId: string, name: string, workingDirectory: string): void {
    if (!this.db) {
      throw new Error('データベースが初期化されていません');
    }

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sessions (session_id, name, working_directory, created_at, updated_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `);
    
    stmt.run(sessionId, name, workingDirectory);
  }

  updateSessionName(sessionId: string, name: string): void {
    if (!this.db) {
      throw new Error('データベースが初期化されていません');
    }

    const stmt = this.db.prepare(`
      UPDATE sessions 
      SET name = ?, updated_at = datetime('now')
      WHERE session_id = ?
    `);
    
    stmt.run(name, sessionId);
  }

  saveMessage(sessionId: string, userInput: string, geminiResponse: string, timestamp?: string): void {
    if (!this.db) {
      throw new Error('データベースが初期化されていません');
    }

    const stmt = this.db.prepare(`
      INSERT INTO messages (session_id, user_input, gemini_response, timestamp)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(sessionId, userInput, geminiResponse, timestamp || new Date().toISOString());

    // セッションの更新時刻も更新
    this.updateSessionTimestamp(sessionId);
  }

  private updateSessionTimestamp(sessionId: string): void {
    if (!this.db) return;

    const stmt = this.db.prepare(`
      UPDATE sessions 
      SET updated_at = datetime('now')
      WHERE session_id = ?
    `);
    
    stmt.run(sessionId);
  }

  // 互換性のための旧メソッド
  saveConversation(
    userInput: string, 
    geminiResponse: string, 
    sessionId: string,
    workingDirectory: string
  ): void {
    // セッションが存在しない場合は作成
    const session = this.getSession(sessionId);
    if (!session) {
      const sessionName = userInput.substring(0, 50) + (userInput.length > 50 ? '...' : '');
      this.createSession(sessionId, sessionName, workingDirectory);
    }

    this.saveMessage(sessionId, userInput, geminiResponse);
  }

  // 新しいスキーマ用メソッド
  getSession(sessionId: string): SessionEntry | null {
    if (!this.db) {
      throw new Error('データベースが初期化されていません');
    }

    const stmt = this.db.prepare(`
      SELECT * FROM sessions WHERE session_id = ?
    `);
    
    return stmt.get(sessionId) as SessionEntry | null;
  }

  getAllSessions(): SessionEntry[] {
    if (!this.db) {
      throw new Error('データベースが初期化されていません');
    }

    const stmt = this.db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC');
    return stmt.all() as SessionEntry[];
  }

  getSessionMessages(sessionId: string): MessageEntry[] {
    if (!this.db) {
      throw new Error('データベースが初期化されていません');
    }

    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE session_id = ? 
      ORDER BY timestamp ASC
    `);
    
    return stmt.all(sessionId) as MessageEntry[];
  }

  getSessionsByWorkingDirectory(): { [directory: string]: SessionEntry[] } {
    if (!this.db) {
      throw new Error('データベースが初期化されていません');
    }

    const sessions = this.getAllSessions();
    const sessionsByDir: { [directory: string]: SessionEntry[] } = {};
    
    sessions.forEach(session => {
      const dir = session.working_directory;
      if (!sessionsByDir[dir]) {
        sessionsByDir[dir] = [];
      }
      sessionsByDir[dir].push(session);
    });

    return sessionsByDir;
  }

  // 互換性のための旧メソッド（新しいスキーマに対応）
  getConversationHistory(sessionId: string): ConversationEntry[] {
    const session = this.getSession(sessionId);
    const messages = this.getSessionMessages(sessionId);

    if (!session) return [];

    return messages.map(msg => ({
      id: msg.id,
      timestamp: msg.timestamp,
      user_input: msg.user_input,
      gemini_response: msg.gemini_response,
      session_id: msg.session_id,
      working_directory: session.working_directory
    }));
  }

  getAllConversations(): ConversationEntry[] {
    if (!this.db) {
      throw new Error('データベースが初期化されていません');
    }

    const stmt = this.db.prepare(`
      SELECT m.*, s.working_directory 
      FROM messages m
      JOIN sessions s ON m.session_id = s.session_id
      ORDER BY m.timestamp DESC
    `);
    
    return stmt.all().map((row: any) => ({
      id: row.id,
      timestamp: row.timestamp,
      user_input: row.user_input,
      gemini_response: row.gemini_response,
      session_id: row.session_id,
      working_directory: row.working_directory
    }));
  }

  getSessionWorkingDirectory(sessionId: string): string | null {
    const session = this.getSession(sessionId);
    return session?.working_directory || null;
  }
}

// シングルトンパターン
const dbManager = new DatabaseManager();
export default dbManager;