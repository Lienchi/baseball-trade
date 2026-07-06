'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime } from '@/lib/utils'
import { ShieldCheck } from 'lucide-react'
import type { Comment } from '@/types'

interface Props {
  listingId: string
}

export function CommentSection({ listingId }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [comments, setComments] = useState<Comment[]>([])
  const [content, setContent] = useState('')
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchComments = async () => {
      const { data } = await supabase
        .from('comments')
        .select('*, profile:profiles(id, username, avatar_url, is_admin)')
        .eq('listing_id', listingId)
        .is('parent_id', null)
        .order('created_at', { ascending: true })
      if (data) setComments(data as Comment[])
    }
    fetchComments()

    const channel = supabase
      .channel(`comments:${listingId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'comments',
        filter: `listing_id=eq.${listingId}`,
      }, () => fetchComments())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [listingId, supabase])

  const handleSubmit = async () => {
    if (!content.trim()) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    await supabase.from('comments').insert({
      listing_id: listingId,
      user_id: user.id,
      content: content.trim(),
      parent_id: replyTo?.id ?? null,
    })

    setContent('')
    setReplyTo(null)
    setLoading(false)
  }

  return (
    <div className="mt-8">
      <h2 className="font-display text-base text-scoreboard">
        留言 ({comments.length})
      </h2>

      <div className="mt-4">
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 text-xs text-dugout">
            <span>回覆 @{replyTo.profile?.username}</span>
            <button onClick={() => setReplyTo(null)} className="text-clay hover:underline">
              取消
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            className="input flex-1 resize-none"
            rows={2}
            placeholder="留下你的問題或評論..."
            value={content}
            onChange={e => setContent(e.target.value)}
          />
          <button
            className="btn-primary self-end px-3 py-2"
            onClick={handleSubmit}
            disabled={loading || !content.trim()}
          >
            送出
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {comments.map(comment => (
          <CommentItem key={comment.id} comment={comment} onReply={setReplyTo} />
        ))}
      </div>
    </div>
  )
}

function CommentItem({
  comment,
  onReply,
}: {
  comment: Comment
  onReply: (c: Comment) => void
}) {
  const supabase = createClient()
  const [replies, setReplies] = useState<Comment[]>([])
  const [showReplies, setShowReplies] = useState(false)

  const loadReplies = async () => {
    if (showReplies) { setShowReplies(false); return }
    const { data } = await supabase
      .from('comments')
      .select('*, profile:profiles(id, username, avatar_url, is_admin)')
      .eq('parent_id', comment.id)
      .order('created_at')
    if (data) setReplies(data as Comment[])
    setShowReplies(true)
  }

  return (
    <div className="flex gap-3">
      {/* 管理員：盾牌 icon + 品牌色名稱＋徽章，跟一般用戶區隔 */}
      {comment.profile?.is_admin ? (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-field text-white">
          <ShieldCheck size={16} />
        </div>
      ) : (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-dugout/15 text-xs font-bold text-dugout">
          {comment.profile?.username.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="flex-1">
        <div className="rounded-md bg-dugout/5 px-3 py-2">
          <span className={`text-xs font-semibold ${comment.profile?.is_admin ? 'text-field dark:text-blue-400' : 'text-scoreboard'}`}>
            {comment.profile?.username}
            {comment.profile?.is_admin && (
              <span className="ml-1 rounded-sm bg-field/10 px-1 py-0.5 text-[10px] font-bold text-field dark:bg-blue-400/15 dark:text-blue-400">
                管理員
              </span>
            )}
          </span>
          <p className="mt-0.5 text-sm text-dugout">{comment.content}</p>
        </div>
        <div className="mt-1 flex gap-3 text-xs text-dugout/70">
          <span>{formatRelativeTime(comment.created_at)}</span>
          <button className="hover:text-clay" onClick={() => onReply(comment)}>
            回覆
          </button>
          <button className="hover:text-scoreboard" onClick={loadReplies}>
            {showReplies ? '收起' : '查看回覆'}
          </button>
        </div>

        {showReplies && replies.map(reply => (
          <div key={reply.id} className="ml-4 mt-2 flex gap-2">
            {reply.profile?.is_admin ? (
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-field text-white">
                <ShieldCheck size={12} />
              </div>
            ) : (
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-dugout/15 text-xs font-bold text-dugout">
                {reply.profile?.username.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="rounded-md bg-dugout/5 px-3 py-1.5">
              <span className={`text-xs font-semibold ${reply.profile?.is_admin ? 'text-field dark:text-blue-400' : 'text-scoreboard'}`}>
                {reply.profile?.username}
                {reply.profile?.is_admin && (
                  <span className="ml-1 rounded-sm bg-field/10 px-1 py-0.5 text-[10px] font-bold text-field dark:bg-blue-400/15 dark:text-blue-400">
                    管理員
                  </span>
                )}
              </span>
              <p className="text-xs text-dugout">{reply.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
