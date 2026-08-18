import { useParams } from 'react-router-dom'

function RegionDetailPage() {
  const { id } = useParams<{ id: string }>()

  return <h1>지역 상세: {id}</h1>
}

export default RegionDetailPage
