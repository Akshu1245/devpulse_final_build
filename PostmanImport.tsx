// @ts-nocheck
import React, { useState, useRef, useCallback } from 'react';
import { trpc } from './utils/trpc';
import {
  Shield, AlertCircle, CheckCircle2, Loader2,
  Upload, Copy, Check, ExternalLink, Share2, X
} from 'lucide-react';

// ─── REVOKE URL MAP ───────────────────────────────────────────────────────────
const REVOKE_URLS: Record<string, string> = {
  openai:    'https://platform.openai.com/api-keys',
  stripe:    'https://dashboard.stripe.com/apikeys',
  aws:       'https://console.aws.amazon.com/iam/home#/security_credentials',
  github:    'https://github.com/settings/tokens',
  anthropic: 'https://console.anthropic.com/settings/keys',
  razorpay:  'https://dashboard.razorpay.com/app/keys',
  newrelic:  'https://one.newrelic.com/api-keys',
};

function getRevokeUrl(service: string): string {
  const key = service.toLowerCase().replace(/[^a-z]/g, '');
  return REVOKE_URLS[key] ?? 'https://devpulse.in/docs/revoke-keys';
}

// ─── PROPS ───────────────────────────────────────────────────────────────────
interface PostmanImportProps {
  workspaceId: number;
  onClose: () => void;
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export const PostmanImport: React.FC<PostmanImportProps> = ({ workspaceId, onClose }) => {
  const [step, setStep]                   = useState<0 | 1 | 2 | 3>(0);
  const [collectionJson, setCollectionJson] = useState('');
  const [isDragging, setIsDragging]       = useState(false);
  const [exposedKeys, setExposedKeys]     = useState<{ name: string; path: string; service: string }[]>([]);
  const [vulnCount, setVulnCount]         = useState(0);
  const [endpointCount, setEndpointCount] = useState(0);
  const [copied, setCopied]               = useState(false);
  const [stepOneDone, setStepOneDone]     = useState(false);
  const fileInputRef                      = useRef<HTMLInputElement>(null);

  const importMutation = trpc.postman.importCollection.useMutation({
    onSuccess: (data) => {
      setEndpointCount(data.endpoints);
      setVulnCount(data.vulnerabilities);
      setExposedKeys(data.exposedKeys || []);
      setTimeout(() => setStep(3), 800); // step 2 → step 3 after 800ms
    },
  });

  // ── file reader ─────────────────────────────────────────────────────────
  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setCollectionJson(e.target?.result as string);
    };
    reader.readAsText(file);
  };

  // ── drag handlers ────────────────────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }, []);

  // ── import trigger ───────────────────────────────────────────────────────
  const handleImport = () => {
    if (!collectionJson.trim()) return;

    let parsed: any;
    try {
      parsed = JSON.parse(collectionJson);
    } catch {
      alert('Invalid JSON — please paste a valid Postman collection.');
      return;
    }

    // Step 1: immediately
    setStep(1);
    setStepOneDone(false);

    // Step 2: after 800ms
    setTimeout(() => {
      setStepOneDone(true);
      setTimeout(() => {
        setStep(2);
        // fire mutation — onSuccess will move to step 3 after another 800ms
        importMutation.mutate({ workspaceId, collectionJson: parsed });
      }, 100);
    }, 800);
  };

  // ── share clipboard ──────────────────────────────────────────────────────
  const handleShare = () => {
    const services = [...new Set(exposedKeys.map((k) => k.service))].join(', ');
    const text = `🚨 DevPulse found ${exposedKeys.length} exposed API key${exposedKeys.length > 1 ? 's' : ''} in our Postman collection. Services affected: ${services}. Revoking now. Check yours at devpulse.in`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">

        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#1d4ed8]" />
            Import Postman Collection
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8">

          {/* ── STEP 0: Drop Zone + Paste ───────────────── */}
          {step === 0 && (
            <div className="space-y-5">
              {/* Drop zone */}
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer
                  transition-all duration-200 select-none
                  ${isDragging
                    ? 'border-2 border-solid border-[#1d4ed8] bg-blue-50 scale-[1.02]'
                    : 'border-2 border-dashed border-[#1d4ed8] bg-blue-50/40 hover:bg-blue-50 hover:border-solid'}
                `}
              >
                <div className={`p-4 rounded-full mb-4 transition-colors ${isDragging ? 'bg-[#1d4ed8]' : 'bg-blue-100'}`}>
                  <Shield className={`w-10 h-10 transition-colors ${isDragging ? 'text-white' : 'text-[#1d4ed8]'}`} />
                </div>
                <p className="text-base font-bold text-gray-800">
                  {isDragging ? 'Drop to import' : 'Drop your Postman collection JSON here'}
                </p>
                <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5" />
                  or click to browse
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
                />
              </div>

              {/* OR divider */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">or paste JSON</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              {/* Paste area */}
              <textarea
                className="w-full h-40 p-4 border border-gray-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-[#1d4ed8] focus:border-transparent resize-none bg-gray-50"
                placeholder={'{\n  "info": { "name": "My API" },\n  "item": [ ... ]\n}'}
                value={collectionJson}
                onChange={(e) => setCollectionJson(e.target.value)}
              />

              <button
                onClick={handleImport}
                disabled={!collectionJson.trim()}
                className="w-full py-3.5 bg-[#1d4ed8] text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Shield className="w-4 h-4" />
                Start Security Scan
              </button>
            </div>
          )}

          {/* ── STEP 1: Parsing ─────────────────────────── */}
          {step === 1 && (
            <div className="py-12 space-y-6">
              <div className="flex items-center gap-3">
                {stepOneDone
                  ? <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
                  : <Loader2 className="w-6 h-6 text-[#1d4ed8] animate-spin shrink-0" />}
                <p className={`text-base font-semibold ${stepOneDone ? 'text-green-700' : 'text-gray-900'}`}>
                  {stepOneDone ? '✓ Collection parsed' : 'Parsing collection...'}
                </p>
              </div>
              <div className="flex items-center gap-3 opacity-40">
                <Loader2 className="w-6 h-6 text-[#1d4ed8] shrink-0" />
                <p className="text-base font-semibold text-gray-500">Running OWASP security scan...</p>
              </div>
              <div className="flex items-center gap-3 opacity-20">
                <Loader2 className="w-6 h-6 text-gray-400 shrink-0" />
                <p className="text-base font-semibold text-gray-400">Checking for credential exposure...</p>
              </div>
            </div>
          )}

          {/* ── STEP 2: Scanning ────────────────────────── */}
          {step === 2 && (
            <div className="py-12 space-y-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
                <p className="text-base font-semibold text-green-700">✓ Collection parsed</p>
              </div>
              <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 text-[#1d4ed8] animate-spin shrink-0" />
                <p className="text-base font-semibold text-[#1d4ed8] animate-pulse">⚡ Running OWASP security scan...</p>
              </div>
              <div className="flex items-center gap-3 opacity-40">
                <Loader2 className="w-6 h-6 text-gray-400 shrink-0" />
                <p className="text-base font-semibold text-gray-400">Checking for credential exposure...</p>
              </div>
            </div>
          )}

          {/* ── STEP 3: Results ─────────────────────────── */}
          {step === 3 && (
            <div className="space-y-6">

              {/* OH CRAP MOMENT */}
              {exposedKeys.length > 0 ? (
                <div className="space-y-4">
                  {/* Banner */}
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5">
                    <div className="flex items-center gap-3 text-red-700 mb-4">
                      <AlertCircle className="w-7 h-7 shrink-0" />
                      <h3 className="text-lg font-black">
                        🚨 {exposedKeys.length} API KEY{exposedKeys.length > 1 ? 'S' : ''} EXPOSED IN YOUR POSTMAN COLLECTION
                      </h3>
                    </div>

                    <div className="space-y-2">
                      {exposedKeys.map((key, i) => (
                        <div
                          key={i}
                          className="bg-white rounded-lg border border-red-100 p-3 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded uppercase shrink-0">
                              {key.service}
                            </span>
                            <span className="font-mono text-sm font-bold text-red-600 truncate">{key.name}</span>
                            <span className="text-xs text-gray-400 truncate hidden sm:block">{key.path}</span>
                          </div>
                          <a
                            href={getRevokeUrl(key.service)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors shrink-0 whitespace-nowrap"
                          >
                            REVOKE NOW <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ))}
                    </div>

                    {/* Share button */}
                    <button
                      onClick={handleShare}
                      className="mt-4 flex items-center gap-2 px-4 py-2 border border-red-200 rounded-lg text-red-700 text-sm font-semibold hover:bg-red-100 transition-colors"
                    >
                      {copied
                        ? <><Check className="w-4 h-4 text-green-600" /> <span className="text-green-700">Copied!</span></>
                        : <><Share2 className="w-4 h-4" /> Share this finding (no key values)</>}
                    </button>
                  </div>

                  {/* Vuln summary */}
                  {vulnCount > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                      <p className="text-sm text-amber-800 font-medium">
                        Also found <span className="font-bold">{vulnCount}</span> potential security vulnerabilities across{' '}
                        <span className="font-bold">{endpointCount}</span> endpoints.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* CLEAN */
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-6 flex items-center gap-4">
                    <CheckCircle2 className="w-10 h-10 text-green-500 shrink-0" />
                    <div>
                      <h3 className="text-lg font-black text-green-800">✅ Clean Collection</h3>
                      <p className="text-green-700 text-sm mt-1">
                        {endpointCount} endpoints scanned — 0 credentials exposed.
                      </p>
                    </div>
                  </div>

                  {vulnCount > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                      <p className="text-sm text-amber-800 font-medium">
                        Found <span className="font-bold">{vulnCount}</span> security vulnerabilities. View the full report for details.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Bottom actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 border border-gray-200 rounded-xl text-gray-600 font-semibold hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                <a
                  href="/security"
                  className="px-6 py-2.5 bg-[#1d4ed8] text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  View Full Report <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default PostmanImport;
