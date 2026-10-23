// 先断后验：人工喜忌设定 + 已验证事件
// 学习者用真实经历校正模型，校正后的设定驱动断盘、大运、流年。
import { useMemo, useState } from 'react'
import type { Chart } from '../core/chart.ts'
import { XJ_KEYS, checkEvents, resolve, type Override, type VerifiedEvent, type XJ } from '../core/duan.ts'
import type { Strength } from '../core/lifa.ts'
import { newId } from '../store.ts'

const XJ_OPTS: [XJ, string][] = [['用', '用神'], ['喜', '喜神'], ['平', '闲神'], ['忌', '忌神']]
const VERDICTS: Strength['verdict'][] = ['身强', '偏强', '中和', '偏弱', '身弱']
const KEY_HINT: Record<string, string> = { 燥土: '戊戌未', 湿土: '己辰丑' }

export function OverrideEditor({ chart, ov, onChange }: { chart: Chart; ov?: Override; onChange: (v?: Override) => void }) {
  const { st0, base } = useMemo(() => resolve(chart), [chart])
  const prefill = () => onChange({
    verdict: st0.verdict,
    level: { 木: base.level['木'], 火: base.level['火'], 燥土: base.level['土'], 湿土: base.level['土'], 金: base.level['金'], 水: base.level['水'] },
    bingYao: '',
  })

  if (!ov) {
    return (
      <div className="card">
        <h3>我的喜忌设定</h3>
        <p className="muted">如果你用经历验证后不同意模型的旺衰或喜忌，可以在这里改成自己的判断。断盘、大运、流年会按你的设定重新推演，并保留模型结论作对照。</p>
        <button className="primary" onClick={prefill}>开始设定（先用模型结论预填）</button>
      </div>
    )
  }
  const setLevel = (k: (typeof XJ_KEYS)[number], v: XJ) => onChange({ ...ov, level: { ...ov.level, [k]: v } })
  return (
    <div className="card">
      <h3>我的喜忌设定 <span className="pill good">已启用</span></h3>
      <div className="row">
        <label className="field">
          <span>旺衰</span>
          <select value={ov.verdict ?? ''} onChange={(e) => onChange({ ...ov, verdict: (e.target.value || undefined) as Override['verdict'] })}>
            <option value="">沿用模型（{st0.verdict}）</option>
            {VERDICTS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      </div>
      <div className="xj-grid">
        {XJ_KEYS.map((k) => (
          <label key={k} className="field">
            <span>{k}{KEY_HINT[k] ? `（${KEY_HINT[k]}）` : ''}</span>
            <select value={ov.level[k]} onChange={(e) => setLevel(k, e.target.value as XJ)}>
              {XJ_OPTS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </label>
        ))}
      </div>
      <label className="field wide">
        <span>病药说明</span>
        <input value={ov.bingYao ?? ''} placeholder="如：病在火与燥土，药为金水" onChange={(e) => onChange({ ...ov, bingYao: e.target.value })} />
      </label>
      <div className="row">
        <button onClick={prefill}>恢复为模型结论</button>
        <button className="link danger" onClick={() => onChange(undefined)}>停用设定</button>
      </div>
      <p className="muted small">提示：五合化土、辰丑这类湿土能蓄水生金，与戌未燥土作用常相反，所以土分开设定。</p>
    </div>
  )
}

const FIT_CLS: Record<string, string> = { '✓': 'pos', '△': 'muted', '✗': 'neg', '—': 'muted' }

export function EventsEditor({ chart, ov, events, onChange }: { chart: Chart; ov?: Override; events: VerifiedEvent[]; onChange: (v: VerifiedEvent[]) => void }) {
  const [year, setYear] = useState(new Date().getFullYear() - 1)
  const [tone, setTone] = useState<VerifiedEvent['tone']>('吉')
  const [text, setText] = useState('')
  const rows = useMemo(() => checkEvents(chart, events, ov), [chart, events, ov])
  const scored = rows.filter((r) => r.fitModel !== '—')
  const count = (f: (r: (typeof rows)[number]) => string | undefined) => ({
    ok: scored.filter((r) => f(r) === '✓').length, mid: scored.filter((r) => f(r) === '△').length, bad: scored.filter((r) => f(r) === '✗').length,
  })
  const cm = count((r) => r.fitModel), cs = count((r) => r.fitMine)

  const add = () => {
    if (!text.trim()) return
    onChange([...events, { id: newId(), year, tone, text: text.trim() }])
    setText('')
  }

  return (
    <div className="card">
      <h3>已验证事件</h3>
      <p className="muted">记下已经发生的大事和好坏，系统逐年检验{ov ? '你的设定和模型' : '模型'}能不能解释它们。✓ 方向吻合，△ 一方为“平”，✗ 判反。</p>
      <div className="row">
        <label className="field small"><span>年份</span><input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></label>
        <label className="field"><span>好坏</span>
          <select value={tone} onChange={(e) => setTone(e.target.value as VerifiedEvent['tone'])}>
            <option value="吉">好</option><option value="平">一般</option><option value="凶">差</option>
          </select>
        </label>
        <label className="field grow"><span>发生了什么</span><input value={text} placeholder="如：结婚；提拔；那年特别不顺" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} /></label>
        <button className="primary" onClick={add} disabled={!text.trim()}>添加</button>
      </div>
      {rows.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="compact">
              <thead><tr><th>年份</th><th>干支</th><th>大运</th><th>事件</th>{ov && <th>我的设定</th>}<th>模型</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.ev.id}>
                    <td>{r.ev.year}</td><td>{r.ganZhi}</td><td>{r.dayun}</td>
                    <td className="left">{r.ev.tone === '吉' ? '好' : r.ev.tone === '凶' ? '差' : '一般'}：{r.ev.text}</td>
                    {ov && <td>{r.mine ?? '—'} <b className={FIT_CLS[r.fitMine ?? '—']}>{r.fitMine}</b></td>}
                    <td>{r.model} <b className={FIT_CLS[r.fitModel]}>{r.fitModel}</b></td>
                    <td><button className="link danger" onClick={() => onChange(events.filter((e) => e.id !== r.ev.id))}>删</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {scored.length > 0 && (
            <p className="tip">
              {ov && <>你的设定：✓{cs.ok} △{cs.mid} ✗{cs.bad}；</>}模型：✓{cm.ok} △{cm.mid} ✗{cm.bad}。
              {ov && cs.ok - cs.bad > cm.ok - cm.bad ? '你的设定比模型更能解释已发生的事。' : ''}
              {' '}判反（✗）的年份最值得细看：是喜忌定错了，还是那年有模型没算到的合冲？
            </p>
          )}
        </>
      )}
    </div>
  )
}
