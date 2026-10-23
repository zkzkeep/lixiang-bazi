// 极简 Markdown：段落、列表、表格、**加粗**，够课程用即可
import { Fragment, type ReactNode } from 'react'
import { WuText } from './Wu.tsx'

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((seg, i) =>
    seg.startsWith('**') ? <strong key={i}>{seg.slice(2, -2)}</strong> : <Fragment key={i}>{seg}</Fragment>,
  )
}

export function Md({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!/^\|[-|\s]+\|$/.test(lines[i])) rows.push(lines[i].slice(1, -1).split('|').map((c) => c.trim()))
        i++
      }
      blocks.push(
        <div className="table-wrap" key={blocks.length}>
          <table>
            <thead><tr>{rows[0].map((c, j) => <th key={j}>{c}</th>)}</tr></thead>
            <tbody>{rows.slice(1).map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j}><WuText text={c} /></td>)}</tr>)}</tbody>
          </table>
        </div>,
      )
      continue
    }
    if (line.startsWith('- ')) {
      const items: string[] = []
      while (i < lines.length && lines[i].startsWith('- ')) items.push(lines[i++].slice(2))
      blocks.push(<ul key={blocks.length}>{items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>)
      continue
    }
    if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line)}</p>)
    i++
  }
  return <div className="md">{blocks}</div>
}
