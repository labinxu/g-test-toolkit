'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@/app/context/session-context';
import DirectoryTreePanel from '@/components/files/directory-tree-panel';

export default function Page() {
  const [currentFile, setCurrentFile] = useState('');
  const [currentDir, setCurrentDir] = useState('reports');
  const [iframeSrc, setIframeSrc] = useState<string | undefined>(undefined);
  const { isAuthenticated, accessToken } = useSession();
  // Fetch file content when currentFile changes
  useEffect(() => {
    const fetchFileContent = async () => {
      if (!isAuthenticated) return;

      const isHtmlFile =
        currentFile.endsWith('.html') || currentFile.endsWith('.htm');
      if (!isHtmlFile) {
        setIframeSrc(undefined);
        return;
      }

      try {
        let response = await fetch(
          `/api/files/read?path=${encodeURIComponent(currentFile)}`,
          {
            headers: { Authorization: `Bearer ${accessToken}`, method: 'GET' },
            credentials: 'include',
          },
        );

        if (response.ok) {
          const content = await response.text();
          const blob = new Blob([content], { type: 'text/html' });
          const blobUrl = URL.createObjectURL(blob);
          setIframeSrc(blobUrl);

          // Clean up blob URL when component unmounts or file changes
          return () => URL.revokeObjectURL(blobUrl);
        } else {
          console.error('Failed to fetch file:', response.statusText);
          setIframeSrc(undefined);
        }
      } catch (error) {
        console.error('Fetch file error:', error);
        setIframeSrc(undefined);
      }
    };

    fetchFileContent();
  }, [currentFile, isAuthenticated, accessToken]);

  if (!isAuthenticated) {
    return null; // Redirect handled by useEffect
  }

  return (
    <div className="flex h-screen w-full gap-0 rounded-lg flex-1 min-h-0">
      <div className="h-full flex flex-col" style={{ minWidth: 0 }}>
        <DirectoryTreePanel
          currentDir={currentDir}
          onSelect={setCurrentFile}
          onDirSelect={setCurrentDir}
        />
      </div>
      <div className="flex-1 pl-4 h-full min-w-0 flex flex-col transition-all duration-300">
        {iframeSrc ? (
          <iframe
            src={iframeSrc}
            className="w-full h-full border rounded"
            title="Preview"
            style={{ flex: 1, minHeight: 0 }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            请选择一个 HTML 文件进行预览
          </div>
        )}
      </div>
    </div>
  );
}
