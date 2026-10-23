// 按五行给干支上色
import { WX_COLOR, wxOfChar } from '../core/constants.ts'

export function Wu({ c, className }: { c: string; className?: string }) {
  const wx = wxOfChar(c)
  return <span className={className} style={wx ? { color: WX_COLOR[wx] } : undefined}>{c}</span>
}

/** 一段文本里单字的干支（表格单元格）才上色，避免把正文染花 */
export function WuText({ text }: { text: string }) {
  if (text.length === 1 && wxOfChar(text)) return <Wu c={text} />
  return <>{text}</>
}
