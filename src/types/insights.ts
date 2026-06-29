
export type InsightType = 'SCALING' | 'STOP_LOSS' | 'COMMENT' | 'CREATIVE' | 'AUTOMATION';

export interface InsightRule {
    field: string;
    operator: 'GT' | 'LT' | 'EQ';
    value: string | number;
    label?: string; // Human readable label for the rule
}

export interface AdComment {
    id: string;
    author: string;
    authorAvatar?: string;
    text: string;
    timestamp: string;
    adId: string;
    sentiment?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
}

export interface InsightDetails {
    ad_id?: string;
    ad_name?: string;
    ad_set_name?: string;
    campaign_name?: string;
    ad_preview_url?: string; // Image or Video URL
    rules?: InsightRule[];
    comments?: AdComment[];
    potential_savings?: string;
    metric_improvement?: string; // e.g., "3% more traffic"
    automation_action?: string; // e.g., "Pause Ad"
}

export interface Insight {
    id: string;
    type: InsightType;
    title: string;
    subtitle?: string;
    icon?: any; // Lucide icon name or component
    impact_score: number; // 1-100, for sorting urgency
    details: InsightDetails;
    dismissed?: boolean;
}
