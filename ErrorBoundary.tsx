import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Shield, RefreshCw, AlertCircle } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center p-8">
          <div className="max-w-xl w-full text-center space-y-8">
            <div className="flex justify-center">
              <div className="flex items-center gap-2 text-[#1d4ed8]">
                <Shield className="w-12 h-12" />
                <span className="text-2xl font-black tracking-tight">DevPulse</span>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-50 text-red-600 rounded-full text-sm font-bold">
                <AlertCircle className="w-4 h-4" />
                CRITICAL ERROR
              </div>
              <h1 className="text-4xl font-bold text-gray-900">Something went wrong</h1>
              <p className="text-gray-500">
                We've encountered an unexpected issue. Our team has been notified.
              </p>
            </div>

            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 text-left overflow-auto max-h-48">
              <code className="text-xs text-gray-400 font-mono block whitespace-pre-wrap">
                {this.state.error?.toString()}
              </code>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-10 py-4 bg-[#1d4ed8] text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-200"
            >
              <RefreshCw className="w-5 h-5" />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.children;
  }
}
