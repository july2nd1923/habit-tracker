import { useEffect, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { supabase } from '../supabaseClient'

export default function NotesPage({ habits, initialHabitId, onConsumeInitial }) {
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (initialHabitId) {
      const h = habits.find((h) => h.id === initialHabitId)
      if (h) setSelected(h)
      onConsumeInitial?.()
    }
  }, [initialHabitId, habits, onConsumeInitial])

  if (habits.length === 0) {
    return (
      <div className="px-5 pt-16 text-center text-ink/40 text-sm">
        아직 등록된 할일이 없어요. 홈 탭에서 먼저 추가해주세요.
      </div>
    )
  }

  if (selected) {
    return <NoteEditor habit={selected} onBack={() => setSelected(null)} />
  }

  return (
    <div className="px-5 pt-6 pb-24 max-w-md mx-auto">
      <h1 className="font-display text-2xl text-ink mb-1">메모</h1>
      <p className="text-xs text-ink/40 mb-5">
        루틴이나 학습 자료를 마크다운으로 정리해두세요.
      </p>
      <div className="space-y-2.5">
        {habits.map((h) => (
          <button
            key={h.id}
            onClick={() => setSelected(h)}
            className="w-full bg-white rounded-xl2 shadow-soft border border-ink/5 p-4 flex items-center gap-3 text-left hover:shadow-card transition"
          >
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: h.color }}
            />
            <span className="font-display text-sm text-ink flex-1">{h.title}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3E3A36" strokeOpacity="0.3" strokeWidth="2">
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}

function NoteEditor({ habit, onBack }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('edit') // edit | preview
  const [status, setStatus] = useState('idle') // idle | saving | saved

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('habit_notes')
        .select('content')
        .eq('habit_id', habit.id)
        .maybeSingle()
      if (!cancelled) {
        setContent(data?.content || '')
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [habit.id])

  const save = useCallback(
    async (text) => {
      setStatus('saving')
      await supabase
        .from('habit_notes')
        .upsert({ habit_id: habit.id, content: text, updated_at: new Date().toISOString() }, { onConflict: 'habit_id' })
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 1200)
    },
    [habit.id]
  )

  // 자동 저장 (디바운스)
  useEffect(() => {
    if (loading) return
    const t = setTimeout(() => save(content), 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  return (
    <div className="px-5 pt-6 pb-24 max-w-md mx-auto flex flex-col" style={{ minHeight: '100vh' }}>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="text-ink/50 hover:text-ink transition p-1 -ml-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: habit.color }} />
        <h1 className="font-display text-lg text-ink flex-1">{habit.title}</h1>
        <button
          onClick={() => setMode(mode === 'edit' ? 'preview' : 'edit')}
          className="text-xs px-3 py-1.5 rounded-full border border-ink/10 text-ink/60 hover:bg-ink/5 transition"
        >
          {mode === 'edit' ? '미리보기' : '편집'}
        </button>
      </div>

      <div className="text-[11px] text-ink/30 mb-2 h-3">
        {status === 'saving' && '저장 중...'}
        {status === 'saved' && '저장됨'}
      </div>

      {loading ? (
        <div className="text-sm text-ink/30 text-center pt-10">불러오는 중...</div>
      ) : mode === 'edit' ? (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={`${habit.title} 관련 루틴, 학습 자료를 마크다운으로 적어보세요.\n\n예)\n## 운동 루틴\n- 스쿼트 3세트 x 12회\n- 플랭크 1분`}
          className="flex-1 min-h-[60vh] bg-white rounded-xl2 shadow-soft border border-ink/5 p-4 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-[#A3CBEA] resize-none font-body"
        />
      ) : (
        <div className="flex-1 min-h-[60vh] bg-white rounded-xl2 shadow-soft border border-ink/5 p-4 prose prose-sm max-w-none">
          {content.trim() ? (
            <ReactMarkdown>{content}</ReactMarkdown>
          ) : (
            <p className="text-ink/30 text-sm">아직 내용이 없어요.</p>
          )}
        </div>
      )}
    </div>
  )
}
