import { useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { findRegionByCode, REAL_REGIONS } from '../data/regionData'
import { QUESTIONS, recommend, type Axis, type Vector } from '../utils/recommendation_engine'
import { isProfileComplete, toBasicInfo } from '../utils/profile'

type DetailTab = 'info' | 'policy' | 'jobs'

const AXES: Axis[] = ['H', 'T', 'I', 'C', 'E', 'J']
const AXIS_DETAILS: Record<Axis, { label: string; icon: string }> = {
  H: { label: '주거', icon: '🏠' },
  T: { label: '교통', icon: '🚌' },
  I: { label: '생활 인프라', icon: '🏥' },
  C: { label: '문화', icon: '🎭' },
  E: { label: '자연환경', icon: '🌳' },
  J: { label: '일자리', icon: '💼' },
}

const JOB_LABELS: Record<string, string> = {
  IT: 'IT/개발',
  DESIGN: '디자인',
  PLANNING: '기획/마케팅',
  EDUCATION: '교육',
  RESEARCH: '연구/기술',
  MANUFACTURING: '제조/생산',
  SERVICE: '서비스',
  STARTUP: '창업',
  OTHER: '기타',
}

function getTopRegionStrengths(vector: Vector) {
  return AXES
    .map((axis) => ({ axis, value: vector[axis] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 2)
    .map(({ axis }) => AXIS_DETAILS[axis].label)
}

function RegionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const { profile, answers, userVector, isHydrated } = useUser()
  const [activeTab, setActiveTab] = useState<DetailTab>('info')
  const regionName = searchParams.get('region')
  const currentRegion = useMemo(() => findRegionByCode(id, regionName), [id, regionName])
  const profileComplete = isProfileComplete(profile)
  const answersComplete = QUESTIONS.every((question) => answers[question.id])

  const calculation = useMemo(() => {
    if (!isHydrated || !profileComplete || !answersComplete || !userVector || !currentRegion) return null

    try {
      const recommendation = recommend({
        answers,
        basicInfo: toBasicInfo(profile),
        regions: REAL_REGIONS,
        priorityAxes: [],
        topN: REAL_REGIONS.length,
      })
      const currentMatch = recommendation.results.find(
        (result) => result.region === currentRegion.region,
      )
      return { currentMatch, error: false }
    } catch {
      return { currentMatch: undefined, error: true }
    }
  }, [answers, answersComplete, currentRegion, isHydrated, profile, profileComplete, userVector])

  if (!isHydrated) return <main className="route-loading">지역 정보를 불러오는 중...</main>
  if (!profileComplete) return <Navigate to="/profile" replace />
  if (!answersComplete || !userVector) return <Navigate to="/test" replace />

  if (!currentRegion) {
    return (
      <main className="region-page region-message">
        <h1>지역 정보를 찾을 수 없어요.</h1>
        <p>추천 결과에서 지역을 다시 선택해주세요.</p>
        <Link className="link-button" to="/result">추천 결과로 돌아가기</Link>
      </main>
    )
  }

  if (!calculation || calculation.error) {
    return (
      <main className="region-page region-message">
        <h1>지역 정보를 계산하지 못했어요.</h1>
        <Link className="link-button" to="/result">추천 결과로 돌아가기</Link>
      </main>
    )
  }

  const strengths = getTopRegionStrengths(currentRegion.vector)
  const percent = calculation.currentMatch
    ? Math.round(calculation.currentMatch.similarity * 100)
    : null

  return (
    <main className="region-page">
      <Link className="back-link" to="/result">← 추천 결과로</Link>

      <header className="region-header">
        <span className="service-name">여기살래?</span>
        <h1>{currentRegion.region}</h1>
        <p className="region-strengths">주요 강점 · {strengths.join(' · ')}</p>
      </header>

      <section className="region-match" aria-labelledby="match-title">
        <h2 id="match-title">나와의 적합도</h2>
        {percent !== null ? (
          <>
            <strong>{percent}%</strong>
            <div className="similarity-bar"><span style={{ width: `${percent}%` }} /></div>
          </>
        ) : (
          <div className="filtered-notice">
            <p>현재 설정한 주거비 조건에서는 추천 대상에서 제외된 지역이에요.</p>
            <Link to="/profile">기본정보 수정하기</Link>
          </div>
        )}
      </section>

      <div className="detail-tabs" role="tablist" aria-label="지역 상세 메뉴">
        <button role="tab" aria-selected={activeTab === 'info'} className={activeTab === 'info' ? 'active' : ''} onClick={() => setActiveTab('info')}>지역 정보</button>
        <button role="tab" aria-selected={activeTab === 'policy'} className={activeTab === 'policy' ? 'active' : ''} onClick={() => setActiveTab('policy')}>정책</button>
        <button role="tab" aria-selected={activeTab === 'jobs'} className={activeTab === 'jobs' ? 'active' : ''} onClick={() => setActiveTab('jobs')}>일자리</button>
      </div>

      {activeTab === 'info' && (
        <section className="detail-panel" role="tabpanel">
          <h2>지역 정보</h2>
          <div className="region-indicators">
            {AXES.map((axis) => (
              <article className="region-indicator" key={axis}>
                <span className="indicator-icon" aria-hidden="true">{AXIS_DETAILS[axis].icon}</span>
                <div>
                  <h3>{AXIS_DETAILS[axis].label}</h3>
                  <p>지역 점수 <strong>{currentRegion.vector[axis]}</strong></p>
                  <div className="comparison-values">
                    <span>나 {Math.round(userVector[axis])}</span>
                    <span>지역 {currentRegion.vector[axis]}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {currentRegion.budgetProxy !== undefined && (
            <p className="source-metric">월 주거비 기준값: {currentRegion.budgetProxy}만원</p>
          )}
          <p className="data-note">일자리 지표 안내: {currentRegion.jNote}</p>
        </section>
      )}

      {activeTab === 'policy' && (
        <section className="detail-panel placeholder-panel" role="tabpanel">
          <h2>이 지역의 청년 정책</h2>
          <p>추천 지역과 사용자 조건에 맞는 청년·주거·정착 지원정책을 연결할 예정입니다.</p>
          <strong>정책 데이터 연결 예정</strong>
        </section>
      )}

      {activeTab === 'jobs' && (
        <section className="detail-panel placeholder-panel" role="tabpanel">
          <h2>이 지역의 일자리</h2>
          <p>선택한 희망 직무와 현재 지역을 기준으로 고용24 채용정보를 연결할 예정입니다.</p>
          <p>희망 직무: <strong>{JOB_LABELS[profile.jobCategory] ?? profile.jobCategory}</strong></p>
          <strong>채용정보 연결 예정</strong>
        </section>
      )}
    </main>
  )
}

export default RegionDetailPage
