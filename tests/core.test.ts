import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildChart, type BirthInput } from '../src/core/chart.ts'
import { shiShen, changSheng, wangXiang } from '../src/core/constants.ts'
import { analyzeStrength, analyzeGeJu, analyzeYongShen } from '../src/core/lifa.ts'
import { findRelations } from '../src/core/relations.ts'
import { comboXiang, shenSha } from '../src/core/xiangfa.ts'

const base: BirthInput = { name: '测试', gender: 1, calendar: 'solar', year: 1990, month: 5, day: 20, hour: 14, minute: 30, useTrueSolar: false, lng: 120, sect: 1 }
const gz = (c: ReturnType<typeof buildChart>) => (['year', 'month', 'day', 'time'] as const).map((k) => c.pillars[k].gan + c.pillars[k].zhi).join(' ')

test('四柱：1990-05-20 14:30 → 庚午 辛巳 乙酉 癸未', () => {
  assert.equal(gz(buildChart(base)), '庚午 辛巳 乙酉 癸未')
})

test('立春换年：2024-02-04 16:27 立春前后年柱不同', () => {
  const before = buildChart({ ...base, year: 2024, month: 2, day: 4, hour: 16, minute: 20 })
  const after = buildChart({ ...base, year: 2024, month: 2, day: 4, hour: 16, minute: 40 })
  assert.equal(before.pillars.year.gan + before.pillars.year.zhi, '癸卯')
  assert.equal(after.pillars.year.gan + after.pillars.year.zhi, '甲辰')
})

test('子时流派：23:30 sect=1 日柱换到次日，sect=2 不换', () => {
  const a = buildChart({ ...base, year: 2000, month: 1, day: 1, hour: 23, minute: 30, sect: 1 })
  const b = buildChart({ ...base, year: 2000, month: 1, day: 1, hour: 23, minute: 30, sect: 2 })
  assert.equal(b.pillars.day.gan + b.pillars.day.zhi, '戊午')
  assert.equal(a.pillars.day.gan + a.pillars.day.zhi, '己未')
})

test('农历输入：农历1990年四月廿六 = 公历 5月20日', () => {
  const c = buildChart({ ...base, calendar: 'lunar', month: 4, day: 26 })
  assert.equal(gz(c), '庚午 辛巳 乙酉 癸未')
})

test('真太阳时：恩施(109.49E) 12:00 约慢 42 分钟', () => {
  const c = buildChart({ ...base, useTrueSolar: true, lng: 109.49, hour: 12, minute: 0 })
  assert.ok(Math.abs(c.solarTime!.lngOffsetMin + 42.04) < 0.1)
})

test('十神 / 长生 / 旺相休囚', () => {
  assert.equal(shiShen('甲', '庚'), '七杀')
  assert.equal(shiShen('甲', '辛'), '正官')
  assert.equal(shiShen('乙', '丙'), '伤官')
  assert.equal(shiShen('壬', '丙'), '偏财')
  assert.equal(shiShen('丁', '甲'), '正印')
  assert.equal(changSheng('甲', '亥'), '长生')
  assert.equal(changSheng('甲', '卯'), '帝旺')
  assert.equal(changSheng('乙', '午'), '长生')
  assert.equal(changSheng('乙', '寅'), '帝旺')
  assert.equal(wangXiang('木', '火'), '相')
  assert.equal(wangXiang('木', '金'), '囚')
  assert.equal(wangXiang('木', '土'), '死')
})

test('大运：男命庚午阳年顺排，首运壬午', () => {
  const c = buildChart(base)
  assert.equal(c.daYun[0].ganZhi, '壬午')
  const f = buildChart({ ...base, gender: 0 })
  assert.equal(f.daYun[0].ganZhi, '庚辰')
})

test('关系识别', () => {
  const r = findRelations([{ label: '年干', char: '甲' }, { label: '月干', char: '己' }], [
    { label: '年支', char: '子' }, { label: '月支', char: '午' }, { label: '日支', char: '辰' }, { label: '时支', char: '申' },
  ]).map((x) => x.type)
  assert.ok(r.includes('天干五合'))
  assert.ok(r.includes('地支六冲'))
  assert.ok(r.includes('地支三合'))
})

test('理法 / 象法全流程不报错', () => {
  for (let y = 1950; y < 2020; y += 3) {
    const c = buildChart({ ...base, year: y, month: (y % 12) + 1, day: (y % 27) + 1, hour: y % 24 })
    const st = analyzeStrength(c)
    assert.ok(st.ratio >= 0 && st.ratio <= 1)
    assert.ok(analyzeGeJu(c).name.endsWith('格'))
    analyzeYongShen(c, st)
    comboXiang(c, st)
    shenSha(c)
  }
})
