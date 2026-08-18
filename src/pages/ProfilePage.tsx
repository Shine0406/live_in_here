import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import type { AgeGroup, JobCategory, UserProfile } from '../types/user'
import { isProfileComplete } from '../utils/profile'

const ageOptions: Array<{ label: string; value: AgeGroup }> = [
  { label: '20~24세', value: '20-24' },
  { label: '25~29세', value: '25-29' },
  { label: '30~34세', value: '30-34' },
  { label: '35~39세', value: '35-39' },
  { label: '40세 이상', value: '40+' },
]

const jobOptions: Array<{ label: string; value: JobCategory }> = [
  { label: 'IT / 개발', value: 'IT' },
  { label: '디자인', value: 'DESIGN' },
  { label: '기획 / 마케팅', value: 'PLANNING' },
  { label: '교육', value: 'EDUCATION' },
  { label: '연구 / 기술', value: 'RESEARCH' },
  { label: '제조 / 생산', value: 'MANUFACTURING' },
  { label: '서비스', value: 'SERVICE' },
  { label: '창업', value: 'STARTUP' },
  { label: '기타', value: 'OTHER' },
]

function formatBudget(budget: number | null, flexible: boolean) {
  if (flexible) return '상관없음'
  if (budget === 110) return '100만원 이상'
  return `${budget}만원`
}

function ProfilePage() {
  const { profile, updateProfile } = useUser()
  const [form, setForm] = useState<UserProfile>(profile)
  const [previousBudget, setPreviousBudget] = useState(profile.housingBudget ?? 50)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const toggleFlexibleBudget = () => {
    if (form.housingBudgetFlexible) {
      setForm({ ...form, housingBudget: previousBudget, housingBudgetFlexible: false })
      return
    }
    if (form.housingBudget !== null) setPreviousBudget(form.housingBudget)
    setForm({ ...form, housingBudget: null, housingBudgetFlexible: true })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isProfileComplete(form)) {
      setError('모든 항목을 선택해주세요.')
      return
    }
    setError('')
    updateProfile(form)
    navigate('/test')
  }

  return (
    <main className="profile-page">
      <header className="profile-service-header">
        <Link className="profile-logo" to="/" aria-label="여기살래? 홈"><span aria-hidden="true">🏠</span><strong>여기살래?</strong></Link>
      </header>

      <div className="profile-content">
        <header className="profile-intro">
          <span className="profile-badge"><i aria-hidden="true" />기본 정보</span>
          <h1>나에게 맞는 지역을<br />찾기 전에,<br />기본 정보를 알려주세요.</h1>
        </header>

        <form className="profile-form" onSubmit={handleSubmit} noValidate>
          <fieldset className="profile-question profile-question-first">
            <span className="profile-question-number">1</span>
            <legend>연령대를 선택해주세요.</legend>
            <div className="profile-option-list">
              {ageOptions.map((option) => (
                <button className={form.ageGroup === option.value ? 'profile-option selected' : 'profile-option'} key={option.value} type="button" aria-pressed={form.ageGroup === option.value} onClick={() => setForm({ ...form, ageGroup: option.value })}>{option.label}</button>
              ))}
            </div>
          </fieldset>

          <div className="profile-question">
            <span className="profile-question-number">2</span>
            <label className="profile-question-label" htmlFor="job-category">현재 직무를 선택해주세요.</label>
            <div className="profile-select-wrap">
              <select className="profile-select" id="job-category" value={form.jobCategory} onChange={(event) => setForm({ ...form, jobCategory: event.target.value as JobCategory })}>
                <option value="">직무를 선택해주세요</option>
                {jobOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          </div>

          <fieldset className="profile-question profile-budget">
            <span className="profile-question-number">3</span>
            <legend>월 주거비 예산은 어느 정도인가요?</legend>
            <output className="profile-budget-value" htmlFor="housing-budget">{formatBudget(form.housingBudget, form.housingBudgetFlexible)}</output>
            <input className="profile-budget-range" id="housing-budget" type="range" min="10" max="110" step="10" value={form.housingBudget ?? previousBudget} disabled={form.housingBudgetFlexible} onChange={(event) => setForm({ ...form, housingBudget: Number(event.target.value) })} />
            <div className="profile-range-labels"><span>10만원</span><span>100만원 이상</span></div>
            <label className="profile-flexible-option">
              <input type="checkbox" checked={form.housingBudgetFlexible} onChange={toggleFlexibleBudget} />
              <span>주거비는 상관없어요</span>
            </label>
          </fieldset>

          <fieldset className="profile-question">
            <span className="profile-question-number">4</span>
            <legend>자차를 보유하고 있나요?</legend>
            <div className="profile-car-options">
              <button className={form.hasCar === true ? 'profile-option selected' : 'profile-option'} type="button" aria-pressed={form.hasCar === true} onClick={() => setForm({ ...form, hasCar: true })}>보유하고 있어요</button>
              <button className={form.hasCar === false ? 'profile-option selected' : 'profile-option'} type="button" aria-pressed={form.hasCar === false} onClick={() => setForm({ ...form, hasCar: false })}>없어요</button>
            </div>
          </fieldset>

          {error && <p className="profile-error" role="alert">{error}</p>}
          <button className="profile-submit" type="submit">다음으로 <span aria-hidden="true">→</span></button>
        </form>
      </div>
    </main>
  )
}

export default ProfilePage
