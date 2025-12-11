import { NextRequest, NextResponse } from 'next/server'
import { deleteConfigFile, readConfigFile } from '../_utils'

export async function GET(
  _req: NextRequest,
  context: {
    params: Promise<{ id: string }>
  }
) {
  const { id: rawId } = await context.params
  const id = (rawId || '').trim()
  if (!id) {
    return NextResponse.json(
      { error: 'bad_request', message: 'Missing routes config id' },
      { status: 400 }
    )
  }
  try {
    const { file, filePath, mtime, readOnly } = await readConfigFile(id)
    return NextResponse.json({
      id: file.id,
      name: file.name,
      routes: file.routes,
      meta: file.meta ?? {},
      filePath,
      lastModified: mtime.toISOString(),
      readOnly,
    })
  } catch (e: any) {
    return NextResponse.json(
      {
        error: 'not_found',
        message: e?.message || `Routes config "${id}" not found`,
      },
      { status: 404 }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  context: {
    params: Promise<{ id: string }>
  }
) {
  const { id: rawId } = await context.params
  const id = (rawId || '').trim()
  if (!id) {
    return NextResponse.json(
      { error: 'bad_request', message: 'Missing routes config id' },
      { status: 400 }
    )
  }

  // 不允许通过 API 删除 legacy web-fe 根文件
  if (id === 'web-fe') {
    return NextResponse.json(
      {
        error: 'forbidden',
        message: 'web-fe 为 legacy 配置，请手工管理仓库根目录的 web-fe-routes.json。',
      },
      { status: 403 }
    )
  }

  try {
    const { deleted, reason } = await deleteConfigFile(id)
    if (!deleted) {
      return NextResponse.json(
        {
          error: reason === 'not_found' ? 'not_found' : 'delete_failed',
          message:
            reason === 'not_found'
              ? `Routes config "${id}" not found`
              : `Failed to delete routes config "${id}"`,
        },
        { status: reason === 'not_found' ? 404 : 500 }
      )
    }
    return NextResponse.json({ result: 'ok', id })
  } catch (e: any) {
    return NextResponse.json(
      {
        error: 'internal_error',
        message: e?.message || `Failed to delete routes config "${id}"`,
      },
      { status: 500 }
    )
  }
}
