import { lazy, Suspense } from 'react';

const BulkProductEditor = lazy(() => import('@/components/BulkProductEditor'));

export default function BulkEditorPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Carregando editor...</div>}>
            <BulkProductEditor />
        </Suspense>
    )
}
