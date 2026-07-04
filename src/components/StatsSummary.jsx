import { useMemo } from 'react'
import { computeMonthStats, computeStreakWithRest } from '../lib/dateUtils'

export default function StatsSummary({ habits, logsByHabit, pausesByHabit = {}, year, month, today }) {
  const { avgPercent, bestStreak, mostConsistent } = useMemo(() => {
    if (habits.length === 0) {
      return { avgPercent: 0, bestStreak: 0, mostConsistent: null }
    }
    let percentSum = 0
    let counted = 0
    let maxStreak = 0
    let best = null

    for (const h of habits) {
      const logs = logsByHabit[h.id] || { done: [], rest: [] }
      const pauses = pausesByHabit[h.id] || []
      const stats = computeMonthStats(h, logs.done, logs.rest, year, month, today, pauses)
      if (stats.daysCounted > 0) {
        percentSum += stats.percent
        counted++
      }
      const streak = computeStreakWithRest(logs.done, logs.rest, year, month, today, stats.startDay, pauses)
      if (streak > maxStreak) maxStreak = streak
      if (!best || stats.percent > best.percent) {
        best = { title: h.title, color: h.color, percent: stats.percent }
      }
    }

    return {
      avgPercent: counted > 0 ? Math.round(percentSum / counted) : 0,
      bestStreak: maxStreak,
      mostConsistent: best,
    }
  }, [habits, logsByHabit, pausesByHabit, year, month, today])

  return (
    <div className="grid grid-cols-3 gap-2 mb-5">
      <div className="bg-white rounded-xl border border-ink/5 shadow-soft px-2.5 py-3 text-center">
        <p className="text-lg font-display text-ink">{avgPercent}%</p>
        <p className="text-[10px] text-ink/40 mt-0.5 leading-tight">이번 달<br />평균 달성률</p>
      </div>
      <div className="bg-white rounded-xl border border-ink/5 shadow-soft px-2.5 py-3 text-center">
        <p className="text-lg font-display text-ink">{bestStreak > 0 ? `🔥 ${bestStreak}` : '-'}</p>
        <p className="text-[10px] text-ink/40 mt-0.5 leading-tight">이번 달<br />최고 연속 기록</p>
      </div>
      <div className="bg-white rounded-xl border border-ink/5 shadow-soft px-2.5 py-3 text-center">
        {mostConsistent ? (
          <>
            <p className="text-sm font-display text-ink truncate flex items-center justify-center gap-1">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: mostConsistent.color }} />
              {mostConsistent.title}
            </p>
            <p className="text-[10px] text-ink/40 mt-0.5 leading-tight">가장 꾸준한 습관</p>
          </>
        ) : (
          <p className="text-xs text-ink/30">-</p>
        )}
      </div>
    </div>
  )
}
