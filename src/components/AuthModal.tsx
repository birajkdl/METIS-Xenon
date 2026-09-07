import React, { useState } from 'react';
import { 
  X, 
  Mail, 
  Lock, 
  Phone, 
  KeyRound, 
  UserPlus, 
  LogIn, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  ArrowLeft,
  User,
  Briefcase,
  Building
} from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  signInWithPopup,
  Auth
} from 'firebase/auth';
import { googleAuthProvider } from '../lib/firebase.ts';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  auth: Auth;
  onAuthSuccess: (token: string) => void;
}

export default function AuthModal({ isOpen, onClose, auth, onAuthSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [designation, setDesignation] = useState('');
  const [office, setOffice] = useState('');
  const [selectedRole, setSelectedRole] = useState('Read-only/Audit User');
  
  // Status and feedback states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  let pendingTarget: any = null;
  try {
    const raw = sessionStorage.getItem('metis_pending_deeplink');
    if (raw) pendingTarget = JSON.parse(raw);
  } catch (e) {}

  if (!isOpen) return null;

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setPhoneNumber('');
    setConfirmPassword('');
    setUsername('');
    setDesignation('');
    setOffice('');
    setSelectedRole('Read-only/Audit User');
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const userCredential = await signInWithPopup(auth, googleAuthProvider);
      const token = await userCredential.user.getIdToken();
      
      const emailVal = userCredential.user.email || '';
      const nameVal = userCredential.user.displayName || emailVal.split('@')[0] || 'Google User';
      
      const response = await fetch('/api/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          phoneNumber: userCredential.user.phoneNumber || '+000000000',
          username: nameVal,
          designation: 'Google Authenticated Operator',
          office: 'Head Office',
          role: 'Read-only/Audit User'
        })
      });

      if (!response.ok) {
        console.warn("Could not synchronize profiles with Postgres during Google Sign-in.");
      }

      onAuthSuccess(token);
      setSuccessMsg("Logged in successfully via Google!");
      
      try {
        await fetch('/api/audit/logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            action: 'LOGIN_SUCCESS',
            actorEmail: emailVal,
            details: 'User authenticated successfully via Google Sign-In.',
            status: 'Success'
          })
        });
      } catch (e) {
        console.error("Failed to submit audit log for login success:", e);
      }

      setTimeout(() => {
        onClose();
        resetForm();
      }, 1000);
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setErrorMsg("Google Sign-In is disabled in your Firebase Console. Please enable 'Google' under the 'Sign-in method' tab in Firebase Authentication.");
      } else {
        setErrorMsg(err.message || "Google Authentication failed.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleMode = (newMode: 'login' | 'register' | 'forgot') => {
    setMode(newMode);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // 1. LOGIN SUBMIT
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Please enter both email and password.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const token = await userCredential.user.getIdToken();
      onAuthSuccess(token);
      setSuccessMsg("Logged in successfully!");

      // Log successful login
      try {
        await fetch('/api/audit/logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            action: 'LOGIN_SUCCESS',
            actorEmail: email.trim(),
            details: 'User authenticated successfully via email and password.',
            status: 'Success'
          })
        });
      } catch (e) {
        console.error("Failed to submit audit log for login success:", e);
      }

      setTimeout(() => {
        onClose();
        resetForm();
      }, 1000);
    } catch (err: any) {
      console.error("Login Error:", err);

      // Log failed login
      try {
        await fetch('/api/audit/logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'LOGIN_FAILED',
            actorEmail: email.trim() || 'Unknown',
            actorRole: 'Guest',
            details: `Failed login attempt. Reason: ${err.message || 'Invalid credentials'}.`,
            status: 'Failed'
          })
        });
      } catch (e) {
        console.error("Failed to submit audit log for login failure:", e);
      }

      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setErrorMsg("Invalid email or password credentials.");
      } else if (err.code === 'auth/invalid-email') {
        setErrorMsg("Please enter a valid email address.");
      } else if (err.code === 'auth/operation-not-allowed') {
        setErrorMsg("Email/Password authentication is disabled in your Firebase Console. Please go to the Firebase Console -> Build -> Authentication -> Sign-in method, and enable 'Email/Password' to register or log in.");
      } else {
        setErrorMsg(err.message || "Authentication failed.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 2. REGISTER SUBMIT (Mandatory Username, Email, Phone, Designation, Office, Role, Password)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validation
    if (!username.trim()) {
      setErrorMsg("Username is mandatory.");
      return;
    }
    if (!email.trim()) {
      setErrorMsg("Email address is mandatory.");
      return;
    }
    if (!phoneNumber.trim()) {
      setErrorMsg("Phone number is mandatory.");
      return;
    }
    // simple phone pattern validation
    const cleanPhone = phoneNumber.replace(/\s+/g, '');
    if (cleanPhone.length < 7) {
      setErrorMsg("Please enter a valid, complete phone number.");
      return;
    }
    if (!designation.trim()) {
      setErrorMsg("Designation is mandatory.");
      return;
    }
    if (!office.trim()) {
      setErrorMsg("Office is mandatory.");
      return;
    }
    if (!selectedRole) {
      setErrorMsg("User access role is mandatory.");
      return;
    }
    if (!password) {
      setErrorMsg("Password is mandatory.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      // Create user inside Firebase
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const token = await userCredential.user.getIdToken();

      // Immediately sync all mandatory details to the PostgreSQL user database
      const response = await fetch('/api/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          phoneNumber: cleanPhone,
          username: username.trim(),
          designation: designation.trim(),
          office: office.trim(),
          role: selectedRole
        })
      });

      if (!response.ok) {
        console.warn("Could not synchronize profiles with Postgres during registration.");
      }

      onAuthSuccess(token);
      setSuccessMsg("Account registered successfully! Synchronizing system access clearances based on meteorological office...");
      setTimeout(() => {
        onClose();
        resetForm();
      }, 1500);

    } catch (err: any) {
      console.error("Registration Error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setErrorMsg("This email is already registered.");
      } else if (err.code === 'auth/invalid-email') {
        setErrorMsg("Invalid email address format.");
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg("Password is too weak. Please use at least 6 characters.");
      } else if (err.code === 'auth/operation-not-allowed') {
        setErrorMsg("Email/Password registration is disabled in your Firebase Console. Please go to the Firebase Console -> Build -> Authentication -> Sign-in method, and enable 'Email/Password' to register or log in.");
      } else {
        setErrorMsg(err.message || "Failed to compile registration credentials.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 3. FORGOT PASSWORD SUBMIT
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg("Please provide your registered email address.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccessMsg(`A secure password reset link has been dispatched to ${email.trim()}. Please verify your inbox.`);
      setEmail('');
    } catch (err: any) {
      console.error("Forgot Password Error:", err);
      if (err.code === 'auth/user-not-found') {
        setErrorMsg("No account registered under this email.");
      } else if (err.code === 'auth/invalid-email') {
        setErrorMsg("Please enter a valid email address.");
      } else {
        setErrorMsg(err.message || "Password reset transmission failed.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
      <div 
        id="auth-modal-card" 
        className="w-full max-w-md bg-[#0c0c0f] border border-[#1f1f23] rounded-2xl shadow-2xl overflow-hidden text-zinc-300 relative"
      >
        {/* Header decoration */}
        <div className="h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600"></div>

        {/* Close Button */}
        <button
          id="auth-modal-close-btn"
          onClick={() => { onClose(); resetForm(); }}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-[#141419] hover:bg-[#1a1a24] border border-[#1f1f26] text-zinc-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-8 space-y-6">
          {/* Logo / Brand Header */}
          <div className="text-center space-y-2">
            <div className="mx-auto w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <KeyRound className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-serif text-white tracking-wide">
                {mode === 'login' ? "Secure Authentication" : mode === 'register' ? "Operator Registration" : "Reset Clearance Link"}
              </h2>
              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mt-1">
                {mode === 'login' ? "METIS ASSET GRID LOCK" : mode === 'register' ? "REGISTER METIS PROFILE" : "FORGOT CREDENTIALS DISPATCH"}
              </p>
            </div>
          </div>

          {/* Pending Deep Link Target Banner */}
          {pendingTarget && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start space-x-2.5 text-xs">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-amber-200/90 leading-snug">
                <span className="font-bold text-amber-300 block mb-0.5">Authentication Required for Access</span>
                You are accessing <span className="font-mono font-bold text-white uppercase">{pendingTarget.ticketNumber ? `Ticket #${pendingTarget.ticketNumber}` : pendingTarget.workOrderId ? `Work Order ${pendingTarget.workOrderId}` : 'Maintenance Task'}</span> via direct email link. Please sign in or register to be redirected straight to your assigned item.
              </div>
            </div>
          )}

          {/* Tab buttons for Login / Register */}
          {mode !== 'forgot' && (
            <div className="flex bg-[#07070a] p-1 rounded-lg border border-[#17171d] text-xs">
              <button
                id="tab-auth-login"
                type="button"
                onClick={() => handleToggleMode('login')}
                className={`flex-1 py-1.5 text-center font-mono uppercase font-semibold rounded-md tracking-wider transition-all cursor-pointer ${
                  mode === 'login' ? 'bg-blue-600 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Sign In
              </button>
              <button
                id="tab-auth-register"
                type="button"
                onClick={() => handleToggleMode('register')}
                className={`flex-1 py-1.5 text-center font-mono uppercase font-semibold rounded-md tracking-wider transition-all cursor-pointer ${
                  mode === 'register' ? 'bg-blue-600 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Register
              </button>
            </div>
          )}

          {/* Feedback banners */}
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs flex items-start space-x-2 animate-slide-in">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs flex items-start space-x-2 animate-slide-in">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* FORM: LOGIN */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Email Address (Username)</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    placeholder="operator@metis.gov"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-[#07070a] border border-[#232329] rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Password</label>
                  <button
                    id="login-forgot-password-link"
                    type="button"
                    onClick={() => handleToggleMode('forgot')}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-mono tracking-wide focus:outline-hidden cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    id="login-password"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-[#07070a] border border-[#232329] rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                id="login-submit-btn"
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center space-x-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs tracking-wider uppercase font-mono cursor-pointer disabled:opacity-50 transition-all shadow-lg shadow-blue-600/15 mt-2"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    <span>Authenticate</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* FORM: REGISTER (Mandatory Email, Phone, Username, Designation, Office, Role, Password) */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  Username <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    id="register-username"
                    type="text"
                    required
                    placeholder="e.g. jdoe"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-[#07070a] border border-[#232329] rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  Email Address <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    id="register-email"
                    type="email"
                    required
                    placeholder="operator@metis.gov"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-[#07070a] border border-[#232329] rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  Phone Number <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    id="register-phone"
                    type="tel"
                    required
                    placeholder="+254 712 345678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-[#07070a] border border-[#232329] rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  Designation <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    id="register-designation"
                    type="text"
                    required
                    placeholder="e.g. Senior Meteorologist"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-[#07070a] border border-[#232329] rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  Office <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <select
                    id="register-office"
                    required
                    value={office}
                    onChange={(e) => setOffice(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-[#07070a] border border-[#232329] rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-hidden focus:border-blue-500 cursor-pointer"
                  >
                    <option value="" disabled>Select Meteorological Office</option>
                    <option value="Head Office">Head Office (Universal Station Access)</option>
                    <option value="Kathmandu AWS">Kathmandu AWS (Bagmati Province)</option>
                    <option value="Pokhara AWS">Pokhara AWS (Gandaki Province)</option>
                    <option value="Biratnagar AWS">Biratnagar AWS (Koshi Province)</option>
                    <option value="Nepalgunj AWS">Nepalgunj AWS (Lumbini Province)</option>
                    <option value="Surkhet AWS">Surkhet AWS (Karnali Province)</option>
                    <option value="Dhangadhi AWS">Dhangadhi AWS (Sudurpashchim Province)</option>
                    <option value="Janakpur AWS">Janakpur AWS (Madhesh Province)</option>
                  </select>
                </div>
                <p className="text-[9px] text-zinc-500 font-mono leading-tight">Selecting a specific office automatically defines your target meteorological station access.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  Select User Role <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <select
                    id="register-role"
                    required
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-[#07070a] border border-[#232329] rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-hidden focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Super Administrator">Super Administrator</option>
                    <option value="Head Office Admin/User">Head Office Admin/User</option>
                    <option value="Regional Office Admin/User">Regional Office Admin/User</option>
                    <option value="Synoptic/Aero-synoptic office User">Synoptic/Aero-synoptic office User</option>
                    <option value="Station User (optional)">Station User (optional)</option>
                    <option value="Technician">Technician</option>
                    <option value="Authorized Signatory">Authorized Signatory</option>
                    <option value="Read-only/Audit User">Read-only/Audit User</option>
                    <option value="Supplier account">Supplier account</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  Password <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    id="register-password"
                    type="password"
                    required
                    placeholder="•••••••• (Min 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-[#07070a] border border-[#232329] rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  Confirm Password <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    id="register-confirm-password"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-[#07070a] border border-[#232329] rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                id="register-submit-btn"
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center space-x-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs tracking-wider uppercase font-mono cursor-pointer disabled:opacity-50 transition-all shadow-lg shadow-blue-600/15 mt-2"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    <span>Create Credentials</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Third-party Sign-In providers section */}
          {(mode === 'login' || mode === 'register') && (
            <div className="mt-4 pt-4 border-t border-[#1f1f23]">
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-white/[0.03]"></div>
                <span className="flex-shrink mx-3 text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Alternative Access Method</span>
                <div className="flex-grow border-t border-white/[0.03]"></div>
              </div>
              
              <button
                id="google-signin-btn"
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full flex items-center justify-center space-x-2.5 py-2.5 bg-[#0f0f13] hover:bg-[#15151c] text-zinc-200 border border-[#232329] hover:border-zinc-700 font-semibold rounded-lg text-xs cursor-pointer disabled:opacity-50 transition-all mt-2"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>
          )}

          {/* FORM: FORGOT PASSWORD */}
          {mode === 'forgot' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 text-zinc-400 text-[11px] leading-relaxed flex items-start space-x-2">
                <HelpCircle className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <span>Provide your registered system email to dispatch a secure password modification link directly from Firebase services.</span>
              </div>

              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Registered Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                    <input
                      id="forgot-email"
                      type="email"
                      required
                      placeholder="operator@metis.gov"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-[#07070a] border border-[#232329] rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    id="forgot-back-btn"
                    type="button"
                    onClick={() => handleToggleMode('login')}
                    className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 bg-[#141419] hover:bg-[#1e1e26] border border-[#232329] text-zinc-300 text-xs font-semibold rounded-lg cursor-pointer transition-all"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Go Back</span>
                  </button>
                  <button
                    id="forgot-submit-btn"
                    type="submit"
                    disabled={isLoading}
                    className="flex-2 flex items-center justify-center space-x-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs tracking-wider uppercase font-mono cursor-pointer disabled:opacity-50 transition-all shadow-lg shadow-blue-600/15"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <span>Dispatch Link</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
