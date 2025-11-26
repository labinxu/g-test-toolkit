/* eslint-disable no-console */
// 导出 ~/wks/web-fe 中 React Router 的路由配置为 JSON
//
// 使用方式（在 g-test-toolkit 根目录执行）：
//   node scripts/export-web-fe-routes.js               # 使用默认路径 ../web-fe/src/app/routes/index.js
//   node scripts/export-web-fe-routes.js path/to/file  # 指定其它 routes 源文件
//
// 输出示例：
// [
//   { "source": "jsx", "path": "/", "component": "NewDashboard" },
//   { "source": "array:regularRoutes", "path": "/payment/success", "component": "NewDashboard" },
//   ...
// ]

const fs = require('fs')
const path = require('path')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default

function getComponentNameFromJsx(jsx) {
  if (!jsx || jsx.type !== 'JSXElement') return null
  const nameNode = jsx.openingElement.name
  if (!nameNode) return null

  if (nameNode.type === 'JSXIdentifier') {
    return nameNode.name
  }

  if (nameNode.type === 'JSXMemberExpression') {
    // e.g. Layout.Main
    const parts = []
    let cur = nameNode
    // Walk Layout.Main.Other -> ["Layout", "Main", "Other"]
    while (cur) {
      if (cur.property && cur.property.type === 'JSXIdentifier') {
        parts.unshift(cur.property.name)
      }
      if (cur.object && cur.object.type === 'JSXIdentifier') {
        parts.unshift(cur.object.name)
        break
      }
      cur = cur.object
    }
    return parts.join('.') || null
  }

  return null
}

function exportRoutesFromFile(filePath) {
  const abs = path.resolve(filePath)
  const code = fs.readFileSync(abs, 'utf8')

  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: [
      'jsx',
      'classProperties',
      'objectRestSpread',
      'dynamicImport',
      'optionalChaining',
      'nullishCoalescingOperator',
    ],
  })

  /** @type {{ source: string; path: string; component: string | null }[]} */
  const routes = []

  // 1) 解析形如 const xxxRoutes = [ { path: '/foo', component: Foo }, ... ]
  traverse(ast, {
    VariableDeclarator(p) {
      const init = p.node.init
      if (!init || init.type !== 'ArrayExpression') return
      const varName = p.node.id && p.node.id.type === 'Identifier' ? p.node.id.name : 'unknown'

      for (const el of init.elements) {
        if (!el || el.type !== 'ObjectExpression') continue
        let routePath = null
        let componentName = null
        let isIndex = false
        let elementJsx = null

        for (const prop of el.properties) {
          if (prop.type !== 'ObjectProperty') continue
          const key =
            prop.key.type === 'Identifier'
              ? prop.key.name
              : prop.key.type === 'StringLiteral'
              ? prop.key.value
              : null
          if (!key) continue

          if (key === 'path' && prop.value.type === 'StringLiteral') {
            routePath = prop.value.value
          } else if (key === 'index' && prop.value.type === 'BooleanLiteral') {
            if (prop.value.value) isIndex = true
          } else if (key === 'component' && prop.value.type === 'Identifier') {
            componentName = prop.value.name
          } else if (key === 'element') {
            if (prop.value.type === 'JSXElement') {
              elementJsx = prop.value
            } else if (
              prop.value.type === 'JSXExpressionContainer' &&
              prop.value.expression &&
              prop.value.expression.type === 'JSXElement'
            ) {
              elementJsx = prop.value.expression
            }
          }
        }

        if (!routePath && !isIndex) continue
        if (!componentName && elementJsx) {
          componentName = getComponentNameFromJsx(elementJsx)
        }

        routes.push({
          source: `array:${varName}`,
          path: routePath || '(index)',
          component: componentName || null,
        })
      }
    },
  })

  // 2) 解析 JSX 中的 <Route path="/xxx" element={<Component ... />} />
  traverse(ast, {
    JSXElement(p) {
      const opening = p.node.openingElement
      if (!opening || opening.name.type !== 'JSXIdentifier') return
      if (opening.name.name !== 'Route') return

      let routePath = null
      let elementJsx = null

      for (const attr of opening.attributes) {
        if (attr.type !== 'JSXAttribute') continue
        const attrName = attr.name && attr.name.name
        if (attrName === 'path') {
          if (attr.value && attr.value.type === 'StringLiteral') {
            routePath = attr.value.value
          }
        } else if (attrName === 'element') {
          if (attr.value && attr.value.type === 'JSXElement') {
            elementJsx = attr.value
          } else if (
            attr.value &&
            attr.value.type === 'JSXExpressionContainer' &&
            attr.value.expression &&
            attr.value.expression.type === 'JSXElement'
          ) {
            elementJsx = attr.value.expression
          }
        }
      }

      if (!routePath) return
      const componentName = elementJsx ? getComponentNameFromJsx(elementJsx) : null

      routes.push({
        source: 'jsx',
        path: routePath,
        component: componentName || null,
      })
    },
  })

  // 简单去重：按 (source, path, component) 作为 key
  const seen = new Set()
  const deduped = []
  for (const r of routes) {
    const key = `${r.source}::${r.path}::${r.component || ''}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(r)
  }

  return deduped
}

function main() {
  const argPath = process.argv[2]
  const defaultPath = path.join(__dirname, '..', '..', 'web-fe', 'src', 'app', 'routes', 'index.js')
  const target = argPath || defaultPath

  if (!fs.existsSync(target)) {
    console.error(`Routes file not found: ${target}`)
    process.exit(1)
  }

  const routes = exportRoutesFromFile(target)
  console.log(JSON.stringify(routes, null, 2))
}

if (require.main === module) {
  main()
}

