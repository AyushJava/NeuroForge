import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { CheckCircle2, XCircle, Loader2, Mail, Building2, ShieldCheck } from 'lucide-react';
import { organizationService } from '@/services/organizationService';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';

interface InviteDetails {
  id: number;
  email: string;
  orgName: string;
  role: string;
  status: string;
  invitedByName?: string;
  expiresAt: string;
}

type Stage = 'loading' | 'details' | 'acting' | 'accepted' | 'rejected' | 'error';

const ROLE_LABELS: Record<string, string> = {
  ORG_ADMIN: 'Organization Admin',
  PROJECT_MANAGER: 'Project Manager',
  DEVELOPER: 'Developer',
  QA: 'QA',
  CLIENT: 'Client',
};

export default function InvitationPage() {
  const [, setLocation] = useLocation();
  const { logout } = useAuth();
  const [token, setToken] = useState('');
  const [stage, setStage] = useState<Stage>('loading');
  const [details, setDetails] = useState<InviteDetails | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token') || '';
    setToken(t);

    if (!t) {
      setMessage('No invitation token found in the URL. Please check the link in your email.');
      setStage('error');
      return;
    }

    // Validate token & fetch details
    api.get<any>(`/invitations/validate?token=${encodeURIComponent(t)}`)
      .then(res => {
        const inv: InviteDetails = res.data?.data;
        if (!inv) { setMessage(res.data?.message || 'Invalid or expired invitation.'); setStage('error'); return; }
        if (inv.status !== 'PENDING') {
          setMessage(`This invitation has already been ${inv.status.toLowerCase()}.`);
          setStage('error');
          return;
        }
        setDetails(inv);
        setStage('details');
      })
      .catch(e => {
        setMessage(e?.response?.data?.message || 'Invalid or expired invitation link.');
        setStage('error');
      });
  }, []);

  const handleAccept = async () => {
    setStage('acting');
    try {
      await organizationService.acceptInvitation(token);
      setMessage(`You have successfully joined ${details?.orgName || 'the organization'}. You can now sign in.`);
      setStage('accepted');
    } catch (e: any) {
      setMessage(e?.response?.data?.message || 'Failed to accept invitation. The link may have expired.');
      setStage('error');
    }
  };

  const handleReject = async () => {
    setStage('acting');
    try {
      await organizationService.rejectInvitation(token);
      setMessage('You have declined this invitation.');
      setStage('rejected');
    } catch (e: any) {
      setMessage(e?.response?.data?.message || 'Failed to decline invitation.');
      setStage('error');
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center p-4">
      <div className="bg-[#111827] border border-[#1e2d4a] rounded-2xl p-8 w-full max-w-md text-center shadow-2xl">

        {/* Loading */}
        {stage === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-sm text-gray-400">Validating your invitation…</p>
          </>
        )}

        {/* Details — pending invite */}
        {stage === 'details' && details && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-blue-400" />
            </div>
            <h1 className="text-xl font-bold text-white mb-1">You're Invited!</h1>
            <p className="text-sm text-gray-400 mb-6">Review the details below before accepting.</p>

            <div className="bg-[#0d1526] border border-[#1e2d4a] rounded-xl p-4 mb-6 text-left space-y-3">
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Organization</p>
                  <p className="text-sm font-semibold text-white">{details.orgName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Assigned Role</p>
                  <p className="text-sm font-semibold text-white">{ROLE_LABELS[details.role] || details.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Invited To</p>
                  <p className="text-sm font-semibold text-white">{details.email}</p>
                </div>
              </div>
              {details.invitedByName && (
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-[10px] text-primary font-bold">
                    {details.invitedByName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Invited By</p>
                    <p className="text-sm font-semibold text-white">{details.invitedByName}</p>
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Expires: {new Date(details.expiresAt).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={handleReject}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-[#1e2d4a] text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                Decline
              </button>
              <button onClick={handleAccept}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors">
                Accept Invitation
              </button>
            </div>
          </>
        )}

        {/* Acting (processing) */}
        {stage === 'acting' && (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-sm text-gray-400">Processing your response…</p>
          </>
        )}

        {/* Accepted */}
        {stage === 'accepted' && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Invitation Accepted</h1>
            <p className="text-sm text-gray-400 mb-6">{message}</p>
            <button onClick={() => {
              logout();
              setLocation('/login');
            }}
              className="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors">
              Go to Login
            </button>
          </>
        )}

        {/* Rejected */}
        {stage === 'rejected' && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-slate-500/10 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-slate-400" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Invitation Declined</h1>
            <p className="text-sm text-gray-400 mb-6">{message}</p>
            <button onClick={() => setLocation('/')}
              className="w-full px-4 py-2.5 text-sm font-medium rounded-lg border border-[#1e2d4a] text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
              Go to Home
            </button>
          </>
        )}

        {/* Error */}
        {stage === 'error' && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Something Went Wrong</h1>
            <p className="text-sm text-gray-400 mb-6">{message}</p>
            <button onClick={() => setLocation('/')}
              className="w-full px-4 py-2.5 text-sm font-medium rounded-lg border border-[#1e2d4a] text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
              Go to Home
            </button>
          </>
        )}

        <p className="text-xs text-gray-600 mt-6">NeuroForge · Secure Invitation Portal</p>
      </div>
    </div>
  );
}
