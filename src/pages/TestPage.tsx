import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { QUESTIONS, vectorizeAnswers } from '../utils/recommendation_engine'
import { wasReloadedAtPath } from '../utils/navigation'
import { isProfileComplete } from '../utils/profile'

function TestPage() {
  const { profile, answers, isHydrated, resetDiagnosis, setAnswer, setUserVector } = useUser()
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isAdvancing, setIsAdvancing] = useState(false)
  const isReload = useRef(wasReloadedAtPath('/test'))
  const reloadResetHandled = useRef(false)
  const [reloadResetComplete, setReloadResetComplete] = useState(!isReload.current)
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!isHydrated || !isReload.current || reloadResetHandled.current) return
    reloadResetHandled.current = true
    resetDiagnosis()
    setCurrentQuestionIndex(0)
    setReloadResetComplete(true)
  }, [isHydrated, resetDiagnosis])

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
  }, [])

  if (!isHydrated || !reloadResetComplete) return <main className="route-loading">저장된 정보를 불러오는 중...</main>
  if (!isProfileComplete(profile)) return <Navigate to="/profile" replace />

  const currentQuestion = QUESTIONS[currentQuestionIndex]
  const selectedAnswer = answers[currentQuestion.id]
  const isLastQuestion = currentQuestionIndex === QUESTIONS.length - 1
  const progress = QUESTIONS.length <= 1 ? 100 : Math.round((currentQuestionIndex / (QUESTIONS.length - 1)) * 100)

  const goForward = () => {
    if (!selectedAnswer || isAdvancing) return
    if (!isLastQuestion) {
      setCurrentQuestionIndex((index) => index + 1)
      return
    }
    const vector = vectorizeAnswers(answers)
    setUserVector(vector)
    navigate('/result')
  }

  const selectAnswer = (optionId: 'A' | 'B' | 'C' | 'D') => {
    if (isAdvancing) return
    const nextAnswers = { ...answers, [currentQuestion.id]: optionId }
    setAnswer(currentQuestion.id, optionId)
    setIsAdvancing(true)
    advanceTimer.current = setTimeout(() => {
      if (isLastQuestion) {
        setUserVector(vectorizeAnswers(nextAnswers))
        navigate('/result')
        return
      }
      setCurrentQuestionIndex((index) => index + 1)
      setIsAdvancing(false)
      advanceTimer.current = null
    }, 220)
  }

  return (
    <main className="test-page">
      <header className="test-header">
        <span className="test-logo"><span aria-hidden="true">🏠</span><strong>여기살래?</strong></span>
        <div className="test-progress-meta">
          <span><strong>{currentQuestionIndex + 1}</strong> <em>/ {QUESTIONS.length}</em></span>
          <span>{progress}%</span>
        </div>
        <div className="test-progress-track" role="progressbar" aria-label="진단 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="test-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <section className="test-question-card" aria-labelledby="question-title">
        <span className="test-question-number">{currentQuestion.id}</span>
        <h1 className="test-question-title" id="question-title">{currentQuestion.prompt}</h1>
        <div className="test-options">
          {currentQuestion.options.map((option) => {
            const isSelected = selectedAnswer === option.id
            return (
              <button key={option.id} className={isSelected ? 'test-option test-option-selected' : 'test-option'} type="button" aria-pressed={isSelected} disabled={isAdvancing} onClick={() => selectAnswer(option.id)}>
                <span>{option.label}</span>
                {isSelected && <span className="test-option-check" aria-hidden="true">✓</span>}
              </button>
            )
          })}
        </div>
      </section>

      <nav className="test-navigation" aria-label="진단 문항 이동">
        <button className="test-prev-button" type="button" disabled={currentQuestionIndex === 0 || isAdvancing} onClick={() => setCurrentQuestionIndex((index) => index - 1)}>← 이전</button>
        <button className="test-next-button" type="button" disabled={!selectedAnswer || isAdvancing} onClick={goForward}>{isLastQuestion ? '결과 보기 →' : '다음 →'}</button>
      </nav>
    </main>
  )
}

export default TestPage
