'use client';

import dynamic from 'next/dynamic';

const EnhancedStoryBIPage = dynamic(
  () => import('../../src/bi/pages/EnhancedStoryBIPage'),
  { 
    loading: () => (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري تحميل لوحة معلومات الـ BI...</p>
        </div>
      </div>
    )
  }
);

export default function BiEnhancedPage() {
  return <EnhancedStoryBIPage />;
}