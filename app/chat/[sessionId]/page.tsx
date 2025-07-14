'use client';

import ChatInterface from '@/components/ChatInterface';
import { useParams, useSearchParams } from 'next/navigation';

export default function ChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId as string;
  const initialMessage = searchParams.get('message');

  return <ChatInterface initialSessionId={sessionId} initialMessage={initialMessage} />;
}