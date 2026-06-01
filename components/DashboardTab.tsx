"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, Building, Clock, ClipboardList, Send, Calendar, Play } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { toast } from "sonner";

// Mock stats for chart visualization in local dev
const chartData = [
  { name: "Mon", shifts: 8, completed: 8 },
  { name: "Tue", shifts: 12, completed: 10 },
  { name: "Wed", shifts: 15, completed: 15 },
  { name: "Thu", shifts: 11, completed: 9 },
  { name: "Fri", shifts: 18, completed: 16 },
  { name: "Sat", shifts: 22, completed: 22 },
  { name: "Sun", shifts: 19, completed: 19 }
];

const hoursData = [
  { name: "Mon", hours: 64 },
  { name: "Tue", hours: 96 },
  { name: "Wed", hours: 120 },
  { name: "Thu", hours: 88 },
  { name: "Fri", hours: 144 },
  { name: "Sat", hours: 176 },
  { name: "Sun", hours: 152 }
];

export default function DashboardTab({ 
  onNavigate,
  supervisorProfile 
}: { 
  onNavigate: (tab: string) => void;
  supervisorProfile: any;
}) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeWorkers: 0,
    availableWorkers: 0,
    pendingApprovals: 0,
    careHomesCount: 0
  });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      try {
        const agencyName = supervisorProfile?.agency_name;

        // 1. Available workers
        let availableQuery = supabase
          .from("agency_staff")
          .select("id", { count: "exact", head: true })
          .eq("status", "available");
        if (agencyName) {
          availableQuery = availableQuery.eq("agency_name", agencyName);
        }
        const { count: availableCount } = await availableQuery;

        // 2. Active workers
        let activeQuery = supabase
          .from("agency_staff")
          .select("id", { count: "exact", head: true })
          .eq("status", "active");
        if (agencyName) {
          activeQuery = activeQuery.eq("agency_name", agencyName);
        }
        const { count: activeCount } = await activeQuery;

        // 3. Pending requests
        let pendingQuery = supabase
          .from("agency_requests")
          .select("id, agency_staff!inner(agency_name)", { count: "exact", head: true })
          .eq("status", "pending");
        if (agencyName) {
          pendingQuery = pendingQuery.eq("agency_staff.agency_name", agencyName);
        }
        const { count: pendingCount } = await pendingQuery;

        // 4. Care homes count
        let careHomesQuery = supabase
          .from("agency_requests")
          .select("care_home_id, agency_staff!inner(agency_name)");
        if (agencyName) {
          careHomesQuery = careHomesQuery.eq("agency_staff.agency_name", agencyName);
        }
        const { data: careHomesData } = await careHomesQuery;

        const uniqueCareHomes = new Set((careHomesData || []).map(r => r.care_home_id));

        setStats({
          activeWorkers: activeCount || 0,
          availableWorkers: availableCount || 0,
          pendingApprovals: pendingCount || 0,
          careHomesCount: uniqueCareHomes.size || 0
        });

        // 5. Fetch recent requests as activity
        let activitiesQuery = supabase
          .from("agency_requests")
          .select(`
            id, status, created_at,
            agency_staff:agency_staff_id!inner(name, role, agency_name),
            care_home_id
          `)
          .order("created_at", { ascending: false })
          .limit(5);
        if (agencyName) {
          activitiesQuery = activitiesQuery.eq("agency_staff.agency_name", agencyName);
        }
        const { data: activities, error } = await activitiesQuery;

        if (!error && activities) {
          // Resolve Care Home names using CareO database directly
          const careHomeIds = activities.map(a => a.care_home_id);
          let careHomeNames: Record<string, string> = {};
          
          if (careHomeIds.length > 0) {
            const { data: homes } = await supabase
              .from("care_homes")
              .select("id, name")
              .in("id", careHomeIds);
            
            (homes || []).forEach(h => {
              careHomeNames[h.id] = h.name;
            });
          }

          setRecentActivities(activities.map(a => ({
            id: a.id,
            workerName: (a.agency_staff as any)?.name || "Unknown Staff",
            role: (a.agency_staff as any)?.role || "Staff",
            careHomeName: careHomeNames[a.care_home_id] || "Care Home",
            status: a.status,
            time: new Date(a.created_at).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit"
            })
          })));
        }

      } catch (err: any) {
        console.error("Failed to load dashboard metrics:", err);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [supabase, supervisorProfile]);

  return (
    <div className="space-y-8 font-sans">
      {/* Overview Intro Label & Heading */}
      <div className="border-b border-slate-100 pb-5">
        <span className="text-[10px] tracking-[0.12em] uppercase font-bold text-teal-600 block mb-1">Weekly Snapshot</span>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Agency Overview & Performance
        </h1>
        <p className="text-slate-500 text-xs mt-1">Operational tracking of temporary healthcare staff roster assignments.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1 */}
        <Card className="bg-white border border-slate-100 shadow-xs rounded-2xl overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] tracking-[0.08em] uppercase font-bold text-slate-400 block">Active Workers</span>
              <h3 className="text-3.5xl font-extrabold text-slate-900">{loading ? "..." : stats.activeWorkers}</h3>
            </div>
            <div className="h-10 w-10 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center border border-emerald-100">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2 */}
        <Card className="bg-white border border-slate-100 shadow-xs rounded-2xl overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] tracking-[0.08em] uppercase font-bold text-slate-400 block">Available Pool</span>
              <h3 className="text-3.5xl font-extrabold text-slate-900">{loading ? "..." : stats.availableWorkers}</h3>
            </div>
            <div className="h-10 w-10 bg-teal-50 text-teal-700 rounded-full flex items-center justify-center border border-teal-100">
              <UserPlus className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3 */}
        <Card className="bg-white border border-slate-100 shadow-xs rounded-2xl overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] tracking-[0.08em] uppercase font-bold text-slate-400 block">Pending Approvals</span>
              <h3 className="text-3.5xl font-extrabold text-slate-900">{loading ? "..." : stats.pendingApprovals}</h3>
            </div>
            <div className="h-10 w-10 bg-amber-50 text-amber-700 rounded-full flex items-center justify-center border border-amber-100">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4 */}
        <Card className="bg-white border border-slate-100 shadow-xs rounded-2xl overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] tracking-[0.08em] uppercase font-bold text-slate-400 block">Care Homes Served</span>
              <h3 className="text-3.5xl font-extrabold text-slate-900">{loading ? "..." : stats.careHomesCount}</h3>
            </div>
            <div className="h-10 w-10 bg-indigo-50 text-indigo-700 rounded-full flex items-center justify-center border border-indigo-50">
              <Building className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-1 space-y-3">
          <span className="text-[10px] tracking-[0.1em] uppercase font-bold text-slate-400 block">Quick Operations</span>
          <Card className="bg-white border border-slate-100 shadow-sm p-5 space-y-3 rounded-2xl">
            <Button
              className="w-full bg-teal-600 hover:bg-teal-700 text-white justify-start gap-3 h-10 text-xs font-bold rounded-full"
              onClick={() => onNavigate("staff")}
            >
              <UserPlus className="w-4 h-4" />
              Add New Staff Member
            </Button>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white justify-start gap-3 h-10 text-xs font-bold rounded-full"
              onClick={() => onNavigate("requests")}
            >
              <Send className="w-4 h-4" />
              Send Worker Approval Profile
            </Button>
            <Button
              className="w-full bg-slate-700 hover:bg-slate-800 text-white justify-start gap-3 h-10 text-xs font-bold rounded-full"
              onClick={() => onNavigate("scheduling")}
            >
              <Calendar className="w-4 h-4" />
              Assign / Schedule Shift
            </Button>
          </Card>
        </div>

        {/* Activity Feed */}
        <div className="lg:col-span-2 space-y-3">
          <span className="text-[10px] tracking-[0.1em] uppercase font-bold text-slate-400 block">Recent Activity Log</span>
          <Card className="bg-white border border-slate-100 shadow-sm rounded-2xl overflow-hidden">
            <CardContent className="p-5">
              {loading ? (
                <div className="py-8 text-center text-slate-400 text-xs">Loading activities...</div>
              ) : recentActivities.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">No recent activities.</div>
              ) : (
                <div className="space-y-4">
                  {recentActivities.map((act) => (
                    <div key={act.id} className="flex items-start justify-between border-b border-slate-50 pb-3.5 last:border-0 last:pb-0">
                      <div className="space-y-0.5">
                        <p className="text-slate-800 text-xs font-bold">
                          {act.workerName} <span className="font-normal text-slate-500">({act.role})</span>
                        </p>
                        <p className="text-slate-500 text-[11px]">
                          Profile sent to <span className="font-semibold text-slate-755">{act.careHomeName}</span>
                        </p>
                        <span className="text-[9px] text-slate-400 font-mono block mt-1">{act.time}</span>
                      </div>
                      <Badge className={`text-[9px] uppercase tracking-wider font-semibold rounded-full px-2.5 py-0.5 ${
                        act.status === "active" 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                          : act.status === "approved"
                          ? "bg-teal-50 text-teal-700 border-teal-100"
                          : act.status === "declined"
                          ? "bg-red-50 text-red-700 border-red-100"
                          : "bg-amber-50 text-amber-700 border-amber-100"
                      }`} variant="outline">
                        {act.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Real-time Statistics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Shifts Scheduled vs Completed */}
        <Card className="bg-white border border-slate-100 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-50 px-6 pt-5">
            <span className="text-[9px] tracking-[0.08em] uppercase font-bold text-slate-400 block">Weekly Metrics</span>
            <CardTitle className="text-base font-bold text-slate-850">
              Shifts Scheduled vs Completed
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 mt-0.5">Weekly operational shift fulfillment rates</CardDescription>
          </CardHeader>
          <CardContent className="h-64 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip />
                <Bar dataKey="shifts" name="Scheduled" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chart 2: Total Hours Worked */}
        <Card className="bg-white border border-slate-100 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-50 px-6 pt-5">
            <span className="text-[9px] tracking-[0.08em] uppercase font-bold text-slate-400 block">Total Capacity</span>
            <CardTitle className="text-base font-bold text-slate-855">
              Cumulative Hours Logged
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 mt-0.5">Total agency staff hours across all care homes</CardDescription>
          </CardHeader>
          <CardContent className="h-64 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hoursData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="hours" name="Total Hours" stroke="#0d9488" fillOpacity={0.08} fill="#0d9488" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
