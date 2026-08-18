import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
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
  { label: 'IT/개발', value: 'IT' },
  { label: '디자인', value: 'DESIGN' },
  { label: '기획/마케팅', value: 'PLANNING' },
  { label: '교육', value: 'EDUCATION' },
  { label: '연구/기술', value: 'RESEARCH' },
  { label: '제조/생산', value: 'MANUFACTURING' },
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
      <header className="profile-header">
        <span className="service-name">여기살래?</span>
        <h1>나에게 맞는 지역을 찾기 전에<br />기본 정보를 알려주세요.</h1>
      </header>

      <form onSubmit={handleSubmit} noValidate>
        <fieldset>
          <legend>1. 연령대를 선택해주세요.</legend>
          <div className="choice-group">
            {ageOptions.map((option) => (
              <button
                className={form.ageGroup === option.value ? 'choice selected' : 'choice'}
                key={option.value}
                type="button"
                aria-pressed={form.ageGroup === option.value}
                onClick={() => setForm({ ...form, ageGroup: option.value })}
              >{option.label}</button>
            ))}
          </div>
        </fieldset>

        <div>
          <label className="field-label" htmlFor="job-category">2. 현재 직무를 선택해주세요.</label>
          <select
            id="job-category"
            value={form.jobCategory}
            onChange={(event) => setForm({ ...form, jobCategory: event.target.value as JobCategory })}
          >
            <option value="">직무를 선택해주세요</option>
            {jobOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend>3. 월 주거비 예산은 어느 정도인가요?</legend>
          <output className="budget-value" htmlFor="housing-budget">
            {formatBudget(form.housingBudget, form.housingBudgetFlexible)}
          </output>
          <input
            id="housing-budget"
            type="range"
            min="10"
            max="110"
            step="10"
            value={form.housingBudget ?? previousBudget}
            disabled={form.housingBudgetFlexible}
            onChange={(event) => setForm({ ...form, housingBudget: Number(event.target.value) })}
          />
          <div className="range-labels"><span>10만원</span><span>100만원 이상</span></div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.housingBudgetFlexible}
              onChange={toggleFlexibleBudget}
            />
            주거비는 상관없어요
          </label>
        </fieldset>

        <fieldset>
          <legend>4. 자차가 있나요?</legend>
          <div className="choice-group">
            <button className={form.hasCar === true ? 'choice selected' : 'choice'} type="button" aria-pressed={form.hasCar === true} onClick={() => setForm({ ...form, hasCar: true })}>있음</button>
            <button className={form.hasCar === false ? 'choice selected' : 'choice'} type="button" aria-pressed={form.hasCar === false} onClick={() => setForm({ ...form, hasCar: false })}>없음</button>
          </div>
        </fieldset>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="next-button" type="submit">다음 →</button>
      </form>
    </main>
  )
}

export default ProfilePage
