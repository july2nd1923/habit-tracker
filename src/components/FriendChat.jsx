import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../supabaseClient'

const QUICK_MESSAGES = ['오늘도 화이팅! 💪', '잘하고 있어요 👏', '같이 힘내봐요 🔥', '대단해요! 🎉']

export default function FriendChat({ friendshipId, myId, friendName, onRead }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from('friend_messages')
      .select('*')
      .eq('friendship_id', friendshipId)
      .order('created_at', { ascending: true })
    setMessages(data || [])
    setLoading(false)
  }, [friendshipId])

  // 처음 열 때: 메시지 불러오고, 상대가 보낸 안읽은 메시지를 읽음 처리
  useEffect(() => {
    async function init() {
      await loadMessages()
      await supabase
        .from('friend_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('friendship_id', friendshipId)
        .neq('sender_id', myId)
        .is('read_at', null)
      onRead?.()
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendshipId, myId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages])

  async function send(content) {
    const trimmed = content.trim()
    if (!trimmed) return
    setText('')
    const optimistic = {
      id: `temp-${Date.now()}`,
      friendship_id: friendshipId,
      sender_id: myId,
      content: trimmed,
      read_at: null,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    await supabase.from('friend_messages').insert({
      friendship_id: friendshipId,
      sender_id: myId,
      content: trimmed,
    })
    loadMessages()
  }

  // 내가 보낸 메시지 중 마지막으로 읽힌 메시지 id (읽음 표시 위치)
  const lastReadMineId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.sender_id === myId && m.read_at) return m.id
    }
    return null
  })()

  return (
    <div className="bg-white rounded-xl2 shadow-soft border border-ink/5 p-4 mt-4">
      <p className="text-xs text-ink/50 mb-3">{friendName}님과의 메시지</p>

      <div className="max-h-64 overflow-y-auto flex flex-col gap-2 mb-3 pr-1">
        {loading ? (
          <p className="text-xs text-ink/30">불러오는 중...</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-ink/30">아직 메시지가 없어요. 응원 한마디 남겨보세요!</p>
        ) : (
          messages.map((m) => {
            const isMine = m.sender_id === myId
            return (
              <div key={m.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                <span
                  className={`text-sm px-3 py-1.5 rounded-2xl max-w-[75%] break-words ${
                    isMine ? 'bg-ink text-paper' : 'bg-[#F3EFE8] text-ink'
                  }`}
                >
                  {m.content}
                </span>
                {m.id === lastReadMineId && (
                  <span className="text-[10px] text-ink/30 mt-0.5">읽음</span>
                )}
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {QUICK_MESSAGES.map((q) => (
          <button
            key={q}
            onClick={() => send(q)}
            className="text-[11px] px-2.5 py-1 rounded-full border border-ink/10 text-ink/60 hover:bg-ink/5 transition"
          >
            {q}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(text)
        }}
        className="flex gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="메시지 입력..."
          className="flex-1 rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#A3CBEA]"
        />
        <button
          type="submit"
          className="rounded-lg px-4 py-2 text-sm bg-ink text-paper hover:opacity-90 transition"
        >
          전송
        </button>
      </form>
    </div>
  )
}
