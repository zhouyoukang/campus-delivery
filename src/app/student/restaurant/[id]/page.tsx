import RestaurantClient from './client'

export function generateStaticParams() {
  return ['rest1','rest2','rest3','rest4','rest5','rest6'].map(id => ({ id }))
}

export default function RestaurantPage({ params }: { params: { id: string } }) {
  return <RestaurantClient id={params.id} />
}
