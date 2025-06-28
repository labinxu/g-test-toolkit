'use client';
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import io, { Socket } from 'socket.io-client';

interface SocketContextProps {
  socket: Socket | null;
  connected: boolean;
  running: boolean;
  logs: string[];
  clientId?: string;
  emit: (event: string, ...args: any[]) => void;
  clearLogs: () => void;
  setRunning: (value: boolean) => void;
}

const SocketContext = createContext<SocketContextProps | undefined>(undefined);

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within a SocketProvider');
  return ctx;
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [clientId, setClientId] = useState<string>();
  const [running, setRunning] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io('http://localhost:3001/log');
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setClientId(socket.id);
      socket.emit('hello', 'Hello from Next.js client!');
    });

    socket.on('disconnect', () => setConnected(false));
    socket.on('log', (msg: string) => setLogs((prev) => [...prev, msg]));
    socket.on('close', (msg: string) => {
      setLogs((prev) => [...prev, msg]);
      setRunning(false);
    });
    socket.on('disconnect', () => {
      setConnected(false);
      console.log('Disconnected');
    });
    // 可以添加更多事件
    socket.on('ctl', (msg: string) => {
      console.log('ctl message from server', msg);
      if (msg.toLocaleLowerCase() === 'exit') {
        console.log('set running to false');
        setRunning(false);
      }
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  const emit = (event: string, ...args: any[]) => {
    socketRef.current?.emit(event, ...args);
  };

  const clearLogs = () => setLogs([]);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        connected,
        logs,
        clientId,
        emit,
        clearLogs,
        running,
        setRunning,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}
