// 排盘：历法换算交给 lunar-javascript（寿星天文历算法，节气精确到秒），
// 十神、长生、关系、旺衰等“命理层”全部自己实现，便于讲清每一步。
import lunar from 'lunar-javascript'
import {
  CANG_GAN, GAN_WX, ZHI_WX, changSheng, shiShen,
  type Gan, type Zhi, type ShiShen, type WuXing,
} from './constants.ts'
import { toTrueSolarTime, type SolarTimeResult } from './solarTime.ts'

const { Solar, Lunar } = lunar

export interface BirthInput {
  name: string
  gender: 1 | 0 // 1 男 0 女
  calendar: 'solar' | 'lunar'
  year: number
  month: number // 农历闰月用负数
  day: number
  hour: number
  minute: number
  /** 是否按真太阳时校正 */
  useTrueSolar: boolean
  lng: number
  place?: string
  dst?: boolean
  /** 子时流派：1 = 23 点后日柱算次日；2 = 晚子时日柱仍算当日 */
  sect: 1 | 2
}

export type PillarKey = 'year' | 'month' | 'day' | 'time'
export const PILLAR_NAMES: Record<PillarKey, string> = { year: '年柱', month: '月柱', day: '日柱', time: '时柱' }

export interface HiddenStem {
  gan: Gan
  shiShen: ShiShen
}

export interface Pillar {
  key: PillarKey | 'dayun' | 'liunian'
  label: string
  gan: Gan
  zhi: Zhi
  ganShiShen: ShiShen | '日主'
  hidden: HiddenStem[]
  naYin: string
  /** 日主在本支的十二长生状态（星运） */
  xingYun: string
  /** 本柱天干坐本支的十二长生状态（自坐） */
  ziZuo: string
  xunKong: string
}

export interface DaYun {
  index: number
  ganZhi: string
  gan: Gan
  zhi: Zhi
  startYear: number
  endYear: number
  startAge: number
  liuNian: { year: number; age: number; ganZhi: string }[]
}

export interface Chart {
  input: BirthInput
  solarText: string
  lunarText: string
  /** 实际用于排盘的时间（可能已做真太阳时校正） */
  usedTime: string
  solarTime?: SolarTimeResult
  pillars: Record<PillarKey, Pillar>
  dayGan: Gan
  dayWx: WuXing
  taiYuan: string
  mingGong: string
  shenGong: string
  qiYun: string
  jiaoYun: string
  daYun: DaYun[]
  /** 出生前最近的“节”（定月令用） */
  prevJie: string
  nextJie: string
}

const pad = (n: number) => String(n).padStart(2, '0')

export function makePillar(
  key: Pillar['key'], label: string, gan: Gan, zhi: Zhi, dayGan: Gan, naYin = '', xunKong = '', isDay = false,
): Pillar {
  return {
    key, label, gan, zhi,
    ganShiShen: isDay ? '日主' : shiShen(dayGan, gan),
    hidden: CANG_GAN[zhi].map((g) => ({ gan: g, shiShen: shiShen(dayGan, g) })),
    naYin,
    xingYun: changSheng(dayGan, zhi),
    ziZuo: changSheng(gan, zhi),
    xunKong,
  }
}

export function buildChart(input: BirthInput): Chart {
  // 1. 先统一成公历钟表时间
  let solar = input.calendar === 'lunar'
    ? Lunar.fromYmdHms(input.year, input.month, input.day, input.hour, input.minute, 0).getSolar()
    : Solar.fromYmdHms(input.year, input.month, input.day, input.hour, input.minute, 0)
  const clockText = solar.toYmdHms()

  // 2. 真太阳时校正
  let st: SolarTimeResult | undefined
  if (input.useTrueSolar) {
    const clock = new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay(), solar.getHour(), solar.getMinute(), 0)
    st = toTrueSolarTime(clock, input.lng, input.dst)
    const d = st.date
    solar = Solar.fromYmdHms(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds())
  }

  const lun = solar.getLunar()
  const ec = lun.getEightChar()
  ec.setSect(input.sect)

  const dayGan = ec.getDayGan() as Gan
  const p = (key: PillarKey, g: string, z: string, ny: string, xk: string) =>
    makePillar(key, PILLAR_NAMES[key], g as Gan, z as Zhi, dayGan, ny, xk, key === 'day')

  const pillars: Record<PillarKey, Pillar> = {
    year: p('year', ec.getYearGan(), ec.getYearZhi(), ec.getYearNaYin(), ec.getYearXunKong()),
    month: p('month', ec.getMonthGan(), ec.getMonthZhi(), ec.getMonthNaYin(), ec.getMonthXunKong()),
    day: p('day', ec.getDayGan(), ec.getDayZhi(), ec.getDayNaYin(), ec.getDayXunKong()),
    time: p('time', ec.getTimeGan(), ec.getTimeZhi(), ec.getTimeNaYin(), ec.getTimeXunKong()),
  }

  // 3. 大运：阳年男、阴年女顺排；阴年男、阳年女逆排（库内已实现，三天折一年）
  const yun = ec.getYun(input.gender, 2)
  const birthYear = solar.getYear()
  const daYun: DaYun[] = yun
    .getDaYun()
    .slice(1, 11) // 第 0 项是起运前的“小运期”，不算大运
    .map((d: any, i: number) => {
      const gz: string = d.getGanZhi()
      return {
        index: i + 1,
        ganZhi: gz,
        gan: gz[0] as Gan,
        zhi: gz[1] as Zhi,
        startYear: d.getStartYear(),
        endYear: d.getEndYear(),
        startAge: d.getStartAge(),
        liuNian: d.getLiuNian().map((n: any) => ({ year: n.getYear(), age: n.getYear() - birthYear + 1, ganZhi: n.getGanZhi() })),
      }
    })

  const prev = lun.getPrevJie()
  const next = lun.getNextJie()

  return {
    input,
    solarText: clockText,
    lunarText: `${lun.getYearInGanZhi()}年 ${lun.getMonthInChinese()}月${lun.getDayInChinese()} ${lun.getTimeZhi()}时`,
    usedTime: `${solar.getYear()}-${pad(solar.getMonth())}-${pad(solar.getDay())} ${pad(solar.getHour())}:${pad(solar.getMinute())}`,
    solarTime: st,
    pillars,
    dayGan,
    dayWx: GAN_WX[dayGan],
    taiYuan: ec.getTaiYuan(),
    mingGong: ec.getMingGong(),
    shenGong: ec.getShenGong(),
    qiYun: `出生后 ${yun.getStartYear()} 年 ${yun.getStartMonth()} 个月 ${yun.getStartDay()} 天起运`,
    jiaoYun: `${yun.getStartSolar().toYmd()} 交运`,
    daYun,
    prevJie: `${prev.getName()} ${prev.getSolar().toYmdHms()}`,
    nextJie: `${next.getName()} ${next.getSolar().toYmdHms()}`,
  }
}

export const PILLAR_KEYS: PillarKey[] = ['year', 'month', 'day', 'time']

/** 所有“字”的五行计数（天干 + 地支本气），用于五行分布展示 */
export function countWuXing(chart: Chart) {
  const count: Record<WuXing, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 }
  for (const k of PILLAR_KEYS) {
    count[GAN_WX[chart.pillars[k].gan]]++
    count[ZHI_WX[chart.pillars[k].zhi]]++
  }
  return count
}
