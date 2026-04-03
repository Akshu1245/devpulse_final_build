/**
 * ShareCard Component — Reasoning Efficiency Score Sharing
 * =========================================================
 * Shareable card for Twitter, LinkedIn, and Reddit
 * displaying user's Reasoning Efficiency Score
 * 
 * Features:
 * - Animated SVG card
 * - One-click social sharing
 * - Embeddable code snippets
 */

import React, { useState, useRef, useEffect } from 'react';

// ============ Types ============

export interface ScoreData {
  reasoningEfficiencyScore: number;
  thinkingTokenRatio: number;
  monthlySavings: number;
  totalRequests: number;
  avgCostPerRequest: number;
  topModel: string;
  percentile: number;
  userName?: string;
  profileUrl?: string;
}

interface ShareButtonProps {
  platform: 'twitter' | 'linkedin' | 'reddit';
  url: string;
  text: string;
}

// ============ Share URLs ============

const getTwitterUrl = (text: string, url: string) =>
  `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

const getLinkedInUrl = (url: string) =>
  `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

const getRedditUrl = (title: string, url: string) =>
  `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;

// ============ Components ============

const ShareButton: React.FC<ShareButtonProps> = ({ platform, url, text }) => {
  const icons: Record<string, string> = {
    twitter: '𝕏',
    linkedin: 'in',
    reddit: 'r/',
  };

  const colors: Record<string, string> = {
    twitter: '#1DA1F2',
    linkedin: '#0A66C2',
    reddit: '#FF4500',
  };

  const getShareUrl = () => {
    switch (platform) {
      case 'twitter':
        return getTwitterUrl(text, url);
      case 'linkedin':
        return getLinkedInUrl(url);
      case 'reddit':
        return getRedditUrl(text, url);
    }
  };

  return (
    <button
      className="share-btn"
      style={{
        background: colors[platform],
        color: 'white',
        border: 'none',
        padding: '10px 20px',
        borderRadius: '8px',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
      onClick={() => window.open(getShareUrl(), '_blank', 'width=600,height=400')}
    >
      <span style={{ fontSize: '1.2em' }}>{icons[platform]}</span>
      Share on {platform.charAt(0).toUpperCase() + platform.slice(1)}
    </button>
  );
};

const ScoreCard: React.FC<{ data: ScoreData }> = ({ data }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isAnimating, setIsAnimating] = useState(true);

  // Animate score on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#8BC34A';
    if (score >= 40) return '#FFC107';
    return '#FF5722';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Optimal';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Improvement';
  };

  return (
    <div
      ref={cardRef}
      className="score-card"
      style={{
        width: '400px',
        height: '250px',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        borderRadius: '16px',
        padding: '24px',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
      }}
    >
      {/* Background pattern */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `radial-gradient(circle at 20% 80%, rgba(76,175,80,0.1) 0%, transparent 50%),
                           radial-gradient(circle at 80% 20%, rgba(33,150,243,0.1) 0%, transparent 50%)`,
        }}
      />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', position: 'relative' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '14px', color: '#888', fontWeight: 500 }}>
            🧠 Reasoning Efficiency Score
          </h3>
          {data.userName && (
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#666' }}>
              @{data.userName}
            </p>
          )}
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>
          Top {100 - data.percentile}%
        </div>
      </div>

      {/* Main Score */}
      <div style={{ textAlign: 'center', margin: '20px 0', position: 'relative' }}>
        <div
          style={{
            fontSize: '64px',
            fontWeight: 'bold',
            color: getScoreColor(data.reasoningEfficiencyScore),
            lineHeight: 1,
            transition: 'all 0.5s ease-out',
          }}
        >
          {isAnimating ? '—' : data.reasoningEfficiencyScore}
        </div>
        <div
          style={{
            fontSize: '14px',
            color: getScoreColor(data.reasoningEfficiencyScore),
            marginTop: '8px',
            fontWeight: 600,
          }}
        >
          {getScoreLabel(data.reasoningEfficiencyScore)}
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', position: 'relative' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2196F3' }}>
            ${data.monthlySavings.toFixed(0)}
          </div>
          <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
            Saved/mo
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#FF9800' }}>
            {(data.thinkingTokenRatio * 100).toFixed(0)}%
          </div>
          <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
            Thinking Ratio
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#9C27B0' }}>
            {data.topModel}
          </div>
          <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
            Top Model
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '24px',
          right: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: '#555',
        }}
      >
        <span>Powered by DevPulse</span>
        <span>devpulse.dev</span>
      </div>
    </div>
  );
};

const EmbedCodeSection: React.FC<{ userId: string; cardUrl: string }> = ({ userId, cardUrl }) => {
  const [copied, setCopied] = useState<string | null>(null);

  const markdownCode = `[![Reasoning Efficiency Score](${cardUrl})](https://devpulse.dev/profile/${userId})`;
  const htmlCode = `<a href="https://devpulse.dev/profile/${userId}"><img src="${cardUrl}" alt="Reasoning Efficiency Score" /></a>`;

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="embed-section" style={{ marginTop: '32px' }}>
      <h3 style={{ marginBottom: '16px', color: '#333' }}>📋 Embed on Your Profile</h3>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
          Markdown (GitHub README)
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <code
            style={{
              flex: 1,
              background: '#f5f5f5',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '12px',
              whiteSpace: 'nowrap',
              overflow: 'auto',
            }}
          >
            {markdownCode}
          </code>
          <button
            onClick={() => copyToClipboard(markdownCode, 'markdown')}
            style={{
              background: copied === 'markdown' ? '#4CAF50' : '#333',
              color: 'white',
              border: 'none',
              padding: '12px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            {copied === 'markdown' ? '✓' : 'Copy'}
          </button>
        </div>
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
          HTML (Website/Blog)
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <code
            style={{
              flex: 1,
              background: '#f5f5f5',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '12px',
              whiteSpace: 'nowrap',
              overflow: 'auto',
            }}
          >
            {htmlCode}
          </code>
          <button
            onClick={() => copyToClipboard(htmlCode, 'html')}
            style={{
              background: copied === 'html' ? '#4CAF50' : '#333',
              color: 'white',
              border: 'none',
              padding: '12px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            {copied === 'html' ? '✓' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ Main Component ============

export interface ShareCardPageProps {
  userId: string;
  scoreData?: ScoreData;
}

export const ShareCardPage: React.FC<ShareCardPageProps> = ({ userId, scoreData }) => {
  const [data, setData] = useState<ScoreData | null>(scoreData || null);
  const [loading, setLoading] = useState(!scoreData);

  useEffect(() => {
    if (!scoreData) {
      // Fetch score data from API
      fetch(`/api/users/${userId}/efficiency-score`)
        .then(res => res.json())
        .then(setData)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [userId, scoreData]);

  const profileUrl = `https://devpulse.dev/profile/${userId}`;
  const cardImageUrl = `https://devpulse.dev/card/${userId}.png`;

  const shareText = data
    ? `🧠 My Reasoning Efficiency Score: ${data.reasoningEfficiencyScore}% - Optimizing AI token usage with @DevPulseDev! #AI #DevTools`
    : 'Check out my DevPulse Reasoning Efficiency Score!';

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>Loading your score...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>Unable to load score data. Please try again.</p>
      </div>
    );
  }

  return (
    <div
      className="share-card-page"
      style={{
        minHeight: '100vh',
        background: '#f8f9fa',
        padding: '40px',
      }}
    >
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '8px', color: '#1a1a2e' }}>
          🧠 Your Reasoning Efficiency Score
        </h1>
        <p style={{ color: '#666', marginBottom: '32px' }}>
          Share your AI optimization achievements with the world!
        </p>

        {/* Score Card Preview */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
          <ScoreCard data={data} />
        </div>

        {/* Share Buttons */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ marginBottom: '16px', color: '#333' }}>🚀 Share Your Score</h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <ShareButton platform="twitter" url={profileUrl} text={shareText} />
            <ShareButton platform="linkedin" url={profileUrl} text={shareText} />
            <ShareButton platform="reddit" url={profileUrl} text={shareText} />
          </div>
        </div>

        {/* Embed Code */}
        <EmbedCodeSection userId={userId} cardUrl={cardImageUrl} />

        {/* Download Button */}
        <div style={{ marginTop: '32px', textAlign: 'center' }}>
          <button
            style={{
              background: '#1a1a2e',
              color: 'white',
              border: 'none',
              padding: '14px 28px',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onClick={() => {
              window.open(cardImageUrl, '_blank');
            }}
          >
            📥 Download as PNG
          </button>
        </div>

        {/* Tips */}
        <div
          style={{
            marginTop: '40px',
            padding: '20px',
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #eee',
          }}
        >
          <h4 style={{ margin: '0 0 12px', color: '#333' }}>💡 Tips to Improve Your Score</h4>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#666', lineHeight: 1.8 }}>
            <li>Use streaming responses to reduce perceived latency</li>
            <li>Implement prompt caching for repeated queries</li>
            <li>Choose the right model size for each task</li>
            <li>Set reasoning depth limits in your prompts</li>
            <li>Monitor thinking token ratios across endpoints</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ShareCardPage;
