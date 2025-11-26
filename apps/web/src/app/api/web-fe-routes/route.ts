import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    // apps/web 为当前 app 根目录，向上两级回到 monorepo 根
    const appRoot = process.cwd()
    const repoRoot = path.resolve(appRoot, '..', '..')
    const jsonPath = path.join(repoRoot, 'web-fe-routes.json')

    if (!fs.existsSync(jsonPath)) {
      return NextResponse.json(
        {
          error: 'not_found',
          message:
            'web-fe-routes.json 未找到。请在仓库根目录执行脚本：node scripts/export-web-fe-routes.js > web-fe-routes.json',
          routes: [],
        },
        { status: 404 }
      )
    }

    const stat = await fs.promises.stat(jsonPath)
    const text = await fs.promises.readFile(jsonPath, 'utf8')

    let routes: any
    try {
      const parsed = JSON.parse(text)
      routes = Array.isArray(parsed) ? parsed : []
    } catch {
      return NextResponse.json(
        {
          error: 'invalid_json',
          message: 'web-fe-routes.json 解析失败，请确认文件内容为有效 JSON。',
          routes: [],
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      routes,
      lastModified: stat.mtime.toISOString(),
      filePath: path.relative(repoRoot, jsonPath),
    })
  } catch (e: any) {
    return NextResponse.json(
      {
        error: 'internal_error',
        message: e?.message || 'Failed to load web-fe-routes.json',
        routes: [],
      },
      { status: 500 }
    )
  }
}

