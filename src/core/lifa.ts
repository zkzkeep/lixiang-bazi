// 理法：旺衰（得令/得地/得势）→ 格局（子平取格）→ 用神（扶抑 + 调候）
// 原则：每个结论都附“推导步骤”，并明确说出模型的简化之处，留给学习者人工修正。
import {
  CANG_GAN, GAN_WX, SS_GROUP, ZHI_WX, cangWeights, isYangGan, keWo, seasonOf, shengWo, shiShen,
  wangXiang, woKe, woSheng, type Gan, type ShiShen, type WuXing,
} from './constants.ts'
import { PILLAR_KEYS, type Chart, type PillarKey } from './chart.ts'
import { liuHe } from './relations.ts'

export interface ScoreItem {
  pos: string
  char: string
  shiShen: ShiShen
  weight: number
  /** 正数=帮身（印比），负数=耗身（食财官） */
  value: number
  /** 权重修正说明，如“卯戌合绊 ×0.7” */
  note?: string
}

export interface Strength {
  deLing: { ok: boolean; state: string; text: string }
  deDi: { ok: boolean; roots: string[]; text: string }
  deShi: { ok: boolean; helpers: string[]; text: string }
  items: ScoreItem[]
  support: number
  drain: number
  ratio: number
  verdict: '身强' | '偏强' | '中和' | '偏弱' | '身弱'
  /** 对静态计数做过的修正（目前只有月令合绊） */
  adjustments: string[]
  /** 得令与总分结论相反 */
  lingConflict: boolean
  warnings: string[]
}

const POS_GAN: Record<PillarKey, string> = { year: '年干', month: '月干', day: '日干', time: '时干' }
const POS_ZHI: Record<PillarKey, string> = { year: '年支', month: '月支', day: '日支', time: '时支' }
/** 位置权重：月令为提纲（×3），日支贴身（×1.5），其余为 1 */
const ZHI_POS_W: Record<PillarKey, number> = { year: 1, month: 3, day: 1.5, time: 1 }

const isSupport = (s: ShiShen) => SS_GROUP[s] === '印星' || SS_GROUP[s] === '比劫'

/** 合绊系数：两支相合，彼此牵绊，各自发挥的力量打七折 */
const HE_BAN = 0.7

export function analyzeStrength(chart: Chart): Strength {
  const dg = chart.dayGan
  const me = GAN_WX[dg]
  const monthZhi = chart.pillars.month.zhi
  const ling = ZHI_WX[monthZhi]

  // 得令：日主五行在月令的旺相休囚死
  const state = wangXiang(ling, me)
  const lingOk = state === '旺' || state === '相'
  const deLing = {
    ok: lingOk,
    state,
    text: `月令${monthZhi}属${ling}，日主${dg}${me}在此月为「${state}」${lingOk ? '，得令' : '，失令'}。（当令者旺、令生者相、生令者休、克令者囚、令克者死）`,
  }

  // 得地：地支藏干中有比劫（根）或印（生）
  const roots: string[] = []
  for (const k of PILLAR_KEYS) {
    const z = chart.pillars[k].zhi
    CANG_GAN[z].forEach((g, i) => {
      if (GAN_WX[g] === me) roots.push(`${POS_ZHI[k]}${z}藏${g}（${i === 0 ? '本气' : i === 1 ? '中气' : '余气'}根）`)
    })
  }
  const deDi = {
    ok: roots.length > 0,
    roots,
    text: roots.length ? `日主在地支有根：${roots.join('、')}。本气根最有力，余气根力弱。` : '四支藏干中无比劫，日主无根，“虚浮”。',
  }

  // 得势：天干有印比相帮
  const helpers: string[] = []
  for (const k of PILLAR_KEYS) {
    if (k === 'day') continue
    const g = chart.pillars[k].gan
    const s = shiShen(dg, g)
    if (isSupport(s)) helpers.push(`${POS_GAN[k]}${g}（${s}）`)
  }
  const deShi = {
    ok: helpers.length > 0,
    helpers,
    text: helpers.length ? `天干有帮扶：${helpers.join('、')}。` : '天干无印比帮扶，日主孤立。',
  }

  // 月令合绊：月支与紧邻的年支或日支六合，双方互相牵绊，力量各减三成
  const adjustments: string[] = []
  const banned = new Map<PillarKey, string>()
  for (const k of ['year', 'day'] as PillarKey[]) {
    const z = chart.pillars[k].zhi
    const he = liuHe(monthZhi, z)
    if (!he) continue
    const tag = `${monthZhi}${z}合绊 ×${HE_BAN}`
    banned.set('month', tag)
    banned.set(k, tag)
    adjustments.push(`月令${monthZhi}与${POS_ZHI[k]}${z}紧贴六合（合${he}），两支被合绊，各自力量按 ×${HE_BAN} 计。月令是提纲，被合住后得令的分量要打折扣。`)
  }

  // 量化：天干每字 1 分，地支按藏干权重 × 位置权重（× 合绊系数）
  const items: ScoreItem[] = []
  for (const k of PILLAR_KEYS) {
    if (k !== 'day') {
      const g = chart.pillars[k].gan
      const s = shiShen(dg, g)
      items.push({ pos: POS_GAN[k], char: g, shiShen: s, weight: 1, value: isSupport(s) ? 1 : -1 })
    }
    const z = chart.pillars[k].zhi
    const ws = cangWeights(z)
    const ban = banned.get(k)
    CANG_GAN[z].forEach((g, i) => {
      const s = shiShen(dg, g)
      const w = +(ws[i] * ZHI_POS_W[k] * (ban ? HE_BAN : 1)).toFixed(2)
      items.push({ pos: `${POS_ZHI[k]}${z}·${g}`, char: g, shiShen: s, weight: w, value: isSupport(s) ? w : -w, note: ban })
    })
  }
  const support = +items.filter((i) => i.value > 0).reduce((a, b) => a + b.value, 0).toFixed(2)
  const drain = +(-items.filter((i) => i.value < 0).reduce((a, b) => a + b.value, 0)).toFixed(2)
  const ratio = support / (support + drain)
  const verdict = ratio >= 0.62 ? '身强' : ratio >= 0.52 ? '偏强' : ratio > 0.45 ? '中和' : ratio > 0.35 ? '偏弱' : '身弱'

  const warnings: string[] = ['本模型以“静态计数”为主，只修正了月令被六合绊住的情况；其他合化、冲克、刑害对力量的增减，以及天干远近、地支是否透干都没有计算——这些正是需要你人工修正的地方。']
  if (ratio > 0.85) warnings.push('帮身力量极大，需考虑“专旺/从强”类特殊格局，不能简单按身强抑之。')
  if (ratio < 0.15) warnings.push('日主几乎无助，需考虑“从格”（从财、从杀、从儿），若日主无根且克泄极重，可能反以顺势为用。')
  const lingConflict = lingOk !== ratio >= 0.5
  if (lingConflict) warnings.push(`得令与总分结论不一致（${lingOk ? '得令却总分偏弱' : '失令却总分偏强'}），这类盘最考功夫，建议重点复核。`)

  return { deLing, deDi, deShi, items, support, drain, ratio, verdict, adjustments, lingConflict, warnings }
}

// ---------------- 格局 ----------------

export interface GeJu {
  name: string
  source: string
  steps: string[]
  xi: string
  ji: string
  checks: string[]
}

const GE_RULES: Record<string, { xi: string; ji: string }> = {
  正官格: { xi: '财星生官、印星护官，身官两停为上', ji: '伤官见官、官杀混杂、刑冲官星' },
  七杀格: { xi: '食神制杀，或印星化杀（杀印相生）', ji: '身弱无制无化、财星党杀' },
  正财格: { xi: '身强能任财，食伤生财，官星护财', ji: '比劫夺财、身弱财重' },
  偏财格: { xi: '身强能任财，食伤生财，官星护财', ji: '比劫夺财、身弱财重' },
  正印格: { xi: '官杀生印，身弱用印尤佳', ji: '财星坏印（贪财坏印）' },
  偏印格: { xi: '官杀生印，或以偏财制枭', ji: '枭神夺食（偏印克食神）' },
  食神格: { xi: '食神生财，或食神制杀', ji: '枭神夺食、身弱食重' },
  伤官格: { xi: '伤官生财，或伤官配印（身弱）', ji: '伤官见官' },
  建禄格: { xi: '禄劫不入格，另取透出之财官食伤为用', ji: '再见比劫、无财官可用' },
  阳刃格: { xi: '官杀制刃（刃杀相停）', ji: '无制而刃旺、再逢冲刃' },
}

export function analyzeGeJu(chart: Chart): GeJu {
  const dg = chart.dayGan
  const mz = chart.pillars.month.zhi
  const cang = CANG_GAN[mz]
  const tou: Gan[] = (['year', 'month', 'time'] as PillarKey[]).map((k) => chart.pillars[k].gan)
  const steps: string[] = [`月令${mz}藏干：${cang.map((g, i) => `${g}${['本气', '中气', '余气'][i]}`).join('、')}。`]

  let pick: Gan | undefined
  let source = ''
  for (let i = 0; i < cang.length; i++) {
    if (tou.includes(cang[i])) {
      pick = cang[i]
      source = `月令${['本气', '中气', '余气'][i]}${cang[i]}透出天干`
      steps.push(`年、月、时干中透出了${cang[i]}，按“月令透干者取格”，本气透优先于中余气。`)
      break
    }
  }
  if (!pick) {
    pick = cang[0]
    source = `月令藏干均未透，取本气${cang[0]}`
    steps.push('月令藏干均未透出，退而取月令本气论格。')
  }
  const ss = shiShen(dg, pick)
  let name: string
  if (ss === '比肩') name = '建禄格'
  else if (ss === '劫财') name = isYangGan(dg) ? '阳刃格' : '建禄格'
  else name = `${ss === '七杀' ? '七杀' : ss}格`
  steps.push(`${pick}对日主${dg}为${ss}，${ss === '比肩' || ss === '劫财' ? '月令为日主之禄/刃，比劫不能为格，称' + name : '故为' + name}。`)

  const rule = GE_RULES[name]
  // 成败自检：只看天干透出的十神组合
  const ssList = tou.map((g) => shiShen(dg, g))
  const hasSS = (s: ShiShen) => ssList.includes(s)
  const checks: string[] = []
  if (name === '正官格' && hasSS('伤官')) checks.push('⚠ 天干伤官见官，格局受损，看有无印星制伤。')
  if (name === '正官格' && hasSS('七杀')) checks.push('⚠ 官杀混杂，需去一留一。')
  if (name === '七杀格') checks.push(hasSS('食神') ? '✓ 有食神制杀。' : hasSS('正印') || hasSS('偏印') ? '✓ 有印化杀。' : '⚠ 七杀无制无化，看身强弱定吉凶。')
  if ((name === '正财格' || name === '偏财格') && (hasSS('比肩') || hasSS('劫财'))) checks.push('⚠ 天干比劫透出，有夺财之虑。')
  if ((name === '正印格' || name === '偏印格') && (hasSS('正财') || hasSS('偏财'))) checks.push('⚠ 财星透出，有坏印之嫌。')
  if (name === '食神格' && hasSS('偏印')) checks.push('⚠ 偏印透出，枭神夺食。')
  if (name === '伤官格' && hasSS('正官')) checks.push('⚠ 伤官见官，为格局大忌。')
  if (name === '伤官格' && (hasSS('正印') || hasSS('偏印'))) checks.push('✓ 伤官配印。')
  if (!checks.length) checks.push('天干未见明显破格组合，仍需结合地支冲合、岁运判断成败。')

  return { name, source, steps, xi: rule.xi, ji: rule.ji, checks }
}

// ---------------- 用神 ----------------

export interface YongShen {
  method: string
  yong: WuXing[]
  ji: WuXing[]
  steps: string[]
  tiaoHou: { need?: WuXing; text: string }
}

export function analyzeYongShen(chart: Chart, st: Strength): YongShen {
  const me = chart.dayWx
  const yin = shengWo(me), shishang = woSheng(me), cai = woKe(me), guan = keWo(me)
  const steps: string[] = []
  let yong: WuXing[]
  let ji: WuXing[]
  if (st.ratio >= 0.5) {
    yong = [shishang, cai, guan]
    ji = [yin, me]
    steps.push(`日主${st.verdict}，按“扶抑”法宜泄、耗、克：食伤（${shishang}）泄秀，财（${cai}）耗身，官杀（${guan}）克身。`)
    steps.push('具体取哪个，看原局谁有力且不被合绊：比劫重者先取官杀，印重者先取财（财破印），身旺无依者取食伤泄秀。')
  } else {
    yong = [yin, me]
    ji = [shishang, cai, guan]
    steps.push(`日主${st.verdict}，按“扶抑”法宜生、扶：印星（${yin}）生身，比劫（${me}）帮身。`)
    steps.push('官杀重者先取印（化杀生身），财重者先取比劫（帮身分财），食伤重者先取印（制食伤）。')
  }

  // 调候：冬生寒、夏生燥，先看气候
  const season = seasonOf(chart.pillars.month.zhi)
  const all = PILLAR_KEYS.flatMap((k) => [GAN_WX[chart.pillars[k].gan], ...CANG_GAN[chart.pillars[k].zhi].map((g) => GAN_WX[g])])
  let tiaoHou: YongShen['tiaoHou']
  if (season === '冬') {
    tiaoHou = { need: '火', text: `生于冬月，天寒地冻，${all.includes('火') ? '原局见火，可调候' : '原局缺火，调候为急'}。《穷通宝鉴》论冬月多先取丙丁火暖局。` }
  } else if (season === '夏') {
    tiaoHou = { need: '水', text: `生于夏月，炎热燥烈，${all.includes('水') ? '原局见水，可润局' : '原局缺水，调候为急'}。夏月多先取壬癸水润局。` }
  } else {
    tiaoHou = { text: `生于${season}季，寒暖较平，调候不是首要矛盾，以扶抑、格局为主。` }
  }
  if (tiaoHou.need && !yong.includes(tiaoHou.need)) {
    steps.push(`注意：扶抑结论与调候需求（${tiaoHou.need}）不一致，“调候为急”时应先满足调候，这是需要权衡的关键点。`)
  }
  steps.push('其他取用法：通关（两强相争取中间之神）、病药（原局之“病”所在，去病者为药）、专旺/从格（顺势为用）。本工具未自动判断，请在“先断后验”里写下你的判断。')

  return { method: '扶抑为主，参考调候', yong, ji, steps, tiaoHou }
}
