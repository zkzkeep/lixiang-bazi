// 真太阳时：北京时间是东经 120° 的平太阳时，出生地每差 1° 经度差 4 分钟，
// 再加上“均时差”（地球公转椭圆轨道 + 黄赤交角造成的真/平太阳时偏差，全年在 -14 ~ +16 分钟之间）。

export interface City {
  name: string
  lng: number
}

/** 常用城市经度（取市区近似值，精确到 0.01°足够排盘） */
export const CITIES: City[] = [
  { name: '北京', lng: 116.4 }, { name: '天津', lng: 117.2 }, { name: '上海', lng: 121.47 },
  { name: '重庆', lng: 106.55 }, { name: '哈尔滨', lng: 126.63 }, { name: '长春', lng: 125.32 },
  { name: '沈阳', lng: 123.43 }, { name: '大连', lng: 121.61 }, { name: '呼和浩特', lng: 111.75 },
  { name: '石家庄', lng: 114.51 }, { name: '太原', lng: 112.55 }, { name: '济南', lng: 117.0 },
  { name: '青岛', lng: 120.38 }, { name: '郑州', lng: 113.62 }, { name: '西安', lng: 108.94 },
  { name: '兰州', lng: 103.83 }, { name: '西宁', lng: 101.78 }, { name: '银川', lng: 106.23 },
  { name: '乌鲁木齐', lng: 87.62 }, { name: '拉萨', lng: 91.11 }, { name: '成都', lng: 104.07 },
  { name: '贵阳', lng: 106.71 }, { name: '昆明', lng: 102.83 }, { name: '南宁', lng: 108.37 },
  { name: '广州', lng: 113.26 }, { name: '深圳', lng: 114.06 }, { name: '海口', lng: 110.2 },
  { name: '福州', lng: 119.3 }, { name: '厦门', lng: 118.09 }, { name: '台北', lng: 121.56 },
  { name: '杭州', lng: 120.16 }, { name: '南京', lng: 118.8 }, { name: '苏州', lng: 120.58 },
  { name: '合肥', lng: 117.23 }, { name: '南昌', lng: 115.86 }, { name: '长沙', lng: 112.94 },
  { name: '武汉', lng: 114.31 }, { name: '宜昌', lng: 111.29 }, { name: '恩施', lng: 109.49 },
  { name: '襄阳', lng: 112.14 }, { name: '香港', lng: 114.17 }, { name: '澳门', lng: 113.54 },
]

/** 均时差（分钟），近似公式误差约 ±0.5 分钟 */
export function equationOfTime(date: Date): number {
  const start = Date.UTC(date.getFullYear(), 0, 0)
  const now = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  const n = Math.round((now - start) / 86400000)
  const b = ((2 * Math.PI) / 365) * (n - 81)
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b)
}

export interface SolarTimeResult {
  date: Date
  lngOffsetMin: number
  eotMin: number
  dstMin: number
}

/**
 * 把“钟表时间（北京时间）”换成出生地真太阳时。
 * dst：1986-1991 年中国实行过夏令时，那几年夏天出生的钟表时间要先减 1 小时。
 */
export function toTrueSolarTime(clock: Date, lng: number, dst = false): SolarTimeResult {
  const dstMin = dst ? -60 : 0
  const lngOffsetMin = (lng - 120) * 4
  const eotMin = equationOfTime(clock)
  const date = new Date(clock.getTime() + (dstMin + lngOffsetMin + eotMin) * 60000)
  return { date, lngOffsetMin, eotMin, dstMin }
}
