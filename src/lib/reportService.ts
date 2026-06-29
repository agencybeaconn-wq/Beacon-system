/**
 * Report Service - Email Integration via Supabase Edge Function
 * 
 * This service handles:
 * 1. Uploading PDFs to Supabase Storage
 * 2. Sending report emails via Supabase Edge Function with report links
 * 
 * All API keys are kept server-side to avoid CORS and security issues.
 */

import { supabase } from "@/integrations/supabase/client";

// Supabase Configuration
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Storage bucket name for reports
const REPORTS_BUCKET = 'reports';

/**
 * Metrics interface for report data
 */
export interface ReportMetrics {
    roas: number;
    spend: number;
    conversions: number;
    revenue?: number;
    clicks?: number;
    impressions?: number;
    ctr?: number;
    cpc?: number;
}

/**
 * Report email data structure
 */
export interface ReportEmailData {
    recipientEmail: string;
    clientName: string;
    metrics: ReportMetrics;
    reportLink?: string;
    agencyColor?: string;
    agencyName?: string;
    agencyLogo?: string;
}

/**
 * Converts a jsPDF document to Blob
 * 
 * @param pdfData - jsPDF instance
 * @returns Blob - PDF as Blob
 */
function pdfToBlob(pdfData: any): Blob {
    if (typeof pdfData.output === 'function') {
        return pdfData.output('blob');
    }
    if (pdfData instanceof Blob) {
        return pdfData;
    }
    throw new Error('Invalid PDF data format');
}

/**
 * Uploads a PDF to Supabase Storage and returns the public URL
 * 
 * @param pdfData - jsPDF instance or Blob
 * @param reportId - Unique report identifier
 * @param clientName - Client name for the filename
 * @returns Promise<string | null> - Public URL of the uploaded file, or null on failure
 */
export async function uploadPdfToStorage(
    pdfData: any,
    reportId: string,
    clientName: string
): Promise<string | null> {
    try {
        console.log('[ReportService] Starting PDF upload process...');
        console.log('[ReportService] pdfData type:', typeof pdfData);
        console.log('[ReportService] pdfData has output function:', typeof pdfData?.output === 'function');

        // Convert to Blob
        const pdfBlob = pdfToBlob(pdfData);
        console.log('[ReportService] PDF Blob created, size:', pdfBlob.size, 'bytes');

        if (pdfBlob.size === 0) {
            console.error('[ReportService] PDF Blob is empty!');
            return null;
        }

        // Generate unique filename
        const timestamp = Date.now();
        const sanitizedClientName = clientName.replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `report-${reportId}-${sanitizedClientName}-${timestamp}.pdf`;

        console.log('[ReportService] Uploading PDF to Storage bucket:', REPORTS_BUCKET);
        console.log('[ReportService] Filename:', filename);

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from(REPORTS_BUCKET)
            .upload(filename, pdfBlob, {
                contentType: 'application/pdf',
                cacheControl: '3600',
                upsert: true // Allow overwrite to avoid conflicts
            });

        if (error) {
            console.error('[ReportService] Storage upload error:', error);
            console.error('[ReportService] Error message:', error.message);
            console.error('[ReportService] Error details:', JSON.stringify(error));
            return null;
        }

        console.log('[ReportService] Upload successful, path:', data.path);

        // Get public URL
        const { data: publicUrlData } = supabase.storage
            .from(REPORTS_BUCKET)
            .getPublicUrl(data.path);

        const publicUrl = publicUrlData.publicUrl;
        console.log('[ReportService] Public URL generated:', publicUrl);

        return publicUrl;

    } catch (error: any) {
        console.error('[ReportService] Error uploading PDF to Storage:', error);
        console.error('[ReportService] Error stack:', error?.stack);
        return null;
    }
}


/**
 * Sends a report email via Supabase Edge Function
 * The Edge Function handles:
 * - AI insights generation via OpenAI
 * - Email sending via Loops.so with report link
 * - Secure API key management
 * 
 * @param data - Report email data including recipient, client name, metrics, and report link
 * @returns Promise<{ success: boolean; aiInsights?: string; error?: string }>
 */
export async function sendReportEmail(data: ReportEmailData): Promise<{ success: boolean; aiInsights?: string; error?: string }> {
    if (!SUPABASE_URL) {
        console.error('[ReportService] VITE_SUPABASE_URL is not configured');
        return { success: false, error: 'Supabase URL not configured' };
    }

    try {
        console.log('[ReportService] Sending report email via Edge Function...');
        console.log('[ReportService] URL gerada para o Loops:', data.reportLink);
        console.log('[ReportService] Agency color:', data.agencyColor);
        console.log('[ReportService] Agency name:', data.agencyName);

        const requestPayload = {
            recipientEmail: data.recipientEmail,
            clientName: data.clientName,
            metrics: data.metrics,
            reportLink: data.reportLink,
            agencyColor: data.agencyColor || '#7C3AED',
            agencyName: data.agencyName || 'Leverads',
            agencyLogo: data.agencyLogo || '',
        };

        console.log('[ReportService] Request payload:', JSON.stringify(requestPayload, null, 2));



        const response = await fetch(`${SUPABASE_URL}/functions/v1/send-report-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify(requestPayload),
        });


        const result = await response.json();

        if (!response.ok || !result.success) {
            console.error('[ReportService] Edge Function error:', result);
            return {
                success: false,
                error: result.error || 'Failed to send email'
            };
        }

        console.log('[ReportService] Report email sent successfully');
        return {
            success: true,
            aiInsights: result.aiInsights
        };

    } catch (error) {
        console.error('[ReportService] Error calling Edge Function:', error);
        return {
            success: false,
            error: 'Network error while sending email'
        };
    }
}

/**
 * Converts a Base64 string to Blob
 */
function base64ToBlob(base64: string): Blob {
    const parts = base64.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);

    for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
    }

    return new Blob([uInt8Array], { type: contentType });
}

/**
 * Uploads agency logo to Storage if it's base64
 */
async function uploadLogoToStorage(logo: string, agencyName: string): Promise<string> {
    if (!logo || !logo.startsWith('data:image')) {
        return logo;
    }

    try {
        console.log('[ReportService] Uploading agency logo to Storage...');
        const blob = base64ToBlob(logo);
        const timestamp = Date.now();
        const sanitizedName = (agencyName || 'agency').replace(/[^a-zA-Z0-9]/g, '_');
        const extension = blob.type.split('/')[1] || 'png';
        const filename = `logo-${sanitizedName}-${timestamp}.${extension}`;

        const { data, error } = await supabase.storage
            .from(REPORTS_BUCKET)
            .upload(filename, blob, {
                contentType: blob.type,
                upsert: true
            });

        if (error) throw error;

        const { data: publicUrlData } = supabase.storage
            .from(REPORTS_BUCKET)
            .getPublicUrl(data.path);

        console.log('[ReportService] Logo uploaded:', publicUrlData.publicUrl);
        return publicUrlData.publicUrl;
    } catch (e) {
        console.error('[ReportService] Failed to upload logo:', e);
        return logo; // Return original if fails (though it might break email)
    }
}

/**
 * Resends a failed report email
 * Uploads PDF to Storage and sends email with the link
 * 
 * @param recipientEmail - Email address to send to
 * @param clientName - Name of the client for the report
 * @param metrics - Campaign metrics data
 * @param pdfDoc - Optional jsPDF document instance
 * @param reportId - Unique report identifier for filename
 * @returns Promise<{ success: boolean; aiInsights?: string; error?: string }>
 */
export async function resendReportEmail(
    recipientEmail: string,
    clientName: string,
    metrics: ReportMetrics,
    pdfDoc?: any,
    reportId?: string,
    agencyColor?: string
): Promise<{ success: boolean; aiInsights?: string; error?: string }> {

    let reportLink: string | undefined;

    // Upload PDF to Storage if provided
    if (pdfDoc) {
        const id = reportId || `REL-${Date.now()}`;
        reportLink = await uploadPdfToStorage(pdfDoc, id, clientName) || undefined;

        if (!reportLink) {
            console.warn('[ReportService] Failed to upload PDF, sending email without report link');
        }
    }

    // Get agency branding from localStorage
    const color = agencyColor || localStorage.getItem('lads_agency_color') || '#7C3AED';
    const name = localStorage.getItem('lads_agency_name') || 'Leverads';
    let logo = localStorage.getItem('lads_agency_logo') || '';

    // Upload logo if it's base64
    if (logo.startsWith('data:')) {
        logo = await uploadLogoToStorage(logo, name);
    }

    return await sendReportEmail({
        recipientEmail,
        clientName,
        metrics,
        reportLink,
        agencyColor: color,
        agencyName: name,
        agencyLogo: logo,
    });
}

