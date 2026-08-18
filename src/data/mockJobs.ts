import type { JobCategory } from '../types/user'

// DEMO ONLY
// 실제 고용24/Worknet API 연결 전 시연용 채용공고.
// 추천 알고리즘에는 사용하지 않는다.
export interface MockJobPosting {
  id: string
  regionName: string
  companyName: string
  title: string
  employmentType: string
  location: string
  deadline: string
  jobCategory: JobCategory
}

export const MOCK_JOBS: MockJobPosting[] = [
  { id: 'yuseong-1', regionName: '대전광역시 유성구', companyName: '유성AI랩', title: 'AI 서비스 프론트엔드 개발자', employmentType: '정규직', location: '대전 유성구', deadline: '2026.09.18', jobCategory: 'IT' },
  { id: 'yuseong-2', regionName: '대전광역시 유성구', companyName: '대전디지털연구소', title: '데이터 플랫폼 연구원', employmentType: '정규직', location: '대전 유성구', deadline: '2026.09.25', jobCategory: 'RESEARCH' },
  { id: 'yuseong-3', regionName: '대전광역시 유성구', companyName: '유성소프트웨어랩', title: '웹 서비스 기획자', employmentType: '계약직', location: '대전 유성구', deadline: '2026.10.02', jobCategory: 'PLANNING' },
  { id: 'mokpo-1', regionName: '전남광주통합특별시 목포시', companyName: '목포디지털랩', title: '지역 플랫폼 웹 개발자', employmentType: '정규직', location: '전남 목포시', deadline: '2026.09.20', jobCategory: 'IT' },
  { id: 'mokpo-2', regionName: '전남광주통합특별시 목포시', companyName: '목포콘텐츠스튜디오', title: '로컬 콘텐츠 디자이너', employmentType: '정규직', location: '전남 목포시', deadline: '2026.09.28', jobCategory: 'DESIGN' },
  { id: 'mokpo-3', regionName: '전남광주통합특별시 목포시', companyName: '남도소프트웨어랩', title: '서비스 운영·기획 매니저', employmentType: '계약직', location: '전남 목포시', deadline: '2026.10.05', jobCategory: 'PLANNING' },
  { id: 'seongnam-1', regionName: '경기도 성남시', companyName: '성남클라우드랩', title: '클라우드 백엔드 개발자', employmentType: '정규직', location: '경기 성남시', deadline: '2026.09.22', jobCategory: 'IT' },
  { id: 'seongnam-2', regionName: '경기도 성남시', companyName: '분당서비스디자인', title: '모바일 프로덕트 디자이너', employmentType: '정규직', location: '경기 성남시', deadline: '2026.09.30', jobCategory: 'DESIGN' },
  { id: 'seongnam-3', regionName: '경기도 성남시', companyName: '성남그로스센터', title: '디지털 마케팅 기획자', employmentType: '계약직', location: '경기 성남시', deadline: '2026.10.08', jobCategory: 'PLANNING' },
  { id: 'suwon-1', regionName: '경기도 수원시', companyName: '수원테크워크스', title: '웹 애플리케이션 개발자', employmentType: '정규직', location: '경기 수원시', deadline: '2026.09.19', jobCategory: 'IT' },
  { id: 'suwon-2', regionName: '경기도 수원시', companyName: '광교리서치랩', title: '서비스 기술 연구원', employmentType: '정규직', location: '경기 수원시', deadline: '2026.09.27', jobCategory: 'RESEARCH' },
  { id: 'suwon-3', regionName: '경기도 수원시', companyName: '수원러닝스튜디오', title: '교육 콘텐츠 운영자', employmentType: '계약직', location: '경기 수원시', deadline: '2026.10.04', jobCategory: 'EDUCATION' },
  { id: 'goyang-1', regionName: '경기도 고양시', companyName: '고양미디어랩', title: '콘텐츠 플랫폼 개발자', employmentType: '정규직', location: '경기 고양시', deadline: '2026.09.21', jobCategory: 'IT' },
  { id: 'goyang-2', regionName: '경기도 고양시', companyName: '일산크리에이티브', title: '브랜드 콘텐츠 디자이너', employmentType: '정규직', location: '경기 고양시', deadline: '2026.09.29', jobCategory: 'DESIGN' },
  { id: 'goyang-3', regionName: '경기도 고양시', companyName: '고양로컬파트너스', title: '지역 서비스 운영 매니저', employmentType: '계약직', location: '경기 고양시', deadline: '2026.10.06', jobCategory: 'SERVICE' },
]

export function getMockJobs(regionName: string, preferredCategory: string): MockJobPosting[] {
  return MOCK_JOBS
    .filter((job) => job.regionName === regionName)
    .sort((a, b) => Number(b.jobCategory === preferredCategory) - Number(a.jobCategory === preferredCategory))
}
