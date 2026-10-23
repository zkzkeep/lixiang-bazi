// 干支关系：天干五合/相冲，地支六合、三合、半合、三会、六冲、相刑、六害、相破
import type { Gan, Zhi } from './constants.ts'

export interface Node {
  label: string // 如“年干”“月支”“大运支”
  char: string
}

export interface Relation {
  type: string // 天干五合 / 地支六冲 ...
  name: string // 甲己合土 ...
  members: string[] // 参与的位置
  /** 理法解释 */
  note: string
  tone: 'he' | 'chong' | 'xing' | 'other'
}

const pairKey = (a: string, b: string) => [a, b].sort().join('')

const GAN_HE: Record<string, string> = {
  [pairKey('甲', '己')]: '土', [pairKey('乙', '庚')]: '金', [pairKey('丙', '辛')]: '水',
  [pairKey('丁', '壬')]: '木', [pairKey('戊', '癸')]: '火',
}
const GAN_CHONG = new Set([pairKey('甲', '庚'), pairKey('乙', '辛'), pairKey('丙', '壬'), pairKey('丁', '癸')])

const ZHI_HE: Record<string, string> = {
  [pairKey('子', '丑')]: '土', [pairKey('寅', '亥')]: '木', [pairKey('卯', '戌')]: '火',
  [pairKey('辰', '酉')]: '金', [pairKey('巳', '申')]: '水', [pairKey('午', '未')]: '土（一说火）',
}
const ZHI_CHONG = new Set(['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥'].map((s) => pairKey(s[0], s[1])))
const ZHI_HAI = new Set(['子未', '丑午', '寅巳', '卯辰', '申亥', '酉戌'].map((s) => pairKey(s[0], s[1])))
const ZHI_PO = new Set(['子酉', '卯午', '辰丑', '未戌', '寅亥', '巳申'].map((s) => pairKey(s[0], s[1])))
const XING_PAIRS: Record<string, string> = {
  [pairKey('寅', '巳')]: '寅巳相刑（无恩之刑）', [pairKey('巳', '申')]: '巳申相刑（无恩之刑）',
  [pairKey('寅', '申')]: '寅申相刑（无恩之刑）', [pairKey('丑', '戌')]: '丑戌相刑（恃势之刑）',
  [pairKey('戌', '未')]: '戌未相刑（恃势之刑）', [pairKey('丑', '未')]: '丑未相刑（恃势之刑）',
  [pairKey('子', '卯')]: '子卯相刑（无礼之刑）',
}
const ZI_XING = new Set(['辰', '午', '酉', '亥'])

const SAN_HE: { zhi: string; wx: string; wang: string }[] = [
  { zhi: '申子辰', wx: '水', wang: '子' }, { zhi: '亥卯未', wx: '木', wang: '卯' },
  { zhi: '寅午戌', wx: '火', wang: '午' }, { zhi: '巳酉丑', wx: '金', wang: '酉' },
]
const SAN_HUI: { zhi: string; wx: string }[] = [
  { zhi: '寅卯辰', wx: '木' }, { zhi: '巳午未', wx: '火' }, { zhi: '申酉戌', wx: '金' }, { zhi: '亥子丑', wx: '水' },
]

export function findRelations(gans: Node[], zhis: Node[]): Relation[] {
  const out: Relation[] = []

  // ---- 天干 ----
  for (let i = 0; i < gans.length; i++) {
    for (let j = i + 1; j < gans.length; j++) {
      const a = gans[i], b = gans[j]
      const k = pairKey(a.char, b.char)
      if (GAN_HE[k]) {
        out.push({
          type: '天干五合', name: `${a.char}${b.char}合（化${GAN_HE[k]}）`, members: [a.label, b.label], tone: 'he',
          note: `阴阳相配、异性相吸而合。合则双方“羁绊”，作用力减弱；能否真化${GAN_HE[k]}，要看月令是否支持、有无引化与争合，不可见合即化。`,
        })
      }
      if (GAN_CHONG.has(k)) {
        out.push({
          type: '天干相冲', name: `${a.char}${b.char}相冲`, members: [a.label, b.label], tone: 'chong',
          note: '同性相克且方位相对（东西、南北）为冲。冲主动荡、变化；相邻之冲力大，隔位之冲力小。',
        })
      }
    }
  }

  // ---- 地支两两关系 ----
  for (let i = 0; i < zhis.length; i++) {
    for (let j = i + 1; j < zhis.length; j++) {
      const a = zhis[i], b = zhis[j]
      const k = pairKey(a.char, b.char)
      const m = [a.label, b.label]
      if (ZHI_HE[k]) out.push({ type: '地支六合', name: `${a.char}${b.char}合${ZHI_HE[k]}`, members: m, tone: 'he', note: '六合主和合、牵绊。合能解冲，也能“合绊”使原本该发挥作用的字失去作用（贪合忘冲/贪合忘生）。' })
      if (ZHI_CHONG.has(k)) out.push({ type: '地支六冲', name: `${a.char}${b.char}冲`, members: m, tone: 'chong', note: '相隔六位、方位相对、五行相克（辰戌丑未为土冲土，冲开库藏）。冲主动、变迁；冲到月令或日支，影响最大。' })
      if (XING_PAIRS[k]) out.push({ type: '地支相刑', name: XING_PAIRS[k], members: m, tone: 'xing', note: '刑主摩擦、伤损、是非，程度通常轻于冲，但纠缠不休。' })
      if (a.char === b.char && ZI_XING.has(a.char)) out.push({ type: '地支自刑', name: `${a.char}${a.char}自刑`, members: m, tone: 'xing', note: '辰午酉亥逢同字为自刑，主自我纠结、内耗。' })
      if (ZHI_HAI.has(k)) out.push({ type: '地支六害', name: `${a.char}${b.char}害`, members: m, tone: 'other', note: '害由“合被冲坏”而来（如子丑合，未冲丑，故子未害），主暗中损伤、不顺。' })
      if (ZHI_PO.has(k)) out.push({ type: '地支相破', name: `${a.char}${b.char}破`, members: m, tone: 'other', note: '破的力量最轻，多数流派只作参考。' })
    }
  }

  // ---- 三合 / 半合 / 三会（局） ----
  const has = (c: string) => zhis.filter((z) => z.char === c)
  for (const sh of SAN_HE) {
    const present = [...sh.zhi].filter((c) => has(c).length > 0)
    const labels = present.flatMap((c) => has(c).map((z) => z.label))
    if (present.length === 3) {
      out.push({ type: '地支三合', name: `${sh.zhi}三合${sh.wx}局`, members: labels, tone: 'he', note: `长生、帝旺、墓库三支齐全，合成${sh.wx}局，力量强大，常能改变原局五行格局。` })
    } else if (present.length === 2 && present.includes(sh.wang)) {
      const kind = present.includes(sh.zhi[0]) ? '生旺半合' : '旺墓半合'
      out.push({ type: '地支半合', name: `${present.join('')}半合${sh.wx}（${kind}）`, members: labels, tone: 'he', note: `三合缺一，但有帝旺之${sh.wang}在，可成半合，力量弱于三合。缺帝旺者（如申辰）一般只论“拱合”。` })
    }
  }
  for (const sh of SAN_HUI) {
    const present = [...sh.zhi].filter((c) => has(c).length > 0)
    if (present.length === 3) {
      out.push({ type: '地支三会', name: `${sh.zhi}三会${sh.wx}方`, members: present.flatMap((c) => has(c).map((z) => z.label)), tone: 'he', note: '同一季节三支聚齐为“会方”，力量在合局之上，一方之气最纯。' })
    }
  }
  // 寅巳申、丑戌未三刑全
  for (const tri of ['寅巳申', '丑戌未']) {
    if ([...tri].every((c) => has(c).length > 0)) {
      out.push({ type: '地支三刑', name: `${tri}三刑全`, members: [...tri].flatMap((c) => has(c).map((z) => z.label)), tone: 'xing', note: '三刑俱全，刑力最重，古书多断有官非、伤灾，需结合喜忌论吉凶。' })
    }
  }
  return out
}

export const isGan = (c: string): c is Gan => '甲乙丙丁戊己庚辛壬癸'.includes(c)
export const isZhi = (c: string): c is Zhi => '子丑寅卯辰巳午未申酉戌亥'.includes(c)
