import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, FileText, ArrowRight } from "lucide-react";
// Graficos removido - funcionalidade movida para Overview
import Reports from "./Reports";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const AnalyticsPage = () => {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const currentTab = searchParams.get("tab") || "reports"; // Alterado default para reports

    const handleTabChange = (value: string) => {
        setSearchParams({ tab: value });
    };

    return (
        <div className="pt-8 pb-10 px-2 md:px-4 space-y-8 min-h-screen bg-transparent flex flex-col">
            <Tabs defaultValue={currentTab} value={currentTab} onValueChange={handleTabChange} className="space-y-6 flex-1 flex flex-col">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{t('sidebar.analytics', 'Análises')}</h1>
                        <p className="text-muted-foreground">{t('analytics.unified_performance_analysis', 'Análise unificada de desempenho e relatórios')}</p>
                    </div>

                    <div className="hidden md:flex justify-end">
                        <TabsList className="h-10 inline-flex">
                            <TabsTrigger value="reports" className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                <span className="text-sm">Relatórios</span>
                            </TabsTrigger>
                            <TabsTrigger value="analytics" className="flex items-center gap-2">
                                <BarChart3 className="h-4 w-4" />
                                <span className="text-sm">Analytics</span>
                            </TabsTrigger>
                        </TabsList>
                    </div>
                </div>

                {/* Mobile Tabs List underneath header */}
                <div className="flex md:hidden overflow-x-auto pb-2 no-scrollbar">
                    <TabsList className="h-10 w-full grid grid-cols-2">
                        <TabsTrigger value="reports" className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span className="text-sm">Relatórios</span>
                        </TabsTrigger>
                        <TabsTrigger value="analytics" className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            <span className="text-sm">Analytics</span>
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="analytics" className="border-none p-0 m-0">
                    <Card>
                        <CardHeader>
                            <CardTitle>Análise de Desempenho</CardTitle>
                            <CardDescription>
                                As análises detalhadas de desempenho agora estão centralizadas no Dashboard.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button asChild>
                                <Link to="/dashboard" className="flex items-center gap-2">
                                    Ir para Visão Geral <ArrowRight className="h-4 w-4" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="reports" className="border-none p-0 m-0">
                    <Reports isEmbedded />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default AnalyticsPage;
