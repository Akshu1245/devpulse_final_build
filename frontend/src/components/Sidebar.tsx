import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Shield, DollarSign, Bot, Brain, Eye,
  Activity, Settings, CreditCard, Upload, Lock,
  ChevronLeft, ChevronRight, Zap, Bell, Search
} from "lucide-react";

/* ── nav config ───────────────────────────────────────── */
const NAV = [
  {
    section: "Core",
    links: [
      { to: "/",                icon: LayoutDashboard, label: "Dashboard"       },
      { to: "/security",        icon: Shield,          label: "Security"         },
      { to: "/costs",           icon: DollarSign,      label: "LLM Costs"       },
      { to: "/agent-guard",     icon: Bot,             label: "AgentGuard"      },
    ],
  },
  {
    section: "Analysis",
    links: [
      { to: "/thinking-tokens", icon: Brain,           label: "Thinking Tokens" },
      { to: "/shadow-apis",     icon: Eye,             label: "Shadow APIs"     },
      { to: "/activity",        icon: Activity,        label: "Activity"        },
    ],
  },
  {
    section: "Workspace",
    links: [
      { to: "/postman",         icon: Upload,          label: "Import APIs"     },
      { to: "/compliance",      icon: Lock,            label: "Compliance"      },
      { to: "/billing",         icon: CreditCard,      label: "Billing"         },
      { to: "/settings",        icon: Settings,        label: "Settings"        },
    ],
  },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      style={{
        width: collapsed ? 68 : 238,
        minHeight: "100vh",
        background: "hsl(225, 16%, 5%)",
        borderRight: "1px solid hsl(225, 12%, 13%)",
        display: "flex",
        flexDirection: "column",
        transition: "width 280ms cubic-bezier(0.16,1,0.3,1)",
        overflow: "hidden",
        flexShrink: 0,
        position: "relative",
        zIndex: 10,
      }}
    >
      {/* Ambient top glow */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 260, pointerEvents: "none",
        background: "radial-gradient(ellipse 120% 70% at 50% 0%, hsl(34 84% 58% / 0.07), transparent 85%)",
      }} />

      {/* Subtle left glow on active */}
      <div style={{
        position: "absolute", top: 0, left: 0, bottom: 0, width: 1, pointerEvents: "none",
        background: "linear-gradient(180deg, hsl(34 84% 58% / 0.4), hsl(195 54% 46% / 0.2), transparent)",
      }} />

      {/* ── Logo ───────────────────────────────────────── */}
      <div style={{
        height: 60, padding: "0 14px",
        display: "flex", alignItems: "center", gap: 10,
        borderBottom: collapsed ? "none" : "1px solid hsl(225, 12%, 13%)",
        flexShrink: 0, position: "relative", zIndex: 1,
      }}>
        <div style={{
          width: 34, height: 34, flexShrink: 0,
          background: "linear-gradient(135deg, hsl(40,90%,70%), hsl(34,84%,52%))",
          borderRadius: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 0 1px hsl(34 84% 58% / 0.3), 0 4px 14px hsl(34 84% 58% / 0.3), inset 0 1px 0 hsl(40 90% 85% / 0.5)",
        }}>
          <Zap size={17} color="hsl(225, 16%, 5%)" strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <div style={{ overflow: "hidden" }}>
            <p style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 15.5, fontWeight: 900,
              background: "linear-gradient(135deg, hsl(40,90%,80%), hsl(34,84%,62%))",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text", lineHeight: 1, whiteSpace: "nowrap",
            }}>DevPulse</p>
            <p style={{ fontSize: 9.5, color: "hsl(225, 10%, 42%)", fontWeight: 600, marginTop: 2, fontFamily: "'DM Mono', monospace", letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>API Intelligence</p>
          </div>
        )}
      </div>

      {/* ── Search (only when expanded) ─────────────────── */}
      {!collapsed && (
        <div style={{ padding: "10px 12px", position: "relative", zIndex: 1 }}>
          <div style={{ position: "relative" }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "hsl(225, 10%, 38%)", pointerEvents: "none" }} />
            <input
              placeholder="Search..."
              style={{
                width: "100%", padding: "8px 10px 8px 30px",
                background: "hsl(225 14% 9%)",
                border: "1px solid hsl(225, 12%, 15%)",
                borderRadius: 8, color: "hsl(40, 18%, 90%)",
                fontFamily: "'DM Sans', sans-serif", fontSize: 12.5,
                outline: "none", transition: "border-color 100ms",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = "hsl(34 84% 58% / 0.4)")}
              onBlur={e => (e.currentTarget.style.borderColor = "hsl(225, 12%, 15%)")}
            />
          </div>
        </div>
      )}

      {/* ── Nav groups ──────────────────────────────────── */}
      <nav style={{ flex: 1, padding: collapsed ? "4px 8px" : "4px 10px", overflowY: "auto", overflowX: "hidden", position: "relative", zIndex: 1 }} className="scrollbar-hide">
        {NAV.map(({ section, links }) => (
          <div key={section} style={{ marginBottom: 6 }}>
            {!collapsed && (
              <p style={{
                fontSize: 9.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase",
                color: "hsl(225, 10%, 30%)", padding: "8px 10px 5px",
                fontFamily: "'DM Mono', monospace",
              }}>{section}</p>
            )}
            {links.map(link => (
              <NavLink key={link.to} to={link.to} end={link.to === "/"}>
                {({ isActive }) => (
                  <span className={`sidebar-item${isActive ? " active" : ""}`}
                    style={{
                      justifyContent: collapsed ? "center" : "flex-start",
                      padding: collapsed ? "10px" : "9px 10px",
                      color: isActive ? "hsl(40, 90%, 76%)" : "hsl(225, 10%, 48%)",
                      display: "flex", alignItems: "center", gap: collapsed ? 0 : 10,
                      cursor: "pointer",
                    }}>
                    <link.icon size={15.5} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.75 }} />
                    {!collapsed && <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{link.label}</span>}
                  </span>
                )}
              </NavLink>
            ))}
            {!collapsed && <div className="divider" style={{ margin: "6px 10px" }} />}
          </div>
        ))}
      </nav>

      {/* ── User card ───────────────────────────────────── */}
      {!collapsed && (
        <div style={{
          padding: "10px 12px 8px",
          borderTop: "1px solid hsl(225, 12%, 13%)",
          position: "relative", zIndex: 1,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 10, background: "hsl(225 13% 9%)", border: "1px solid hsl(225 12% 14%)" }}>
            {/* Avatar */}
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: "linear-gradient(135deg, hsl(34,84%,58%), hsl(195,54%,46%))",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 800, color: "hsl(225,16%,5%)",
              fontFamily: "'DM Sans', sans-serif",
            }}>A</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--col-fg)", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Demo User</p>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                <span className="status-dot status-dot-healthy" style={{ width: 6, height: 6, animation: "pulse-ring 2.4s ease-out infinite" }} />
                <p style={{ fontSize: 10, color: "hsl(225, 10%, 38%)", fontFamily: "'DM Mono', monospace" }}>pro · live</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Collapse toggle ──────────────────────────────── */}
      <div style={{ padding: "4px 8px 10px", position: "relative", zIndex: 1 }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            width: "100%", padding: "9px", display: "flex", alignItems: "center", justifyContent: "center",
            background: "hsl(225 13% 9%)",
            border: "1px solid hsl(225 12% 14%)",
            borderRadius: 8, cursor: "pointer",
            color: "hsl(225, 10%, 38%)",
            transition: "all 100ms",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--col-fg)"; (e.currentTarget as HTMLElement).style.borderColor = "hsl(225 12% 20%)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "hsl(225, 10%, 38%)"; (e.currentTarget as HTMLElement).style.borderColor = "hsl(225 12% 14%)"; }}
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </div>
    </aside>
  );
}
