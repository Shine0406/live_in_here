import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { fetchMatchReport } from '../api/matchReport'
import { useUser } from '../context/UserContext'
import { getRegionPath, REAL_REGIONS } from '../data/regionData'
import { QUESTIONS, recommend, type Axis, type Vector } from '../utils/recommendation_engine'
import { createFallbackMatchReport, type MatchReport } from '../utils/matchReport'
import { isProfileComplete, toBasicInfo } from '../utils/profile'

const AXES: Axis[] = ['H', 'T', 'I', 'C', 'E', 'J']
const AXIS_LABELS: Record<Axis, string> = { H: '주거', T: '교통', I: '생활 인프라', C: '문화', E: '자연환경', J: '일자리' }
const AXIS_TYPE_LABELS: Record<Axis, string> = { H: '주거', T: '교통', I: '생활', C: '문화', E: '자연', J: '일자리' }

function getRegionTypeLabel(vector: Vector) {
  const topAxes = [...AXES].sort((a, b) => vector[b] - vector[a]).slice(0, 2)
  return `${AXIS_TYPE_LABELS[topAxes[0]]}·${AXIS_TYPE_LABELS[topAxes[1]]}형`
}

function getRegionBlurb(vector: Vector) {
  const topAxes = [...AXES].sort((a, b) => vector[b] - vector[a]).slice(0, 2)
  return `${AXIS_LABELS[topAxes[0]]}와 ${AXIS_LABELS[topAxes[1]]}의 균형이 돋보이는 곳`
}

function UserVectorReport({ vector }: { vector: Vector }) {
  return (
    <dl className="result-vector-list">
      {AXES.map((axis) => {
        const score = Math.round(vector[axis])
        return (
          <div className="result-vector-row" key={axis}>
            <dt><span>{AXIS_LABELS[axis]}</span><strong>{score}</strong></dt>
            <dd><span style={{ width: `${score}%` }} /></dd>
          </div>
        )
      })}
    </dl>
  )
}

function HouseMascot({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'result-house-mascot compact' : 'result-house-mascot'} aria-hidden="true">
      <span className="result-house-roof" />
      <span className="result-house-body"><i /><i /><b>⌣</b><em /></span>
    </div>
  )
}

function ResultPage() {
  const { profile, answers, userVector, isHydrated } = useUser()
  const [generatedReport, setGeneratedReport] = useState<MatchReport | null>(null)
  const [reportStatus, setReportStatus] = useState<'idle' | 'loading' | 'success' | 'fallback'>('idle')
  const [shareNotice, setShareNotice] = useState(false)
  const profileComplete = isProfileComplete(profile)
  const answersComplete = QUESTIONS.every((question) => answers[question.id])

  const calculation = useMemo(() => {
    if (!isHydrated || !profileComplete || !answersComplete || !userVector) return null
    try {
      return { recommendation: recommend({ answers, basicInfo: toBasicInfo(profile), regions: REAL_REGIONS, priorityAxes: [], topN: 3 }), error: false }
    } catch {
      return { recommendation: null, error: true }
    }
  }, [answers, answersComplete, isHydrated, profile, profileComplete, userVector])

  const topResult = calculation?.recommendation?.results[0]
  const fallbackReport = useMemo(() => (
    topResult && userVector ? createFallbackMatchReport(topResult.region, userVector, topResult.vector) : null
  ), [topResult, userVector])

  useEffect(() => {
    if (!topResult || !fallbackReport || !profileComplete || !answersComplete || !userVector) return
    const controller = new AbortController()
    setGeneratedReport(null)
    setReportStatus('loading')
    fetchMatchReport({ userVector, region: { name: topResult.region, vector: topResult.vector }, basicInfo: profile, matchPercent: Math.round(topResult.similarity * 100) }, controller.signal)
      .then((report) => { setGeneratedReport(report); setReportStatus('success') })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setReportStatus('fallback')
        console.warn('LLM 매칭 리포트를 불러오지 못해 기본 설명을 사용합니다.', error)
      })
    return () => controller.abort()
  }, [answersComplete, fallbackReport, profile, profileComplete, topResult, userVector])

  if (!isHydrated) return <main className="route-loading">저장된 정보를 불러오는 중...</main>
  if (!profileComplete) return <Navigate to="/profile" replace />
  if (!answersComplete || !userVector) return <Navigate to="/test" replace />

  if (!calculation || calculation.error || !calculation.recommendation) {
    return <main className="result-page result-message"><h1>추천 결과를 계산하지 못했어요.</h1><Link className="link-button" to="/test">진단 다시 하기</Link></main>
  }

  const { results } = calculation.recommendation
  if (results.length === 0) {
    return <main className="result-page result-message"><h1>현재 조건에 맞는 지역을 찾지 못했어요.</h1><p>주거비 예산을 조금 넓혀 다시 진단해보세요.</p><Link className="link-button" to="/profile">기본정보 수정하기</Link></main>
  }

  const top1 = results[0]
  const top1Region = REAL_REGIONS.find((region) => region.region === top1.region)
  const matchReport = generatedReport ?? fallbackReport
  if (!matchReport) return null
  return (
    <main className="result-page">
      <section className="result-top-section">
        <header className="result-service-header"><span aria-hidden="true">🏠</span><strong>여기살래?</strong></header>
        <div className="result-hero">
          <h1>{top1.region}</h1>
          <p>정착 성향 테스트 결과를 바탕으로 해당 지역과<br />핵심 성향에 대해 자세히 알아보세요.</p>
        </div>

        <article className="result-main-card">
          <div className="result-mascot-area">
            <span>지역 유형</span>
            <h2>{getRegionTypeLabel(top1.vector)}</h2>
            <HouseMascot />
          </div>
          <div className="result-summary">
            <p>{matchReport.summary}</p>
            {reportStatus === 'loading' && <small>맞춤 설명을 생성하고 있어요...</small>}
            {top1Region?.code && <Link to={getRegionPath(top1Region)}>{top1.region} 자세히 알아보기 →</Link>}
          </div>
        </article>
      </section>

      <section className="result-user-vector" aria-labelledby="vector-title">
        <h2 id="vector-title">나의 정착 성향</h2>
        <UserVectorReport vector={userVector} />
      </section>

      <section className="result-analysis-section" aria-labelledby="analysis-title">
        <span className="result-section-label">AI ANALYSIS</span>
        <h2 id="analysis-title">{top1.region}와 잘 맞는 이유</h2>
        <div className="result-analysis-list">
          <p className="result-analysis-card">{matchReport.detail}</p>
        </div>
      </section>

      <section className="result-top-picks" aria-labelledby="picks-title">
        <span className="result-section-label">TOP PICKS</span>
        <h2 id="picks-title">추천 지역 {results.length}곳</h2>
        <p className="result-picks-description">각 지역을 눌러 상세 정보와 정책을 확인하세요.</p>
        <div className="result-pick-list">
          {results.map((result, index) => {
            const regionData = REAL_REGIONS.find((region) => region.region === result.region)
            if (!regionData?.code) return null
            return (
              <Link className={index === 0 ? 'result-pick-card top' : 'result-pick-card'} to={getRegionPath(regionData)} key={result.region}>
                <span className="result-pick-rank">{index + 1}</span>
                <span className={`result-pick-mascot tone-${index}`}><HouseMascot compact /></span>
                <span className="result-pick-copy"><strong>{result.region}</strong><em>{getRegionTypeLabel(result.vector)}</em><small>{getRegionBlurb(result.vector)}</small></span>
                <span className="result-pick-score"><strong>{Math.round(result.similarity * 100)}%</strong><small>적합도</small></span>
              </Link>
            )
          })}
        </div>
        <button className="result-share-button" type="button" onClick={() => setShareNotice(true)}>내 Soul 지역 공유하기 📤</button>
        {shareNotice && <p className="result-share-notice" role="status">공유 기능은 준비 중이에요.</p>}
      </section>
    </main>
  )
}

export default ResultPage
