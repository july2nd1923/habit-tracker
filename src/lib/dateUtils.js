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
// (만든 달 이전엔 표시 안 함, 보관되지 않았다면 그 뒤로는 항상 표시, 보관됐다면 보관한 달까지만 표시)
export function isHabitVisibleInMonth(habit, year, month) {
  if (habit.created_at) {
    const created = new Date(habit.created_at)
    const cy = created.getFullYear()
    const cm = created.getMonth() // 0-indexed
    if (year < cy || (year === cy && month < cm)) return false
  }
  if (!habit.archived) return true
  if (!habit.archived_at) return true
  const [ay, am] = habit.archived_at.split('-').map(Number)
  if (year < ay) return true
  if (year > ay) return false
  return month + 1 <= am
}

// 이번 달 안에서, 오늘부터 거꾸로 이어지는 연속 체크 일수
export function computeStreak(logDates, year, month, today, startDay = 1) {
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
  if (!isCurrentMonth) return 0
  const set = new Set(logDates)
  let count = 0
  for (let d = today.getDate(); d >= startDay; d--) {
    if (set.has(toDateStr(year, month, d))) count++
    else break
  }
  return count
}

// 휴식(pause) 기간에 해당하는 이 달의 날짜들을 Set으로 반환
export function buildPausedSet(pauses, year, month, today) {
  const set = new Set()
  const total = daysInMonth(year, month)
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
  const lastDay = isCurrentMonth ? today.getDate() : total
  for (const p of pauses || []) {
    const start = new Date(p.start_date + 'T00:00:00')
    const end = p.end_date ? new Date(p.end_date + 'T00:00:00') : null
    for (let d = 1; d <= lastDay; d++) {
      const cur = new Date(year, month, d)
      if (cur >= start && (end === null || cur <= end)) {
        set.add(toDateStr(year, month, d))
      }
    }
  }
  return set
}

// 쉬어가기/휴식 날은 건너뛰고(끊기지 않되 카운트도 안 됨) 연속 기록 계산
export function computeStreakWithRest(doneDates, restDates, year, month, today, startDay = 1, pauses = []) {
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
  if (!isCurrentMonth) return 0
  const doneSet = new Set(doneDates)
  const restSet = new Set(restDates)
  const pausedSet = buildPausedSet(pauses, year, month, today)
  let count = 0
  for (let d = today.getDate(); d >= startDay; d--) {
    const ds = toDateStr(year, month, d)
    if (doneSet.has(ds)) count++
    else if (restSet.has(ds) || pausedSet.has(ds)) continue
    else break
  }
  return count
}

// 달 성취율 계산 (쉬어가기/휴식 날은 분모/분자 모두에서 제외)
// 습관을 만든 달은 1일부터 전부 열려있음 (일 단위 잠금 없음)
export function computeMonthStats(habit, doneDates, restDates, year, month, today, pauses = []) {
  const total = daysInMonth(year, month)
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
  const elapsedDays = isCurrentMonth ? today.getDate() : total

  const startDay = 1

  const doneSet = new Set(doneDates)
  const restSet = new Set(restDates)
  const pausedSet = buildPausedSet(pauses, year, month, today)

  let completed = 0
  let restCount = 0
  let pausedCount = 0
  for (let d = startDay; d <= elapsedDays; d++) {
    const ds = toDateStr(year, month, d)
    if (pausedSet.has(ds)) pausedCount++
    else if (doneSet.has(ds)) completed++
    else if (restSet.has(ds)) restCount++
  }
  const daysCounted = Math.max(elapsedDays - startDay + 1 - restCount - pausedCount, 0)
  const percent = daysCounted > 0 ? Math.round((completed / daysCounted) * 100) : 0
  const isFullMonth = daysCounted > 0 && completed === daysCounted
  return { completed, restCount, pausedCount, daysCounted, percent, startDay, elapsedDays, isFullMonth, pausedSet }
}

export function yearMonthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}
