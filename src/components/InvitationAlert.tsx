import React, { useState } from "react";
import { Bell, Check, X, Store, Shield, ArrowRight, Sparkles } from "lucide-react";

interface InvitationAlertProps {
  pendingInvitations: any[];
  onAccept: (shareId: string, ownerId: string, ownerEmail: string) => Promise<void> | void;
  onDecline: (shareId: string, ownerEmail?: string) => Promise<void> | void;
}

export default function InvitationAlert({
  pendingInvitations,
  onAccept,
  onDecline,
}: InvitationAlertProps) {
  const [minimized, setMinimized] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  if (!pendingInvitations || pendingInvitations.length === 0 || minimized) {
    return null;
  }

  const handleAccept = async (invite: any) => {
    setProcessingId(invite.id);
    try {
      await onAccept(invite.id, invite.ownerId, invite.ownerEmail);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invite: any) => {
    setProcessingId(invite.id);
    try {
      await onDecline(invite.id, invite.ownerEmail);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div
      className="fixed top-20 right-4 sm:right-6 z-50 max-w-md w-full animate-in fade-in slide-in-from-top-4 duration-200"
      id="in-app-invitation-alert"
    >
      <div className="bg-white border-2 border-blue-600 rounded-2xl shadow-2xl overflow-hidden text-left">
        {/* Header */}
        <div className="bg-blue-700 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-800 rounded-lg animate-pulse">
              <Bell className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-xs font-bold font-sans">
                Workspace Invitation {pendingInvitations.length > 1 ? `(${pendingInvitations.length})` : ""}
              </h3>
              <p className="text-[10px] text-blue-200">
                You have been invited to collaborate on a store
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMinimized(true)}
            className="text-blue-200 hover:text-white p-1 rounded-md hover:bg-blue-800 transition-colors text-xs font-bold cursor-pointer"
            title="Dismiss to notification bell"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* List of Pending Invites */}
        <div className="p-3 sm:p-4 space-y-3 max-h-80 overflow-y-auto">
          {pendingInvitations.map((invite) => {
            const isProcessing = processingId === invite.id;
            return (
              <div
                key={invite.id}
                className="bg-neutral-50 border border-neutral-200/80 rounded-xl p-3.5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 bg-blue-100 text-blue-700 rounded-xl shrink-0 mt-0.5">
                      <Store className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-neutral-900 leading-tight">
                        {invite.ownerEmail}
                      </div>
                      <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                        Store Owner
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase shrink-0 ${
                      invite.role === "admin"
                        ? "bg-amber-100 text-amber-900 border-amber-300"
                        : invite.role === "manager"
                        ? "bg-blue-100 text-blue-900 border-blue-300"
                        : "bg-neutral-200 text-neutral-800 border-neutral-300"
                    }`}
                  >
                    {invite.role || "manager"}
                  </span>
                </div>

                <p className="text-[11px] text-neutral-600 leading-relaxed">
                  Invited you to access and manage store operations, recipes, and inventory in their workspace.
                </p>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleAccept(invite)}
                    className="flex-1 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                    id={`accept-invite-${invite.id}`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{isProcessing ? "Accepting..." : "Accept & Open Store"}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleDecline(invite)}
                    className="bg-white hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900 text-xs font-bold py-2 px-3 rounded-xl border border-neutral-200 transition-colors disabled:opacity-50 cursor-pointer"
                    id={`decline-invite-${invite.id}`}
                  >
                    Decline
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="bg-neutral-100/70 px-4 py-2 border-t border-neutral-200/80 flex items-center justify-between text-[10px] text-neutral-500">
          <span>You can also manage invitations in the Header menu</span>
          <button
            type="button"
            onClick={() => setMinimized(true)}
            className="text-neutral-600 hover:text-neutral-900 font-bold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
