'use client';

import { useState } from 'react';
import { Slider } from '@/components/ui/slider';

export default function ResizableContent() {
  // 使用状态控制 content1 的宽度（以像素为单位）
  const [content1Width, setContent1Width] = useState(200);

  return (
    <div className="p-4">
      {/* 滑块控制 content1 的宽度 */}
      <div className="mb-4">
        <label className="block mb-2">
          调整 content1 宽度: {content1Width}px
        </label>
        <Slider
          value={[content1Width]}
          onValueChange={(value) => setContent1Width(value[0])}
          min={100} // 最小宽度
          max={500} // 最大宽度
          step={1} // 步长
          className="w-64"
        />
      </div>

      {/* 你的 div 结构 */}
      <div className="flex border border-gray-300">
        <div
          className="bg-blue-100 p-4"
          style={{ width: `${content1Width}px` }}
        >
          content1
        </div>
        <div className="bg-green-100 p-4 flex-1">content2</div>
      </div>
    </div>
  );
}
