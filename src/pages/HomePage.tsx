import { Link } from 'react-router-dom'

function HomePage() {
  return (
    <main className="home-page">
      <header className="home-header">
        <Link className="home-logo" to="/" aria-label="여기살래? 홈">
          <span aria-hidden="true">🏠</span>
          <strong>여기살래?</strong>
        </Link>
        <span className="home-beta">Beta</span>
      </header>

      <div className="home-content">
        <section className="home-hero" aria-labelledby="home-title">
          <span className="home-test-badge"><i aria-hidden="true" />1분 정착 성향 테스트</span>
          <h1 id="home-title">나랑 잘 맞는 동네,<br />어디일까?</h1>
          <p>정착 성향 테스트로 나에게 딱 맞는<br />지역을 찾아보세요.</p>
        </section>

        <section className="home-cta-card" aria-label="지역 찾기 시작">
          <p>MBTI처럼 가볍게 시작해서, 실제로 살아볼 수<br className="home-wide-break" /> 있는 지역을 찾아드려요.</p>
          <Link className="home-primary-button" to="/profile">내 지역 찾기 <span aria-hidden="true">→</span></Link>
          <small>⏱ 평균 1분 30초 · 총 15문항</small>
        </section>
      </div>
    </main>
  )
}

export default HomePage
