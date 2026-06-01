"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Plus, Clock, MapPin, CheckCircle, HelpCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function SchedulingTab() {
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [careHomes, setCareHomes] = useState<any[]>([]);

  // Create shift states
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedCareHomeId, setSelectedCareHomeId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [teams, setTeams] = useState<any[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Care Homes from CareO
      const { data: homes } = await supabase.from("care_homes").select("id, name, organization_id");
      setCareHomes(homes || []);

      // 2. Fetch All Agency Staff (nurses and assistants)
      const { data: staff } = await supabase.from("agency_staff").select("id, name, role");
      setStaffList(staff || []);

      // 3. Fetch shifts list
      const { data: shiftsData, error } = await supabase
        .from("agency_shifts")
        .select(`
          *,
          agency_staff:agency_staff_id (name, role)
        `)
        .order("start_time", { ascending: true });

      if (error) throw error;

      // Manually map Care Home & Team names
      const mappedShifts = await Promise.all(
        (shiftsData || []).map(async (shift) => {
          const home = (homes || []).find(h => h.id === shift.care_home_id);
          
          let teamName = "All Units";
          if (shift.team_id) {
            const { data: teamData } = await supabase
              .from("teams")
              .select("name")
              .eq("id", shift.team_id)
              .single();
            if (teamData) teamName = teamData.name;
          }

          return {
            ...shift,
            careHomeName: home ? home.name : "Unknown Care Home",
            teamName
          };
        })
      );

      setShifts(mappedShifts);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load scheduling calendar.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load teams when care home is selected
  useEffect(() => {
    async function loadTeams() {
      if (!selectedCareHomeId) {
        setTeams([]);
        return;
      }
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .eq("care_home_id", selectedCareHomeId);
      if (!error && data) {
        setTeams(data);
      }
    }
    loadTeams();
  }, [selectedCareHomeId, supabase]);

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId || !selectedCareHomeId || !startTime || !endTime) {
      toast.error("Please fill in all required fields.");
      return;
    }

    if (new Date(startTime) >= new Date(endTime)) {
      toast.error("End time must be after start time.");
      return;
    }

    setSubmitting(true);
    try {
      const selectedHome = careHomes.find(h => h.id === selectedCareHomeId);
      if (!selectedHome) throw new Error("Care home not found.");

      const { error } = await supabase
        .from("agency_shifts")
        .insert({
          agency_staff_id: selectedStaffId,
          organization_id: selectedHome.organization_id,
          care_home_id: selectedCareHomeId,
          team_id: selectedTeamId || null,
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
          status: "assigned",
          attendance_status: "pending"
        });

      if (error) throw error;

      toast.success("Shift assigned successfully!");
      setShowAddForm(false);
      setSelectedStaffId("");
      setSelectedCareHomeId("");
      setSelectedTeamId("");
      setStartTime("");
      setEndTime("");
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to create shift.");
    } finally {
      setSubmitting(false);
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

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <span className="text-[10px] tracking-[0.12em] uppercase font-bold text-teal-600 block mb-1">Roster Coordination</span>
          <h2 className="text-3xl font-bold text-slate-800 font-sans tracking-tight">
            Scheduling & Operations
          </h2>
          <p className="text-slate-500 text-xs mt-1 font-sans font-medium">
            Assign shift rotas, manage live worker coverage, and track check-in attendance.
          </p>
        </div>
        <Button 
          onClick={() => setShowAddForm(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white font-medium flex gap-2 sm:self-center h-10 px-5 text-xs rounded-full shadow-xs"
        >
          <Plus className="w-4 h-4" />
          Schedule Shift
        </Button>
      </div>

      {/* Add Shift Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-xl border-slate-100 bg-white rounded-3xl overflow-hidden">
            <CardHeader className="pt-6 pb-4 border-b border-slate-50 px-6">
              <span className="text-[9px] tracking-[0.08em] uppercase font-bold text-slate-400 block">Rota Assignment</span>
              <CardTitle className="text-xl font-bold text-slate-800 font-sans">Schedule Shift Assignment</CardTitle>
              <CardDescription className="text-xs text-slate-500 font-sans mt-0.5">Select worker and set time parameters.</CardDescription>
            </CardHeader>
            <form onSubmit={handleCreateShift}>
              <CardContent className="space-y-4 px-6 pt-5 pb-6">
                {/* 1. Select Staff */}
                <div className="space-y-1">
                  <Label htmlFor="staff" className="text-[10px] tracking-[0.05em] uppercase font-bold text-slate-500">Agency Worker *</Label>
                  <select
                    id="staff"
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    required
                    className="w-full p-2 border border-slate-200 rounded-full text-xs bg-slate-50/50 hover:bg-slate-100/50 focus:outline-none focus:border-teal-500 text-slate-700 h-9 px-4 font-semibold uppercase tracking-wider cursor-pointer"
                  >
                    <option value="">-- Select Staff --</option>
                    {staffList.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.role === "nurse" ? "Nurse" : "Care Assistant"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Select Care Home */}
                <div className="space-y-1">
                  <Label htmlFor="home" className="text-[10px] tracking-[0.05em] uppercase font-bold text-slate-500">Care Home *</Label>
                  <select
                    id="home"
                    value={selectedCareHomeId}
                    onChange={(e) => setSelectedCareHomeId(e.target.value)}
                    required
                    className="w-full p-2 border border-slate-200 rounded-full text-xs bg-slate-50/50 hover:bg-slate-100/50 focus:outline-none focus:border-teal-500 text-slate-700 h-9 px-4 font-semibold uppercase tracking-wider cursor-pointer"
                  >
                    <option value="">-- Select Care Home --</option>
                    {careHomes.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>

                {/* 3. Select Team/Unit */}
                <div className="space-y-1">
                  <Label htmlFor="team" className="text-[10px] tracking-[0.05em] uppercase font-bold text-slate-500">Unit / House (Optional)</Label>
                  <select
                    id="team"
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    disabled={!selectedCareHomeId}
                    className="w-full p-2 border border-slate-200 rounded-full text-xs bg-slate-50/50 hover:bg-slate-100/50 focus:outline-none focus:border-teal-500 text-slate-700 disabled:opacity-50 h-9 px-4 font-semibold uppercase tracking-wider cursor-pointer"
                  >
                    <option value="">All Units / Flexible</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {/* 4. Start Time */}
                <div className="space-y-1">
                  <Label htmlFor="start" className="text-[10px] tracking-[0.05em] uppercase font-bold text-slate-500">Start Date & Time *</Label>
                  <Input
                    id="start"
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="bg-slate-50/50 border-slate-200 focus:bg-white text-xs h-9 rounded-full px-4"
                    required
                  />
                </div>

                {/* 5. End Time */}
                <div className="space-y-1">
                  <Label htmlFor="end" className="text-[10px] tracking-[0.05em] uppercase font-bold text-slate-500">End Date & Time *</Label>
                  <Input
                    id="end"
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="bg-slate-50/50 border-slate-200 focus:bg-white text-xs h-9 rounded-full px-4"
                    required
                  />
                </div>
              </CardContent>
              <div className="flex items-center justify-end gap-2.5 p-4 border-t border-slate-100 bg-slate-50/50 px-6">
                <Button type="button" variant="outline" className="rounded-full px-5 text-xs h-9" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white rounded-full px-5 text-xs h-9" disabled={submitting}>
                  {submitting ? "Scheduling..." : "Schedule Shift"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Rota List Table */}
      <Card className="bg-white border border-slate-100 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-50 px-6 pt-5">
          <span className="text-[9px] tracking-[0.08em] uppercase font-bold text-slate-400 block">Weekly Schedule</span>
          <CardTitle className="text-base font-bold text-slate-800 font-sans">Shift Assignments & Attendance logs</CardTitle>
          <CardDescription className="text-xs text-slate-500 font-sans mt-0.5">
            Review allocated shift coverage, live clock-in timestamps, and completion logs.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-8 text-center text-slate-500 text-xs font-sans">Loading shifts...</div>
          ) : shifts.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs font-sans">No shifts scheduled yet.</div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b border-slate-100">
                  <TableHead className="pl-6 text-[10px] tracking-[0.08em] uppercase font-bold text-slate-400">Worker</TableHead>
                  <TableHead className="text-[10px] tracking-[0.08em] uppercase font-bold text-slate-400">Location</TableHead>
                  <TableHead className="text-[10px] tracking-[0.08em] uppercase font-bold text-slate-400">Shift Date</TableHead>
                  <TableHead className="text-[10px] tracking-[0.08em] uppercase font-bold text-slate-400">Shift Time</TableHead>
                  <TableHead className="text-[10px] tracking-[0.08em] uppercase font-bold text-slate-400">Clock In/Out</TableHead>
                  <TableHead className="text-[10px] tracking-[0.08em] uppercase font-bold text-slate-400">Shift Status</TableHead>
                  <TableHead className="text-right pr-6 text-[10px] tracking-[0.08em] uppercase font-bold text-slate-400">Attendance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((shift) => (
                  <TableRow key={shift.id} className="hover:bg-slate-50/30 border-b border-slate-50 last:border-0">
                    <TableCell className="pl-6 py-4">
                      <div className="font-semibold text-slate-800 text-xs">{shift.agency_staff?.name}</div>
                      <div className="text-[11px] text-slate-500 capitalize tracking-wider font-semibold">{shift.agency_staff?.role?.replace("_", " ")}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-700 text-xs flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {shift.careHomeName}
                      </div>
                      <div className="text-[10px] text-slate-500 font-sans font-medium mt-0.5">{shift.teamName}</div>
                    </TableCell>
                    <TableCell className="text-slate-700 text-xs font-semibold">
                      {formatDate(shift.start_time)}
                    </TableCell>
                    <TableCell className="text-slate-600 text-xs">
                      <div className="flex items-center gap-1.5 font-mono">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{formatTime(shift.start_time)} - {formatTime(shift.end_time)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600 text-[11px] font-mono">
                      {shift.check_in_time ? (
                        <div className="space-y-0.5">
                          <div className="text-emerald-700 font-semibold">In: {formatTime(shift.check_in_time)}</div>
                          {shift.check_out_time && <div>Out: {formatTime(shift.check_out_time)}</div>}
                        </div>
                      ) : (
                        <span className="text-slate-500 font-sans text-[11px] font-medium">Not clocked in</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[9px] font-bold uppercase rounded-full px-2.5 py-0.5 tracking-wider ${
                        shift.status === "completed"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : shift.status === "cancelled"
                          ? "bg-red-50 text-red-700 border-red-100"
                          : "bg-teal-50 text-teal-700 border-teal-100"
                      }`} variant="outline">
                        {shift.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1 text-xs">
                        {shift.attendance_status === "checked_in" && (
                          <span className="text-teal-700 font-bold flex items-center gap-1 uppercase tracking-wider text-[10px]">
                            <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                            On Duty
                          </span>
                        )}
                        {shift.attendance_status === "checked_out" && (
                          <span className="text-emerald-700 font-bold flex items-center gap-1 uppercase tracking-wider text-[10px]">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            Completed
                          </span>
                        )}
                        {shift.attendance_status === "pending" && (
                          <span className="text-slate-500 font-bold flex items-center gap-1 uppercase tracking-wider text-[10px]">
                            <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            Awaiting
                          </span>
                        )}
                        {shift.attendance_status === "missed" && (
                          <span className="text-red-700 font-bold flex items-center gap-1 uppercase tracking-wider text-[10px]">
                            <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                            Missed
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
