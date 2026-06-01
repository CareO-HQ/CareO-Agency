"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AuthScreen from "@/components/AuthScreen";
import DashboardTab from "@/components/DashboardTab";
import StaffTab from "@/components/StaffTab";
import CareHomesTab from "@/components/CareHomesTab";
import SchedulingTab from "@/components/SchedulingTab";
import SettingsTab from "@/components/SettingsTab";
import WorkerDashboard from "@/components/WorkerDashboard";
import WorkflowTab from "@/components/WorkflowTab";

import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, Users, Building, CalendarDays, HelpCircle, LogOut, ShieldCheck, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<"supervisor" | "nurse" | "care_assistant" | null>(null);
  const [staffStatus, setStaffStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [supervisorProfile, setSupervisorProfile] = useState<any>(null);

  useEffect(() => {
    // 1. Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserRole(session.user.email || "");
      } else {
        setLoading(false);
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserRole(session.user.email || "");
      } else {
        setUserRole(null);
        setSupervisorProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (email: string) => {
    try {
      const { data, error } = await supabase
        .from("agency_staff")
        .select("*")
        .eq("email", email)
        .single();

      if (error || !data) {
        // Fallback check user metadata
        const { data: { user } } = await supabase.auth.getUser();
        const metaRole = user?.user_metadata?.role;
        const agencyName = user?.user_metadata?.agency_name;
        const fallbackProfile = {
          role: metaRole || "supervisor",
          status: "available",
          email: email,
          name: user?.user_metadata?.name || email.split("@")[0],
          agency_name: agencyName || ""
        };
        setUserRole(fallbackProfile.role as any);
        setSupervisorProfile(fallbackProfile);
      } else {
        setUserRole(data.role as any);
        setStaffStatus(data.status);
        setSupervisorProfile(data);
      }
    } catch (err) {
      console.error(err);
      setUserRole("supervisor");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUserRole(null);
    toast.success("Logged out successfully.");
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50/50">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-600 mx-auto"></div>
          <p className="text-xs text-slate-500 font-medium">Verifying authorization...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen onAuthSuccess={() => setLoading(true)} />;
  }

  // Agency worker (nurse/care_assistant) who has been offboarded — block access
  const isAgencyWorker = userRole === "nurse" || userRole === "care_assistant";
  const isOffboarded = isAgencyWorker && staffStatus !== null && staffStatus !== "active";

  if (isOffboarded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/50 p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 border border-amber-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Not Assigned to Any Care Home</h1>
            <p className="text-slate-500 text-sm mt-2 leading-relaxed">
              Your current shift assignment has ended or you have not been assigned to a care home yet.
              Please contact your agency supervisor for a new assignment.
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-left space-y-2">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Current Status</p>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
              staffStatus === "offboarded"
                ? "bg-red-50 text-red-700 border border-red-100"
                : staffStatus === "available"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                : "bg-slate-100 text-slate-600 border border-slate-200"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                staffStatus === "offboarded" ? "bg-red-500" :
                staffStatus === "available" ? "bg-emerald-500" : "bg-slate-400"
              }`} />
              {staffStatus === "offboarded" ? "Offboarded" :
               staffStatus === "available" ? "In Pool — Awaiting Assignment" :
               staffStatus ?? "Unknown"}
            </span>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
          >
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  // Render Worker Dashboard if logged in as a nurse or care assistant
  if (isAgencyWorker) {
    return <WorkerDashboard session={session} onLogout={handleLogout} />;
  }

  // Render Supervisor Portal
  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-slate-100 flex flex-col justify-between shrink-0">
        <div className="p-5 space-y-7">
          {/* Logo Branding */}
          <div className="flex items-center gap-3 px-1">
            <div className="h-9 w-9 bg-teal-600 text-white rounded-full flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-base tracking-wide">
                CareO Agency
              </h2>
              <span className="text-[9px] text-teal-600 font-bold tracking-[0.1em] uppercase block -mt-0.5">Supervisor Portal</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-xs font-semibold tracking-wide uppercase transition-all ${
                activeTab === "dashboard"
                  ? "bg-teal-50 text-teal-700 shadow-xs"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Overview
            </button>

            <button
              onClick={() => setActiveTab("staff")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-xs font-semibold tracking-wide uppercase transition-all ${
                activeTab === "staff"
                  ? "bg-teal-50 text-teal-700 shadow-xs"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <Users className="w-4 h-4" />
              Staff
            </button>

            <button
              onClick={() => setActiveTab("requests")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-xs font-semibold tracking-wide uppercase transition-all ${
                activeTab === "requests"
                  ? "bg-teal-50 text-teal-700 shadow-xs"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <Building className="w-4 h-4" />
              Care Homes
            </button>

            <button
              onClick={() => setActiveTab("scheduling")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-xs font-semibold tracking-wide uppercase transition-all ${
                activeTab === "scheduling"
                  ? "bg-teal-50 text-teal-700 shadow-xs"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              Scheduling
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-xs font-semibold tracking-wide uppercase transition-all ${
                activeTab === "settings"
                  ? "bg-teal-50 text-teal-700 shadow-xs"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <Settings className="w-4 h-4 text-teal-600" />
              Settings
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-100 flex flex-col gap-2 bg-slate-50/50">
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="h-7 w-7 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-600 uppercase">
              {session.user?.email?.charAt(0)}
            </div>
            <div className="truncate w-36">
              <p className="text-xs font-semibold text-slate-700 truncate">{session.user?.email}</p>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Supervisor</span>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full justify-start gap-2 h-9 text-xs text-red-600 border-slate-200 bg-white hover:bg-red-50 hover:text-red-700 rounded-full"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto bg-slate-50">
        <header className="h-14 bg-white border-b border-slate-100 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Portal</span>
            <span className="text-slate-300 text-xs">/</span>
            <span className="text-slate-600 text-[10px] uppercase tracking-wider font-semibold capitalize">{activeTab.replace("-", " ")}</span>
          </div>
        </header>

        <div className="flex-1 p-6 relative max-w-7xl w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === "dashboard" && <DashboardTab onNavigate={setActiveTab} supervisorProfile={supervisorProfile} />}
              {activeTab === "staff" && <StaffTab supervisorProfile={supervisorProfile} />}
              {activeTab === "requests" && <CareHomesTab supervisorProfile={supervisorProfile} />}
              {activeTab === "scheduling" && <SchedulingTab supervisorProfile={supervisorProfile} />}
              {activeTab === "settings" && (
                <SettingsTab 
                  session={session} 
                  onProfileUpdate={(updatedProfile) => setSupervisorProfile(updatedProfile)} 
                />
              )}
              {activeTab === "workflow" && <WorkflowTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
