import React from "react";

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] gap-3 text-gray-500">
      <div className="w-7 h-7 border-3 border-gray-200 border-t-[#1d4ed8] rounded-full animate-spin" />
      <span className="text-sm font-medium">Loading...</span>
    </div>
  );
}
