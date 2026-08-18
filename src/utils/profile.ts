import type { UserProfile } from '../types/user'
import type { BasicInfo } from './recommendation_engine'

export function isProfileComplete(profile: UserProfile): profile is UserProfile & { hasCar: boolean } {
  return (
    profile.ageGroup !== '' &&
    profile.jobCategory !== '' &&
    (profile.housingBudget !== null || profile.housingBudgetFlexible) &&
    profile.hasCar !== null
  )
}

export function toBasicInfo(profile: UserProfile & { hasCar: boolean }): BasicInfo {
  return {
    ageGroup: profile.ageGroup,
    jobField: profile.jobCategory,
    budgetMax: profile.housingBudgetFlexible || profile.housingBudget === 110
      ? Infinity
      : profile.housingBudget ?? Infinity,
    hasCar: profile.hasCar,
  }
}
