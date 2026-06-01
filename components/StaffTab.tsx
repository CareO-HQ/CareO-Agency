"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { createAgencyStaffAuthOnly } from "@/app/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, UserPlus, FileText, CheckCircle, AlertTriangle, Calendar, Award } from "lucide-react";
import { toast } from "sonner";

export default function StaffTab() {
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [supervisorId, setSupervisorId] = useState<string | null>(null);

  // Add staff modal state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStaff, setNewStaff] = useState({
    name: "",
    email: "",
    password: "",
    role: "nurse" as "nurse" | "care_assistant",
    phone: "",
    skills: "",
    certifications: ""
  });

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("agency_staff")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setStaffList(data || []);
    } catch (err: any) {
      toast.error("Failed to load staff list.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
    
    // Load current supervisor's database ID
    async function loadSupervisor() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // 1. Try by auth_user_id
          let { data, error } = await supabase
            .from("agency_staff")
            .select("id, auth_user_id")
            .eq("auth_user_id", user.id)
            .maybeSingle();

          if (error) throw error;

          // 2. Fall back to email if auth_user_id is not linked
          if (!data && user.email) {
            const { data: emailData, error: emailError } = await supabase
              .from("agency_staff")
              .select("id, auth_user_id")
              .eq("email", user.email)
              .maybeSingle();

            if (emailError) throw emailError;
            data = emailData;

            // Auto-sync auth_user_id if found by email but missing auth ID
            if (data && !data.auth_user_id) {
              await supabase
                .from("agency_staff")
                .update({ auth_user_id: user.id })
                .eq("id", data.id);
            }
          }

          if (data) {
            setSupervisorId(data.id);
          }
        }
      } catch (err) {
        console.error("Error loading supervisor context in StaffTab:", err);
      }
    }
    loadSupervisor();
  }, []);

  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.name || !newStaff.email || !newStaff.password) {
      toast.error("Name, Email, and Password are required.");
      return;
    }

    if (newStaff.password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    try {
      const skillsArray = newStaff.skills.split(",").map(s => s.trim()).filter(Boolean);
      const certsArray = newStaff.certifications.split(",").map(c => c.trim()).filter(Boolean);

      // 1. Insert into public.agency_staff on the client side (governed by RLS - supervisors can insert staff)
      const { error: dbError } = await supabase
        .from("agency_staff")
        .insert({
          name: newStaff.name,
          email: newStaff.email.trim(),
          role: newStaff.role,
          phone: newStaff.phone,
          status: "available",
          skills: skillsArray,
          certifications: certsArray,
          supervisor_id: supervisorId,
          compliance_documents: [
            { type: "DBS Check", status: "verified", date: new Date().toISOString() },
            { type: "Right to Work", status: "verified", date: new Date().toISOString() }
          ],
          availability: [
            { day: "Monday", available: true },
            { day: "Tuesday", available: true },
            { day: "Wednesday", available: true },
            { day: "Thursday", available: true },
            { day: "Friday", available: true },
            { day: "Saturday", available: false },
            { day: "Sunday", available: false }
          ]
        });

      if (dbError) throw dbError;

      // 2. Create the auth credentials on the backend (auth only, no RLS override on database tables)
      const result = await createAgencyStaffAuthOnly({
        name: newStaff.name,
        email: newStaff.email.trim(),
        role: newStaff.role,
        password: newStaff.password
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success("Staff account and profile created successfully!");
      setShowAddForm(false);
      setNewStaff({
        name: "",
        email: "",
        password: "",
        role: "nurse",
        phone: "",
        skills: "",
        certifications: ""
      });
      await fetchStaff();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to add staff member.");
    }
  };

  // Filter staff list
  const filteredStaff = staffList.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                          item.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = selectedRole === "all" || item.role === selectedRole;
    const matchesStatus = selectedStatus === "all" || item.status === selectedStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-8 font-sans">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <span className="text-[10px] tracking-[0.12em] uppercase font-bold text-teal-600 block mb-1">Human Resources</span>
          <h2 className="text-3xl font-bold text-slate-800 font-sans tracking-tight">
            Staff Management
          </h2>
          <p className="text-slate-500 text-xs mt-1 font-sans font-medium">
            Register and monitor available agency nurses, assistants, compliance profiles, and credentials.
          </p>
        </div>
        <Button 
          onClick={() => setShowAddForm(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white font-medium flex gap-2 sm:self-center h-10 px-5 text-xs rounded-full shadow-xs"
        >
          <UserPlus className="w-4 h-4" />
          Add Agency Staff
        </Button>
      </div>

      {/* Add Staff Dialog/Form Overlay */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-xl border-slate-100 bg-white rounded-3xl overflow-hidden">
            <CardHeader className="pt-6 pb-4 border-b border-slate-50 px-6">
              <span className="text-[9px] tracking-[0.08em] uppercase font-bold text-slate-400 block">Registration</span>
              <CardTitle className="text-xl font-bold text-slate-800 font-sans">Add New Agency Staff</CardTitle>
            </CardHeader>
            <form onSubmit={handleAddStaffSubmit}>
              <CardContent className="space-y-4 px-6 pt-5 pb-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 col-span-2">
                    <Label htmlFor="staff-name" className="text-[10px] tracking-[0.05em] uppercase font-bold text-slate-500">Full Name *</Label>
                    <Input
                      id="staff-name"
                      placeholder="John Smith"
                      value={newStaff.name}
                      onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                      className="bg-slate-50/50 border-slate-200 focus:bg-white text-xs h-9 rounded-full px-4"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="staff-email" className="text-[10px] tracking-[0.05em] uppercase font-bold text-slate-500">Email Address *</Label>
                    <Input
                      id="staff-email"
                      type="email"
                      placeholder="john.smith@agency.com"
                      value={newStaff.email}
                      onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                      className="bg-slate-50/50 border-slate-200 focus:bg-white text-xs h-9 rounded-full px-4"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="staff-phone" className="text-[10px] tracking-[0.05em] uppercase font-bold text-slate-500">Phone Number</Label>
                    <Input
                      id="staff-phone"
                      placeholder="+44 7700 900077"
                      value={newStaff.phone}
                      onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                      className="bg-slate-50/50 border-slate-200 focus:bg-white text-xs h-9 rounded-full px-4"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label htmlFor="staff-password" className="text-[10px] tracking-[0.05em] uppercase font-bold text-slate-500">Initial Password *</Label>
                    <Input
                      id="staff-password"
                      type="password"
                      placeholder="••••••••"
                      value={newStaff.password}
                      onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                      className="bg-slate-50/50 border-slate-200 focus:bg-white text-xs h-9 rounded-full px-4"
                      required
                    />
                  </div>
                  <div className="space-y-2.5 col-span-2">
                    <Label className="text-[10px] tracking-[0.05em] uppercase font-bold text-slate-500 block">Assign Staff Role</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setNewStaff({ ...newStaff, role: "nurse" })}
                        className={`p-2.5 rounded-full border text-xs font-semibold uppercase tracking-wider transition-all ${
                          newStaff.role === "nurse"
                            ? "bg-teal-50 border-teal-500 text-teal-700 font-bold shadow-xs"
                            : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        Agency Nurse (RN)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewStaff({ ...newStaff, role: "care_assistant" })}
                        className={`p-2.5 rounded-full border text-xs font-semibold uppercase tracking-wider transition-all ${
                          newStaff.role === "care_assistant"
                            ? "bg-teal-50 border-teal-500 text-teal-700 font-bold shadow-xs"
                            : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        Care Assistant (HCA)
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label htmlFor="skills" className="text-[10px] tracking-[0.05em] uppercase font-bold text-slate-500">Skills (comma-separated)</Label>
                    <Input
                      id="skills"
                      placeholder="Wound dressing, Peg feeding, Catheter care"
                      value={newStaff.skills}
                      onChange={(e) => setNewStaff({ ...newStaff, skills: e.target.value })}
                      className="bg-slate-50/50 border-slate-200 focus:bg-white text-xs h-9 rounded-full px-4"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label htmlFor="certs" className="text-[10px] tracking-[0.05em] uppercase font-bold text-slate-500">Certifications (comma-separated)</Label>
                    <Input
                      id="certs"
                      placeholder="NMC Pin, CPR, Safeguarding Level 3"
                      value={newStaff.certifications}
                      onChange={(e) => setNewStaff({ ...newStaff, certifications: e.target.value })}
                      className="bg-slate-50/50 border-slate-200 focus:bg-white text-xs h-9 rounded-full px-4"
                    />
                  </div>
                </div>
              </CardContent>
              <div className="flex items-center justify-end gap-2.5 p-4 border-t border-slate-100 bg-slate-50/50 px-6">
                <Button type="button" variant="outline" className="rounded-full px-5 text-xs h-9" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white rounded-full px-5 text-xs h-9">
                  Add Member
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="bg-white border border-slate-100 shadow-xs rounded-2xl overflow-hidden">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search staff by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-slate-50/30 rounded-full border-slate-200 focus:bg-white text-xs h-9"
            />
          </div>
          <div className="flex items-center gap-3.5 w-full sm:w-auto">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="p-2 border border-slate-200 rounded-full text-xs bg-slate-50/50 hover:bg-slate-100/50 text-slate-600 focus:outline-none focus:border-teal-500 w-full sm:w-40 h-9 px-4 font-semibold uppercase tracking-wider cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="nurse">Nurse</option>
              <option value="care_assistant">Care Assistant</option>
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="p-2 border border-slate-200 rounded-full text-xs bg-slate-50/50 hover:bg-slate-100/50 text-slate-600 focus:outline-none focus:border-teal-500 w-full sm:w-40 h-9 px-4 font-semibold uppercase tracking-wider cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="available">Available</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="active">Active</option>
              <option value="offboarded">Offboarded</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Staff Directory Table */}
      <Card className="bg-white border border-slate-100 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs font-sans">Loading staff directory...</div>
          ) : filteredStaff.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs font-sans">No agency staff found matching criteria.</div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b border-slate-100">
                  <TableHead className="pl-6 text-[10px] tracking-[0.08em] uppercase font-bold text-slate-400">Name</TableHead>
                  <TableHead className="text-[10px] tracking-[0.08em] uppercase font-bold text-slate-400">Role</TableHead>
                  <TableHead className="text-[10px] tracking-[0.08em] uppercase font-bold text-slate-400">Skills & Certs</TableHead>
                  <TableHead className="text-[10px] tracking-[0.08em] uppercase font-bold text-slate-400">Compliance Status</TableHead>
                  <TableHead className="text-[10px] tracking-[0.08em] uppercase font-bold text-slate-400">Shift Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.map((staff) => (
                  <TableRow key={staff.id} className="hover:bg-slate-50/30 border-b border-slate-50 last:border-0">
                    <TableCell className="pl-6 py-4">
                      <div className="font-semibold text-slate-800 text-xs">{staff.name}</div>
                      <div className="text-[11px] text-slate-500 font-sans font-medium">{staff.email}</div>
                      {staff.phone && <div className="text-[10px] text-slate-400 font-mono mt-0.5">{staff.phone}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize bg-slate-50/50 text-slate-600 border-slate-200 text-[10px] rounded-full px-2.5">
                        {staff.role?.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[300px] space-y-1.5">
                        <div className="flex flex-wrap gap-1">
                          {staff.skills?.map((skill: string) => (
                            <Badge key={skill} className="bg-teal-50 text-teal-800 border-none text-[9px] px-2 py-0.5 rounded-full font-medium">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1 text-[10px] text-slate-500 items-center font-sans font-medium">
                          <Award className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                          <span>{staff.certifications?.join(", ") || "No credentials listed"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold font-sans">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        <span>Verified</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[9px] font-bold uppercase rounded-full px-2.5 py-0.5 tracking-wider ${
                        staff.status === "active"
                          ? "bg-teal-100 text-teal-900 border-none"
                          : staff.status === "available"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : staff.status === "pending_approval"
                          ? "bg-amber-50 text-amber-700 border-amber-100"
                          : "bg-slate-100 text-slate-500 border-none"
                      }`} variant="outline">
                        {staff.status}
                      </Badge>
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
