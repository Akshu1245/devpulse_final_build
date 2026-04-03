/**
 * useAuth Hook — Demo Mode
 * Returns a mock authenticated user for standalone demo operation.
 * In production, this would validate JWT tokens from localStorage.
 */

import { useState, useCallback } from "react";

export interface AuthUser {
  id: number;
  openId: string;
  name: string;
  email: string;
  role: string;
  workspace: string;
  activeWorkspaceId: number;
}

const DEMO_USER: AuthUser = {
  id: 1,
  openId: "demo-user-001",
  name: "Akshat Jain",
  email: "akshat@devpulse.in",
  role: "owner",
  workspace: "DevPulse Demo",
  activeWorkspaceId: 1,
};

export function useAuth() {
  const [user] = useState<AuthUser>(DEMO_USER);
  const [isLoading] = useState(false);

  const logout = useCallback(() => {
    localStorage.removeItem("devpulse_token");
    window.location.href = "/";
  }, []);

  return { user, isLoading, isAuthenticated: true, logout };
}
