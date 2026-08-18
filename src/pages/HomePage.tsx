import { Link } from 'react-router-dom'

function HomePage() {
  return (
    <main>
      <h1>여기살래?</h1>
      <p>랜딩 페이지</p>
      <nav aria-label="페이지 이동 테스트">
        <ul>
          <li><Link to="/profile">기본정보 페이지</Link></li>
          <li><Link to="/test">진단 페이지</Link></li>
          <li><Link to="/result">결과 페이지</Link></li>
          <li><Link to="/region/chuncheon">춘천 상세 페이지</Link></li>
        </ul>
      </nav>
    </main>
  )
}

export default HomePage
