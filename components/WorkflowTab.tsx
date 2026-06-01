"use client";

import { motion } from "framer-motion";
import { PhoneCall, Users, FileText, CheckCircle, Mail, Database, UserCheck, ShieldAlert, RotateCcw, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type FlowStep = {
  id: number;
  title: string;
  icon: any;
  desc: string;
  dbChange?: string;
  badge?: string;
  badgeColor?: string;
};

const steps: FlowStep[] = [
  {
    id: 1,
    title: "Care Home Contact",
    icon: PhoneCall,
    desc: "Care home manager reaches out to the agency via phone or offline channel to request temp staff.",
    dbChange: "No Database changes yet",
    badge: "Offline Communication"
  },
  {
    id: 2,
    title: "Supervisor Selects Staff",
    icon: Users,
    desc: "Supervisor filters through the agency portal to find qualified, available nurses or care assistants.",
    dbChange: "Worker status is set to 'pending_approval' in agency_staff table",
    badge: "Staff Status: Pending Approval"
  },
  {
    id: 3,
    title: "Send Profile & Docs",
    icon: FileText,
    desc: "Supervisor sends worker profile and compliance credentials to the care home manager for audit.",
    dbChange: "Row created in agency_requests with status 'pending' and activation_token generated",
    badge: "agency_requests: pending"
  },
  {
    id: 4,
    title: "Care Home Approval",
    icon: CheckCircle,
    desc: "Care home manager audits credentials in CareO and clicks 'Approve' to confirm the worker matches needs.",
    dbChange: "agency_requests status updated to 'approved'. agency_staff status updated to 'approved'",
    badge: "Approved by Care Home",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200"
  },
  {
    id: 5,
    title: "Activation Email (Invite)",
    icon: Mail,
    desc: "When worker reaches the care home, CareO manager clicks 'Invite'. Resend sends onboarding email with activation link.",
    dbChange: "activation_sent sets to TRUE in agency_requests. Token generated",
    badge: "Email Invite Dispatched"
  },
  {
    id: 6,
    title: "IDs Assigned & Sync",
    icon: Database,
    desc: "Worker clicks activation link. If new, CareO record is created. Auth raw_app_meta_data and profile IDs are synchronized.",
    dbChange: "active_organization_id, active_care_home_id, active_team_id are set in public.users and auth metadata. User added to team_staff",
    badge: "IDs Assigned (NOT NULL)",
    badgeColor: "bg-teal-50 text-teal-700 border-teal-200"
  },
  {
    id: 7,
    title: "Worker Active in System",
    icon: UserCheck,
    desc: "Worker logs into CareO on-site. They can view resident charts, log daily records, and administer medications.",
    dbChange: "agency_requests status set to 'active'. Worker status set to 'active'",
    badge: "Active on Shift"
  },
  {
    id: 8,
    title: "Offboarding Triggered",
    icon: ShieldAlert,
    desc: "At the end of the shift or assignment period, the CareO manager clicks 'End Shift / Offboard' in the portal.",
    dbChange: "agency_requests status set to 'offboarded'. Worker status set to 'available'",
    badge: "Shift Ended"
  },
  {
    id: 9,
    title: "IDs Reset to NULL",
    icon: RotateCcw,
    desc: "Access credentials to CareO charts are automatically revoked, removing the worker from CareO's staff list.",
    dbChange: "active_organization_id, active_care_home_id, active_team_id set to NULL in public.users and auth metadata. Removed from team_staff",
    badge: "Access Revoked (IDs = NULL)",
    badgeColor: "bg-red-50 text-red-700 border-red-200"
  },
  {
    id: 10,
    title: "Return to Pool",
    icon: Users,
    desc: "Worker returns to the available agency staff pool, ready for their next coordination request.",
    dbChange: "Worker status is set back to 'available' in agency_staff table",
    badge: "Staff Status: Available"
  }
];

export default function WorkflowTab() {
  return (
    <div className="space-y-8 font-sans">
      {/* Title */}
      <div className="border-b border-slate-100 pb-5">
        <span className="text-[10px] tracking-[0.12em] uppercase font-bold text-teal-600 block mb-1">State Machine</span>
        <h2 className="text-3xl font-bold text-slate-800 font-sans tracking-tight">
          Staffing Lifecycle Workflow
        </h2>
        <p className="text-slate-500 text-xs mt-1 font-sans font-medium">
          Visual map of temporary worker onboarding, database state transitions, and offboarding.
        </p>
      </div>

      {/* Grid Infographic layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Step-by-Step Flow List */}
        <div className="space-y-4">
          <span className="text-[10px] tracking-[0.1em] uppercase font-bold text-slate-400 block mb-3">Process Walkthrough</span>
          <div className="relative border-l border-slate-200 pl-6 ml-4 space-y-6">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="relative group"
                >
                  {/* Circle Step Number */}
                  <span className="absolute -left-[35px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white border border-teal-600 text-teal-650 font-bold text-[10px] shadow-xs">
                    {step.id}
                  </span>

                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs hover:border-teal-200 transition-all">
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-teal-50 text-teal-600 rounded-full">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <h4 className="font-semibold text-slate-700 text-xs group-hover:text-teal-700 transition-colors">
                          {step.title}
                        </h4>
                      </div>
                      <Badge variant="outline" className={`text-[9px] uppercase tracking-wider rounded-full px-2.5 py-0.5 ${step.badgeColor || "bg-slate-50 text-slate-500 border-slate-200"}`}>
                        {step.badge}
                      </Badge>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed font-sans">{step.desc}</p>
                    
                    <div className="mt-2.5 pt-2 border-t border-dashed border-slate-100 flex items-center gap-1.5 text-[9px] text-slate-400 font-mono">
                      <Database className="w-3.5 h-3.5 text-teal-500" />
                      <span>DB: {step.dbChange}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Visual Schematic Diagram Card */}
        <div className="lg:sticky lg:top-6 space-y-6">
          <Card className="bg-white border border-slate-100 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-50 px-6 pt-5">
              <span className="text-[9px] tracking-[0.08em] uppercase font-bold text-slate-400 block">Security Schematic</span>
              <CardTitle className="text-md font-bold text-slate-800 flex items-center gap-2 font-sans">
                <Database className="w-5 h-5 text-teal-600" />
                Access Control & ID Assignment State Machine
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 font-sans mt-0.5">
                How Supabase RLS authorization IDs transition for temporary worker accounts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-6 py-5">
              {/* Infographic Schematic */}
              <div className="flex flex-col gap-4">
                {/* 1. Pool State */}
                <div className="p-4 bg-teal-50/30 rounded-2xl border border-teal-100 text-center relative">
                  <div className="font-bold text-teal-900 text-xs uppercase tracking-wider">Available Staff Pool</div>
                  <div className="text-[10px] text-teal-700 mt-1 font-mono">agency_staff.status = 'available'</div>
                  <div className="mt-2 text-[9px] font-mono bg-white py-1 px-2.5 rounded-full inline-block border border-teal-100 text-slate-650">
                    organization_id = NULL | carehome_id = NULL | team_id = NULL
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 font-sans font-medium">No access to CareO records</div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center text-slate-300">
                  <ChevronRight className="w-5 h-5 rotate-90" />
                </div>

                {/* 2. Onboarding State */}
                <div className="p-4 bg-amber-50/30 rounded-2xl border border-amber-100 text-center relative">
                  <div className="font-bold text-amber-900 text-xs uppercase tracking-wider">Onboarding Activation</div>
                  <div className="text-[10px] text-amber-800 mt-1 font-sans font-medium">Worker clicks activation token link</div>
                  <div className="mt-2 text-[9px] font-mono bg-white/70 py-1 px-2 rounded inline-block border border-amber-50/70 text-slate-600">
                    Creates public.users row + upsert in team_staff
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Auth sync trigger binds active IDs</div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center text-slate-300">
                  <ChevronRight className="w-5 h-5 rotate-90" />
                </div>

                {/* 3. Active Shift State */}
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center relative shadow-sm">
                  <div className="font-bold text-emerald-900 text-sm flex items-center justify-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    Active Assignment State
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-1 font-semibold">Authorized in CareO RLS policies</div>
                  <div className="mt-2 text-[10px] font-mono bg-white py-1 px-3 rounded inline-block border border-emerald-100 font-semibold text-emerald-800">
                    organization_id = ACTIVE | carehome_id = ACTIVE | team_id = ACTIVE
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                    Allowed to record eMAR sheets, log food/fluid counts, and write handover logs.
                  </p>
                </div>

                {/* Arrow */}
                <div className="flex justify-center text-slate-300">
                  <ChevronRight className="w-5 h-5 rotate-90 text-red-400" />
                </div>

                {/* 4. Offboarding State */}
                <div className="p-4 bg-red-50/50 rounded-xl border border-red-100 text-center relative">
                  <div className="font-bold text-red-900 text-sm">Offboarding / Revocation</div>
                  <div className="text-[11px] text-red-700 mt-1">Shift Ends. CareO Manager clicks 'Offboard'</div>
                  <div className="mt-2 text-[10px] font-mono bg-white/70 py-1 px-2 rounded inline-block border border-red-50/70 text-slate-600">
                    active_organization_id = NULL | active_care_home_id = NULL | active_team_id = NULL
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Worker record deleted from team_staff list</div>
                </div>

                {/* Loop Arrow */}
                <div className="flex justify-center text-slate-300">
                  <ChevronRight className="w-5 h-5 rotate-90" />
                </div>

                {/* Back to pool */}
                <div className="text-center text-xs text-slate-500 font-semibold flex items-center justify-center gap-1">
                  <RotateCcw className="w-3.5 h-3.5 text-teal-600 animate-spin-slow" />
                  Returned to Available Staff Pool
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
