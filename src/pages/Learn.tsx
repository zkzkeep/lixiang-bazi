import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LEVELS, findLesson, type Quiz } from '../data/lessons.ts'
import { Md } from '../components/Md.tsx'
import { store } from '../store.ts'

/** 一级内所有课的练习都达到 60% 视为“通过”，下一级才解锁（只是建议，可强行进入） */
const PASS = 0.6

function levelPassed(levelIdx: number) {
  const prog = store.getProgress()
  return LEVELS[levelIdx].lessons.every((l) => {
    const p = prog[l.id]
    return p && p.best / p.total >= PASS
  })
}

export function LearnHome() {
  const prog = store.getProgress()
  return (
    <div className="page">
      <section className="hero small">
        <h1>学堂</h1>
        <p>先理后象，逐级进阶。每一级练习通过率达到 60% 解锁下一级（也可以直接跳读）。</p>
      </section>
      {LEVELS.map((lv, i) => {
        const locked = i > 0 && !levelPassed(i - 1)
        const done = lv.lessons.filter((l) => prog[l.id] && prog[l.id].best / prog[l.id].total >= PASS).length
        return (
          <div key={lv.id} className={`card level ${locked ? 'locked' : ''}`}>
            <div className="level-head">
              <h2><span className="lvno">{i + 1}</span>{lv.name}</h2>
              <span className="muted">{done}/{lv.lessons.length} 课通过{locked ? ' · 🔒 建议先完成上一级' : ''}</span>
            </div>
            <p className="muted">{lv.goal}</p>
            <ul className="lessons">
              {lv.lessons.map((l) => {
                const p = prog[l.id]
                return (
                  <li key={l.id}>
                    <Link to={`/learn/${l.id}`}>
                      <b>{l.title}</b>
                      <span className="muted">{l.summary}</span>
                      {p && <span className={p.best / p.total >= PASS ? 'badge ok' : 'badge'}>{p.best}/{p.total}</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

export function LessonView() {
  const { id = '' } = useParams()
  const lesson = findLesson(id)
  if (!lesson) return <div className="page"><div className="card">课程不存在。<Link to="/learn">返回学堂</Link></div></div>
  const all = LEVELS.flatMap((l) => l.lessons)
  const idx = all.findIndex((l) => l.id === id)
  const next = all[idx + 1]
  const prev = all[idx - 1]
  return (
    <div className="page">
      <div className="crumb"><Link to="/learn">学堂</Link> / {lesson.levelName}</div>
      <article className="card lesson">
        <h1>{lesson.title}</h1>
        <p className="muted">{lesson.summary}</p>
        <Md text={lesson.body} />
        {lesson.practice && (
          <div className="practice">
            <b>动手</b>：{lesson.practice} <Link to="/">去排盘 →</Link>
          </div>
        )}
      </article>
      <QuizBox key={lesson.id} lessonId={lesson.id} quiz={lesson.quiz} />
      <div className="row between">
        {prev ? <Link to={`/learn/${prev.id}`}>← {prev.title}</Link> : <span />}
        {next ? <Link to={`/learn/${next.id}`}>{next.title} →</Link> : <Link to="/practice">去练习场 →</Link>}
      </div>
    </div>
  )
}

function QuizBox({ lessonId, quiz }: { lessonId: string; quiz: Quiz[] }) {
  const [ans, setAns] = useState<(number | null)[]>(() => quiz.map(() => null))
  const [submitted, setSubmitted] = useState(false)
  const right = ans.filter((a, i) => a === quiz[i].answer).length

  const submit = () => {
    setSubmitted(true)
    store.setProgress(lessonId, right, quiz.length)
  }
  const reset = () => { setAns(quiz.map(() => null)); setSubmitted(false) }

  return (
    <div className="card quiz">
      <h3>课后练习</h3>
      {quiz.map((q, i) => (
        <div key={i} className="q">
          <p><b>{i + 1}.</b> {q.q}</p>
          <div className="opts">
            {q.options.map((o, j) => {
              const cls = submitted ? (j === q.answer ? 'right' : ans[i] === j ? 'wrong' : '') : ans[i] === j ? 'on' : ''
              return (
                <button key={j} className={cls} disabled={submitted} onClick={() => setAns((a) => a.map((x, k) => (k === i ? j : x)))}>{o}</button>
              )
            })}
          </div>
          {submitted && <p className="explain">{ans[i] === q.answer ? '✓ ' : '✗ '}{q.explain}</p>}
        </div>
      ))}
      <div className="row">
        {!submitted
          ? <button className="primary" disabled={ans.some((a) => a === null)} onClick={submit}>交卷</button>
          : <><b>得分 {right}/{quiz.length}</b><button onClick={reset}>再做一遍</button></>}
      </div>
    </div>
  )
}
