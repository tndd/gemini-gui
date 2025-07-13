import Database from 'better-sqlite3';
import path from 'path';

export interface Session {
  session_id: string;
  name: string;
  working_directory: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  session_id: string;
  user_input: string;
  gemini_response: string;
  timestamp: string;
}

class DatabaseManager {
  private db: Database.Database | null = null;

  init(): void {
    if (this.db) return;

    const dbPath = path.join(process.cwd(), 'gemini-gui.db');
    this.db = new Database(dbPath);

    this.createTables();
    this.migrateOldData();
  }

  private createTables(): void {
    if (!this.db) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        working_directory TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

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
  }

  private migrateOldData(): void {
    if (!this.db) return;

    try {
      // 旧conversations.dbからのマイグレーション
      const oldDbPath = path.join(process.cwd(), 'conversations.db');
      try {
        const oldDb = new Database(oldDbPath, { readonly: true });
        const hasOldTable = oldDb.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name='conversations'
        `).get();

        if (hasOldTable) {
          console.log('旧データベースからマイグレーション中...');
          const oldConversations = oldDb.prepare('SELECT * FROM conversations').all() as any[];
          
          const sessionMap = new Map<string, { name: string; workingDirectory: string; conversations: any[] }>();
          
          oldConversations.forEach(conv => {
            if (!sessionMap.has(conv.session_id)) {
              sessionMap.set(conv.session_id, {
                name: conv.user_input?.substring(0, 50) + (conv.user_input?.length > 50 ? '...' : '') || 'セッション',
                workingDirectory: conv.working_directory || process.cwd(),
                conversations: []
              });
            }
            sessionMap.get(conv.session_id)!.conversations.push(conv);
          });

          for (const [sessionId, sessionData] of sessionMap) {
            this.createSession(sessionId, sessionData.name, sessionData.workingDirectory);
            sessionData.conversations.forEach(conv => {
              this.addMessage(sessionId, conv.user_input, conv.gemini_response, conv.timestamp);
            });
          }

          oldDb.close();
          console.log('マイグレーション完了');
        }
      } catch (error) {
        // 旧データベースが存在しない場合は無視
      }
    } catch (error) {
      console.error('マイグレーションエラー:', error);
    }
  }

  createSession(sessionId: string, name: string, workingDirectory: string): void {
    this.ensureDbInitialized();
    
    const stmt = this.db!.prepare(`
      INSERT OR REPLACE INTO sessions (session_id, name, working_directory, created_at, updated_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `);
    
    stmt.run(sessionId, name, workingDirectory);
  }

  updateSessionName(sessionId: string, name: string): void {
    this.ensureDbInitialized();
    
    const stmt = this.db!.prepare(`
      UPDATE sessions 
      SET name = ?, updated_at = datetime('now')
      WHERE session_id = ?
    `);
    
    stmt.run(name, sessionId);
  }

  addMessage(sessionId: string, userInput: string, geminiResponse: string, timestamp?: string): void {
    this.ensureDbInitialized();
    
    const stmt = this.db!.prepare(`
      INSERT INTO messages (session_id, user_input, gemini_response, timestamp)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(sessionId, userInput, geminiResponse, timestamp || new Date().toISOString());
    this.updateSessionTimestamp(sessionId);
  }

  saveConversation(userInput: string, geminiResponse: string, sessionId: string, workingDirectory: string): void {
    const session = this.getSession(sessionId);
    if (!session) {
      const sessionName = userInput.substring(0, 50) + (userInput.length > 50 ? '...' : '');
      this.createSession(sessionId, sessionName, workingDirectory);
    }
    this.addMessage(sessionId, userInput, geminiResponse);
  }

  private updateSessionTimestamp(sessionId: string): void {
    this.ensureDbInitialized();
    
    const stmt = this.db!.prepare(`
      UPDATE sessions 
      SET updated_at = datetime('now')
      WHERE session_id = ?
    `);
    
    stmt.run(sessionId);
  }

  private ensureDbInitialized(): void {
    if (!this.db) {
      throw new Error('データベースが初期化されていません');
    }
  }

  getSession(sessionId: string): Session | null {
    this.ensureDbInitialized();
    
    const stmt = this.db!.prepare('SELECT * FROM sessions WHERE session_id = ?');
    return stmt.get(sessionId) as Session | null;
  }

  getAllSessions(): Session[] {
    this.ensureDbInitialized();
    
    const stmt = this.db!.prepare('SELECT * FROM sessions ORDER BY updated_at DESC');
    return stmt.all() as Session[];
  }

  getSessionMessages(sessionId: string): Message[] {
    this.ensureDbInitialized();
    
    const stmt = this.db!.prepare(`
      SELECT * FROM messages 
      WHERE session_id = ? 
      ORDER BY timestamp ASC
    `);
    
    return stmt.all(sessionId) as Message[];
  }

  getSessionsByWorkingDirectory(): { [directory: string]: Session[] } {
    const sessions = this.getAllSessions();
    const sessionsByDir: { [directory: string]: Session[] } = {};
    
    sessions.forEach(session => {
      const dir = session.working_directory;
      if (!sessionsByDir[dir]) {
        sessionsByDir[dir] = [];
      }
      sessionsByDir[dir].push(session);
    });

    return sessionsByDir;
  }

  getSessionWorkingDirectory(sessionId: string): string | null {
    const session = this.getSession(sessionId);
    return session?.working_directory || null;
  }

  // 後方互換性用（旧API Routes用）
  getConversationHistory(sessionId: string): any[] {
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

  getAllConversations(): any[] {
    this.ensureDbInitialized();
    
    const stmt = this.db!.prepare(`
      SELECT m.*, s.working_directory 
      FROM messages m
      JOIN sessions s ON m.session_id = s.session_id
      ORDER BY m.timestamp DESC
    `);
    
    return stmt.all();
  }
}

// シングルトンパターン
const dbManager = new DatabaseManager();
export default dbManager;