import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { yearMonthKey } from '../lib/dateUtils'

export default function HabitComments({ habitId, year, month, myId, canWrite = true }) {
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const ym = yearMonthKey(year, month)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('habit_comments')
      .select('*, author:author_id(display_name, friend_code)')
      .eq('habit_id', habitId)
      .eq('year_month', ym)
      .order('created_at', { ascending: true })
    setComments(data || [])
  }, [habitId, ym])

  useEffect(() => {
    load()
  }, [load])

  async function send(e) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || !myId) return
    setText('')
    await supabase.from('habit_comments').insert({
      habit_id: habitId,
      year_month: ym,
      author_id: myId,
      content: trimmed,
    })
    load()
  }

  async function remove(id) {
    await supabase.from('habit_comments').delete().eq('id', id)
    load()
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-[11px] text-ink/40 hover:text-ink/70 transition"
      >
        💬 댓글 {comments.length > 0 ? comments.length : ''} {open ? '접기' : '보기'}
      </button>

      {open && (
        <div className="mt-2 space-y-1.5">
          {comments.length === 0 && (
            <p className="text-[11px] text-ink/30">이 달의 첫 댓글을 남겨보세요.</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-1.5 text-xs">
              <span className="text-ink/50 shrink-0 font-medium">
                {c.author?.display_name || c.author?.friend_code || '?'}
              </span>
              <span className="text-ink/70 flex-1 break-words">{c.content}</span>
              {c.author_id === myId && (
                <button onClick={() => remove(c.id)} className="text-ink/25 hover:text-rose-400 transition shrink-0">
                  ×
                </button>
              )}
            </div>
          ))}
          {canWrite && (
            <form onSubmit={send} className="flex gap-1.5 pt-1">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="댓글 남기기..."
                className="flex-1 rounded-lg border border-ink/10 px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#A3CBEA]"
              />
              <button type="submit" className="rounded-lg px-3 py-1.5 text-xs bg-ink text-paper hover:opacity-90 transition">
                등록
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
