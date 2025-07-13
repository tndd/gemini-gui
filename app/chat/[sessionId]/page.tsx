'use client';

import ChatInterface from '@/components/ChatInterface';
import { useParams } from 'next/navigation';

export default function ChatPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  return <ChatInterface initialSessionId={sessionId} />;
}