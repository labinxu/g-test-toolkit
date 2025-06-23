const { readFileSync } = await import('fs');
const { XMLParser } = await import('fast-xml-parser');
const filepath = './window_dump-0A171FDD40063C.xml';
const xmlstring = readFileSync(filepath);
const parser = new XMLParser({ ignoreAttributes: false });
const obj = parser.parse(xmlstring);
function findNode(node, attribute, text) {
    if (!node) return null;
    if (node[`@_${attribute}`] === text) {
      return node; // 找到即返回
    }
    // 递归子节点（node 可能有 node 或 node 数组）
    if (node.node) {
      if (Array.isArray(node.node)) {
        for (const child of node.node) {
          const found = findNode(child, attribute, text);
          if (found) return found;
        }
      } else {
        return findNode(node.node, attribute, text);
      }
    }
    return null;
  }

function findNodeByClassOrPackage(node, className, packageName) {
  if (!node) return null;
  // fast-xml-parser 默认属性名加@_前缀
  console.log(node['@_class']);
  if (node['@_class'] === className || node['@_package'] === packageName) {
    return node; // 找到即返回
  }
  // 递归子节点（node 可能有 node 或 node 数组）
  if (node.node) {
    if (Array.isArray(node.node)) {
      for (const child of node.node) {
        const found = findNodeByClassOrPackage(child, className, packageName);
        if (found) return found;
      }
    } else {
      return findNodeByClassOrPackage(node.node, className, packageName);
    }
  }
  return null;
}
const root = obj.hierarchy.node;
const target = findNode(root,'text','GETTR')


if (target) {
  console.log('bounds:', target['@_bounds'][0], target['@_bounds'][1]);

  const bounds = target['@_bounds'];
  const match = bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (match) {
    const x1 = parseInt(match[1]);
    const y1 = parseInt(match[2]);
    const x2 = parseInt(match[3]);
    const y2 = parseInt(match[4]);
    console.log([x1, y1], [x2, y2], [(x1 + x2) / 2, (y1 + y2) / 2]);
    // 输出: [28, 136] [1052, 1715]
  }
} else {
  console.log('未找到目标节点');
}
