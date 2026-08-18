import { useMemo } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { REAL_REGIONS } from '../data/regionData'
import { QUESTIONS, recommend, type Axis, type Vector } from '../utils/recommendation_engine'
import { isProfileComplete, toBasicInfo } from '../utils/profile'

const AXES: Axis[] = ['H', 'T', 'I', 'C', 'E', 'J']
const AXIS_LABELS: Record<Axis, string> = {
  H: '주거',
  T: '교통',
  I: '생활 인프라',
  C: '문화',
  E: '자연환경',
  J: '일자리',
}
const RANK_LABELS = ['🥇 1위', '🥈 2위', '🥉 3위']

function VectorDetails({ vector }: { vector: Vector }) {
  return (
    <dl className="vector-list">
      {AXES.map((axis) => (
        <div key={axis} className="vector-row">
          <dt>{AXIS_LABELS[axis]}</dt>
          <dd>
            <span className="vector-bar"><span style={{ width: `${vector[axis]}%` }} /></span>
            <strong>{Math.round(vector[axis])}</strong>
          </dd>
        </div>
      ))}
    </dl>
  )
}

function ResultPage() {
  const { profile, answers, userVector, isHydrated } = useUser()
  const profileComplete = isProfileComplete(profile)
  const answersComplete = QUESTIONS.every((question) => answers[question.id])

  const calculation = useMemo(() => {
    if (!isHydrated || !profileComplete || !answersComplete || !userVector) return null
    try {
      return {
        recommendation: recommend({
          answers,
          basicInfo: toBasicInfo(profile),
          regions: REAL_REGIONS,
          priorityAxes: [],
          topN: 3,
        }),
        error: false,
      }
    } catch {
      return { recommendation: null, error: true }
    }
  }, [answers, answersComplete, isHydrated, profile, profileComplete, userVector])

  if (!isHydrated) return <main className="route-loading">저장된 정보를 불러오는 중...</main>
  if (!profileComplete) return <Navigate to="/profile" replace />
  if (!answersComplete || !userVector) return <Navigate to="/test" replace />

  if (!calculation || calculation.error || !calculation.recommendation) {
    return (
      <main className="result-page result-message">
        <h1>추천 결과를 계산하지 못했어요.</h1>
        <Link className="link-button" to="/test">진단 다시 하기</Link>
      </main>
    )
  }

  const { results } = calculation.recommendation

  return (
    <main className="result-page">
      <header className="result-header">
        <span className="service-name">여기살래?</span>
        <h1>당신에게 잘 맞는 지역을 찾았어요!</h1>
        <p>15문항 정착 성향을 바탕으로 조건에 맞는 지역 {results.length}곳을 찾았어요.</p>
        <p className="mock-notice">※ 일자리(J)축은 고용24 API 연동 전이라 교통·인프라 데이터 기반 근사치를 사용합니다.</p>
      </header>

      <section className="user-vector" aria-labelledby="user-vector-title">
        <h2 id="user-vector-title">나의 정착 성향</h2>
        <VectorDetails vector={userVector} />
      </section>

      {results.length === 0 ? (
        <section className="empty-results">
          <h2>현재 조건에 맞는 지역을 찾지 못했어요.</h2>
          <p>주거비 예산을 조금 넓혀 다시 진단해보세요.</p>
          <Link className="link-button" to="/profile">기본정보 수정하기</Link>
        </section>
      ) : (
        <section className="result-grid" aria-label="추천 지역 목록">
          {results.map((result, index) => {
            const regionData = REAL_REGIONS.find((region) => region.region === result.region)
            const percent = Math.round(result.similarity * 100)

            return (
              <article className={index === 0 ? 'result-card first' : 'result-card'} key={result.region}>
                <span className="rank-badge">{RANK_LABELS[index]}</span>
                <h2>{result.region}</h2>
                <div className="similarity-label"><span>적합도</span><strong>{percent}%</strong></div>
                <div className="similarity-bar"><span style={{ width: `${percent}%` }} /></div>
                <VectorDetails vector={result.vector} />
                {regionData?.code && (
                  <Link className="detail-link" to={`/region/${regionData.code}`}>지역 자세히 보기 →</Link>
                )}
              </article>
            )
          })}
        </section>
      )}

      <Link className="retry-link" to="/test">답변 수정하기</Link>
    </main>
  )
}

export default ResultPage
