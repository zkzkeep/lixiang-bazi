// 象法：宫位象、十神象、干支类象、十神组合象、日柱象、神煞
// 象法的核心是“取象比类”：同一个十神落在不同宫位，象意随宫位而变。
import { GAN_WX, SS_GROUP, isYangGan, shiShen, type Gan, type ShiShen, type Zhi } from './constants.ts'
import { PILLAR_KEYS, type Chart, type PillarKey } from './chart.ts'
import type { Strength } from './lifa.ts'

export const GAN_XIANG: Record<Gan, string> = {
  甲: '阳木，参天大树、栋梁。性直、向上、有担当，也易刚而不屈。',
  乙: '阴木，花草藤萝。柔韧、善依附与变通，审美细腻。',
  丙: '阳火，太阳。光明热烈、外向大方，普照而不拘小节。',
  丁: '阴火，灯烛星火。温和内敛、心思细，善照亮局部、重精神。',
  戊: '阳土，城墙高山。厚重稳定、守信，也易固执。',
  己: '阴土，田园湿土。包容、能蓄养万物，细致而多思。',
  庚: '阳金，刀斧顽铁。刚毅果决、讲义气，需火炼方成器。',
  辛: '阴金，珠玉首饰。精致、敏感、重面子，喜水淘洗。',
  壬: '阳水，江河大海。奔流不息、智谋开阔，动而难羁。',
  癸: '阴水，雨露泉水。润物细无声，聪慧、敏感、善隐忍。',
}

export const ZHI_XIANG: Record<Zhi, string> = {
  子: '鼠；夜半；北方；肾、耳；水之源，智慧与隐秘。',
  丑: '牛；凌晨；东北；脾胃；湿冻之土，金之墓库。',
  寅: '虎；清晨；东北；肝胆；木之始，功曹、出行。',
  卯: '兔；日出；正东；肝、手指；木之旺，门户、车舟。',
  辰: '龙；上午；东南；水之库；湿土，网罗、变化。',
  巳: '蛇；近午；东南；心、面；火之始，文书、炉冶。',
  午: '马；正午；正南；心、眼；火之旺，光明、文明。',
  未: '羊；午后；西南；脾；燥土，木之库，酒食、园林。',
  申: '猴；下午；西南；肺、大肠；金之始，道路、传送。',
  酉: '鸡；日落；正西；肺、口；金之旺，珠玉、酒器。',
  戌: '狗；黄昏；西北；燥土，火之库，城墙、宗教。',
  亥: '猪；夜间；西北；肾；水之始，天门、旅途。',
}

/** 十神的核心象意（人物象 / 事物象 / 性情象） */
export const SS_XIANG: Record<ShiShen, { ren: string; shi: string; xing: string }> = {
  比肩: { ren: '兄弟、朋友、同辈、同事', shi: '合伙、竞争、自我', xing: '独立、自尊、固执' },
  劫财: { ren: '兄弟姐妹、竞争者', shi: '破财、争夺、冒险', xing: '豪爽、好胜、冲动' },
  食神: { ren: '学生、晚辈（女命子女）', shi: '才艺、口福、享受、技术输出', xing: '温和、乐观、重生活' },
  伤官: { ren: '晚辈（女命子女）、下属', shi: '创新、表达、技艺、叛逆', xing: '聪明、傲气、敢说' },
  偏财: { ren: '父亲、（男命）情人', shi: '横财、经商、流动之财', xing: '慷慨、灵活、重人情' },
  正财: { ren: '（男命）妻子', shi: '工资、正当收入、资产', xing: '务实、勤俭、守规矩' },
  七杀: { ren: '（女命）情人/丈夫、小人、权威', shi: '压力、权柄、军警、竞争', xing: '果断、霸气、有魄力' },
  正官: { ren: '（女命）丈夫、领导', shi: '职位、名誉、规则、体制', xing: '正直、守礼、自律' },
  偏印: { ren: '继母、偏门师长', shi: '偏门学问、玄学、技术、灵感', xing: '敏锐、孤独、多疑' },
  正印: { ren: '母亲、师长、贵人', shi: '学业、文凭、房产、庇护', xing: '仁慈、包容、依赖' },
}

/** 宫位象：每个位置代表的人事与年龄段 */
export const GONG_WEI: Record<string, { liu: string; age: string }> = {
  年干: { liu: '祖上、长辈、外部大环境', age: '1-16 岁' },
  年支: { liu: '祖业、根基、童年家境', age: '1-16 岁' },
  月干: { liu: '父母、兄弟、事业门户', age: '17-32 岁' },
  月支: { liu: '父母宫、兄弟、工作环境（提纲）', age: '17-32 岁' },
  日支: { liu: '配偶宫、自身内心、家庭', age: '33-48 岁' },
  时干: { liu: '子女、下属、思想与晚景', age: '49 岁以后' },
  时支: { liu: '子女宫、晚年归宿、事业结果', age: '49 岁以后' },
}

export interface XiangItem {
  pos: string
  char: string
  shiShen: ShiShen
  text: string
}

/** 宫位 × 十神：最基础、最可练的取象方法 */
export function gongWeiXiang(chart: Chart): XiangItem[] {
  const out: XiangItem[] = []
  const posMap: [PillarKey, 'gan' | 'zhi', string][] = [
    ['year', 'gan', '年干'], ['year', 'zhi', '年支'], ['month', 'gan', '月干'], ['month', 'zhi', '月支'],
    ['day', 'zhi', '日支'], ['time', 'gan', '时干'], ['time', 'zhi', '时支'],
  ]
  for (const [k, part, pos] of posMap) {
    const p = chart.pillars[k]
    const char = part === 'gan' ? p.gan : p.zhi
    const ss = part === 'gan' ? (p.ganShiShen as ShiShen) : p.hidden[0].shiShen
    const g = GONG_WEI[pos]
    const x = SS_XIANG[ss]
    out.push({
      pos, char, shiShen: ss,
      text: `${pos}代表「${g.liu}」（${g.age}）。此处见${ss}${part === 'zhi' ? '（本气）' : ''}，可取象：人物上与「${x.ren}」相关，事情上与「${x.shi}」相关。`,
    })
  }
  return out
}

export interface ComboXiang {
  name: string
  hit: string
  li: string
  xiang: string
}

/** 十神组合象：以天干透出 + 地支本气为观察范围 */
export function comboXiang(chart: Chart, st: Strength): ComboXiang[] {
  const dg = chart.dayGan
  // 观察范围：天干（日干除外）+ 地支本气；col 为柱序，用来判断远近
  const seen: { pos: string; ss: ShiShen; col: number; gan: boolean }[] = []
  PILLAR_KEYS.forEach((k, col) => {
    const p = chart.pillars[k]
    if (k !== 'day') seen.push({ pos: `${p.label.slice(0, 1)}干${p.gan}`, ss: p.ganShiShen as ShiShen, col, gan: true })
    seen.push({ pos: `${p.label.slice(0, 1)}支${p.zhi}`, ss: shiShen(dg, p.hidden[0].gan), col, gan: false })
  })
  const grp = (g: string) => seen.filter((s) => SS_GROUP[s.ss] === g).map((s) => s.pos)
  /** 成象条件：两方至少一个透干，且同柱或相邻柱（隔柱太远，力量不足以成象） */
  const pairs = (a: ShiShen[], b: ShiShen[]) => {
    const out: string[] = []
    for (const x of seen.filter((s) => a.includes(s.ss))) {
      for (const y of seen.filter((s) => b.includes(s.ss))) {
        if (x !== y && (x.gan || y.gan) && Math.abs(x.col - y.col) <= 1) out.push(`${x.pos}—${y.pos}`)
      }
    }
    return out
  }

  const 财: ShiShen[] = ['正财', '偏财'], 印: ShiShen[] = ['正印', '偏印'], 比劫: ShiShen[] = ['比肩', '劫财']
  const rules: { name: string; a: ShiShen[]; b: ShiShen[]; li: string; xiang: string }[] = [
    { name: '伤官见官', a: ['伤官'], b: ['正官'], li: '伤官为我所生，克正官（克我者），两者相战。', xiang: '与规则、上级、体制易起冲突；口舌是非；女命不利夫星。有印制伤则化解为“有才而守规矩”。' },
    { name: '食神制杀', a: ['食神'], b: ['七杀'], li: '食神克七杀，以我之所生，制克我之凶神。', xiang: '能以才干、技术化解压力，掌权得威，多主武职、管理、技术权威。' },
    { name: '杀印相生', a: ['七杀'], b: 印, li: '七杀生印、印生日主，克我之力转为生我。', xiang: '压力变动力，在体制、大平台中借势上升；主权贵、有担当。' },
    { name: '官印相生', a: ['正官'], b: 印, li: '官生印、印生身，层层相生。', xiang: '读书出仕之象，名誉、职位、学历相辅，主稳定上升。' },
    { name: '财生官杀', a: 财, b: ['正官', '七杀'], li: '我克者生克我者，财为官之源。', xiang: '以财谋职、以财养名；男命妻助事业。身弱则财官皆为压力。' },
    { name: '食伤生财', a: ['食神', '伤官'], b: 财, li: '我生者生我克者，才艺转化为财富。', xiang: '靠技术、口才、创意赚钱，适合经营、自由职业。' },
    { name: '枭神夺食', a: ['偏印'], b: ['食神'], li: '偏印克食神，断我之福气与输出。', xiang: '才华难展、计划受阻、饮食健康需留意；女命不利子女。有偏财制枭则解。' },
    { name: '贪财坏印', a: 财, b: 印, li: '财克印，为财而损其文书、学业、庇护。', xiang: '因利弃学、因财失名；也主与母亲/师长缘分起伏。身强印多反以财破印为美。' },
    { name: '比劫夺财', a: 比劫, b: 财, li: '比劫克财，同辈分我之财。', xiang: '合伙分利、朋友借钱、竞争破财；男命感情有竞争者。身弱财多则反成帮身。' },
    { name: '官杀混杂', a: ['正官'], b: ['七杀'], li: '正官七杀同见，克身之力不纯。', xiang: '规则与压力并存，选择多而摇摆；女命感情复杂。需合去或制去一方，称“去官留杀/去杀留官”。' },
    { name: '伤官配印', a: ['伤官'], b: 印, li: '印克伤官，既收敛锋芒又保护日主。', xiang: '才华受约束而成器，学者、专家、技术管理之象；身弱尤佳。' },
  ]
  const out: ComboXiang[] = []
  for (const r of rules) {
    const hit = pairs(r.a, r.b)
    if (hit.length) out.push({ name: r.name, hit: hit.join('；'), li: r.li, xiang: r.xiang })
  }

  // 十神偏旺的性情象
  const groups = ['比劫', '食伤', '财星', '官杀', '印星']
  for (const g of groups) {
    const ps = grp(g)
    if (ps.length >= 3) {
      out.push({ name: `${g}偏多（${ps.length} 处）`, hit: ps.join('、'), li: `${g}在原局反复出现，成为盘中“主角”。`, xiang: groupXiang(g, st.verdict) })
    }
  }
  return out
}

function groupXiang(g: string, verdict: string): string {
  const strong = verdict.includes('强')
  switch (g) {
    case '比劫': return strong ? '自我意识强、好胜，易因朋友合伙破财；喜官杀约束、食伤疏泄。' : '有朋友兄弟相助，团队型。'
    case '食伤': return '表达欲与创造力旺盛，思想自由，不喜束缚；食伤过重则泄身太过、精力透支。'
    case '财星': return strong ? '务实、重利，能把握机会求财。' : '财多身弱，钱财多而难守，“富屋贫人”，需比劫印星相助。'
    case '官杀': return strong ? '有责任感与管理能力，宜体制、管理岗位。' : '压力大、易受人管制，需印化或食制。'
    default: return '依赖心强、重学习与精神，得长辈庇荫；印过重则懒散、行动力弱，喜财星破印。'
  }
}

/** 日柱象：日主自坐的十二长生 + 日支十神 */
export function riZhuXiang(chart: Chart): string[] {
  const d = chart.pillars.day
  const ss = d.hidden[0].shiShen
  const lines = [
    `日柱${d.gan}${d.zhi}：${d.gan}${GAN_XIANG[d.gan].split('，')[0]}，坐${d.zhi}（${ZHI_XIANG[d.zhi].split('；')[0]}）。`,
    `日主坐「${d.ziZuo}」之地。${ZUO_NOTE[d.ziZuo] ?? ''}`,
    `日支本气为${ss}：配偶宫见${ss}，${spouseNote(ss, chart.input.gender)}`,
  ]
  return lines
}

const ZUO_NOTE: Record<string, string> = {
  长生: '自坐长生，根基有气，性格温厚，得长辈缘。', 沐浴: '自坐沐浴，重外表与感受，感情较丰富。',
  冠带: '自坐冠带，好体面、有上进心。', 临官: '自坐临官（禄），自立自强，靠自己。',
  帝旺: '自坐帝旺（刃），气势强、个性刚，婚姻宫逢刃需互相包容。', 衰: '自坐衰地，稳重内敛、守成。',
  病: '自坐病地，心思重、善体察。', 死: '自坐死地，专注、执着，一门深入。',
  墓: '自坐墓库，内敛、善收藏，也易闷。', 绝: '自坐绝地，变化多，善绝处逢生。',
  胎: '自坐胎地，富理想、易受环境影响。', 养: '自坐养地，得人照顾，福气较好。',
}

function spouseNote(ss: ShiShen, gender: 0 | 1): string {
  const x = SS_XIANG[ss]
  const base = `配偶或婚姻生活带有「${x.xing}」的色彩，家庭生活与「${x.shi}」相关。`
  if (gender === 1 && (ss === '正财' || ss === '偏财')) return base + '男命妻星坐妻宫，夫妻缘分较明显。'
  if (gender === 0 && (ss === '正官' || ss === '七杀')) return base + '女命夫星坐夫宫，夫妻缘分较明显。'
  if (ss === '比肩' || ss === '劫财') return base + '配偶宫见比劫，婚姻中重平等，也需防竞争者。'
  if (ss === '伤官' && gender === 0) return base + '女命夫宫见伤官，对配偶要求高、易挑剔。'
  return base
}

// ---------------- 神煞 ----------------

export interface ShenSha {
  name: string
  pos: string[]
  rule: string
  xiang: string
}

const TIAN_YI: Record<Gan, string> = { 甲: '丑未', 戊: '丑未', 庚: '丑未', 乙: '子申', 己: '子申', 丙: '亥酉', 丁: '亥酉', 壬: '卯巳', 癸: '卯巳', 辛: '寅午' }
const WEN_CHANG: Record<Gan, string> = { 甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' }
const LU: Record<Gan, string> = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' }
const YANG_REN: Partial<Record<Gan, string>> = { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' }
const triad = (z: Zhi) => ['申子辰', '寅午戌', '巳酉丑', '亥卯未'].find((t) => t.includes(z))!
const YI_MA: Record<string, string> = { 申子辰: '寅', 寅午戌: '申', 巳酉丑: '亥', 亥卯未: '巳' }
const TAO_HUA: Record<string, string> = { 申子辰: '酉', 寅午戌: '卯', 巳酉丑: '午', 亥卯未: '子' }
const HUA_GAI: Record<string, string> = { 申子辰: '辰', 寅午戌: '戌', 巳酉丑: '丑', 亥卯未: '未' }

export function shenSha(chart: Chart): ShenSha[] {
  const dg = chart.dayGan
  const zhis = PILLAR_KEYS.map((k) => ({ label: chart.pillars[k].label.slice(0, 1) + '支', z: chart.pillars[k].zhi }))
  const find = (targets: string, exclude?: string) =>
    zhis.filter((x) => targets.includes(x.z) && x.label !== exclude).map((x) => `${x.label}${x.z}`)
  const out: ShenSha[] = []
  const push = (name: string, pos: string[], rule: string, xiang: string) => { if (pos.length) out.push({ name, pos, rule, xiang }) }

  push('天乙贵人', find(TIAN_YI[dg]), `以日干${dg}查，见${TIAN_YI[dg]}`, '逢凶化吉、得人提携，是最重要的吉神。')
  push('文昌', find(WEN_CHANG[dg]), `以日干${dg}查，见${WEN_CHANG[dg]}`, '聪明好学、利考试文书。')
  push('禄神', find(LU[dg]), `以日干${dg}查，临官之地${LU[dg]}`, '衣食俸禄、自立之根。在年支为岁禄、日支为专禄、时支为归禄。')
  if (isYangGan(dg) && YANG_REN[dg]) push('羊刃', find(YANG_REN[dg]!), `阳干${dg}帝旺之地${YANG_REN[dg]}`, '刚烈、果敢，有制为权、无制为灾。')
  for (const [base, label] of [[chart.pillars.year.zhi, '年支'], [chart.pillars.day.zhi, '日支']] as [Zhi, string][]) {
    const t = triad(base)
    push(`驿马（${label}查）`, find(YI_MA[t], label), `${t}马在${YI_MA[t]}`, '奔波、迁移、出行、变动。')
    push(`桃花（${label}查）`, find(TAO_HUA[t], label), `${t}桃花在${TAO_HUA[t]}`, '人缘、魅力、感情。墙内为喜、墙外为忧。')
    push(`华盖（${label}查）`, find(HUA_GAI[t], label), `${t}华盖在${HUA_GAI[t]}`, '孤高、艺术、宗教玄学之缘。')
  }
  const xk = chart.pillars.day.xunKong
  push('空亡', find(xk, '日支'), `日柱旬空${xk}`, '落空、虚而不实；吉神逢空减吉，凶神逢空减凶。')
  return out
}

export const wxOf = (g: Gan) => GAN_WX[g]
