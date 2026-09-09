import React, { useState, useEffect } from 'react';
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
  Building,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  signInWithPopup,
  Auth
} from 'firebase/auth';
import { googleAuthProvider } from '../lib/firebase.ts';
import { syncUserProfileToFirestore, logUserActivityToFirestore } from '../lib/firestore-service.ts';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  auth: Auth;
  onAuthSuccess: (token: string) => void;
  isFirstInstall?: boolean;
}

export default function AuthModal({ isOpen, onClose, auth, onAuthSuccess, isFirstInstall = false }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [isFirstInstallActive, setIsFirstInstallActive] = useState<boolean>(isFirstInstall);
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

  // Check setup status on mount or when modal opens
  useEffect(() => {
    if (isOpen) {
      fetch('/api/auth/setup-status')
        .then(res => res.json())
        .then(data => {
          if (data.isFirstInstall || isFirstInstall) {
            setIsFirstInstallActive(true);
            setMode('register');
            setSelectedRole('Super Administrator');
            if (!designation) setDesignation('Chief Meteorological Administrator');
            if (!office) setOffice('Head Office');
          }
        })
        .catch(err => {
          console.log("Setup status check note in modal:", err);
          if (isFirstInstall) {
            setIsFirstInstallActive(true);
            setMode('register');
            setSelectedRole('Super Administrator');
          }
        });
    }
  }, [isOpen, isFirstInstall]);

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
          role: isFirstInstallActive ? 'Super Administrator' : 'Read-only/Audit User'
        })
      });

      if (!response.ok) {
        console.warn("Could not synchronize profiles with Postgres during Google Sign-in.");
      }

      // Persist and keep track of user data with Firestore
      try {
        await syncUserProfileToFirestore(userCredential.user, {
          role: isFirstInstallActive ? 'Super Administrator' : 'Meteorologist',
          office: 'Head Office',
          designation: 'Google Authenticated Operator'
        });
        await logUserActivityToFirestore(userCredential.user.uid, 'GOOGLE_SIGN_IN', `Authenticated with Google (${emailVal})`);
      } catch (firestoreErr) {
        console.warn("Firestore profile sync notice:", firestoreErr);
      }

      localStorage.setItem('metis_auth_token', token);
      localStorage.setItem('metis_user_email', emailVal);
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
      if (err.code === 'auth/unauthorized-domain') {
        setErrorMsg("Domain authorization error: Your current domain is not yet in Firebase's Authorized Domains. You can use standard Email/Password registration below, which works immediately in all environments.");
      } else if (err.code === 'auth/operation-not-allowed') {
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

  // 1. LOGIN SUBMIT (Supports Native METIS engine with seamless Firebase fallback)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Please enter both email and password.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();

    // Attempt 1: Native METIS API login
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          localStorage.setItem('metis_auth_token', data.token);
          localStorage.setItem('metis_user_email', cleanEmail);
          onAuthSuccess(data.token);
          setSuccessMsg("Logged in successfully! Loading operational clearances...");

          setTimeout(() => {
            onClose();
            resetForm();
          }, 800);
          return;
        }
      } else if (res.status === 401 || res.status === 403) {
        const errorData = await res.json().catch(() => ({}));
        // If native explicitly returned 401/403, proceed to try Firebase as fallback
      }
    } catch (nativeErr) {
      console.warn("Native authentication server unreachable, falling back to Firebase:", nativeErr);
    }

    // Attempt 2: Firebase authentication fallback
    try {
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const token = await userCredential.user.getIdToken();
      localStorage.setItem('metis_auth_token', token);
      localStorage.setItem('metis_user_email', cleanEmail);
      onAuthSuccess(token);
      setSuccessMsg("Logged in successfully via Firebase!");

      setTimeout(() => {
        onClose();
        resetForm();
      }, 800);
    } catch (fbErr: any) {
      console.error("Login Error (Both Native & Firebase failed):", fbErr);
      if (fbErr.code === 'auth/user-not-found' || fbErr.code === 'auth/wrong-password' || fbErr.code === 'auth/invalid-credential') {
        setErrorMsg("Invalid email or password credentials. If you haven't created an account yet, click Register above.");
      } else if (fbErr.code === 'auth/unauthorized-domain') {
        setErrorMsg("Notice: This domain is not authorized in Firebase. Use native registration or ensure the backend server is reachable.");
      } else if (fbErr.code === 'auth/invalid-email') {
        setErrorMsg("Please enter a valid email address.");
      } else {
        setErrorMsg(fbErr.message || "Authentication failed. Please verify your credentials.");
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

    const cleanEmail = email.trim().toLowerCase();
    const effectiveRole = isFirstInstallActive ? 'Super Administrator' : selectedRole;

    setIsLoading(true);

    // Primary: Call METIS Native Registration endpoint
    try {
      const regRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          username: username.trim(),
          phoneNumber: cleanPhone,
          designation: designation.trim(),
          office: office.trim(),
          role: effectiveRole
        })
      });

      if (regRes.ok) {
        const regData = await regRes.json();
        const activeToken = regData.token;
        localStorage.setItem('metis_auth_token', activeToken);
        localStorage.setItem('metis_user_email', cleanEmail);
        onAuthSuccess(activeToken);

        // Attempt background Firebase user creation (non-blocking)
        createUserWithEmailAndPassword(auth, cleanEmail, password).catch(fbErr => {
          console.log("Firebase background sync notice:", fbErr.message);
        });

        setSuccessMsg(isFirstInstallActive 
          ? "🎉 Super Administrator account established! Initializing full operational clearances..."
          : "Account registered successfully! Access granted.");

        setTimeout(() => {
          onClose();
          resetForm();
        }, 1500);
        return;
      } else {
        const errData = await regRes.json().catch(() => ({}));
        if (regRes.status === 409) {
          setErrorMsg("An account with this email address already exists. Please switch to Sign In.");
          setIsLoading(false);
          return;
        } else if (errData.error) {
          setErrorMsg(errData.error);
          setIsLoading(false);
          return;
        }
      }
    } catch (networkErr) {
      console.warn("Native registration network error, attempting Firebase direct registration:", networkErr);
    }

    // Fallback: Direct Firebase registration if backend was unreachable
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const token = await userCredential.user.getIdToken();

      // Sync details to Postgres
      try {
        await fetch('/api/me', {
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
            role: effectiveRole
          })
        });
      } catch (e) {
        console.warn("Could not sync profile during Firebase fallback:", e);
      }

      localStorage.setItem('metis_auth_token', token);
      localStorage.setItem('metis_user_email', cleanEmail);
      onAuthSuccess(token);
      setSuccessMsg("Account registered successfully! Initializing access...");
      setTimeout(() => {
        onClose();
        resetForm();
      }, 1500);
    } catch (fbErr: any) {
      console.error("Registration Error (Firebase fallback):", fbErr);
      if (fbErr.code === 'auth/email-already-in-use') {
        setErrorMsg("This email is already registered. Please switch to Sign In.");
      } else if (fbErr.code === 'auth/unauthorized-domain') {
        setErrorMsg("Firebase Domain Authorization Error: Your domain is not authorized in Firebase. Please ensure the METIS backend is running so native authentication can handle requests.");
      } else if (fbErr.code === 'auth/weak-password') {
        setErrorMsg("Password is too weak. Please use at least 6 characters.");
      } else {
        setErrorMsg(fbErr.message || "Failed to complete registration.");
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
        <div className={`h-1.5 ${isFirstInstallActive ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-blue-600' : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600'}`}></div>

        {/* Close Button */}
        <button
          id="auth-modal-close-btn"
          onClick={() => { onClose(); resetForm(); }}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-[#141419] hover:bg-[#1a1a24] border border-[#1f1f26] text-zinc-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-8 space-y-5">
          {/* Logo / Brand Header */}
          <div className="text-center space-y-2">
            <div className={`mx-auto w-11 h-11 rounded-xl flex items-center justify-center ${
              isFirstInstallActive 
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' 
                : 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
            }`}>
              {isFirstInstallActive ? (
                <Sparkles className="h-6 w-6 animate-pulse" />
              ) : (
                <KeyRound className="h-5 w-5 animate-pulse" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-serif text-white tracking-wide">
                {isFirstInstallActive 
                  ? "Initial System Setup"
                  : mode === 'login' 
                    ? "Secure Authentication" 
                    : mode === 'register' 
                      ? "Operator Registration" 
                      : "Reset Password Link"
                }
              </h2>
              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mt-1">
                {isFirstInstallActive
                  ? "CREATE PRIMARY SUPER ADMINISTRATOR"
                  : mode === 'login' 
                    ? "METIS ASSET GRID ACCESS" 
                    : mode === 'register' 
                      ? "CREATE METIS OPERATOR PROFILE" 
                      : "CREDENTIAL RECOVERY DISPATCH"
                }
              </p>
            </div>
          </div>

          {/* First-Time Setup Welcome Banner */}
          {isFirstInstallActive && (
            <div id="first-install-modal-alert" className="p-3.5 bg-gradient-to-r from-amber-500/10 to-blue-500/10 border border-amber-500/30 rounded-xl flex items-start space-x-2.5 text-xs">
              <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-zinc-200 leading-snug">
                <span className="font-bold text-amber-300 block mb-1">Welcome to METIS First-Time Setup</span>
                No accounts currently exist. Register below to establish the <strong>Primary Super Administrator</strong> account. This will grant you full authority over stations, sensors, calibrations, and user permissions.
              </div>
            </div>
          )}

          {/* Pending Deep Link Target Banner */}
          {pendingTarget && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start space-x-2.5 text-xs">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-amber-200/90 leading-snug">
                <span className="font-bold text-amber-300 block mb-0.5">Authentication Required for Access</span>
                You are accessing <span className="font-mono font-bold text-white uppercase">{pendingTarget.ticketNumber ? `Ticket #${pendingTarget.ticketNumber}` : pendingTarget.workOrderId ? `Work Order ${pendingTarget.workOrderId}` : 'Maintenance Task'}</span> via direct email link. Please sign in or register to proceed.
              </div>
            </div>
          )}

          {/* Google Sign-In Primary Action */}
          {!isFirstInstallActive && (
            <div className="space-y-2">
              <button
                id="google-primary-signin-btn"
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full flex items-center justify-center space-x-3 py-2.5 px-4 bg-white hover:bg-zinc-100 text-zinc-900 font-semibold rounded-lg text-xs cursor-pointer disabled:opacity-50 transition-all shadow-md shadow-black/30 border border-zinc-300"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                <span>Continue with Google</span>
                <span className="text-[10px] text-zinc-500 font-mono bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-300 ml-1">Secure Auth</span>
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-[#1f1f23]"></div>
                <span className="flex-shrink mx-3 text-[10px] font-mono text-zinc-500 uppercase tracking-wider">or sign in with password</span>
                <div className="flex-grow border-t border-[#1f1f23]"></div>
              </div>
            </div>
          )}

          {/* Tab buttons for Login / Register */}
          {mode !== 'forgot' && !isFirstInstallActive && (
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
          {mode === 'login' && !isFirstInstallActive && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Email Address (Username)</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    placeholder="operator@metis.gov.np"
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
                    id="link-forgot-password"
                    type="button"
                    onClick={() => handleToggleMode('forgot')}
                    className="text-[11px] text-blue-400 hover:text-blue-300 cursor-pointer"
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
                className="w-full flex items-center justify-center space-x-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs tracking-wider uppercase font-mono cursor-pointer disabled:opacity-50 transition-all shadow-lg shadow-blue-600/15"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    <span>Sign In</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* FORM: REGISTER */}
          {(mode === 'register' || isFirstInstallActive) && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5 max-h-[440px] overflow-y-auto pr-1">
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  Full Name / Username <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    id="register-username"
                    type="text"
                    required
                    placeholder="e.g. Biraj Kandel"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-[#07070a] border border-[#232329] rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-hidden focus:border-blue-500"
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
                    placeholder="birajkdl@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-[#07070a] border border-[#232329] rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  Mobile Phone Number <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    id="register-phone"
                    type="tel"
                    required
                    placeholder="+977 9800000000"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-[#07070a] border border-[#232329] rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-hidden focus:border-blue-500"
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
                    placeholder="e.g. Chief Administrator / Senior Meteorologist"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-[#07070a] border border-[#232329] rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-hidden focus:border-blue-500"
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
                    className="w-full pl-9 pr-4 py-2 bg-[#07070a] border border-[#232329] rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-hidden focus:border-blue-500 cursor-pointer"
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
              </div>

              {/* Role Display or Selection */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  User Role Clearance <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  {isFirstInstallActive ? (
                    <div className="w-full pl-9 pr-4 py-2 bg-amber-500/10 border border-amber-500/40 rounded-lg text-xs text-amber-300 font-semibold flex items-center justify-between">
                      <span>Super Administrator (Primary Account)</span>
                      <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono uppercase">Full Access</span>
                    </div>
                  ) : (
                    <select
                      id="register-role"
                      required
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-[#07070a] border border-[#232329] rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-hidden focus:border-blue-500 cursor-pointer"
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
                  )}
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
                    className="w-full pl-9 pr-4 py-2 bg-[#07070a] border border-[#232329] rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-hidden focus:border-blue-500"
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
                    className="w-full pl-9 pr-4 py-2 bg-[#07070a] border border-[#232329] rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                id="register-submit-btn"
                type="submit"
                disabled={isLoading}
                className={`w-full flex items-center justify-center space-x-2 py-2.5 font-semibold rounded-lg text-xs tracking-wider uppercase font-mono cursor-pointer disabled:opacity-50 transition-all shadow-lg mt-3 ${
                  isFirstInstallActive 
                    ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20' 
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/15'
                }`}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    <span>{isFirstInstallActive ? "Establish Super Administrator Account" : "Create Account"}</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Third-party Sign-In providers section */}
          {(mode === 'login' || mode === 'register') && !isFirstInstallActive && (
            <div className="mt-4 pt-3 border-t border-[#1f1f23]">
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-white/[0.03]"></div>
                <span className="flex-shrink mx-3 text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Alternative Access</span>
                <div className="flex-grow border-t border-white/[0.03]"></div>
              </div>
              
              <button
                id="google-signin-btn"
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full flex items-center justify-center space-x-2.5 py-2 bg-[#0f0f13] hover:bg-[#15151c] text-zinc-200 border border-[#232329] hover:border-zinc-700 font-semibold rounded-lg text-xs cursor-pointer disabled:opacity-50 transition-all mt-1"
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
                      placeholder="operator@metis.gov.np"
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
