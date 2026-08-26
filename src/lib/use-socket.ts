'use client';

import { useEffect, useRef, useState, useCallback } from 'react';  
import { io, Socket } from 'socket.io-client';

const REALTIME_PORT = 3005;

interface UseSocketOptions {  
  tenantId: string | null;  
  autoConnect?: boolean;  
}

export function useSocket({ tenantId, autoConnect = true }: UseSocketOptions) {  
  const [socket, setSocket] = useState<Socket | null>(null);  
  const [isConnected, setIsConnected] = useState(false);  
  const reconnectAttemptsRef = useRef(0);  
  const maxReconnectDelay = 30000;

  const getReconnectDelay = useCallback(() => {  
    const attempt = reconnectAttemptsRef.current;  
    const delay = Math.min(1000 * Math.pow(2, attempt), maxReconnectDelay);  
    return delay;  
  }, []);

  useEffect(() => {  
    if (!autoConnect || !tenantId) return;

    let activeSocket: Socket | null = null;  
    let destroyed = false;

    const connect = () => {  
      if (activeSocket?.connected || destroyed) return;

      const newSocket = io(`/?XTransformPort=${ REALTIME_PORT}`, {  
        transports: ['websocket', 'polling'],  
        reconnection: false,  
      });

      newSocket.on('connect', () => {  
        if (destroyed) return;  
        console.log('[Socket] Connected:', newSocket.id);  
        setIsConnected(true);  
        reconnectAttemptsRef.current = 0;  
        newSocket.emit('tenant:join', tenantId);  
      });

      newSocket.on('disconnect', (reason) => {  
        if (destroyed) return;  
        console.log('[Socket] Disconnected:', reason);  
        setIsConnected(false);  
        activeSocket = null;

        if (reason !== 'io server disconnect') {  
          const delay = getReconnectDelay();  
          reconnectAttemptsRef.current += 1;  
          console.log(`[Socket] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);  
          setTimeout(connect, delay);  
        }  
      });

      newSocket.on('connect_error', () => {  
        if (destroyed) return;  
        setIsConnected(false);  
        activeSocket = null;  
        const delay = getReconnectDelay();  
        reconnectAttemptsRef.current += 1;  
        setTimeout(connect, delay);  
      });

      activeSocket = newSocket;  
      setSocket(newSocket);  
    };

    connect();

    return () => {  
      destroyed = true;  
      if (activeSocket) {  
        activeSocket.emit('tenant:leave', tenantId);  
        activeSocket.disconnect();  
        activeSocket = null;  
      }  
      setSocket(null);  
      setIsConnected(false);  
    };  
  }, [tenantId, autoConnect, getReconnectDelay]);

  const emit = useCallback((event: string, data: unknown) => {  
    setSocket((currentSocket) => {  
      if (currentSocket?.connected) {  
        currentSocket.emit(event, data);  
      }  
      return currentSocket;  
    });  
  }, []);

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {  
    let removeFn: (() => void) | undefined;  
    setSocket((currentSocket) => {  
      if (currentSocket) {  
        currentSocket.on(event, handler);  
        removeFn = () => currentSocket.off(event, handler);  
      }  
      return currentSocket;  
    });  
    return () => removeFn?.();  
  }, []);

  return { socket, isConnected, emit, on };  
}
