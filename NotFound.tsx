// @ts-nocheck
import React from 'react';
import { Shield, ArrowLeft } from 'lucide-react';

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-4 bg-blue-50 rounded-2xl">
            <Shield className="w-20 h-20 text-[#1d4ed8]" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-6xl font-black text-gray-900">404</h1>
          <h2 className="text-2xl font-bold text-gray-700">Page not found</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            The page you're looking for doesn't exist or has been moved. 
            DevPulse is still protecting your other routes.
          </p>
        </div>
        <a 
          href="/" 
          className="inline-flex items-center gap-2 px-8 py-3 bg-[#1d4ed8] text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Dashboard
        </a>
      </div>
    </div>
  );
};
