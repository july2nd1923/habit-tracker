import { useEffect, useMemo, useState } from 'react'
import confetti from 'canvas-confetti'
import { computeMonthStats, yearMonthKey } from '../lib/dateUtils'
import { supabase } from '../supabaseClient'
import HabitComments from './HabitComments'

const REACTION_EMOJIS = ['👏', '🔥', '🎉']

export default function FriendHabitRow({ habit, logs, pauses = [], year, month, today, myId }) {
  const doneDates = logs?.done || []
  const restDates = logs?.rest || []
  const { completed: completedThisMonth, percent, isFullMonth } = useMemo(
    () => computeMonthStats(habit, doneDates, restDates, year, month, today, pauses),
    [habit, doneDates, restDates, year, month, today, pauses]
  )

  const [myReaction, setMyReaction] = useState(null)
  const ym = yearMonthKey(year, month)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!myId) return
      const { data } = await supabase
        .from('habit_reactions')
        .select('emoji')
        .eq('habit_id', habit.id)
        .eq('year_month', ym)
        .eq('reactor_id', myId)
        .maybeSingle()
      if (!cancelled) setMyReaction(data?.emoji || null)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [habit.id, ym, myId])

  async function sendReaction(emoji) {
    const next = myReaction === emoji ? null : emoji
    setMyReaction(next)
    if (next) {
      await supabase
        .from('habit_reactions')
        .upsert(
          { habit_id: habit.id, year_month: ym, reactor_id: myId, emoji: next },
          { onConflict: 'habit_id,year_month,reactor_id' }
        )
    } else {
      await supabase
        .from('habit_reactions')
        .delete()
        .eq('habit_id', habit.id)
        .eq('year_month', ym)
        .eq('reactor_id', myId)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-ink/5 shadow-soft px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: habit.color }} />
          <span className="text-sm text-ink">{habit.title}</span>
          {habit.challenge_id && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F3EFE8] text-ink/50" title="누군가와 함께하는 챌린지예요">
              🤝
            </span>
          )}
        </div>
        <span className="text-xs text-ink/50">{percent}% · {completedThisMonth}회</span>
      </div>
      <div className="h-1.5 rounded-full bg-[#F3EFE8] overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${percent}%`, backgroundColor: habit.color }}
        />
      </div>
      {isFullMonth && (
        <div className="mb-2 flex items-center justify-between text-xs rounded-lg px-2.5 py-1.5" style={{ backgroundColor: `${habit.color}30` }}>
          <span>🏆 이번 달 완주!</span>
          <button
            onClick={() => {
              sendReaction('🎉')
              confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } })
            }}
            className="px-2 py-0.5 rounded-full bg-white/70 hover:bg-white transition"
          >
            🎉 축하하기
          </button>
        </div>
      )}
      <div className="flex gap-1.5">
        {REACTION_EMOJIS.map((e) => (
          <button
            key={e}
            onClick={() => sendReaction(e)}
            className={`text-sm px-2 py-0.5 rounded-full border transition ${
              myReaction === e ? 'border-ink/30 bg-[#F3EFE8]' : 'border-ink/10 hover:bg-ink/5'
            }`}
          >
            {e}
          </button>
        ))}
      </div>

      <HabitComments habitId={habit.id} year={year} month={month} myId={myId} />
    </div>
  )
}
