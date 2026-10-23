import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildChart } from '../core/chart.ts'
import { Wu } from '../components/Wu.tsx'
import { store, type CaseItem } from '../store.ts'

export default function Cases() {
  const nav = useNavigate()
  const [list, setList] = useState(store.getCases())
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const open = (c: CaseItem) => { store.setCurrent({ input: c.input, caseId: c.id, override: c.override, events: c.events }); nav('/chart') }
  const del = (c: CaseItem) => {
    if (!confirm(`删除「${c.input.name || '未命名'}」？此操作不可恢复。`)) return
    store.deleteCase(c.id)
    setList(store.getCases())
  }
  const exportAll = () => {
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `理象八字-命例-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const importFile = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as CaseItem[]
      if (!Array.isArray(data) || !data.every((c) => c.id && c.input)) throw new Error('格式不对')
      store.importCases(data)
      setList(store.getCases())
      setMsg(`已导入 ${data.length} 条`)
    } catch (e) {
      setMsg(`导入失败：${(e as Error).message}`)
    }
  }

  return (
    <div className="page">
      <section className="hero small">
        <h1>我的命例</h1>
        <p>命例和笔记只保存在本机浏览器。换设备或清缓存前请先导出备份。</p>
      </section>
      <div className="row">
        <button onClick={exportAll} disabled={!list.length}>导出 JSON</button>
        <button onClick={() => fileRef.current?.click()}>导入 JSON</button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
        {msg && <span className="ok">{msg}</span>}
      </div>
      {!list.length && <div className="card muted">还没有命例。排盘后点“保存到命例”即可。</div>}
      {list.map((c) => {
        let gz = ''
        try {
          const ch = buildChart(c.input)
          gz = (['year', 'month', 'day', 'time'] as const).map((k) => ch.pillars[k].gan + ch.pillars[k].zhi).join(' ')
        } catch { gz = '（无法排盘）' }
        return (
          <div key={c.id} className="card case">
            <div className="case-main" onClick={() => open(c)}>
              <b>{c.input.name || '未命名'}</b> <small className="muted">{c.input.gender ? '乾' : '坤'} · {c.input.year}-{Math.abs(c.input.month)}-{c.input.day} {c.input.hour}:{String(c.input.minute).padStart(2, '0')}{c.input.calendar === 'lunar' ? '（农历）' : ''}</small>
              <div className="gz-line">{[...gz].map((ch, i) => <Wu key={i} c={ch} />)}</div>
              {c.note && <p className="muted clip">{c.note}</p>}
            </div>
            <button className="link danger" onClick={() => del(c)}>删除</button>
          </div>
        )
      })}
    </div>
  )
}
