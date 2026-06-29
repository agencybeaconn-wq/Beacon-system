import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Plus, Trash2, Edit, Upload, Loader2, Video, Users, BookOpen,
  MessageSquare, LayoutDashboard, ImageIcon, GripVertical, Eye, EyeOff,
  Search, TrendingUp, PlayCircle, Link as LinkIcon, Copy, FileText, Package,
} from 'lucide-react';
import { useAcademyInvites, AcademyInvite } from '@/hooks/useAcademyInvites';
import { useAcademyMaterials, formatFileSize, fileIcon, AcademyMaterial } from '@/hooks/useAcademyMaterials';
import { useAcademyPrivateLessons as usePrivateLessonsHook } from '@/hooks/useAcademyPrivateLessons';
import { AcademyLayout } from '@/components/academy/AcademyLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAcademy, AcademyLesson, AcademyStudent, AcademyEnrollment, AcademyModule } from '@/hooks/useAcademy';
import { toast } from 'sonner';

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

function gradientFor(slug: string): string {
  let hash = 0;
  for (let i = 0; i < (slug || '').length; i++) hash = slug.charCodeAt(i) + ((hash << 5) - hash);
  const h1 = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${h1} 70% 45%) 0%, hsl(${(h1 + 45) % 360} 65% 30%) 100%)`;
}

const SECTION_TITLES: Record<string, { title: string; subtitle: string }> = {
  overview: { title: 'Visão geral', subtitle: 'Métricas e acompanhamento geral do Academy' },
  modulos: { title: 'Módulos', subtitle: 'Crie e organize os módulos (cursos) do Academy' },
  aulas: { title: 'Aulas', subtitle: 'Publique vídeos e organize as aulas de cada módulo' },
  alunos: { title: 'Alunos & Convites', subtitle: 'Gerencie matriculados, mentorias e convites pendentes' },
  moderacao: { title: 'Moderação', subtitle: 'Revise e remova comentários inadequados' },
};

function getSection(pathname: string): keyof typeof SECTION_TITLES {
  const seg = pathname.replace(/^\/academy\/admin\/?/, '').split('/')[0];
  if (seg && seg in SECTION_TITLES) return seg as keyof typeof SECTION_TITLES;
  return 'overview';
}

export default function AcademyAdmin() {
  const location = useLocation();
  const section = getSection(location.pathname);
  const meta = SECTION_TITLES[section];

  return (
    <AcademyLayout requireAdmin>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-primary mb-2">Administração</p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-[-0.03em] leading-tight">{meta.title}</h1>
          <p className="text-muted-foreground font-light mt-2">{meta.subtitle}</p>
        </div>

        {section === 'overview' && <OverviewTab />}
        {section === 'modulos' && <ModulesTab />}
        {section === 'aulas' && <LessonsTab />}
        {section === 'alunos' && <StudentsTab />}
        {section === 'moderacao' && <ModerationTab />}
      </div>
    </AcademyLayout>
  );
}

// ─── OVERVIEW ──────────────────────────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [m, l, s, e, c] = await Promise.all([
        (supabase as any).from('academy_modules').select('*'),
        (supabase as any).from('academy_lessons').select('id, module_id'),
        (supabase as any).from('academy_students').select('id, created_at, is_admin'),
        (supabase as any).from('academy_enrollments').select('*'),
        (supabase as any).from('academy_comments').select('id, created_at, is_deleted').gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      ]);
      const modules = m.data || [];
      const published = modules.filter((x: any) => x.is_published).length;
      const students = (s.data || []).filter((x: any) => !x.is_admin);
      const newStudents7d = students.filter((x: any) => new Date(x.created_at) > new Date(Date.now() - 7 * 86400000)).length;
      setStats({
        modulesTotal: modules.length,
        modulesPublished: published,
        lessonsTotal: (l.data || []).length,
        studentsTotal: students.length,
        studentsNew7d: newStudents7d,
        enrollments: (e.data || []).length,
        commentsWeek: (c.data || []).filter((x: any) => !x.is_deleted).length,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  const metrics = [
    { label: 'Módulos publicados', value: stats.modulesPublished, sub: `${stats.modulesTotal} no total`, icon: BookOpen },
    { label: 'Aulas no ar', value: stats.lessonsTotal, sub: 'vídeos disponíveis', icon: PlayCircle },
    { label: 'Alunos ativos', value: stats.studentsTotal, sub: `+${stats.studentsNew7d} nos últimos 7 dias`, icon: Users },
    { label: 'Matrículas ativas', value: stats.enrollments, sub: 'acessos concedidos', icon: TrendingUp },
    { label: 'Comentários (7d)', value: stats.commentsWeek, sub: 'interações recentes', icon: MessageSquare },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {metrics.map((m, i) => (
          <Card key={i} className="p-5 rounded-2xl border-border/40">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">{m.label}</p>
              <m.icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-extrabold tracking-[-0.03em] mb-1">{m.value}</p>
            <p className="text-xs text-muted-foreground font-light">{m.sub}</p>
          </Card>
        ))}
      </div>
      <Card className="mt-6 p-6 rounded-2xl border-border/40">
        <h3 className="font-extrabold tracking-tight mb-2">Próximos passos</h3>
        <p className="text-sm text-muted-foreground font-light">
          {stats.modulesTotal === 0
            ? 'Comece criando seu primeiro módulo na aba "Módulos".'
            : stats.lessonsTotal === 0
            ? 'Você tem módulos mas nenhuma aula. Vá em "Aulas" e faça upload do primeiro vídeo.'
            : stats.enrollments === 0
            ? 'Conceda acesso aos seus primeiros alunos na aba "Alunos".'
            : 'Tudo funcionando. Acompanhe comentários e engajamento.'}
        </p>
      </Card>
    </div>
  );
}

// ─── MODULES ───────────────────────────────────────────────────────────────
function ModulesTab() {
  const { modules, createModule, updateModule, deleteModule, uploadCover, reorderModules, refresh } = useAcademy();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AcademyModule | null>(null);
  const [form, setForm] = useState({ title: '', slug: '', description: '', cover_url: '', level: '', is_published: false, type: 'course' as 'course' | 'mentoria' });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openNew = () => {
    setEditing(null); setCoverFile(null);
    setForm({ title: '', slug: '', description: '', cover_url: '', level: '', is_published: false, type: 'course' });
    setOpen(true);
  };
  const openEdit = (m: AcademyModule) => {
    setEditing(m); setCoverFile(null);
    setForm({ title: m.title, slug: m.slug, description: m.description || '', cover_url: m.cover_url || '', level: m.level || '', is_published: m.is_published, type: (m.type || 'course') as 'course' | 'mentoria' });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title) return toast.error('Título obrigatório');
    setSaving(true);
    let coverUrl = form.cover_url;
    const payload = { ...form, slug: form.slug || slugify(form.title), cover_url: coverUrl };

    let result: any = editing;
    if (editing) await updateModule(editing.id, payload);
    else result = await createModule(payload as any);

    if (coverFile && result?.id) {
      const url = await uploadCover(coverFile, result.id);
      if (url) await updateModule(result.id, { cover_url: url });
    }
    setSaving(false);
    setOpen(false);
    refresh();
  };

  const togglePublished = async (m: AcademyModule) => {
    await updateModule(m.id, { is_published: !m.is_published });
  };

  const move = async (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= modules.length) return;
    const arr = [...modules];
    [arr[index], arr[next]] = [arr[next], arr[index]];
    await reorderModules(arr.map(m => m.id));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-sm text-muted-foreground font-light">{modules.length} módulos cadastrados</p>
        </div>
        <Button onClick={openNew} className="rounded-xl font-bold tracking-tight gap-2">
          <Plus className="w-4 h-4" />Novo módulo
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((m, i) => (
          <Card key={m.id} className="overflow-hidden rounded-2xl border-border/40 group">
            <div
              className="relative aspect-[16/10]"
              style={m.cover_url ? undefined : { background: gradientFor(m.slug) }}
            >
              {m.cover_url && <img src={m.cover_url} alt={m.title} className="w-full h-full object-cover" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute top-3 left-3 flex flex-col gap-1">
                <button
                  onClick={() => move(i, -1)}
                  className="w-7 h-7 rounded-md bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background text-xs font-bold"
                  disabled={i === 0}
                  title="Mover pra cima"
                ><GripVertical className="w-3 h-3" /></button>
              </div>
              <div className="absolute top-3 right-3 flex gap-2">
                {m.level && <Badge className="bg-background/90 text-foreground border-0 rounded-md text-[10px] tracking-[0.1em] uppercase font-bold">{m.level}</Badge>}
                <button
                  onClick={() => togglePublished(m)}
                  title={m.is_published ? 'Publicado — clique pra rascunho' : 'Rascunho — clique pra publicar'}
                  className={`w-7 h-7 rounded-md flex items-center justify-center backdrop-blur ${m.is_published ? 'bg-green-500/90 text-white' : 'bg-muted/80 text-muted-foreground'}`}
                >
                  {m.is_published ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="absolute inset-x-0 bottom-0 p-4">
                <h3 className="text-white font-extrabold tracking-[-0.02em] text-lg line-clamp-2">{m.title}</h3>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/70 mt-1">/{m.slug}</p>
              </div>
            </div>
            <div className="p-4 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground line-clamp-1 font-light flex-1">{m.description || 'Sem descrição'}</p>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}><Edit className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={async () => {
                if (confirm('Excluir este módulo e todas as aulas?')) await deleteModule(m.id);
              }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader><DialogTitle className="font-extrabold tracking-tight">{editing ? 'Editar' : 'Novo'} módulo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Título</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value, slug: form.slug || slugify(e.target.value) })} className="rounded-xl mt-1" />
            </div>
            <div>
              <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Slug (URL)</Label>
              <Input value={form.slug} onChange={e => setForm({ ...form, slug: slugify(e.target.value) })} className="rounded-xl mt-1 font-mono text-sm" />
            </div>
            <div>
              <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="rounded-xl mt-1" />
            </div>
            <div>
              <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Capa</Label>
              <div className="mt-2 flex gap-3">
                <div
                  className="w-24 aspect-[2/3] rounded-xl overflow-hidden border border-border/40 flex-shrink-0 cursor-pointer relative group"
                  style={!form.cover_url && !coverFile ? { background: gradientFor(form.slug || 'default') } : undefined}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {coverFile ? (
                    <img src={URL.createObjectURL(coverFile)} alt="" className="w-full h-full object-cover" />
                  ) : form.cover_url ? (
                    <img src={form.cover_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/70">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => setCoverFile(e.target.files?.[0] || null)}
                />
                <div className="flex-1 text-xs text-muted-foreground font-light">
                  Clique pra fazer upload. Formato ideal: vertical 2:3 (1080×1620).
                  {coverFile && <p className="text-primary font-bold mt-2">Nova capa selecionada: {coverFile.name}</p>}
                </div>
              </div>
            </div>
            <div>
              <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Nível</Label>
              <Select value={form.level} onValueChange={v => setForm({ ...form, level: v })}>
                <SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Iniciante">Iniciante</SelectItem>
                  <SelectItem value="Intermediário">Intermediário</SelectItem>
                  <SelectItem value="Avançado">Avançado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Tipo</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v as 'course' | 'mentoria' })}>
                <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="course">📚 Curso (catálogo público)</SelectItem>
                  <SelectItem value="mentoria">🎯 Mentoria (só por convite)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground font-light mt-1">
                {form.type === 'mentoria'
                  ? 'Mentorias ficam ocultas do catálogo. Aluno só acessa se você enviar um convite específico.'
                  : 'Cursos aparecem no catálogo. Alunos compram/ganham acesso e veem.'}
              </p>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30">
              <Switch checked={form.is_published} onCheckedChange={v => setForm({ ...form, is_published: v })} />
              <Label className="font-bold text-sm">Publicado (visível pros alunos)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={saving} className="rounded-xl font-bold tracking-tight">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editing ? 'Salvar alterações' : 'Criar módulo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── LESSON ADMIN CARD (com materiais) ─────────────────────────────────────
function LessonAdminCard({
  lesson: l,
  index: i,
  onMove,
  onEdit,
  onDelete,
}: {
  lesson: AcademyLesson;
  index: number;
  onMove: (index: number, dir: -1 | 1) => void;
  onEdit: (l: AcademyLesson) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="rounded-xl border-border/40 overflow-hidden">
      <div className="p-3 flex items-center gap-3">
        <div className="flex flex-col gap-1">
          <button onClick={() => onMove(i, -1)} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
            <GripVertical className="w-4 h-4" />
          </button>
        </div>
        <span className="font-extrabold text-xs text-muted-foreground w-8 text-center">{String(i + 1).padStart(2, '0')}</span>
        <div className="w-12 h-8 rounded bg-muted flex-shrink-0 relative overflow-hidden">
          {l.thumbnail_url
            ? <img src={l.thumbnail_url} alt="" className="w-full h-full object-cover" />
            : <PlayCircle className="absolute inset-0 m-auto w-4 h-4 text-muted-foreground/50" />}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm tracking-tight truncate">{l.title}</h4>
          {l.description && <p className="text-xs text-muted-foreground truncate font-light">{l.description}</p>}
        </div>
        {!l.is_published && <Badge variant="outline" className="text-[10px] uppercase tracking-wide rounded-md">Rascunho</Badge>}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 rounded-lg gap-1.5"
          onClick={() => setExpanded(!expanded)}
          title="Materiais"
        >
          <Package className="w-4 h-4" />
          <span className="text-xs">Materiais</span>
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(l)}><Edit className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete}><Trash2 className="w-4 h-4 text-destructive" /></Button>
      </div>
      {expanded && <div className="px-3 pb-3"><LessonMaterials lessonId={l.id} /></div>}
    </Card>
  );
}

// ─── INVITES TAB ───────────────────────────────────────────────────────────
function InvitesTab() {
  const { modules } = useAcademy();
  const { invites, loading, list, create, revoke, remove, buildLink, buildMailto, sendEmail } = useAcademyInvites();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ module_id: '', email: '', note: '', max_uses: 1, expires_at: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => { list(); }, [list]);

  const handleCreate = async () => {
    if (!form.module_id) return toast.error('Escolha um módulo');
    setCreating(true);
    try {
      await create({
        module_id: form.module_id,
        email: form.email || null,
        note: form.note || null,
        max_uses: form.max_uses || null,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      });
      setOpen(false);
      setForm({ module_id: '', email: '', note: '', max_uses: 1, expires_at: '' });
    } finally {
      setCreating(false);
    }
  };

  const copy = async (token: string) => {
    const link = buildLink(token);
    await navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-sm text-muted-foreground font-light">{invites.length} convites gerados</p>
        </div>
        <Button onClick={() => setOpen(true)} className="rounded-xl font-bold tracking-tight gap-2">
          <Plus className="w-4 h-4" />Novo convite
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : invites.length === 0 ? (
        <Card className="p-12 text-center rounded-2xl border-dashed border-border/40">
          <LinkIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground font-light">Nenhum convite ainda. Crie um pra liberar acesso a uma mentoria.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {invites.map(inv => {
            const expired = inv.expires_at && new Date(inv.expires_at) < new Date();
            const used = inv.uses >= 1;
            const invalid = !inv.is_active || expired || used;

            let statusBadge;
            if (!inv.is_active) statusBadge = <Badge variant="destructive" className="text-[10px]">Desativado</Badge>;
            else if (expired) statusBadge = <Badge variant="destructive" className="text-[10px]">Expirado</Badge>;
            else if (used) statusBadge = <Badge className="text-[10px] bg-muted text-muted-foreground hover:bg-muted">Usado</Badge>;
            else statusBadge = <Badge className="text-[10px] bg-green-500 text-white hover:bg-green-600">Ativo</Badge>;

            return (
              <Card key={inv.id} className={`p-4 rounded-2xl border-border/40 ${invalid ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="font-bold">{inv.academy_modules?.title || '—'}</h4>
                      <Badge variant="outline" className="text-[10px]">{inv.academy_modules?.type || 'course'}</Badge>
                      {statusBadge}
                    </div>
                    {inv.email && <p className="text-xs text-muted-foreground mb-1">📧 {inv.email}</p>}
                    {inv.note && <p className="text-sm text-muted-foreground mb-2">{inv.note}</p>}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-light flex-wrap">
                      {inv.expires_at && <span>Expira: {new Date(inv.expires_at).toLocaleDateString('pt-BR')}</span>}
                      <span>Criado: {new Date(inv.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="mt-2 p-2 rounded-lg bg-muted/40 font-mono text-xs break-all">
                      {buildLink(inv.token)}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg" onClick={() => copy(inv.token)} title="Copiar link">
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg gap-1"
                      onClick={async () => {
                        if (!inv.email) {
                          window.location.href = buildMailto(inv);
                        } else {
                          await sendEmail(inv);
                        }
                      }}
                      title={inv.email ? `Enviar automaticamente pra ${inv.email}` : 'Abrir cliente de email'}
                    >
                      📧 {inv.email ? 'Enviar' : 'Email'}
                    </Button>
                    {inv.is_active && (
                      <Button variant="outline" size="sm" className="rounded-lg" onClick={() => revoke(inv.id)} title="Desativar">
                        Desativar
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => {
                      if (confirm('Remover este convite?')) remove(inv.id);
                    }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="font-extrabold tracking-tight">Novo convite</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Módulo</Label>
              <Select value={form.module_id} onValueChange={v => setForm({ ...form, module_id: v })}>
                <SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {modules.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {(m.type === 'mentoria' ? '🎯 ' : '📚 ')}{m.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Email do convidado (opcional)</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="cliente@email.com"
                className="rounded-xl mt-1"
              />
              <p className="text-[11px] text-muted-foreground font-light mt-1">
                Usado só pra facilitar o envio do email depois. Não envia automaticamente.
              </p>
            </div>
            <div>
              <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Nota (opcional)</Label>
              <Input
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
                placeholder="Ex: Cliente João da Silva — Mentoria Shopify"
                className="rounded-xl mt-1"
              />
            </div>
            <div>
              <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Expira em (opcional)</Label>
              <Input
                type="date"
                value={form.expires_at}
                onChange={e => setForm({ ...form, expires_at: e.target.value })}
                className="rounded-xl mt-1"
              />
              <p className="text-[11px] text-muted-foreground font-light mt-1">Deixe vazio pra o link nunca expirar.</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={creating} className="rounded-xl font-bold tracking-tight">
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Gerar link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── MATERIALS (inside LessonsTab, per-lesson) ──────────────────────────────
function LessonMaterials({ lessonId }: { lessonId: string }) {
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
    try {
      new URL(linkUrl.trim());
    } catch {
      return toast.error('URL inválida');
    }
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
    <div className="mt-4 p-4 rounded-xl bg-muted/20 border border-border/30">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-muted-foreground" />
          <h4 className="font-bold text-sm">Materiais da aula ({materials.length})</h4>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg gap-2"
            onClick={() => setLinkOpen(!linkOpen)}
          >
            <LinkIcon className="w-3 h-3" />
            Link externo
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg gap-2"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Upload arquivo
          </Button>
          <input ref={inputRef} type="file" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {linkOpen && (
        <div className="mb-3 p-3 rounded-lg bg-background border border-border/40 space-y-2">
          <div>
            <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">URL</Label>
            <Input
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              className="rounded-lg mt-1"
              placeholder="https://github.com/leveragency/lever-academy-docs"
            />
          </div>
          <div>
            <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Título</Label>
            <Input
              value={linkTitle}
              onChange={e => setLinkTitle(e.target.value)}
              className="rounded-lg mt-1"
              placeholder="Ex: Docs Meta Marketing API + Shopify AI Toolkit"
            />
          </div>
          <div>
            <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Descrição (opcional)</Label>
            <Textarea
              value={linkDescription}
              onChange={e => setLinkDescription(e.target.value)}
              rows={2}
              className="rounded-lg mt-1"
              placeholder="Opcional"
            />
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
        <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
      ) : materials.length === 0 ? (
        <p className="text-xs text-muted-foreground font-light text-center py-2">Nenhum material ainda</p>
      ) : (
        <div className="space-y-2">
          {materials.map(mat => (
            <div key={mat.id} className="flex items-center gap-3 p-2 rounded-lg bg-background border border-border/30">
              <span className="text-2xl">{fileIcon(mat.mime_type, mat.is_external_url ? mat.file_url : mat.file_name, mat.is_external_url)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{mat.title}</p>
                <p className="text-xs text-muted-foreground font-light truncate">
                  {mat.is_external_url
                    ? mat.file_url
                    : `${mat.file_name} · ${formatFileSize(mat.file_size)}`}
                </p>
              </div>
              <a
                href={mat.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary"
                title={mat.is_external_url ? 'Abrir link' : 'Baixar'}
              >
                {mat.is_external_url ? <LinkIcon className="w-4 h-4" /> : <Upload className="w-4 h-4 rotate-180" />}
              </a>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => {
                  if (confirm('Remover este material?')) remove(mat);
                }}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── LESSONS ───────────────────────────────────────────────────────────────
function LessonsTab() {
  const { modules, fetchLessons, uploadLesson, createLessonFromUrl, updateLesson, deleteLesson, reorderLessons } = useAcademy();
  const [moduleId, setModuleId] = useState<string>('');
  const [lessons, setLessons] = useState<AcademyLesson[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<AcademyLesson | null>(null);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [inputMode, setInputMode] = useState<'file' | 'url'>('file');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const reload = async () => {
    if (!moduleId) return;
    setLoading(true);
    setLessons(await fetchLessons(moduleId));
    setLoading(false);
  };

  useEffect(() => { reload(); }, [moduleId]);

  const submitUpload = async () => {
    if (!title || !moduleId) return toast.error('Título e módulo obrigatórios');
    if (inputMode === 'file' && !file) return toast.error('Selecione o arquivo de vídeo');
    if (inputMode === 'url' && !videoUrl) return toast.error('Cole o link do vídeo (Loom/YouTube/Vimeo)');
    setUploading(true);
    const res = inputMode === 'file'
      ? await uploadLesson(moduleId, file!, { title, description, sortOrder: lessons.length })
      : await createLessonFromUrl(moduleId, videoUrl.trim(), { title, description, sortOrder: lessons.length });
    setUploading(false);
    if (res) {
      setUploadOpen(false);
      setFile(null); setVideoUrl(''); setTitle(''); setDescription('');
      reload();
    }
  };

  const openEdit = (l: AcademyLesson) => { setEditingLesson({ ...l }); setEditOpen(true); };
  const saveEdit = async () => {
    if (!editingLesson) return;
    await updateLesson(editingLesson.id, {
      title: editingLesson.title, description: editingLesson.description || null,
      is_published: editingLesson.is_published,
    });
    setEditOpen(false);
    reload();
  };

  const move = async (i: number, dir: -1 | 1) => {
    const next = i + dir;
    if (next < 0 || next >= lessons.length) return;
    const arr = [...lessons];
    [arr[i], arr[next]] = [arr[next], arr[i]];
    setLessons(arr);
    await reorderLessons(arr.map(l => l.id));
  };

  return (
    <div>
      <div className="flex gap-3 mb-6 items-end flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Módulo</Label>
          <Select value={moduleId} onValueChange={setModuleId}>
            <SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Selecione um módulo" /></SelectTrigger>
            <SelectContent>
              {modules.map(m => <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button disabled={!moduleId} onClick={() => setUploadOpen(true)} className="rounded-xl font-bold tracking-tight gap-2">
          <Upload className="w-4 h-4" />Nova aula
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : !moduleId ? (
        <Card className="p-12 text-center rounded-2xl border-border/40 border-dashed">
          <Video className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground font-light">Selecione um módulo pra ver as aulas.</p>
        </Card>
      ) : lessons.length === 0 ? (
        <Card className="p-12 text-center rounded-2xl border-border/40 border-dashed">
          <PlayCircle className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground font-light">Sem aulas neste módulo. Clique em "Nova aula" pra fazer upload do primeiro vídeo.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {lessons.map((l, i) => (
            <LessonAdminCard
              key={l.id}
              lesson={l}
              index={i}
              onMove={move}
              onEdit={openEdit}
              onDelete={async () => {
                if (confirm('Excluir esta aula?')) { await deleteLesson(l.id, l.video_url); reload(); }
              }}
            />
          ))}
        </div>
      )}

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle className="font-extrabold tracking-tight">Nova aula</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2 p-1 rounded-xl bg-muted/40">
              <Button
                type="button"
                variant={inputMode === 'file' ? 'default' : 'ghost'}
                size="sm"
                className="flex-1 rounded-lg text-xs font-bold"
                onClick={() => setInputMode('file')}
              >
                📁 Upload arquivo
              </Button>
              <Button
                type="button"
                variant={inputMode === 'url' ? 'default' : 'ghost'}
                size="sm"
                className="flex-1 rounded-lg text-xs font-bold"
                onClick={() => setInputMode('url')}
              >
                🔗 Link (Loom/YouTube/Vimeo)
              </Button>
            </div>
            {inputMode === 'file' ? (
              <div>
                <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Arquivo (MP4/MOV/WEBM, máx 500MB)</Label>
                <Input type="file" accept="video/*" onChange={e => setFile(e.target.files?.[0] || null)} className="rounded-xl mt-1" />
              </div>
            ) : (
              <div>
                <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Link do vídeo</Label>
                <Input
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                  className="rounded-xl mt-1"
                  placeholder="https://www.loom.com/share/abc123..."
                />
                <p className="text-[11px] text-muted-foreground font-light mt-1">
                  Suporta Loom (share/embed), YouTube e Vimeo. Loom precisa estar com acesso "qualquer pessoa com link".
                </p>
              </div>
            )}
            <div>
              <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Título</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} className="rounded-xl mt-1" />
            </div>
            <div>
              <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Descrição</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="rounded-xl mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submitUpload} disabled={uploading} className="rounded-xl font-bold tracking-tight">
              {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</> : (inputMode === 'file' ? 'Enviar aula' : 'Salvar aula')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle className="font-extrabold tracking-tight">Editar aula</DialogTitle></DialogHeader>
          {editingLesson && (
            <div className="space-y-3">
              <div>
                <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Título</Label>
                <Input value={editingLesson.title} onChange={e => setEditingLesson({ ...editingLesson, title: e.target.value })} className="rounded-xl mt-1" />
              </div>
              <div>
                <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Descrição</Label>
                <Textarea value={editingLesson.description || ''} onChange={e => setEditingLesson({ ...editingLesson, description: e.target.value })} rows={3} className="rounded-xl mt-1" />
              </div>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30">
                <Switch checked={editingLesson.is_published} onCheckedChange={v => setEditingLesson({ ...editingLesson, is_published: v })} />
                <Label className="font-bold text-sm">Publicada</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={saveEdit} className="rounded-xl font-bold tracking-tight">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── STUDENTS ──────────────────────────────────────────────────────────────
function StudentsTab() {
  const { modules, grantEnrollment, revokeEnrollment } = useAcademy();
  const { invites, list: listInvites, create: createInvite, revoke: revokeInvite, remove: removeInvite, buildLink, buildMailto, sendEmail } = useAcademyInvites();
  const [students, setStudents] = useState<AcademyStudent[]>([]);
  const [enrollments, setEnrollments] = useState<AcademyEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'mentoria' | 'admin'>('all');
  const [mentorshipStudent, setMentorshipStudent] = useState<AcademyStudent | null>(null);
  const [newInviteOpen, setNewInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ module_id: '', email: '', note: '', expires_at: '' });
  const [creatingInvite, setCreatingInvite] = useState(false);

  const load = async () => {
    setLoading(true);
    const [st, en] = await Promise.all([
      (supabase as any).from('academy_students').select('*').order('created_at', { ascending: false }),
      (supabase as any).from('academy_enrollments').select('*'),
    ]);
    setStudents(st.data || []);
    setEnrollments(en.data || []);
    setLoading(false);
  };
  useEffect(() => { load(); listInvites(); }, [listInvites]);

  const toggleMentorship = async (s: AcademyStudent) => {
    const next = !s.is_mentorship_client;
    const { error } = await (supabase as any)
      .from('academy_students')
      .update({ is_mentorship_client: next })
      .eq('id', s.id);
    if (error) return toast.error('Erro: ' + error.message);
    toast.success(next ? 'Marcado como cliente de mentoria' : 'Removido de mentoria');
    load();
  };

  const handleCreateInvite = async () => {
    if (!inviteForm.module_id) return toast.error('Escolha um módulo');
    setCreatingInvite(true);
    try {
      await createInvite({
        module_id: inviteForm.module_id,
        email: inviteForm.email || null,
        note: inviteForm.note || null,
        expires_at: inviteForm.expires_at ? new Date(inviteForm.expires_at).toISOString() : null,
      });
      setNewInviteOpen(false);
      setInviteForm({ module_id: '', email: '', note: '', expires_at: '' });
    } finally {
      setCreatingInvite(false);
    }
  };

  const copyInviteLink = async (token: string) => {
    await navigator.clipboard.writeText(buildLink(token));
    toast.success('Link copiado');
  };

  const filtered = students.filter(s => {
    if (search && !`${s.full_name} ${s.email}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'mentoria' && !s.is_mentorship_client) return false;
    if (filter === 'admin' && !s.is_admin) return false;
    return true;
  });

  const pendingInvites = invites.filter(inv => {
    const expired = inv.expires_at && new Date(inv.expires_at) < new Date();
    const used = inv.uses >= 1;
    return inv.is_active && !expired && !used;
  });
  const staleInvites = invites.filter(inv => {
    const expired = inv.expires_at && new Date(inv.expires_at) < new Date();
    const used = inv.uses >= 1;
    return used || expired || !inv.is_active;
  });

  const stats = {
    total: students.length,
    mentoria: students.filter(s => s.is_mentorship_client).length,
    pending: pendingInvites.length,
  };

  if (loading) return <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-8">
      {/* Stats + ação principal */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3">
        <Card className="p-4 rounded-2xl border-border/40">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground mb-1">Total</p>
          <p className="text-3xl font-extrabold tracking-tight">{stats.total}</p>
          <p className="text-[11px] text-muted-foreground font-light mt-1">alunos matriculados</p>
        </Card>
        <Card className="p-4 rounded-2xl border-primary/20 bg-primary/5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-primary mb-1">Mentoria</p>
          <p className="text-3xl font-extrabold tracking-tight text-primary">{stats.mentoria}</p>
          <p className="text-[11px] text-muted-foreground font-light mt-1">clientes VIP</p>
        </Card>
        <Card className="p-4 rounded-2xl border-amber-500/20 bg-amber-500/5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400 mb-1">Pendentes</p>
          <p className="text-3xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400">{stats.pending}</p>
          <p className="text-[11px] text-muted-foreground font-light mt-1">convites aguardando</p>
        </Card>
        <Button onClick={() => setNewInviteOpen(true)} className="h-full rounded-2xl font-bold tracking-tight gap-2 px-6">
          <Plus className="w-4 h-4" />Novo convite
        </Button>
      </div>

      {/* Search + filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou email..." className="rounded-xl pl-9" />
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-muted/40">
          {(['all', 'mentoria', 'admin'] as const).map(f => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'ghost'}
              onClick={() => setFilter(f)}
              className="rounded-lg text-xs font-bold h-8"
            >
              {f === 'all' ? 'Todos' : f === 'mentoria' ? '🎯 Mentoria' : 'Admin'}
            </Button>
          ))}
        </div>
      </div>

      {/* Lista de alunos */}
      <div>
        <h3 className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground mb-3">
          Alunos ativos ({filtered.length})
        </h3>
        {filtered.length === 0 ? (
          <Card className="p-12 text-center rounded-2xl border-dashed border-border/40">
            <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground font-light">Nenhum aluno encontrado com esses filtros.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filtered.map(s => {
              const myEnrolls = enrollments.filter(e => e.student_id === s.id);
              const available = modules.filter(m => !myEnrolls.some(e => e.module_id === m.id));
              return (
                <StudentCard
                  key={s.id}
                  student={s}
                  enrollments={myEnrolls}
                  modules={modules}
                  availableModules={available}
                  onToggleMentorship={() => toggleMentorship(s)}
                  onOpenPrivateLessons={() => setMentorshipStudent(s)}
                  onRevokeEnrollment={async (id) => { if (confirm('Revogar este acesso?')) { await revokeEnrollment(id); load(); } }}
                  onGrantEnrollment={async (mid) => { await grantEnrollment(s.id, mid); load(); }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Convites pendentes */}
      {pendingInvites.length > 0 && (
        <div>
          <h3 className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400 mb-3">
            ⏳ Convites pendentes ({pendingInvites.length})
          </h3>
          <div className="space-y-2">
            {pendingInvites.map(inv => (
              <InviteCard
                key={inv.id}
                invite={inv}
                buildLink={buildLink}
                buildMailto={buildMailto}
                onCopy={() => copyInviteLink(inv.token)}
                onSendEmail={() => sendEmail(inv)}
                onRevoke={() => revokeInvite(inv.id)}
                onDelete={() => { if (confirm('Remover este convite?')) removeInvite(inv.id); }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Convites usados/expirados (collapsed) */}
      {staleInvites.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-[11px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors mb-3 select-none">
            Histórico ({staleInvites.length} usados/expirados) · clica pra expandir
          </summary>
          <div className="space-y-2 mt-3">
            {staleInvites.map(inv => (
              <InviteCard
                key={inv.id}
                invite={inv}
                buildLink={buildLink}
                buildMailto={buildMailto}
                onCopy={() => copyInviteLink(inv.token)}
                onSendEmail={() => sendEmail(inv)}
                onRevoke={() => revokeInvite(inv.id)}
                onDelete={() => { if (confirm('Remover este convite?')) removeInvite(inv.id); }}
                stale
              />
            ))}
          </div>
        </details>
      )}

      <PrivateLessonsDialog student={mentorshipStudent} onClose={() => setMentorshipStudent(null)} />

      {/* Dialog novo convite */}
      <Dialog open={newInviteOpen} onOpenChange={setNewInviteOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="font-extrabold tracking-tight">Novo convite</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Módulo</Label>
              <Select value={inviteForm.module_id} onValueChange={v => setInviteForm({ ...inviteForm, module_id: v })}>
                <SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {modules.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {(m.type === 'mentoria' ? '🎯 ' : '📚 ')}{m.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Email do convidado</Label>
              <Input
                type="email"
                value={inviteForm.email}
                onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="cliente@email.com"
                className="rounded-xl mt-1"
              />
              <p className="text-[11px] text-muted-foreground font-light mt-1">Preenche pra enviar automaticamente por email.</p>
            </div>
            <div>
              <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Nota (opcional)</Label>
              <Input
                value={inviteForm.note}
                onChange={e => setInviteForm({ ...inviteForm, note: e.target.value })}
                placeholder="Ex: Cliente João — Mentoria Shopify"
                className="rounded-xl mt-1"
              />
            </div>
            <div>
              <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Expira em (opcional)</Label>
              <Input
                type="date"
                value={inviteForm.expires_at}
                onChange={e => setInviteForm({ ...inviteForm, expires_at: e.target.value })}
                className="rounded-xl mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateInvite} disabled={creatingInvite} className="rounded-xl font-bold tracking-tight">
              {creatingInvite ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Gerar link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── STUDENT CARD ──────────────────────────────────────────────────────────
function StudentCard({
  student, enrollments, modules, availableModules,
  onToggleMentorship, onOpenPrivateLessons, onRevokeEnrollment, onGrantEnrollment,
}: {
  student: AcademyStudent;
  enrollments: AcademyEnrollment[];
  modules: AcademyModule[];
  availableModules: AcademyModule[];
  onToggleMentorship: () => void;
  onOpenPrivateLessons: () => void;
  onRevokeEnrollment: (id: string) => Promise<void>;
  onGrantEnrollment: (moduleId: string) => Promise<void>;
}) {
  const initials = student.full_name?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'AL';
  return (
    <Card className={`p-5 rounded-2xl border-border/40 transition-all hover:shadow-md ${student.is_mentorship_client ? 'bg-gradient-to-r from-primary/5 via-transparent to-transparent border-primary/30' : ''}`}>
      <div className="flex items-start gap-4">
        <Avatar className="h-12 w-12 shrink-0">
          <AvatarFallback className={`text-base font-extrabold ${student.is_mentorship_client ? 'bg-primary text-primary-foreground' : student.is_admin ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <h4 className="font-extrabold text-base tracking-tight">{student.full_name}</h4>
                {student.is_admin && <Badge className="rounded-md text-[10px]">Admin</Badge>}
                {student.is_mentorship_client && (
                  <Badge className="rounded-md text-[10px] bg-primary text-primary-foreground hover:bg-primary/90">🎯 Mentoria</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-light">{student.email}</p>
              <p className="text-[10px] text-muted-foreground font-light mt-0.5">
                Desde {new Date(student.created_at).toLocaleDateString('pt-BR')}{student.phone ? ` · ${student.phone}` : ''}
              </p>
            </div>

            <div className="flex gap-1.5">
              <Button
                variant={student.is_mentorship_client ? 'default' : 'outline'}
                size="sm"
                className="h-8 rounded-lg text-xs gap-1.5 font-bold"
                onClick={onToggleMentorship}
              >
                🎯 {student.is_mentorship_client ? 'É mentoria' : 'Tornar mentoria'}
              </Button>
              {student.is_mentorship_client && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg text-xs gap-1.5 font-bold"
                  onClick={onOpenPrivateLessons}
                >
                  <Video className="w-3 h-3" />Aulas
                </Button>
              )}
            </div>
          </div>

          {/* Acessos a módulos */}
          <div className="flex flex-wrap gap-1.5 mt-3 items-center">
            {enrollments.length === 0 && availableModules.length === 0 ? null : (
              <>
                {enrollments.map(e => {
                  const m = modules.find(mm => mm.id === e.module_id);
                  return (
                    <Badge
                      key={e.id}
                      variant="secondary"
                      className="gap-1 rounded-lg cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors text-[11px] font-semibold"
                      onClick={() => onRevokeEnrollment(e.id)}
                      title={`Revogar acesso a ${m?.title}`}
                    >
                      {m?.type === 'mentoria' ? '🎯 ' : '📚 '}{m?.title || 'Módulo removido'}
                      <Trash2 className="w-3 h-3" />
                    </Badge>
                  );
                })}
                {availableModules.length > 0 && (
                  <Select onValueChange={onGrantEnrollment}>
                    <SelectTrigger className="h-7 w-44 text-xs rounded-lg border-dashed">
                      <SelectValue placeholder="+ Conceder acesso" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModules.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {(m.type === 'mentoria' ? '🎯 ' : '📚 ')}{m.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── INVITE CARD ───────────────────────────────────────────────────────────
function InviteCard({
  invite, buildLink, buildMailto, onCopy, onSendEmail, onRevoke, onDelete, stale,
}: {
  invite: AcademyInvite;
  buildLink: (token: string) => string;
  buildMailto: (invite: AcademyInvite) => string;
  onCopy: () => void;
  onSendEmail: () => Promise<boolean>;
  onRevoke: () => void;
  onDelete: () => void;
  stale?: boolean;
}) {
  const expired = invite.expires_at && new Date(invite.expires_at) < new Date();
  const used = invite.uses >= 1;

  let statusBadge;
  if (!invite.is_active) statusBadge = <Badge variant="destructive" className="text-[10px]">Desativado</Badge>;
  else if (expired) statusBadge = <Badge variant="destructive" className="text-[10px]">Expirado</Badge>;
  else if (used) statusBadge = <Badge className="text-[10px] bg-muted text-muted-foreground hover:bg-muted">Usado</Badge>;
  else statusBadge = <Badge className="text-[10px] bg-amber-500 text-white hover:bg-amber-600">Pendente</Badge>;

  return (
    <Card className={`p-4 rounded-2xl border-border/40 ${stale ? 'opacity-60' : 'bg-amber-500/5 border-amber-500/20'}`}>
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
          <LinkIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-bold text-sm">{invite.email || '(sem email)'}</p>
            {statusBadge}
            <Badge variant="outline" className="text-[10px] rounded-md">
              {invite.academy_modules?.type === 'mentoria' ? '🎯 ' : '📚 '}{invite.academy_modules?.title || '—'}
            </Badge>
          </div>
          {invite.note && <p className="text-xs text-muted-foreground font-light truncate">{invite.note}</p>}
          <p className="text-[10px] text-muted-foreground font-light mt-0.5">
            Criado {new Date(invite.created_at).toLocaleDateString('pt-BR')}
            {invite.expires_at && ` · Expira ${new Date(invite.expires_at).toLocaleDateString('pt-BR')}`}
          </p>
        </div>

        <div className="flex gap-1 shrink-0">
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={onCopy} title="Copiar link">
            <Copy className="w-3.5 h-3.5" />
          </Button>
          {!stale && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg gap-1 font-bold text-xs"
              onClick={() => {
                if (!invite.email) window.location.href = buildMailto(invite);
                else onSendEmail();
              }}
            >
              📧 {invite.email ? 'Enviar' : 'Email'}
            </Button>
          )}
          {invite.is_active && !stale && (
            <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={onRevoke}>Desativar</Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─── PRIVATE LESSONS DIALOG ────────────────────────────────────────────────
function PrivateLessonsDialog({ student, onClose }: { student: AcademyStudent | null; onClose: () => void }) {
  const {
    lessons, loading, listByStudent,
    uploadShared, createFromUrlShared,
    listAllPrivate, listLessonStudents,
    shareWithStudents, detachStudent, remove,
  } = usePrivateLessonsHook();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [inputMode, setInputMode] = useState<'file' | 'url'>('url');
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Lista de TODOS os alunos de mentoria (pra multi-select)
  const [mentorshipStudents, setMentorshipStudents] = useState<AcademyStudent[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Cache de alunos por aula (lessonId → LessonStudent[])
  const [lessonStudents, setLessonStudents] = useState<Record<string, { student_id: string; full_name: string }[]>>({});

  // Biblioteca
  const [libraryOpen, setLibraryOpen] = useState(false);

  useEffect(() => {
    if (student) {
      listByStudent(student.id);
      // Pré-seleciona o aluno atual
      setSelectedIds(new Set([student.id]));
    }
  }, [student, listByStudent]);

  // Carrega alunos de mentoria (pra multi-select) ao abrir
  useEffect(() => {
    if (!student) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('academy_students')
        .select('*')
        .eq('is_mentorship_client', true)
        .order('full_name', { ascending: true });
      setMentorshipStudents(data || []);
    })();
  }, [student]);

  // Pra cada aula da lista, busca os alunos compartilhando
  useEffect(() => {
    if (lessons.length === 0) return;
    (async () => {
      const map: Record<string, { student_id: string; full_name: string }[]> = {};
      await Promise.all(lessons.map(async (l) => {
        const sts = await listLessonStudents(l.id);
        map[l.id] = sts.map(s => ({ student_id: s.student_id, full_name: s.full_name }));
      }));
      setLessonStudents(map);
    })();
  }, [lessons, listLessonStudents]);

  if (!student) return null;

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleUpload = async () => {
    if (!title) return toast.error('Título é obrigatório');
    if (selectedIds.size === 0) return toast.error('Selecione pelo menos 1 aluno');
    if (inputMode === 'file' && !file) return toast.error('Selecione o arquivo de vídeo');
    if (inputMode === 'url' && !videoUrl) return toast.error('Cole o link do vídeo (Loom/YouTube/Vimeo)');
    setUploading(true);
    try {
      const ids = Array.from(selectedIds);
      if (inputMode === 'file') {
        await uploadShared(ids, file!, { title, description });
      } else {
        await createFromUrlShared(ids, videoUrl.trim(), { title, description });
      }
      setTitle(''); setDescription(''); setFile(null); setVideoUrl('');
      setSelectedIds(new Set([student.id]));
      await listByStudent(student.id);
    } finally {
      setUploading(false);
    }
  };

  const handleDetach = async (lessonId: string) => {
    if (!confirm(`Remover acesso do ${student.full_name} a esta aula? A aula continua existindo pros outros alunos.`)) return;
    const ok = await detachStudent(lessonId, student.id);
    if (ok) await listByStudent(student.id);
  };

  return (
    <>
    <Dialog open={!!student} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-extrabold tracking-tight">Aulas privadas · {student.full_name}</DialogTitle>
          <p className="text-xs text-muted-foreground font-light mt-1">
            Aulas de mentoria podem ser compartilhadas entre vários alunos (ex: uma call em grupo).
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <Card className="p-4 rounded-xl bg-muted/20 border-border/30">
            <h4 className="font-bold text-sm mb-3 flex items-center gap-2"><Upload className="w-4 h-4" /> Nova aula privada</h4>
            <div className="space-y-3">
              <div className="flex gap-2 p-1 rounded-xl bg-muted/40">
                <Button
                  type="button"
                  variant={inputMode === 'url' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex-1 rounded-lg text-xs font-bold"
                  onClick={() => setInputMode('url')}
                >
                  🔗 Loom / YouTube
                </Button>
                <Button
                  type="button"
                  variant={inputMode === 'file' ? 'default' : 'ghost'}
                  size="sm"
                  className="flex-1 rounded-lg text-xs font-bold"
                  onClick={() => setInputMode('file')}
                >
                  📁 Upload arquivo
                </Button>
              </div>
              {inputMode === 'url' ? (
                <div>
                  <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Link do vídeo</Label>
                  <Input
                    value={videoUrl}
                    onChange={e => setVideoUrl(e.target.value)}
                    className="rounded-xl mt-1"
                    placeholder="https://www.loom.com/share/abc123..."
                  />
                  <p className="text-[11px] text-muted-foreground font-light mt-1">
                    Loom precisa estar com acesso "qualquer pessoa com link". Também aceita YouTube e Vimeo.
                  </p>
                </div>
              ) : (
                <div>
                  <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Vídeo (MP4/MOV/WEBM)</Label>
                  <Input type="file" accept="video/*" onChange={e => setFile(e.target.files?.[0] || null)} className="rounded-xl mt-1" />
                </div>
              )}
              <div>
                <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Título</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} className="rounded-xl mt-1" placeholder="Ex: Call 01 - Diagnóstico da loja" />
              </div>
              <div>
                <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Descrição</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="rounded-xl mt-1" />
              </div>

              {/* Multi-select de alunos */}
              <div>
                <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">
                  Compartilhar com ({selectedIds.size})
                </Label>
                <div className="mt-2 p-3 rounded-xl border border-border/40 bg-background max-h-40 overflow-y-auto space-y-2">
                  {mentorshipStudents.length === 0 ? (
                    <p className="text-xs text-muted-foreground font-light">Nenhum aluno de mentoria cadastrado</p>
                  ) : mentorshipStudents.map(s => (
                    <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/30 p-1 rounded-lg">
                      <Checkbox
                        checked={selectedIds.has(s.id)}
                        onCheckedChange={() => toggleSelected(s.id)}
                      />
                      <span className="font-bold">{s.full_name}</span>
                      <span className="text-xs text-muted-foreground font-light">{s.email}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Button onClick={handleUpload} disabled={uploading || !title || selectedIds.size === 0} className="rounded-xl font-bold tracking-tight w-full">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                {inputMode === 'url' ? `Salvar aula (${selectedIds.size})` : `Enviar aula (${selectedIds.size})`}
              </Button>
            </div>
          </Card>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-sm">Aulas compartilhadas com {student.full_name} ({lessons.length})</h4>
              <Button variant="outline" size="sm" className="rounded-lg text-xs font-bold" onClick={() => setLibraryOpen(true)}>
                📚 Reaproveitar de biblioteca
              </Button>
            </div>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : lessons.length === 0 ? (
              <p className="text-xs text-muted-foreground font-light text-center py-4">Nenhuma aula privada ainda</p>
            ) : (
              <div className="space-y-2">
                {lessons.map(l => {
                  const sharedWith = lessonStudents[l.id] || [];
                  const names = sharedWith.map(s => s.full_name).filter(Boolean);
                  return (
                    <div key={l.id} className="rounded-xl border border-border/40 overflow-hidden">
                      <div className="p-3">
                        <div className="flex items-start gap-3">
                          <PlayCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm">{l.title}</p>
                            {l.description && <p className="text-xs text-muted-foreground font-light mt-0.5">{l.description}</p>}
                            {names.length > 0 && (
                              <div className="flex items-center gap-1 mt-2 flex-wrap">
                                <Users className="w-3 h-3 text-muted-foreground" />
                                <span className="text-[11px] text-muted-foreground font-light">{names.length} aluno{names.length > 1 ? 's' : ''}:</span>
                                {names.map((n, i) => (
                                  <Badge key={i} variant="secondary" className="text-[10px] rounded-md font-semibold">{n}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="default"
                              size="sm"
                              className="h-8 rounded-lg gap-1 font-bold"
                              onClick={() => window.open(`/academy/admin/aula/${l.id}`, '_blank')}
                              title="Abrir página da aula com player e materiais"
                            >
                              <PlayCircle className="w-3 h-3" /> Abrir
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 rounded-lg"
                              onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                            >
                              <Package className="w-3 h-3 mr-1" /> Materiais
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 rounded-lg text-xs"
                              onClick={() => handleDetach(l.id)}
                              title={`Remover ${student.full_name} dos alunos desta aula (sem deletar a aula)`}
                            >
                              Remover daqui
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                if (confirm('Excluir esta aula definitivamente? Todos os alunos perdem acesso.')) {
                                  remove(l).then(() => student && listByStudent(student.id));
                                }
                              }}
                              title="Excluir aula (remove pra todos os alunos)"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      {expanded === l.id && <div className="px-3 pb-3"><LessonMaterials lessonId={l.id} /></div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Sub-dialog: biblioteca de aulas privadas */}
    <LibraryPickerDialog
      open={libraryOpen}
      onClose={() => setLibraryOpen(false)}
      student={student}
      listAllPrivate={listAllPrivate}
      shareWithStudents={shareWithStudents}
      onShared={() => { listByStudent(student.id); setLibraryOpen(false); }}
    />
    </>
  );
}

// ─── LIBRARY PICKER ─────────────────────────────────────────────────────────
function LibraryPickerDialog({
  open, onClose, student, listAllPrivate, shareWithStudents, onShared,
}: {
  open: boolean;
  onClose: () => void;
  student: AcademyStudent;
  listAllPrivate: () => Promise<any[]>;
  shareWithStudents: (lessonId: string, studentIds: string[]) => Promise<boolean>;
  onShared: () => void;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const data = await listAllPrivate();
      setItems(data);
      setLoading(false);
    })();
  }, [open, listAllPrivate]);

  const handleShare = async (lessonId: string) => {
    setSharing(lessonId);
    const ok = await shareWithStudents(lessonId, [student.id]);
    setSharing(null);
    if (ok) onShared();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl rounded-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-extrabold tracking-tight">📚 Biblioteca de aulas privadas</DialogTitle>
          <p className="text-xs text-muted-foreground font-light mt-1">
            Escolha uma aula existente pra compartilhar com {student.full_name}.
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground font-light text-center py-6">Nenhuma aula privada criada ainda</p>
        ) : (
          <div className="space-y-2 mt-2">
            {items.map(l => (
              <div key={l.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/40 hover:border-primary/40 transition-colors">
                <PlayCircle className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{l.title}</p>
                  <p className="text-xs text-muted-foreground font-light">
                    {l.student_count} aluno{l.student_count !== 1 ? 's' : ''} · {new Date(l.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="rounded-lg text-xs font-bold"
                  onClick={() => handleShare(l.id)}
                  disabled={sharing === l.id}
                >
                  {sharing === l.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <>+ Compartilhar</>}
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── MODERATION ────────────────────────────────────────────────────────────
function ModerationTab() {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('academy_comments')
      .select('*, student:academy_students(full_name, email), lesson:academy_lessons(title, module_id)')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(100);
    setComments(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from('academy_comments').update({ is_deleted: true }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Comentário removido');
    load();
  };

  if (loading) return <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  return (
    <div>
      <p className="text-sm text-muted-foreground font-light mb-4">{comments.length} comentários ativos (100 mais recentes)</p>
      {comments.length === 0 ? (
        <Card className="p-12 text-center rounded-2xl border-border/40 border-dashed">
          <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground font-light">Sem comentários ainda.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {comments.map(c => (
            <Card key={c.id} className="p-4 rounded-xl border-border/40 flex gap-3">
              <Avatar className="h-9 w-9 flex-shrink-0">
                <AvatarFallback className="bg-muted text-xs font-bold">
                  {(c.student?.full_name || 'AL').substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-bold tracking-tight">{c.student?.full_name}</span>
                  <span className="text-[11px] text-muted-foreground font-light">{c.student?.email}</span>
                  <span className="text-[11px] text-muted-foreground font-light">·</span>
                  <span className="text-[11px] text-muted-foreground font-light">{new Date(c.created_at).toLocaleString('pt-BR')}</span>
                </div>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-primary mb-1">Em: {c.lesson?.title || 'aula removida'}</p>
                <p className="text-sm font-light leading-relaxed whitespace-pre-wrap">{c.body}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => { if (confirm('Remover este comentário?')) remove(c.id); }}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
