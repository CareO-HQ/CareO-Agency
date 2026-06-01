"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Send, Building, ShieldCheck, MailOpen, UserMinus, FileText, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

export default function CareHomesTab() {
  const [loading, setLoading] = useState(true);
  const [careHomes, setCareHomes] = useState<any[]>([]);
  const [availableStaff, setAvailableStaff] = useState<any[]>([]);
  const [requestsList, setRequestsList] = useState<any[]>([]);

  // Link care home state
  const [linkCodeInput, setLinkCodeInput] = useState("");
  const [linking, setLinking] = useState(false);

  // Create request form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [selectedCareHomeId, setSelectedCareHomeId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [teams, setTeams] = useState<any[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Linkages from agency_linkages
      const { data: linkages, error: linkageError } = await supabase
        .from("agency_linkages")
        .select("care_home_id");
      
      if (linkageError) throw linkageError;
      
      const linkedIds = (linkages || []).map(l => l.care_home_id);
      
      // 2. Fetch Care Homes from CareO matching linkages
      let homes: any[] = [];
      if (linkedIds.length > 0) {
        const { data: homesData, error: homesError } = await supabase
          .from("care_homes")
          .select("id, name, organization_id")
          .in("id", linkedIds);
        if (homesError) throw homesError;
        homes = homesData || [];
      }
      setCareHomes(homes || []);

      // 2. Fetch Available Agency Staff
      const { data: staff, error: staffError } = await supabase
        .from("agency_staff")
        .select("id, name, role")
        .eq("status", "available");
      if (staffError) throw staffError;
      setAvailableStaff(staff || []);

      // 3. Fetch Sent Requests and join Care Home details
      const { data: requests, error: requestsError } = await supabase
        .from("agency_requests")
        .select(`
          *,
          agency_staff:agency_staff_id (name, role, email)
        `)
        .order("created_at", { ascending: false });

      if (requestsError) throw requestsError;

      // Manually map Care Home & Team names (since CareO tables are on same DB but without direct FK relation in agency schema)
      const mappedRequests = await Promise.all(
        (requests || []).map(async (req) => {
          // Resolve Care Home name
          const home = (homes || []).find(h => h.id === req.care_home_id);
          
          // Resolve Team name
          let teamName = "All Units";
          if (req.team_id) {
            const { data: teamData } = await supabase
              .from("teams")
              .select("name")
              .eq("id", req.team_id)
              .single();
            if (teamData) teamName = teamData.name;
          }

          return {
            ...req,
            careHomeName: home ? home.name : "Unknown Care Home",
            teamName
          };
        })
      );

      setRequestsList(mappedRequests);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load care home coordination logs.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLinkCareHome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (linkCodeInput.length !== 5) {
      toast.error("Link code must be exactly 5 characters.");
      return;
    }

    setLinking(true);
    try {
      // 1. Find the care home by this link code
      const { data: home, error: fetchError } = await supabase
        .from("care_homes")
        .select("id, name")
        .eq("agency_link_code", linkCodeInput)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!home) {
        toast.error("Invalid link code. Care home not found.");
        return;
      }

      // 2. Link it in agency_linkages
      const { error: insertError } = await supabase
        .from("agency_linkages")
        .insert({
          care_home_id: home.id
        });

      if (insertError) {
        if (insertError.code === "23505") {
          toast.error("This care home is already linked.");
        } else {
          throw insertError;
        }
        return;
      }

      toast.success(`Successfully linked ${home.name}!`);
      setLinkCodeInput("");
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to link care home.");
    } finally {
      setLinking(false);
    }
  };

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

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStaffIds.length === 0 || !selectedCareHomeId) {
      toast.error("Please select at least one worker and a care home.");
      return;
    }

    setSubmitting(true);
    try {
      const selectedHome = careHomes.find(h => h.id === selectedCareHomeId);
      if (!selectedHome) throw new Error("Selected Care Home not found.");

      // Loop through all selected staff IDs and insert requests + update statuses
      for (const staffId of selectedStaffIds) {
        // 1. Insert Request
        const { error: requestError } = await supabase
          .from("agency_requests")
          .insert({
            agency_staff_id: staffId,
            organization_id: selectedHome.organization_id,
            care_home_id: selectedCareHomeId,
            team_id: selectedTeamId || null,
            status: "pending",
            notes: notes,
            compliance_documents: [
              { type: "DBS Check", status: "verified" },
              { type: "Right to Work", status: "verified" }
            ]
          });

        if (requestError) throw requestError;

        // 2. Update staff status to pending_approval
        const { error: staffError } = await supabase
          .from("agency_staff")
          .update({
            status: "pending_approval"
          })
          .eq("id", staffId);

        if (staffError) throw staffError;
      }

      toast.success("Worker profile(s) and compliance details sent to care home!");
      setShowAddForm(false);
      setSelectedStaffIds([]);
      setSelectedCareHomeId("");
      setSelectedTeamId("");
      setNotes("");
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <span className="text-[10px] tracking-[0.12em] uppercase font-bold text-teal-600 block mb-1">Partnerships</span>
          <h2 className="text-3xl font-bold text-slate-800 font-sans tracking-tight">
            Care Homes & Requests
          </h2>
          <p className="text-slate-500 text-xs mt-1 font-sans font-medium">
            Dispatch staffing approval profiles and track shift activations inside care homes.
          </p>
        </div>
        <Button 
          onClick={() => setShowAddForm(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white font-medium flex gap-2 sm:self-center h-10 px-5 text-xs rounded-full shadow-xs"
        >
          <Send className="w-4 h-4" />
          Send Staff Profile
        </Button>
      </div>

      {/* Link Care Home Card */}
      <Card className="bg-white border border-slate-100 shadow-xs rounded-2xl overflow-hidden">
        <CardContent className="p-5 flex flex-col sm:flex-row gap-4 items-end justify-between">
          <div className="space-y-1 flex-1">
            <h3 className="text-md font-bold text-slate-800 font-sans flex items-center gap-2">
              <Building className="w-4 h-4 text-teal-600" />
              Link Care Home with Code
            </h3>
            <p className="text-slate-500 text-xs font-sans mt-0.5 font-medium">
              Enter the 5-character code generated in the CareO portal to link a new care home.
            </p>
          </div>
          <form onSubmit={handleLinkCareHome} className="flex gap-2 items-center w-full sm:w-auto">
            <input
              type="text"
              placeholder="CODE (e.g. CH78A)"
              value={linkCodeInput}
              onChange={(e) => setLinkCodeInput(e.target.value.toUpperCase().trim())}
              maxLength={5}
              required
              className="w-36 p-2 border border-slate-200 rounded-full text-xs bg-slate-50/50 hover:bg-slate-100/50 uppercase tracking-widest font-mono focus:outline-none focus:border-teal-500 text-slate-700 text-center h-9"
            />
            <Button type="submit" disabled={linking} className="bg-teal-600 hover:bg-teal-700 text-white font-medium h-9 text-xs rounded-full px-5">
              {linking ? "Linking..." : "Link Care Home"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* New Request Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-xl border-slate-100 bg-white rounded-3xl overflow-hidden">
            <CardHeader className="pt-6 pb-4 border-b border-slate-50 px-6">
              <span className="text-[9px] tracking-[0.08em] uppercase font-bold text-slate-400 block">Roster</span>
              <CardTitle className="text-xl font-bold text-slate-800 font-sans">Send Staff Profile for Approval</CardTitle>
              <CardDescription className="text-xs text-slate-500 font-sans mt-0.5">
                Select one or more workers and dispatch their compliance files to a care home.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSendRequest}>
              <CardContent className="space-y-4 px-6 pt-5 pb-6">
                {/* 1. Select Staff (Multi-select) */}
                <div className="space-y-1">
                  <Label className="text-[10px] tracking-[0.05em] uppercase font-bold text-slate-500 block">Available Staff Members *</Label>
                  <div className="border border-slate-200 rounded-2xl p-3 max-h-40 overflow-y-auto space-y-2 bg-slate-50/30">
                    {availableStaff.map(s => {
                      const isChecked = selectedStaffIds.includes(s.id);
                      return (
                        <label key={s.id} className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none border-b border-slate-50 pb-1.5 last:border-0 last:pb-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStaffIds([...selectedStaffIds, s.id]);
                              } else {
                                setSelectedStaffIds(selectedStaffIds.filter(id => id !== s.id));
                              }
                            }}
                            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                          />
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-800 text-[11px]">{s.name}</span>
                            <span className="text-[9px] text-slate-500 capitalize tracking-wider font-semibold">{s.role === "nurse" ? "Nurse" : "Care Assistant"}</span>
                          </div>
                        </label>
                      );
                    })}
                    {availableStaff.length === 0 && (
                      <p className="text-xs text-slate-500 py-4 text-center font-sans">No staff members are currently available.</p>
                    )}
                  </div>
                  {selectedStaffIds.length > 0 && (
                    <p className="text-[10px] text-teal-600 font-bold block mt-1 tracking-wide uppercase">{selectedStaffIds.length} staff selected.</p>
                  )}
                </div>

                {/* 2. Select Care Home */}
                <div className="space-y-1">
                  <Label htmlFor="carehome" className="text-[10px] tracking-[0.05em] uppercase font-bold text-slate-500">Target Care Home *</Label>
                  <select
                    id="carehome"
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
                  <Label htmlFor="team" className="text-[10px] tracking-[0.05em] uppercase font-bold text-slate-500">Specific Unit / House (Optional)</Label>
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

                {/* 4. Notes */}
                <div className="space-y-1">
                  <Label htmlFor="notes" className="text-[10px] tracking-[0.05em] uppercase font-bold text-slate-500">Communication Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Provide shift details, check-in instructions, or specific notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="bg-slate-50/50 border-slate-200 focus:bg-white text-xs rounded-2xl p-3"
                    rows={3}
                  />
                </div>
              </CardContent>
              <div className="flex items-center justify-end gap-2.5 p-4 border-t border-slate-100 bg-slate-50/50 px-6">
                <Button type="button" variant="outline" className="rounded-full px-5 text-xs h-9" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white rounded-full px-5 text-xs h-9" disabled={submitting}>
                  {submitting ? "Sending..." : "Send Request"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Requests Tracker Table */}
      <Card className="bg-white border border-slate-100 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-50 px-6 pt-5">
          <span className="text-[9px] tracking-[0.08em] uppercase font-bold text-slate-400 block">Audit Trail</span>
          <CardTitle className="text-base font-bold text-slate-800 font-sans">Sent Staff Approval Requests</CardTitle>
          <CardDescription className="text-xs text-slate-500 font-sans mt-0.5">
            Monitor response logs, email invitation states, and shift activations.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-8 text-center text-slate-500 text-xs font-sans">Loading requests...</div>
          ) : requestsList.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs font-sans">No staffing requests sent yet.</div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b border-slate-100">
                  <TableHead className="pl-6 text-[10px] tracking-[0.08em] uppercase font-bold text-slate-400">Worker</TableHead>
                  <TableHead className="text-[10px] tracking-[0.08em] uppercase font-bold text-slate-400">Care Home</TableHead>
                  <TableHead className="text-[10px] tracking-[0.08em] uppercase font-bold text-slate-400">Unit</TableHead>
                  <TableHead className="text-[10px] tracking-[0.08em] uppercase font-bold text-slate-400">Sent Date</TableHead>
                  <TableHead className="text-[10px] tracking-[0.08em] uppercase font-bold text-slate-400">Email Activation Link</TableHead>
                  <TableHead className="text-right pr-6 text-[10px] tracking-[0.08em] uppercase font-bold text-slate-400">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requestsList.map((req) => (
                  <TableRow key={req.id} className="hover:bg-slate-50/30 border-b border-slate-50 last:border-0">
                    <TableCell className="pl-6 py-4">
                      <div className="font-semibold text-slate-800 text-xs">{req.agency_staff?.name}</div>
                      <div className="text-[11px] text-slate-500 capitalize tracking-wider font-semibold">{req.agency_staff?.role?.replace("_", " ")}</div>
                    </TableCell>
                    <TableCell className="font-semibold text-slate-700 text-xs">{req.careHomeName}</TableCell>
                    <TableCell className="text-slate-600 text-xs">{req.teamName}</TableCell>
                    <TableCell className="text-slate-600 text-xs font-mono">{formatDate(req.created_at)}</TableCell>
                    <TableCell>
                      {req.activation_sent ? (
                        <div className="flex items-center gap-1.5 text-xs text-teal-850 font-semibold font-sans">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Sent / Active Link</span>
                        </div>
                      ) : req.status === "approved" ? (
                        <span className="text-xs text-teal-700 flex items-center gap-1.5 font-semibold font-sans">
                          <Clock className="w-4 h-4 text-teal-600" />
                          Awaiting Invite dispatch
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 font-sans">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Badge className={`text-[9px] font-bold uppercase rounded-full px-2.5 py-0.5 tracking-wider ${
                        req.status === "active"
                          ? "bg-teal-100 text-teal-900 border-none"
                          : req.status === "approved"
                          ? "bg-sky-50 text-sky-700 border-sky-100"
                          : req.status === "declined"
                          ? "bg-red-50 text-red-700 border-red-100"
                          : "bg-amber-50 text-amber-700 border-amber-100"
                      }`} variant="outline">
                        {req.status}
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
