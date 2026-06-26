/// <reference types="vite/client" />
import React, { useState, useEffect, useRef } from 'react';
import { 
  GraduationCap, 
  CheckCircle2, 
  Search, 
  Download, 
  Database, 
  Mail, 
  Settings, 
  LogOut, 
  Award, 
  Sparkles, 
  Brain, 
  BookOpen, 
  Zap, 
  TrendingUp, 
  Loader2, 
  ShieldCheck, 
  AlertCircle, 
  Check, 
  ArrowRight,
  MapPin,
  Lock,
  Globe,
  Home,
  Star,
  HelpCircle,
  UserPlus,
  Trash2,
  Twitter,
  Youtube,
  MessageSquare,
  Instagram,
  Linkedin,
  Heart
} from 'lucide-react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import Confetti from 'react-confetti';
import { initAuth, googleSignIn, logout as googleLogout, getAccessToken } from './firebase';
import { WaitlistUser, AdminConfig } from './types';
import { COUNTRIES } from './countries';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export default function App({ defaultView = 'home' }: { defaultView?: 'home' | 'admin' }) {
  // Parallax Scroll Effects
  const { scrollY } = useScroll();
  const heroLeftY = useTransform(scrollY, [0, 800], [0, -80]);
  const heroRightY = useTransform(scrollY, [0, 800], [0, -30]);
  const backgroundY = useTransform(scrollY, [0, 800], [0, 150]);

  // Routes & General state
  const [view, setView] = useState<'home' | 'admin'>(defaultView);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [recentRegistrationsCount, setRecentRegistrationsCount] = useState(842);

  // Form State
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    grade: '',
    country: '',
    notify_launch: true
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formProgress, setFormProgress] = useState(0);
  const [formError, setFormError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [latestRegisteredUser, setLatestRegisteredUser] = useState<any>(null);

  // Admin Panel Auth & Settings
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminIsLoggedIn, setAdminIsLoggedIn] = useState(false);
  const [adminAuthError, setAdminAuthError] = useState('');
  const [adminAuthLoading, setAdminAuthLoading] = useState(false);

  // Admin Dashboard Data State
  const [waitlistUsers, setWaitlistUsers] = useState<WaitlistUser[]>([]);
  const [adminConfig, setAdminConfig] = useState<AdminConfig>({
    spreadsheetId: '',
    googleEmail: '',
    isConnected: false
  });
  const [adminGoogleUser, setAdminGoogleUser] = useState<any>(null);
  const [googleAuthLoading, setGoogleAuthLoading] = useState(false);
  const [sheetCreationLoading, setSheetCreationLoading] = useState(false);
  const [googleSyncing, setGoogleSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSyncToGoogleSheets = async () => {
    setGoogleSyncing(true);
    try {
      const response = await fetch(API_BASE_URL + '/api/admin/sync-sheet', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to sync data');
      alert('Data synced to Google Sheets successfully!');
    } catch (e: any) {
      alert('Error syncing data: ' + e.message);
    } finally {
      setGoogleSyncing(false);
    }
  };
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'records' | 'g_sync'>('records');

  // Load Window Size for Confetti
  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize Admin Check & Config Load
  useEffect(() => {
    // Load dynamic waitlist count on home launch
    fetch(API_BASE_URL + '/api/admin/waitlists')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then(data => {
        if (data.waitlists && data.waitlists.length > 0) {
          setRecentRegistrationsCount(842 + data.waitlists.length);
        }
      })
      .catch(() => {});

    // Initialize Google Firebase Auth
    initAuth(
      (user, token) => {
        setAdminGoogleUser(user);
        // Post/Sync token back to Express backend server
        fetch(API_BASE_URL + '/api/admin/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: token, googleEmail: user.email })
        })
          .then(() => handleFetchConfig())
          .catch(e => console.error(e));
      },
      () => {
        setAdminGoogleUser(null);
      }
    );
  }, []);

  // Sync state if logged in & auto-refresh every 60 seconds
  useEffect(() => {
    if (!adminIsLoggedIn) return;

    fetchAdminData();

    const interval = setInterval(() => {
      fetchAdminData();
    }, 60000);

    return () => clearInterval(interval);
  }, [adminIsLoggedIn]);

  const handleFetchConfig = async () => {
    try {
      const res = await fetch(API_BASE_URL + '/api/admin/config');
      if (res.ok) {
        const data = await res.json();
        setAdminConfig(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAdminData = async () => {
    setDashboardLoading(true);
    try {
      const resWait = await fetch(API_BASE_URL + '/api/admin/waitlists');
      if (!resWait.ok) throw new Error('Failed to fetch waitlists');
      const waitData = await resWait.json();
      setWaitlistUsers(waitData.waitlists || []);
      
      await handleFetchConfig();
    } catch (e) {
      console.error(e);
    } finally {
      setDashboardLoading(false);
    }
  };

  const confirmDeleteUser = (id: string) => {
    setUserToDelete(id);
    setShowDeleteModal(true);
  };

  const executeDeleteUser = async () => {
    if (!userToDelete) return;
    setDeleteLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/waitlists/${userToDelete}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete record');
      
      // Remove from local state immediately for fast feedback
      setWaitlistUsers(prev => prev.filter(u => u.id !== userToDelete));
      setShowDeleteModal(false);
      setUserToDelete(null);
    } catch (e: any) {
      alert('Error deleting record: ' + e.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Auto-close success modal after 10 seconds of inactivity
  useEffect(() => {
    if (!showSuccessModal) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setShowSuccessModal(false);
      }, 10000);
    };

    // Initialize timer
    resetTimer();

    // Event listeners for activity
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('scroll', resetTimer);
    window.addEventListener('touchstart', resetTimer);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('scroll', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
    };
  }, [showSuccessModal]);

  // --------------------------------------------------------
  // WAITLIST FORM HANDLE SUBMIT
  // --------------------------------------------------------
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.grade) {
      setFormError('Please select your class.');
      return;
    }
    if (!formData.country) {
      setFormError('Please select your country.');
      return;
    }

    setFormLoading(true);
    setFormProgress(0);

    // Simulate progress bar
    const progressInterval = setInterval(() => {
      setFormProgress((prev) => {
        if (prev >= 90) return 90;
        return prev + 15;
      });
    }, 300);

    try {
      const response = await fetch(API_BASE_URL + '/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      clearInterval(progressInterval);
      setFormProgress(100);

      if (!response.ok) {
        let errorMessage = 'Something went wrong. Please try again.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If response was not JSON, use status
          errorMessage = `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const resData = await response.json();

      setLatestRegisteredUser(resData.user);
      setShowSuccessModal(true);
      
      // Reset form save for email & name
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        grade: '',
        country: '',
        notify_launch: true
      });
      
      setRecentRegistrationsCount(prev => prev + 1);
    } catch (err: any) {
      clearInterval(progressInterval);
      setFormError(err.message || 'An unexpected error occurred.');
    } finally {
      setTimeout(() => {
        setFormLoading(false);
        setFormProgress(0);
      }, 500);
    }
  };

  // --------------------------------------------------------
  // ADMIN CREDENTIALS SUBMISSION
  // --------------------------------------------------------
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthError('');
    setAdminAuthLoading(true);

    try {
      const response = await fetch(API_BASE_URL + '/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPassword })
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.error || 'Access Denied.');
      }

      sessionStorage.setItem('studyweb_admin_session', 'true');
      setAdminIsLoggedIn(true);
      setAdminPassword('');
    } catch (err: any) {
      setAdminAuthError(err.message || 'Invalid administrator password.');
    } finally {
      setAdminAuthLoading(false);
    }
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem('studyweb_admin_session');
    setAdminIsLoggedIn(false);
    setAdminEmail('');
    setAdminPassword('');
  };

  // Automatically log out admin when going back to the homepage
  useEffect(() => {
    if (view === 'home') {
      handleAdminLogout();
    }
  }, [view]);

  // --------------------------------------------------------
  // GOOGLE LINK AND PROVISION SPREADSHEET
  // --------------------------------------------------------
  const handleConnectGoogle = async () => {
    setGoogleAuthLoading(true);
    try {
      const result = await googleSignIn();
      if (result) {
        // Send access token back to configuration
        const r = await fetch(API_BASE_URL + '/api/admin/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            accessToken: result.accessToken, 
            googleEmail: result.user.email 
          })
        });
        if (r.ok) {
          const configRes = await r.json();
          setAdminConfig(configRes.config);
          await fetchAdminData();
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setGoogleAuthLoading(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      await googleLogout();
      // Remove token from backend
      const r = await fetch(API_BASE_URL + '/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: null, googleEmail: null })
      });
      if (r.ok) {
        setAdminConfig({
          spreadsheetId: '',
          googleEmail: '',
          isConnected: false
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAutoProvisionSheet = async () => {
    setSheetCreationLoading(true);
    try {
      const tokenResponse = await fetch(API_BASE_URL + '/api/admin/config');
      const tokenData = await tokenResponse.json();
      
      const sessionToken = await getAccessToken();

      const createResponse = await fetch(API_BASE_URL + '/api/admin/create-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: sessionToken })
      });

      if (!createResponse.ok) {
        throw new Error('Could not auto-provision settings. Token might be expired. Try connecting Google again.');
      }

      await fetchAdminData();
      alert('Success! Google Sheet auto-created and linked successfully.');
    } catch (e: any) {
      alert(e.message || 'Error occurred.');
    } finally {
      setSheetCreationLoading(false);
    }
  };

  // --------------------------------------------------------
  // CSV EXPORT HELPER
  // --------------------------------------------------------
  const handleExportCSV = () => {
    if (waitlistUsers.length === 0) return;
    
    const headers = ['First Name', 'Last Name', 'Email', 'Class', 'Country', 'Notify Launch', 'Timestamp'];
    const rows = waitlistUsers.map(user => [
      user.first_name,
      user.last_name,
      user.email,
      user.grade,
      user.country,
      user.notify_launch ? 'Yes' : 'No',
      user.created_at
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `studyweb_waitlist_export_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter waitlist users in real-time
  const filteredUsers = waitlistUsers.filter(user => {
    const q = searchQuery.toLowerCase();
    return (
      user.first_name?.toLowerCase().includes(q) ||
      user.last_name?.toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q) ||
      user.country?.toLowerCase().includes(q) ||
      user.grade?.toLowerCase().includes(q)
    );
  });

  // Calculate statistics for Admin View
  const stats = {
    total: waitlistUsers.length,
    optIn: waitlistUsers.filter(u => u.notify_launch).length,
    countries: Array.from(new Set(waitlistUsers.map(u => u.country))).length,
    gradeStats: waitlistUsers.reduce((acc: any, curr) => {
      acc[curr.grade] = (acc[curr.grade] || 0) + 1;
      return acc;
    }, {})
  };

  return (
    <div id="app_root" className="bg-slate-50 text-slate-900 w-full relative max-w-[1024px] mx-auto min-h-screen flex flex-col font-sans overflow-x-hidden p-2 sm:p-4 md:p-8">
      
      {/* Parallax Background Elements */}
      <motion.div 
        style={{ y: backgroundY }}
        className="absolute top-0 right-0 -z-10 pointer-events-none opacity-40"
      >
        <div className="w-[600px] h-[600px] bg-gradient-to-br from-indigo-200/40 to-fuchsia-200/40 rounded-full blur-3xl mix-blend-multiply translate-x-1/3 -translate-y-1/4"></div>
      </motion.div>
      <motion.div 
        style={{ y: useTransform(scrollY, [0, 800], [0, 250]) }}
        className="absolute top-[40%] left-0 -z-10 pointer-events-none opacity-30"
      >
        <div className="w-[400px] h-[400px] bg-gradient-to-tr from-sky-200/40 to-blue-200/40 rounded-full blur-3xl mix-blend-multiply -translate-x-1/2"></div>
      </motion.div>

      <div className="relative min-h-full w-full border border-white/40 shadow-2xl shadow-slate-200/50 rounded-3xl sm:rounded-[40px] p-4 sm:p-6 md:p-10 z-10 flex flex-col flex-1">
      
      {/* Isolated Glass Background (Prevents fixed containing block issue) */}
      <div className="absolute inset-0 bg-slate-50/50 backdrop-blur-3xl rounded-3xl sm:rounded-[40px] -z-10 pointer-events-none"></div>

      {/* ----------------- DELETE CONFIRMATION MODAL ----------------- */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
              onClick={() => setShowDeleteModal(false)}
            />
            
            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.9, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 30, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center border border-slate-100 flex flex-col items-center"
            >
              {/* Alert Ring Indicator */}
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-6 border border-rose-100 shadow-sm">
                <Trash2 className="w-8 h-8 text-rose-600" />
              </div>

              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 mb-2 font-heading">
                Delete Record?
              </h2>

              <p className="text-sm text-slate-600 leading-relaxed mb-8">
                Are you sure you want to delete this waitlist record? This action will permanently remove it from the local database and synchronize the removal to your connected Google Sheet.
              </p>

              <div className="flex gap-3 w-full">
                <button 
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={executeDeleteUser}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-colors flex justify-center items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {deleteLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Record'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ----------------- CONFETTI SUCCESS CELEBRATION MODAL ----------------- */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
              onClick={() => setShowSuccessModal(false)}
            />
            
            {/* Real-Time Confetti Canvas */}
            <Confetti 
              width={windowSize.width} 
              height={windowSize.height}
              recycle={false}
              numberOfPieces={400}
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.9, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 30, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative bg-white rounded-3xl p-8 md:p-12 max-w-xl w-full shadow-2xl text-center border border-slate-100 flex flex-col items-center"
            >
              {/* Success Ring Indicator */}
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 border border-emerald-100 shadow-sm">
                <Check className="w-10 h-10 text-emerald-600" />
              </div>

              <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-4 font-heading">
                🎉 YOU'RE IN!
              </h2>

              <p className="text-base text-slate-600 leading-relaxed max-w-sm mb-6">
                Your place on the <strong className="text-slate-900 font-semibold">StudyWeb</strong> waitlist has been successfully reserved. You've also secured <strong className="text-indigo-600 font-bold">50% off</strong> your first month!
              </p>

              {/* Status Box */}
              <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-6 text-left space-y-3 mb-8">
                <div className="flex items-center gap-3 text-sm text-slate-700 font-medium">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>Registration Complete & Secured</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-700 font-medium">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>Launch Notifications Active</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-700 font-medium">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>Early Access Priority Granted</span>
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-100 transition-all cursor-pointer font-heading tracking-wide"
              >
                RETURN TO HOME
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ----------------- GLOBAL HEADER ----------------- */}
      <header className="flex justify-between items-center mb-8">
        <div id="nav_container" className="flex-1 flex items-center justify-between gap-4">
          
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('home')}>
            <img src="/logo.png" alt="StudyWeb Logo" className="h-32 w-auto object-contain mix-blend-multiply" />
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-4">

            {view === 'admin' && (
              <button 
                id="btn_to_home"
                onClick={() => setView('home')}
                className="text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 py-2 px-4 rounded-xl shadow-sm transition-all"
              >
                ← Back to Home
              </button>
            )}
          </div>

        </div>
      </header>

      {/* ----------------- VIEW SWITCHER ----------------- */}
      <main className="flex-1">

        {/* ========================================================
            VIEW 1: LANDING PAGE
           ======================================================== */}
        {view === 'home' && (
          <div className="w-full h-full flex flex-col pb-20 md:pb-0">
            
            {/* Bento Grid Landing Area */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0">
              
              {/* Left Column (Details, Copy, Branding) */}
              <motion.div 
                style={{ y: heroLeftY }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="lg:col-span-5 flex flex-col space-y-6 relative z-10"
              >
                
                {/* Hero Headers */}
                <div className="space-y-4">
                  <h1 className="text-5xl md:text-6xl font-black text-slate-900 leading-[1.1] tracking-tight font-heading">
                    FROM <span className="text-indigo-600">CONFUSION</span> TO CLARITY
                  </h1>
                  <p className="text-lg text-slate-600 leading-relaxed max-w-md font-sans">
                    AI-powered learning built for students aged 12–18. Join the future of personalized education and start revision that works.
                  </p>
                </div>
                
                {/* Quick Benefits Checklist */}
                <div className="grid grid-cols-2 gap-3 max-w-sm pt-2">
                  <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span>Free Early Access</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span>Founder Badge</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span>Priority Access</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span>Notifications</span>
                  </div>
                </div>

                {/* The Problem / Challenges Panel */}
                <section className="bg-slate-200/50 p-6 rounded-3xl space-y-4 max-w-md">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    The Challenge
                  </h3>
                  <p className="text-xs text-slate-500">
                    Traditional studying triggers information overload and anxiety. Students specifically fight with:
                  </p>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <li className="flex items-center gap-2 text-xs text-slate-700 font-semibold">
                      <div className="w-2 h-2 bg-red-400 rounded-full shrink-0"></div> Forgetting what is read
                    </li>
                    <li className="flex items-center gap-2 text-xs text-slate-700 font-semibold">
                      <div className="w-2 h-2 bg-red-400 rounded-full shrink-0"></div> High exam stress
                    </li>
                    <li className="flex items-center gap-2 text-xs text-slate-700 font-semibold">
                      <div className="w-2 h-2 bg-red-400 rounded-full shrink-0"></div> Poor revision habits
                    </li>
                    <li className="flex items-center gap-2 text-xs text-slate-700 font-semibold">
                      <div className="w-2 h-2 bg-red-400 rounded-full shrink-0"></div> No personalization
                    </li>
                  </ul>
                  <p className="text-xs italic text-indigo-700/80 font-medium">
                    StudyWeb is being engineered specifically to break these limits.
                  </p>
                </section>

                {/* Social Waitlist Count */}
                <div className="flex items-center gap-4 pt-2">
                  <div className="flex -space-x-3">
                    <div className="w-8 h-8 rounded-full border-2 border-white bg-blue-400 flex items-center justify-center text-[10px] text-white font-bold">JD</div>
                    <div className="w-8 h-8 rounded-full border-2 border-white bg-indigo-400 flex items-center justify-center text-[10px] text-white font-bold">AL</div>
                    <div className="w-8 h-8 rounded-full border-2 border-white bg-amber-400 flex items-center justify-center text-[10px] text-white font-bold">KH</div>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">
                    Join <span className="text-slate-900 font-extrabold">{recentRegistrationsCount}+ prospective students</span> already waitlisted!
                  </span>
                </div>

              </motion.div>

              {/* Right Column (AI Preview + Form) */}
              <motion.div 
                style={{ y: heroRightY }}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="lg:col-span-7 flex flex-col gap-6 relative z-10"
              >
                
                {/* Form Card */}
                <div id="waitlist-form" className="bg-white rounded-[2rem] shadow-2xl shadow-indigo-200/50 p-8 border border-slate-100 flex-1 flex flex-col">
                  
                  {/* Card Header */}
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h3 className="text-3xl font-extrabold tracking-tight text-slate-900 font-heading">
                        Join The Waitlist
                      </h3>
                      <p className="text-sm text-slate-400 mt-1 font-medium">
                        Secure your exclusive founder status early.
                      </p>
                    </div>
                  </div>

                  {/* Submission Form */}
                  <form onSubmit={handleFormSubmit} className="space-y-5">
                    
                    {/* Error block */}
                    {formError && (
                      <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                        <span className="text-xs font-semibold text-red-700">{formError}</span>
                      </div>
                    )}

                    {/* Name block */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">
                          First Name
                        </label>
                        <input 
                          type="text" 
                          required
                          placeholder="Alex" 
                          value={formData.first_name}
                          onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">
                          Last Name
                        </label>
                        <input 
                          type="text" 
                          required
                          placeholder="Jordan" 
                          value={formData.last_name}
                          onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                      </div>

                    </div>

                    {/* Email address */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">
                        Email Address
                      </label>
                      <input 
                        type="email" 
                        required
                        placeholder="Enter your email" 
                        id="waitlist_email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      />
                    </div>

                    {/* Class & Country */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">
                          Class
                        </label>
                        <select 
                          required
                          value={formData.grade}
                          onChange={(e) => setFormData({...formData, grade: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none"
                        >
                          <option value="">Select your class</option>
                          {Array.from({ length: 12 }, (_, i) => (
                            <option key={`Class ${i + 1}`} value={`Class ${i + 1}`}>Class {i + 1}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">
                          Country
                        </label>
                        <select 
                          required
                          value={formData.country}
                          onChange={(e) => setFormData({...formData, country: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none"
                        >
                          <option value="">Select your country</option>
                          {COUNTRIES.map(country => (
                            <option key={country} value={country}>{country}</option>
                          ))}
                        </select>
                      </div>

                    </div>

                    {/* Checkbox notification */}
                    <div className="flex items-start gap-3 py-1">
                      <input 
                        type="checkbox" 
                        id="notify_launch" 
                        checked={formData.notify_launch}
                        onChange={(e) => setFormData({...formData, notify_launch: e.target.checked})}
                        className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0 mt-0.5"
                      />
                      <label htmlFor="notify_launch" className="text-xs text-slate-500 hover:text-slate-600 font-medium cursor-pointer">
                        Notify me immediately when StudyWeb launches and send exclusive developer updates.
                      </label>
                    </div>

                    {/* Join waitlist cta */}
                    <div className="relative mt-4">
                      <button 
                        type="submit" 
                        disabled={formLoading}
                        className="relative overflow-hidden w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                      >
                        {/* Progress Bar background layer */}
                        {formLoading && (
                          <div 
                            className="absolute top-0 left-0 h-full bg-indigo-500 transition-all duration-300 ease-out z-0"
                            style={{ width: `${formProgress}%` }}
                          />
                        )}
                        <div className="relative z-10 flex items-center gap-2">
                          {formLoading ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              RESERVING SPOT... {formProgress}%
                            </>
                          ) : (
                            'JOIN THE WAITLIST'
                          )}
                        </div>
                      </button>
                    </div>

                  </form>

                  {/* Why Parents Love mini block */}
                  <div className="mt-8 pt-6 border-t border-slate-100">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">
                      Why Parents Choose StudyWeb
                    </h4>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                        ✅ Academic Performance
                      </span>
                      <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                        ✅ Less Exam Stress
                      </span>
                      <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                        ✅ Productive Screen Time
                      </span>
                    </div>
                  </div>

                </div>

              </motion.div>
              
            </section>

            {/* SECTION 3 & 4: WHY STUDENTS / PARENTS LOVE IT */}
            <section id="benefits" className="bg-slate-100/60 border-y border-slate-200 py-16">
              <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-16">
                
                {/* Students Love it */}
                <div className="space-y-8">
                  <div className="text-center max-w-xl mx-auto space-y-2">
                    <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-widest block">Core Design</span>
                    <h2 className="text-3xl font-black text-slate-900 font-heading">Why Students Love StudyWeb</h2>
                    <p className="text-slate-500 text-sm">We engineer interfaces that respect modern attention spans and scientific recall.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    
                    <div className="bg-white border border-slate-150 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                        <Brain className="w-6 h-6" />
                      </div>
                      <h4 className="font-bold text-slate-900 mb-2">Learn Faster</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">Understand difficult and complex school subjects with streamlined AI assistance.</p>
                    </div>

                    <div className="bg-white border border-slate-150 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <h4 className="font-bold text-slate-900 mb-2">Revise Smarter</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">Science-backed spaced-repetition revision modules integrated natively.</p>
                    </div>

                    <div className="bg-white border border-slate-150 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                        <Zap className="w-6 h-6" />
                      </div>
                      <h4 className="font-bold text-slate-900 mb-2">Save Time</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">Target weak spots directly. Focus completely on learning what matters most.</p>
                    </div>

                    <div className="bg-white border border-slate-150 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                        <TrendingUp className="w-6 h-6" />
                      </div>
                      <h4 className="font-bold text-slate-900 mb-2">Improve Grades</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">Confidently step into exams knowing you've truly mastered the topics.</p>
                    </div>

                  </div>
                </div>

                {/* Parents Love it */}
                <div className="space-y-8 pt-6">
                  <div className="text-center max-w-xl mx-auto space-y-2">
                    <span className="text-xs font-extrabold text-emerald-600 uppercase tracking-widest block">Peace Of Mind</span>
                    <h2 className="text-3xl font-black text-slate-900 font-heading">Why Parents Love StudyWeb</h2>
                    <p className="text-slate-500 text-sm">We keep education productive, controlled, and deeply focused on real metrics.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    
                    <div className="bg-white border border-slate-150 p-5 rounded-xl flex flex-col justify-between">
                      <CheckCircle2 className="text-emerald-500 w-5 h-5 mb-3" />
                      <div>
                        <h5 className="font-bold text-xs text-slate-900 mb-1">Better Academics</h5>
                        <p className="text-[11px] text-slate-500">Noticeable improvement in actual grades and homework recall.</p>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-150 p-5 rounded-xl flex flex-col justify-between">
                      <CheckCircle2 className="text-emerald-500 w-5 h-5 mb-3" />
                      <div>
                        <h5 className="font-bold text-xs text-slate-900 mb-1">Less Exam Stress</h5>
                        <p className="text-[11px] text-slate-500">Students revise progressively, eliminating last-minute exam panic.</p>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-150 p-5 rounded-xl flex flex-col justify-between">
                      <CheckCircle2 className="text-emerald-500 w-5 h-5 mb-3" />
                      <div>
                        <h5 className="font-bold text-xs text-slate-900 mb-1">Productive Screen Time</h5>
                        <p className="text-[11px] text-slate-500">Transform passive screen consumption into interactive curriculum mastery.</p>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-150 p-5 rounded-xl flex flex-col justify-between">
                      <CheckCircle2 className="text-emerald-500 w-5 h-5 mb-3" />
                      <div>
                        <h5 className="font-bold text-xs text-slate-900 mb-1">Personalized Path</h5>
                        <p className="text-[11px] text-slate-500">Algorithm custom-tailors curriculum to fit your student's actual velocity.</p>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-150 p-5 rounded-xl flex flex-col justify-between">
                      <CheckCircle2 className="text-emerald-500 w-5 h-5 mb-3" />
                      <div>
                        <h5 className="font-bold text-xs text-slate-900 mb-1">Increased Confidence</h5>
                        <p className="text-[11px] text-slate-500">Develop permanent positive self-study disciplines and confidence.</p>
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            </section>

            {/* SECTION 6: FOUNDING MEMBERS BENEFIT PANEL */}
            <section className="bg-white py-16">
              <div className="max-w-4xl mx-auto px-4 text-center space-y-8">
                <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-850 px-4 py-1 rounded-full text-xs font-bold border border-amber-200">
                  <Award className="w-4 h-4 text-amber-500" />
                  FOUNDING MEMBER INCENTIVES
                </div>
                
                <h2 className="text-4xl font-extrabold text-slate-900 font-heading">
                  Join Early & Reclaim Control
                </h2>
                <p className="text-slate-600 max-w-xl mx-auto leading-relaxed">
                  StudyWeb is limiting founding status slots for the final launch phase. Submitting your email locks in the absolute best early perks.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 text-left">
                  <div className="p-5 bg-slate-50 border border-slate-100 rounded-xl space-y-2 hover:-translate-y-1 hover:scale-105 transition-all duration-300 hover:shadow-lg cursor-pointer">
                    <span className="text-2xl">⚡</span>
                    <h5 className="font-bold text-sm text-slate-900">Priority Access</h5>
                    <p className="text-xs text-slate-500">Skip public login queues on server deployment days.</p>
                  </div>
                  <div className="p-5 bg-slate-50 border border-slate-100 rounded-xl space-y-2 hover:-translate-y-1 hover:scale-105 transition-all duration-300 hover:shadow-lg cursor-pointer">
                    <span className="text-2xl">🎁</span>
                    <h5 className="font-bold text-sm text-slate-900">Launch Rewards</h5>
                    <p className="text-xs text-slate-500">Receive free premium model tiers upon service launch.</p>
                  </div>
                  <div className="p-5 bg-slate-50 border border-slate-100 rounded-xl space-y-2 hover:-translate-y-1 hover:scale-105 transition-all duration-300 hover:shadow-lg cursor-pointer">
                    <span className="text-2xl">📬</span>
                    <h5 className="font-bold text-sm text-slate-900">Exclusive Updates</h5>
                    <p className="text-xs text-slate-500">Private developer log digests direct from workspace engineers.</p>
                  </div>
                  <div className="p-5 bg-slate-50 border border-slate-100 rounded-xl space-y-2 hover:-translate-y-1 hover:scale-105 transition-all duration-300 hover:shadow-lg cursor-pointer">
                    <span className="text-2xl">⚙️</span>
                    <h5 className="font-bold text-sm text-slate-900">Early Testing</h5>
                    <p className="text-xs text-slate-500">Actively prototype features and provide UI inputs.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 7: FAQ (Privacy & AI Safety) */}
            <section id="faq" className="bg-slate-50 py-16 border-t border-slate-200">
              <div className="max-w-4xl mx-auto px-4 space-y-12">
                
                <div className="text-center space-y-4">
                  <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-widest block">Trust & Safety</span>
                  <h2 className="text-3xl font-black text-slate-900 font-heading">Frequently Asked Questions</h2>
                  <p className="text-slate-500 text-sm max-w-xl mx-auto">
                    We know that bringing AI into the classroom raises important questions. Learn how we prioritize student privacy and safety.
                  </p>
                </div>

                <div className="space-y-4 max-w-3xl mx-auto">
                  <details className="group bg-white border border-slate-200 p-6 rounded-2xl shadow-sm cursor-pointer [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex items-center justify-between font-bold text-slate-900 group-open:text-indigo-600 transition-colors">
                      How does StudyWeb protect student privacy?
                      <span className="transition group-open:rotate-180">
                        <svg fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24"><polyline points="6 9 12 15 18 9"/></svg>
                      </span>
                    </summary>
                    <p className="text-slate-500 text-sm mt-4 leading-relaxed">
                      We take privacy seriously. We only gather data explicitly required for personalized learning and performance tracking. We will never sell student data or use it for third-party advertising, ensuring a purely educational environment.
                    </p>
                  </details>

                  <details className="group bg-white border border-slate-200 p-6 rounded-2xl shadow-sm cursor-pointer [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex items-center justify-between font-bold text-slate-900 group-open:text-indigo-600 transition-colors">
                      Is the AI tutor safe and appropriate for all students?
                      <span className="transition group-open:rotate-180">
                        <svg fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24"><polyline points="6 9 12 15 18 9"/></svg>
                      </span>
                    </summary>
                    <p className="text-slate-500 text-sm mt-4 leading-relaxed">
                      Absolutely. Our AI models are rigorously safety-filtered, sandboxed securely, and fine-tuned specifically for academic subjects aged 12-18. The AI is proactively restricted from engaging in off-topic, harmful, or non-educational conversations.
                    </p>
                  </details>

                  <details className="group bg-white border border-slate-200 p-6 rounded-2xl shadow-sm cursor-pointer [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex items-center justify-between font-bold text-slate-900 group-open:text-indigo-600 transition-colors">
                      Will StudyWeb just do my homework for me?
                      <span className="transition group-open:rotate-180">
                        <svg fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24"><polyline points="6 9 12 15 18 9"/></svg>
                      </span>
                    </summary>
                    <p className="text-slate-500 text-sm mt-4 leading-relaxed">
                      No. StudyWeb is an educational tool built for conceptual mastery, not academic dishonesty. The AI is explicitly programmed to act as a supportive instructor—guiding students to answers via Socratic questioning rather than simply giving away the solutions.
                    </p>
                  </details>

                  <details className="group bg-white border border-slate-200 p-6 rounded-2xl shadow-sm cursor-pointer [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex items-center justify-between font-bold text-slate-900 group-open:text-indigo-600 transition-colors">
                      Who can see my study data?
                      <span className="transition group-open:rotate-180">
                        <svg fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24"><polyline points="6 9 12 15 18 9"/></svg>
                      </span>
                    </summary>
                    <p className="text-slate-500 text-sm mt-4 leading-relaxed">
                      Study session data is strictly confidential. Parents and verified teachers can optionally be linked to accounts to view high-level progress reports (like time spent and mastery levels) but they cannot read granular chat logs—giving students a safe, judgment-free space to ask any question.
                    </p>
                  </details>

                </div>
              </div>
            </section>

            {/* FINAL CTA */}
            <div className="px-4 sm:px-6 lg:px-8 py-12 max-w-7xl mx-auto w-full">
              <section className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-950 to-indigo-900 text-white py-16 px-6 md:px-12 rounded-[2.5rem] shadow-2xl shadow-indigo-950/30 border border-slate-800/80">
                {/* Decorative ambient background glows */}
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
                
                <div className="relative z-10 max-w-3xl mx-auto text-center space-y-8">
                  {/* Subtle Top Badge */}
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-bold text-indigo-200 uppercase tracking-widest backdrop-blur-sm">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Exclusive Pre-Launch Opening</span>
                  </div>

                  <h2 className="text-4xl md:text-5xl font-extrabold font-heading tracking-tight leading-[1.15]">
                    Ready to Transform <br className="hidden sm:inline" />
                    How You <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-indigo-200">Study Forever?</span>
                  </h2>

                  <p className="text-indigo-200/90 text-sm md:text-base leading-relaxed max-w-xl mx-auto font-sans">
                    Join hundreds of forward-thinking students, parents, and educators gaining immediate cognitive superpowers. No more endless scrolling—just curated, Socratic mastery.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                    <button 
                      onClick={() => {
                        const el = document.getElementById('app_root');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="w-full sm:w-auto bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-extrabold py-4 px-10 rounded-2xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all hover:-translate-y-0.5 font-heading tracking-wide cursor-pointer text-center"
                    >
                      Reserve Your Free Spot Now
                    </button>
                  </div>

                  {/* Trust markers */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-white/10 text-xs text-indigo-200/80 font-medium max-w-2xl mx-auto">
                    <div className="flex items-center justify-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>No payment required</span>
                    </div>
                    <div className="flex items-center justify-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Socratic active study</span>
                    </div>
                    <div className="flex items-center justify-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Early Bird bonuses</span>
                    </div>
                    <div className="flex items-center justify-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Safe, ad-free space</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* SECTION 5: HOW IT WORKS / VISUAL TRACKER FOOTER */}
            <footer className="mt-16 pt-12 border-t border-slate-200/80">
              {/* Footer Top Grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-12">
                
                {/* Column 1: Brand & Identity (Span 5) */}
                <div className="md:col-span-5 space-y-4 text-left">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('home')}>
                    <img src="/logo.png" alt="StudyWeb Logo" className="h-28 w-auto object-contain mix-blend-multiply" />
                  </div>
                  
                  <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
                    StudyWeb is a modern cognitive accelerator transforming passive screen time into interactive curriculum mastery. Built by educators, powered by specialized Socratic AI.
                  </p>

                  <div className="flex items-center gap-4 text-slate-400 pt-2">
                    <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 transition-colors p-1.5 hover:bg-slate-100 rounded-lg">
                      <Twitter className="w-4 h-4" />
                    </a>
                    <a href="https://www.youtube.com/@StudyWebai" target="_blank" rel="noopener noreferrer" className="hover:text-rose-600 transition-colors p-1.5 hover:bg-slate-100 rounded-lg">
                      <Youtube className="w-4 h-4" />
                    </a>
                    <a href="https://www.reddit.com/u/StudyWebai/s/uV9abQJ7yY" target="_blank" rel="noopener noreferrer" className="hover:text-orange-500 transition-colors p-1.5 hover:bg-slate-100 rounded-lg" title="Reddit Community">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M24 11.5c0-1.65-1.35-3-3-3-.96 0-1.86.48-2.42 1.24-1.64-1-3.85-1.64-6.29-1.72l1.3-4.14c.03-.09.1-.16.19-.18l4.03-.95c.17.39.56.67 1.02.67 1.01 0 1.83-.82 1.83-1.83 0-1.01-.82-1.83-1.83-1.83-.9 0-1.66.65-1.81 1.51l-4.22.99c-.11.02-.2.11-.23.22L13.14 7.78C10.66 7.84 8.43 8.49 6.78 9.51c-.56-.75-1.46-1.24-2.47-1.24-1.65 0-3 1.35-3 3 0 1.05.54 1.97 1.36 2.51-.06.38-.09.77-.09 1.16 0 4.25 4.7 7.7 10.5 7.7s10.5-3.45 10.5-7.7c0-.39-.03-.78-.09-1.16.82-.54 1.36-1.46 1.36-2.51zm-15.42 1.4c-.65 0-1.18-.53-1.18-1.18 0-.65.53-1.18 1.18-1.18s1.18.53 1.18 1.18c0 .65-.53 1.18-1.18 1.18zm8.12 4.19c-1.25 1.25-3.66 1.25-4.91 0-.08-.08-.08-.22 0-.3.08-.08.22-.08.3 0 1.09 1.09 3.22 1.09 4.31 0 .08-.08.22-.08.3 0 .08.08.08.22 0 .3zm-.32-3.01c-.65 0-1.18-.53-1.18-1.18 0-.65.53-1.18 1.18-1.18s1.18.53 1.18 1.18c0 .65-.53 1.18-1.18 1.18z"/>
                      </svg>
                    </a>
                    <a href="https://www.instagram.com/studywebai/" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 transition-colors p-1.5 hover:bg-slate-100 rounded-lg">
                      <Instagram className="w-4 h-4" />
                    </a>
                    <a href="https://www.linkedin.com/in/study-web-a823b9417?utm_source=share_via&amp;utm_content=profile&amp;utm_medium=member_android" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 transition-colors p-1.5 hover:bg-slate-100 rounded-lg">
                      <Linkedin className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Column 2: Platform Links (Span 2) */}
                <div className="md:col-span-2 space-y-3 text-left">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Platform</h4>
                  <ul className="space-y-2 text-xs">
                    <li>
                      <button 
                        onClick={() => document.getElementById('waitlist-form')?.scrollIntoView({ behavior: 'smooth' })}
                        className="text-slate-600 hover:text-indigo-600 font-medium transition-colors cursor-pointer text-left"
                      >
                        Join Waitlist
                      </button>
                    </li>
                    <li>
                      <button 
                        onClick={() => {
                          const el = document.getElementById('app_root');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="text-slate-600 hover:text-indigo-600 font-medium transition-colors cursor-pointer text-left"
                      >
                        Features Overview
                      </button>
                    </li>
                    <li>
                      <span className="text-slate-400 font-normal select-none">Socratic Engine</span>
                    </li>
                    <li>
                      <span className="text-slate-400 font-normal select-none">Syllabus Sync</span>
                    </li>
                  </ul>
                </div>

                {/* Column 3: Trust & Ethics (Span 2) */}
                <div className="md:col-span-2 space-y-3 text-left">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Commitment</h4>
                  <ul className="space-y-2 text-xs text-slate-600 font-medium">
                    <li className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Kid Safe (COPPA)</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Ad-Free Space</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>No Data Selling</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Socratic Pedagogy</span>
                    </li>
                  </ul>
                </div>

                {/* Column 4: Join Statistics (Span 3) */}
                <div className="md:col-span-3 space-y-3 text-left">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Momentum</h4>
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider">Live Registrations</span>
                    </div>
                    <div className="text-2xl font-black text-indigo-950 font-heading">
                      {recentRegistrationsCount}+
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      Students, parents, and schools have requested early access keys for the 2026 academic release.
                    </p>
                  </div>
                </div>

              </div>

              {/* Footer Bottom Bar */}
              <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left pb-8">
                <div className="text-xs text-slate-400 flex items-center gap-1 font-medium justify-center sm:justify-start">
                  <span>© 2026 StudyWeb Inc. All rights reserved. Made with</span>
                  <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 animate-pulse shrink-0" />
                  <span>for students.</span>
                </div>

                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => setView('admin')}
                    className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors cursor-pointer"
                  >
                    Admin Portal
                  </button>
                </div>
              </div>
            </footer>

          </div>
        )}

        {/* ========================================================
            VIEW 2: ADMIN VIEW (AUTHENTICATION & DASHBOARD)
           ======================================================== */}
        {view === 'admin' && (
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12 flex-1">
            
            {!adminIsLoggedIn ? (
              
              /* ================= ADMIN LOGINFORM ================= */
              <div className="max-w-md mx-auto py-12">
                <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl space-y-6">
                  
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-bold font-heading">Admin Login</h2>
                    <p className="text-xs text-slate-400">Enter secure password credentials to manage user waitlists.</p>
                  </div>

                  <form onSubmit={handleAdminLogin} className="space-y-4">
                    
                    {adminAuthError && (
                      <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-lg text-xs font-semibold text-red-700">
                        {adminAuthError}
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Admin Email</label>
                      <input 
                        type="email" 
                        required 
                        placeholder="Enter Company Email Id"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 transition-all text-slate-900"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Secure Password</label>
                      <input 
                        type="password" 
                        required 
                        placeholder="••••••••"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 transition-all text-slate-900"
                      />
                    </div>

                    <button 
                      type="submit" 
                      disabled={adminAuthLoading}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 rounded-xl cursor-pointer shadow-md transition-all text-sm tracking-wide font-heading"
                    >
                      {adminAuthLoading ? 'Authenticating...' : 'AUTHENTICATE'}
                    </button>
                    
                  </form>

                </div>
              </div>

            ) : (

              /* ================= ADMIN DASHBOARD ================= */
              <div className="space-y-8">
                
                {/* Upper banner section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  
                  <div>
                    <h1 className="text-3xl font-black font-heading text-slate-900">StudyWeb Waitlists</h1>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      Analyze metrics, verify Google integration, and query signups.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">

                    <button 
                      onClick={handleExportCSV}
                      disabled={waitlistUsers.length === 0}
                      className="flex items-center gap-1.5 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 font-bold text-xs text-white rounded-xl shadow-xs transition-all cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      Export CSV
                    </button>

                    <button 
                      onClick={handleAdminLogout}
                      className="flex items-center gap-1.5 py-2.5 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs transition-all cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>

                  </div>

                </div>

                {/* Dashboard Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  
                  <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-xs flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                      <Database className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registrations</span>
                      <span className="text-2xl font-black text-slate-900">{stats.total}</span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-xs flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                      <Mail className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email Alerts Opt-In</span>
                      <span className="text-2xl font-black text-slate-900">{stats.optIn}</span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-xs flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                      <Globe className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Countries</span>
                      <span className="text-2xl font-black text-slate-900">{stats.countries}</span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-xs flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Signups</span>
                      <span className="text-2xl font-black text-slate-900">1,000</span>
                    </div>
                  </div>

                </div>

                {/* Main Tabs Navigation */}
                <div className="flex gap-4 border-b border-slate-200">
                  <button 
                    onClick={() => setActiveTab('records')}
                    className={`py-3 px-1.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${activeTab === 'records' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    Waitlist Records ({filteredUsers.length})
                  </button>
                  <button 
                    onClick={() => setActiveTab('g_sync')}
                    className={`py-3 px-1.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${activeTab === 'g_sync' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    Google Workspace Integration
                  </button>
                </div>

                {/* TAB 1: WAITLIST RECORDS TABLE & GRAPHS */}
                {activeTab === 'records' && (
                  <div className="space-y-6">
                    
                    {/* Search and filter bar */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
                      
                      <div className="relative w-full sm:max-w-md">
                        <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Search waitlists by Name, Email, Class or Country..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-4 py-3 bg-slate-50 rounded-xl text-xs outline-none focus:bg-slate-100 text-slate-900 border-0"
                        />
                      </div>

                      <div className="text-xs text-slate-500 font-bold tracking-tight">
                        Displaying {filteredUsers.length} of {waitlistUsers.length} total signups
                      </div>

                    </div>

                    {/* Table View */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-slate-400 font-bold text-[10px] tracking-widest uppercase border-b border-slate-100">
                              <th className="py-4 px-6">Name (Email)</th>
                              <th className="py-4 px-6">Class</th>
                              <th className="py-4 px-6">Country</th>
                              <th className="py-4 px-6 text-center">Alerts</th>
                              <th className="py-4 px-6 text-right">Registered</th>
                              <th className="py-4 px-6 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {filteredUsers.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                                  No waitlist registrations found matching query.
                                </td>
                              </tr>
                            ) : (
                              filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-4 px-6">
                                    <div className="font-bold text-slate-900">{user.first_name} {user.last_name}</div>
                                    <div className="text-slate-400 mt-0.5">{user.email}</div>
                                  </td>
                                  <td className="py-4 px-6 text-slate-600 font-medium">{user.grade}</td>
                                  <td className="py-4 px-6 text-slate-600">
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                      {user.country}
                                    </span>
                                  </td>
                                  <td className="py-4 px-6 text-center">
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${user.notify_launch ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                      {user.notify_launch ? 'ACTIVE' : 'NO'}
                                    </span>
                                  </td>
                                  <td className="py-4 px-6 text-right text-slate-400 font-mono">
                                    {new Date(user.created_at).toLocaleString()}
                                  </td>
                                  <td className="py-4 px-6 text-center">
                                    <button 
                                      onClick={() => confirmDeleteUser(user.id)}
                                      className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors inline-flex items-center justify-center"
                                      title="Delete Record"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Breakdown Graphs (Grid) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Class Distribution */}
                      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
                        <h4 className="font-bold text-sm tracking-tight text-slate-800 font-heading flex items-center gap-2">
                          <GraduationCap className="w-5 h-5 text-indigo-500" />
                          Class distribution
                        </h4>
                        
                        <div className="space-y-2 pt-2">
                          {Object.keys(stats.gradeStats).length === 0 ? (
                            <p className="text-xs text-slate-400 py-6 text-center">No class statistics yet.</p>
                          ) : (
                            Object.entries(stats.gradeStats).map(([grade, count]: [string, any]) => {
                              const pct = Math.round((count / waitlistUsers.length) * 105);
                              return (
                                <div key={grade} className="space-y-1">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-700 font-medium">{grade}</span>
                                    <span className="font-bold text-slate-900">{count} students</span>
                                  </div>
                                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Countries Representation */}
                      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
                        <h4 className="font-bold text-sm tracking-tight text-slate-800 font-heading flex items-center gap-2">
                          <Globe className="w-5 h-5 text-indigo-500" />
                          Countries Representation
                        </h4>
                        
                        <div className="space-y-2 pt-2">
                          {waitlistUsers.length === 0 ? (
                            <p className="text-xs text-slate-400 py-6 text-center">No location statistics yet.</p>
                          ) : (
                            Object.entries(
                              waitlistUsers.reduce((acc: any, curr) => {
                                acc[curr.country] = (acc[curr.country] || 0) + 1;
                                return acc;
                              }, {})
                            ).map(([country, count]: [string, any]) => {
                              const pct = Math.round((count / waitlistUsers.length) * 105);
                              return (
                                <div key={country} className="space-y-1">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-700 font-medium">{country}</span>
                                    <span className="font-bold text-slate-900">{count}</span>
                                  </div>
                                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                    </div>

                  </div>
                )}

                {/* TAB 2: GOOGLE WORKSPACE CONNECTION STATUS */}
                {activeTab === 'g_sync' && (
                  <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm max-w-3xl space-y-8">
                    
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold font-heading">Google Workspace Setup</h3>
                      <p className="text-xs text-slate-500 max-w-xl">
                        Authorize the app using your Google Account to automatically append new signups to Google Sheets and invoke Gmail alerts dynamically on submission!
                      </p>
                    </div>

                    {/* Authentication block */}
                    <div className="border border-slate-100 bg-slate-50 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${adminConfig.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></div>
                          <span className="font-bold text-xs text-slate-900">
                            Status: {adminConfig.isConnected ? 'Google Account Connected' : 'Google Account Not Connected'}
                          </span>
                        </div>
                        {adminConfig.googleEmail && (
                          <span className="text-xs text-slate-400 block ml-5">Logged in as {adminConfig.googleEmail}</span>
                        )}
                      </div>

                      {adminConfig.isConnected ? (
                        <button 
                          onClick={handleDisconnectGoogle}
                          className="py-2 px-4 border border-red-200 text-red-600 bg-white hover:bg-red-50 text-xs font-bold rounded-xl transition-all cursor-pointer"
                        >
                          Disconnect Google Account
                        </button>
                      ) : (
                        <button 
                          onClick={handleConnectGoogle}
                          disabled={googleAuthLoading}
                          className="gsi-material-button text-xs"
                        >
                          <div className="gsi-material-button-state"></div>
                          <div className="gsi-material-button-content-wrapper">
                            <div className="gsi-material-button-icon">
                              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" xmlnsXlink="http://www.w3.org/1999/xlink">
                                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                              </svg>
                            </div>
                            <span className="gsi-material-button-contents font-heading font-medium text-xs">Connect Google Workspace</span>
                          </div>
                        </button>
                      )}

                    </div>

                    {/* Create Google sheet block */}
                    {adminConfig.isConnected && (
                      <div className="space-y-6 pt-4 border-t border-slate-100">
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
                            <Settings className="w-6 h-6" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="font-bold text-sm text-slate-800">Auto-create Google sheet Waitlist Tracker</h4>
                            <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                              Click below to instantly create a new Google Spreadsheet named "StudyWeb Waitlist Tracker" in your Google Drive. 
                              The backend will automatically record all future signups directly in that sheet.
                            </p>
                          </div>
                        </div>

                        {adminConfig.spreadsheetId ? (
                          <div className="p-5 bg-indigo-50/50 border border-indigo-150/40 rounded-xl space-y-3">
                            <div className="flex items-center gap-1.5 text-xs text-indigo-800 font-bold">
                              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />
                              <span>WAITLIST SHEET PROVISIONED SUCCESSFULLY</span>
                            </div>
                            <p className="text-xs text-slate-600">
                              Spreadsheet ID: <code className="bg-white px-1.5 py-0.5 rounded border text-[11px] font-mono">{adminConfig.spreadsheetId}</code>
                            </p>
                            <div className="flex flex-col gap-2">
                              <a 
                                href={`https://docs.google.com/spreadsheets/d/${adminConfig.spreadsheetId}/edit`}
                                target="_blank" 
                                referrerPolicy="no-referrer"
                                className="inline-flex items-center gap-1 text-xs font-extrabold text-indigo-600 hover:text-indigo-800 hover:underline"
                              >
                                Open Google Sheet in new tab ↗
                              </a>
                              <button
                                onClick={handleSyncToGoogleSheets}
                                disabled={googleSyncing}
                                className="w-fit mt-2 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                              >
                                {googleSyncing ? (
                                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> SYNCING...</>
                                ) : (
                                  <><Database className="w-3.5 h-3.5" /> PUSH ALL PAST DATA TO GOOGLE SHEETS</>
                                )}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button 
                            onClick={handleAutoProvisionSheet}
                            disabled={sheetCreationLoading}
                            className="ml-14 py-3 px-5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-xs font-black text-white rounded-xl shadow-md cursor-pointer flex items-center gap-2"
                          >
                            {sheetCreationLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Provisioning Spreadsheet...
                              </>
                            ) : (
                              'Create & Link Google Sheet'
                            )}
                          </button>
                        )}
                        
                        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl space-y-1 ml-14">
                          <span className="text-[10px] font-black uppercase tracking-widest block">Note for email automation</span>
                          <p className="text-xs">
                            Once connected, the backend will automatically use the connected <span className="font-bold">Gmail API</span> to send the welcome email immediately after registration!
                          </p>
                        </div>

                      </div>
                    )}

                  </div>
                )}

              </div>
            )}

          </div>
        )}

      </main>

      </div>

      {/* Mobile Bottom Navigation Bar (Moved outside all wrappers to ensure fixed positioning works beautifully) */}
      {view === 'home' && (
        <div className="md:hidden fixed bottom-6 left-4 right-4 bg-white/90 backdrop-blur-xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-3xl flex justify-around items-center z-[9999] px-2 py-2 mb-0">
            <button onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} className="flex flex-col items-center p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-2xl transition-all w-full">
              <Home className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-bold">Home</span>
            </button>
            <button onClick={() => document.getElementById('benefits')?.scrollIntoView({behavior: 'smooth'})} className="flex flex-col items-center p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-2xl transition-all w-full">
              <Star className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-bold">Benefits</span>
            </button>
            <button onClick={() => document.getElementById('faq')?.scrollIntoView({behavior: 'smooth'})} className="flex flex-col items-center p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-2xl transition-all w-full">
              <HelpCircle className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-bold">FAQ</span>
            </button>
            <button onClick={() => document.getElementById('waitlist-form')?.scrollIntoView({behavior: 'smooth'})} className="flex flex-col items-center p-2 text-white bg-indigo-600 hover:bg-indigo-700 shadow-md rounded-2xl transition-all w-full relative">
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 border-2 border-white rounded-full animate-pulse"></div>
              <UserPlus className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-bold">Join</span>
            </button>
        </div>
      )}

    </div>
  );
}
