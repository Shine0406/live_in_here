import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { UserProfile } from '../types/user'
import type { Answers, Vector } from '../utils/recommendation_engine'

const STORAGE_KEY = 'yeogisallae-user'

export const INITIAL_PROFILE: UserProfile = {
  ageGroup: '',
  jobCategory: '',
  housingBudget: 50,
  housingBudgetFlexible: false,
  hasCar: null,
}

interface UserContextValue {
  profile: UserProfile
  answers: Answers
  userVector: Vector | null
  isHydrated: boolean
  updateProfile: (profile: UserProfile) => void
  resetDiagnosis: () => void
  resetAllUserInput: () => void
  setAnswer: (questionId: string, answer: Answers[string]) => void
  setUserVector: (vector: Vector) => void
}

const UserContext = createContext<UserContextValue | undefined>(undefined)

interface UserState {
  profile: UserProfile
  answers: Answers
  userVector: Vector | null
}

const initialState: UserState = { profile: INITIAL_PROFILE, answers: {}, userVector: null }

function loadState(): UserState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return initialState

    const parsed = JSON.parse(saved) as Partial<UserState> & Partial<UserProfile>
    if (parsed.profile) {
      return {
        profile: { ...INITIAL_PROFILE, ...parsed.profile },
        answers: parsed.answers ?? {},
        userVector: parsed.userVector ?? null,
      }
    }

    // 이전 버전에서 UserProfile만 저장한 데이터도 그대로 복구한다.
    return { profile: { ...INITIAL_PROFILE, ...parsed }, answers: {}, userVector: null }
  } catch {
    return initialState
  }
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UserState>(loadState)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  const saveState = (nextState: UserState) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
    return nextState
  }

  const updateProfile = (nextProfile: UserProfile) => {
    setState((previous) => saveState({ ...previous, profile: nextProfile }))
  }

  const resetDiagnosis = () => {
    setState((previous) => saveState({ ...previous, answers: {}, userVector: null }))
  }

  const resetAllUserInput = () => {
    setState(() => saveState({ profile: { ...INITIAL_PROFILE }, answers: {}, userVector: null }))
  }

  const setAnswer = (questionId: string, answer: Answers[string]) => {
    setState((previous) => saveState({
      ...previous,
      answers: { ...previous.answers, [questionId]: answer },
      userVector: null,
    }))
  }

  const setUserVector = (userVector: Vector) => {
    setState((previous) => saveState({ ...previous, userVector }))
  }

  return (
    <UserContext.Provider value={{ ...state, isHydrated, updateProfile, resetDiagnosis, resetAllUserInput, setAnswer, setUserVector }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)

  if (!context) throw new Error('useUser는 UserProvider 안에서 사용해야 합니다.')
  return context
}
