import { Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ProfilePage from './pages/ProfilePage'
import RegionDetailPage from './pages/RegionDetailPage'
import ResultPage from './pages/ResultPage'
import TestPage from './pages/TestPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/test" element={<TestPage />} />
      <Route path="/result" element={<ResultPage />} />
      <Route path="/region/:id" element={<RegionDetailPage />} />
    </Routes>
  )
}

export default App
