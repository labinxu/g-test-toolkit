import { redirect } from 'next/navigation'

export default function LegacyWebFeRoutesPage() {
  // 兼容旧路径，直接重定向到新的通用路由配置页面
  redirect('/testcases/libs/routes')
}
