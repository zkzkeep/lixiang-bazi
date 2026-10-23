// 自动断盘：纯规则推演，不调用任何 AI。
// 流程：旺衰 → 喜忌（扶抑 / 从格 / 调候）→ 各领域断语 → 大运 → 流年。
// 每条断语都带“依据”，方便学习者核对与挑错。
// 措辞原则：只说“倾向”，不作疾病、寿命、灾祸的断定。
import {
  CANG_GAN, GAN_WX, SS_GROUP, ZHI_WX, keWo, seasonOf, shengWo, shiShen, woKe, woSheng,
  type Gan, type ShiShen, type ShiShenGroup, type WuXing, type Zhi,
} from './constants.ts'
import { PILLAR_KEYS, makePillar, type Chart, type DaYun } from './chart.ts'
import { analyzeGeJu, analyzeStrength, type Strength } from './lifa.ts'
import { findRelations } from './relations.ts'
import { GAN_XIANG } from './xiangfa.ts'
import { chartNodes } from './nodes.ts'

// ---------------- 喜忌 ----------------

export type XJ = '用' | '喜' | '平' | '忌'
const XJ_SCORE: Record<XJ, number> = { 用: 2, 喜: 1, 平: 0, 忌: -1.5 }

export interface XiJi {
  mode: '扶抑' | '从弱' | '从强'
  level: Record<WuXing, XJ>
  yong: WuXing
  /** 十神大类 → 五行 */
  gw: Record<ShiShenGroup, WuXing>
  /** 十神大类在原局中的力量（同旺衰模型的权重） */
  weight: Record<ShiShenGroup, number>
  reasons: string[]
}

const GROUPS: ShiShenGroup[] = ['比劫', '印星', '食伤', '财星', '官杀']

export function judgeXiJi(chart: Chart, st: Strength): XiJi {
  const me = chart.dayWx
  const gw: Record<ShiShenGroup, WuXing> = { 比劫: me, 印星: shengWo(me), 食伤: woSheng(me), 财星: woKe(me), 官杀: keWo(me) }
  const weight = Object.fromEntries(GROUPS.map((g) => [g, 0])) as Record<ShiShenGroup, number>
  for (const it of st.items) weight[SS_GROUP[it.shiShen]] += it.weight
  for (const g of GROUPS) weight[g] = +weight[g].toFixed(2)

  const level = { 木: '平', 火: '平', 土: '平', 金: '平', 水: '平' } as Record<WuXing, XJ>
  const set = (g: ShiShenGroup, v: XJ) => { level[gw[g]] = v }
  const reasons: string[] = []
  const strongRoot = st.deDi.roots.some((r) => r.includes('本气') || r.includes('中气'))
  let mode: XiJi['mode'] = '扶抑'
  let yongG: ShiShenGroup

  if (st.ratio < 0.15 && !strongRoot) {
    mode = '从弱'
    const drains: ShiShenGroup[] = ['官杀', '财星', '食伤']
    yongG = drains.reduce((a, b) => (weight[b] > weight[a] ? b : a))
    set('印星', '忌'); set('比劫', '忌')
    drains.forEach((g) => set(g, '喜'))
    set(yongG, '用')
    reasons.push(`日主帮身仅占 ${(st.ratio * 100).toFixed(0)}%，且地支无本气、中气之根，按“从格”顺势：从${yongG}，以${gw[yongG]}为用，忌印比扶身。（从格真假争议大，请人工复核）`)
  } else if (st.ratio > 0.85 && weight['官杀'] < 0.5) {
    mode = '从强'
    yongG = weight['比劫'] >= weight['印星'] ? '比劫' : '印星'
    set('比劫', '喜'); set('印星', '喜'); set(yongG, '用')
    set('财星', '忌'); set('官杀', '忌')
    reasons.push(`帮身占 ${(st.ratio * 100).toFixed(0)}% 且几无官杀，按“从强/专旺”顺其旺势，以${gw[yongG]}为用，忌财官逆其气势。（请人工复核）`)
  } else if (st.ratio >= 0.5) {
    // 身强：印多用财破印；比劫多用官杀制之；无官杀则取食伤泄秀
    if (weight['印星'] > weight['比劫']) {
      yongG = '财星'
      reasons.push(`身强且印星（${weight['印星']}）重于比劫（${weight['比劫']}），“印多用财”，以财星${gw['财星']}为用神。`)
    } else if (weight['官杀'] > 0.3) {
      yongG = '官杀'
      reasons.push(`身强且比劫（${weight['比劫']}）为主，以官杀${gw['官杀']}制比劫为用神。`)
    } else {
      yongG = '食伤'
      reasons.push(`身强而官杀无力，取食伤${gw['食伤']}泄秀为用神。`)
    }
    set('食伤', '喜'); set('财星', '喜'); set('官杀', '喜'); set('印星', '忌'); set('比劫', '忌')
    set(yongG, '用')
  } else {
    // 身弱：杀重用印化杀；财重用比劫分财；食伤重用印制之
    const drains: ShiShenGroup[] = ['官杀', '财星', '食伤']
    const heavy = drains.reduce((a, b) => (weight[b] > weight[a] ? b : a))
    yongG = heavy === '财星' ? '比劫' : '印星'
    reasons.push(`身弱，克泄耗中以${heavy}（${weight[heavy]}）最重，${heavy === '官杀' ? '“杀重用印”，以印化杀生身' : heavy === '财星' ? '“财多用劫”，以比劫帮身分财' : '“伤官用印”，以印制食伤生身'}，取${gw[yongG]}为用神。`)
    set('印星', '喜'); set('比劫', '喜'); set('食伤', '忌'); set('财星', '忌'); set('官杀', '忌')
    set(yongG, '用')
  }

  // 调候修正
  const season = seasonOf(chart.pillars.month.zhi)
  const need: WuXing | undefined = season === '冬' ? '火' : season === '夏' ? '水' : undefined
  if (need && mode === '扶抑') {
    if (level[need] === '忌') {
      level[need] = '平'
      reasons.push(`生于${season}月，${need}有调候之功，虽按扶抑为忌，降为“闲神”，少量见之无妨。`)
    } else if (level[need] !== '用') {
      reasons.push(`生于${season}月，${need}兼有调候之功，为喜。`)
    }
  }
  if (st.ratio > 0.45 && st.ratio < 0.52 && mode === '扶抑') reasons.push('日主近于中和，喜忌界限不甚分明，岁运吉凶相对温和。')

  return { mode, level, yong: gw[yongG], gw, weight, reasons }
}

// ---------------- 原局中十神的分布 ----------------

interface Spot { pos: string; gong: string; col: number; gan: boolean; qi: 0 | 1 | 2; ss: ShiShen; char: Gan }
const COL_NAME = ['年', '月', '日', '时']

function spots(chart: Chart): Spot[] {
  const out: Spot[] = []
  PILLAR_KEYS.forEach((k, col) => {
    const p = chart.pillars[k]
    if (k !== 'day') out.push({ pos: `${COL_NAME[col]}干${p.gan}`, gong: `${COL_NAME[col]}干`, col, gan: true, qi: 0, ss: p.ganShiShen as ShiShen, char: p.gan })
    CANG_GAN[p.zhi].forEach((g, i) => out.push({ pos: `${COL_NAME[col]}支${p.zhi}${i ? '藏' + g : ''}`, gong: `${COL_NAME[col]}支`, col, gan: false, qi: i as 0 | 1 | 2, ss: shiShen(chart.dayGan, g), char: g }))
  })
  return out
}

// ---------------- 断语结构 ----------------

export interface Line { text: string; basis: string[] }
export interface Section { key: string; title: string; tone: '吉' | '平' | '忌'; summary: string; lines: Line[] }
export interface Duan {
  headline: string
  zonglun: Line[]
  xiji: XiJi
  sections: Section[]
}

const xjTxt = (x: XJ) => (x === '用' ? '用神' : x === '喜' ? '喜神' : x === '忌' ? '忌神' : '闲神')

export function duanChart(chart: Chart): Duan {
  const st = analyzeStrength(chart)
  const gj = analyzeGeJu(chart)
  const xj = judgeXiJi(chart, st)
  const male = chart.input.gender === 1
  const sp = spots(chart)
  const { gans, zhis } = chartNodes(chart)
  const rels = findRelations(gans, zhis)
  const dg = chart.dayGan
  const mz = chart.pillars.month.zhi

  const of = (...ss: ShiShen[]) => sp.filter((s) => ss.includes(s.ss))
  const tou = (...ss: ShiShen[]) => of(...ss).filter((s) => s.gan)
  const ben = (...ss: ShiShen[]) => of(...ss).filter((s) => !s.gan && s.qi === 0)
  const names = (l: Spot[]) => l.map((s) => s.pos).join('、')
  const lv = (g: ShiShenGroup) => xj.level[xj.gw[g]]
  const isXi = (g: ShiShenGroup) => lv(g) === '用' || lv(g) === '喜'
  const relAt = (label: string) => rels.filter((r) => r.members.includes(label))

  const ssMonth = shiShen(dg, CANG_GAN[mz][0])
  const headline = `${male ? '乾造' : '坤造'}，${dg}${chart.dayWx}日主，生于${mz}月（${seasonOf(mz)}季），${gj.name}，日主${st.verdict}${xj.mode !== '扶抑' ? `，近${xj.mode === '从弱' ? '从格' : '专旺'}` : ''}，以${xj.yong}为用神。`

  // ---- 总论 ----
  const zonglun: Line[] = [
    {
      text: `日主${dg}：${GAN_XIANG[dg]}`,
      basis: ['天干类象'],
    },
    {
      text: `月令${mz}为${ssMonth}，${st.deLing.ok ? '日主得令' : '日主失令'}；${st.deDi.ok ? '地支有根' : '地支无根'}，${st.deShi.ok ? '天干有帮' : '天干无助'}，综合为${st.verdict}。`,
      basis: [st.deLing.text, st.deDi.text, `帮身 ${st.support} / 耗身 ${st.drain}`],
    },
    {
      text: `格局：${gj.name}。喜：${gj.xi}；忌：${gj.ji}。${gj.checks.filter((c) => c.startsWith('⚠') || c.startsWith('✓')).join(' ')}`,
      basis: gj.steps,
    },
    {
      text: `喜忌：${(['木', '火', '土', '金', '水'] as WuXing[]).map((w) => `${w}为${xjTxt(xj.level[w])}`).join('，')}。`,
      basis: xj.reasons,
    },
  ]
  const big = rels.filter((r) => r.type.includes('三合') || r.type.includes('三会') || (r.type === '地支六冲' && r.members.some((m) => m === '月支' || m === '日支')))
  if (big.length) zonglun.push({ text: `结构要点：${big.map((r) => r.name).join('、')}，对全局力量影响较大，上面的量化结论需据此修正。`, basis: big.map((r) => `${r.members.join('·')}：${r.note}`) })

  const sections: Section[] = []
  const mk = (key: string, title: string, lines: Line[], score: number, summary: string): Section =>
    ({ key, title, lines, summary, tone: score > 0.5 ? '吉' : score < -0.5 ? '忌' : '平' })

  // ---- 性格 ----
  {
    const lines: Line[] = []
    const top = GROUPS.reduce((a, b) => (xj.weight[b] > xj.weight[a] ? b : a))
    const TRAIT: Record<ShiShenGroup, string> = {
      比劫: '自主性强、重义气、好胜，不愿受人摆布',
      印星: '重学习与思考、心地宽厚，也容易依赖与拖延',
      食伤: '聪明外露、表达欲强、追求自由与创造',
      财星: '务实、重结果、善于把握机会与资源',
      官杀: '责任心重、自律或好强，在规则与压力中成长',
    }
    lines.push({ text: `盘中${top}力量最大（${xj.weight[top]}），性格底色：${TRAIT[top]}。`, basis: [`十神力量：${GROUPS.map((g) => `${g}${xj.weight[g]}`).join('、')}`] })
    if (st.verdict.includes('强')) lines.push({ text: '日主偏旺，主见强、行动力足，宜学会倾听与收敛锋芒。', basis: [`日主${st.verdict}`] })
    if (st.verdict.includes('弱')) lines.push({ text: '日主偏弱，心思细、善体察，但易受环境影响，宜借平台与贵人发力。', basis: [`日主${st.verdict}`] })
    sections.push(mk('xing', '性格', lines, 0, TRAIT[top]))
  }

  // ---- 财富 ----
  {
    const lines: Line[] = []
    const cai = of('正财', '偏财')
    const w = xj.weight['财星']
    let score = isXi('财星') ? 1 : lv('财星') === '忌' ? -1 : 0
    if (!cai.length) {
      lines.push({ text: '原局财星不现，钱财观念较淡或求财方式不直接，财运多看岁运引出财星之时。', basis: ['四柱天干与藏干均无正偏财'] })
      score = 0
    } else {
      lines.push({
        text: `财星（${xj.gw['财星']}）为${xjTxt(lv('财星'))}，${isXi('财星') ? (w >= 2 ? '有力而为喜，求财能力较强，能聚财' : '为喜而力量不大，财运平稳，需岁运补财') : lv('财星') === '忌' ? (st.verdict.includes('弱') ? '财多身弱，钱财多经手而难久留，宜稳健理财、借力合作' : '财为忌神，因财生累，切忌贪多冒进') : '财星不是全局关键，财运中平'}。`,
        basis: [`财星分布：${names(cai)}`, `财星力量 ${w}`, `日主${st.verdict}`],
      })
      const pian = tou('偏财').length + ben('偏财').length, zheng = tou('正财').length + ben('正财').length
      if (pian > zheng) lines.push({ text: '偏财为主：财来多与经营、投资、人脉流动有关，起伏较大。', basis: [`偏财 ${pian} 处 / 正财 ${zheng} 处（透干与本气）`] })
      else if (zheng > 0) lines.push({ text: '正财为主：财以工资、专业收入、稳定积累为主。', basis: [`正财 ${zheng} 处 / 偏财 ${pian} 处（透干与本气）`] })
      const pos = [...new Set(cai.map((s) => s.col))].sort()
      const POS_CAI = ['祖上或早年家境有一定基础', '青年时期即能靠工作、事业得财', '配偶能带财，或因婚姻改善经济', '晚年或子女辈经济较好']
      lines.push({
        text: pos.length === 4 ? '财星遍布四柱，一生与钱财往来密切，各阶段都有求财机会。' : `财星落在${pos.map((c) => COL_NAME[c] + '柱').join('、')}：${pos.map((c) => POS_CAI[c]).join('；')}。`,
        basis: pos.map((c) => `宫位：${COL_NAME[c]}柱`),
      })
    }
    if (tou('食神', '伤官').length && cai.length) lines.push({ text: '食伤生财：靠技术、口才、创意、专业能力变现，适合以才求财。', basis: [`食伤：${names(of('食神', '伤官'))}`] })
    if (tou('比肩', '劫财').length && cai.length && st.verdict.includes('强')) { lines.push({ text: '比劫透出夺财：合伙、借贷、担保要谨慎，钱财易因朋友兄弟分散。', basis: [`比劫透干：${names(tou('比肩', '劫财'))}`] }); score -= 0.5 }
    const KU: Record<WuXing, Zhi> = { 木: '未', 火: '戌', 金: '丑', 水: '辰', 土: '辰' }
    const ku = KU[xj.gw['财星']]
    if (PILLAR_KEYS.some((k) => chart.pillars[k].zhi === ku)) lines.push({ text: `原局见财库${ku}，有储蓄、置产之象，财库逢冲（岁运）常为开库得财或破财之期。`, basis: [`${xj.gw['财星']}之库在${ku}`] })
    sections.push(mk('cai', '财富', lines, score, score > 0.5 ? '财为喜用，求财有利' : score < -0.5 ? '财为忌神，宜守不宜攻' : '财运中平，看岁运'))
  }

  // ---- 事业官运 ----
  {
    const lines: Line[] = []
    const guan = of('正官'), sha = of('七杀')
    let score = isXi('官杀') ? 1 : lv('官杀') === '忌' ? -1 : 0
    const GE_JOB: Record<string, string> = {
      正官格: '宜体制内、管理、公职等讲规则、重名誉的岗位',
      七杀格: '宜竞争性强、有权责的岗位，如管理、技术攻坚、军警法务',
      正财格: '宜财务、经营、实业等稳定求财的方向',
      偏财格: '宜经商、销售、投资等流动性强的方向',
      正印格: '宜教育、文化、研究、行政等文职方向',
      偏印格: '宜技术研发、医药、玄学、设计等偏门专业',
      食神格: '宜技艺、餐饮、教育、文创等以才艺服务的方向',
      伤官格: '宜技术、创意、传媒、自由职业，不宜受过多约束',
      建禄格: '多白手起家，靠自己打拼，宜专业技术或自主经营',
      阳刃格: '个性刚猛，宜有挑战、需魄力的行业，喜官杀约束成就权威',
    }
    lines.push({ text: `${gj.name}：${GE_JOB[gj.name] ?? '以格局喜忌定方向'}。`, basis: [gj.source] })
    if (!guan.length && !sha.length) lines.push({ text: '原局官杀不现，不喜受人管束，更适合专业技术或自主发展；职位升迁多看岁运引出官杀之时。', basis: ['四柱无正官七杀'] })
    else lines.push({ text: `官杀（${xj.gw['官杀']}）为${xjTxt(lv('官杀'))}，${isXi('官杀') ? '有利于担当职责、获得职位与认可' : '压力与约束较多，需以印化或食神制之方能转为权柄'}。`, basis: [`官杀分布：${names([...guan, ...sha])}`, `官杀力量 ${xj.weight['官杀']}`] })
    if (tou('伤官').length && tou('正官').length) { lines.push({ text: '伤官见官：与上级、制度易有摩擦，言行需留余地；更适合专业型、技术型发展。', basis: [`${names(tou('伤官'))} 与 ${names(tou('正官'))}`] }); score -= 0.5 }
    if (tou('正官').length && tou('七杀').length) lines.push({ text: '官杀混杂：机会与方向多而易摇摆，宜专注一条主线。', basis: [names(tou('正官', '七杀'))] })
    if (of('七杀').length && of('食神').length && tou('食神', '七杀').length) { lines.push({ text: '食神制杀：能以才干化解压力，有掌权、做技术权威之象。', basis: [names(of('食神', '七杀'))] }); score += 0.5 }
    if (of('七杀', '正官').length && of('正印', '偏印').length && tou('正印', '偏印', '七杀', '正官').length) { lines.push({ text: '官杀生印：宜在大平台、体制中借势上升，学历与资质对事业帮助大。', basis: [names(of('正印', '偏印'))] }); score += 0.3 }
    const mrel = relAt('月支').filter((r) => r.tone === 'chong')
    if (mrel.length) lines.push({ text: '月令逢冲：工作环境、单位易有变动，职业道路多转折。', basis: mrel.map((r) => r.name) })
    sections.push(mk('guan', '事业官运', lines, score, score > 0.5 ? '官杀为喜，利于事业与职位' : score < -0.5 ? '压力偏大，宜走专业路线' : '事业中平，重在方向选择'))
  }

  // ---- 婚姻感情 ----
  {
    const lines: Line[] = []
    const starSS: ShiShen[] = male ? ['正财', '偏财'] : ['正官', '七杀']
    const starG: ShiShenGroup = male ? '财星' : '官杀'
    const star = of(...starSS)
    const dz = chart.pillars.day.zhi
    const dzSS = shiShen(dg, CANG_GAN[dz][0])
    const dzLv = xj.level[ZHI_WX[dz]]
    let score = (isXi(starG) ? 0.5 : lv(starG) === '忌' ? -0.5 : 0) + (dzLv === '用' || dzLv === '喜' ? 0.5 : dzLv === '忌' ? -0.5 : 0)
    const starName = male ? '妻星（财）' : '夫星（官杀）'
    if (!star.length) lines.push({ text: `${starName}不现，感情来得较晚或缘分需岁运引动，配偶条件不宜要求过细。`, basis: [`四柱无${starSS.join('、')}`] })
    else if (star.length >= 4) lines.push({ text: `${starName}多现，异性缘较好，但选择多易犹豫，感情经历可能较丰富。`, basis: [`${starName}：${names(star)}`] })
    else lines.push({ text: `${starName}为${xjTxt(lv(starG))}，${isXi(starG) ? '配偶对自己有助力' : lv(starG) === '忌' ? '婚姻中压力或付出较多，需多沟通' : '配偶缘中平'}。`, basis: [`${starName}：${names(star)}`] })
    lines.push({ text: `配偶宫（日支${dz}）为${dzSS}，五行${ZHI_WX[dz]}为${xjTxt(dzLv)}：${dzLv === '用' || dzLv === '喜' ? '婚后生活较能给自己支持，家庭是助力' : dzLv === '忌' ? '婚姻中磨合较多，宜包容、留空间' : '婚姻平稳，重在经营'}。`, basis: [`日支${dz}本气${CANG_GAN[dz][0]}为${dzSS}`] })
    if (male && (dzSS === '正财' || dzSS === '偏财')) lines.push({ text: '妻星坐妻宫，夫妻缘分较紧密。', basis: [`日支本气为${dzSS}`] })
    if (!male && (dzSS === '正官' || dzSS === '七杀')) lines.push({ text: '夫星坐夫宫，夫妻缘分较紧密。', basis: [`日支本气为${dzSS}`] })
    if (dzSS === '比肩' || dzSS === '劫财') { lines.push({ text: '配偶宫见比劫，婚姻中重平等，也要留意第三方或竞争者介入。', basis: [`日支本气为${dzSS}`] }); score -= 0.3 }
    if (!male && xj.weight['食伤'] >= 3) { lines.push({ text: '食伤旺（克官星），对伴侣要求高、易挑剔，感情中宜多体谅。', basis: [`食伤力量 ${xj.weight['食伤']}`] }); score -= 0.3 }
    if (male && xj.weight['比劫'] >= 4 && star.length) { lines.push({ text: '比劫旺（克财星），感情易有竞争，婚后宜分清亲友与家庭的界限。', basis: [`比劫力量 ${xj.weight['比劫']}`] }); score -= 0.3 }
    const dr = relAt('日支')
    dr.filter((r) => r.tone === 'chong').forEach((r) => { lines.push({ text: `日支逢冲（${r.name}）：婚姻多变动、聚少离多或观念差异大，宜晚婚、多沟通。`, basis: [r.note] }); score -= 0.5 })
    dr.filter((r) => r.type === '地支六合').forEach((r) => lines.push({ text: `日支逢合（${r.name}）：感情投入深、恋家，也可能牵绊较多。`, basis: [r.members.join('·')] }))
    sections.push(mk('hun', '婚姻感情', lines, score, score > 0.5 ? '婚姻助力较大' : score < -0.5 ? '感情磨合较多，宜经营' : '婚姻中平'))
  }

  // ---- 子女 ----
  {
    const lines: Line[] = []
    const childSS: ShiShen[] = male ? ['正官', '七杀'] : ['食神', '伤官']
    const childG: ShiShenGroup = male ? '官杀' : '食伤'
    const child = of(...childSS)
    const tz = chart.pillars.time.zhi
    const tLv = xj.level[ZHI_WX[tz]]
    let score = (isXi(childG) ? 0.5 : lv(childG) === '忌' ? -0.3 : 0) + (tLv === '用' || tLv === '喜' ? 0.5 : tLv === '忌' ? -0.3 : 0)
    lines.push({ text: `子女星（${male ? '官杀' : '食伤'}）${child.length ? `见于${names(child)}，为${xjTxt(lv(childG))}` : '不现'}；时柱为子女宫，时支${tz}五行${ZHI_WX[tz]}为${xjTxt(tLv)}。`, basis: [`${male ? '男命以官杀为子女' : '女命以食伤为子女'}`] })
    lines.push({ text: score > 0.5 ? '子女缘较好，子女有出息、能为晚年助力。' : score < -0.3 ? '子女缘需用心经营，教养上多花心思，子女独立性较强。' : '子女缘中平，重在陪伴与教育。', basis: ['综合子女星与时柱喜忌'] })
    if (!male && tou('偏印').length && of('食神').length) { lines.push({ text: '偏印克食神，生育与子女事宜要多加用心。', basis: [names(of('偏印', '食神'))] }); score -= 0.3 }
    if (male && xj.weight['食伤'] >= 3 && child.length) lines.push({ text: '食伤旺克官杀，与子女观念易有代沟，宜放手而非管控。', basis: [`食伤力量 ${xj.weight['食伤']}`] })
    relAt('时支').filter((r) => r.tone === 'chong').forEach((r) => { lines.push({ text: `时支逢冲（${r.name}）：与子女聚少离多，或子女早离家发展。`, basis: [r.note] }); score -= 0.3 })
    sections.push(mk('zi', '子女', lines, score, score > 0.5 ? '子女缘佳' : score < -0.3 ? '子女事宜需用心' : '子女缘中平'))
  }

  // ---- 六亲 ----
  {
    const lines: Line[] = []
    const fa = of('偏财'), mu = of('正印', '偏印'), xd = of('比肩', '劫财')
    lines.push({ text: `父亲（偏财）：${fa.length ? `见于${names(fa)}，为${xjTxt(lv('财星'))}${isXi('财星') ? '，父亲对自己有帮助' : lv('财星') === '忌' ? '，与父亲观念或缘分有距离' : ''}` : '偏财不现，与父亲缘分较淡或父亲较少干预'}。`, basis: ['偏财为父'] })
    lines.push({ text: `母亲（印星）：${mu.length ? `见于${names(mu)}，为${xjTxt(lv('印星'))}${isXi('印星') ? '，得母亲、长辈照顾与庇护' : lv('印星') === '忌' ? '，长辈关爱多而易成束缚，需把握独立' : ''}` : '印星不现，早年较少依靠长辈，自立较早'}。`, basis: ['正印为母'] })
    lines.push({ text: `兄弟朋友（比劫）：${xd.length ? `为${xjTxt(lv('比劫'))}，${isXi('比劫') ? '兄弟朋友能相助' : lv('比劫') === '忌' ? '兄弟朋友之间多竞争与破耗，合作宜立规矩' : '往来平常'}` : '比劫不现，独立做事，朋友不多而精'}。`, basis: [`比劫力量 ${xj.weight['比劫']}`] })
    if (tou('偏财').length && tou('正印', '偏印').length) lines.push({ text: '财印同透（财克印），父母关系或家中意见常有分歧。', basis: [names(tou('偏财', '正印', '偏印'))] })
    const yr = rels.filter((r) => r.tone === 'chong' && r.members.includes('年支') && r.members.includes('月支'))
    if (yr.length) lines.push({ text: '年月相冲：早年家庭变动、离祖发展的倾向。', basis: yr.map((r) => r.name) })
    sections.push(mk('qin', '六亲', lines, 0, '父母兄弟缘分概览'))
  }

  // ---- 健康（只作养生提示） ----
  {
    const cnt: Record<WuXing, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 }
    for (const s of sp) cnt[GAN_WX[s.char]] += s.gan ? 1 : [0.6, 0.3, 0.1][s.qi] * (s.col === 1 ? 2 : 1)
    cnt[chart.dayWx] += 1
    const ORGAN: Record<WuXing, string> = { 木: '肝胆、筋骨', 火: '心血、眼目', 土: '脾胃、消化', 金: '肺、呼吸、皮肤', 水: '肾、泌尿、耳' }
    const ws = (Object.keys(cnt) as WuXing[]).sort((a, b) => cnt[a] - cnt[b])
    const lo = ws[0], hi = ws[4]
    sections.push(mk('jian', '健康养生', [
      { text: `五行中${lo}最弱、${hi}最旺。传统中医五行对应上，可多留意${ORGAN[lo]}方面的保养，${hi}过旺者注意${ORGAN[hi]}方面不宜透支。`, basis: [`五行力量：${ws.map((w) => `${w}${cnt[w].toFixed(1)}`).join('、')}`] },
      { text: '本条仅为传统养生观念的提示，不作任何健康诊断；身体不适请就医。', basis: [] },
    ], 0, '养生提示，不作诊断'))
  }

  return { headline, zonglun, xiji: xj, sections }
}

// ---------------- 大运 / 流年 ----------------

export interface YunDuan {
  title: string
  label: '顺遂' | '较顺' | '平稳' | '有波折' | '多阻'
  score: number
  lines: Line[]
}

const YUN_LABEL = (s: number): YunDuan['label'] => (s >= 1 ? '顺遂' : s >= 0.3 ? '较顺' : s > -0.3 ? '平稳' : s > -1 ? '有波折' : '多阻')

type Stage = 'child' | 'adult' | 'old'
const stageOf = (age: number): Stage => (age < 16 ? 'child' : age >= 66 ? 'old' : 'adult')

const GROUP_TOPIC: Record<ShiShenGroup, Record<Stage, { xi: string; ji: string }>> = {
  比劫: {
    child: { xi: '有同伴兄弟相伴，性格开朗自立', ji: '与同伴兄弟多争执，家中开销增大' },
    adult: { xi: '朋友同辈相助，合作、团队有利，自信心增强', ji: '竞争加剧，合伙破财，开销增多，人际是非' },
    old: { xi: '老友往来多，心境开朗', ji: '与亲友间琐事纷争，开销增加' },
  },
  印星: {
    child: { xi: '得父母长辈疼爱，学业顺利', ji: '受管束较多，学习易拖拉、依赖心重' },
    adult: { xi: '贵人长辈相助，利学业考证、置业、得资质', ji: '思虑过多、行动迟缓，依赖心重，计划易拖延' },
    old: { xi: '有依靠、安享清福，宜修身养性', ji: '思虑多、易孤闷，宜多走动交流' },
  },
  食伤: {
    child: { xi: '聪明伶俐，才艺显露', ji: '好动叛逆，不服管教' },
    adult: { xi: '才华发挥，利创作、表达、技术变现、创业', ji: '言多有失，与上级规则摩擦，精力透支' },
    old: { xi: '兴趣广泛，与晚辈相处融洽', ji: '精力易透支，宜量力而行' },
  },
  财星: {
    child: { xi: '家境改善，物质条件较好', ji: '家中经济压力较大，或学业受干扰' },
    adult: { xi: '财运上升，利经营投资', ji: '因财生累，投资宜谨慎' },
    old: { xi: '经济宽裕，晚景富足', ji: '钱财上宜守成，防受骗、防冒进' },
  },
  官杀: {
    child: { xi: '规矩意识强，学业有约束而成绩好', ji: '学习压力大，管教严厉' },
    adult: { xi: '利升迁、得职位与名誉', ji: '压力增大，工作责任重，需防是非' },
    old: { xi: '受人尊重，有声望', ji: '心理负担重，宜放下执念' },
  },
}
const LOVE: Partial<Record<ShiShenGroup, { male?: [string, string]; female?: [string, string] }>> = {
  财星: { male: ['感情机会增多', '感情多波折'] },
  官杀: { female: ['感情机会增多', '感情多纠结'] },
}

/** 一步运或一个流年里，某个干支对原局的作用 */
function evalGanZhi(chart: Chart, xj: XiJi, gan: Gan, zhi: Zhi, label: string, extra: ReturnType<typeof makePillar>[], age: number) {
  const dg = chart.dayGan
  const gSS = shiShen(dg, gan), zSS = shiShen(dg, CANG_GAN[zhi][0])
  const gL = xj.level[GAN_WX[gan]], zL = xj.level[ZHI_WX[zhi]]
  const score = 0.4 * XJ_SCORE[gL] + 0.6 * XJ_SCORE[zL]
  const lines: Line[] = []
  const g1 = SS_GROUP[gSS], g2 = SS_GROUP[zSS]
  const stage = stageOf(age)
  const male = chart.input.gender === 1
  const t = (g: ShiShenGroup, l: XJ) => {
    if (l === '平') return '影响不大'
    const good = l === '用' || l === '喜'
    let txt = good ? GROUP_TOPIC[g][stage].xi : GROUP_TOPIC[g][stage].ji
    const love = male ? LOVE[g]?.male : LOVE[g]?.female
    if (love && age >= 18 && age < 60) txt += '，' + (good ? love[0] : love[1])
    return txt
  }
  lines.push({ text: `天干${gan}为${gSS}（${GAN_WX[gan]}，${xjTxt(gL)}）：${t(g1, gL)}。`, basis: [`${gSS}属${g1}`] })
  lines.push({ text: `地支${zhi}为${zSS}（${ZHI_WX[zhi]}，${xjTxt(zL)}）：${t(g2, zL)}。`, basis: [`${zhi}本气${CANG_GAN[zhi][0]}`] })

  // 与原局的冲合
  const self = makePillar('dayun', label, gan, zhi, dg)
  const { gans, zhis } = chartNodes(chart, [...extra, self])
  const lab = label.replace('柱', '')
  const rels = findRelations(gans, zhis).filter((r) => r.members.some((m) => m.startsWith(lab)))
  const GONG: Record<string, string> = { 年支: '长辈、外部环境', 月支: '工作环境、父母', 日支: '婚姻感情、自身', 时支: '子女、下属、计划' }
  let adj = 0
  for (const r of rels) {
    const hit = r.members.find((m) => GONG[m])
    if (!hit) continue
    if (r.tone === 'chong') {
      const hz = zhis.find((z) => z.label === hit)!.char as Zhi
      const hl = xj.level[ZHI_WX[hz]]
      const good = hl === '忌'
      adj += good ? 0.3 : -0.3
      lines.push({ text: `${r.name}：冲动${hit}（${GONG[hit]}），${good ? '冲去忌神，变动中反有转机' : '该方面易有变动、奔波'}。`, basis: [r.note] })
    } else if (r.type === '地支六合' || r.type.includes('半合') || r.type.includes('三合') || r.type.includes('三会')) {
      lines.push({ text: `${r.name}：合动${hit}（${GONG[hit]}），该方面有新的牵连、机缘${hit === '日支' ? '，常见恋爱、婚姻之机' : ''}。`, basis: [r.members.join('·')] })
    } else if (r.tone === 'xing') {
      adj -= 0.2
      lines.push({ text: `${r.name}：刑动${hit}（${GONG[hit]}），需防摩擦、是非与反复。`, basis: [r.note] })
    } else if (r.type === '地支六害') {
      adj -= 0.1
      lines.push({ text: `${r.name}：害及${hit}（${GONG[hit]}），该方面易有暗中不顺、小人掣肘。`, basis: [r.note] })
    }
  }
  return { score: score + adj, lines, gSS, zSS }
}

export function duanDaYun(chart: Chart, dy: DaYun): YunDuan {
  const st = analyzeStrength(chart)
  const xj = judgeXiJi(chart, st)
  const r = evalGanZhi(chart, xj, dy.gan, dy.zhi, '大运', [], dy.startAge + 4)
  const lines = r.lines
  const stage = stageOf(dy.startAge + 4)
  lines.unshift({ text: `${dy.startYear}–${dy.endYear}（${dy.startAge}–${dy.startAge + 9}岁），走${dy.ganZhi}运。${stage === 'child' ? '童年运，主要应在家庭环境与学业上。' : stage === 'old' ? '晚年运，多应在心境、家庭与子女上。' : '地支主环境，力量约占六成。'}`, basis: [] })
  return { title: `${dy.ganZhi}运`, label: YUN_LABEL(r.score), score: +r.score.toFixed(2), lines }
}

export function duanLiuNian(chart: Chart, dy: DaYun, year: number, ganZhi: string): YunDuan {
  const st = analyzeStrength(chart)
  const xj = judgeXiJi(chart, st)
  const dg = chart.dayGan
  const male = chart.input.gender === 1
  const gan = ganZhi[0] as Gan, zhi = ganZhi[1] as Zhi
  const dyP = makePillar('dayun', '大运', dy.gan, dy.zhi, dg)
  // 虚岁：出生当年算 1 岁（与大运起运岁数同一口径）
  const age = year - Number(chart.usedTime.slice(0, 4)) + 1
  const r = evalGanZhi(chart, xj, gan, zhi, '流年', [dyP], age)
  const lines = r.lines
  const dyD = duanDaYun(chart, dy)
  lines.unshift({ text: `虚岁 ${age}，身处${dy.ganZhi}大运（${dyD.label}）。流年吉凶以大运为底色：运好年差多为小波折，运差年好多为短暂转机。`, basis: [] })
  const yz = chart.pillars.year.zhi
  if (zhi === yz) lines.push({ text: '本命年（值太岁），宜稳中求进，多关注身边变化。', basis: ['流年地支同年支'] })
  const starG: ShiShenGroup = male ? '财星' : '官杀'
  if ((SS_GROUP[r.gSS] === starG || SS_GROUP[r.zSS] === starG) && age >= 18 && age < 60) lines.push({ text: `流年引出${male ? '妻星（财）' : '夫星（官杀）'}，感情方面有新机缘或变化。`, basis: [`流年${r.gSS}/${r.zSS}`] })
  // 大运与流年天克地冲
  const ganChong = ['甲庚', '乙辛', '丙壬', '丁癸'].some((p) => p.includes(gan) && p.includes(dy.gan) && gan !== dy.gan)
  const zhiChong = ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥'].some((p) => p.includes(zhi) && p.includes(dy.zhi) && zhi !== dy.zhi)
  if (ganChong && zhiChong) { lines.push({ text: `流年与大运天克地冲，是变动较大的一年，重大决定宜三思。`, basis: [`${ganZhi} 冲 ${dy.ganZhi}`] }); r.score -= 0.4 }
  return { title: `${year} ${ganZhi}年`, label: YUN_LABEL(r.score), score: +r.score.toFixed(2), lines }
}

/** 导出为纯文本，方便复制 */
export function duanToText(chart: Chart, d: Duan): string {
  const out = [d.headline, '', '【总论】', ...d.zonglun.map((l) => l.text)]
  for (const s of d.sections) out.push('', `【${s.title}】${s.summary}`, ...s.lines.map((l) => `· ${l.text}`))
  out.push('', '【大运】')
  for (const dy of chart.daYun) {
    const y = duanDaYun(chart, dy)
    out.push(`${y.title}（${y.label}）`, ...y.lines.map((l) => `  · ${l.text}`))
  }
  out.push('', '（理象八字·规则推演，仅供学习参考）')
  return out.join('\n')
}

