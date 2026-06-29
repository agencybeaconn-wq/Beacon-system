import { Download, ExternalLink, Github, Youtube, FileText, File, Film, Image as ImageIcon, Music, Package, Archive, Code2 } from 'lucide-react';
import type { AcademyMaterial } from '@/hooks/useAcademyMaterials';

interface Props {
  material: AcademyMaterial;
  onRemove?: () => void;
  compact?: boolean;
}

type Provider = {
  id: string;
  name: string;
  Icon: React.ComponentType<{ className?: string }>;
  gradient: string;      // tailwind classes pro fundo
  accent: string;         // cor do ícone
  cta: string;            // texto do CTA
};

function detectProvider(url: string, fileName: string, mimeType: string | null, isExternal: boolean): Provider {
  if (isExternal) {
    if (/github\.com/.test(url)) return {
      id: 'github', name: 'GitHub',
      Icon: Github,
      gradient: 'from-zinc-900 via-zinc-800 to-zinc-900',
      accent: 'text-emerald-400',
      cta: 'Abrir no GitHub',
    };
    if (/(docs|drive)\.google\.com/.test(url)) return {
      id: 'gdrive', name: 'Google Drive',
      Icon: FileText,
      gradient: 'from-blue-950 via-blue-900 to-indigo-950',
      accent: 'text-blue-300',
      cta: 'Abrir no Drive',
    };
    if (/notion\.(so|site)/.test(url)) return {
      id: 'notion', name: 'Notion',
      Icon: FileText,
      gradient: 'from-neutral-900 via-neutral-800 to-neutral-900',
      accent: 'text-neutral-200',
      cta: 'Abrir no Notion',
    };
    if (/(youtube\.com|youtu\.be)/.test(url)) return {
      id: 'youtube', name: 'YouTube',
      Icon: Youtube,
      gradient: 'from-red-950 via-red-900 to-rose-950',
      accent: 'text-red-400',
      cta: 'Assistir no YouTube',
    };
    if (/loom\.com/.test(url)) return {
      id: 'loom', name: 'Loom',
      Icon: Film,
      gradient: 'from-purple-950 via-violet-900 to-fuchsia-950',
      accent: 'text-violet-300',
      cta: 'Assistir no Loom',
    };
    if (/figma\.com/.test(url)) return {
      id: 'figma', name: 'Figma',
      Icon: Code2,
      gradient: 'from-pink-950 via-rose-900 to-purple-950',
      accent: 'text-pink-300',
      cta: 'Abrir no Figma',
    };
    return {
      id: 'link', name: 'Link externo',
      Icon: ExternalLink,
      gradient: 'from-slate-900 via-slate-800 to-slate-900',
      accent: 'text-primary',
      cta: 'Abrir link',
    };
  }
  // Arquivo local
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (mimeType?.startsWith('image/')) return {
    id: 'image', name: 'Imagem',
    Icon: ImageIcon,
    gradient: 'from-amber-950 via-orange-900 to-amber-950',
    accent: 'text-amber-300',
    cta: 'Visualizar',
  };
  if (mimeType?.startsWith('video/')) return {
    id: 'video', name: 'Vídeo',
    Icon: Film,
    gradient: 'from-indigo-950 via-blue-900 to-indigo-950',
    accent: 'text-indigo-300',
    cta: 'Assistir',
  };
  if (mimeType?.startsWith('audio/')) return {
    id: 'audio', name: 'Áudio',
    Icon: Music,
    gradient: 'from-teal-950 via-cyan-900 to-teal-950',
    accent: 'text-teal-300',
    cta: 'Ouvir',
  };
  if (mimeType === 'application/pdf') return {
    id: 'pdf', name: 'PDF',
    Icon: FileText,
    gradient: 'from-red-950 via-rose-900 to-red-950',
    accent: 'text-rose-300',
    cta: 'Ler PDF',
  };
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return {
    id: 'archive', name: 'Arquivo compactado',
    Icon: Archive,
    gradient: 'from-stone-900 via-neutral-800 to-stone-900',
    accent: 'text-stone-300',
    cta: 'Baixar .zip',
  };
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return {
    id: 'office', name: 'Documento Office',
    Icon: FileText,
    gradient: 'from-sky-950 via-blue-900 to-sky-950',
    accent: 'text-sky-300',
    cta: 'Abrir',
  };
  return {
    id: 'file', name: 'Arquivo',
    Icon: File,
    gradient: 'from-muted via-muted to-muted',
    accent: 'text-foreground',
    cta: 'Baixar',
  };
}

export function MaterialCard({ material, onRemove, compact }: Props) {
  const provider = detectProvider(material.file_url, material.file_name, material.mime_type, material.is_external_url);
  const { Icon } = provider;

  return (
    <div
      className={`group relative rounded-2xl bg-gradient-to-br ${provider.gradient} p-5 overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-black/30 border border-white/5`}
    >
      {/* Glow decorativo no canto */}
      <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-30 ${provider.accent.replace('text-', 'bg-')}`} />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center ${provider.accent}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-white/60 bg-white/5 px-2 py-1 rounded-md">
              {provider.name}
            </span>
            {onRemove && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
                className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-red-400 transition-colors"
                title="Remover"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <h4 className="text-base font-extrabold text-white tracking-tight mb-1 line-clamp-2">
          {material.title}
        </h4>
        {material.description && !compact && (
          <p className="text-xs text-white/60 font-light mb-3 line-clamp-2">
            {material.description}
          </p>
        )}
        <p className="text-[11px] text-white/40 font-mono truncate mb-4">
          {material.is_external_url
            ? material.file_url.replace(/^https?:\/\//, '').replace(/^www\./, '')
            : material.file_name}
        </p>

        <a
          href={material.file_url}
          target="_blank"
          rel="noopener noreferrer"
          {...(!material.is_external_url ? { download: material.file_name } : {})}
          className={`inline-flex items-center gap-2 text-sm font-bold ${provider.accent} group-hover:gap-3 transition-all`}
        >
          {material.is_external_url ? (
            <ExternalLink className="w-4 h-4" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {provider.cta}
        </a>
      </div>
    </div>
  );
}

export function MaterialGrid({ materials, onRemove }: {
  materials: AcademyMaterial[];
  onRemove?: (material: AcademyMaterial) => void;
}) {
  if (materials.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {materials.map(mat => (
        <MaterialCard
          key={mat.id}
          material={mat}
          onRemove={onRemove ? () => onRemove(mat) : undefined}
        />
      ))}
    </div>
  );
}
