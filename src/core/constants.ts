// 八字基础常量：阴阳五行、干支、藏干、十神推导、旺相休囚、十二长生
// 所有推理都从这里的“定义”出发，app 里任何结论都能回溯到这些表。

export const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const
export const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const
export type Gan = (typeof GAN)[number]
export type Zhi = (typeof ZHI)[number]

export const WUXING = ['木', '火', '土', '金', '水'] as const
export type WuXing = (typeof WUXING)[number]

export const GAN_WX: Record<Gan, WuXing> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
}
export const ZHI_WX: Record<Zhi, WuXing> = {
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
}

/** 阳干：甲丙戊庚壬；阳支：子寅辰午申戌 */
export const isYangGan = (g: Gan) => GAN.indexOf(g) % 2 === 0
export const isYangZhi = (z: Zhi) => ZHI.indexOf(z) % 2 === 0

/** 地支藏干：[本气, 中气, 余气]，与 lunar-javascript 的取法一致 */
export const CANG_GAN: Record<Zhi, Gan[]> = {
  子: ['癸'],
  丑: ['己', '癸', '辛'],
  寅: ['甲', '丙', '戊'],
  卯: ['乙'],
  辰: ['戊', '乙', '癸'],
  巳: ['丙', '庚', '戊'],
  午: ['丁', '己'],
  未: ['己', '丁', '乙'],
  申: ['庚', '壬', '戊'],
  酉: ['辛'],
  戌: ['戊', '辛', '丁'],
  亥: ['壬', '甲'],
}

/** 藏干力量权重：本气为主，中气、余气递减 */
export function cangWeights(z: Zhi): number[] {
  const n = CANG_GAN[z].length
  if (n === 1) return [1]
  if (n === 2) return [0.7, 0.3]
  return [0.6, 0.3, 0.1]
}

const wxIdx = (w: WuXing) => WUXING.indexOf(w)
/** a 生 b ？ 木→火→土→金→水→木 */
export const sheng = (a: WuXing, b: WuXing) => (wxIdx(a) + 1) % 5 === wxIdx(b)
/** a 克 b ？ 木→土→水→火→金→木 */
export const ke = (a: WuXing, b: WuXing) => (wxIdx(a) + 2) % 5 === wxIdx(b)
export const shengWo = (me: WuXing) => WUXING[(wxIdx(me) + 4) % 5]
export const woSheng = (me: WuXing) => WUXING[(wxIdx(me) + 1) % 5]
export const woKe = (me: WuXing) => WUXING[(wxIdx(me) + 2) % 5]
export const keWo = (me: WuXing) => WUXING[(wxIdx(me) + 3) % 5]

export const SHI_SHEN = ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'] as const
export type ShiShen = (typeof SHI_SHEN)[number]

/** 十神大类 */
export type ShiShenGroup = '比劫' | '食伤' | '财星' | '官杀' | '印星'
export const SS_GROUP: Record<ShiShen, ShiShenGroup> = {
  比肩: '比劫', 劫财: '比劫', 食神: '食伤', 伤官: '食伤', 偏财: '财星', 正财: '财星',
  七杀: '官杀', 正官: '官杀', 偏印: '印星', 正印: '印星',
}

/**
 * 十神推导：以日干为“我”，看对方与我的五行生克 + 阴阳是否相同。
 * 同性为偏（比肩/食神/偏财/七杀/偏印），异性为正（劫财/伤官/正财/正官/正印）。
 */
export function shiShen(dayGan: Gan, other: Gan): ShiShen {
  const me = GAN_WX[dayGan]
  const it = GAN_WX[other]
  const same = isYangGan(dayGan) === isYangGan(other)
  if (me === it) return same ? '比肩' : '劫财'
  if (sheng(me, it)) return same ? '食神' : '伤官'
  if (ke(me, it)) return same ? '偏财' : '正财'
  if (ke(it, me)) return same ? '七杀' : '正官'
  return same ? '偏印' : '正印'
}

/** 十神推导过程的文字说明（给学习用） */
export function explainShiShen(dayGan: Gan, other: Gan): string {
  const me = GAN_WX[dayGan]
  const it = GAN_WX[other]
  const rel = me === it ? '同我' : sheng(me, it) ? '我生' : ke(me, it) ? '我克' : ke(it, me) ? '克我' : '生我'
  const yy = isYangGan(dayGan) === isYangGan(other) ? '阴阳相同→偏' : '阴阳相异→正'
  return `日主${dayGan}(${isYangGan(dayGan) ? '阳' : '阴'}${me})，${other}(${isYangGan(other) ? '阳' : '阴'}${it})：${it}与${me}为「${rel}」，${yy}，故为${shiShen(dayGan, other)}`
}

/** 旺相休囚死：以月令五行为“当令”，看某五行在此季的状态 */
export type Season = '旺' | '相' | '休' | '囚' | '死'
export function wangXiang(lingWx: WuXing, target: WuXing): Season {
  if (lingWx === target) return '旺' // 当令者旺
  if (sheng(lingWx, target)) return '相' // 令生者相
  if (sheng(target, lingWx)) return '休' // 生令者休
  if (ke(target, lingWx)) return '囚' // 克令者囚
  return '死' // 令克者死
}

/** 十二长生 */
export const CHANG_SHENG = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'] as const
const CS_START: Record<Gan, Zhi> = {
  甲: '亥', 丙: '寅', 戊: '寅', 庚: '巳', 壬: '申',
  乙: '午', 丁: '酉', 己: '酉', 辛: '子', 癸: '卯',
}
/** 阳干顺行、阴干逆行（阴干长生是有争议的流派问题，课程里会讲） */
export function changSheng(g: Gan, z: Zhi): (typeof CHANG_SHENG)[number] {
  const start = ZHI.indexOf(CS_START[g])
  const zi = ZHI.indexOf(z)
  const step = isYangGan(g) ? (zi - start + 12) % 12 : (start - zi + 12) % 12
  return CHANG_SHENG[step]
}

/** 季节（看调候用） */
export function seasonOf(monthZhi: Zhi): '春' | '夏' | '秋' | '冬' {
  if ('寅卯辰'.includes(monthZhi)) return '春'
  if ('巳午未'.includes(monthZhi)) return '夏'
  if ('申酉戌'.includes(monthZhi)) return '秋'
  return '冬'
}

export const WX_COLOR: Record<WuXing, string> = {
  木: 'var(--wx-mu)', 火: 'var(--wx-huo)', 土: 'var(--wx-tu)', 金: 'var(--wx-jin)', 水: 'var(--wx-shui)',
}
export const wxOfChar = (c: string): WuXing | undefined =>
  (GAN_WX as Record<string, WuXing>)[c] ?? (ZHI_WX as Record<string, WuXing>)[c]
