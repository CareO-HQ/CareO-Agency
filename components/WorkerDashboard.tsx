"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Calendar, CheckCircle, ExternalLink, MapPin, AlertCircle, Sparkles, ShieldOff } from "lucide-react";
import { toast } from "sonner";

export default function WorkerDashboard({ 
  session, 
  onLogout 
}: { 
  session: any; 
  onLogout: () => void 
}) {
  const [loading, setLoading] = useState(true);
  const [staffProfile, setStaffProfile] = useState<any>(null);
  const [assignedShifts, setAssignedShifts] = useState<any[]>([]);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [updatingShiftId, setUpdatingShiftId] = useState<string | null>(null);

  // Availability states
  const [availability, setAvailability] = useState<any[]>([]);

  const userEmail = session.user?.email;

  const loadWorkerData = useCallback(async () => {
    if (!userEmail) return;

    setLoading(true);
    try {
      // 1. Fetch staff profile
      const { data: staffData, error: staffError } = await supabase
        .from("agency_staff")
        .select("*")
        .eq("email", userEmail)
        .single();

      if (staffError) throw staffError;
      setStaffProfile(staffData);
      setAvailability(staffData.availability || []);

      // 2. Fetch assigned shifts
      const { data: shifts, error: shiftsError } = await supabase
        .from("agency_shifts")
        .select("*")
        .eq("agency_staff_id", staffData.id)
        .order("start_time", { ascending: true });

      if (shiftsError) throw shiftsError;

      // Resolve care home names
      const homesIds = (shifts || []).map(s => s.care_home_id);
      let careHomeNames: Record<string, string> = {};
      let teamNames: Record<string, string> = {};

      if (homesIds.length > 0) {
        const { data: homes } = await supabase.from("care_homes").select("id, name").in("id", homesIds);
        (homes || []).forEach(h => {
          careHomeNames[h.id] = h.name;
        });

        const teamIds = (shifts || []).map(s => s.team_id).filter(Boolean);
        if (teamIds.length > 0) {
          const { data: teamsData } = await supabase.from("teams").select("id, name").in("id", teamIds);
          (teamsData || []).forEach(t => {
            teamNames[t.id] = t.name;
          });
        }
      }

      const mappedShifts = (shifts || []).map(s => ({
        ...s,
        careHomeName: careHomeNames[s.care_home_id] || "Care Home",
        teamName: teamNames[s.team_id] || "All Units"
      }));

      setAssignedShifts(mappedShifts);

      // Find active shift (current or nearest upcoming today)
      const now = new Date();
      const currentActive = mappedShifts.find(s => 
        s.attendance_status === "checked_in" ||
        (new Date(s.start_time) <= now && new Date(s.end_time) >= now && s.status === "assigned")
      );
      setActiveShift(currentActive || null);

    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load your shift profile.");
    } finally {
      setLoading(false);
    }
  }, [userEmail, supabase]);

  useEffect(() => {
    loadWorkerData();
  }, [loadWorkerData]);

  // Real-time: watch for offboarding by care home staff
  useEffect(() => {
    if (!userEmail) return;

    const channel = supabase
      .channel("worker-status-watch")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "agency_staff",
        },
        async (payload) => {
          // Only react if this is our own record
          if (payload.new?.email !== userEmail) return;
          const newStatus = payload.new?.status;
          if (newStatus === "offboarded" || newStatus === "available") {
            toast.error("Your shift assignment has ended. You have been logged out.", {
              duration: 5000,
            });
            await supabase.auth.signOut();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userEmail, supabase, onLogout]);

  const handleClockIn = async () => {
    if (!activeShift) return;
    setUpdatingShiftId(activeShift.id);

    try {
      const timestamp = new Date().toISOString();
      const { error } = await supabase
        .from("agency_shifts")
        .update({
          attendance_status: "checked_in",
          check_in_time: timestamp,
          updated_at: timestamp
        })
        .eq("id", activeShift.id);

      if (error) throw error;

      toast.success("Clocked in successfully! Have a great shift.");
      await loadWorkerData();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to clock in.");
    } finally {
      setUpdatingShiftId(null);
    }
  };

  const handleClockOut = async () => {
    if (!activeShift) return;
    setUpdatingShiftId(activeShift.id);

    try {
      const timestamp = new Date().toISOString();
      const { error } = await supabase
        .from("agency_shifts")
        .update({
          status: "completed",
          attendance_status: "checked_out",
          check_out_time: timestamp,
          updated_at: timestamp
        })
        .eq("id", activeShift.id);

      if (error) throw error;

      toast.success("Clocked out! Rota recorded as completed.");
      await loadWorkerData();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to clock out.");
    } finally {
      setUpdatingShiftId(null);
    }
  };

  const toggleAvailability = async (index: number) => {
    const updated = [...availability];
    updated[index].available = !updated[index].available;
    setAvailability(updated);

    try {
      const { error } = await supabase
        .from("agency_staff")
        .update({
          availability: updated
        })
        .eq("id", staffProfile.id);

      if (error) throw error;
      toast.success("Availability updated.");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to update availability.");
    }
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-slate-500">Loading your shift logs...</p>
      </div>
    );
  }

  const careoPortalUrl = process.env.NEXT_PUBLIC_CAREO_URL || "http://localhost:3000";

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 max-w-4xl mx-auto space-y-8 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-5">
        <div>
          <span className="text-[10px] tracking-[0.12em] uppercase font-bold text-teal-600 block mb-1">Worker Console</span>
          <h1 className="text-3xl font-bold text-slate-800 font-sans tracking-tight">
            Welcome, {staffProfile?.name}
          </h1>
          <p className="text-slate-500 text-xs mt-1 font-sans font-medium">
            Check shifts, clock-in, and coordinate compliance tasks.
          </p>
        </div>
        <Button variant="outline" onClick={onLogout} className="border-slate-200 bg-white hover:bg-slate-50 rounded-full px-5 text-xs h-9 font-semibold">
          Sign Out
        </Button>
      </div>

      {/* Compliance / Activation Notice */}
      {staffProfile?.status === "active" ? (
        <Card className="bg-white border border-emerald-100 shadow-xs rounded-2xl overflow-hidden">
          <CardContent className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-full h-fit border border-emerald-100 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h4 className="font-bold text-slate-800 text-sm font-sans">You are active on CareO!</h4>
                <p className="text-slate-500 text-xs leading-relaxed font-sans">
                  Your account is linked to the care home. Click below to open CareO and log medications or resident records.
                </p>
              </div>
            </div>
            <a href={careoPortalUrl} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto shrink-0">
              <Button className="bg-teal-600 hover:bg-teal-700 text-white w-full gap-2 rounded-full px-5 text-xs h-9">
                Launch CareO Portal
                <ExternalLink className="w-4 h-4" />
              </Button>
            </a>
          </CardContent>
        </Card>
      ) : staffProfile?.status === "approved" ? (
        <Card className="bg-white border border-teal-100 shadow-xs rounded-2xl overflow-hidden">
          <CardContent className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex gap-3">
              <div className="p-2.5 bg-teal-50 text-teal-700 rounded-full h-fit border border-teal-100 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h4 className="font-bold text-slate-800 text-sm font-sans">Assignment Approved</h4>
                <p className="text-slate-500 text-xs leading-relaxed font-sans">
                  Your shift assignment is approved. Once you arrive at the care home, they will email your onboarding link to activate access.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-white border border-slate-100 shadow-xs rounded-2xl overflow-hidden">
          <CardContent className="p-4 flex gap-3 text-slate-600 text-xs font-sans">
            <Clock className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-slate-700 not-italic font-sans text-[10px] tracking-wider uppercase mb-0.5">Available for Assignments</span>
              You don't have any active care home assignments. Your profile is visible to care homes for temporary rota assignments.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clock In / Out Widget */}
      {activeShift && (
        <Card className="border border-teal-100 shadow-sm bg-white rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-50 px-6 pt-5">
            <Badge className="w-fit bg-teal-50 text-teal-700 border-teal-100 font-medium rounded-full text-[9px] uppercase tracking-wider">Active Shift Today</Badge>
            <CardTitle className="text-lg font-bold text-slate-805 pt-2 flex items-center gap-2 font-sans">
              <MapPin className="w-5 h-5 text-teal-600" />
              {activeShift.careHomeName}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 font-sans">
              {activeShift.teamName} | {formatDate(activeShift.start_time)} ({formatTime(activeShift.start_time)} - {formatTime(activeShift.end_time)})
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 px-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="text-xs text-slate-500 space-y-1">
              {activeShift.check_in_time ? (
                <p className="text-emerald-700 font-bold flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  Clocked In at: {formatTime(activeShift.check_in_time)}
                </p>
              ) : (
                <p className="font-sans text-slate-500 text-[11px] font-medium">Status: Awaiting Shift commencement</p>
              )}
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {!activeShift.check_in_time ? (
                <Button
                  className="bg-teal-600 hover:bg-teal-700 text-white w-full sm:w-32 py-5 rounded-full text-xs font-semibold h-10"
                  disabled={updatingShiftId !== null}
                  onClick={handleClockIn}
                >
                  {updatingShiftId ? "Clocking In..." : "Clock In"}
                </Button>
              ) : (
                <Button
                  className="bg-slate-700 hover:bg-slate-800 text-white w-full sm:w-32 py-5 rounded-full text-xs font-semibold h-10"
                  disabled={updatingShiftId !== null}
                  onClick={handleClockOut}
                >
                  {updatingShiftId ? "Clocking Out..." : "Clock Out"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Grid: Rota Calendar & Availability */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Rota List */}
        <Card className="bg-white border border-slate-100 shadow-sm rounded-2xl overflow-hidden md:col-span-2">
          <CardHeader className="pb-3 border-b border-slate-50 px-6 pt-5">
            <span className="text-[9px] tracking-[0.08em] uppercase font-bold text-slate-400 block">Duty Logs</span>
            <CardTitle className="text-base font-bold text-slate-800 font-sans">Your Shift Calendar</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {assignedShifts.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs font-sans">No shifts scheduled yet.</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {assignedShifts.map((s) => (
                  <div key={s.id} className="p-4 px-6 flex items-center justify-between hover:bg-slate-50/30 transition">
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-800 text-xs">{s.careHomeName}</p>
                      <p className="text-[10px] text-slate-500 font-sans font-medium">{s.teamName}</p>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono mt-0.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(s.start_time)} ({formatTime(s.start_time)} - {formatTime(s.end_time)})
                      </span>
                    </div>
                    <div>
                      <Badge className={`text-[9px] font-bold uppercase rounded-full px-2.5 py-0.5 tracking-wider ${
                        s.attendance_status === "checked_out"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : s.attendance_status === "checked_in"
                          ? "bg-teal-50 text-teal-700 border-teal-100"
                          : "bg-slate-100 text-slate-500 border-none"
                      }`} variant="outline">
                        {s.attendance_status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Availability Schedule */}
        <Card className="bg-white border border-slate-100 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-50 px-6 pt-5">
            <span className="text-[9px] tracking-[0.08em] uppercase font-bold text-slate-400 block">Preferences</span>
            <CardTitle className="text-base font-bold text-slate-800 font-sans">Weekly Availability</CardTitle>
            <CardDescription className="text-xs text-slate-500 font-sans mt-0.5">Select the days you are available to work.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-6 pt-4 pb-6">
            {availability.map((item, idx) => (
              <div key={item.day} className="flex items-center justify-between border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                <span className="text-xs font-semibold text-slate-700">{item.day}</span>
                <input
                  type="checkbox"
                  checked={item.available}
                  onChange={() => toggleAvailability(idx)}
                  className="h-4 w-4 rounded border-slate-350 text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
