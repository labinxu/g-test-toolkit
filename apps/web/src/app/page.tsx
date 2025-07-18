'use client';
import { useRef } from 'react';
import Head from 'next/head';

export default function Home() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const manipulateIframe = () => {
    const iframe = iframeRef.current;
    if (iframe) {
      console.log('==== iframe');
      const iframeDoc =
        iframe.contentDocument || iframe.contentWindow?.document;
      console.log(iframeDoc);
      if (iframeDoc) {
        const element = iframeDoc.querySelector('body');
        if (element) {
          element.style.backgroundColor = '#f0f0f0';
          const newDiv = iframeDoc.createElement('div');
          newDiv.id = 'createDiv';
          newDiv.textContent = 'This content was added by JavaScript!';
          newDiv.style.color = 'red';
          element.appendChild(newDiv);
        } else {
          console.error('Could not access iframe body');
        }
      } else {
        console.error('Could not access iframe content');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <Head>
        <title>Proxy Demo</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <h1 className="text-3xl font-bold mb-4">Proxy Demo</h1>
      <iframe
        ref={iframeRef}
        src="/api/proxy?url=https://qa12.gettr-qa.com"
        width="100%"
        height="600"
        className="border-2 border-gray-300"
        title="Proxy Iframe"
      />
      <button
        onClick={manipulateIframe}
        className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        Manipulate Iframe Content
      </button>
    </div>
  );
}
