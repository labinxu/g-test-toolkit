'use client';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function RecordingPage() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');

  useEffect(() => {
    if (!clientId) {
      console.error('No clientId provided in query parameters');
      return;
    }

    // Dynamically load event-capture.js
    const script = document.createElement('script');
    script.src = '/static/event-capture.js';
    script.async = true;
    script.onload = () => {
      console.log('event-capture.js loaded');
      if (typeof (window as any).startRecording === 'function') {
        (window as any).startRecording({ clientId });
        console.log('Started recording with clientId:', clientId);
      } else {
        console.error('startRecording not defined in event-capture.js');
      }
    };
    script.onerror = () => {
      console.error('Failed to load event-capture.js');
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [clientId]);

  return (
    <div>
      <h1>Recording Page</h1>
      <p>Recording interactions for clientId: {clientId || 'Unknown'}</p>
      <p>Interact with this page (click, type) to record events.</p>
    </div>
  );
}
