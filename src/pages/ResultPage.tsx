import { useMemo } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { getRegionPath, REAL_REGIONS } from '../data/regionData'
import { QUESTIONS, recommend, type Axis, type Vector } from '../utils/recommendation_engine'
import { createFallbackMatchReport } from '../utils/matchReport'
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
function UserVectorReport({ vector }: { vector: Vector }) {
  return (
    <dl className="report-vector-list">
      {AXES.map((axis) => (
        <div key={axis} className="report-vector-row">
          <dt><span>{AXIS_LABELS[axis]}</span><strong>{Math.round(vector[axis])}</strong></dt>
          <dd>
            <span style={{ width: `${vector[axis]}%` }} />
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

  if (results.length === 0) {
    return (
      <main className="result-page result-report-page">
        <header className="report-hero">
          <span className="service-name">여기살래?</span>
          <h1>현재 조건에 맞는 지역을 찾지 못했어요.</h1>
          <p>주거비 예산을 조금 넓혀 다시 진단해보세요.</p>
          <Link className="link-button" to="/profile">기본정보 수정하기</Link>
        </header>
      </main>
    )
  }

  const top1 = results[0]
  const top1Region = REAL_REGIONS.find((region) => region.region === top1.region)
  const top1Percent = Math.round(top1.similarity * 100)

  // TODO: 생성형 AI API 연결 후 실제 LLM 응답으로 아래 두 필드를 교체한다.
  // - summary
  // - detail
  const matchReport = createFallbackMatchReport(top1.region, userVector, top1.vector)

  return (
    <main className="result-page result-report-page">
      <header className="report-hero">
        <span className="service-name">여기살래?</span>
        <h1>당신의 soul 지역은<br /><em>{top1.region}</em>입니다!</h1>
        <p>15문항 정착 성향을 바탕으로<br />조건에 맞는 지역 {results.length}곳을 찾았어요.</p>
      </header>

      <section className="mascot-section" aria-label={`${top1.region} 마스코트 영역`}>
        <div className="mascot-placeholder" aria-hidden="true">
          <span>지역 마스코트</span>
          <strong>준비 중</strong>
        </div>
        <div className="top-match-score">
          <span>나와의 적합도</span>
          <strong>{top1Percent}%</strong>
        </div>
        <div className="similarity-bar"><span style={{ width: `${top1Percent}%` }} /></div>
      </section>

      <section className="report-summary" aria-labelledby="summary-title">
        <h2 id="summary-title"><strong>{top1.region}</strong>과 나의 매칭</h2>
        <p>{matchReport.summary}</p>
        {top1Region?.code && <Link to={getRegionPath(top1Region)}>1위 지역 자세히 보기 →</Link>}
      </section>

      <section className="report-vector-section" aria-labelledby="user-vector-title">
        <h2 id="user-vector-title">나의 정착 성향</h2>
        <UserVectorReport vector={userVector} />
      </section>

      <section className="report-analysis" aria-labelledby="analysis-title">
        <span>REPORT</span>
        <h2 id="analysis-title">매칭 분석</h2>
        <p>{matchReport.detail}</p>
      </section>

      <section className="rank-link-section" aria-labelledby="rank-title">
        <h2 id="rank-title">추천 지역</h2>
        <div className="rank-link-list">
          {results.map((result, index) => {
            const regionData = REAL_REGIONS.find((region) => region.region === result.region)
            if (!regionData?.code) return null

            return (
              <Link className={index === 0 ? 'rank-link top' : 'rank-link'} to={getRegionPath(regionData)} key={result.region}>
                <span>{index + 1}위</span>
                <strong>{result.region}</strong>
                <em>{Math.round(result.similarity * 100)}%</em>
              </Link>
            )
          })}
        </div>
      </section>

      <p className="report-note">※ 현재 지역 설명 및 매칭 분석은 실제 지역 지표 기반의 임시 설명입니다. 일자리 지표는 고용24 API 연동 전 근사값을 사용합니다.</p>
      <Link className="retry-link" to="/test">답변 수정하기</Link>
    </main>
  )
}

export default ResultPage
