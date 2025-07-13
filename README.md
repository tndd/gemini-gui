# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gemini GUI is a NextJS application that provides a ChatGPT-like interface for the `gemini` CLI tool. The application allows users to interact with Gemini AI through a web interface with session management, working directory support, and conversation history.

## Development Commands

```bash
# Development
npm run dev              # Start development server with Turbopack
npm run build           # Build for production
npm run start           # Start production server
npm run lint            # Run ESLint

# Database Management
npm run db:generate     # Generate Prisma client after schema changes
npm run db:migrate      # Run database migrations in development
npm run db:push         # Push schema changes to database (for prototyping)
npm run db:studio       # Open Prisma Studio for database GUI management
```

## Architecture

### Core Components

**ChatInterface** (`/components/ChatInterface.tsx`): The main UI component that handles:
- Chat message display with Markdown rendering
- Session management with directory-based organization
- Working directory selection for `gemini` CLI execution
- Session name editing and creation

### API Architecture

The application uses a RESTful API structure under `/app/api/`:

- **`/api/messages`** - POST: Execute gemini CLI and save conversation
- **`/api/sessions`** - GET: Retrieve sessions grouped by working directory
- **`/api/sessions/create`** - POST: Create new sessions
- **`/api/sessions/[sessionId]`** - GET/PATCH: Retrieve session details or update session name

### Database Schema

Uses Prisma ORM with SQLite database (`prisma/gemini-gui.db`):

```prisma
model Session {
  sessionId        String    @id
  name            String
  workingDirectory String
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  messages        Message[]
}

model Message {
  id             Int      @id @default(autoincrement())
  sessionId      String
  userInput      String
  geminiResponse String
  timestamp      DateTime @default(now())
  session        Session  @relation(fields: [sessionId], references: [sessionId], onDelete: Cascade)
}
```

### Key Architectural Concepts

**Session-Directory Relationship**: Each session is tied to a specific working directory where the `gemini` CLI will be executed. This allows users to have context-aware conversations based on their project directory.

**CLI Integration**: The application spawns `gemini` CLI processes using Node.js `child_process.spawn()` with the session's working directory as `cwd`.

**Prisma Integration**: All database operations use Prisma Client (`/lib/prisma.ts`) with automatic connection pooling and type safety.

## Working Directory Integration

The gemini CLI execution directory is determined by:
1. Existing session's working directory (if session exists)
2. Explicitly provided working directory (for new sessions)
3. Current working directory as fallback

Sessions are grouped by working directory in the UI sidebar, allowing users to organize conversations by project.

## Important Technical Details

- Uses NextJS 15 App Router with TypeScript
- All API routes handle Prisma database operations
- UI uses Tailwind CSS with dark theme
- Markdown rendering via `react-markdown` with custom code block styling
- Session IDs generated using `crypto.randomUUID()` or timestamp fallback