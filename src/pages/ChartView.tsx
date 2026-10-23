import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { buildChart, countWuXing, makePillar, PILLAR_KEYS, type Chart, type Pillar } from '../core/chart.ts'
import { CANG_GAN, GAN_WX, WUXING, WX_COLOR, explainShiShen, shiShen, type Gan, type Zhi } from '../core/constants.ts'
import { analyzeGeJu, analyzeStrength, analyzeYongShen } from '../core/lifa.ts'
import { findRelations, type Relation } from '../core/relations.ts'
import { chartNodes } from '../core/nodes.ts'
import { GAN_XIANG, ZHI_XIANG, comboXiang, gongWeiXiang, riZhuXiang, shenSha } from '../core/xiangfa.ts'
import { Wu } from '../components/Wu.tsx'
import DuanTab from './DuanTab.tsx'
import { explainLingConflict, judgeXiJi, reconcileGeJu, type Override, type VerifiedEvent } from '../core/duan.ts'
import { EventsEditor, OverrideEditor } from './SettingPanel.tsx'
import { newId, store } from '../store.ts'

type Tab = 'base' | 'duan' | 'li' | 'xiang' | 'yun' | 'note'
const TABS: [Tab, string][] = [['base', '基本盘'], ['duan', '断盘'], ['li', '理法'], ['xiang', '象法'], ['yun', '岁运'], ['note', '先断后验']]

export default function ChartView() {
  const [cur] = useState(() => store.getCurrent())
  const [tab, setTab] = useState<Tab>('base')
  const [caseId, setCaseId] = useState(cur?.caseId)
  const [note, setNote] = useState(() => (cur?.caseId ? store.getCases().find((c) => c.id === cur.caseId)?.note ?? '' : ''))
  const [blind, setBlind] = useState(store.getBlind())
  const [revealed, setRevealed] = useState(false)
  const [saved, setSaved] = useState('')
  const caseOf = () => (cur?.caseId ? store.getCases().find((c) => c.id === cur.caseId) : undefined)
  const [ov, setOvState] = useState<Override | undefined>(() => cur?.override ?? caseOf()?.override)
  const [events, setEventsState] = useState<VerifiedEvent[]>(() => cur?.events ?? caseOf()?.events ?? [])
  // 设定与事件一改就写回“当前盘”，刷新页面也不丢；正式保存仍走“保存到命例”
  const setOv = (v?: Override) => { setOvState(v); if (cur) store.setCurrent({ ...cur, caseId, override: v, events }) }
  const setEvents = (v: VerifiedEvent[]) => { setEventsState(v); if (cur) store.setCurrent({ ...cur, caseId, override: ov, events: v }) }

  const chart = useMemo(() => (cur ? safeBuild(cur.input) : null), [cur])
  if (!cur) return <Navigate to="/" replace />
  if (!chart) return <div className="page"><div className="card">日期无效，请返回重新输入。<Link to="/">返回</Link></div></div>

  const save = () => {
    const id = caseId ?? newId()
    const old = store.getCases().find((c) => c.id === id)
    store.saveCase({ id, input: cur.input, note, override: ov, events, createdAt: old?.createdAt ?? Date.now(), updatedAt: Date.now() })
    store.setCurrent({ input: cur.input, caseId: id, override: ov, events })
    setCaseId(id)
    setSaved('已保存到「我的命例」')
    setTimeout(() => setSaved(''), 2000)
  }

  const covered = blind && !revealed && (tab === 'duan' || tab === 'li' || tab === 'xiang')

  return (
    <div className="page">
      <ChartHeader chart={chart} />
      <div className="tabs">
        {TABS.map(([k, n]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{n}</button>)}
      </div>

      {covered ? (
        <div className="card cover">
          <h3>先断，后验</h3>
          <p>你开启了“先断后验”模式。建议先到「先断后验」页写下你对旺衰、格局、用神和各方面的判断，再揭开断盘与理法、象法分析对照。</p>
          <div className="row">
            <button className="primary" onClick={() => setTab('note')}>去写判断</button>
            <button onClick={() => setRevealed(true)}>直接揭晓</button>
          </div>
        </div>
      ) : (
        <>
          {tab === 'base' && <BaseTab chart={chart} />}
          {tab === 'duan' && <DuanTab chart={chart} ov={ov} onEdit={() => setTab('note')} />}
          {tab === 'li' && <LiTab chart={chart} />}
          {tab === 'xiang' && <XiangTab chart={chart} />}
          {tab === 'yun' && <YunTab chart={chart} />}
        </>
      )}

      {tab === 'note' && (
        <>
        <OverrideEditor chart={chart} ov={ov} onChange={setOv} />
        <EventsEditor chart={chart} ov={ov} events={events} onChange={setEvents} />
        <div className="card">
          <label className="check">
            <input type="checkbox" checked={blind} onChange={(e) => { setBlind(e.target.checked); store.setBlind(e.target.checked) }} />
            开启“先断后验”模式（理法、象法默认遮住）
          </label>
          <p className="muted">建议按「旺衰 → 格局 → 用神 → 取象 → 岁运应期」的顺序写，写完再去看自动分析，记录分歧。</p>
          <textarea rows={12} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder={'旺衰：\n格局：\n用神：\n主要象意：\n已验证的事件：\n与自动分析的分歧：'} />
          <div className="row">
            <button className="primary" onClick={save}>保存到命例</button>
            {saved && <span className="ok">{saved}</span>}
            {blind && !revealed && <button onClick={() => { setRevealed(true); setTab('li') }}>写好了，揭晓分析</button>}
          </div>
        </div>
        </>
      )}
      {tab !== 'note' && (
        <div className="row end">
          <button onClick={save}>{caseId ? '更新命例' : '保存到命例'}</button>
          {saved && <span className="ok">{saved}</span>}
        </div>
      )}
    </div>
  )
}

function safeBuild(input: Parameters<typeof buildChart>[0]): Chart | null {
  try {
    return buildChart(input)
  } catch {
    return null
  }
}

function ChartHeader({ chart }: { chart: Chart }) {
  const { input, solarTime: st } = chart
  return (
    <div className="card head">
      <div className="head-main">
        <h2>{input.name || '未命名'} <small>{input.gender ? '乾造' : '坤造'}</small></h2>
        <Link to="/" className="link">修改</Link>
      </div>
      <div className="meta">
        <span>公历 {chart.solarText.slice(0, 16)}</span>
        <span>农历 {chart.lunarText}</span>
        {st && (
          <span title="经度时差 + 均时差">
            真太阳时 {chart.usedTime}（经度 {fmtMin(st.lngOffsetMin)}，均时差 {fmtMin(st.eotMin)}{st.dstMin ? '，夏令时 -60分' : ''}）
          </span>
        )}
        <span>节令：{chart.prevJie.split(' ')[0]}后（{chart.prevJie.split(' ')[1]}）</span>
      </div>
    </div>
  )
}
const fmtMin = (m: number) => `${m >= 0 ? '+' : ''}${m.toFixed(1)}分`

// ---------------- 基本盘 ----------------

function PillarTable({ pillars, dayGan, onPick }: { pillars: Pillar[]; dayGan: Gan; onPick?: (s: string) => void }) {
  return (
    <div className="table-wrap">
      <table className="pillars">
        <thead><tr><th></th>{pillars.map((p) => <th key={p.label}>{p.label}</th>)}</tr></thead>
        <tbody>
          <tr><td className="rh">十神</td>{pillars.map((p) => <td key={p.label} className="ss">{p.ganShiShen}</td>)}</tr>
          <tr className="big">
            <td className="rh">天干</td>
            {pillars.map((p) => (
              <td key={p.label}>
                <button className="char" onClick={() => onPick?.(p.ganShiShen === '日主' ? `${p.gan}为日主，是全盘的“我”。${GAN_XIANG[p.gan]}` : explainShiShen(dayGan, p.gan))}>
                  <Wu c={p.gan} />
                </button>
              </td>
            ))}
          </tr>
          <tr className="big">
            <td className="rh">地支</td>
            {pillars.map((p) => (
              <td key={p.label}>
                <button className="char" onClick={() => onPick?.(`${p.zhi}：${ZHI_XIANG[p.zhi]} 藏干 ${CANG_GAN[p.zhi].join('、')}（本气在前）。`)}>
                  <Wu c={p.zhi} />
                </button>
              </td>
            ))}
          </tr>
          <tr>
            <td className="rh">藏干</td>
            {pillars.map((p) => (
              <td key={p.label} className="hidden">
                {p.hidden.map((h) => (
                  <button key={h.gan} className="hid" onClick={() => onPick?.(explainShiShen(dayGan, h.gan))}>
                    <Wu c={h.gan} /><small>{h.shiShen}</small>
                  </button>
                ))}
              </td>
            ))}
          </tr>
          <tr><td className="rh">星运</td>{pillars.map((p) => <td key={p.label}>{p.xingYun}</td>)}</tr>
          <tr><td className="rh">自坐</td>{pillars.map((p) => <td key={p.label}>{p.ziZuo}</td>)}</tr>
          <tr><td className="rh">纳音</td>{pillars.map((p) => <td key={p.label} className="sm">{p.naYin}</td>)}</tr>
          <tr><td className="rh">空亡</td>{pillars.map((p) => <td key={p.label}>{p.xunKong}</td>)}</tr>
        </tbody>
      </table>
    </div>
  )
}

function BaseTab({ chart }: { chart: Chart }) {
  const [tip, setTip] = useState('点击任意天干、地支或藏干，查看十神推导与类象。')
  const wx = countWuXing(chart)
  const ss = shenSha(chart)
  return (
    <>
      <div className="card">
        <PillarTable pillars={PILLAR_KEYS.map((k) => chart.pillars[k])} dayGan={chart.dayGan} onPick={setTip} />
        <p className="tip">{tip}</p>
      </div>
      <div className="card">
        <h3>五行分布 <small className="muted">（天干 + 地支本气，共 8 字）</small></h3>
        <div className="wxbars">
          {WUXING.map((w) => (
            <div key={w} className="wxbar">
              <span style={{ color: WX_COLOR[w] }}>{w}</span>
              <div className="bar"><i style={{ width: `${(wx[w] / 8) * 100}%`, background: WX_COLOR[w] }} /></div>
              <span>{wx[w]}</span>
            </div>
          ))}
        </div>
        <p className="muted">日主 {chart.dayGan}{chart.dayWx}。五行个数只是“表面”，真正的力量要看月令和根气，见「理法」。</p>
      </div>
      <div className="card">
        <h3>其他</h3>
        <div className="kv">
          <span>胎元</span><b>{chart.taiYuan}</b>
          <span>命宫</span><b>{chart.mingGong}</b>
          <span>身宫</span><b>{chart.shenGong}</b>
          <span>起运</span><b>{chart.qiYun}</b>
        </div>
      </div>
      <div className="card">
        <h3>神煞 <small className="muted">（只列常用，神煞为辅）</small></h3>
        {ss.length ? (
          <ul className="list">
            {ss.map((s) => <li key={s.name}><b>{s.name}</b>：{s.pos.join('、')}。<span className="muted">{s.rule}</span>。{s.xiang}</li>)}
          </ul>
        ) : <p className="muted">原局未见常用神煞。</p>}
      </div>
    </>
  )
}

// ---------------- 理法 ----------------

function RelationList({ rels, empty }: { rels: Relation[]; empty: string }) {
  if (!rels.length) return <p className="muted">{empty}</p>
  return (
    <ul className="rels">
      {rels.map((r, i) => (
        <li key={i} className={`rel ${r.tone}`}>
          <div><span className="tag">{r.type}</span><b>{r.name}</b> <small className="muted">{r.members.join(' · ')}</small></div>
          <p>{r.note}</p>
        </li>
      ))}
    </ul>
  )
}

function LiTab({ chart }: { chart: Chart }) {
  const st = analyzeStrength(chart)
  const gj = analyzeGeJu(chart)
  const ys = analyzeYongShen(chart, st)
  const xj = judgeXiJi(chart, st)
  const conflict = explainLingConflict(chart, st, xj)
  const recon = reconcileGeJu(gj, st, xj)
  const { gans, zhis } = chartNodes(chart)
  const rels = findRelations(gans, zhis)
  const [showItems, setShowItems] = useState(false)

  return (
    <>
      <div className="card">
        <h3>第一步 · 干支关系</h3>
        <p className="muted">先看结构：字与字之间的合冲刑害会改变力量，后面的旺衰判断要用到。</p>
        <RelationList rels={rels} empty="原局四柱之间没有明显的合冲刑害，结构较“静”。" />
      </div>

      <div className="card">
        <h3>第二步 · 旺衰</h3>
        <ol className="steps">
          <li className={st.deLing.ok ? 'yes' : 'no'}><b>得令</b>：{st.deLing.text}</li>
          <li className={st.deDi.ok ? 'yes' : 'no'}><b>得地</b>：{st.deDi.text}</li>
          <li className={st.deShi.ok ? 'yes' : 'no'}><b>得势</b>：{st.deShi.text}</li>
          {st.adjustments.map((a, i) => <li key={i} className="adj"><b>修正</b>：{a}</li>)}
        </ol>
        <div className="meter">
          <div className="meter-bar"><i style={{ width: `${st.ratio * 100}%` }} /><em style={{ left: '50%' }} /></div>
          <div className="meter-lab"><span>帮身 {st.support}</span><b>{st.verdict}（{(st.ratio * 100).toFixed(0)}%）</b><span>耗身 {st.drain}</span></div>
        </div>
        <button className="link" onClick={() => setShowItems((v) => !v)}>{showItems ? '收起' : '展开'}量化明细</button>
        {showItems && (
          <div className="table-wrap">
            <table className="compact">
              <thead><tr><th>位置</th><th>字</th><th>十神</th><th>权重</th><th>作用</th><th>修正</th></tr></thead>
              <tbody>
                {st.items.map((it, i) => (
                  <tr key={i}><td>{it.pos}</td><td><Wu c={it.char} /></td><td>{it.shiShen}</td><td>{it.weight}</td><td className={it.value > 0 ? 'pos' : 'neg'}>{it.value > 0 ? '帮' : '耗'}</td><td className="muted">{it.note ?? ''}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {conflict && <p className="tip">{conflict.text}</p>}
        {/* 已有详细解释时，不再重复那条泛泛的“得令与总分不一致”提醒 */}
        <ul className="warn">{st.warnings.filter((w) => !(conflict && w.startsWith('得令与总分'))).map((w, i) => <li key={i}>{w}</li>)}</ul>
      </div>

      <div className="card">
        <h3>第三步 · 格局：{gj.name}</h3>
        <ol className="steps">{gj.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        <div className="kv">
          <span>喜</span><b>{gj.xi}</b>
          <span>忌</span><b>{gj.ji}</b>
        </div>
        <ul className="list">{gj.checks.map((c, i) => <li key={i}>{c}</li>)}</ul>
        <p className="tip">{recon.text}</p>
      </div>

      <div className="card">
        <h3>第四步 · 用神</h3>
        <div className="kv">
          <span>取法</span><b>{ys.method}</b>
          <span>扶抑喜用</span><b>{ys.yong.map((w) => <span key={w} style={{ color: WX_COLOR[w] }}>{w} </span>)}</b>
          <span>扶抑忌</span><b>{ys.ji.map((w) => <span key={w} style={{ color: WX_COLOR[w] }}>{w} </span>)}</b>
          <span>调候</span><b>{ys.tiaoHou.text}</b>
        </div>
        <ol className="steps">{ys.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      </div>
    </>
  )
}

// ---------------- 象法 ----------------

function XiangTab({ chart }: { chart: Chart }) {
  const st = analyzeStrength(chart)
  const combos = comboXiang(chart, st)
  const gw = gongWeiXiang(chart)
  return (
    <>
      <div className="card">
        <h3>日柱象</h3>
        <ul className="list">{riZhuXiang(chart).map((l, i) => <li key={i}>{l}</li>)}</ul>
      </div>
      <div className="card">
        <h3>十神组合象</h3>
        <p className="muted">筛选条件：两方至少一个透干，且同柱或相邻柱。象法给出“可能性”，理法决定“哪个成立”：请对照理法页的力量大小判断每条是否真的成象。</p>
        {combos.length ? (
          <ul className="rels">
            {combos.map((c) => (
              <li key={c.name} className="rel he">
                <div><b>{c.name}</b> <small className="muted">{c.hit}</small></div>
                <p><span className="tag">理</span>{c.li}</p>
                <p><span className="tag">象</span>{c.xiang}</p>
              </li>
            ))}
          </ul>
        ) : <p className="muted">未出现经典十神组合，可从宫位象入手。</p>}
      </div>
      <div className="card">
        <h3>宫位象 <small className="muted">宫位 × 十神</small></h3>
        <ul className="list">
          {gw.map((g) => <li key={g.pos}><b><Wu c={g.char} /> {g.pos}·{g.shiShen}</b>：{g.text}</li>)}
        </ul>
        <p className="muted">练习：结合理法页的喜忌，把上面的句子改写成“吉象”或“凶象”。例如喜用落时支→晚景好；忌神落时支→晚年操劳。</p>
      </div>
      <div className="card">
        <h3>干支类象</h3>
        <ul className="list">
          {PILLAR_KEYS.map((k) => {
            const p = chart.pillars[k]
            return <li key={k}><b>{p.label}</b> <Wu c={p.gan} />：{GAN_XIANG[p.gan]} <Wu c={p.zhi} />：{ZHI_XIANG[p.zhi]}</li>
          })}
        </ul>
      </div>
    </>
  )
}

// ---------------- 岁运 ----------------

function YunTab({ chart }: { chart: Chart }) {
  const thisYear = new Date().getFullYear()
  const initial = Math.max(0, chart.daYun.findIndex((d) => thisYear >= d.startYear && thisYear <= d.endYear))
  const [di, setDi] = useState(initial)
  const dy = chart.daYun[di]
  const [ly, setLy] = useState<number>(() => dy.liuNian.find((n) => n.year === thisYear)?.year ?? dy.liuNian[0].year)
  const ln = dy.liuNian.find((n) => n.year === ly) ?? dy.liuNian[0]

  const dyP = makePillar('dayun', '大运', dy.gan, dy.zhi, chart.dayGan)
  const lnP = makePillar('liunian', '流年', ln.ganZhi[0] as Gan, ln.ganZhi[1] as Zhi, chart.dayGan)
  const { gans, zhis } = chartNodes(chart, [dyP, lnP])
  // 只保留与大运/流年有关的关系
  const rels = findRelations(gans, zhis).filter((r) => r.members.some((m) => m.startsWith('大运') || m.startsWith('流年')))

  return (
    <>
      <div className="card">
        <p className="muted">{chart.qiYun}，{chart.jiaoYun}。</p>
        <div className="yun-scroll">
          {chart.daYun.map((d, i) => (
            <button key={d.index} className={`yun ${i === di ? 'on' : ''}`} onClick={() => { setDi(i); setLy(d.liuNian[0].year) }}>
              <small>{d.startAge}岁</small>
              <span className="gz"><Wu c={d.gan} /><Wu c={d.zhi} /></span>
              <small>{shiShen(chart.dayGan, d.gan)}</small>
              <small>{d.startYear}</small>
            </button>
          ))}
        </div>
        <div className="ln-grid">
          {dy.liuNian.map((n) => (
            <button key={n.year} className={`ln ${n.year === ly ? 'on' : ''} ${n.year === thisYear ? 'now' : ''}`} onClick={() => setLy(n.year)}>
              <small>{n.year}</small>
              <span><Wu c={n.ganZhi[0]} /><Wu c={n.ganZhi[1]} /></span>
              <small>{n.age}岁</small>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>原局 + {dy.ganZhi}运 + {ln.year}{ln.ganZhi}年</h3>
        <PillarTable pillars={[...PILLAR_KEYS.map((k) => chart.pillars[k]), dyP, lnP]} dayGan={chart.dayGan} />
        <p className="muted">
          大运{dy.ganZhi}：天干{dy.gan}为{shiShen(chart.dayGan, dy.gan)}，地支{dy.zhi}本气为{shiShen(chart.dayGan, CANG_GAN[dy.zhi][0])}（五行{GAN_WX[CANG_GAN[dy.zhi][0]]}），
          对照理法页的喜忌，判断这步运是“喜”还是“忌”。
        </p>
      </div>

      <div className="card">
        <h3>岁运与原局的作用</h3>
        <RelationList rels={rels} empty="此大运、流年与原局没有明显的合冲刑害，以天干十神的喜忌论即可。" />
        <p className="muted">应期提示：冲合到日支多应婚姻/自身，冲合月令多应工作环境/父母，冲合时柱多应子女/下属。</p>
      </div>
    </>
  )
}
