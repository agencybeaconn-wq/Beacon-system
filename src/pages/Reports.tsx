import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  FileText,
  MessageSquare,
  Download,
  Clock,
  Calendar as CalendarIcon,
  CheckCircle2,
  Search,
  Filter,
  MoreHorizontal,
  Plus,
  ArrowRight,
  ShoppingBag,
  Target,
  Zap,
  Loader2,
  FileSpreadsheet,
  Brain,
  Image as ImageIcon,
  CalendarRange,
  Trash2,
  Users,
  Building2,
  ChevronDown,
  Settings,
  Upload,
  Mail
} from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { resendReportEmail, ReportMetrics } from "@/lib/reportService";


// Mock History Data
const initialHistory = [
  { id: "REL-001", client: "Pizzaria do João", type: "E-commerce", date: new Date(2025, 11, 20), status: "success", method: "Email", recipient: "joao@pizzaria.com" },
  { id: "REL-002", client: "Academia Fit", type: "Geração de Leads", date: new Date(2025, 11, 19), status: "success", method: "Download", recipient: "-" },
  { id: "REL-003", client: "Curso Inglês", type: "Infoproduto", date: new Date(2025, 11, 18), status: "failed", method: "Email", recipient: "contato@cursoingles.com" },
];

const initialSchedules = [
  { id: "SCH-01", name: "Resumo Semanal Diretoria", template: "E-commerce", periodicity: "Semanal (Segunda)", recipient: "diretoria@empresa.com", nextRun: "24/12/2025", status: "active" },
  { id: "SCH-02", name: "Report Diário de Leads", template: "Geração de Leads", periodicity: "Diário (09:00)", recipient: "gestor@leads.com", nextRun: "22/12/2025", status: "active" },
];

export default function Reports({ isEmbedded }: { isEmbedded?: boolean }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'manual' | 'automation'>('manual');
  const [history, setHistory] = useState(initialHistory);
  const [schedules, setSchedules] = useState(initialSchedules);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("all");

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // New Schedule State
  const [newSchedule, setNewSchedule] = useState({
    name: "",
    template: "ecommerce",
    periodicity: "Semanal",
    email: ""
  });
  const [manualEmail, setManualEmail] = useState("");


  // Advanced Config State
  const [aiAnalysis, setAiAnalysis] = useState(false);
  const [whiteLabel, setWhiteLabel] = useState(true); // Default true if configured
  const [agencyName, setAgencyName] = useState("");
  const [agencyLogo, setAgencyLogo] = useState("");
  const [agencyColor, setAgencyColor] = useState("#7C3AED"); // Default purple
  const [resendingReportId, setResendingReportId] = useState<string | null>(null);

  // Load Agency Settings & Clients
  useEffect(() => {
    // Load White Label Settings
    const savedName = localStorage.getItem('lads_agency_name');
    const savedLogo = localStorage.getItem('lads_agency_logo');
    const savedColor = localStorage.getItem('lads_agency_color');
    if (savedName) setAgencyName(savedName);
    if (savedLogo) setAgencyLogo(savedLogo);
    if (savedColor) setAgencyColor(savedColor);


    // Load Clients
    const fetchClients = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('agency_clients')
          .select('id, name')
          .eq('user_id', user.id)
          .order('name');
        if (data) setClients(data);
      }
    };
    fetchClients();
  }, []);

  const generatePDF = async (template: string, clientName: string) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Get branding from localStorage
    const brandColor = agencyColor || localStorage.getItem('lads_agency_color') || '#7C3AED';
    const brandName = agencyName || localStorage.getItem('lads_agency_name') || 'Beacon';
    const brandLogo = agencyLogo || localStorage.getItem('lads_agency_logo') || '';

    // Convert hex to RGB for jsPDF
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 124, g: 58, b: 237 }; // Default purple
    };

    const rgb = hexToRgb(brandColor);
    const textDark = { r: 26, g: 32, b: 44 }; // #1A202C
    const textMuted = { r: 113, g: 128, b: 150 }; // #718096

    // ============================================
    // HEADER - Branded Cover Section
    // ============================================
    const headerHeight = 60;
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');

    // Calculate vertical centers
    const logoSize = 32;
    const logoY = (headerHeight - logoSize) / 2;

    // Logo (left aligned, vertically centered)
    if (brandLogo) {
      try {
        doc.addImage(brandLogo, 'PNG', 15, logoY, logoSize, logoSize);
      } catch (e) {
        console.error("Error adding logo to PDF", e);
      }
    }

    // Text (centered horizontally in the page)
    const textCenterX = pageWidth / 2;

    // Main Title
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("Weekly Performance Report", textCenterX, 25, { align: "center" });

    // Subtitle
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(255, 255, 255);
    const period = `${format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), "MMM dd")} - ${format(new Date(), "MMM dd, yyyy")}`;
    doc.text(`Client: ${clientName}  |  Period: ${period}`, textCenterX, 34, { align: "center" });
    doc.text(`Report Type: ${template}`, textCenterX, 40, { align: "center" });


    // ============================================
    // KPI CARDS - Overview Section
    // ============================================
    const kpiY = 80;
    doc.setFontSize(14);
    doc.setTextColor(rgb.r, rgb.g, rgb.b);
    doc.setFont("helvetica", "bold");
    doc.text("Performance Overview", 15, kpiY);

    // KPI data (would come from real metrics in production)
    const kpis = [
      { label: "Total Spend", value: "$5,200" },
      { label: "ROAS", value: "2.45x" },
      { label: "Conversions", value: "127" },
      { label: "Revenue", value: "$12,740" }
    ];

    const cardWidth = (pageWidth - 45) / 4;
    const cardHeight = 35; // Increased height for larger numbers

    kpis.forEach((kpi, index) => {
      const x = 15 + (index * (cardWidth + 5));
      const y = kpiY + 10;

      // Card background
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'F');

      // Accent line at top
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.rect(x, y, cardWidth, 3, 'F');

      // Label
      doc.setFontSize(9); // Size 9 for labels
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.setFont("helvetica", "bold"); // Bold label
      doc.text(kpi.label.toUpperCase(), x + 8, y + 14);

      // Value - Large and prominent
      doc.setFontSize(20); // Increased from 14 to 20
      doc.setTextColor(textDark.r, textDark.g, textDark.b);
      doc.setFont("helvetica", "bold");
      doc.text(kpi.value, x + 8, y + 26);
    });

    // ============================================
    // ADDITIONAL METRICS
    // ============================================
    const metricsY = kpiY + 65;
    doc.setFontSize(14);
    doc.setTextColor(rgb.r, rgb.g, rgb.b);
    doc.setFont("helvetica", "bold");
    doc.text("Detailed Metrics", 15, metricsY);

    const detailedMetrics = [
      { label: "Impressions", value: "145,000" },
      { label: "Clicks", value: "3,450" },
      { label: "Click-Through Rate (CTR)", value: "2.38%" },
      { label: "Cost per Click (CPC)", value: "$1.51" },
      { label: "Cost per Acquisition (CPA)", value: "$40.94" }
    ];

    doc.setFontSize(10);
    detailedMetrics.forEach((m, i) => {
      const y = metricsY + 12 + (i * 9); // Increased spacing
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.setFont("helvetica", "normal");
      doc.text(m.label, 20, y);
      doc.setTextColor(textDark.r, textDark.g, textDark.b);
      doc.setFont("helvetica", "bold");
      doc.text(m.value, 110, y); // Aligned further right
    });

    // ============================================
    // AI INSIGHTS SECTION (Client-Facing & Adaptive)
    // ============================================
    if (aiAnalysis) {
      const insightY = metricsY + 65;

      // Section title
      doc.setFontSize(14);
      doc.setTextColor(rgb.r, rgb.g, rgb.b);
      doc.setFont("helvetica", "bold");
      doc.text("Performance Analysis", 15, insightY);

      // Prepare text content
      const insightText = "Your campaign delivered strong results this period with a 2.45x return on ad spend. Audience engagement increased significantly, with conversion rates up 15% compared to last week. Your investment is performing efficiently, and we continue to optimize targeting to maximize your results.";

      // Calculate layout dynamically
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const textWidth = pageWidth - 50; // Text area width
      const splitText = doc.splitTextToSize(insightText, textWidth);
      const lineHeight = 5;
      const textBlockHeight = splitText.length * lineHeight;
      const padding = 20; // 10 top + 10 bottom
      const boxHeight = textBlockHeight + padding;

      const boxY = insightY + 8;

      // Light background
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, boxY, pageWidth - 30, boxHeight, 2, 2, 'F');

      // Left accent border
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.rect(15, boxY, 4, boxHeight, 'F');

      // Render Text
      doc.setTextColor(textDark.r, textDark.g, textDark.b);
      doc.text(splitText, 25, boxY + 12); // Start text with padding
    }



    // ============================================
    // FOOTER
    // ============================================
    const footerY = pageHeight - 15;

    // Horizontal line
    doc.setDrawColor(rgb.r, rgb.g, rgb.b);
    doc.setLineWidth(0.5);
    doc.line(15, footerY - 8, pageWidth - 15, footerY - 8);

    // Footer text
    doc.setFontSize(8);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.setFont("helvetica", "normal");
    doc.text(`Report generated by ${brandName} via Beacon infrastructure.`, 15, footerY);
    doc.text(format(new Date(), "MMMM dd, yyyy 'at' HH:mm"), pageWidth - 15, footerY, { align: 'right' });

    return doc;
  };


  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setAgencyLogo(base64String);
        localStorage.setItem('lads_agency_logo', base64String);
        toast.success(t('reports.config.whitelabel.upload_success', "Logo carregada com sucesso!"));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveSettings = () => {
    localStorage.setItem('lads_agency_name', agencyName);
    localStorage.setItem('lads_agency_logo', agencyLogo);
    localStorage.setItem('lads_agency_color', agencyColor);
    toast.success(t('reports.config.save_success', "Configurações salvas!"));
    setIsSettingsOpen(false);
  };

  const handleOpenConfig = (type: string) => {
    if (selectedClient === 'all') {
      toast.error(t('reports.generate_dialog.select_client_error', "Selecione um cliente primeiro para gerar o relatório."));
      return;
    }
    setSelectedTemplate(type);
    setConfigOpen(true);
  };

  const handleGenerate = async (method: 'email' | 'download') => {
    setIsGenerating(true);

    if (method === 'email' && !manualEmail) {
      toast.error(t('common.fill_required', "Preencha o e-mail de destino."));
      setIsGenerating(false);
      return;
    }

    const clientName = clients.find(c => c.id === selectedClient)?.name || "Cliente Desconhecido";
    const doc = await generatePDF(selectedTemplate || "Relatório", clientName);

    setTimeout(() => {
      setIsGenerating(false);
      setConfigOpen(false);

      if (method === 'download') {
        doc.save(`Relatorio-${clientName}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      }

      const newReport = {
        id: `REL-${Math.floor(Math.random() * 1000)}`,
        client: clientName,
        type: selectedTemplate || "Personalizado",
        date: new Date(),
        status: "success",
        method: method === 'email' ? 'Email' : 'Download',
        recipient: method === 'email' ? manualEmail : '-'
      };

      setHistory([newReport, ...history]);

      const features = [];
      if (aiAnalysis) features.push(t('reports.generate_dialog.ai_insights', "Análise IA"));
      if (whiteLabel && agencyName) features.push(`White-Label (${agencyName})`);

      toast.success(method === 'email' ? t('reports.generate_dialog.sent_success', "Relatório enviado!") : t('reports.generate_dialog.download_started', "Download iniciado!"), {
        description: features.length > 0
          ? `${t('common.client', 'Cliente')}: ${clientName}. ${t('common.including', 'Incluindo')}: ${features.join(", ")}.`
          : t('reports.generate_dialog.generate_success_desc', { name: clientName, defaultValue: `Relatório de ${clientName} gerado com sucesso.` }),
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />
      });

    }, 2000);
  };

  const handleCreateSchedule = () => {
    if (!newSchedule.name || !newSchedule.email) {
      toast.error(t('common.fill_required', "Preencha todos os campos obrigatórios."));
      return;
    }

    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setIsScheduleDialogOpen(false);

      setSchedules([...schedules, {
        id: `SCH-${Math.floor(Math.random() * 1000)}`,
        name: newSchedule.name,
        template: newSchedule.template === 'ecommerce' ? 'E-commerce' : newSchedule.template === 'leadgen' ? 'Geração de Leads' : 'Infoproduto',
        periodicity: newSchedule.periodicity,
        recipient: newSchedule.email,
        nextRun: format(new Date(new Date().setDate(new Date().getDate() + 7)), "dd/MM/yyyy"),
        status: "active"
      }]);

      toast.success(t('reports.automations.dialog.success', "Agendamento criado!"), {
        description: t('reports.automations.dialog.success_desc', { recipient: newSchedule.email, defaultValue: `Relatório agendado para ${newSchedule.email}. Logo da agência será aplicada.` }),
      });

      setNewSchedule({ name: "", template: "ecommerce", periodicity: "Semanal", email: "" });

    }, 1000);
  };

  // Handle downloading a PDF from history
  const handleDownloadPdf = async (reportItem: typeof history[0]) => {
    try {
      toast.loading(t('reports.history.actions.generating_pdf', "Gerando PDF..."), { id: 'download-pdf' });

      // Regenerate the PDF
      const pdfDoc = await generatePDF(reportItem.type, reportItem.client);

      // Download it
      pdfDoc.save(`Relatorio-${reportItem.client}-${format(reportItem.date, "yyyy-MM-dd")}.pdf`);

      toast.success(t('reports.history.actions.download_success', "Download concluído!"), {
        id: 'download-pdf',
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />
      });
    } catch (error) {
      console.error('[Reports] Error downloading PDF:', error);
      toast.error(t('reports.history.actions.download_error', "Erro ao gerar PDF."), {
        id: 'download-pdf'
      });
    }
  };

  // Handle resending a report email with AI insights
  const handleResendEmail = async (reportItem: typeof history[0]) => {

    if (!reportItem.recipient || reportItem.recipient === '-') {
      toast.error(t('reports.history.actions.no_recipient', "Este relatório não tem destinatário de e-mail."));
      return;
    }

    setResendingReportId(reportItem.id);

    try {
      // Mock metrics - In production, these would come from the actual report data or database
      const mockMetrics: ReportMetrics = {
        roas: 2.45,
        spend: 5200,
        conversions: 127,
        revenue: 12740,
        clicks: 3450,
        impressions: 145000,
        ctr: 0.0238,
        cpc: 1.51
      };

      // Regenerate the PDF for attachment
      const pdfDoc = await generatePDF(reportItem.type, reportItem.client);

      // Show progress toast
      toast.loading(t('reports.history.actions.sending', "Gerando análise IA e enviando e-mail..."), { id: 'resend-email' });

      // Send the email via Edge Function with report link (PDF uploaded to Storage)
      const result = await resendReportEmail(
        reportItem.recipient,
        reportItem.client,
        mockMetrics,
        pdfDoc,
        reportItem.id  // Pass report ID for unique filename
      );


      if (result.success) {
        // Update history status from 'failed' to 'success'
        setHistory(prev => prev.map(h =>
          h.id === reportItem.id ? { ...h, status: 'success' } : h
        ));

        toast.success(t('reports.history.actions.resend_success', "E-mail reenviado com sucesso!"), {
          id: 'resend-email',
          description: t('reports.history.actions.resend_success_desc', { email: reportItem.recipient, defaultValue: `Relatório com análise IA enviado para ${reportItem.recipient}` }),
          icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        });
      } else {
        toast.error(t('reports.history.actions.resend_failed', "Falha ao reenviar e-mail."), {
          id: 'resend-email',
          description: t('reports.history.actions.resend_failed_desc', "Verifique as configurações de e-mail e tente novamente.")
        });
      }
    } catch (error) {
      console.error('[Reports] Error resending email:', error);
      toast.error(t('reports.history.actions.resend_error', "Erro ao processar o reenvio."), {
        id: 'resend-email'
      });
    } finally {
      setResendingReportId(null);
    }
  };

  // Filter history by selected client
  const filteredHistory = selectedClient === 'all'
    ? history
    : history.filter(h => h.client === clients.find(c => c.id === selectedClient)?.name);

  return (
    <div className={cn(
      "flex-1 space-y-8 pb-8 bg-background min-h-screen",
      !isEmbedded && "pt-8 px-2 md:px-4"
    )}>

      {/* Header with Client Selector */}
      {!isEmbedded && (
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-6 border-b pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{t('reports.title', 'Central de Relatórios')}</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              {t('reports.description', 'Gestão de relatórios e automações por cliente.')}
            </p>
          </div>

        </div>
      )}

      {isEmbedded && (
        <div className="flex justify-end mb-6 border-b pb-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="w-full sm:w-[250px]">
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="h-10 sm:h-11">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder={t('reports.select_client', "Selecione o Cliente")} />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('reports.all_clients', "Todos os Clientes")}</SelectItem>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 flex-1">
              <div className="bg-muted p-1 rounded-lg flex gap-1 flex-1 sm:flex-none">
                <Button
                  variant={activeTab === 'manual' ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab('manual')}
                  className="gap-2 shadow-none flex-1 sm:flex-none h-8 sm:h-9 text-xs sm:text-sm"
                >
                  <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {t('reports.manual', 'Manual')}
                </Button>
                <Button
                  variant={activeTab === 'automation' ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab('automation')}
                  className="gap-2 shadow-none flex-1 sm:flex-none h-8 sm:h-9 text-xs sm:text-sm"
                >
                  <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {t('reports.automation', 'Automação')}
                </Button>
              </div>
              <Button variant="outline" size="icon" className="h-10 w-10 sm:h-11 sm:w-11 shrink-0" onClick={() => setIsSettingsOpen(true)}>
                <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'manual' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Templates Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <Card className="group hover:border-primary/50 transition-all cursor-pointer border-dashed border-2 hover:border-solid hover:bg-primary/5 active:bg-primary/10" onClick={() => handleOpenConfig('E-commerce')}>
              <CardHeader className="p-4 sm:p-6 pb-2">
                <div className="flex justify-between items-start">
                  <div className="p-2 sm:p-3 w-fit rounded-lg bg-primary/10 text-primary mb-2 group-hover:scale-110 transition-transform">
                    <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 text-[10px] sm:text-xs px-1.5 py-0">{t('reports.templates.popular', 'Popular')}</Badge>
                </div>
                <CardTitle className="text-base sm:text-lg">{t('reports.templates.ecommerce.title', 'Relatório E-commerce')}</CardTitle>
                <CardDescription className="text-xs sm:text-sm line-clamp-2">
                  {t('reports.templates.ecommerce.desc', 'Vendas, ROAS, ticket médio, funil e top produtos.')}
                </CardDescription>
              </CardHeader>
              <CardFooter className="p-4 sm:p-6 pt-0 text-primary text-xs sm:text-sm font-semibold flex items-center gap-2 group-hover:gap-3 transition-all pt-2">
                {t('reports.templates.configure', 'Configurar')} <ArrowRight className="h-4 w-4" />
              </CardFooter>
            </Card>

            <Card className="group hover:border-teal-500/50 transition-all cursor-pointer border-dashed border-2 hover:border-solid hover:bg-teal-500/5 active:bg-teal-500/10" onClick={() => handleOpenConfig('Geração de Leads')}>
              <CardHeader className="p-4 sm:p-6 pb-2">
                <div className="p-2 sm:p-3 w-fit rounded-lg bg-teal-500/10 text-teal-500 mb-2 group-hover:scale-110 transition-transform">
                  <Target className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <CardTitle className="text-base sm:text-lg">{t('reports.templates.leads.title', 'Relatório de Leads')}</CardTitle>
                <CardDescription className="text-xs sm:text-sm line-clamp-2">
                  {t('reports.templates.leads.desc', 'Custo por lead (CPL), CTR, qualidade de tráfego e canais.')}
                </CardDescription>
              </CardHeader>
              <CardFooter className="p-4 sm:p-6 pt-0 text-teal-500 text-xs sm:text-sm font-semibold flex items-center gap-2 group-hover:gap-3 transition-all pt-2">
                {t('reports.templates.configure', 'Configurar')} <ArrowRight className="h-4 w-4" />
              </CardFooter>
            </Card>

            <Card className="group hover:border-amber-500/50 transition-all cursor-pointer border-dashed border-2 hover:border-solid hover:bg-amber-500/5 active:bg-amber-500/10" onClick={() => handleOpenConfig('Infoproduto')}>
              <CardHeader className="p-4 sm:p-6 pb-2">
                <div className="p-2 sm:p-3 w-fit rounded-lg bg-amber-500/10 text-amber-500 mb-2 group-hover:scale-110 transition-transform">
                  <Zap className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <CardTitle className="text-base sm:text-lg">{t('reports.templates.infoproduct.title', 'Relatório Infoproduto')}</CardTitle>
                <CardDescription className="text-xs sm:text-sm line-clamp-2">
                  {t('reports.templates.infoproduct.desc', 'ROI de lançamento, recuperação e batalha de criativos.')}
                </CardDescription>
              </CardHeader>
              <CardFooter className="p-4 sm:p-6 pt-0 text-amber-500 text-xs sm:text-sm font-semibold flex items-center gap-2 group-hover:gap-3 transition-all pt-2">
                {t('reports.templates.configure', 'Configurar')} <ArrowRight className="h-4 w-4" />
              </CardFooter>
            </Card>
          </div>

          {/* History Section */}
          <Card className="border-border/50">
            <CardHeader className="p-4 sm:p-6 pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg sm:text-xl font-bold">{t('reports.history.title', 'Histórico de Envios')}</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    {selectedClient !== 'all'
                      ? t('reports.history.client_reports', { name: clients.find(c => c.id === selectedClient)?.name, defaultValue: `Relatórios gerados para ${clients.find(c => c.id === selectedClient)?.name}` })
                      : t('reports.history.all_recent', "Todos os relatórios recentes.")
                    }
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-[240px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder={t('reports.history.search_placeholder', "Buscar relatório...")} className="pl-9 h-9 sm:h-10 text-sm" />
                  </div>
                  <Button variant="outline" size="icon" className="h-9 w-9 sm:h-10 sm:w-10 shrink-0"><Filter className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <div className="overflow-x-auto no-scrollbar">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="text-[10px] sm:text-xs font-bold uppercase tracking-wider h-10 px-4">{t('reports.history.table.file', 'Arquivo')}</TableHead>
                      <TableHead className="text-[10px] sm:text-xs font-bold uppercase tracking-wider h-10 px-4">{t('reports.history.table.client', 'Cliente')}</TableHead>
                      <TableHead className="text-[10px] sm:text-xs font-bold uppercase tracking-wider h-10 px-4">{t('reports.history.table.model', 'Modelo')}</TableHead>
                      <TableHead className="text-[10px] sm:text-xs font-bold uppercase tracking-wider h-10 px-4 hidden sm:table-cell">{t('reports.history.table.date', 'Data')}</TableHead>
                      <TableHead className="text-[10px] sm:text-xs font-bold uppercase tracking-wider h-10 px-4">{t('reports.history.table.sending', 'Envio')}</TableHead>
                      <TableHead className="text-[10px] sm:text-xs font-bold uppercase tracking-wider h-10 px-4">{t('reports.history.table.status', 'Status')}</TableHead>
                      <TableHead className="text-[10px] sm:text-xs font-bold uppercase tracking-wider h-10 px-4 text-right">{t('reports.history.table.actions', 'Ações')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                          {t('reports.history.empty', 'Nenhum relatório encontrado.')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredHistory.map((item) => (
                        <TableRow key={item.id} className="hover:bg-muted/20 transition-colors">
                          <TableCell className="font-medium px-4 py-3">
                            <div className="flex items-center gap-2">
                              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                              <span className="text-[11px] sm:text-sm">{item.id}</span>
                              {item.id === 'REL-002' && <Badge variant="secondary" className="text-[9px] h-4 px-1 leading-none bg-blue-500/10 text-blue-500 border-0">IA</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="flex items-center gap-1.5 text-[11px] sm:text-sm text-foreground/80">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate max-w-[100px] sm:max-w-none">{item.client}</span>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <Badge variant="outline" className="font-normal text-[9px] sm:text-[10px] h-5 px-1.5 bg-background">
                              {item.type === 'E-commerce' ? t('reports.templates.ecommerce.title') :
                                item.type === 'Geração de Leads' ? t('reports.templates.leads.title') :
                                  item.type === 'Infoproduto' ? t('reports.templates.infoproduct.title') :
                                    item.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-3 hidden sm:table-cell text-[11px] sm:text-sm">
                            {format(item.date, "dd/MM/yyyy HH:mm")}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground font-medium">
                              {item.method === 'Email' ? <Mail className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-500" /> : <Download className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                              {item.method}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <Badge className={cn("text-[10px] sm:text-xs h-5 sm:h-6 px-1.5 sm:px-2 shadow-none border-0 capitalize",
                              item.status === 'success' ? "bg-emerald-500/10 text-emerald-500" :
                                item.status === 'failed' ? "bg-red-500/10 text-red-500" : "bg-yellow-500/10 text-yellow-500"
                            )}>
                              {item.status === 'success' ? t('reports.history.sent', 'Enviado') : t('reports.history.failed', 'Falha')}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">{t('reports.history.table.actions', 'Ações')}</DropdownMenuLabel>
                                <DropdownMenuItem className="text-xs" onClick={() => handleDownloadPdf(item)}>
                                  <Download className="mr-2 h-3.5 w-3.5" /> {t('reports.history.actions.download_pdf', 'Baixar PDF')}
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  className="text-xs"
                                  onClick={() => handleResendEmail(item)}
                                  disabled={resendingReportId === item.id}
                                >
                                  {resendingReportId === item.id ? (
                                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Mail className="mr-2 h-3.5 w-3.5" />
                                  )}
                                  {resendingReportId === item.id
                                    ? t('reports.history.actions.sending_email', 'Enviando...')
                                    : t('reports.history.actions.resend_email', 'Reenviar E-mail')}
                                </DropdownMenuItem>

                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )
      }

      {
        activeTab === 'automation' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">{t('reports.automations.active_schedules', 'Agendamentos Ativos')}</h2>
                <p className="text-muted-foreground">{t('reports.automations.desc', 'Configure envios automáticos recorrentes para seus clientes.')}</p>
              </div>
              <Button onClick={() => setIsScheduleDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t('reports.automations.new_schedule', 'Novo Agendamento')}
              </Button>
            </div>

            <div className="grid gap-4">
              {schedules.map((schedule) => (
                <Card key={schedule.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-4 border-border/50">
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="p-2 sm:p-3 bg-muted rounded-lg shrink-0">
                      <CalendarRange className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm sm:text-base truncate">{schedule.name}</h3>
                      <div className="flex items-center gap-2 text-[11px] sm:text-sm text-muted-foreground mt-0.5">
                        <Badge variant="outline" className="text-[9px] sm:text-[10px] h-5 px-1 bg-background">
                          {schedule.template === 'E-commerce' ? t('reports.templates.ecommerce.title') :
                            schedule.template === 'Geração de Leads' ? t('reports.templates.leads.title') :
                              schedule.template === 'Infoproduto' ? t('reports.templates.infoproduct.title') :
                                schedule.template}
                        </Badge>
                        <span>•</span>
                        <Clock className="h-3 w-3" />
                        <span className="truncate">
                          {schedule.periodicity === 'Semanal (Segunda)' ? t('reports.automations.frequencies.weekly') :
                            schedule.periodicity === 'Diário (09:00)' ? t('reports.automations.frequencies.daily') :
                              schedule.periodicity}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0">
                    <div className="sm:text-right sm:mr-4">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{t('reports.automations.next_run', 'Próximo envio')}</p>
                      <p className="font-semibold text-xs sm:text-sm">{schedule.nextRun}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={schedule.status === 'active'} />
                      <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 text-red-500 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}

              {/* Empty State / Add New Placeholder */}
              <Button
                variant="outline"
                className="h-[80px] sm:h-[100px] border-dashed border-2 flex flex-col gap-2 hover:bg-accent/5 transition-colors group"
                onClick={() => setIsScheduleDialogOpen(true)}
              >
                <Plus className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground group-hover:scale-110 transition-transform" />
                <span className="text-muted-foreground text-xs sm:text-sm">{t('reports.automations.new_routine', 'Configurar nova rotina de envio')}</span>
              </Button>
            </div>
          </div>
        )
      }

      {/* Advanced Config Dialog */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {t('reports.generate_dialog.title', { template: selectedTemplate, defaultValue: `Configurar Relatório: ${selectedTemplate}` })}
              {selectedClient !== 'all' && <span className="text-muted-foreground font-normal ml-2">- {clients.find(c => c.id === selectedClient)?.name}</span>}
            </DialogTitle>
            <DialogDescription>{t('reports.generate_dialog.desc', 'Personalize o período e os recursos avançados.')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Date Range */}
            <div className="space-y-2">
              <Label>{t('reports.generate_dialog.period_label', 'Período de Análise')}</Label>
              <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
            </div>

            {/* AI Features */}
            <div className="flex items-center justify-between p-3 border rounded-lg bg-primary/5 border-primary/20">
              <div className="flex gap-3">
                <div className="bg-primary/10 p-2 rounded-md h-fit">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{t('reports.generate_dialog.ai_insights', 'IA Insights')}</p>
                  <p className="text-xs text-muted-foreground">{t('reports.generate_dialog.ai_insights_desc', 'Incluir análise qualitativa automatizada.')}</p>
                </div>
              </div>
              <Switch checked={aiAnalysis} onCheckedChange={setAiAnalysis} />
            </div>

            {/* White Label */}
            <div className={cn("flex items-center justify-between p-3 border rounded-lg transition-colors", whiteLabel && "bg-secondary/20")}>
              <div className="flex gap-3">
                <div className="bg-muted p-2 rounded-md h-fit">
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">White-Label</p>
                  <p className="text-xs text-muted-foreground">
                    {agencyName ? t('reports.generate_dialog.whitelabel_desc', { name: agencyName, defaultValue: `Usando marca: ${agencyName}` }) : t('reports.generate_dialog.whitelabel_help', "Configurar logo em Ajustes > Geral")}
                  </p>
                </div>
              </div>
              <Switch checked={whiteLabel} onCheckedChange={setWhiteLabel} disabled={!agencyName} />
            </div>

            {/* Manual Email Input */}
            <div className="space-y-2">
              <Label>{t('reports.automations.dialog.email_label', 'E-mail de Destino')}</Label>
              <Input
                placeholder="exemplo@email.com"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
              />
            </div>

            {whiteLabel && agencyName && (
              <div className="p-2 bg-muted/50 rounded-md flex items-center gap-3 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                {t('reports.config.whitelabel.auto_apply', 'A logo da agência será aplicada automaticamente no cabeçalho.')}
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => handleGenerate('download')} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {t('reports.generate_dialog.download', 'Baixar')}
            </Button>
            <Button
              onClick={() => handleGenerate('email')}
              disabled={isGenerating}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              {t('reports.generate_dialog.send_email', 'Enviar por E-mail')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Schedule Dialog */}
      <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('reports.automations.dialog.title', 'Novo Agendamento Automático (E-mail)')}</DialogTitle>
            <DialogDescription>
              {t('reports.automations.dialog.desc', 'Configure a frequência de envio dos relatórios.')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>{t('reports.automations.dialog.name_label', 'Nome do Agendamento')}</Label>
              <Input
                placeholder={t('reports.automations.dialog.name_placeholder', "Ex: Resumo Semanal - Diretoria")}
                value={newSchedule.name}
                onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('reports.automations.dialog.model_label', 'Modelo de Relatório')}</Label>
                <Select
                  value={newSchedule.template}
                  onValueChange={(val) => setNewSchedule({ ...newSchedule, template: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ecommerce">{t('reports.templates.ecommerce.title')}</SelectItem>
                    <SelectItem value="leadgen">{t('reports.templates.leads.title')}</SelectItem>
                    <SelectItem value="infoproduct">{t('reports.templates.infoproduct.title')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('reports.automations.dialog.frequency_label', 'Frequência')}</Label>
                <Select
                  value={newSchedule.periodicity}
                  onValueChange={(val) => setNewSchedule({ ...newSchedule, periodicity: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Diário">{t('reports.automations.frequencies.daily', 'Diário (09:00)')}</SelectItem>
                    <SelectItem value="Semanal">{t('reports.automations.frequencies.weekly', 'Semanal (Segunda)')}</SelectItem>
                    <SelectItem value="Quinzenal">{t('reports.automations.frequencies.biweekly', 'Quinzenal')}</SelectItem>
                    <SelectItem value="Mensal">{t('reports.automations.frequencies.monthly', 'Mensal (Dia 1)')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('reports.automations.dialog.email_label', 'E-mail de Destino')}</Label>
              <Input
                placeholder="exemplo@email.com"
                value={newSchedule.email}
                onChange={(e) => setNewSchedule({ ...newSchedule, email: e.target.value })}
              />
            </div>

            {whiteLabel && agencyName && (
              <div className="p-3 border rounded-md flex items-center gap-3 bg-muted/30">
                <div className="bg-primary/10 p-2 rounded-md">
                  <ImageIcon className="h-4 w-4 text-primary" />
                </div>
                <div className="text-sm">
                  <p className="font-medium">{t('reports.config.whitelabel.active', 'White-Label Ativo')}</p>
                  <p className="text-muted-foreground text-xs">{t('reports.config.whitelabel.active_desc', { name: agencyName, defaultValue: `O relatório será enviado com a marca da ${agencyName}.` })}</p>
                </div>
              </div>
            )}

          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsScheduleDialogOpen(false)}>{t('common.cancel', 'Cancelar')}</Button>
            <Button onClick={handleCreateSchedule} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock className="mr-2 h-4 w-4" />}
              {t('reports.automations.dialog.save_button', 'Salvar Agendamento')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reports Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('reports.config.title', 'Configurações de Relatórios')}</DialogTitle>
            <DialogDescription>
              {t('reports.config.desc', 'Personalize a aparência e padrões dos seus relatórios.')}
            </DialogDescription>
          </DialogHeader>

          {/* Header Preview */}
          <div className="mb-2">
            <Label className="text-xs uppercase text-muted-foreground mb-2 block">{t('reports.config.preview_label', 'Preview do Header')}</Label>
            <div
              className="rounded-lg p-4 relative min-h-[80px] flex items-center justify-center"
              style={{ backgroundColor: agencyColor || '#7C3AED' }}
            >
              {agencyLogo ? (
                <img
                  src={agencyLogo}
                  alt="Logo Preview"
                  className="h-10 w-10 object-contain rounded absolute left-4 top-1/2 -translate-y-1/2"
                  style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
                />
              ) : (
                <div className="h-10 w-10 rounded bg-white/20 flex items-center justify-center absolute left-4 top-1/2 -translate-y-1/2">
                  <ImageIcon className="w-5 h-5 text-white/60" />
                </div>
              )}
              <div className="text-center">
                <p className="text-white font-bold text-lg leading-tight" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                  Weekly Performance Report
                </p>
                <p className="text-white/90 text-xs mt-1">Client: Julico | Period: Jan 12 - Jan 19</p>
                <p className="text-white/80 text-[10px] uppercase font-medium mt-0.5">Report Type: E-commerce</p>
              </div>
            </div>
            {agencyLogo && (
              <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-amber-500/20 text-center leading-3 text-[10px]">!</span>
                {t('reports.config.contrast_warning', 'Dica: Use um logo branco ou claro para melhor contraste.')}
              </p>
            )}
          </div>

          <div className="space-y-6 py-4">

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-medium">White-Label (Agência)</h3>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>{t('reports.config.whitelabel.name_label', 'Nome da Agência')}</Label>
                  <Input
                    placeholder={t('reports.config.whitelabel.name_placeholder', "Ex: Minha Agência Marketing")}
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('reports.config.whitelabel.logo_label', 'Logo da Agência')}</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/30 overflow-hidden relative group">
                      {agencyLogo ? (
                        <>
                          <img src={agencyLogo} alt="Logo" className="h-full w-full object-contain" />
                          <button
                            onClick={() => { setAgencyLogo(""); localStorage.removeItem('lads_agency_logo'); }}
                            className="absolute inset-0 bg-black/50 items-center justify-center hidden group-hover:flex"
                          >
                            <Trash2 className="w-4 h-4 text-white" />
                          </button>
                        </>
                      ) : (
                        <ImageIcon className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <Input
                          placeholder="https://exemplo.com/logo.png"
                          value={agencyLogo.startsWith('data:') ? '' : agencyLogo}
                          onChange={(e) => setAgencyLogo(e.target.value)}
                          className="flex-1"
                          disabled={agencyLogo.startsWith('data:')}
                        />
                        <div className="relative">
                          <Button variant="outline" size="icon" className="relative cursor-pointer">
                            <Upload className="h-4 w-4" />
                            <input
                              type="file"
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              accept="image/*"
                              onChange={handleLogoUpload}
                            />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{t('reports.config.whitelabel.logo_help', 'Cole a URL ou faça upload da imagem.')}</p>
                    </div>
                  </div>
                </div>

                {/* Agency Color Picker */}
                <div className="space-y-2">
                  <Label>{t('reports.config.whitelabel.color_label', 'Cor Principal')}</Label>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-lg border-2 cursor-pointer relative overflow-hidden"
                      style={{ backgroundColor: agencyColor }}
                    >
                      <input
                        type="color"
                        value={agencyColor}
                        onChange={(e) => setAgencyColor(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </div>
                    <Input
                      placeholder="#7C3AED"
                      value={agencyColor}
                      onChange={(e) => setAgencyColor(e.target.value)}
                      className="flex-1 font-mono uppercase"
                      maxLength={7}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{t('reports.config.whitelabel.color_help', 'Usada nos e-mails e relatórios.')}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">

              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Settings className="w-5 h-5 text-blue-500" />
                </div>
                <h3 className="font-medium">{t('reports.config.sending_defaults.title', 'Padrões de Envio')}</h3>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                <div className="space-y-0.5">
                  <Label className="text-base">{t('reports.config.sending_defaults.ai_auto', 'Análise de IA Automática')}</Label>
                  <p className="text-xs text-muted-foreground">{t('reports.config.sending_defaults.ai_auto_desc', 'Sempre incluir insights de IA nos relatórios.')}</p>
                </div>
                <Switch checked={aiAnalysis} onCheckedChange={setAiAnalysis} />
              </div>
            </div>
          </div>


          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>{t('common.cancel', 'Cancelar')}</Button>
            <Button onClick={handleSaveSettings}>{t('reports.config.save_button', 'Salvar Configurações')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div >
  );
}
