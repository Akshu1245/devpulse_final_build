import React, { useState, useRef } from 'react';
import { Upload, FileJson, Shield, Play, X, CheckCircle2 } from 'lucide-react';

export const PostmanImportPage: React.FC = () => {
  const [dragging, setDragging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [fileName, setFileName] = useState('');
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.json')) { alert('Please upload a .json Postman collection file'); return; }
    setFileName(file.name); setScanning(true); setScanned(false); setProgress(0);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 12 + 4;
      setProgress(Math.min(p, 100));
      if (p >= 100) { clearInterval(iv); setScanning(false); setScanned(true); }
    }, 200);
  };

  const reset = () => { setScanning(false); setScanned(false); setFileName(''); setProgress(0); };

  return (
    <div className="ambient-bg dot-grid" style={{ padding: 40, minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'hsl(34, 80%, 65%)', marginBottom: 6 }}>API Discovery</p>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: 'var(--foreground)' }}>Import APIs</h1>
        <p style={{ color: 'var(--muted-foreground)', marginTop: 4 }}>Upload Postman, OpenAPI or Bruno collections to instantly map your attack surface.</p>
      </div>

      {/* Drop zone */}
      <div
        className={`glass-card ${!scanned ? 'glass-card-hover' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => !scanning && !scanned && fileRef.current?.click()}
        style={{
          borderRadius: 20, padding: 64, textAlign: 'center', cursor: !scanning && !scanned ? 'pointer' : 'default',
          border: dragging ? '2px dashed hsl(34 80% 56% / 0.6)' : scanned ? '1px solid hsl(160 45% 48% / 0.4)' : undefined,
          background: dragging ? 'hsl(34 80% 56% / 0.05)' : undefined,
          boxShadow: scanned ? 'var(--glow-accent)' : dragging ? 'var(--glow-primary)' : undefined,
          transition: 'all 200ms ease-out',
        }}
      >
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

        {!scanning && !scanned && (
          <>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: 'hsl(34 80% 56% / 0.12)', border: '1px solid hsl(34 80% 56% / 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: 'var(--glow-primary)' }}>
              <Upload size={32} style={{ color: 'hsl(34, 80%, 65%)' }} />
            </div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: 'var(--foreground)', marginBottom: 8 }}>Drop your collection here</h2>
            <p style={{ color: 'var(--muted-foreground)', marginBottom: 20 }}>Postman JSON · OpenAPI 3.0 · Bruno format</p>
            <button className="btn-primary" onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>
              <FileJson size={16} /> Choose File
            </button>
          </>
        )}

        {scanning && (
          <>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: 'hsl(34 80% 56% / 0.12)', border: '1px solid hsl(34 80% 56% / 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Shield size={32} style={{ color: 'hsl(34, 80%, 65%)' }} className="animate-pulse-soft" />
            </div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: 'var(--foreground)', marginBottom: 6 }}>Scanning {fileName}</h2>
            <p style={{ color: 'var(--muted-foreground)', marginBottom: 24 }}>Analyzing endpoints for OWASP vulnerabilities...</p>
            <div style={{ maxWidth: 400, margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 8, fontFamily: "'DM Mono', monospace" }}>
                <span>Analyzing endpoints...</span><span>{Math.floor(progress)}%</span>
              </div>
              <div className="progress-track" style={{ height: 8 }}>
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </>
        )}

        {scanned && (
          <>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: 'hsl(160 45% 48% / 0.12)', border: '1px solid hsl(160 45% 48% / 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: 'var(--glow-accent)' }}>
              <CheckCircle2 size={32} style={{ color: 'hsl(160, 45%, 60%)' }} />
            </div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: 'var(--foreground)', marginBottom: 8 }}>Scan Complete!</h2>
            <p style={{ color: 'hsl(160, 45%, 60%)', marginBottom: 24 }}>25 endpoints imported · 4 vulnerabilities detected</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="/security" className="btn-primary"><Shield size={16} /> View Security Report</a>
              <button className="btn-glass" onClick={reset}>Import Another</button>
            </div>
          </>
        )}
      </div>

      {/* Supported formats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {[
          { name: 'Postman', desc: 'Collection v2.0 & v2.1 JSON export', color: 'hsl(34, 80%, 65%)' },
          { name: 'OpenAPI', desc: 'OpenAPI 3.0 / Swagger 2.0 YAML & JSON', color: 'hsl(195, 50%, 60%)' },
          { name: 'Bruno', desc: '.bru collection files and bruno.json', color: 'hsl(160, 45%, 60%)' },
        ].map(f => (
          <div key={f.name} className="glass-card" style={{ borderRadius: 14, padding: 20 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: f.color, marginBottom: 6, fontFamily: "'Playfair Display', serif" }}>{f.name}</p>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
export default PostmanImportPage;
