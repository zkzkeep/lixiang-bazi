import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import Home from './pages/Home.tsx'
import ChartView from './pages/ChartView.tsx'
import { LearnHome, LessonView } from './pages/Learn.tsx'
import Practice from './pages/Practice.tsx'
import Cases from './pages/Cases.tsx'
import About from './pages/About.tsx'

export default function App() {
  return (
    <HashRouter>
      <header className="topbar">
        <NavLink to="/" className="brand">理象<span>八字</span></NavLink>
        <NavLink to="/about" className="link">关于</NavLink>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/chart" element={<ChartView />} />
          <Route path="/learn" element={<LearnHome />} />
          <Route path="/learn/:id" element={<LessonView />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/cases" element={<Cases />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>
      <nav className="bottombar">
        <NavLink to="/" end>排盘</NavLink>
        <NavLink to="/learn">学堂</NavLink>
        <NavLink to="/practice">练习</NavLink>
        <NavLink to="/cases">命例</NavLink>
      </nav>
    </HashRouter>
  )
}
