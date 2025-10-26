import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'

export default function DrawerExample() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Drawer>
        <DrawerTrigger asChild>
          <Button variant="outline">打开右侧抽屉</Button>
        </DrawerTrigger>
        <DrawerContent className="fixed top-0 right-0 h-full w-80 bg-white shadow-lg">
          <DrawerHeader>
            <DrawerTitle>右侧抽屉面板</DrawerTitle>
            <DrawerDescription>这是一个从右侧滑出的抽屉面板示例。</DrawerDescription>
          </DrawerHeader>
          <div className="p-4">
            <p>在这里可以放置你的内容，例如表单、列表或其他组件。</p>
            <ul className="mt-4 space-y-2">
              <li>选项 1</li>
              <li>选项 2</li>
              <li>选项 3</li>
            </ul>
          </div>
          <DrawerFooter>
            <Button>提交</Button>
            <DrawerClose asChild>
              <Button variant="outline">取消</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
