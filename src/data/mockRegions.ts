import type { RegionEntry } from '../utils/recommendation_engine'

/**
 * UI 및 추천 파이프라인 테스트용 임시 지역 데이터.
 * 실제 공공데이터 기반 region_vectors.json이 준비되면 교체한다.
 * 아래 수치는 실제 통계값이 아니다.
 */
export const MOCK_REGIONS: RegionEntry[] = [
  {
    region: '강원특별자치도 춘천시',
    code: 'chuncheon',
    budgetProxy: 45,
    vector: { H: 80, T: 68, I: 72, C: 70, E: 95, J: 58 },
  },
  {
    region: '강원특별자치도 원주시',
    code: 'wonju',
    budgetProxy: 40,
    vector: { H: 84, T: 73, I: 78, C: 61, E: 86, J: 66 },
  },
  {
    region: '대전광역시 유성구',
    code: 'yuseong',
    budgetProxy: 70,
    vector: { H: 65, T: 88, I: 92, C: 83, E: 70, J: 92 },
  },
  {
    region: '충청북도 청주시 흥덕구',
    code: 'cheongju-heungdeok',
    budgetProxy: 55,
    vector: { H: 74, T: 78, I: 84, C: 68, E: 65, J: 81 },
  },
  {
    region: '충청남도 천안시 서북구',
    code: 'cheonan-seobuk',
    budgetProxy: 60,
    vector: { H: 70, T: 86, I: 82, C: 66, E: 60, J: 85 },
  },
  {
    region: '전북특별자치도 전주시 완산구',
    code: 'jeonju-wansan',
    budgetProxy: 38,
    vector: { H: 90, T: 65, I: 76, C: 88, E: 75, J: 59 },
  },
  {
    region: '경상북도 경산시',
    code: 'gyeongsan',
    budgetProxy: 35,
    vector: { H: 92, T: 70, I: 69, C: 62, E: 74, J: 67 },
  },
  {
    region: '경상남도 창원시 성산구',
    code: 'changwon-seongsan',
    budgetProxy: 65,
    vector: { H: 68, T: 75, I: 86, C: 72, E: 68, J: 90 },
  },
  {
    region: '광주광역시 북구',
    code: 'gwangju-buk',
    budgetProxy: 50,
    vector: { H: 78, T: 80, I: 87, C: 85, E: 64, J: 72 },
  },
  {
    region: '부산광역시 금정구',
    code: 'busan-geumjeong',
    budgetProxy: 80,
    vector: { H: 58, T: 91, I: 89, C: 90, E: 72, J: 83 },
  },
]
