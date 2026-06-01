"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Building, User, Mail, Phone, Save } from "lucide-react";
import { toast } from "sonner";

export default function SettingsTab({ session }: { session: any }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [agencyName, setAgencyName] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        if (!session?.user?.id) return;

        // 1. Try finding by auth_user_id using maybeSingle to avoid PGRST116 error if not found
        let { data, error } = await supabase
          .from("agency_staff")
          .select("*")
          .eq("auth_user_id", session.user.id)
          .maybeSingle();

        if (error) throw error;

        // 2. Fall back to email lookup if not found by auth ID
        if (!data) {
          const { data: emailData, error: emailError } = await supabase
            .from("agency_staff")
            .select("*")
            .eq("email", session.user.email)
            .maybeSingle();

          if (emailError) throw emailError;
          data = emailData;

          // Auto-sync auth_user_id if found by email but auth ID is missing
          if (data && !data.auth_user_id) {
            await supabase
              .from("agency_staff")
              .update({ auth_user_id: session.user.id })
              .eq("id", data.id);
            data.auth_user_id = session.user.id;
          }
        }

        if (data) {
          setProfile(data);
          setAgencyName(data.agency_name || "");
        }
      } catch (err: any) {
        console.error("Error loading supervisor profile:", err);
        toast.error("Failed to load settings profile.");
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [session]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyName.trim()) {
      toast.error("Agency name cannot be empty.");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        auth_user_id: session.user.id,
        email: session.user.email,
        name: profile?.name || session.user.email.split("@")[0],
        role: "supervisor",
        status: "available",
        agency_name: agencyName.trim()
      };

      // Include ID if we already loaded a profile to ensure we update
      if (profile?.id) {
        payload.id = profile.id;
      }

      const { error } = await supabase
        .from("agency_staff")
        .upsert(payload, { onConflict: "email" });

      if (error) throw error;
      toast.success("Agency settings updated successfully!");

      // Refresh local state profile
      const { data } = await supabase
        .from("agency_staff")
        .select("*")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();
      if (data) setProfile(data);
    } catch (err: any) {
      console.error("Error updating settings:", err);
      toast.error(err.message || "Failed to update settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-slate-400 text-sm">Loading settings...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 font-sans">
      {/* Heading */}
      <div className="border-b border-slate-100 pb-5">
        <span className="text-[10px] tracking-[0.12em] uppercase font-bold text-teal-600 block mb-1">System Profile</span>
        <h2 className="text-3xl font-bold text-slate-800 font-sans tracking-tight">
          Agency Settings
        </h2>
        <p className="text-slate-500 text-xs mt-1 font-sans font-medium">Configure your staffing agency name and view profile details.</p>
      </div>

      <Card className="bg-white border border-slate-100 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="pt-6 pb-4 border-b border-slate-50 px-6">
          <span className="text-[9px] tracking-[0.08em] uppercase font-bold text-slate-400 block">Configuration</span>
          <CardTitle className="text-xl font-bold text-slate-800 font-sans">Agency Configuration</CardTitle>
          <CardDescription className="text-xs text-slate-500 font-sans mt-0.5">
            This name will be displayed in the CareO SaaS Admin portal.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSave}>
          <CardContent className="space-y-5 px-6 pt-5 pb-6">
            <div className="space-y-1">
              <Label htmlFor="agency-name" className="text-[10px] tracking-[0.05em] uppercase font-bold text-slate-500">Staffing Agency Name *</Label>
              <div className="relative">
                <Building className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="agency-name"
                  placeholder="e.g. Premium Healthcare Staffing"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  required
                  className="pl-10 bg-slate-50/50 rounded-full border-slate-200 focus:bg-white text-xs h-9"
                />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5 mt-6 space-y-3">
              <span className="text-[10px] tracking-[0.05em] uppercase font-bold text-slate-500 block">Supervisor Profile</span>
              <div className="grid grid-cols-2 gap-4 text-xs text-slate-650 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <div className="space-y-1">
                  <span className="text-slate-400 font-semibold block text-[10px]">Full Name</span>
                  <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                    <User className="w-4 h-4 text-slate-400" />
                    {profile?.name}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 font-semibold block text-[10px]">Role</span>
                  <div className="flex items-center gap-1.5 font-semibold text-slate-700 capitalize">
                    <ShieldCheck className="w-4 h-4 text-teal-650" />
                    {profile?.role}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 font-semibold block text-[10px]">Email Address</span>
                  <div className="flex items-center gap-1.5 font-semibold text-slate-700 font-sans">
                    <Mail className="w-4 h-4 text-slate-400" />
                    {profile?.email}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 font-semibold block text-[10px]">Phone Number</span>
                  <div className="flex items-center gap-1.5 font-semibold text-slate-700 font-mono">
                    <Phone className="w-4 h-4 text-slate-400" />
                    {profile?.phone || "Not set"}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100 bg-slate-50/50 px-6">
            <Button type="submit" disabled={saving} className="bg-teal-600 hover:bg-teal-700 text-white font-medium flex gap-2 h-9 text-xs rounded-full px-5">
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
