import React, { useState } from "react";
import { UserPlus, Trash2, Mail, ShieldCheck, Users, HelpCircle, Shield, Bell, Check, X, Store } from "lucide-react";

interface CollaboratorsViewProps {
  user: any;
  myShares: any[];
  incomingShares: any[];
  onInvite: (email: string, role: string) => Promise<any>;
  onRemoveInvite: (shareId: string) => Promise<void>;
  onUpdateRole?: (shareId: string, role: string) => Promise<void>;
  onAcceptInvitation?: (shareId: string, ownerId: string, ownerEmail: string) => Promise<void> | void;
  onDeclineInvitation?: (shareId: string, ownerEmail?: string) => Promise<void> | void;
  workspaceOwnerId: string | null;
  workspaceOwnerEmail: string | null;
  onSwitchWorkspace: (ownerId: string, ownerEmail: string) => void;
  userRole?: string;
}

export default function CollaboratorsView({
  user,
  myShares,
  incomingShares,
  onInvite,
  onRemoveInvite,
  onUpdateRole,
  onAcceptInvitation,
  onDeclineInvitation,
  workspaceOwnerId,
  workspaceOwnerEmail,
  onSwitchWorkspace,
  userRole = "admin",
}: CollaboratorsViewProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("manager");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [processingShareId, setProcessingShareId] = useState<string | null>(null);

  const canManageCollaborators = workspaceOwnerId === user?.uid || userRole === "admin";

  // Pending invitations sent to the currently logged in user
  const pendingIncoming = incomingShares.filter((s) => s.status === "pending");
  const acceptedIncoming = incomingShares.filter((s) => s.status !== "pending" && s.status !== "declined");

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const emailTrimmed = inviteEmail.trim().toLowerCase();
    if (!emailTrimmed) return;

    if (emailTrimmed === user?.email?.toLowerCase()) {
      setError("You cannot invite yourself to your own workspace.");
      return;
    }

    setSubmitting(true);
    try {
      await onInvite(emailTrimmed, inviteRole);
      setSuccess(`Workspace invitation created for ${emailTrimmed} as ${inviteRole}. They will see an in-app alert when they sign in.`);
      setInviteEmail("");
      setInviteRole("manager");
    } catch (err: any) {
      setError(err?.message || "Failed to invite. Please check connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (shareId: string, newRole: string) => {
    if (!onUpdateRole) return;
    try {
      await onUpdateRole(shareId, newRole);
    } catch (err: any) {
      console.error("Failed to update role:", err);
      alert(err.message || "Failed to update role.");
    }
  };

  const handleAccept = async (share: any) => {
    if (!onAcceptInvitation) return;
    setProcessingShareId(share.id);
    try {
      await onAcceptInvitation(share.id, share.ownerId, share.ownerEmail);
    } finally {
      setProcessingShareId(null);
    }
  };

  const handleDecline = async (share: any) => {
    if (!onDeclineInvitation) return;
    setProcessingShareId(share.id);
    try {
      await onDeclineInvitation(share.id, share.ownerEmail);
    } finally {
      setProcessingShareId(null);
    }
  };

  const activeWorkspaceLabel =
    workspaceOwnerId === user?.uid
      ? "My Primary Workspace"
      : `Collaborating in ${workspaceOwnerEmail}'s workspace`;

  return (
    <div className="space-y-6" id="collaborators-workspace-panel">
      
      {/* PENDING INVITATIONS FOR CURRENT USER BANNER */}
      {pendingIncoming.length > 0 && (
        <div className="bg-blue-50 border-2 border-blue-600 p-5 rounded-2xl text-left space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-700 text-white rounded-xl">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900">
                  Pending Invitations For You ({pendingIncoming.length})
                </h3>
                <p className="text-xs text-neutral-600">
                  You have been invited to collaborate on these store workspaces. Accept to gain instant access.
                </p>
              </div>
            </div>
            <span className="text-[10px] bg-blue-700 text-white font-mono font-bold px-2 py-0.5 rounded-full animate-pulse">
              Action Required
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {pendingIncoming.map((invite) => {
              const isProcessing = processingShareId === invite.id;
              return (
                <div
                  key={invite.id}
                  className="bg-white border border-blue-200 rounded-xl p-3.5 space-y-3 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-blue-700 shrink-0" />
                      <div className="overflow-hidden">
                        <div className="text-xs font-bold text-neutral-900 truncate">
                          {invite.ownerEmail}
                        </div>
                        <div className="text-[10px] text-neutral-500 font-mono">
                          Store Owner
                        </div>
                      </div>
                    </div>
                    <span className="text-[9px] uppercase font-mono font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300">
                      {invite.role || "manager"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleAccept(invite)}
                      className="flex-1 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>{isProcessing ? "Accepting..." : "Accept"}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleDecline(invite)}
                      className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold py-1.5 px-3 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Workspace Banner */}
      <div className="bg-white border border-neutral-200 p-6 rounded-xl text-left space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-700 text-white p-2.5 rounded-xl">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-neutral-900">Workspace Status</h2>
            <p className="text-xs text-neutral-900/60">Manage shared access, roles, or switch between active store workspaces.</p>
          </div>
        </div>

        <div className="bg-[#f0efeb] border border-neutral-200 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <span className="text-[9px] font-bold text-neutral-900/50 font-mono">Current Context</span>
            <div className="text-sm font-bold text-neutral-900 flex items-center gap-1.5 mt-0.5">
              <span className="w-2.5 h-2.5 bg-emerald-600 rounded-full inline-block"></span>
              {activeWorkspaceLabel}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-neutral-900/60 font-mono">
                Active Owner ID: <span className="font-bold">{workspaceOwnerId}</span>
              </span>
              <span className="text-[10px] text-neutral-400 font-mono">•</span>
              <span className="text-[10px] text-neutral-600 font-mono font-bold flex items-center gap-1">
                Your Role: 
                <span className={`px-1.5 py-0.2 text-[8px] font-mono font-bold rounded ${
                  userRole === "admin"
                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                    : userRole === "manager"
                    ? "bg-blue-100 text-blue-800 border border-blue-300"
                    : "bg-gray-100 text-gray-700 border border-gray-300"
                }`}>
                  {userRole}
                </span>
              </span>
            </div>
          </div>

          {acceptedIncoming.length > 0 && (
            <div className="flex flex-col gap-1 w-full sm:w-auto">
              <label className="text-[9px] font-bold text-neutral-900/50 font-mono">Switch Workspace</label>
              <select
                value={workspaceOwnerId || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === user.uid) {
                    onSwitchWorkspace(user.uid, user.email || "");
                  } else {
                    const match = acceptedIncoming.find((s) => s.ownerId === val);
                    if (match) {
                      onSwitchWorkspace(match.ownerId, match.ownerEmail);
                    }
                  }
                }}
                className="bg-white border border-neutral-200 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-hidden cursor-pointer"
              >
                <option value={user.uid}>My Primary Workspace ({user.email})</option>
                {acceptedIncoming.map((share) => (
                  <option key={share.id} value={share.ownerId}>
                    Shared: {share.ownerEmail} ({share.role || "manager"})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Invite a Collaborator Card */}
        <div className="bg-white border border-neutral-200 p-6 rounded-xl space-y-4 text-left">
          <div className="flex items-center gap-2 border-b border-neutral-200/10 pb-3">
            <UserPlus className="h-4.5 w-4.5 text-blue-700" />
            <h3 className="text-xs font-bold text-neutral-900">Invite Collaborator</h3>
          </div>

          {!canManageCollaborators ? (
            <div className="bg-neutral-50 border border-dashed border-neutral-300 p-6 text-center rounded-xl">
              <Shield className="h-6 w-6 text-neutral-400 mx-auto mb-2" />
              <p className="text-xs text-neutral-500 font-bold">Administrator Access Required</p>
              <p className="text-[11px] text-neutral-400 mt-1">
                Only workspace owners and collaborators with the <span className="font-bold">admin</span> role can invite new users.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Invite team members by email. When they visit SupplyPilot, an in-app alert will appear allowing them to accept or decline immediately.
              </p>

              <form onSubmit={handleInviteSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-900/60 mb-1">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-3.5 w-3.5 text-neutral-400" />
                    </div>
                    <input
                      type="email"
                      required
                      placeholder="e.g. manager@restaurant.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl pl-9 pr-3 py-2 text-xs font-bold focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-900/60 mb-1">Assigned Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-hidden cursor-pointer"
                  >
                    <option value="staff">Staff (Read-only access)</option>
                    <option value="manager">Manager (Can edit recipes, ingredients, timesheets)</option>
                    <option value="admin">Admin (Can manage data + invite other collaborators)</option>
                  </select>
                </div>

                {error && (
                  <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 p-2.5 rounded-xl text-left">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-left">
                    {success}
                  </div>
                )}

                <div className="pt-2 border-t border-neutral-100 space-y-1">
                  <span className="text-[9px] font-bold text-neutral-500 block font-mono">Direct App URL:</span>
                  <div className="flex items-center gap-1.5 bg-neutral-50 p-1.5 border border-neutral-200 rounded-lg">
                    <span className="font-mono text-[9px] text-neutral-600 truncate flex-1 select-all">
                      {typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://supplypilot.space"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const url = typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://supplypilot.space";
                        navigator.clipboard.writeText(url);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      }}
                      className="px-2 py-1 bg-blue-700 text-white text-[8px] font-bold hover:bg-blue-800 transition-colors rounded cursor-pointer"
                    >
                      {copiedLink ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {submitting ? "Creating Invitation..." : "Send In-App Invitation"}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Invited Collaborators List */}
        <div className="bg-white border border-neutral-200 p-6 rounded-xl space-y-4 text-left">
          <div className="flex items-center gap-2 border-b border-neutral-200/10 pb-3">
            <ShieldCheck className="h-4.5 w-4.5 text-blue-700" />
            <h3 className="text-xs font-bold text-neutral-900">Workspace Collaborators</h3>
          </div>

          <p className="text-xs text-neutral-600">
            Users invited to this store workspace. Pending invitations will be accepted when the user opens the web app.
          </p>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {myShares.length === 0 ? (
              <div className="border border-dashed border-neutral-300 p-8 text-center text-xs text-neutral-400 font-sans rounded-xl">
                No collaborators in this workspace context.
              </div>
            ) : (
              myShares.map((share) => {
                const isPending = share.status === "pending";
                return (
                  <div
                    key={share.id}
                    className={`flex items-center justify-between border p-3 rounded-xl gap-3 text-left ${
                      isPending
                        ? "bg-amber-50/50 border-amber-200"
                        : "bg-neutral-50 border-neutral-200"
                    }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-neutral-900 truncate" title={share.invitedEmail}>
                          {share.invitedEmail}
                        </span>
                        <span
                          className={`text-[8px] font-bold px-1.5 py-0.2 rounded font-mono uppercase ${
                            isPending
                              ? "bg-amber-100 text-amber-900 border border-amber-300"
                              : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                          }`}
                        >
                          {isPending ? "Pending In-App Acceptance" : "Active"}
                        </span>
                      </div>
                      <span className="text-[8px] font-mono text-neutral-500 block">
                        Invited: {share.createdAt ? new Date(share.createdAt).toLocaleDateString() : "N/A"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {canManageCollaborators && onUpdateRole ? (
                        <select
                          value={share.role || "manager"}
                          onChange={(e) => handleRoleChange(share.id, e.target.value)}
                          className="bg-white border border-neutral-200 rounded-lg px-2 py-1 text-[10px] font-bold focus:outline-hidden cursor-pointer"
                        >
                          <option value="staff">Staff</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span className={`text-[8px] px-1.5 py-0.5 font-bold rounded border ${
                          share.role === "admin" 
                            ? "bg-amber-50 text-amber-700 border-amber-300"
                            : share.role === "manager"
                            ? "bg-blue-50 text-blue-700 border-blue-300"
                            : "bg-gray-50 text-gray-600 border-gray-300"
                        }`}>
                          {share.role || "manager"}
                        </span>
                      )}

                      {canManageCollaborators && (
                        <button
                          type="button"
                          onClick={() => onRemoveInvite(share.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 border border-transparent hover:border-red-300 rounded-lg transition-colors cursor-pointer"
                          title="Revoke / Cancel invitation"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Sharing Info Callout */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-left flex items-start gap-3">
        <HelpCircle className="h-4.5 w-4.5 text-blue-700 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-bold text-blue-950">Workspace Roles Explained</h4>
          <ul className="list-disc pl-4 text-[11px] text-blue-900 space-y-1 mt-1">
            <li><span className="font-bold">Staff</span>: Read-only access to audit reports, recipes, and shift data. Cannot perform any modifications.</li>
            <li><span className="font-bold">Manager</span>: Full access to add/update/delete ingredients, recipes, timesheets, and staff registry.</li>
            <li><span className="font-bold">Admin</span>: Complete workspace permissions plus the ability to invite new users, revoke access, and change roles.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
