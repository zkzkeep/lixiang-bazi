import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import type { BirthInput } from '../core/chart.ts'
import { CITIES } from '../core/solarTime.ts'
import { store } from '../store.ts'

const now = new Date()
const DEFAULT: BirthInput = {
  name: '',
  gender: 1,
  calendar: 'solar',
  year: 1990,
  month: 1,
  day: 1,
  hour: 12,
  minute: 0,
  useTrueSolar: true,
  lng: 120,
  place: '',
  dst: false,
  sect: 1,
}

export default function Home() {
  const nav = useNavigate()
  const [f, setF] = useState<BirthInput>(() => store.getCurrent()?.input ?? DEFAULT)
  const [leap, setLeap] = useState(f.calendar === 'lunar' && f.month < 0)
  const set = <K extends keyof BirthInput>(k: K, v: BirthInput[K]) => setF((x) => ({ ...x, [k]: v }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const input = { ...f, month: f.calendar === 'lunar' && leap ? -Math.abs(f.month) : Math.abs(f.month) }
    store.setCurrent({ input })
    nav('/chart')
  }

  const pickNow = () => {
    setF((x) => ({ ...x, calendar: 'solar', year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(), hour: now.getHours(), minute: now.getMinutes() }))
  }

  const num = (k: 'year' | 'month' | 'day' | 'hour' | 'minute', min: number, max: number, label: string) => (
    <label className="field small">
      <span>{label}</span>
      <input type="number" inputMode="numeric" min={min} max={max} value={Math.abs(f[k])}
        onChange={(e) => set(k, Number(e.target.value))} required />
    </label>
  )

  return (
    <div className="page">
      <section className="hero">
        <h1>理象八字</h1>
        <p>免费 · 开源 · 不收集任何数据。排盘只是起点，<strong>看懂每一步推理</strong>才是目的。</p>
      </section>

      <form className="card form" onSubmit={submit}>
        <div className="row">
          <label className="field grow">
            <span>姓名 / 备注</span>
            <input value={f.name} placeholder="可留空" onChange={(e) => set('name', e.target.value)} />
          </label>
          <div className="seg">
            <button type="button" className={f.gender === 1 ? 'on' : ''} onClick={() => set('gender', 1)}>乾造·男</button>
            <button type="button" className={f.gender === 0 ? 'on' : ''} onClick={() => set('gender', 0)}>坤造·女</button>
          </div>
        </div>

        <div className="row">
          <div className="seg">
            <button type="button" className={f.calendar === 'solar' ? 'on' : ''} onClick={() => set('calendar', 'solar')}>公历</button>
            <button type="button" className={f.calendar === 'lunar' ? 'on' : ''} onClick={() => set('calendar', 'lunar')}>农历</button>
          </div>
          {f.calendar === 'lunar' && (
            <label className="check"><input type="checkbox" checked={leap} onChange={(e) => setLeap(e.target.checked)} />闰月</label>
          )}
          <button type="button" className="link" onClick={pickNow}>用此刻</button>
        </div>

        <div className="row">
          {num('year', 1900, 2100, '年')}
          {num('month', 1, 12, '月')}
          {num('day', 1, 31, '日')}
          {num('hour', 0, 23, '时')}
          {num('minute', 0, 59, '分')}
        </div>

        <div className="row">
          <label className="check">
            <input type="checkbox" checked={f.useTrueSolar} onChange={(e) => set('useTrueSolar', e.target.checked)} />
            真太阳时校正
          </label>
          {f.useTrueSolar && (
            <>
              <label className="field">
                <span>出生地</span>
                <select value={f.place ?? ''} onChange={(e) => {
                  const c = CITIES.find((x) => x.name === e.target.value)
                  setF((x) => ({ ...x, place: e.target.value, lng: c ? c.lng : x.lng }))
                }}>
                  <option value="">自定义经度</option>
                  {CITIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </label>
              <label className="field small">
                <span>东经°</span>
                <input type="number" step="0.01" min={70} max={140} value={f.lng}
                  onChange={(e) => setF((x) => ({ ...x, lng: Number(e.target.value), place: '' }))} />
              </label>
            </>
          )}
        </div>

        <details className="adv">
          <summary>高级设置</summary>
          <div className="row">
            <label className="field">
              <span>子时流派</span>
              <select value={f.sect} onChange={(e) => set('sect', Number(e.target.value) as 1 | 2)}>
                <option value={1}>23:00 换日（早晚子不分）</option>
                <option value={2}>晚子时日柱算当天</option>
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={!!f.dst} onChange={(e) => set('dst', e.target.checked)} />
              夏令时（1986–1991 年夏季出生）
            </label>
          </div>
        </details>

        <button className="primary" type="submit">排盘</button>
      </form>

      <section className="grid3">
        <Link to="/learn" className="card tile">
          <h3>学堂</h3>
          <p>基础 → 初级 → 中级理法 → 高级象法 → 研修，每课带练习。</p>
        </Link>
        <Link to="/practice" className="card tile">
          <h3>练习场</h3>
          <p>随机命盘刷十神、藏干、合冲、旺衰，自动判分。</p>
        </Link>
        <Link to="/cases" className="card tile">
          <h3>我的命例</h3>
          <p>保存命盘与“先断后验”笔记，可导出备份。</p>
        </Link>
      </section>

      <p className="disclaimer">
        本工具用于学习中国传统命理文化，所有结论均为古典理论模型的推演，不构成医疗、法律、投资或人生重大决策建议。
      </p>
    </div>
  )
}
