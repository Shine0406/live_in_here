export type AgeGroup = '20-24' | '25-29' | '30-34' | '35-39' | '40+'

export type JobCategory =
  | 'IT'
  | 'DESIGN'
  | 'PLANNING'
  | 'EDUCATION'
  | 'RESEARCH'
  | 'MANUFACTURING'
  | 'SERVICE'
  | 'STARTUP'
  | 'OTHER'

export interface UserProfile {
  ageGroup: AgeGroup | ''
  jobCategory: JobCategory | ''
  housingBudget: number | null
  housingBudgetFlexible: boolean
  hasCar: boolean | null
}
