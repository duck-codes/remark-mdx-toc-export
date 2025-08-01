import { Plugin } from 'unified'
import { visit } from 'unist-util-visit'
import { Root, Text } from 'mdast'
import { MdxjsEsm } from 'mdast-util-mdx'

// 生成esm插件 让package导入
// pnpm tsup plugins/remark-toc-export/index.ts --dts --format esm --out-dir plugins/remark-toc-export/dist --tsconfig tsconfig.tsup.json

export interface Heading {
  depth: number // h1 = 1, h2 = 2, ...
  text: string
  slug: string
}

const remarkTocExport: Plugin<[], Root> = () => {
  return (tree: Root) => {
    const headings: Heading[] = []

    visit(tree, 'heading', node => {
      const text = node.children.filter(
          (child): child is Text =>
            child.type === 'text' || child.type === 'inlineCode'
        )
        .map(child => child.value)
        .join('')

      // 如果提取的文本为空，跳过这个标题
      if (!text.trim()) {
        return
      }

      const slug = text
        .toLowerCase()
        .trim()
        .replace(/[^\u4e00-\u9fa5\w]+/g, '-') // 中文也转 slug
        .replace(/^-+|-+$/g, '')

      headings.push({
        depth: node.depth,
        text,
        slug,
      })
    })

    // 将 headings 数据添加到 AST 的 data 属性中
    if (!tree.data) {
      tree.data = {}
    }
    // 添加 headings 到 data 中，使其在 MDX 编译时可用
    ;(tree.data as Record<string, unknown>).headings = headings

    // 添加一个导出语句节点到 AST 的开头
    const exportNode: MdxjsEsm = {
      type: 'mdxjsEsm',
      value: `export const toc = ${JSON.stringify(headings, null, 2)};`,
      data: {
        estree: {
          type: 'Program',
          sourceType: 'module',
          body: [
            {
              type: 'ExportNamedDeclaration',
              specifiers: [],
              attributes: [],
              declaration: {
                type: 'VariableDeclaration',
                kind: 'const',
                declarations: [
                  {
                    type: 'VariableDeclarator',
                    id: {
                      type: 'Identifier',
                      name: 'toc',
                    },
                    init: {
                      type: 'ArrayExpression',
                      elements: headings.map(h => ({
                        type: 'ObjectExpression',
                        properties: [
                          {
                            type: 'Property',
                            key: { type: 'Identifier', name: 'depth' },
                            value: { type: 'Literal', value: h.depth },
                            kind: 'init',
                            method: false,
                            shorthand: false,
                            computed: false,
                          },
                          {
                            type: 'Property',
                            key: { type: 'Identifier', name: 'text' },
                            value: { type: 'Literal', value: h.text },
                            kind: 'init',
                            method: false,
                            shorthand: false,
                            computed: false,
                          },
                          {
                            type: 'Property',
                            key: { type: 'Identifier', name: 'slug' },
                            value: { type: 'Literal', value: h.slug },
                            kind: 'init',
                            method: false,
                            shorthand: false,
                            computed: false,
                          },
                        ],
                      })),
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    }

    // 将导出节点插入到 AST 的开头
    tree.children.unshift(exportNode)
  }
}

export default remarkTocExport
