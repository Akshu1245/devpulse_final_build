// Modern DevPulse Landing Page - Component-based React
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

// Icons as inline SVGs for consistency
const Icons = {
  Shield: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  Bot: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2"/>
      <circle cx="12" cy="5" r="2"/>
      <path d="M12 7v4"/>
      <line x1="8" y1="16" x2="8" y2="16"/>
      <line x1="16" y1="16" x2="16" y2="16"/>
    </svg>
  ),
  DollarSign: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  Eye: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  Zap: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  Lock: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  ArrowRight: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  ),
  Check: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Star: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  Code: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/>
      <polyline points="8 6 2 12 8 18"/>
    </svg>
  ),
  Activity: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  Globe: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
};

// Animated Counter Hook
function useCountUp(end: number, duration = 2000, startOnView = true) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!startOnView) {
      animate();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          animate();
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const animate = () => {
    const startTime = performance.now();
    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(eased * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  return { count, ref };
}

// Floating Particles Canvas
function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let particles: Array<{
      x: number; y: number; vx: number; vy: number;
      size: number; opacity: number; type: 'key' | 'money';
    }> = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Initialize particles
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: 0.3 + Math.random() * 0.5,
        size: 2 + Math.random() * 3,
        opacity: 0.3 + Math.random() * 0.5,
        type: Math.random() > 0.5 ? 'key' : 'money',
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        
        if (p.y > canvas.height + 20) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
        }
        if (p.x < -20) p.x = canvas.width + 20;
        if (p.x > canvas.width + 20) p.x = -20;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        const color = p.type === 'key' 
          ? `rgba(34, 211, 238, ${p.opacity})` 
          : `rgba(251, 191, 36, ${p.opacity})`;
        ctx.fillStyle = color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="hero-canvas"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.6,
      }}
    />
  );
}

// Navigation Component
function Navigation({ onGetStarted }: { onGetStarted: () => void }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`nav ${scrolled ? 'nav-scrolled' : ''}`}>
      <div className="nav-container">
        <a href="/" className="nav-logo">
          <span className="logo-icon">🛡️</span>
          <span>DevPulse</span>
        </a>
        <ul className="nav-links">
          <li><a href="#features">Features</a></li>
          <li><a href="#how">How It Works</a></li>
          <li><a href="#pricing">Pricing</a></li>
          <li><a href="#patents">Patents</a></li>
        </ul>
        <button onClick={onGetStarted} className="nav-cta">
          Get Started Free
        </button>
      </div>
    </nav>
  );
}

// Hero Section
function HeroSection({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <section className="hero">
      <div className="hero-content">
        <div className="hero-badge">
          <span className="live-dot"></span>
          Live Demo Mode · v2.4.1
        </div>
        <h1 className="hero-title">
          <span className="title-gradient">API Intelligence</span>
          <br />
          at the speed of light
        </h1>
        <p className="hero-subtitle">
          Real-time security scanning, LLM cost analytics, and autonomous agent 
          protection — all inside your VS Code.
        </p>
        <div className="hero-buttons">
          <a 
            href="https://marketplace.visualstudio.com/items?itemName=rashi-technologies.devpulse" 
            className="btn-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icons.Zap />
            Install VS Code Extension
          </a>
          <a 
            href="https://github.com/rashi-technologies/devpulse" 
            className="btn-secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icons.Star />
            Star on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}

// Stats Bar
function StatsBar() {
  const stats = [
    { value: 847, label: 'Developer Teams', suffix: '+' },
    { value: 420, label: 'Lakhs Saved', prefix: '₹', suffix: 'L+' },
    { value: 12840, label: 'Vulnerabilities Blocked', suffix: '+' },
    { value: 4, label: 'Patents Pending', suffix: '' },
  ];

  return (
    <section className="stats-bar">
      <div className="stats-grid">
        {stats.map((stat, i) => {
          const { count, ref } = useCountUp(stat.value, 2000, true);
          return (
            <div key={i} className="stat-item" ref={ref}>
              <div className="stat-number">
                {stat.prefix || ''}
                {count.toLocaleString()}
                {stat.suffix}
              </div>
              <div className="stat-label">{stat.label}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Problem Section
function ProblemSection() {
  const problems = [
    {
      icon: '🔓',
      number: '1 in 5',
      title: 'API Keys Leaked',
      description: 'Developers accidentally leak API keys to GitHub. Most don\'t find out until their bill arrives.',
      color: 'red',
    },
    {
      icon: '💸',
      number: '$14,000',
      title: 'Average Key Leak Cost',
      description: 'Average cost of a leaked API key before detection. One exposed key can drain your account in hours.',
      color: 'amber',
    },
    {
      icon: '🌑',
      number: '68%',
      title: 'Invisible LLM Costs',
      description: 'Of LLM costs are invisible until the bill arrives. Thinking tokens bleed money silently.',
      color: 'purple',
    },
  ];

  return (
    <section className="problem-section" id="problem">
      <div className="container">
        <div className="section-header">
          <span className="section-label">The Problem</span>
          <h2 className="section-title">
            Your APIs are bleeding
            <br />
            <span className="text-gradient">right now</span>
          </h2>
          <p className="section-description">
            Every second, hackers scrape GitHub repos, exploit leaked .env files, 
            and drain your LLM budgets. You don't see it until the damage is done.
          </p>
        </div>

        <div className="problem-grid">
          {problems.map((problem, i) => (
            <div key={i} className={`problem-card problem-card-${problem.color}`}>
              <div className="problem-icon">{problem.icon}</div>
              <div className="problem-number">{problem.number}</div>
              <h3 className="problem-title">{problem.title}</h3>
              <p className="problem-description">{problem.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Features Section
function FeaturesSection({ onGetStarted }: { onGetStarted: () => void }) {
  const features = [
    {
      icon: <Icons.Shield />,
      title: 'Live API Threat Scanner',
      description: 'Detects OWASP Top 10 vulnerabilities — SQLi, BOLA, Broken Auth — the moment you save a file.',
      tag: 'Patent 001',
      color: 'amber',
    },
    {
      icon: <Icons.DollarSign />,
      title: 'LLM Cost Intelligence',
      description: 'Token-level cost attribution per model — GPT-4o, Claude Sonnet, Gemini Flash. Track thinking tokens.',
      tag: 'Patent 002',
      color: 'teal',
    },
    {
      icon: <Icons.Bot />,
      title: 'AgentGuard Kill Switch',
      description: 'Autonomous detection of rogue AI agents. Infinite loops, key leaks, budget overruns — kills them instantly.',
      tag: 'First in World',
      color: 'red',
    },
    {
      icon: <Icons.Eye />,
      title: 'Shadow API Detector',
      description: 'Discovers undocumented and unauthenticated endpoints in real traffic before attackers find them.',
      tag: 'Patent 003',
      color: 'purple',
    },
    {
      icon: <Icons.Lock />,
      title: 'PCI DSS v4.0.1 Compliance',
      description: 'Automated compliance evidence reports aligned to PCI DSS v4.0.1 and GDPR. Audit-ready in minutes.',
      tag: 'Patent 004',
      color: 'emerald',
    },
    {
      icon: <Icons.Code />,
      title: 'Postman Risk Analyzer',
      description: 'Import your Postman collection. Get unified security risk score and remediation plan instantly.',
      tag: 'VS Code Native',
      color: 'blue',
    },
  ];

  return (
    <section className="features-section" id="features">
      <div className="container">
        <div className="section-header">
          <span className="section-label">What DevPulse Does</span>
          <h2 className="section-title">
            The only tool that sees
            <br />
            <span className="text-gradient">everything</span>
          </h2>
          <p className="section-description">
            Six battle-tested capabilities, live inside VS Code. 
            No dashboards to open, no agents to babysit.
          </p>
        </div>

        <div className="features-grid">
          {features.map((feature, i) => (
            <div key={i} className={`feature-card feature-card-${feature.color}`}>
              <div className={`feature-icon feature-icon-${feature.color}`}>
                {feature.icon}
              </div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
              <span className="feature-tag">{feature.tag}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// How It Works Section
function HowItWorksSection() {
  const steps = [
    {
      number: '01',
      title: 'Install Extension',
      description: 'One-click install from VS Code Marketplace. No complex setup required.',
    },
    {
      number: '02',
      title: 'Connect Your APIs',
      description: 'Import Postman collections or connect directly to your codebase.',
    },
    {
      number: '03',
      title: 'Get Real-Time Protection',
      description: 'DevPulse monitors 24/7, alerting you to vulnerabilities and cost anomalies.',
    },
  ];

  return (
    <section className="how-section" id="how">
      <div className="container">
        <div className="section-header">
          <span className="section-label">How It Works</span>
          <h2 className="section-title">
            Protection in
            <br />
            <span className="text-gradient">3 simple steps</span>
          </h2>
        </div>

        <div className="how-grid">
          {steps.map((step, i) => (
            <div key={i} className="how-step">
              <div className="step-number">{step.number}</div>
              <h3 className="step-title">{step.title}</h3>
              <p className="step-description">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Pricing Section
function PricingSection({ onGetStarted }: { onGetStarted: () => void }) {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for getting started',
      features: [
        '5 Scans/month',
        'Basic Cost Tracking',
        'Community Support',
        'VS Code Extension',
      ],
      cta: 'Get Started',
      popular: false,
    },
    {
      name: 'Starter',
      price: '$29',
      period: '/month',
      description: 'For individual developers',
      features: [
        'Unlimited Scans',
        '30-day History',
        'Slack Notifications',
        'Basic Compliance Reports',
        'Priority Support',
      ],
      cta: 'Start Free Trial',
      popular: true,
    },
    {
      name: 'Pro',
      price: '$99',
      period: '/month',
      description: 'For growing teams',
      features: [
        'Everything in Starter',
        'AgentGuard Kill Switch',
        'PCI DSS Reports',
        'API Proxy',
        'Advanced Analytics',
        'Dedicated Support',
      ],
      cta: 'Start Free Trial',
      popular: false,
    },
    {
      name: 'Team',
      price: '$299',
      period: '/month',
      description: 'For enterprise teams',
      features: [
        'Everything in Pro',
        'RBAC & SSO',
        'Custom Compliance',
        'White-label Reports',
        'SLA Guarantee',
        '24/7 Priority Support',
      ],
      cta: 'Contact Sales',
      popular: false,
    },
  ];

  return (
    <section className="pricing-section" id="pricing">
      <div className="container">
        <div className="section-header">
          <span className="section-label">Pricing</span>
          <h2 className="section-title">
            Simple, transparent
            <br />
            <span className="text-gradient">pricing</span>
          </h2>
          <p className="section-description">
            Start free, scale as you grow. No hidden fees, no surprises.
          </p>
        </div>

        <div className="pricing-grid">
          {plans.map((plan, i) => (
            <div 
              key={i} 
              className={`pricing-card ${plan.popular ? 'pricing-card-popular' : ''}`}
            >
              {plan.popular && <div className="popular-badge">Most Popular</div>}
              <h3 className="plan-name">{plan.name}</h3>
              <div className="plan-price">
                <span className="price-amount">{plan.price}</span>
                <span className="price-period">{plan.period}</span>
              </div>
              <p className="plan-description">{plan.description}</p>
              <ul className="plan-features">
                {plan.features.map((feature, j) => (
                  <li key={j}>
                    <Icons.Check />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button 
                onClick={onGetStarted} 
                className={`plan-cta ${plan.popular ? 'plan-cta-primary' : ''}`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Patents Section
function PatentsSection() {
  const patents = [
    {
      id: 'NHCE/DEV/2026/001',
      title: 'Unified Real-Time API Security Vulnerability Detection & LLM Cost Intelligence',
      status: 'Pending — Zero global prior art',
    },
    {
      id: 'NHCE/DEV/2026/002',
      title: 'Detection & Attribution of Thinking Token Expenditure in LLM API Calls',
      status: 'Pending — First in world',
    },
    {
      id: 'NHCE/DEV/2026/003',
      title: 'Shadow API Endpoint Discovery Through IDE Framework-Specific Static Analysis',
      status: 'Pending — Zero prior art for method',
    },
    {
      id: 'NHCE/DEV/2026/004',
      title: 'Automated Generation of PCI DSS v4.0.1 & GDPR Compliance Evidence Reports',
      status: 'Pending — Zero prior art at SME price',
    },
  ];

  return (
    <section className="patents-section" id="patents">
      <div className="container">
        <div className="section-header">
          <span className="section-label">Innovation</span>
          <h2 className="section-title">
            4 Patents
            <br />
            <span className="text-gradient">Pending</span>
          </h2>
          <p className="section-description">
            World's first API security platform with patented technology for 
            thinking token attribution and autonomous agent protection.
          </p>
        </div>

        <div className="patents-grid">
          {patents.map((patent, i) => (
            <div key={i} className="patent-card">
              <div className="patent-id">{patent.id}</div>
              <h3 className="patent-title">{patent.title}</h3>
              <div className="patent-status">{patent.status}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Footer
function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="footer-logo">
              <span className="logo-icon">🛡️</span>
              <span>DevPulse</span>
            </div>
            <p className="footer-tagline">
              API Security + LLM Cost Intelligence
              <br />
              Built in Bangalore, India
            </p>
          </div>
          <div className="footer-links">
            <h4>Product</h4>
            <ul>
              <li><a href="#features">Features</a></li>
              <li><a href="#pricing">Pricing</a></li>
              <li><a href="#patents">Patents</a></li>
              <li><a href="https://marketplace.visualstudio.com/items?itemName=rashi-technologies.devpulse" target="_blank" rel="noopener noreferrer">VS Code Extension</a></li>
            </ul>
          </div>
          <div className="footer-links">
            <h4>Company</h4>
            <ul>
              <li><a href="https://rashitechnologies.in" target="_blank" rel="noopener noreferrer">About</a></li>
              <li><a href="https://devpulse.in" target="_blank" rel="noopener noreferrer">Website</a></li>
              <li><a href="mailto:support@devpulse.in">Contact</a></li>
            </ul>
          </div>
          <div className="footer-links">
            <h4>Legal</h4>
            <ul>
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Terms of Service</a></li>
              <li><a href="#">Security</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2026 Rashi Technologies. All rights reserved.</p>
          <p>4 Patent Applications Pending · Confidential</p>
        </div>
      </div>
    </footer>
  );
}

// Main Landing Page Component
export function LandingPage() {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate('/dashboard');
  };

  return (
    <div className="landing-wrapper">
      <HeroCanvas />
      <Navigation onGetStarted={handleGetStarted} />
      <HeroSection onGetStarted={handleGetStarted} />
      <StatsBar />
      <ProblemSection />
      <FeaturesSection onGetStarted={handleGetStarted} />
      <HowItWorksSection />
      <PricingSection onGetStarted={handleGetStarted} />
      <PatentsSection />
      <Footer />
    </div>
  );
}

export default LandingPage;
