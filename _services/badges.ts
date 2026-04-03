/**
 * DevPulse Badge Service — GitHub Profile Badges
 * ===============================================
 * Generate shareable security and efficiency badges
 * for developer GitHub profiles
 * 
 * Badge Types:
 * - Security Score Badge (OWASP compliance)
 * - Cost Efficiency Badge (LLM spend optimization)
 * - Reasoning Efficiency Score Badge
 * - DevPulse Verified Badge
 */

import { z } from 'zod';

// ============ Badge Types ============

export interface Badge {
  id: string;
  type: BadgeType;
  userId: string;
  workspaceId: number;
  score: number;
  label: string;
  message: string;
  color: string;
  createdAt: Date;
  expiresAt: Date;
  embedCode: string;
  svgUrl: string;
  markdownEmbed: string;
  htmlEmbed: string;
}

export type BadgeType = 'security' | 'cost-efficiency' | 'reasoning-efficiency' | 'verified';

export interface BadgeGenerationRequest {
  userId: string;
  workspaceId: number;
  badgeType: BadgeType;
}

export interface UserStats {
  securityScore: number;
  vulnerabilitiesFixed: number;
  owaspCompliance: number;
  costEfficiencyScore: number;
  monthlySavings: number;
  reasoningEfficiencyScore: number;
  thinkingTokenRatio: number;
  totalScans: number;
  endpointsProtected: number;
}

// ============ Badge Configuration ============

const BADGE_CONFIGS: Record<BadgeType, {
  label: string;
  thresholds: { min: number; color: string; status: string }[];
  iconSvg: string;
}> = {
  security: {
    label: 'DevPulse Security',
    thresholds: [
      { min: 90, color: '4c1', status: 'A+' },
      { min: 80, color: '97ca00', status: 'A' },
      { min: 70, color: 'a4a61d', status: 'B' },
      { min: 60, color: 'dfb317', status: 'C' },
      { min: 0, color: 'e05d44', status: 'D' },
    ],
    iconSvg: '<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>',
  },
  'cost-efficiency': {
    label: 'LLM Cost Efficiency',
    thresholds: [
      { min: 90, color: '4c1', status: '$$$' },
      { min: 70, color: '97ca00', status: '$$' },
      { min: 50, color: 'a4a61d', status: '$' },
      { min: 0, color: 'dfb317', status: '-' },
    ],
    iconSvg: '<circle cx="12" cy="12" r="10"/><path d="M12 6v12M9 9h6M9 15h6"/>',
  },
  'reasoning-efficiency': {
    label: 'Reasoning Efficiency',
    thresholds: [
      { min: 80, color: '4c1', status: 'Optimal' },
      { min: 60, color: '97ca00', status: 'Good' },
      { min: 40, color: 'a4a61d', status: 'Fair' },
      { min: 0, color: 'e05d44', status: 'Low' },
    ],
    iconSvg: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>',
  },
  verified: {
    label: 'DevPulse Verified',
    thresholds: [
      { min: 0, color: '4c1', status: '✓' },
    ],
    iconSvg: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  },
};

// ============ Badge Generator Service ============

export class BadgeService {
  private baseUrl: string;

  constructor(baseUrl: string = 'https://devpulse.dev') {
    this.baseUrl = baseUrl;
  }

  /**
   * Generate a badge for a user
   */
  async generateBadge(request: BadgeGenerationRequest, stats: UserStats): Promise<Badge> {
    const config = BADGE_CONFIGS[request.badgeType];
    const score = this.calculateScore(request.badgeType, stats);
    const threshold = config.thresholds.find(t => score >= t.min) || config.thresholds[config.thresholds.length - 1];

    const badgeId = this.generateBadgeId(request);
    const message = `${threshold.status} (${score}%)`;

    const badge: Badge = {
      id: badgeId,
      type: request.badgeType,
      userId: request.userId,
      workspaceId: request.workspaceId,
      score,
      label: config.label,
      message,
      color: threshold.color,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      embedCode: '',
      svgUrl: '',
      markdownEmbed: '',
      htmlEmbed: '',
    };

    // Generate URLs and embed codes
    badge.svgUrl = `${this.baseUrl}/badge/${badgeId}.svg`;
    badge.markdownEmbed = `[![${config.label}](${badge.svgUrl})](${this.baseUrl}/profile/${request.userId})`;
    badge.htmlEmbed = `<a href="${this.baseUrl}/profile/${request.userId}"><img src="${badge.svgUrl}" alt="${config.label}" /></a>`;
    badge.embedCode = badge.markdownEmbed;

    return badge;
  }

  /**
   * Generate SVG for a badge
   */
  generateSvg(badge: Badge): string {
    const labelWidth = badge.label.length * 7 + 10;
    const messageWidth = badge.message.length * 7 + 10;
    const totalWidth = labelWidth + messageWidth;

    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalWidth}" height="20" role="img" aria-label="${badge.label}: ${badge.message}">
  <title>${badge.label}: ${badge.message}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="20" fill="#${badge.color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="${labelWidth * 5}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)">${badge.label}</text>
    <text x="${labelWidth * 5}" y="140" transform="scale(.1)" fill="#fff">${badge.label}</text>
    <text aria-hidden="true" x="${labelWidth * 10 + messageWidth * 5}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)">${badge.message}</text>
    <text x="${labelWidth * 10 + messageWidth * 5}" y="140" transform="scale(.1)" fill="#fff">${badge.message}</text>
  </g>
</svg>`;
  }

  /**
   * Calculate score based on badge type and user stats
   */
  private calculateScore(badgeType: BadgeType, stats: UserStats): number {
    switch (badgeType) {
      case 'security':
        return Math.round(stats.securityScore || stats.owaspCompliance || 0);
      case 'cost-efficiency':
        return Math.round(stats.costEfficiencyScore || 0);
      case 'reasoning-efficiency':
        return Math.round(stats.reasoningEfficiencyScore || 0);
      case 'verified':
        return stats.totalScans > 0 ? 100 : 0;
      default:
        return 0;
    }
  }

  /**
   * Generate unique badge ID
   */
  private generateBadgeId(request: BadgeGenerationRequest): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${request.badgeType}-${request.userId}-${timestamp}-${random}`;
  }

  /**
   * Get all available badge types for a user
   */
  getAvailableBadgeTypes(stats: UserStats): BadgeType[] {
    const available: BadgeType[] = [];

    if (stats.totalScans > 0) {
      available.push('verified');
    }
    if (stats.securityScore >= 0) {
      available.push('security');
    }
    if (stats.costEfficiencyScore >= 0) {
      available.push('cost-efficiency');
    }
    if (stats.reasoningEfficiencyScore >= 0) {
      available.push('reasoning-efficiency');
    }

    return available;
  }
}

// ============ Social Sharing Service ============

export class SocialSharingService {
  private baseUrl: string;

  constructor(baseUrl: string = 'https://devpulse.dev') {
    this.baseUrl = baseUrl;
  }

  /**
   * Generate Twitter share URL
   */
  getTwitterShareUrl(badge: Badge): string {
    const text = this.getShareText(badge);
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(badge.svgUrl)}`;
  }

  /**
   * Generate LinkedIn share URL
   */
  getLinkedInShareUrl(badge: Badge): string {
    const url = `${this.baseUrl}/profile/${badge.userId}`;
    return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  }

  /**
   * Generate Reddit share URL
   */
  getRedditShareUrl(badge: Badge): string {
    const title = this.getShareText(badge);
    const url = `${this.baseUrl}/profile/${badge.userId}`;
    return `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
  }

  /**
   * Get Open Graph meta tags for badge page
   */
  getOpenGraphMeta(badge: Badge): Record<string, string> {
    return {
      'og:title': `${badge.label}: ${badge.message}`,
      'og:description': `Verified by DevPulse API Security & LLM Cost Intelligence Platform`,
      'og:image': badge.svgUrl,
      'og:url': `${this.baseUrl}/profile/${badge.userId}`,
      'og:type': 'website',
      'twitter:card': 'summary',
      'twitter:title': `${badge.label}: ${badge.message}`,
      'twitter:description': `API Security Score verified by DevPulse`,
      'twitter:image': badge.svgUrl,
    };
  }

  /**
   * Generate share text based on badge type
   */
  private getShareText(badge: Badge): string {
    switch (badge.type) {
      case 'security':
        return `🛡️ My API Security Score is ${badge.score}%! Verified by @DevPulseDev #APISecurity #DevTools`;
      case 'cost-efficiency':
        return `💰 Achieved ${badge.score}% LLM Cost Efficiency with @DevPulseDev! #AI #CostOptimization`;
      case 'reasoning-efficiency':
        return `🧠 My Reasoning Efficiency Score: ${badge.score}% - Optimizing AI token usage with @DevPulseDev!`;
      case 'verified':
        return `✅ DevPulse Verified! Scanning APIs for security and optimizing AI costs. #DevTools`;
      default:
        return `Check out my DevPulse badge! @DevPulseDev`;
    }
  }
}

// ============ Share Card Generator ============

export interface ShareCard {
  userId: string;
  badges: Badge[];
  stats: UserStats;
  generatedAt: Date;
  svgContent: string;
  pngUrl: string;
  shareUrls: {
    twitter: string;
    linkedin: string;
    reddit: string;
  };
}

export class ShareCardGenerator {
  private badgeService: BadgeService;
  private sharingService: SocialSharingService;

  constructor(baseUrl: string = 'https://devpulse.dev') {
    this.badgeService = new BadgeService(baseUrl);
    this.sharingService = new SocialSharingService(baseUrl);
  }

  /**
   * Generate a share card with all badges
   */
  async generateShareCard(userId: string, workspaceId: number, stats: UserStats): Promise<ShareCard> {
    const badges: Badge[] = [];
    const badgeTypes = this.badgeService.getAvailableBadgeTypes(stats);

    for (const type of badgeTypes) {
      const badge = await this.badgeService.generateBadge({ userId, workspaceId, badgeType: type }, stats);
      badges.push(badge);
    }

    const primaryBadge = badges[0] || await this.badgeService.generateBadge(
      { userId, workspaceId, badgeType: 'verified' },
      stats
    );

    const card: ShareCard = {
      userId,
      badges,
      stats,
      generatedAt: new Date(),
      svgContent: this.generateCardSvg(badges, stats),
      pngUrl: `https://devpulse.dev/card/${userId}.png`,
      shareUrls: {
        twitter: this.sharingService.getTwitterShareUrl(primaryBadge),
        linkedin: this.sharingService.getLinkedInShareUrl(primaryBadge),
        reddit: this.sharingService.getRedditShareUrl(primaryBadge),
      },
    };

    return card;
  }

  /**
   * Generate SVG for the share card
   */
  private generateCardSvg(badges: Badge[], stats: UserStats): string {
    const width = 400;
    const height = 200;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <rect width="${width}" height="${height}" fill="url(#bg)" rx="10"/>
  
  <!-- DevPulse Logo Area -->
  <text x="20" y="35" fill="#fff" font-family="Arial, sans-serif" font-size="20" font-weight="bold">
    🛡️ DevPulse
  </text>
  <text x="20" y="55" fill="#888" font-family="Arial, sans-serif" font-size="12">
    API Security & LLM Cost Intelligence
  </text>
  
  <!-- Stats Grid -->
  <g transform="translate(20, 80)">
    <rect width="100" height="50" fill="#252550" rx="5"/>
    <text x="50" y="22" fill="#4CAF50" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle">
      ${stats.securityScore || 0}%
    </text>
    <text x="50" y="40" fill="#888" font-family="Arial, sans-serif" font-size="10" text-anchor="middle">
      Security Score
    </text>
  </g>
  
  <g transform="translate(140, 80)">
    <rect width="100" height="50" fill="#252550" rx="5"/>
    <text x="50" y="22" fill="#2196F3" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle">
      $${(stats.monthlySavings || 0).toFixed(0)}
    </text>
    <text x="50" y="40" fill="#888" font-family="Arial, sans-serif" font-size="10" text-anchor="middle">
      Monthly Savings
    </text>
  </g>
  
  <g transform="translate(260, 80)">
    <rect width="100" height="50" fill="#252550" rx="5"/>
    <text x="50" y="22" fill="#FF9800" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle">
      ${stats.endpointsProtected || 0}
    </text>
    <text x="50" y="40" fill="#888" font-family="Arial, sans-serif" font-size="10" text-anchor="middle">
      Endpoints
    </text>
  </g>
  
  <!-- Badges Row -->
  <g transform="translate(20, 150)">
    ${badges.slice(0, 3).map((badge, i) => `
      <g transform="translate(${i * 120}, 0)">
        <rect width="110" height="25" fill="#${badge.color}" rx="3"/>
        <text x="55" y="17" fill="#fff" font-family="Arial, sans-serif" font-size="10" text-anchor="middle">
          ${badge.message}
        </text>
      </g>
    `).join('')}
  </g>
</svg>`;
  }
}

// ============ Export Router Handler Functions ============

const BadgeRequestSchema = z.object({
  userId: z.string(),
  workspaceId: z.number(),
  badgeType: z.enum(['security', 'cost-efficiency', 'reasoning-efficiency', 'verified']),
});

/**
 * Handler for generating a badge
 */
export async function handleGenerateBadge(
  body: unknown,
  getUserStats: (userId: string, workspaceId: number) => Promise<UserStats>
): Promise<Badge> {
  const request = BadgeRequestSchema.parse(body);
  const stats = await getUserStats(request.userId, request.workspaceId);
  
  const badgeService = new BadgeService();
  return badgeService.generateBadge(request, stats);
}

/**
 * Handler for getting badge SVG
 */
export function handleGetBadgeSvg(badge: Badge): string {
  const badgeService = new BadgeService();
  return badgeService.generateSvg(badge);
}

/**
 * Handler for generating share card
 */
export async function handleGenerateShareCard(
  userId: string,
  workspaceId: number,
  stats: UserStats
): Promise<ShareCard> {
  const generator = new ShareCardGenerator();
  return generator.generateShareCard(userId, workspaceId, stats);
}
