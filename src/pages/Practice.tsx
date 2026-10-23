import { useState } from 'react'
import { buildChart, PILLAR_KEYS, type Chart } from '../core/chart.ts'
import { CANG_GAN, GAN, SHI_SHEN, ZHI, explainShiShen, shiShen, type Gan, type Zhi } from '../core/constants.ts'
import { analyzeStrength } from '../core/lifa.ts'
import { findRelations } from '../core/relations.ts'
import { Wu } from '../components/Wu.tsx'
import { store } from '../store.ts'

type Kind = 'shishen' | 'cang' | 'dun' | 'rel' | 'wang'
const KINDS: [Kind, string, string][] = [
  ['shishen', '十神识别', '随机命盘中任取一字，说出它对日主的十神'],
  ['cang', '地支藏干', '说出地支的本气或中气'],
  ['dun', '五虎遁/五鼠遁', '由年干推月干、由日干推时干'],
  ['rel', '地支关系', '两支之间有哪些关系（可多选）'],
  ['wang', '旺衰判断', '看整盘判断日主强弱，再对照模型打分'],
]

const rand = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]
const randInt = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1))

function randomChart(): Chart {
  return buildChart({
    name: '', gender: randInt(0, 1) as 0 | 1, calendar: 'solar',
    year: randInt(1950, 2010), month: randInt(1, 12), day: randInt(1, 28), hour: randInt(0, 23), minute: randInt(0, 59),
    useTrueSolar: false, lng: 120, sect: 1,
  })
}

export default function Practice() {
  const [kind, setKind] = useState<Kind>('shishen')
  const [stats, setStats] = useState(store.getDrills())
  const record = (ok: boolean) => { store.addDrill(kind, ok); setStats(store.getDrills()) }
  return (
    <div className="page">
      <section className="hero small">
        <h1>练习场</h1>
        <p>题目随机生成、无限刷。基本功练到“脱口而出”，看盘时才有余力思考。</p>
      </section>
      <div className="tabs wrap">
        {KINDS.map(([k, n]) => {
          const s = stats[k]
          return (
            <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
              {n}{s ? <small> {Math.round((s.right / s.total) * 100)}%</small> : null}
            </button>
          )
        })}
      </div>
      <p className="muted">{KINDS.find((k) => k[0] === kind)![2]}{stats[kind] ? `　累计 ${stats[kind].right}/${stats[kind].total}` : ''}</p>
      {kind === 'shishen' && <ShiShenDrill onDone={record} />}
      {kind === 'cang' && <CangDrill onDone={record} />}
      {kind === 'dun' && <DunDrill onDone={record} />}
      {kind === 'rel' && <RelDrill onDone={record} />}
      {kind === 'wang' && <WangDrill onDone={record} />}
    </div>
  )
}

type DrillProps = { onDone: (ok: boolean) => void }

/** 单选题的通用外壳 */
function Choice({ options, answer, explain, onDone, onNext }: { options: string[]; answer: string; explain: string; onDone: (ok: boolean) => void; onNext: () => void }) {
  const [pick, setPick] = useState<string | null>(null)
  const choose = (o: string) => { if (pick) return; setPick(o); onDone(o === answer) }
  return (
    <>
      <div className="opts grid">
        {options.map((o) => (
          <button key={o} className={pick ? (o === answer ? 'right' : o === pick ? 'wrong' : '') : ''} onClick={() => choose(o)}>{o}</button>
        ))}
      </div>
      {pick && (
        <>
          <p className="explain">{pick === answer ? '✓ 正确。' : `✗ 答案是 ${answer}。`}{explain}</p>
          <button className="primary" onClick={() => { setPick(null); onNext() }}>下一题</button>
        </>
      )}
    </>
  )
}

function MiniChart({ chart, hl }: { chart: Chart; hl?: string }) {
  return (
    <div className="mini">
      {PILLAR_KEYS.map((k) => {
        const p = chart.pillars[k]
        return (
          <div key={k} className="mini-col">
            <small>{p.label}</small>
            <span className={hl === `${k}-gan` ? 'hl' : ''}><Wu c={p.gan} /></span>
            <span className={hl === `${k}-zhi` ? 'hl' : ''}><Wu c={p.zhi} /></span>
            <small className="mini-h">{CANG_GAN[p.zhi].map((g, i) => <span key={i} className={hl === `${k}-h${i}` ? 'hl' : ''}><Wu c={g} /></span>)}</small>
          </div>
        )
      })}
    </div>
  )
}

function ShiShenDrill({ onDone }: DrillProps) {
  const make = () => {
    const chart = randomChart()
    const k = rand(PILLAR_KEYS)
    const p = chart.pillars[k]
    const useHidden = k === 'day' || Math.random() < 0.4
    const hi = randInt(0, CANG_GAN[p.zhi].length - 1)
    const g: Gan = useHidden ? CANG_GAN[p.zhi][hi] : p.gan
    return { chart, g, hl: useHidden ? `${k}-h${hi}` : `${k}-gan`, label: `${p.label}${useHidden ? `地支${p.zhi}藏的${g}` : `天干${g}`}` }
  }
  const [q, setQ] = useState(make)
  const ans = shiShen(q.chart.dayGan, q.g)
  return (
    <div className="card">
      <MiniChart chart={q.chart} hl={q.hl} />
      <p>日主 <Wu c={q.chart.dayGan} />，{q.label} 是什么十神？</p>
      <Choice key={q.hl + q.chart.usedTime} options={[...SHI_SHEN]} answer={ans} explain={explainShiShen(q.chart.dayGan, q.g)} onDone={onDone} onNext={() => setQ(make())} />
    </div>
  )
}

function CangDrill({ onDone }: DrillProps) {
  const make = () => {
    const z = rand(ZHI)
    const cang = CANG_GAN[z]
    const which = cang.length > 1 && Math.random() < 0.4 ? 1 : 0
    return { z, which, ans: cang[which], seed: Math.random() }
  }
  const [q, setQ] = useState(make)
  return (
    <div className="card">
      <p className="bigq"><Wu c={q.z} /> 的{q.which === 0 ? '本气' : '中气'}是？</p>
      <Choice key={q.seed} options={[...GAN]} answer={q.ans} explain={`${q.z}藏${CANG_GAN[q.z].join('、')}。`} onDone={onDone} onNext={() => setQ(make())} />
    </div>
  )
}

function DunDrill({ onDone }: DrillProps) {
  const make = () => {
    const tiger = Math.random() < 0.5
    const g = rand(GAN)
    const z = rand(ZHI)
    const gi = GAN.indexOf(g)
    let ans: Gan
    if (tiger) {
      const start = ((gi % 5) * 2 + 2) % 10 // 甲己→丙寅 …
      ans = GAN[(start + ((ZHI.indexOf(z) - 2 + 12) % 12)) % 10]
    } else {
      const start = (gi % 5) * 2 // 甲己→甲子 …
      ans = GAN[(start + ZHI.indexOf(z)) % 10]
    }
    return { tiger, g, z, ans, seed: Math.random() }
  }
  const [q, setQ] = useState(make)
  const rhyme = q.tiger
    ? '甲己之年丙作首，乙庚之岁戊为头，丙辛必定寻庚起，丁壬壬位顺行流，戊癸甲寅好追求。'
    : '甲己还加甲，乙庚丙作初，丙辛从戊起，丁壬庚子居，戊癸起壬子。'
  return (
    <div className="card">
      <p className="bigq">{q.tiger ? <><Wu c={q.g} />年的<Wu c={q.z} />月</> : <><Wu c={q.g} />日的<Wu c={q.z} />时</>}，天干是？</p>
      <Choice key={q.seed} options={[...GAN]} answer={q.ans} explain={`${q.tiger ? '五虎遁' : '五鼠遁'}：${rhyme}`} onDone={onDone} onNext={() => setQ(make())} />
    </div>
  )
}

const REL_OPTS = ['地支六合', '地支半合', '地支六冲', '地支相刑', '地支六害', '地支相破']

function RelDrill({ onDone }: DrillProps) {
  const make = () => {
    // 一半概率出“有关系”的组合，避免全是无关系
    let a: Zhi, b: Zhi, types: string[]
    do {
      a = rand(ZHI); b = rand(ZHI)
      types = [...new Set(findRelations([], [{ label: '甲', char: a }, { label: '乙', char: b }]).map((r) => r.type.replace('自刑', '相刑')))]
    } while (a === b || (types.length === 0 && Math.random() < 0.7))
    return { a, b, types, seed: Math.random() }
  }
  const [q, setQ] = useState(make)
  const [pick, setPick] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const truth = q.types.length ? q.types : ['无关系']
  const ok = done && pick.length === truth.length && pick.every((p) => truth.includes(p))
  const toggle = (o: string) => !done && setPick((p) => (o === '无关系' ? ['无关系'] : p.includes(o) ? p.filter((x) => x !== o) : [...p.filter((x) => x !== '无关系'), o]))
  return (
    <div className="card">
      <p className="bigq"><Wu c={q.a} /> 与 <Wu c={q.b} /></p>
      <div className="opts grid">
        {[...REL_OPTS, '无关系'].map((o) => (
          <button key={o} className={done ? (truth.includes(o) ? 'right' : pick.includes(o) ? 'wrong' : '') : pick.includes(o) ? 'on' : ''} onClick={() => toggle(o)}>{o.replace('地支', '')}</button>
        ))}
      </div>
      {!done ? (
        <button className="primary" disabled={!pick.length} onClick={() => { setDone(true); onDone(pick.length === truth.length && pick.every((p) => truth.includes(p))) }}>确定</button>
      ) : (
        <>
          <p className="explain">{ok ? '✓ 全对。' : '✗ '}正确答案：{truth.map((t) => t.replace('地支', '')).join('、')}。半合需有子午卯酉之一（帝旺）。</p>
          <button className="primary" onClick={() => { setQ(make()); setPick([]); setDone(false) }}>下一题</button>
        </>
      )}
    </div>
  )
}

function WangDrill({ onDone }: DrillProps) {
  const [chart, setChart] = useState(randomChart)
  const [pick, setPick] = useState<string | null>(null)
  const st = analyzeStrength(chart)
  const modelSide = st.ratio >= 0.52 ? '偏强' : st.ratio > 0.45 ? '中和' : '偏弱'
  const choose = (o: string) => { if (pick) return; setPick(o); onDone(o === modelSide) }
  return (
    <div className="card">
      <MiniChart chart={chart} />
      <p>日主 <Wu c={chart.dayGan} /> 生于 <Wu c={chart.pillars.month.zhi} /> 月，你判断？</p>
      <div className="opts grid">
        {['偏强', '中和', '偏弱'].map((o) => (
          <button key={o} className={pick ? (o === modelSide ? 'right' : o === pick ? 'wrong' : '') : ''} onClick={() => choose(o)}>{o}</button>
        ))}
      </div>
      {pick && (
        <>
          <div className="explain">
            <p>模型结论：<b>{st.verdict}</b>（帮身 {st.support} / 耗身 {st.drain}，占比 {(st.ratio * 100).toFixed(0)}%）</p>
            <ul className="list">
              <li>{st.deLing.text}</li>
              <li>{st.deDi.text}</li>
              <li>{st.deShi.text}</li>
            </ul>
            <p className="muted">模型没有计算合冲，判断不一致时先别急着认错——检查一下是不是盘里有合化或冲克改变了力量，那你可能比模型更对。</p>
          </div>
          <button className="primary" onClick={() => { setChart(randomChart()); setPick(null) }}>下一题</button>
        </>
      )}
    </div>
  )
}
