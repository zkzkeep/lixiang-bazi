import { useMemo, useState } from 'react'
import type { Chart, DaYun } from '../core/chart.ts'
import { XJ_KEYS, duanChart, duanDaYun, duanLiuNian, duanToText, type Line, type Override, type YunDuan } from '../core/duan.ts'
import { WUXING, WX_COLOR, type WuXing } from '../core/constants.ts'
import { Wu } from '../components/Wu.tsx'

function Lines({ lines, showBasis }: { lines: Line[]; showBasis: boolean }) {
  return (
    <ul className="duan-lines">
      {lines.map((l, i) => (
        <li key={i}>
          {l.text}
          {showBasis && l.basis.length > 0 && <div className="basis">依据：{l.basis.join('；')}</div>}
        </li>
      ))}
    </ul>
  )
}

const LABEL_CLS: Record<YunDuan['label'], string> = { 顺遂: 'good', 较顺: 'good', 平稳: 'mid', 有波折: 'bad', 多阻: 'bad' }
const KEY_COLOR: Record<string, string> = { 燥土: WX_COLOR['土'], 湿土: WX_COLOR['土'] }

function Pill({ label, model }: { label: YunDuan['label']; model?: YunDuan['label'] }) {
  return (
    <span className="pills">
      <span className={`pill ${LABEL_CLS[label]}`}>{label}</span>
      {model && <span className={`pill ghost ${LABEL_CLS[model]}`} title="模型结论">模型：{model}</span>}
    </span>
  )
}

export default function DuanTab({ chart, ov, onEdit }: { chart: Chart; ov?: Override; onEdit: () => void }) {
  const d = useMemo(() => duanChart(chart, ov), [chart, ov])
  const yuns = useMemo(() => chart.daYun.map((dy) => duanDaYun(chart, dy, ov)), [chart, ov])
  const modelYuns = useMemo(() => (ov ? chart.daYun.map((dy) => duanDaYun(chart, dy)) : []), [chart, ov])
  const [basis, setBasis] = useState(true)
  const [open, setOpen] = useState<number | null>(() => {
    const y = new Date().getFullYear()
    const i = chart.daYun.findIndex((dy) => y >= dy.startYear && y <= dy.endYear)
    return i >= 0 ? i : null
  })
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(duanToText(chart, d, ov))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* 剪贴板不可用时静默 */
    }
  }

  const chips: [string, string, string][] = d.xiji.keys
    ? XJ_KEYS.map((k) => [k, d.xiji.keys![k], KEY_COLOR[k] ?? WX_COLOR[k as WuXing]])
    : WUXING.map((w) => [w, d.xiji.level[w], WX_COLOR[w]])

  return (
    <>
      <div className="card duan-head">
        <p className="headline">{d.headline}</p>
        <div className="xiji">
          {chips.map(([k, v, color]) => (
            <span key={k} className={`xj xj-${v}`} style={{ borderColor: color }}>
              <b style={{ color }}>{k}</b>{v === '平' ? '闲' : v}
            </span>
          ))}
        </div>
        <div className="row">
          <label className="check"><input type="checkbox" checked={basis} onChange={(e) => setBasis(e.target.checked)} />显示推断依据</label>
          <button onClick={copy}>{copied ? '已复制' : '复制全文'}</button>
          <button className="link" onClick={onEdit}>{ov ? '修改我的设定' : '不同意？改成我的判断'}</button>
        </div>
        <p className="muted small">
          {ov
            ? '当前按你的人工设定推演；大运、流年旁的灰色标签是模型结论，方便对照。'
            : '纯规则推演，相当于按书本规则推出的“初步结论”，不等于大师断语。看到不同意的地方，正是值得深究的地方。'}
        </p>
      </div>

      <div className="card">
        <h3>总论</h3>
        <Lines lines={d.zonglun} showBasis={basis} />
      </div>

      {d.sections.map((s) => (
        <div key={s.key} className="card">
          <h3>{s.title} <span className={`pill ${s.tone === '吉' ? 'good' : s.tone === '忌' ? 'bad' : 'mid'}`}>{s.summary}</span></h3>
          <Lines lines={s.lines} showBasis={basis} />
        </div>
      ))}

      <div className="card">
        <h3>大运逐步分析</h3>
        <p className="muted small">点开一步大运，可看其中每一年的流年分析。</p>
        {chart.daYun.map((dy, i) => (
          <YunBlock key={dy.index} chart={chart} dy={dy} y={yuns[i]} model={modelYuns[i]} ov={ov} open={open === i} onToggle={() => setOpen(open === i ? null : i)} basis={basis} />
        ))}
      </div>
    </>
  )
}

function YunBlock({ chart, dy, y, model, ov, open, onToggle, basis }: {
  chart: Chart; dy: DaYun; y: YunDuan; model?: YunDuan; ov?: Override; open: boolean; onToggle: () => void; basis: boolean
}) {
  const thisYear = new Date().getFullYear()
  const [ly, setLy] = useState<number | null>(null)
  const years = useMemo(() => (open
    ? dy.liuNian.map((n) => ({ n, d: duanLiuNian(chart, dy, n.year, n.ganZhi, ov), m: ov ? duanLiuNian(chart, dy, n.year, n.ganZhi) : undefined }))
    : []), [open, chart, dy, ov])
  return (
    <div className={`yun-block ${open ? 'open' : ''}`}>
      <button className="yun-row" onClick={onToggle}>
        <span className="gz"><Wu c={dy.gan} /><Wu c={dy.zhi} /></span>
        <span className="muted">{dy.startYear}–{dy.endYear} · {dy.startAge}–{dy.startAge + 9}岁</span>
        <Pill label={y.label} model={model?.label} />
        <span className="chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="yun-body">
          <Lines lines={y.lines} showBasis={basis} />
          <div className="ln-list">
            {years.map(({ n, d, m }) => (
              <div key={n.year} className={`ln-item ${n.year === thisYear ? 'now' : ''}`}>
                <button className="ln-row" onClick={() => setLy(ly === n.year ? null : n.year)}>
                  <span>{n.year}</span>
                  <span className="gz"><Wu c={n.ganZhi[0]} /><Wu c={n.ganZhi[1]} /></span>
                  <span className="muted">{n.age}岁</span>
                  <Pill label={d.label} model={m?.label} />
                </button>
                {ly === n.year && <Lines lines={d.lines} showBasis={basis} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
