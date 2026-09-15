import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { FaBrain } from 'react-icons/fa';
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from '@/services/authService';
import { organizationService, Organization } from '@/services/organizationService';
import { useAuth } from '@/context/AuthContext';
import { mapBackendRoleToUiRole, roleRouteMap } from '@/lib/roleUtils';

// ─── Step 1 schema: email only ────────────────────────────────────────────────
const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});
type EmailFormValues = z.infer<typeof emailSchema>;

// ─── Step 2 schema: name + otp + password ────────────────────────────────────
const registerSchema = z.object({
  fullName: z.string().min(3, 'Name must be at least 3 characters').max(50),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters'),
  role: z.string().optional(),
  organizationId: z.string().optional(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(20)
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[@$!%*?&]/, 'Must contain a special character (@$!%*?&)'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});
type RegisterFormValues = z.infer<typeof registerSchema>;

function getStrength(pw: string) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8)             s += 25;
  if (pw.match(/[A-Z]/))          s += 25;
  if (pw.match(/[a-z]/))          s += 25;
  if (pw.match(/[0-9@$!%*?&]/))   s += 25;
  return s;
}

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, role: authRole, setUser } = useAuth();

  // Redirect already-authenticated users to their dashboard
  React.useEffect(() => {
    if (isAuthenticated && authRole) {
      setLocation(roleRouteMap[authRole] ?? '/');
    }
  }, [isAuthenticated, authRole, setLocation]);

  // ─── Wizard state ──────────────────────────────────────────────────────────
  const [step, setStep]                   = useState<'email' | 'otp'>('email');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [digits, setDigits]               = useState(['', '', '', '', '', '']);
  const inputRefs                         = useRef<(HTMLInputElement | null)[]>([]);

  // ─── Loading / error states ────────────────────────────────────────────────
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [otpError, setOtpError]           = useState('');
  const [apiError, setApiError]           = useState('');
  const [showPassword, setShowPassword]   = useState(false);
  const [hasInvitation, setHasInvitation] = useState(false);
  const [invitationRole, setInvitationRole] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);

  // Fetch public organizations on component mount
  useEffect(() => {
    const fetchOrganizations = async () => {
      setIsLoadingOrgs(true);
      try {
        const response = await organizationService.getPublic();
        setOrganizations(response.data?.data || []);
      } catch (error) {
        console.error('Failed to fetch organizations:', error);
      } finally {
        setIsLoadingOrgs(false);
      }
    };
    fetchOrganizations();
  }, []);

  // ─── Forms ─────────────────────────────────────────────────────────────────
  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', username: '', role: '', organizationId: '', password: '', confirmPassword: '' },
  });

  const pwStrength = getStrength(registerForm.watch('password'));

  // ─── Step 1: Send OTP ──────────────────────────────────────────────────────
  const onSendOtp = async (data: EmailFormValues) => {
    setIsSendingOtp(true);
    setApiError('');
    try {
      await authService.sendRegistrationOtp(data.email);
      setSubmittedEmail(data.email);
      
      // Check if this email has an accepted invitation
      try {
        const inviteCheck = await authService.checkInvitation(data.email);
        setHasInvitation(inviteCheck.data?.hasInvitation || false);
        setInvitationRole(inviteCheck.data?.role || null);
        if (inviteCheck.data?.hasInvitation) {
          // Pre-fill role from invitation
          registerForm.setValue('role', inviteCheck.data.role || '');
        }
      } catch (e) {
        // If check fails, assume no invitation
        setHasInvitation(false);
        setInvitationRole(null);
      }
      
      setStep('otp');
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Failed to send OTP. Please try again.';
      setApiError(msg);
    } finally {
      setIsSendingOtp(false);
    }
  };

  // ─── OTP digit helpers ─────────────────────────────────────────────────────
  const handleDigitChange = (i: number, val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = cleaned;
    setDigits(next);
    setOtpError('');
    if (cleaned && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handleDigitKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputRefs.current[i - 1]?.focus();
  };

  const handleDigitPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = [...digits];
    pasted.split('').forEach((c, i) => { next[i] = c; });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const currentOtp = digits.join('');

  // ─── Step 2: Register ──────────────────────────────────────────────────────
  const onRegister = async (data: RegisterFormValues) => {
    if (currentOtp.length < 6) {
      setOtpError('Please enter all 6 digits.');
      return;
    }
    // Validate role selection for normal registration (no invitation)
    if (!hasInvitation && !data.role) {
      setApiError('Please select a role');
      return;
    }
    // Validate organization selection for normal registration (no invitation)
    if (!hasInvitation && !data.organizationId) {
      setApiError('Please select an organization');
      return;
    }
    setIsRegistering(true);
    setApiError('');
    try {
      await authService.register({
        name:     data.fullName,
        username: data.username,
        role:     data.role || (hasInvitation && invitationRole ? invitationRole : ''), // Use selected role or invitation role
        organizationId: hasInvitation ? undefined : data.organizationId ? parseInt(data.organizationId) : undefined,
        email:    submittedEmail,
        otp:      currentOtp,
        password: data.password,
      });

      // For invitation-based registration, auto-login (user is already APPROVED)
      if (hasInvitation) {
        const user = await authService.login(submittedEmail, data.password);
        setUser(user);
        const destination = roleRouteMap[mapBackendRoleToUiRole(user.role) ?? ''] ?? '/login';
        setLocation(destination);
      } else {
        // For normal registration, redirect to pending approval page
        setLocation('/pending-approval');
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Registration failed. Please check your OTP and try again.';
      setApiError(msg);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleResendOtp = async () => {
    setDigits(['', '', '', '', '', '']);
    setOtpError('');
    setApiError('');
    try {
      await authService.sendRegistrationOtp(submittedEmail);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setApiError('Failed to resend OTP.');
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12 bg-[#020617] relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-xl z-10"
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-card border border-border shadow-[0_0_15px_rgba(37,99,235,0.2)]">
              <FaBrain className="text-primary text-xl" />
            </div>
            <span className="text-2xl font-bold text-white">NeuroForge</span>
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Create your account</h1>
          <p className="text-muted-foreground">Join the next generation of enterprise development.</p>
        </div>

        <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-8 shadow-2xl">

          {/* API error banner */}
          {apiError && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-5 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {apiError}
            </div>
          )}

          <AnimatePresence mode="wait">

            {/* ── Step 1: Email → Send OTP ─────────────────────────────────── */}
            {step === 'email' && (
              <motion.div
                key="email-step"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <p className="text-sm text-muted-foreground mb-6">
                  Step 1 of 2 — Enter your email to receive a verification code.
                </p>
                <form onSubmit={emailForm.handleSubmit(onSendOtp)} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-white" htmlFor="email">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        id="email"
                        type="email"
                        placeholder="name@company.com"
                        className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        {...emailForm.register('email')}
                      />
                    </div>
                    {emailForm.formState.errors.email && (
                      <p className="text-xs text-red-400">{emailForm.formState.errors.email.message}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSendingOtp}
                    className="w-full bg-primary text-primary-foreground font-medium rounded-lg py-3 shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isSendingOtp ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Verification Code'}
                  </button>
                </form>

                <p className="mt-6 text-center text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <Link href="/login" className="text-primary font-medium hover:text-blue-400 transition-colors">
                    Sign in
                  </Link>
                </p>
              </motion.div>
            )}

            {/* ── Step 2: OTP + Name + Password → Register ──────────────────── */}
            {step === 'otp' && (
              <motion.div
                key="otp-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <p className="text-sm text-muted-foreground mb-1">
                  Step 2 of 2 — A 6-digit code was sent to
                </p>
                <p className="text-white text-sm font-medium mb-6 truncate">{submittedEmail}</p>

                {/* OTP boxes */}
                <div className="flex gap-3 justify-between mb-2" onPaste={handleDigitPaste}>
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={el => { inputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      onChange={e => handleDigitChange(i, e.target.value)}
                      onKeyDown={e => handleDigitKeyDown(i, e)}
                      className={`w-12 h-14 text-center text-xl font-bold bg-background border rounded-xl text-white focus:outline-none transition-all
                        ${otpError ? 'border-red-500' : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'}
                        ${d ? 'border-primary/60' : ''}
                      `}
                    />
                  ))}
                </div>
                {otpError && <p className="text-xs text-red-400 mb-2">{otpError}</p>}

                <button
                  type="button"
                  onClick={handleResendOtp}
                  className="text-xs text-primary hover:underline mb-6 block"
                >
                  Resend code
                </button>

                <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-5">
                  {/* Full name */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-white" htmlFor="fullName">Full Name</label>
                    <input
                      id="fullName"
                      type="text"
                      placeholder="Alex Chen"
                      className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      {...registerForm.register('fullName')}
                    />
                    {registerForm.formState.errors.fullName && (
                      <p className="text-xs text-red-400">{registerForm.formState.errors.fullName.message}</p>
                    )}
                  </div>
                  
                  {/* Username */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-white" htmlFor="username">Username</label>
                    <input
                      id="username"
                      type="text"
                      placeholder="alex_chen"
                      className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      {...registerForm.register('username')}
                    />
                   {registerForm.formState.errors.username && (
                     <p className="text-xs text-red-400">{registerForm.formState.errors.username.message}</p>
                    )}
                  </div>

                  {/* Role - only show if no invitation */}
                  {!hasInvitation && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-white" htmlFor="role">Role</label>
                      <select
                        id="role"
                        className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        {...registerForm.register('role')}
                      >
                        <option value="" disabled>Select your role</option>
                        <option value="ROLE_DEVELOPER">Developer</option>
                        <option value="ROLE_QA">QA</option>
                        <option value="ROLE_CLIENT">Client</option>
                      </select>
                      {registerForm.formState.errors.role && (
                        <p className="text-xs text-red-400">{registerForm.formState.errors.role.message}</p>
                      )}
                    </div>
                  )}

                  {/* Organization - only show if no invitation */}
                  {!hasInvitation && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-white" htmlFor="organizationId">Organization</label>
                      <select
                        id="organizationId"
                        className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        {...registerForm.register('organizationId')}
                        disabled={isLoadingOrgs}
                      >
                        <option value="" disabled>{isLoadingOrgs ? 'Loading organizations...' : 'Select your organization'}</option>
                        {organizations.map((org) => (
                          <option key={org.id} value={org.id}>{org.name}</option>
                        ))}
                      </select>
                      {registerForm.formState.errors.organizationId && (
                        <p className="text-xs text-red-400">{registerForm.formState.errors.organizationId.message}</p>
                      )}
                    </div>
                  )}

                  {/* Invitation role indicator */}
                  {hasInvitation && invitationRole && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3">
                      <p className="text-sm text-blue-400">
                        <span className="font-medium">Invitation Role:</span> {invitationRole.replace('ROLE_', '').replace('_', ' ')}
                      </p>
                      <p className="text-xs text-blue-300 mt-1">Your role has been assigned by the organization invitation.</p>
                    </div>
                  )}

                  {/* Passwords */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-white" htmlFor="password">Password</label>
                      <div className="relative">
                        <input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                          {...registerForm.register('password')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="mt-2 flex gap-1 h-1.5">
                        <div className={`flex-1 rounded-full transition-colors ${pwStrength > 0 ? (pwStrength < 50 ? 'bg-red-500' : pwStrength < 75 ? 'bg-yellow-500' : 'bg-emerald-500') : 'bg-border'}`} />
                        <div className={`flex-1 rounded-full transition-colors ${pwStrength >= 50 ? (pwStrength < 75 ? 'bg-yellow-500' : 'bg-emerald-500') : 'bg-border'}`} />
                        <div className={`flex-1 rounded-full transition-colors ${pwStrength >= 75 ? 'bg-emerald-500' : 'bg-border'}`} />
                        <div className={`flex-1 rounded-full transition-colors ${pwStrength >= 100 ? 'bg-emerald-500' : 'bg-border'}`} />
                      </div>
                      {registerForm.formState.errors.password && (
                        <p className="text-xs text-red-400">{registerForm.formState.errors.password.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-white" htmlFor="confirmPassword">Confirm Password</label>
                      <input
                        id="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        {...registerForm.register('confirmPassword')}
                      />
                      {registerForm.formState.errors.confirmPassword && (
                        <p className="text-xs text-red-400">{registerForm.formState.errors.confirmPassword.message}</p>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isRegistering || currentOtp.length < 6}
                    className="w-full mt-2 bg-primary text-primary-foreground font-medium rounded-lg py-3 shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isRegistering ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
                  </button>
                </form>

                <button
                  type="button"
                  onClick={() => { setStep('email'); setApiError(''); }}
                  className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-white transition-colors"
                >
                  Use a different email
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
