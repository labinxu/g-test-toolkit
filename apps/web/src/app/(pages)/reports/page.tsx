'use client';
import { useState } from 'react';
import DirectoryTreePanel from '@/components/files/directory-tree-panel';

export default function Page() {
  const [currentFile, setCurrentFile] = useState('');
  const [currentDir, setCurrentDir] = useState('./workspace/Anonymouse');

  // 判断是否是html文件（简单判断后缀）
  const isHtmlFile =
    currentFile.endsWith('.html') || currentFile.endsWith('.htm');
  // 生成iframe的src
  const iframeSrc = isHtmlFile
    ? `/api/files/read?path=${encodeURIComponent(currentFile)}`
    : undefined;

  return (
    <div className="flex h-full w-full gap-0 rounded-lg">
      <div className="h-full flex flex-col" style={{ minWidth: 0 }}>
        <DirectoryTreePanel
          currentDir={currentDir}
          onSelect={setCurrentFile}
          onDirSelect={setCurrentDir}
        />
      </div>
      <div className="flex-1 pl-4 h-full min-w-0 flex flex-col transition-all duration-300">
        {isHtmlFile ? (
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
