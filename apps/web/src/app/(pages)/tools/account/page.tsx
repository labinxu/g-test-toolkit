'use client';
import React, { useState, useRef, useEffect } from 'react';
import { throttle } from 'lodash';
import { Label } from '@/components/ui/label';
import { EnvSelect } from './components/env-select';
import { Button } from '@/components/ui/button';

export default function Page() {
  const [iframeUrl, setIframeUrl] = useState(
    'http://localhost:3001/proxy?url=https://example.com',
  );
  const [events, setEvents] = useState<
    { id: number; type: string; details: string; timestamp: string }[]
  >([]);
  const [showOverlay, setShowOverlay] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastClickRef = useRef<{ clientX: number; clientY: number } | null>(
    null,
  );

  const addEventLog = (eventType: string, details: string) => {
    const event = {
      id: Date.now(),
      type: eventType,
      details,
      timestamp: new Date().toLocaleTimeString(),
    };
    setEvents((prev) => [...prev.slice(-100), event]);
  };

  useEffect(() => {
    const updateOverlayPosition = () => {
      if (iframeRef.current && overlayRef.current && showOverlay) {
        const iframe = iframeRef.current;
        const overlay = overlayRef.current;
        const rect = iframe.getBoundingClientRect();
        const parentRect = iframe.parentElement?.getBoundingClientRect();

        const top = rect.top - (parentRect?.top || 0) + window.scrollY;
        const left = rect.left - (parentRect?.left || 0) + window.scrollX;
        const width = rect.width;
        const height = rect.height;

        overlay.style.position = 'absolute';
        overlay.style.top = `${top}px`;
        overlay.style.left = `${left}px`;
        overlay.style.width = `${width}px`;
        overlay.style.height = `${height}px`;
        overlay.style.zIndex = '10';
        overlay.style.backgroundColor = 'rgba(0, 191, 255, 0.2)';
      }
    };

    const rafId = requestAnimationFrame(updateOverlayPosition);
    window.addEventListener('resize', updateOverlayPosition);
    window.addEventListener('scroll', updateOverlayPosition);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateOverlayPosition);
      window.removeEventListener('scroll', updateOverlayPosition);
    };
  }, [showOverlay]);

  const convertToIframeCoords = (clientX: number, clientY: number) => {
    if (!iframeRef.current) return { iframeX: clientX, iframeY: clientY };

    const rect = iframeRef.current.getBoundingClientRect();
    const iframeX = clientX - rect.left;
    const iframeY = clientY - rect.top;
    return { iframeX, iframeY };
  };

  const triggerIframeClick = (clientX: number, clientY: number) => {
    const { iframeX, iframeY } = convertToIframeCoords(clientX, clientY);
    console.log(iframeRef.current?.contentDocument);
    if (iframeRef.current) {
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: iframeRef.current.contentWindow,
        clientX: iframeX,
        clientY: iframeY,
        pageX: iframeX + (iframeRef.current.contentWindow?.scrollX || 0),
        pageY: iframeY + (iframeRef.current.contentWindow?.scrollY || 0),
      });
      iframeRef.current.dispatchEvent(clickEvent);
      console.log('Triggered click in iframe at:', { iframeX, iframeY });
      addEventLog(
        'click',
        `Simulated click at Iframe: (${iframeX}, ${iframeY})`,
      );
    } else {
      console.error('Cannot access iframe content, check proxy configuration');
      addEventLog(
        'error',
        'Failed to trigger click: Cross-origin restriction or proxy failure',
      );
    }
  };

  useEffect(() => {
    if (!overlayRef.current || !showOverlay) return;

    const handleMouseMove = throttle((event: MouseEvent) => {
      const { clientX, clientY, pageX, pageY } = event;
      addEventLog(
        'mousemove',
        `Overlay: Client: (${clientX}, ${clientY}), Page: (${pageX}, ${pageY})`,
      );
    }, 100);

    const handleClick = (event: MouseEvent) => {
      const { clientX, clientY } = event;
      console.log('Overlay click captured:', { clientX, clientY });

      lastClickRef.current = { clientX, clientY };
      addEventLog('click', `Captured at Client: (${clientX}, ${clientY})`);

      setShowOverlay(false);
    };

    const overlay = overlayRef.current;
    overlay.addEventListener('mousemove', handleMouseMove);
    overlay.addEventListener('click', handleClick);

    return () => {
      overlay.removeEventListener('mousemove', handleMouseMove);
      overlay.removeEventListener('click', handleClick);
    };
  }, [showOverlay]);

  // useEffect(() => {
  //   if (!showOverlay && lastClickRef.current) {
  //     const { clientX, clientY } = lastClickRef.current;
  //     setTimeout(() => {
  //       triggerIframeClick(clientX, clientY);
  //       lastClickRef.current = null;
  //     }, 100);
  //   }
  // }, [showOverlay]);

  return (
    <div className="flex w-full flex-1 flex-col gap-3 rounded-lg border-2 p-8 shadow-lg">
      <div className="flex flex-row gap-2">
        <Label htmlFor="desturl">DestUrl: </Label>
        <EnvSelect
          onValueChange={(v: string) => {
            const cleanUrl = v.replace(/^https?:\/\//, '');
            const proxyUrl = `http://localhost:3001/proxy?url=${v}`;
            console.log('Setting iframe URL:', proxyUrl);
            setIframeUrl(proxyUrl);
          }}
        />
        <Button
          onClick={() => setShowOverlay(!showOverlay)}
          style={{ padding: '5px 10px' }}
        >
          {showOverlay ? 'Remove Overlay' : 'Add Overlay'}
        </Button>
      </div>

      <div style={{ position: 'relative', width: '100%' }}>
        <iframe
          id="myIframe"
          ref={iframeRef}
          src={iframeUrl}
          width="100%"
          height="400px"
          title="Embedded Website"
          style={{ border: '1px solid #ccc', display: 'block' }}
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
        {showOverlay && (
          <div
            ref={overlayRef}
            style={{
              position: 'absolute',
              backgroundColor: 'rgba(0, 191, 255, 0.2)',
              zIndex: 10,
              cursor: 'default',
            }}
            title="Mouse event overlay"
          />
        )}
      </div>

      <div
        style={{
          maxHeight: '400px',
          overflowY: 'auto',
          border: '1px solid #ccc',
          padding: '10px',
        }}
      >
        {events.length === 0 && <p>No events recorded yet.</p>}
        {events
          .filter((e) => e.type === 'click' || e.type === 'error')
          .map((event) => (
            <p key={event.id} style={{ margin: '5px 0' }}>
              [{event.timestamp}] {event.type}: {event.details}
            </p>
          ))}
      </div>
    </div>
  );
}
