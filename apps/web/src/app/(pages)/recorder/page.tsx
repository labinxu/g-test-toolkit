'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSocket } from '@/components/providers/socket-provider';

export default function Home() {
  const [url, setUrl] = useState('https://qa12.gettr-qa.com/');
  const [isRecording, setIsRecording] = useState(false);
  const [output, setOutput] = useState('');
  const [recordedEvents, setRecordedEvents] = useState([]);
  const [error, setError] = useState('');
  const { socket, connected } = useSocket();
  const recordingStarted = ({
    url,
    clientId,
    data,
  }: {
    url: string | undefined;
    clientId: string;
    data: string;
  }) => {
    try {
      const newTab = window.open(
        `${url}?clientId=${encodeURIComponent(clientId)}`,
        '_blank',
      );
      if (!newTab) {
        console.error('Failed to open new tab. Check popup blocker.');
      } else {
        console.log('New tab opened:', url, 'clientId:', clientId);
      }
      console.log('Set recordingStarted value for Tampermonkey');
    } catch (err) {
      console.error('Failed to set GM_setValue:', err);
    }
  };
  useEffect(() => {
    const clientId = socket?.id;
    if (!clientId) return;

    console.log('connected', connected, socket?.id);
    socket?.on('recordingStarted', (msg: string) => {
      recordingStarted({
        url,
        clientId: socket?.id ? socket.id : '',
        data: msg,
      });
    });
    socket?.on('connect_error', (error) => {
      console.error(`Connection error for ${url}:`, error);
    });

    const script = document.createElement('script');
    script.src = '/static/event-capture.js';
    script.async = true;
    script.onload = () => {
      console.log('event-capture.js loaded');
      if (typeof (window as any).startRecording === 'function') {
        (window as any).startRecording({ clientId });
        console.log('Started recording with clientId:', clientId);
      } else {
        console.error('startRecording not defined');
      }
    };
    script.onerror = () => {
      console.error('Failed to load event-capture.js');
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [connected, socket]);
  const startRecording = async () => {
    try {
      // Validate URL
      if (!url || !/^https?:\/\//.test(url)) {
        setError('Please enter a valid URL starting with http:// or https://');
        setOutput((prev) => prev + '\nError: Invalid URL');
        return;
      }
      setIsRecording(true);
      setError('');
      const response = await fetch('/api/replay/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, clientId: socket?.id }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      const data = await response.json();
      console.log('Start recording response:', data);
      setOutput((prev) => prev + `\nStart recording: ${JSON.stringify(data)}`);
    } catch (error) {
      console.error('Error starting recording:', error);
      setOutput((prev) => prev + `\nError starting recording: ${error}`);
      setError(`Failed to start recording: ${error}`);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      setError('');
      const response = await fetch('/api/replay/stop', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      const data = await response.json();
      console.log('Stop recording response:', data);
      setOutput((prev) => prev + `\nStop recording: ${JSON.stringify(data)}`);
    } catch (error) {
      console.error('Error stopping recording:', error);
      setOutput((prev) => prev + `\nError stopping recording: ${error}`);
      setError(`Failed to stop recording: ${error}`);
    }
  };

  const replayEvents = async () => {
    try {
      setError('');
      const response = await fetch('/api/replay/events', {
        method: 'GET',
      });
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      const { events } = await response.json();
      setRecordedEvents(events);
      console.log('Fetched events:', events);
      setOutput((prev) => prev + `\nFetched events: ${JSON.stringify(events)}`);
      const tab = window.open(url, '_blank');
      if (!tab) {
        setError(
          'Failed to open new tab for replay. Please allow popups for this site.',
        );
        setOutput(
          (prev) =>
            prev +
            '\nError: Popup blocked or failed to open new tab for replay',
        );
        return;
      }
      setOutput((prev) => prev + `\nOpened replay tab: ${url}`);
      tab.postMessage({ type: 'replayEvents', events }, '*');
    } catch (error) {
      console.error('Error replaying events:', error);
      setOutput((prev) => prev + `\nError replaying events: ${error}`);
      setError(`Failed to replay events: ${error}`);
    }
  };

  const runTestScript = () => {};

  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Replay Tool</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter webpage URL (e.g., http://localhost:3000/test.html)"
              className="w-full"
            />
            <div className="flex space-x-2">
              <Button onClick={startRecording} disabled={isRecording}>
                Start Record
              </Button>
              <Button onClick={stopRecording} disabled={!isRecording}>
                Stop Record
              </Button>
              <Button onClick={replayEvents}>Replay</Button>
              <Button onClick={runTestScript} variant="outline">
                Run Test Script
              </Button>
            </div>
            <Separator />
            <ScrollArea className="h-64 w-full rounded-md border p-4">
              <pre className="text-sm">{output}</pre>
            </ScrollArea>
          </div>
          <iframe
            src={'/api/proxy-url?url=https://qa12.gettr-qa.com/'}
            width="100%"
            height="600px"
            title="Recording Frame"
          />
        </CardContent>
      </Card>
    </div>
  );
}
