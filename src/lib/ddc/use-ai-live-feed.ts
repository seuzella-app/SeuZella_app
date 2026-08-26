// ZEHLA DDC - Cognitive OS Command Center
// Hook: use-ai-live-feed
import { useState, useEffect, useCallback, useRef } from 'react';
import type { ConversationLog, ConversationMessage } from '@/types/ddc';
import { connectToLiveFeed, fetchConversations, sendMessage as apiSendMessage } from './api';

interface UseAILiveFeedReturn {
  conversations: ConversationLog[];
  selectedConversation: ConversationLog | null;
  isConnected: boolean;
  isLoading: boolean;
  error: Error | null;
  selectConversation: (conversationId: string) => void;
  sendMessage: (conversationId: string, message: string) => Promise<void>;
  escalateConversation: (conversationId: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
}

export function useAILiveFeed(): UseAILiveFeedReturn {
  const [conversations, setConversations] = useState<ConversationLog[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationLog | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Initial fetch of conversations
  const refreshConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await fetchConversations();

      if (result.success && result.data) {
        const {items} = result.data;
        setConversations(Array.isArray(items) ? items : Array.isArray(result.data) ? result.data : []);

        // Select first conversation if none selected
        if (!selectedConversation && result.data.items?.length > 0) {
          setSelectedConversation(result.data.items[0]);
        }
      } else {
        throw new Error(result.error?.message || 'Failed to fetch conversations');
      }
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching conversations:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedConversation]);

  // Connect to live feed SSE
  useEffect(() => {
    const connect = () => {
      try {
        const eventSource = connectToLiveFeed((payload) => {
          if (payload.type === 'initial') {
            const list = payload.data || [];
            setConversations(list);
            setSelectedConversation(prev => {
              if (!prev && list.length > 0) return list[0];
              if (prev) {
                const fresh = list.find((c: any) => c.id === prev.id);
                return fresh || prev;
              }
              return null;
            });
            // Dispatch custom event for other components
            window.dispatchEvent(
              new CustomEvent('ddc:new-message', { detail: list })
            );
          } else if (payload.type === 'update') {
            const newConversation = payload.data;
            setConversations(prev => {
              const exists = prev.find(c => c.id === newConversation.id);

              if (exists) {
                // Update existing conversation
                return prev.map(c =>
                  c.id === newConversation.id ? newConversation : c
                );
              } else {
                // Add new conversation at the beginning
                return [newConversation, ...prev];
              }
            });

            // Update selected if it's the one being updated
            setSelectedConversation(prev => {
              if (prev?.id === newConversation.id) {
                return newConversation;
              }
              return prev;
            });

            // Dispatch custom event for other components
            window.dispatchEvent(
              new CustomEvent('ddc:new-message', { detail: newConversation })
            );
          }
        });

        eventSource.addEventListener('open', () => {
          setIsConnected(true);
          setError(null);
        });

        eventSource.addEventListener('error', () => {
          setIsConnected(false);
          setError(new Error('Live feed connection lost'));
        });

        eventSourceRef.current = eventSource;
      } catch (err) {
        console.error('Error connecting to live feed:', err);
        setIsConnected(false);
      }
    };

    const init = async () => {
      await refreshConversations();
      connect();
    };
    init();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [refreshConversations, selectedConversation]);

  // Select a conversation
  const selectConversation = useCallback((conversationId: string) => {
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      setSelectedConversation(conversation);
    }
  }, [conversations]);

  // Send a message
  const sendMessage = useCallback(async (conversationId: string, message: string) => {
    try {
      // Optimistically update the conversation
      const optimisticMessage: ConversationMessage = {
        id: `temp-${Date.now()}`,
        conversationId,
        role: 'system', // Will be updated to 'assistant' after AI responds
        content: message,
        createdAt: new Date()
      };

      setConversations(prev =>
        prev.map(c => {
          if (c.id === conversationId) {
            return {
              ...c,
              messages: [...c.messages, optimisticMessage],
              updatedAt: new Date()
            };
          }
          return c;
        })
      );

      setSelectedConversation(prev => {
        if (prev?.id === conversationId) {
          return {
            ...prev,
            messages: [...prev.messages, optimisticMessage],
            updatedAt: new Date()
          };
        }
        return prev;
      });

      // Actually send the message via API
      await apiSendMessage(conversationId, message);

    } catch (err) {
      setError(err as Error);
      console.error('Error sending message:', err);
    }
  }, []);

  // Escalate a conversation
  const escalateConversation = useCallback(async (conversationId: string) => {
    try {
      // Optimistically update the conversation
      setConversations(prev =>
        prev.map(c => {
          if (c.id === conversationId) {
            return {
              ...c,
              status: 'escalated',
              needsEscalation: true,
              updatedAt: new Date()
            };
          }
          return c;
        })
      );

      setSelectedConversation(prev => {
        if (prev?.id === conversationId) {
          return {
            ...prev,
            status: 'escalated',
            needsEscalation: true,
            updatedAt: new Date()
          };
        }
        return prev;
      });

      // Actually escalate via API
      // Note: In real implementation, this would call escalateConversation() from api.ts

      // Dispatch escalation event
      window.dispatchEvent(
        new CustomEvent('ddc:conversation-escalated', { detail: { conversationId } })
      );
    } catch (err) {
      setError(err as Error);
      console.error('Error escalating conversation:', err);
    }
  }, []);

  return {
    conversations,
    selectedConversation,
    isConnected,
    isLoading,
    error,
    selectConversation,
    sendMessage,
    escalateConversation,
    refreshConversations
  };
}