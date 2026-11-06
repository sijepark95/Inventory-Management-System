import React, { useState, useRef, useEffect } from "react";
import { User } from "firebase/auth";
import { handleSignOut, signInWithGoogle } from "../lib/firebase";
import {
  Building2,
  LogIn,
  LogOut,
  ChevronDown,
  Check,
  Users,
  Store,
  Bell,
  X,
  Loader2,
  Trash2
} from "lucide-react";

interface MainHeaderProps {
  user: User | null;
  loadingAuth: boolean;
  workspaceOwnerId?: string | null;
  workspaceOwnerEmail?: string | null;
  incomingShares?: any[];
  pendingInvitations?: any[];
  onSwitchWorkspace?: (ownerId: string, ownerEmail: string) => void;
  onAcceptInvitation?: (shareId: string, ownerId: string, ownerEmail: string) => void;
  onDeclineInvitation?: (shareId: string, ownerEmail?: string) => void;
  onResetTestData?: () => void;
  userRole?: string;
}

export default function MainHeader({
  user,
  loadingAuth,
  workspaceOwnerId,
  workspaceOwnerEmail,
  incomingShares = [],
  pendingInvitations = [],
  onSwitchWorkspace,
  onAcceptInvitation,
  onDeclineInvitation,
  onResetTestData,
  userRole = "admin",
}: MainHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [googleSigningIn, setGoogleSigningIn] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const handleGoogleSignIn = async () => {
    if (googleSigningIn) return;
    setGoogleSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/popup-blocked") {
        try {
          await signInWithGoogle(true);
        } catch {}
      } else if (code !== "auth/cancelled-popup-request" && code !== "auth/popup-closed-by-user") {
        console.warn("Google Sign in error:", err);
      }
    } finally {
      setGoogleSigningIn(false);
    }
  };

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isMyWorkspace = !workspaceOwnerId || (user && workspaceOwnerId === user.uid);
  const activeLabel = isMyWorkspace
    ? "My Primary Workspace"
    : `${workspaceOwnerEmail || "Shared Store"}`;

  // Accepted shares for workspace switcher
  const acceptedShares = incomingShares.filter(
    (s) => s.status !== "pending" && s.status !== "declined"
  );

  return (
    <header className="bg-white border-b border-neutral-200 shadow-xs sticky top-0 z-20" id="app-header">
      <div className="w-full px-4 sm:px-6">
        <div className="flex justify-between items-center h-16 gap-3">
          
          {/* Logo & Workspace Context */}
          <div className="flex items-center gap-3 sm:gap-4 overflow-hidden" id="brand-container">
            <div className="bg-blue-700 text-white p-2 rounded-xl flex items-center justify-center border border-blue-800 shrink-0 shadow-xs">
              <Building2 className="h-5 w-5" />
            </div>
            
            <div className="text-left flex flex-col justify-center overflow-hidden">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-neutral-900 font-sans tracking-tight truncate">
                  SMA Management System
                </h1>
                <span className="hidden sm:inline-flex text-[9px] bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200 font-mono font-bold">
                  SupplyPilot
                </span>
              </div>
              <p className="text-[10px] text-neutral-500 font-medium leading-none mt-0.5 truncate hidden sm:block">
                Secure Multi-Store Operations & Inventory Analytics
              </p>
            </div>
          </div>

          {/* Right Section: Notifications, Workspace Switcher & User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* IN-APP INVITATION NOTIFICATION BELL */}
            {user && (
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={() => setNotifOpen(!notifOpen)}
                  className={`p-2 rounded-xl border transition-all relative flex items-center justify-center cursor-pointer shadow-xs ${
                    pendingInvitations.length > 0
                      ? "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                      : "bg-[#f4f4f2] hover:bg-[#eaeae6] border-neutral-300/80 text-neutral-600"
                  }`}
                  id="header-notification-bell-btn"
                  title={
                    pendingInvitations.length > 0
                      ? `${pendingInvitations.length} Pending Workspace Invitations`
                      : "No new notifications"
                  }
                >
                  <Bell className="h-4 w-4" />
                  {pendingInvitations.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-bold font-mono px-1.5 py-0.2 rounded-full ring-2 ring-white animate-pulse">
                      {pendingInvitations.length}
                    </span>
                  )}
                </button>

                {/* Notifications Popover */}
                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-neutral-200 rounded-2xl shadow-xl z-50 p-3 text-left animate-in fade-in zoom-in-95 duration-100">
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                      <div className="flex items-center gap-1.5">
                        <Bell className="h-3.5 w-3.5 text-blue-700" />
                        <span className="text-xs font-bold text-neutral-900">Notifications</span>
                      </div>
                      <span className="text-[9px] font-mono font-bold bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded">
                        {pendingInvitations.length} pending
                      </span>
                    </div>

                    <div className="py-2 space-y-2 max-h-72 overflow-y-auto">
                      {pendingInvitations.length === 0 ? (
                        <div className="text-center py-6 text-neutral-400 text-xs">
                          No pending invitations.
                        </div>
                      ) : (
                        pendingInvitations.map((invite) => (
                          <div
                            key={invite.id}
                            className="bg-neutral-50 border border-neutral-200/90 rounded-xl p-3 space-y-2 text-left"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="overflow-hidden">
                                <div className="text-xs font-bold text-neutral-900 truncate">
                                  {invite.ownerEmail}
                                </div>
                                <div className="text-[10px] text-neutral-500 font-mono">
                                  Invited you as <span className="font-bold uppercase text-blue-800">{invite.role}</span>
                                </div>
                              </div>
                              <span className="text-[8px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded uppercase font-bold font-mono shrink-0">
                                Invitation
                              </span>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  if (onAcceptInvitation) {
                                    onAcceptInvitation(invite.id, invite.ownerId, invite.ownerEmail);
                                  }
                                  setNotifOpen(false);
                                }}
                                className="flex-1 bg-blue-700 hover:bg-blue-800 text-white text-[11px] font-bold py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
                              >
                                <Check className="h-3 w-3" />
                                <span>Accept</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (onDeclineInvitation) {
                                    onDeclineInvitation(invite.id, invite.ownerEmail);
                                  }
                                }}
                                className="bg-white hover:bg-neutral-100 text-neutral-600 text-[11px] font-bold py-1.5 px-2.5 rounded-lg border border-neutral-200 transition-colors cursor-pointer"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* WORKSPACE SWITCHER DROPDOWN */}
            {user && (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 bg-[#f4f4f2] hover:bg-[#eaeae6] border border-neutral-300/80 px-2.5 sm:px-3 py-1.5 rounded-xl transition-all text-left cursor-pointer group shadow-xs"
                  id="header-workspace-switcher-btn"
                  title="Switch Active Store Workspace"
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                  <div className="flex flex-col text-left">
                    <span className="text-[9px] uppercase font-bold text-neutral-500 tracking-wider flex items-center gap-1">
                      <Store className="h-2.5 w-2.5" />
                      Workspace
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-neutral-900 max-w-[120px] sm:max-w-[180px] md:max-w-[220px] truncate font-sans">
                        {activeLabel}
                      </span>
                      <span className={`text-[9px] font-mono font-bold px-1 py-0.2 rounded border ${
                        userRole === "admin"
                          ? "bg-amber-100 text-amber-900 border-amber-300"
                          : userRole === "manager"
                          ? "bg-blue-100 text-blue-900 border-blue-300"
                          : "bg-neutral-200 text-neutral-800 border-neutral-300"
                      }`}>
                        {userRole}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 text-neutral-500 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white border border-neutral-200 rounded-2xl shadow-xl z-50 p-2 text-left animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-2 border-b border-neutral-100">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono">
                          Store Workspaces
                        </span>
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          {1 + acceptedShares.length} Available
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        Switch between your primary store and shared workspaces.
                      </p>
                    </div>

                    <div className="py-1 space-y-1 max-h-64 overflow-y-auto">
                      {/* Primary Workspace Option */}
                      <button
                        type="button"
                        onClick={() => {
                          if (onSwitchWorkspace && user) {
                            onSwitchWorkspace(user.uid, user.email || "");
                          }
                          setDropdownOpen(false);
                        }}
                        className={`w-full p-2.5 rounded-xl flex items-center justify-between transition-colors cursor-pointer text-left ${
                          isMyWorkspace
                            ? "bg-emerald-50 text-emerald-950 border border-emerald-200"
                            : "hover:bg-neutral-50 text-neutral-800 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <div className={`p-1.5 rounded-lg shrink-0 ${isMyWorkspace ? "bg-emerald-600 text-white" : "bg-neutral-100 text-neutral-600"}`}>
                            <Store className="h-4 w-4" />
                          </div>
                          <div className="overflow-hidden">
                            <div className="text-xs font-bold truncate flex items-center gap-1.5">
                              <span>My Primary Workspace</span>
                              <span className="text-[9px] bg-neutral-200/80 text-neutral-700 px-1 py-0.2 rounded font-mono font-normal">
                                Owner
                              </span>
                            </div>
                            <div className="text-[10px] text-neutral-500 font-mono truncate">
                              {user.email}
                            </div>
                          </div>
                        </div>
                        {isMyWorkspace && <Check className="h-4 w-4 text-emerald-600 shrink-0" />}
                      </button>

                      {/* Shared Workspaces Section */}
                      {acceptedShares.length > 0 && (
                        <>
                          <div className="px-3 pt-2 pb-1 text-[9px] font-bold text-neutral-400 uppercase tracking-wider font-mono flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>Shared With Me ({acceptedShares.length})</span>
                          </div>

                          {acceptedShares.map((share) => {
                            const isSelected = workspaceOwnerId === share.ownerId;
                            return (
                              <button
                                key={share.id || share.ownerId}
                                type="button"
                                onClick={() => {
                                  if (onSwitchWorkspace) {
                                    onSwitchWorkspace(share.ownerId, share.ownerEmail);
                                  }
                                  setDropdownOpen(false);
                                }}
                                className={`w-full p-2.5 rounded-xl flex items-center justify-between transition-colors cursor-pointer text-left ${
                                  isSelected
                                    ? "bg-blue-50 text-blue-950 border border-blue-200"
                                    : "hover:bg-neutral-50 text-neutral-800 border border-transparent"
                                }`}
                              >
                                <div className="flex items-center gap-2.5 overflow-hidden">
                                  <div className={`p-1.5 rounded-lg shrink-0 ${isSelected ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-600"}`}>
                                    <Building2 className="h-4 w-4" />
                                  </div>
                                  <div className="overflow-hidden">
                                    <div className="text-xs font-bold truncate flex items-center gap-1.5">
                                      <span className="truncate">{share.ownerEmail}</span>
                                      <span className={`text-[8px] font-bold px-1 py-0.2 rounded uppercase font-mono ${
                                        share.role === "admin"
                                          ? "bg-amber-100 text-amber-800"
                                          : share.role === "manager"
                                          ? "bg-blue-100 text-blue-800"
                                          : "bg-neutral-100 text-neutral-700"
                                      }`}>
                                        {share.role || "manager"}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-neutral-400 font-mono truncate">
                                      ID: {share.ownerId?.slice(0, 10)}...
                                    </div>
                                  </div>
                                </div>
                                {isSelected && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
                              </button>
                            );
                          })}
                        </>
                      )}

                      {/* Pending Invitations list inside Switcher */}
                      {pendingInvitations.length > 0 && (
                        <div className="pt-2 border-t border-neutral-100">
                          <div className="px-3 py-1 text-[9px] font-bold text-amber-800 uppercase tracking-wider font-mono flex items-center gap-1">
                            <Bell className="h-3 w-3 text-amber-600" />
                            <span>Pending Invitations ({pendingInvitations.length})</span>
                          </div>
                          {pendingInvitations.map((invite) => (
                            <div
                              key={invite.id}
                              className="p-2 bg-amber-50/70 border border-amber-200 rounded-xl mb-1 flex items-center justify-between gap-2"
                            >
                              <div className="overflow-hidden">
                                <div className="text-[11px] font-bold text-neutral-900 truncate">
                                  {invite.ownerEmail}
                                </div>
                                <span className="text-[8px] uppercase font-mono text-neutral-600">
                                  Role: {invite.role}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onAcceptInvitation) {
                                      onAcceptInvitation(invite.id, invite.ownerId, invite.ownerEmail);
                                    }
                                    setDropdownOpen(false);
                                  }}
                                  className="px-2 py-1 bg-blue-700 hover:bg-blue-800 text-white text-[9px] font-bold rounded-lg cursor-pointer"
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onDeclineInvitation) {
                                      onDeclineInvitation(invite.id, invite.ownerEmail);
                                    }
                                  }}
                                  className="px-1.5 py-1 bg-white hover:bg-neutral-100 text-neutral-600 text-[9px] font-bold rounded-lg border border-neutral-200 cursor-pointer"
                                >
                                  &times;
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-2 pt-2 border-t border-neutral-100 px-2 flex items-center justify-between text-[10px] text-neutral-400">
                      <span className="font-mono">Domain: supplypilot.space</span>
                      <span className="text-emerald-600 font-semibold font-mono">Online</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* User Profile & Sign Out */}
            {loadingAuth ? (
              <div className="text-xs text-neutral-400 animate-pulse font-mono px-2">Verifying...</div>
            ) : user ? (
              <div className="flex items-center gap-2 bg-[#f4f4f2] p-1.5 pl-2 rounded-xl border border-neutral-300/80 shadow-xs" id="user-profile-widget">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    referrerPolicy="no-referrer"
                    alt={user.displayName || "User"}
                    className="w-7 h-7 rounded-lg border border-neutral-300 object-cover"
                    id="user-avatar"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-blue-700 text-white flex items-center justify-center text-xs font-mono font-bold">
                    {user.displayName?.charAt(0) || user.email?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                )}
                <div className="hidden lg:block text-left mr-1">
                  <div className="text-xs font-bold text-neutral-900 leading-tight max-w-[100px] truncate">
                    {user.displayName || user.email?.split("@")[0]}
                  </div>
                  <div className="text-[9px] text-neutral-500 font-mono leading-none truncate max-w-[100px]">
                    {user.email}
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="bg-white hover:bg-red-50 text-neutral-600 hover:text-red-700 p-1.5 rounded-lg border border-neutral-200 transition-colors flex items-center justify-center cursor-pointer shadow-2xs"
                  title="Sign Out"
                  id="sign-out-btn"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleSigningIn}
                className="flex items-center bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold px-3 sm:px-4 py-2 rounded-xl border border-blue-700 transition-all gap-2 cursor-pointer shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
                id="google-signin-btn"
              >
                {googleSigningIn ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="h-3.5 w-3.5" />
                    <span>Sign In</span>
                  </>
                )}
              </button>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
