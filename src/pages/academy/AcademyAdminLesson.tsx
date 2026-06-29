import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Upload, Link as LinkIcon, Package, ExternalLink, Save } from 'lucide-react';
import { AcademyLayout } from '@/components/academy/AcademyLayout';
import { VideoPlayer } from '@/components/academy/VideoPlayer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAcademyContext } from '@/contexts/AcademyContext';
import { useAcademyMaterials } from '@/hooks/useAcademyMaterials';
import { MaterialGrid } from '@/components/academy/MaterialCard';
import { toast } from 'sonner';

interface LessonData {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  module_id: string | null;
  student_id: string | null;
  is_published: boolean;
  sort_order: number;
}

interface SharedStudent {
  student_id: string;
  full_name: string;
  email: string;
}

export default function AcademyAdminLessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { isAdmin, isLoading: authLoading } = useAcademyContext();

  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [sharedStudents, setSharedStudents] = useState<SharedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      toast.error('Acesso restrito ao admin');
      navigate('/academy');
      return;
    }
    if (!lessonId) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from('academy_lessons')
        .select('*')
        .eq('id', lessonId)
        .maybeSingle();
      if (data) {
        setLesson(data);
        setEditTitle(data.title);
        setEditDescription(data.description || '');
        // Carrega alunos compartilhando (junction)
        const { data: shared } = await (supabase as any).rpc('list_lesson_students', { target_lesson_id: lessonId });
        setSharedStudents(shared || []);
      }
      setLoading(false);
    })();
  }, [lessonId, isAdmin, authLoading, navigate]);

  const saveMetadata = async () => {
    if (!lesson) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('academy_lessons')
        .update({ title: editTitle, description: editDescription || null })
        .eq('id', lesson.id);
      if (error) throw error;
      setLesson({ ...lesson, title: editTitle, description: editDescription || null });
      toast.success('Aula atualizada');
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || authLoading) {
    return (
      <AcademyLayout requireAdmin>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AcademyLayout>
    );
  }

  if (!lesson) {
    return (
      <AcademyLayout requireAdmin>
        <div className="max-w-md mx-auto py-20 text-center">
          <h2 className="text-xl font-extrabold tracking-tight mb-4">Aula não encontrada</h2>
          <Button onClick={() => navigate('/academy/admin')} variant="outline" className="rounded-xl font-bold">
            Voltar pro admin
          </Button>
        </div>
      </AcademyLayout>
    );
  }

  const isPrivate = !lesson.module_id;

  return (
    <AcademyLayout requireAdmin>
      <Link to="/academy/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6 font-semibold">
        <ArrowLeft className="w-4 h-4" /> Voltar pro admin
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
        {/* Player + metadata */}
        <div>
          <div className="rounded-2xl overflow-hidden bg-black aspect-video mb-6">
            <VideoPlayer src={lesson.video_url} />
          </div>

          <div className="flex items-center gap-2 mb-2">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-primary">
              {isPrivate ? '🎯 Mentoria — aula privada' : '📚 Aula de curso'}
            </p>
            {!lesson.is_published && <Badge variant="outline" className="rounded-md text-[10px]">Rascunho</Badge>}
          </div>

          <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Título</Label>
          <Input
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            className="text-2xl md:text-3xl font-extrabold tracking-[-0.03em] border-0 shadow-none p-0 h-auto focus-visible:ring-0 mb-4"
          />

          <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Descrição</Label>
          <Textarea
            value={editDescription}
            onChange={e => setEditDescription(e.target.value)}
            rows={3}
            placeholder="Descrição da aula (opcional)"
            className="mb-3 rounded-xl"
          />

          <div className="flex gap-2 mb-6">
            <Button
              onClick={saveMetadata}
              disabled={saving || (editTitle === lesson.title && (editDescription || '') === (lesson.description || ''))}
              className="rounded-xl font-bold gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </Button>
            {isPrivate && (
              <Button
                variant="outline"
                onClick={() => window.open(`/academy/minhas-aulas/${lesson.id}`, '_blank')}
                className="rounded-xl font-bold gap-2"
              >
                <ExternalLink className="w-4 h-4" /> Ver como aluno
              </Button>
            )}
          </div>

          {/* Materiais inline — usa o mesmo componente admin */}
          <AdminLessonMaterials lessonId={lesson.id} />
        </div>

        {/* Sidebar: alunos compartilhando (se privada) ou info da aula */}
        <aside className="space-y-4">
          {isPrivate ? (
            <div className="p-4 rounded-2xl border border-border/40 bg-card">
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground mb-3">
                Compartilhada com ({sharedStudents.length})
              </h3>
              {sharedStudents.length === 0 ? (
                <p className="text-xs text-muted-foreground font-light">Ninguém tem acesso ainda</p>
              ) : (
                <div className="space-y-2">
                  {sharedStudents.map(s => (
                    <div key={s.student_id} className="p-2 rounded-lg bg-muted/30">
                      <p className="text-sm font-bold truncate">{s.full_name}</p>
                      <p className="text-[10px] text-muted-foreground font-light truncate">{s.email}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <div className="p-4 rounded-2xl border border-border/40 bg-card text-xs text-muted-foreground font-light space-y-1">
            <p><span className="font-bold">ID:</span> {lesson.id}</p>
            <p><span className="font-bold">Vídeo:</span> <a href={lesson.video_url} target="_blank" className="text-primary break-all">{lesson.video_url.slice(0, 40)}...</a></p>
          </div>
        </aside>
      </div>
    </AcademyLayout>
  );
}

// ─── Admin Materials (upload + link externo inline) ────────────────────────
function AdminLessonMaterials({ lessonId }: { lessonId: string }) {
  const { materials, loading, list, upload, addExternalUrl, remove } = useAcademyMaterials();
  const [uploading, setUploading] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [savingLink, setSavingLink] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { list(lessonId); }, [lessonId, list]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await upload(lessonId, file);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleSaveLink = async () => {
    if (!linkUrl.trim() || !linkTitle.trim()) return toast.error('URL e título são obrigatórios');
    try { new URL(linkUrl.trim()); } catch { return toast.error('URL inválida'); }
    setSavingLink(true);
    try {
      await addExternalUrl(lessonId, linkUrl.trim(), { title: linkTitle, description: linkDescription || undefined });
      setLinkUrl(''); setLinkTitle(''); setLinkDescription('');
      setLinkOpen(false);
    } finally {
      setSavingLink(false);
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-muted/20 border border-border/30">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          <h3 className="font-extrabold text-base tracking-tight">Materiais</h3>
          <span className="text-xs text-muted-foreground font-light">({materials.length})</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-lg gap-2" onClick={() => setLinkOpen(!linkOpen)}>
            <LinkIcon className="w-3 h-3" /> Link externo
          </Button>
          <Button variant="outline" size="sm" className="rounded-lg gap-2" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Upload arquivo
          </Button>
          <input ref={inputRef} type="file" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {linkOpen && (
        <div className="mb-4 p-4 rounded-xl bg-background border border-border/40 space-y-2">
          <div>
            <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">URL</Label>
            <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} className="rounded-lg mt-1" placeholder="https://github.com/..." />
          </div>
          <div>
            <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Título</Label>
            <Input value={linkTitle} onChange={e => setLinkTitle(e.target.value)} className="rounded-lg mt-1" placeholder="Ex: Docs de referência" />
          </div>
          <div>
            <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Descrição</Label>
            <Textarea value={linkDescription} onChange={e => setLinkDescription(e.target.value)} rows={2} className="rounded-lg mt-1" placeholder="Opcional" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => setLinkOpen(false)}>Cancelar</Button>
            <Button size="sm" className="rounded-lg font-bold" onClick={handleSaveLink} disabled={savingLink || !linkUrl || !linkTitle}>
              {savingLink ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              Salvar link
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
      ) : materials.length === 0 ? (
        <p className="text-sm text-muted-foreground font-light text-center py-6">Nenhum material ainda. Adiciona um link ou arquivo acima.</p>
      ) : (
        <MaterialGrid
          materials={materials}
          onRemove={(mat) => {
            if (confirm(`Remover "${mat.title}"?`)) remove(mat);
          }}
        />
      )}
    </div>
  );
}
