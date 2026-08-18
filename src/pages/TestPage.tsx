import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { QUESTIONS, vectorizeAnswers } from '../utils/recommendation_engine'
import { isProfileComplete } from '../utils/profile'

function TestPage() {
  const { profile, answers, isHydrated, setAnswer, setUserVector } = useUser()
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const navigate = useNavigate()

  if (!isHydrated) return <main className="route-loading">저장된 정보를 불러오는 중...</main>
  if (!isProfileComplete(profile)) return <Navigate to="/profile" replace />

  const currentQuestion = QUESTIONS[currentQuestionIndex]
  const selectedAnswer = answers[currentQuestion.id]
  const isLastQuestion = currentQuestionIndex === QUESTIONS.length - 1
  const progress = ((currentQuestionIndex + 1) / QUESTIONS.length) * 100

  const goForward = () => {
    if (!selectedAnswer) return
    if (!isLastQuestion) {
      setCurrentQuestionIndex((index) => index + 1)
      return
    }

    const vector = vectorizeAnswers(answers)
    setUserVector(vector)
    navigate('/result')
  }

  return (
    <main className="test-page">
      <header className="test-header">
        <span className="service-name">여기살래?</span>
        <div className="test-progress-label">
          <span>{currentQuestionIndex + 1} / {QUESTIONS.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="test-progress" aria-label={`진단 진행률 ${Math.round(progress)}%`}>
          <div className="test-progress-value" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <section className="question-panel" aria-labelledby="question-title">
        <span className="question-number">{currentQuestion.id}</span>
        <h1 id="question-title">{currentQuestion.prompt}</h1>
        <div className="answer-list">
          {currentQuestion.options.map((option) => {
            const isSelected = selectedAnswer === option.id
            return (
              <button
                key={option.id}
                className={isSelected ? 'answer-card selected' : 'answer-card'}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setAnswer(currentQuestion.id, option.id)}
              >
                <span>{option.label}</span>
                {isSelected && <span aria-hidden="true">✓</span>}
              </button>
            )
          })}
        </div>
      </section>

      <nav className="test-navigation" aria-label="진단 문항 이동">
        <button
          className="previous-button"
          type="button"
          disabled={currentQuestionIndex === 0}
          onClick={() => setCurrentQuestionIndex((index) => index - 1)}
        >← 이전</button>
        <button className="next-button" type="button" disabled={!selectedAnswer} onClick={goForward}>
          {isLastQuestion ? '결과 보기' : '다음 →'}
        </button>
      </nav>
    </main>
  )
}

export default TestPage
