// 파스텔 색상 팔레트 (스티커/마스킹테이프에서 영감을 받은 10가지)
export const PALETTE = [
  { name: '블러쉬', value: '#F0B7C4' },
  { name: '피치', value: '#F4C79B' },
  { name: '버터', value: '#EFDA96' },
  { name: '세이지', value: '#B3C99C' },
  { name: '민트', value: '#9FD9C4' },
  { name: '스카이', value: '#A3CBEA' },
  { name: '페리윙클', value: '#B4B9EA' },
  { name: '라벤더', value: '#C8ACDE' },
  { name: '모브', value: '#DCAAC0' },
  { name: '샌드', value: '#D3C0A0' },
]

export function daysInMonth(year, month) {
  // month: 0-indexed
  return new Date(year, month + 1, 0).getDate()
}

export function toDateStr(year, month, day) {
  const mm = String(month + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

export function formatMonthLabel(year, month) {
  return `${year}년 ${month + 1}월`
}

// 습관이 특정 연/월 화면에 보여야 하는지 판단
// (보관되지 않았다면 항상 표시, 보관됐다면 보관한 달까지만 표시)
export function isHabitVisibleInMonth(habit, year, month) {
  if (!habit.archived) return true
  if (!habit.archived_at) return true
  const [ay, am] = habit.archived_at.split('-').map(Number)
  if (year < ay) return true
  if (year > ay) return false
  return month + 1 <= am
}
