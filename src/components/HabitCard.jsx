import { useEffect, useMemo, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { daysInMonth, toDateStr, computeStreakWithRest, computeMonthStats, yearMonthKey } from '../lib/dateUtils'
import { supabase } from '../supabaseClient'
import HabitComments from './HabitComments'

const collapsedStore = {
  read() {
    try { return JSON.parse(localStorage.getItem('collapsed_habits') || '{}') } catch { return {} }
  },
  write(map) {
    try { localStorage.setItem('collapsed_habits', JSON.stringify(map)) } catch { /* ignore */ }
  },
}

export default function HabitCard({ habit, logs, pauses, year, month, today, myId, onToggle, onOpenNote, onToggleVisibility, onRefreshHabits }) {
  const [collapsed, setCollapsed] = useState(() => !!collapsedStore.read()[habit.id])
  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c
      const map = collapsedStore.read()
      if (next) map[habit.id] = true
      else delete map[habit.id]
      collapsedStore.write(map)
      return next
    })
  }
  const total = daysInMonth(year, month)
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month

  const doneDates = logs?.done || []
  const restDates = logs?.rest || []
  const doneSet = useMemo(() => new Set(doneDates), [doneDates])
  const restSet = useMemo(() => new Set(restDates), [restDates])

  const stats = useMemo(
    () => computeMonthStats(habit, doneDates, restDates, year, month, today, pauses),
    [habit, doneDates, restDates, year, month, today, pauses]
  )
  const { completed: completedThisMonth, restCount, pausedCount, percent, startDay, elapsedDays, isFullMonth, pausedSet } = stats

  const isPausedNow = useMemo(() => (pauses || []).some((p) => !p.end_date), [pauses])

  const days = Array.from({ length: total }, (_, i) => i + 1)

  const streak = useMemo(
    () => computeStreakWithRest(doneDates, restDates, year, month, today, startDay, pauses),
    [doneDates, restDates, year, month, today, startDay, pauses]
  )

  // 이번 달 100% 달성 순간 축하 효과
  const prevFullRef = useRef(isFullMonth)
  useEffect(() => {
    if (isCurrentMonth && isFullMonth && !prevFullRef.current) {
      confetti({ particleCount: 90, spread: 75, origin: { y: 0.7 } })
    }
    prevFullRef.current = isFullMonth
  }, [isFullMonth, isCurrentMonth])

  // 챌린지 진행 상황 (파트너와 겹친 날 / 거절·종료 상태)
  const [challengeInfo, setChallengeInfo] = useState(null)
  useEffect(() => {
    let cancelled = false
    if (!habit.challenge_id) {
      setChallengeInfo(null)
      return
    }
    async function load() {
      const { data: challenge } = await supabase
        .from('challenges')
        .select(
          '*, creator:creator_id(display_name, friend_code), partner:partner_id(display_name, friend_code)'
        )
        .eq('id', habit.challenge_id)
        .maybeSingle()
      if (!challenge || cancelled) return
      const iAmCreator = challenge.creator_habit_id === habit.id
      const partnerProfile = iAmCreator ? challenge.partner : challenge.creator
      const partnerName = partnerProfile?.display_name || partnerProfile?.friend_code || '상대'

      if (challenge.status === 'declined') {
        setChallengeInfo({ state: 'declined', partnerName, challengeId: challenge.id })
        return
      }
      if (challenge.status === 'ended') {
        setChallengeInfo({ state: 'ended', partnerName, challengeId: challenge.id })
        return
      }
      const partnerHabitId = iAmCreator ? challenge.partner_habit_id : challenge.creator_habit_id
      if (!partnerHabitId) {
        setChallengeInfo({ state: 'pending', partnerName, challengeId: challenge.id })
        return
      }
      const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const endDate = new Date(year, month + 1, 0).getDate()
      const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDate).padStart(2, '0')}`
      const { data: partnerLogs } = await supabase
        .from('habit_logs')
        .select('log_date')
        .eq('habit_id', partnerHabitId)
        .eq('status', 'done')
        .gte('log_date', start)
        .lte('log_date', end)
      if (cancelled) return
      const partnerSet = new Set((partnerLogs || []).map((l) => l.log_date))
      let overlap = 0
      for (let d = startDay; d <= elapsedDays; d++) {
        const ds = toDateStr(year, month, d)
        if (doneSet.has(ds) && partnerSet.has(ds)) overlap++
      }
      setChallengeInfo({ state: 'active', overlap, partnerName, challengeId: challenge.id })
    }
    load()
    return () => {
      cancelled = true
    }
  }, [habit.challenge_id, habit.id, year, month, doneSet, startDay, elapsedDays])

  async function convertToNormalHabit() {
    await supabase.from('habits').update({ challenge_id: null }).eq('id', habit.id)
    setChallengeInfo(null)
    onRefreshHabits?.()
  }

  async function leaveChallenge() {
    if (!confirm('챌린지를 그만할까요? 습관과 기록은 그대로 남고, 함께 보기만 종료돼요. 상대에게도 종료 안내가 표시돼요.')) return
    await supabase.from('challenges').update({ status: 'ended' }).eq('id', challengeInfo.challengeId)
    await supabase.from('habits').update({ challenge_id: null }).eq('id', habit.id)
    setChallengeInfo(null)
    onRefreshHabits?.()
  }

  // 친구들이 남긴 응원 (이번 달)
  const [reactions, setReactions] = useState([])
  useEffect(() => {
    let cancelled = false
    if (habit.visibility !== 'friends') {
      setReactions([])
      return
    }
    async function load() {
      const { data } = await supabase
        .from('habit_reactions')
        .select('emoji, reactor:reactor_id(display_name, friend_code)')
        .eq('habit_id', habit.id)
        .eq('year_month', yearMonthKey(year, month))
      if (!cancelled) setReactions(data || [])
    }
    load()
    return () => {
      cancelled = true
    }
  }, [habit.id, habit.visibility, year, month])

  // 오늘 날짜의 상태 (접힌 상태의 빠른 체크용)
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())
  const todayStatus = doneSet.has(todayStr) ? 'done' : restSet.has(todayStr) ? 'rest' : null
  const todayPaused = pausedSet.has(todayStr)

  if (collapsed) {
    return (
      <div className="bg-white rounded-xl2 shadow-soft border border-ink/5 px-4 py-3 flex items-center gap-2.5">
        <button onClick={toggleCollapsed} className="text-ink/30 hover:text-ink transition shrink-0" title="펼치기">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: habit.color }} />
        <span className="font-display text-sm text-ink flex-1 truncate">{habit.title}</span>
        {streak >= 2 && <span className="text-[11px] text-ink/45 shrink-0">🔥{streak}</span>}
        <span className="text-xs font-medium text-ink/60 shrink-0">{percent}%</span>
        {isCurrentMonth && !todayPaused && (
          <button
            onClick={() => onToggle(habit, todayStr, todayStatus)}
            className="w-7 h-7 rounded-md text-[11px] flex items-center justify-center transition hover:scale-105 shrink-0"
            style={
              todayStatus === 'done'
                ? { backgroundColor: habit.color, color: '#3E3A36' }
                : todayStatus === 'rest'
                ? { backgroundColor: '#fff', border: `2px solid ${habit.color}`, color: habit.color }
                : { backgroundColor: '#F3EFE8', color: '#B7B0A5' }
            }
            title="오늘 체크"
          >
            {todayStatus === 'rest' ? '💤' : todayStatus === 'done' ? '✓' : today.getDate()}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl2 shadow-soft border border-ink/5 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={toggleCollapsed} className="text-ink/30 hover:text-ink transition -ml-1" title="접기">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: habit.color }}
            />
            <h3 className="font-display text-base text-ink">{habit.title}</h3>
            {habit.challenge_id && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F3EFE8] text-ink/50">
                🤝 챌린지
              </span>
            )}
            {isPausedNow && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F3EFE8] text-ink/50">
                🌙 휴식중
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onToggleVisibility(habit)}
            className="text-ink/30 hover:text-ink/60 transition"
            title={habit.visibility === 'friends' ? '친구에게 공개 중 (클릭하면 비공개로)' : '비공개 (클릭하면 친구에게 공개)'}
          >
            {habit.visibility === 'friends' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="4" y="11" width="16" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 7.2-2.4" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="4" y="11" width="16" height="9" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" />
              </svg>
            )}
          </button>
          <button
            onClick={() => onOpenNote(habit)}
            className="text-ink/30 hover:text-ink/60 transition"
            title="메모 열기"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
              <path d="M14 3v5h5" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end">
              <PercentRing percent={percent} color={habit.color} />
              <span className="text-xs font-medium text-ink/60">{percent}%</span>
            </div>
          </div>
        </div>
      </div>

      {isFullMonth && (
        <div className="mb-3 text-center text-xs py-1.5 rounded-lg" style={{ backgroundColor: `${habit.color}30` }}>
          🏆 이번 달 완주! 대단해요
        </div>
      )}

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const dateStr = toDateStr(year, month, d)
          const isDone = doneSet.has(dateStr)
          const isRest = restSet.has(dateStr)
          const isPausedDay = pausedSet.has(dateStr)
          const status = isDone ? 'done' : isRest ? 'rest' : null
          const isFuture = isCurrentMonth && d > today.getDate()
          const isBeforeStart = d < startDay
          const disabled = isFuture || isBeforeStart || isPausedDay
          const cellStyle = isDone
            ? { backgroundColor: habit.color, color: '#3E3A36' }
            : isRest
            ? { backgroundColor: '#fff', border: `2px solid ${habit.color}`, color: habit.color }
            : { backgroundColor: '#F3EFE8', color: '#B7B0A5' }
          return (
            <button
              key={d}
              disabled={disabled}
              onClick={() => onToggle(habit, dateStr, status)}
              title={isPausedDay ? '휴식 기간' : isRest ? '쉬어가기' : undefined}
              className={`aspect-square rounded-md text-[11px] flex items-center justify-center transition ${
                disabled ? 'opacity-25 cursor-default' : 'hover:scale-105'
              }`}
              style={cellStyle}
            >
              {isPausedDay ? '🌙' : isRest ? '💤' : d}
            </button>
          )
        })}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink/40">
        <span>이번 달 {completedThisMonth}회 완료</span>
        {streak >= 2 && <span>🔥 {streak}일 연속</span>}
        {restCount > 0 && <span>💤 쉬어가기 {restCount}/5</span>}
        {pausedCount > 0 && <span>🌙 휴식 {pausedCount}일</span>}
      </div>

      {challengeInfo && (
        <div className="mt-2 text-[11px] text-ink/45 flex items-center justify-between gap-2 flex-wrap">
          {challengeInfo.state === 'pending' && (
            <span>{challengeInfo.partnerName}님의 수락을 기다리는 중이에요</span>
          )}
          {challengeInfo.state === 'active' && (
            <>
              <span>{challengeInfo.partnerName}님과 이번 달 같이 한 날 {challengeInfo.overlap}일</span>
              <button onClick={leaveChallenge} className="text-ink/30 hover:text-rose-400 transition underline underline-offset-2">
                챌린지 그만하기
              </button>
            </>
          )}
          {challengeInfo.state === 'declined' && (
            <>
              <span>{challengeInfo.partnerName}님이 초대를 거절했어요</span>
              <button onClick={convertToNormalHabit} className="text-ink/40 hover:text-ink transition underline underline-offset-2">
                일반 습관으로 계속하기
              </button>
            </>
          )}
          {challengeInfo.state === 'ended' && (
            <>
              <span>{challengeInfo.partnerName}님이 챌린지를 종료했어요</span>
              <button onClick={convertToNormalHabit} className="text-ink/40 hover:text-ink transition underline underline-offset-2">
                일반 습관으로 계속하기
              </button>
            </>
          )}
        </div>
      )}

      {reactions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {reactions.map((r, i) => (
            <span key={i} className="text-xs bg-[#F3EFE8] rounded-full px-2 py-0.5" title={r.reactor?.display_name || r.reactor?.friend_code}>
              {r.emoji}
            </span>
          ))}
        </div>
      )}

      {habit.visibility === 'friends' && (
        <HabitComments habitId={habit.id} year={year} month={month} myId={myId} />
      )}
    </div>
  )
}

function PercentRing({ percent, color }) {
  const r = 8
  const c = 2 * Math.PI * r
  const offset = c - (percent / 100) * c
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" className="-rotate-90">
      <circle cx="10" cy="10" r={r} stroke="#F3EFE8" strokeWidth="3" fill="none" />
      <circle
        cx="10"
        cy="10"
        r={r}
        stroke={color}
        strokeWidth="3"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  )
}
