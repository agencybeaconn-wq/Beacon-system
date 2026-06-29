import { useState } from 'react';
import { Send, ThumbsUp, MessageSquare, Trash2, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAcademyContext } from '@/contexts/AcademyContext';
import { useAcademyComments, fakeCommentsFor, AcademyComment } from '@/hooks/useAcademyComments';

interface Props {
  lessonId: string;
  isPreview?: boolean; // se true, post só mostra toast (não grava)
  onPreviewPost?: () => void;
}

export function CommentsSection({ lessonId, isPreview = false, onPreviewPost }: Props) {
  const { student, isAdmin } = useAcademyContext();
  const { comments, loading, post, toggleLike, remove } = useAcademyComments(isPreview ? null : lessonId);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const totalCount = comments.reduce((s, c) => s + 1 + (c.replies?.length || 0), 0);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    if (isPreview) { onPreviewPost?.(); setNewComment(''); return; }
    setSubmitting(true);
    const ok = await post(newComment);
    setSubmitting(false);
    if (ok) setNewComment('');
  };

  // Se é preview E não tem comments do banco, mostra pool fake
  const fakesToShow = isPreview ? fakeCommentsFor(lessonId, 3) : [];

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-primary mb-2">
            Interação
          </p>
          <h2 className="text-xl md:text-2xl font-extrabold tracking-[-0.02em] leading-tight">
            Dúvidas e comentários
          </h2>
        </div>
        <span className="text-xs text-muted-foreground font-light pb-1">
          {isPreview ? fakesToShow.length : totalCount} comentários
        </span>
      </div>

      {/* Form */}
      <div className="flex gap-3 mb-8">
        <Avatar className="h-9 w-9 flex-shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
            {student?.full_name?.substring(0, 2).toUpperCase() || 'VC'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <Textarea
            placeholder="Deixe sua dúvida ou comentário sobre esta aula…"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
            className="rounded-xl font-light resize-none"
            disabled={submitting}
          />
          <div className="flex justify-end mt-2">
            <Button
              size="sm"
              disabled={!newComment.trim() || submitting}
              onClick={handleSubmit}
              className="rounded-lg font-bold tracking-tight gap-1.5"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {submitting ? 'Enviando...' : 'Enviar'}
            </Button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      )}

      {/* Preview mode: mostra fakes */}
      {isPreview && fakesToShow.length > 0 && (
        <ul className="space-y-5">
          {fakesToShow.map((c, i) => (
            <li key={i} className="flex gap-3">
              <Avatar className="h-9 w-9 flex-shrink-0">
                <AvatarFallback className="bg-muted text-muted-foreground text-xs font-bold">
                  {c.initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold tracking-tight">{c.author}</span>
                  <span className="text-[11px] text-muted-foreground font-light">{c.time}</span>
                </div>
                <p className="text-sm text-muted-foreground font-light leading-relaxed mb-2">{c.body}</p>
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1 font-bold tracking-tight"><ThumbsUp className="w-3.5 h-3.5" />{c.likes}</span>
                  <span className="flex items-center gap-1 font-bold tracking-tight"><MessageSquare className="w-3.5 h-3.5" />Responder</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Real mode: comments do banco + fakes populando se vazio */}
      {!isPreview && !loading && (
        <ul className="space-y-5">
          {/* Se não tem nenhum real, popula com 3 fakes seedados (apenas visual) */}
          {comments.length === 0 && fakeCommentsFor(lessonId, 3).map((c, i) => (
            <li key={'fake-' + i} className="flex gap-3 opacity-85">
              <Avatar className="h-9 w-9 flex-shrink-0">
                <AvatarFallback className="bg-muted text-muted-foreground text-xs font-bold">
                  {c.initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold tracking-tight">{c.author}</span>
                  <span className="text-[11px] text-muted-foreground font-light">{c.time}</span>
                </div>
                <p className="text-sm text-muted-foreground font-light leading-relaxed mb-2">{c.body}</p>
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1 font-bold tracking-tight"><ThumbsUp className="w-3.5 h-3.5" />{c.likes}</span>
                </div>
              </div>
            </li>
          ))}

          {/* Reais */}
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              onLike={(id, liked) => toggleLike(id, liked)}
              onReply={async (parentId, body) => { await post(body, parentId); }}
              onRemove={remove}
              canModerate={isAdmin}
              currentStudentId={student?.id}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CommentItem({
  comment, onLike, onReply, onRemove, canModerate, currentStudentId,
}: {
  comment: AcademyComment;
  onLike: (id: string, liked: boolean) => void;
  onReply: (parentId: string, body: string) => Promise<void>;
  onRemove: (id: string) => void;
  canModerate: boolean;
  currentStudentId?: string;
}) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isAuthor = comment.student_id === currentStudentId;
  const timeAgo = relativeTime(comment.created_at);

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    await onReply(comment.id, replyText);
    setSubmitting(false);
    setReplyText(''); setReplying(false);
  };

  return (
    <li className="flex gap-3">
      <Avatar className="h-9 w-9 flex-shrink-0">
        <AvatarFallback className="bg-muted text-muted-foreground text-xs font-bold">
          {(comment.author_name || 'AL').substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-bold tracking-tight">{comment.author_name}</span>
          <span className="text-[11px] text-muted-foreground font-light">{timeAgo}</span>
        </div>
        <p className="text-sm text-muted-foreground font-light leading-relaxed mb-2 whitespace-pre-wrap">
          {comment.body}
        </p>
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <button
            onClick={() => onLike(comment.id, !!comment.liked_by_me)}
            className={cn(
              'flex items-center gap-1 font-bold tracking-tight transition-colors',
              comment.liked_by_me ? 'text-primary' : 'hover:text-primary'
            )}
          >
            <ThumbsUp className={cn('w-3.5 h-3.5', comment.liked_by_me && 'fill-primary')} />
            {comment.likes_count || 0}
          </button>
          <button
            onClick={() => setReplying(v => !v)}
            className="flex items-center gap-1 font-bold tracking-tight hover:text-primary transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Responder
          </button>
          {(canModerate || isAuthor) && (
            <button
              onClick={() => { if (confirm('Remover este comentário?')) onRemove(comment.id); }}
              className="flex items-center gap-1 font-bold tracking-tight hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remover
            </button>
          )}
        </div>

        {replying && (
          <div className="mt-3 flex gap-2">
            <Textarea
              placeholder="Responder..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={2}
              className="rounded-xl font-light resize-none text-sm"
            />
            <Button size="sm" onClick={handleReply} disabled={!replyText.trim() || submitting} className="rounded-lg self-end">
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Enviar'}
            </Button>
          </div>
        )}

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <ul className="mt-4 pl-4 border-l-2 border-border/40 space-y-4">
            {comment.replies.map((r) => (
              <CommentItem
                key={r.id}
                comment={r}
                onLike={onLike}
                onReply={onReply}
                onRemove={onRemove}
                canModerate={canModerate}
                currentStudentId={currentStudentId}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = (Date.now() - then) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d atrás`;
  return new Date(iso).toLocaleDateString('pt-BR');
}
