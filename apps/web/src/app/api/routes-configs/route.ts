import { NextRequest, NextResponse } from 'next/server'
import { listProjects, normalizeRoutesPayload, sanitizeId, saveConfigFile } from './_utils'

export async function GET() {
  try {
    const projects = await listProjects()
    return NextResponse.json({ projects })
  } catch (e: any) {
    return NextResponse.json(
      {
        error: 'internal_error',
        message: e?.message || 'Failed to list routes configs',
        projects: [],
      },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        {
          error: 'bad_request',
          message: '请使用 multipart/form-data 上传 JSON 文件（字段名为 file）',
        },
        { status: 400 }
      )
    }

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof Blob)) {
      return NextResponse.json(
        {
          error: 'bad_request',
          message: '未找到文件字段 file',
        },
        { status: 400 }
      )
    }

    const rawProjectId = (form.get('projectId') as string | null) || ''
    const rawProjectName = (form.get('projectName') as string | null) || ''
    const overwriteRaw = (form.get('overwrite') as string | null) || ''
    const overwrite =
      overwriteRaw === '1' || overwriteRaw === 'true' || overwriteRaw.toLowerCase() === 'yes'

    let baseId = sanitizeId(rawProjectId)
    if (!baseId) {
      // derive from filename if possible
      const filename = (file as any).name as string | undefined
      if (filename) {
        const nameOnly = filename.replace(/\.json$/i, '')
        baseId = sanitizeId(nameOnly)
      }
    }
    if (!baseId) {
      return NextResponse.json(
        {
          error: 'bad_request',
          message: '无法确定项目 ID，请在表单中提供 projectId 或使用有含义的文件名',
        },
        { status: 400 }
      )
    }

    const text = await file.text()
    let json: any
    try {
      json = JSON.parse(text)
    } catch {
      return NextResponse.json(
        {
          error: 'invalid_json',
          message: '上传的文件不是有效的 JSON',
        },
        { status: 400 }
      )
    }

    const routes = normalizeRoutesPayload(json && (json.routes || json))
    if (!routes.length) {
      return NextResponse.json(
        {
          error: 'no_routes',
          message: 'JSON 中未找到有效的路由列表（期望为数组，元素包含 path 字段）',
        },
        { status: 400 }
      )
    }

    const name = rawProjectName || (typeof json.name === 'string' ? json.name : baseId)

    try {
      const { filePath, routeCount } = await saveConfigFile({
        id: baseId,
        name,
        routes,
        overwrite,
      })
      return NextResponse.json({
        result: 'ok',
        id: baseId,
        name,
        filePath,
        routeCount,
        overwrite,
      })
    } catch (e: any) {
      if ((e as any)?.code === 'E_EXISTS') {
        return NextResponse.json(
          {
            error: 'already_exists',
            message: `配置 "${baseId}" 已存在，如需覆盖请设置 overwrite=1`,
          },
          { status: 409 }
        )
      }
      throw e
    }
  } catch (e: any) {
    return NextResponse.json(
      {
        error: 'internal_error',
        message: e?.message || 'Failed to save routes config',
      },
      { status: 500 }
    )
  }
}
