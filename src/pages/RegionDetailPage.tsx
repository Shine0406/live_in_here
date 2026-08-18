import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { fetchPolicies, type PolicyResponse } from '../api/policy'
import { useUser } from '../context/UserContext'
import { getMockJobs } from '../data/mockJobs'
import { findRegionByCode, REAL_REGIONS } from '../data/regionData'
import { QUESTIONS, recommend, type Axis, type Vector } from '../utils/recommendation_engine'
import { isProfileComplete, toBasicInfo } from '../utils/profile'

type DetailTab = 'info' | 'policy' | 'jobs'
type PolicyState = { status: 'idle' } | { status: 'loading' } | { status: 'success'; data: PolicyResponse } | { status: 'error' }

const AXES: Axis[] = ['H', 'T', 'I', 'C', 'E', 'J']
const AXIS_DETAILS: Record<Axis, { label: string; icon: string; short: string }> = {
  H: { label: '주거', icon: '🏠', short: '주거 여건' },
  T: { label: '교통', icon: '🚉', short: '교통 접근성' },
  I: { label: '생활 인프라', icon: '🏥', short: '생활 편의' },
  C: { label: '문화', icon: '🎭', short: '문화 환경' },
  E: { label: '자연환경', icon: '🌳', short: '자연 인접' },
  J: { label: '일자리', icon: '💼', short: '일자리 지표' },
}
const JOB_LABELS: Record<string, string> = { IT: 'IT / 개발', DESIGN: '디자인', PLANNING: '기획 / 마케팅', EDUCATION: '교육', RESEARCH: '연구 / 기술', MANUFACTURING: '제조 / 생산', SERVICE: '서비스', STARTUP: '창업', OTHER: '기타' }

function getTopAxes(vector: Vector, count = 3) {
  return AXES.map((axis) => ({ axis, value: vector[axis] })).sort((a, b) => b.value - a.value).slice(0, count)
}

function getMatchReasons(userVector: Vector, regionVector: Vector) {
  return [...AXES]
    .sort((a, b) => Math.abs(userVector[a] - regionVector[a]) - Math.abs(userVector[b] - regionVector[b]))
    .slice(0, 3)
    .map((axis) => `${AXIS_DETAILS[axis].label} 성향에서 나의 점수 ${Math.round(userVector[axis])}점과 지역 점수 ${Math.round(regionVector[axis])}점의 차이가 작아 잘 맞아요.`)
}

function RegionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const { profile, answers, userVector, isHydrated } = useUser()
  const [activeTab, setActiveTab] = useState<DetailTab>('info')
  const [policyState, setPolicyState] = useState<PolicyState>({ status: 'idle' })
  const [policyRetry, setPolicyRetry] = useState(0)
  const [selectedDemoJobId, setSelectedDemoJobId] = useState<string | null>(null)
  const policyCache = useRef(new Map<string, PolicyResponse>())
  const currentRegion = useMemo(() => findRegionByCode(id, searchParams.get('region')), [id, searchParams])
  const profileComplete = isProfileComplete(profile)
  const answersComplete = QUESTIONS.every((question) => answers[question.id])

  const calculation = useMemo(() => {
    if (!isHydrated || !profileComplete || !answersComplete || !userVector || !currentRegion) return null
    try {
      const recommendation = recommend({ answers, basicInfo: toBasicInfo(profile), regions: REAL_REGIONS, priorityAxes: [], topN: REAL_REGIONS.length })
      return { currentMatch: recommendation.results.find((result) => result.region === currentRegion.region), error: false }
    } catch {
      return { currentMatch: undefined, error: true }
    }
  }, [answers, answersComplete, currentRegion, isHydrated, profile, profileComplete, userVector])

  useEffect(() => {
    if (activeTab !== 'policy' || !currentRegion || !profile.ageGroup) return
    const cacheKey = `${currentRegion.region}:${profile.ageGroup}`
    const cached = policyCache.current.get(cacheKey)
    if (cached) { setPolicyState({ status: 'success', data: cached }); return }
    const controller = new AbortController()
    setPolicyState({ status: 'loading' })
    fetchPolicies(currentRegion.region, profile.ageGroup, controller.signal)
      .then((data) => { policyCache.current.set(cacheKey, data); setPolicyState({ status: 'success', data }) })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.warn('정책 정보를 불러오지 못했습니다.', error)
        setPolicyState({ status: 'error' })
      })
    return () => controller.abort()
  }, [activeTab, currentRegion, policyRetry, profile.ageGroup])

  if (!isHydrated) return <main className="route-loading">지역 정보를 불러오는 중...</main>
  if (!profileComplete) return <Navigate to="/profile" replace />
  if (!answersComplete || !userVector) return <Navigate to="/test" replace />
  if (!currentRegion) return <main className="region-page region-message"><h1>지역 정보를 찾을 수 없어요.</h1><Link className="link-button" to="/result">추천 결과로 돌아가기</Link></main>
  if (!calculation || calculation.error) return <main className="region-page region-message"><h1>지역 정보를 계산하지 못했어요.</h1><Link className="link-button" to="/result">추천 결과로 돌아가기</Link></main>

  const topAxes = getTopAxes(currentRegion.vector)
  const percent = calculation.currentMatch ? Math.round(calculation.currentMatch.similarity * 100) : null
  const reasons = getMatchReasons(userVector, currentRegion.vector)
  const mockJobs = getMockJobs(currentRegion.region, profile.jobCategory)

  return (
    <main className="region-page">
      <section className="region-overview">
        <Link className="region-back-link" to="/result">← 추천 결과로</Link>
        <span className="region-service-name">여기살래?</span>
        <h1>{currentRegion.region}</h1>
        <div className="region-strength-badges">{topAxes.map(({ axis }) => <span key={axis}>{AXIS_DETAILS[axis].short}</span>)}</div>

        <section className="region-match-card" aria-labelledby="match-title">
          <h2 id="match-title">나와의 적합도</h2>
          {percent !== null ? <><strong>{percent}%</strong><div><span style={{ width: `${percent}%` }} /></div></> : <div className="region-filtered-notice"><p>현재 주거비 조건에서 추천 대상에서 제외된 지역이에요.</p><Link to="/profile">기본정보 수정하기</Link></div>}
        </section>

        <div className="region-tabs" role="tablist" aria-label="지역 상세 메뉴">
          <button role="tab" aria-selected={activeTab === 'info'} className={activeTab === 'info' ? 'active' : ''} onClick={() => setActiveTab('info')}>지역 정보</button>
          <button role="tab" aria-selected={activeTab === 'policy'} className={activeTab === 'policy' ? 'active' : ''} onClick={() => setActiveTab('policy')}>정책</button>
          <button role="tab" aria-selected={activeTab === 'jobs'} className={activeTab === 'jobs' ? 'active' : ''} onClick={() => setActiveTab('jobs')}>일자리</button>
        </div>
      </section>

      {activeTab === 'info' && <section className="region-tab-panel" role="tabpanel">
        <h2>이 지역의 생활 정보</h2>
        <div className="region-info-grid">
          {AXES.map((axis) => <article className="region-info-card" key={axis}><span aria-hidden="true">{AXIS_DETAILS[axis].icon}</span><small>{AXIS_DETAILS[axis].label}</small><strong>{axis === 'H' && currentRegion.budgetProxy !== undefined ? `${currentRegion.budgetProxy}만원` : `${Math.round(currentRegion.vector[axis])}점`}</strong><em>{axis === 'J' ? '실시간 채용 데이터 미연동' : `나의 점수 ${Math.round(userVector[axis])}점`}</em></article>)}
        </div>
        <h2 className="region-reasons-title">왜 나와 잘 맞을까?</h2>
        <div className="region-reason-list">{reasons.map((reason) => <p key={reason}>{reason}</p>)}</div>
      </section>}

      {activeTab === 'policy' && <section className="region-tab-panel region-policy-panel" role="tabpanel">
        <h2>이 지역의 청년 정책</h2>
        {policyState.status === 'idle' || policyState.status === 'loading' ? <p className="region-status-card">정책 정보를 불러오는 중...</p> : policyState.status === 'error' ? <div className="region-status-card"><p>정책 정보를 불러오지 못했어요.</p><button type="button" onClick={() => setPolicyRetry((value) => value + 1)}>다시 시도</button></div> : policyState.data.policies.length === 0 ? <div className="region-status-card"><p>현재 조건에서 확인된 청년 정책이 없어요.</p><small>정책 등록 상황에 따라 결과가 달라질 수 있습니다.</small></div> : <div className="region-policy-list">{policyState.data.policies.map((policy, index) => {
          const externalUrl = policy.applicationUrl ?? policy.referenceUrl
          return <article className="region-policy-card" key={policy.policyNo ?? `${policy.policyName}-${index}`}>
            {policy.category && <span>{policy.category}</span>}
            <h3>{policy.policyName}</h3>
            {policy.description && <p>{policy.description}</p>}
            {policy.support && <div><strong>지원 내용</strong><p>{policy.support}</p></div>}
            {policy.institutionName && <small>운영기관 · {policy.institutionName}</small>}
            {externalUrl && <a href={externalUrl} target="_blank" rel="noopener noreferrer">신청/상세 페이지 →</a>}
          </article>
        })}</div>}
        <p className="region-policy-scope">※ 정책은 해당 지역이 속한 광역 시·도 기준으로 조회합니다.</p>
      </section>}

      {activeTab === 'jobs' && <section className="region-tab-panel region-jobs-panel" role="tabpanel">
        <h2>이 지역의 일자리</h2>
        <div className="region-jobs-summary"><small>현재 {currentRegion.region}에서 확인 가능한</small><strong>{mockJobs.length}건의 추천 채용공고</strong><span>희망 직무 · {JOB_LABELS[profile.jobCategory] ?? profile.jobCategory}</span><em>DEMO DATA · 시연용 채용정보</em></div>
        {mockJobs.length === 0 ? <article className="region-jobs-placeholder"><span>💼</span><h3>이 지역의 시연용 채용공고는 준비 중이에요.</h3><p>실제 서비스에서는 고용24 채용정보를 연결할 예정입니다.</p></article> : <div className="region-job-list">
          {mockJobs.map((job) => <article className="region-job-card" key={job.id}>
            <div className="region-job-card-header"><strong>{job.companyName}</strong><span><em>시연용</em><b>{job.employmentType}</b></span></div>
            <h3>{job.title}</h3>
            <p><span>📍 {job.location}</span><span>📅 {job.deadline} 마감</span></p>
            <button type="button" onClick={() => setSelectedDemoJobId(job.id)}>공고 자세히 보기 →</button>
            {selectedDemoJobId === job.id && <small className="region-job-demo-notice" role="status">시연용 채용공고입니다.<br />실제 서비스에서는 고용24 채용 페이지로 연결됩니다.</small>}
          </article>)}
        </div>}
      </section>}
    </main>
  )
}

export default RegionDetailPage
