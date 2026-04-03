import React from 'react';

export const DashboardLayoutSkeleton: React.FC = () => {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar Skeleton (280px) */}
      <aside className="w-[280px] bg-white border-r border-gray-100 flex flex-col p-6 space-y-8 shrink-0">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 bg-gray-100 rounded-xl animate-pulse" />
          <div className="w-32 h-6 bg-gray-100 rounded-md animate-pulse" />
        </div>
        
        <div className="space-y-4">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <div className="w-5 h-5 bg-gray-100 rounded-md animate-pulse" />
              <div className="w-3/4 h-4 bg-gray-100 rounded-md animate-pulse" />
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content Skeleton */}
      <main className="flex-1 overflow-auto p-10">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Header Area */}
          <div className="flex justify-between items-end">
            <div className="space-y-3">
              <div className="w-48 h-10 bg-gray-100 rounded-xl animate-pulse" />
              <div className="w-72 h-5 bg-gray-100 rounded-md animate-pulse" />
            </div>
            <div className="w-32 h-12 bg-gray-100 rounded-xl animate-pulse" />
          </div>

          {/* 3 Skeleton Card Rows */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white p-8 rounded-2xl border border-gray-100 space-y-4 shadow-sm">
                <div className="w-12 h-12 bg-gray-100 rounded-xl animate-pulse" />
                <div className="w-2/3 h-6 bg-gray-100 rounded-md animate-pulse" />
                <div className="w-full h-20 bg-gray-50 rounded-xl animate-pulse" />
              </div>
            ))}
          </div>

          {/* Large Content Area */}
          <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm h-[500px] animate-pulse">
            <div className="w-1/4 h-8 bg-gray-100 rounded-xl mb-8" />
            <div className="space-y-4">
              <div className="w-full h-4 bg-gray-50 rounded-md" />
              <div className="w-full h-4 bg-gray-50 rounded-md" />
              <div className="w-3/4 h-4 bg-gray-50 rounded-md" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
