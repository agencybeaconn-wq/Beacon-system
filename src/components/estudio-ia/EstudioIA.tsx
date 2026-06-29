import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useDashboard } from '@/contexts/DashboardContext';
import { supabase } from '@/integrations/supabase/client';
import { GoogleIntegrationService } from '@/services/googleIntegrationService';
import { buildJerseyPrompt, buildFreePrompt } from './PromptBuilder';
import type { JerseyView, PromptMode } from './PromptBuilder';
import {
  Sparkles, Download, Loader2, ImageIcon, Shirt, Upload, X, Camera, Copy,
  RefreshCw, ZoomIn, Settings2, FolderUp, ChevronUp, ChevronDown, Save,
  FolderPlus, Folder, Trash2, Images,
} from 'lucide-react';

interface GeneratedImage {
  id: string;
  base64: string | null;       // null quando carregado do Supabase
  storageUrl: string | null;   // URL pública do Supabase Storage
  storagePath: string | null;  // path no bucket para deletar
  mimeType: string;
  prompt: string;
  driveUrl: string | null;
  driveFileId: string | null;
  timestamp: Date;
  saved: boolean;
  storedInDb: boolean;         // já persistido no Supabase
}

interface ReferenceImage {
  id: string;
  base64: string;
  mimeType: string;
  name: string;
  preview: string;
}

const MODELS = [
  { value: 'gemini-2.5-flash-image', label: 'Nano Banana' },
  { value: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2' },
  { value: 'gemini-3-pro-image-preview', label: 'Nano Banana Pro' },
];

const ASPECT_RATIOS = [
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
];

const JERSEY_STYLES = [
  'Home Kit 2025/26', 'Away Kit 2025/26', 'Third Kit 2025/26',
  'Retro / Vintage', 'Training Kit', 'Goalkeeper Kit', 'Special Edition',
];

const MAX_REF_IMAGES = 10;
const MAX_FILE_SIZE_MB = 4;
const DRIVE_FOLDER_NAME = 'Studio IA';
const STORAGE_BUCKET = 'studio-ia';

export function EstudioIA() {
  const { workspaceId, selectedClientId } = useDashboard();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Config
  const [model, setModel] = useState('gemini-2.5-flash-image');
  const [aspectRatio, setAspectRatio] = useState('1:1');

  // Prompt
  const [prompt, setPrompt] = useState('');
  const [promptMode, setPromptMode] = useState<'free' | 'jersey'>('free');

  // Jersey params
  const [team, setTeam] = useState('');
  const [style, setStyle] = useState('Home Kit 2025/26');
  const [colors, setColors] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerNumber, setPlayerNumber] = useState('');
  const [view, setView] = useState<JerseyView>('front');
  const [jerseyMode, setJerseyMode] = useState<PromptMode>('catalog');
  const [extraDetails, setExtraDetails] = useState('');

  // Generation count
  const [genCount, setGenCount] = useState(1);

  // Reference images
  const [refImages, setRefImages] = useState<ReferenceImage[]>([]);

  // State
  const [loading, setLoading] = useState(false);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [gallery, setGallery] = useState<GeneratedImage[]>([]);
  const [modalImage, setModalImage] = useState<GeneratedImage | null>(null);
  const [expandedBar, setExpandedBar] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'model' | 'gallery'>('model');
  const [savingToDrive, setSavingToDrive] = useState<string | null>(null);
  const [driveFolderId, setDriveFolderId] = useState<string | null>(null);

  // Load gallery from Supabase when client changes
  useEffect(() => {
    if (!selectedClientId || !workspaceId) { setGallery([]); return; }

    const load = async () => {
      setLoadingGallery(true);
      try {
        const { data, error } = await supabase
          .from('studio_ia_images' as any)
          .select('id, prompt, public_url, storage_path, mime_type, model, aspect_ratio, created_at')
          .eq('client_id', selectedClientId)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;

        setGallery((data as any[]).map(row => ({
          id: row.id,
          base64: null,
          storageUrl: row.public_url,
          storagePath: row.storage_path,
          mimeType: row.mime_type,
          prompt: row.prompt,
          driveUrl: null,
          driveFileId: null,
          timestamp: new Date(row.created_at),
          saved: false,
          storedInDb: true,
        })));
      } catch (err) {
        console.error('Erro ao carregar galeria:', err);
      } finally {
        setLoadingGallery(false);
      }
    };

    load();
  }, [selectedClientId, workspaceId]);

  // Initialize Drive folder
  useEffect(() => {
    if (!workspaceId) return;
    const savedFolderId = localStorage.getItem(`studio_ia_folder_${workspaceId}`);
    if (savedFolderId) setDriveFolderId(savedFolderId);
  }, [workspaceId]);

  // Save a generated image to Supabase Storage + DB
  const saveToSupabase = useCallback(async (img: GeneratedImage) => {
    if (!selectedClientId || !workspaceId || !img.base64) return;
    try {
      const ext = img.mimeType === 'image/png' ? 'png' : 'jpg';
      const path = `${selectedClientId}/${img.id}.${ext}`;

      const byteChars = atob(img.base64);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArray], { type: img.mimeType });

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, blob, { contentType: img.mimeType, upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(path);

      const { error: dbError } = await supabase
        .from('studio_ia_images' as any)
        .insert({
          id: img.id,
          client_id: selectedClientId,
          workspace_id: workspaceId,
          prompt: img.prompt,
          storage_path: path,
          public_url: publicUrl,
          mime_type: img.mimeType,
          model,
          aspect_ratio: aspectRatio,
        });

      if (dbError) throw dbError;

      setGallery(prev => prev.map(g =>
        g.id === img.id
          ? { ...g, storageUrl: publicUrl, storagePath: path, storedInDb: true }
          : g
      ));
    } catch (err) {
      console.error('Erro ao salvar imagem no Supabase:', err);
    }
  }, [selectedClientId, workspaceId, model, aspectRatio]);

  const removeFromGallery = useCallback(async (id: string) => {
    const img = gallery.find(g => g.id === id);
    if (!img) return;

    // Remove do DB e storage se já foi persistido
    if (img.storedInDb && img.storagePath) {
      await supabase.storage.from(STORAGE_BUCKET).remove([img.storagePath]);
      await supabase.from('studio_ia_images' as any).delete().eq('id', id);
    }

    setGallery(prev => prev.filter(g => g.id !== id));
    if (modalImage?.id === id) setModalImage(null);
    toast.success('Imagem removida.');
  }, [gallery, modalImage]);

  const clearGallery = useCallback(async () => {
    const paths = gallery.filter(g => g.storagePath).map(g => g.storagePath!);
    if (paths.length) await supabase.storage.from(STORAGE_BUCKET).remove(paths);
    if (selectedClientId) {
      await supabase.from('studio_ia_images' as any).delete().eq('client_id', selectedClientId);
    }
    setGallery([]);
    setModalImage(null);
    toast.success('Galeria limpa.');
  }, [gallery, selectedClientId]);

  const ensureDriveFolder = async (): Promise<string | null> => {
    if (!workspaceId) {
      toast.error('Nenhum workspace selecionado.');
      return null;
    }
    if (driveFolderId) return driveFolderId;

    try {
      const folder = await GoogleIntegrationService.createFolder(workspaceId, DRIVE_FOLDER_NAME);
      setDriveFolderId(folder.id);
      localStorage.setItem(`studio_ia_folder_${workspaceId}`, folder.id);
      return folder.id;
    } catch (err) {
      console.error('Drive folder error:', err);
      toast.error('Erro ao criar pasta no Drive. Verifique a conexao Google.');
      return null;
    }
  };

  const addRefImages = useCallback((files: FileList | null) => {
    if (!files) return;
    const remaining = MAX_REF_IMAGES - refImages.length;
    if (remaining <= 0) {
      toast.error(`Maximo de ${MAX_REF_IMAGES} imagens de referencia.`);
      return;
    }

    const toProcess = Array.from(files).slice(0, remaining);
    for (const file of toProcess) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`"${file.name}" excede ${MAX_FILE_SIZE_MB}MB.`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setRefImages(prev => [...prev, {
          id: crypto.randomUUID(),
          base64: result.split(',')[1],
          mimeType: file.type,
          name: file.name,
          preview: result,
        }]);
      };
      reader.readAsDataURL(file);
    }
  }, [refImages.length]);

  const removeRefImage = (id: string) => setRefImages(prev => prev.filter(r => r.id !== id));

  const generate = useCallback(async (finalPrompt: string) => {
    if (!finalPrompt.trim()) {
      toast.error('Digite um prompt antes de gerar.');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Sessao expirada.'); return; }

      const body: Record<string, unknown> = {
        prompt: finalPrompt, model, aspectRatio,
        workspaceId: workspaceId || undefined,
      };
      if (refImages.length > 0) {
        body.referenceImages = refImages.map(r => ({ base64: r.base64, mimeType: r.mimeType }));
      }

      const { data, error } = await supabase.functions.invoke('gemini-image-gen', { body });
      if (error) {
        let errMsg = error.message;
        try {
          const ctx = (error as any).context;
          if (ctx?.json) { const b = await ctx.json(); errMsg = b?.error || errMsg; }
        } catch { /* */ }
        throw new Error(errMsg);
      }
      if (!data?.success) throw new Error(data?.error || 'Erro desconhecido');

      const newImage: GeneratedImage = {
        id: crypto.randomUUID(),
        base64: data.imageBase64,
        storageUrl: null,
        storagePath: null,
        mimeType: data.mimeType,
        prompt: finalPrompt,
        driveUrl: null,
        driveFileId: null,
        timestamp: new Date(),
        saved: false,
        storedInDb: false,
      };

      setGallery(prev => [newImage, ...prev]);
      toast.success('Imagem gerada!');
      saveToSupabase(newImage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar imagem');
    } finally {
      setLoading(false);
    }
  }, [model, aspectRatio, workspaceId, refImages]);

  const JERSEY_VIEWS = [
    { name: 'Frente', instruction: 'FRONT VIEW — jersey facing directly at camera, perfectly centered, crest and main sponsor fully visible.' },
    { name: 'Costas', instruction: 'BACK VIEW — jersey turned 180 degrees, showing full back panel. If visible in reference: player name and number centered.' },
    { name: 'Lateral', instruction: 'SIDE VIEW — jersey at 45-degree angle from the right, showing sleeve detail, side panel construction and fit.' },
    { name: 'Detalhe', instruction: 'CLOSE-UP DETAIL — zoomed in on the chest area showing crest, sponsor logo, fabric texture and stitching quality in high detail.' },
    { name: 'Manga', instruction: 'SLEEVE DETAIL — close-up of the sleeve showing any sleeve sponsor, fabric pattern, cuff construction and shoulder seam.' },
  ];

  const buildJerseyViewPrompt = (viewInstruction: string, extra: string) => `Based on the reference images provided, generate a professional e-commerce product photo of this exact football/soccer jersey.

View: ${viewInstruction}

Requirements:
- Ghost mannequin technique (invisible mannequin, no visible body parts)
- Light gray (#F0F0F0) seamless studio background
- Dry-fit polyester fabric with visible mesh texture and realistic drape
- 3-point studio lighting: key light 45° right, fill light left at 30%, rim light from above
- Reproduce the exact design, colors, crest, sponsors, badges, and patterns from the reference
- Photorealistic quality, no illustrations
- No wrinkles, no tags, no hangers, no watermarks${extra}`;

  const generateMultiple = useCallback(async (prompts: string[]) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Sessao expirada.'); return; }

      const baseBody: Record<string, unknown> = {
        model, aspectRatio,
        workspaceId: workspaceId || undefined,
      };
      if (refImages.length > 0) {
        baseBody.referenceImages = refImages.map(r => ({ base64: r.base64, mimeType: r.mimeType }));
      }

      const results = await Promise.allSettled(
        prompts.map(p => supabase.functions.invoke('gemini-image-gen', {
          body: { ...baseBody, prompt: p },
        }))
      );

      let successCount = 0;
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { data, error } = result.value;
          if (!error && data?.success) {
            const newImage: GeneratedImage = {
              id: crypto.randomUUID(),
              base64: data.imageBase64,
              storageUrl: null,
              storagePath: null,
              mimeType: data.mimeType,
              prompt: prompts[results.indexOf(result)],
              driveUrl: null, driveFileId: null,
              timestamp: new Date(), saved: false,
              storedInDb: false,
            };
            setGallery(prev => [newImage, ...prev]);
            saveToSupabase(newImage);
            successCount++;
          }
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} imagem${successCount > 1 ? 'ns' : ''} gerada${successCount > 1 ? 's' : ''}!`);
      } else {
        toast.error('Nenhuma imagem foi gerada. Tente novamente.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar imagens');
    } finally {
      setLoading(false);
    }
  }, [model, aspectRatio, workspaceId, refImages]);

  const handleGenerate = () => {
    if (promptMode === 'jersey') {
      const extra = prompt.trim() ? `\n\nAdditional instructions: ${prompt}` : '';
      const views = JERSEY_VIEWS.slice(0, genCount);
      const prompts = views.map(v => buildJerseyViewPrompt(v.instruction, extra));
      generateMultiple(prompts);
    } else {
      if (genCount > 1) {
        generateMultiple(Array(genCount).fill(buildFreePrompt(prompt)));
      } else {
        generate(buildFreePrompt(prompt));
      }
    }
  };

  const imgSrc = (img: GeneratedImage) =>
    img.base64 ? `data:${img.mimeType};base64,${img.base64}` : img.storageUrl ?? '';

  const downloadImage = (img: GeneratedImage) => {
    const ext = img.mimeType === 'image/png' ? 'png' : 'jpg';
    const link = document.createElement('a');
    link.href = imgSrc(img);
    link.download = `studio-ia-${Date.now()}.${ext}`;
    link.click();
  };

  const saveToDrive = async (img: GeneratedImage) => {
    setSavingToDrive(img.id);
    try {
      const folderId = await ensureDriveFolder();
      if (!folderId || !workspaceId) return;

      const ext = img.mimeType === 'image/png' ? 'png' : 'jpg';
      const fileName = `studio-ia-${Date.now()}.${ext}`;

      // Convert base64 or fetch storageUrl to File
      let file: File;
      if (img.base64) {
        const byteChars = atob(img.base64);
        const byteArray = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
        file = new File([byteArray], fileName, { type: img.mimeType });
      } else if (img.storageUrl) {
        const resp = await fetch(img.storageUrl);
        const blob = await resp.blob();
        file = new File([blob], fileName, { type: img.mimeType });
      } else {
        toast.error('Imagem sem dados para salvar no Drive.');
        return;
      }

      const driveFile = await GoogleIntegrationService.uploadFile(workspaceId, file, folderId, fileName);

      setGallery(prev => prev.map(g =>
        g.id === img.id
          ? { ...g, saved: true, driveFileId: driveFile.id, driveUrl: driveFile.webViewLink || null }
          : g
      ));
      if (modalImage?.id === img.id) {
        setModalImage(prev => prev ? { ...prev, saved: true, driveFileId: driveFile.id, driveUrl: driveFile.webViewLink || null } : null);
      }
      toast.success('Salvo no Google Drive!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar no Drive');
    } finally {
      setSavingToDrive(null);
    }
  };

  const reusePrompt = (img: GeneratedImage) => {
    setPrompt(img.prompt);
    setPromptMode('free');
    setModalImage(null);
    toast.success('Prompt copiado.');
  };

  const copyPrompt = (img: GeneratedImage) => {
    navigator.clipboard.writeText(img.prompt);
    toast.success('Prompt copiado!');
  };

  const regenerate = (img: GeneratedImage) => {
    setModalImage(null);
    generate(img.prompt);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] relative">
      {/* Main Gallery Area */}
      <div className="flex-1 overflow-y-auto pb-64">
        {loadingGallery ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
            <Loader2 className="h-8 w-8 animate-spin opacity-30" />
            <p className="text-sm">Carregando galeria...</p>
          </div>
        ) : !selectedClientId ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
            <ImageIcon className="h-20 w-20 opacity-10" />
            <div className="text-center">
              <p className="text-lg font-medium">Studio IA</p>
              <p className="text-sm">Selecione um cliente no dropdown para ver a galeria</p>
            </div>
          </div>
        ) : gallery.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
            <ImageIcon className="h-20 w-20 opacity-10" />
            <div className="text-center">
              <p className="text-lg font-medium">Studio IA</p>
              <p className="text-sm">Nenhuma imagem gerada para este cliente ainda</p>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3">
              {loading && (
                <div className="break-inside-avoid">
                  <Skeleton className="w-full aspect-square rounded-lg" />
                </div>
              )}
              {gallery.map(img => (
                <div
                  key={img.id}
                  className="break-inside-avoid group relative cursor-pointer rounded-lg overflow-hidden"
                  onClick={() => setModalImage(img)}
                >
                  <img
                    src={imgSrc(img)}
                    alt="Generated"
                    className="w-full rounded-lg transition-transform group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center rounded-lg">
                    <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); removeFromGallery(img.id); }}
                    className="absolute top-2 left-2 bg-black/60 hover:bg-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                  {img.saved && (
                    <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                      <Save className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating Bottom Bar */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 w-[calc(100%-5rem)] max-w-[960px]">
        <div style={{ background: '#1c1c1e', borderRadius: '28px', boxShadow: '0 20px 100px rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>

          {/* Ref images row */}
          {refImages.length > 0 && (
            <div style={{ padding: '24px 32px 8px' }} className="flex items-center gap-4 overflow-x-auto">
              {refImages.map(ref => (
                <div key={ref.id} className="relative flex-shrink-0 group">
                  <img
                    src={ref.preview}
                    alt={ref.name}
                    style={{ height: 72, width: 72, borderRadius: 16 }}
                    className="object-cover ring-1 ring-white/10"
                  />
                  <button
                    onClick={() => removeRefImage(ref.id)}
                    className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ height: 72, width: 72, borderRadius: 16, border: '2px dashed rgba(255,255,255,0.2)' }}
                className="flex flex-col items-center justify-center flex-shrink-0 hover:border-red-500 hover:bg-red-500/5 transition-colors gap-1"
              >
                <Upload className="h-5 w-5 text-white/30" />
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>Adicionar</span>
              </button>
            </div>
          )}

          {/* Prompt area */}
          <div style={{ padding: '28px 32px 16px' }}>
            <textarea
              placeholder={promptMode === 'jersey'
                ? 'Instrucoes extras (opcional)... O prompt padrao ja esta embutido.'
                : 'Descreva a imagem que deseja gerar...'}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                minHeight: 90,
                maxHeight: 180,
                fontSize: 16,
                lineHeight: 1.6,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#fff',
                resize: 'none',
                fontFamily: 'inherit',
              }}
              className="placeholder:text-white/25"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
            />
          </div>

          {/* Jersey fields removed - prompt + ref images are enough */}

          {/* Bottom controls row */}
          <div style={{ padding: '0 32px 24px' }} className="flex items-center gap-3">
            {/* Model selector + Gallery */}
            <Popover open={showSettings} onOpenChange={open => { setShowSettings(open); if (!open) setSettingsTab('model'); }}>
              <PopoverTrigger asChild>
                <button
                  style={{ height: 44, borderRadius: 14, padding: '0 18px', background: 'rgba(255,255,255,0.07)', fontSize: 14 }}
                  className="flex items-center gap-2 hover:bg-white/[0.12] transition-colors text-white/80 flex-shrink-0 font-medium"
                >
                  <Sparkles className="h-4 w-4" />
                  {MODELS.find(m => m.value === model)?.label || 'Modelo'}
                  {gallery.length > 0 && (
                    <span style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '1px 7px', fontSize: 11 }} className="text-white/60">
                      {gallery.length}
                    </span>
                  )}
                  <ChevronUp className="h-3.5 w-3.5 text-white/30 ml-1" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0 overflow-hidden" style={{ background: '#2c2c2e', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)' }} side="top" align="start">
                {/* Tabs */}
                <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '6px 6px 0' }}>
                  <button
                    onClick={() => setSettingsTab('model')}
                    style={{ height: 36, borderRadius: '10px 10px 0 0', padding: '0 16px', fontSize: 13 }}
                    className={`font-medium transition-colors flex items-center gap-1.5 ${settingsTab === 'model' ? 'text-white bg-white/[0.08]' : 'text-white/40 hover:text-white/70'}`}
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Modelo
                  </button>
                  <button
                    onClick={() => setSettingsTab('gallery')}
                    style={{ height: 36, borderRadius: '10px 10px 0 0', padding: '0 16px', fontSize: 13 }}
                    className={`font-medium transition-colors flex items-center gap-1.5 ${settingsTab === 'gallery' ? 'text-white bg-white/[0.08]' : 'text-white/40 hover:text-white/70'}`}
                  >
                    <Images className="h-3.5 w-3.5" /> Galeria
                    {gallery.length > 0 && (
                      <span style={{ background: 'rgba(239,68,68,0.3)', borderRadius: 6, padding: '0 5px', fontSize: 10 }} className="text-red-400">
                        {gallery.length}
                      </span>
                    )}
                  </button>
                </div>

                {settingsTab === 'model' ? (
                  <div className="p-5 space-y-5">
                    <div>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600 }}>Modelo</p>
                      <div className="flex flex-col gap-2 mt-3">
                        {MODELS.map(m => (
                          <button
                            key={m.value}
                            style={{ height: 44, borderRadius: 14, padding: '0 18px', fontSize: 14 }}
                            className={`text-left transition-colors font-medium ${model === m.value ? 'bg-red-600 text-white' : 'bg-white/[0.06] text-white/80 hover:bg-white/[0.1]'}`}
                            onClick={() => { setModel(m.value); setShowSettings(false); }}
                          >{m.label}</button>
                        ))}
                      </div>
                    </div>
                    {promptMode === 'jersey' && (
                      <>
                        <div>
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600 }}>Modo</p>
                          <div className="flex gap-2 mt-3">
                            <button style={{ height: 40, borderRadius: 12, fontSize: 14 }} className={`flex-1 font-medium ${jerseyMode === 'catalog' ? 'bg-red-600 text-white' : 'bg-white/[0.06] text-white/80 hover:bg-white/[0.1]'}`} onClick={() => setJerseyMode('catalog')}>Catalogo</button>
                            <button style={{ height: 40, borderRadius: 12, fontSize: 14 }} className={`flex-1 font-medium ${jerseyMode === 'lifestyle' ? 'bg-red-600 text-white' : 'bg-white/[0.06] text-white/80 hover:bg-white/[0.1]'}`} onClick={() => setJerseyMode('lifestyle')}>Lifestyle</button>
                          </div>
                        </div>
                        <div>
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600 }}>View</p>
                          <div className="flex gap-2 mt-3">
                            {(['front', 'back', 'side', 'all'] as JerseyView[]).map(v => (
                              <button key={v} style={{ height: 40, borderRadius: 12, fontSize: 14 }} className={`flex-1 font-medium ${view === v ? 'bg-red-600 text-white' : 'bg-white/[0.06] text-white/80 hover:bg-white/[0.1]'}`} onClick={() => setView(v)}>
                                {v === 'front' ? 'Front' : v === 'back' ? 'Back' : v === 'side' ? 'Side' : 'All'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600 }}>Estilo</p>
                          <Select value={style} onValueChange={setStyle}>
                            <SelectTrigger style={{ height: 44, borderRadius: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', marginTop: 12, fontSize: 14 }}><SelectValue /></SelectTrigger>
                            <SelectContent>{JERSEY_STYLES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="p-5">
                    {gallery.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 gap-2">
                        <Images className="h-8 w-8 text-white/15" />
                        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Nenhuma imagem salva</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                            {gallery.length} imagem{gallery.length > 1 ? 'ns' : ''} salva{gallery.length > 1 ? 's' : ''}
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', display: 'block' }}>
                              Máx. {MAX_PERSISTED_IMAGES} — persiste entre sessões
                            </span>
                          </p>
                          <button
                            onClick={clearGallery}
                            style={{ height: 32, borderRadius: 10, padding: '0 12px', fontSize: 12 }}
                            className="flex items-center gap-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 transition-colors font-medium"
                          >
                            <Trash2 className="h-3 w-3" />
                            Limpar tudo
                          </button>
                        </div>

                        {/* Thumbnail grid */}
                        <div className="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto">
                          {gallery.map(img => (
                            <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden cursor-pointer"
                              onClick={() => { setModalImage(img); setShowSettings(false); }}
                            >
                              <img
                                src={imgSrc(img)}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                                <button
                                  onClick={e => { e.stopPropagation(); removeFromGallery(img.id); }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 rounded-full p-0.5"
                                >
                                  <X className="h-2.5 w-2.5 text-white" />
                                </button>
                              </div>
                              {img.saved && (
                                <div className="absolute bottom-0.5 right-0.5 bg-green-500 rounded-full p-0.5">
                                  <Save className="h-2 w-2 text-white" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* Aspect ratio */}
            <button
              style={{ height: 44, borderRadius: 14, padding: '0 18px', background: 'rgba(255,255,255,0.07)', fontSize: 14 }}
              className="flex items-center gap-2 hover:bg-white/[0.12] transition-colors text-white/80 flex-shrink-0 font-medium"
              onClick={() => {
                const idx = ASPECT_RATIOS.findIndex(a => a.value === aspectRatio);
                setAspectRatio(ASPECT_RATIOS[(idx + 1) % ASPECT_RATIOS.length].value);
              }}
            >
              <ImageIcon className="h-4 w-4" />
              {aspectRatio}
            </button>

            {/* Mode toggle */}
            <button
              style={{ height: 44, borderRadius: 14, padding: '0 18px', fontSize: 14, background: promptMode === 'jersey' ? undefined : 'rgba(255,255,255,0.07)' }}
              className={`flex items-center gap-2 transition-colors flex-shrink-0 font-medium ${
                promptMode === 'jersey' ? 'bg-red-600 text-white' : 'text-white/80 hover:bg-white/[0.12]'
              }`}
              onClick={() => setPromptMode(prev => prev === 'free' ? 'jersey' : 'free')}
            >
              {promptMode === 'jersey' ? <Shirt className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
              {promptMode === 'jersey' ? 'Camisas' : 'Livre'}
            </button>

            {/* Ref images + count */}
            <button
              style={{ height: 44, borderRadius: 14, padding: '0 18px', background: 'rgba(255,255,255,0.07)', fontSize: 14 }}
              className="flex items-center gap-2 hover:bg-white/[0.12] transition-colors text-white/80 flex-shrink-0 font-medium"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              <span>Imagens</span>
            </button>

            <div className="flex items-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 14, height: 44, padding: '0 6px', gap: 2 }}>
              <button
                onClick={() => setGenCount(Math.max(1, genCount - 1))}
                style={{ width: 32, height: 32, borderRadius: 8, fontSize: 18, lineHeight: 1 }}
                className="text-white/50 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
              >-</button>
              <span style={{ fontSize: 15, width: 24, lineHeight: '44px', textAlign: 'center' }} className="text-white/90 font-bold">{genCount}</span>
              <button
                onClick={() => setGenCount(Math.min(5, genCount + 1))}
                style={{ width: 32, height: 32, borderRadius: 8, fontSize: 18, lineHeight: 1 }}
                className="text-white/50 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
              >+</button>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={loading || (promptMode === 'free' && !prompt.trim()) || (promptMode === 'jersey' && refImages.length === 0)}
              style={{ height: 52, borderRadius: 18, padding: '0 48px', fontSize: 17 }}
              className="flex-1 max-w-[280px] ml-auto bg-red-600 hover:bg-red-500 disabled:opacity-20 text-white font-bold flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-red-600/30"
            >
              {loading
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : <Sparkles className="h-5 w-5" />
              }
              {loading ? 'Gerando...' : genCount > 1 ? `Gerar  +${genCount}` : 'Gerar'}
            </button>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => { addRefImages(e.target.files); e.target.value = ''; }}
        />
      </div>

      {/* Image Modal */}
      <Dialog open={!!modalImage} onOpenChange={() => setModalImage(null)}>
        <DialogContent className="max-w-5xl max-h-[95vh] p-0 overflow-hidden">
          <DialogTitle className="sr-only">Imagem gerada</DialogTitle>
          {modalImage && (
            <div className="flex flex-col md:flex-row h-full">
              {/* Image */}
              <div className="flex-1 bg-black/5 dark:bg-black/30 flex items-center justify-center p-6 min-h-[300px]">
                <img
                  src={imgSrc(modalImage)}
                  alt="Generated"
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              </div>

              {/* Sidebar */}
              <div className="w-full md:w-80 border-t md:border-t-0 md:border-l p-5 pt-10 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" onClick={() => downloadImage(modalImage)} className="w-full">
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant={modalImage.saved ? 'secondary' : 'outline'}
                    onClick={() => !modalImage.saved && saveToDrive(modalImage)}
                    disabled={savingToDrive === modalImage.id || modalImage.saved}
                    className="w-full"
                  >
                    {savingToDrive === modalImage.id
                      ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      : <FolderUp className="h-3.5 w-3.5 mr-1.5" />
                    }
                    {modalImage.saved ? 'Salvo' : 'Salvar no Drive'}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" onClick={() => reusePrompt(modalImage)} className="w-full">
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Reutilizar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => regenerate(modalImage)} className="w-full">
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    Gerar Novo
                  </Button>
                </div>

                <Button size="sm" variant="ghost" onClick={() => copyPrompt(modalImage)} className="w-full">
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copiar Prompt
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeFromGallery(modalImage.id)}
                  className="w-full text-red-500 hover:text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Remover da galeria
                </Button>

                {modalImage.driveUrl && (
                  <a
                    href={modalImage.driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Folder className="h-3 w-3" />
                    Ver no Google Drive
                  </a>
                )}

                <div className="bg-muted/50 rounded-md p-3">
                  <p className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Prompt</p>
                  <p className="text-xs text-foreground whitespace-pre-wrap max-h-[200px] overflow-y-auto leading-relaxed">
                    {modalImage.prompt}
                  </p>
                </div>

                <p className="text-[10px] text-muted-foreground">
                  {modalImage.timestamp.toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
