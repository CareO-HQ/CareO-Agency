"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Mail, Lock, User, Phone, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function AuthScreen({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const role: "supervisor" | "nurse" | "care_assistant" = "supervisor";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        // Sign In
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Successfully logged in!");
        onAuthSuccess();
      } else {
        // Sign Up
        if (!name) {
          toast.error("Please enter your name.");
          setLoading(false);
          return;
        }

        // 1. Create auth user with metadata (client-side signup)
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              role,
              is_agency_staff: true,
            },
          },
        });

        if (authError) throw authError;

        if (authData?.user) {
          // 2. Insert into public.agency_staff (client-side insert under RLS)
          const { error: dbError } = await supabase
            .from("agency_staff")
            .insert({
              auth_user_id: authData.user.id,
              email: email,
              name: name,
              role: role,
              phone: phone,
              status: "available",
              skills: (role as string) === "nurse" ? ["Clinical Care", "Meds Administration"] : ["Personal Care", "Daily Living Help"],
              certifications: (role as string) === "nurse" ? ["NMC Registration"] : ["NVQ Level 2"],
              compliance_documents: [
                { type: "DBS Check", status: "verified", date: new Date().toISOString() },
                { type: "Right to Work", status: "verified", date: new Date().toISOString() }
              ]
            });

          if (dbError) {
            console.error("Failed to insert staff profile:", dbError);
            toast.warning("Auth account created, but profile setup failed. Contact admin.");
          } else {
            toast.success("Account registered successfully!");
          }
          
          setIsLogin(true);
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 custom-gradient-bg font-sans">
      <div className="w-full max-w-md">
        {/* Portal Branding */}
        <div className="text-center mb-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-600 text-white shadow-md mb-4">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <span className="text-[10px] tracking-[0.12em] uppercase font-bold text-teal-600 block mb-1">Staffing Operations</span>
          <h2 className="text-3.5xl font-extrabold text-slate-850 tracking-tight">
            CareO Agency
          </h2>
          <p className="text-slate-500 text-xs mt-1">Premium Shift & Staff Coordination</p>
        </div>

        <Card className="glass-card shadow-lg border border-slate-100 rounded-3xl overflow-hidden bg-white/95">
          <CardHeader className="pt-8 pb-4">
            <CardTitle className="text-2xl text-center font-bold text-slate-800">
              {isLogin ? "Sign In to Portal" : "Register Supervisor Account"}
            </CardTitle>
            <CardDescription className="text-center text-xs text-slate-500 mt-1">
              {isLogin ? "Enter your credentials to access your dashboard" : "Create a new supervisor account"}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 px-8 pb-6">
              {/* Name field for Signup */}
              {!isLogin && (
                <div className="space-y-1">
                  <Label htmlFor="name" className="text-[11px] tracking-[0.05em] uppercase font-bold text-slate-600">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="name"
                      placeholder="Jane Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 bg-slate-50/50 rounded-full h-10 border-slate-200 focus:bg-white text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              <div className="space-y-1">
                <Label htmlFor="email" className="text-[11px] tracking-[0.05em] uppercase font-bold text-slate-600">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@agency.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-slate-50/50 rounded-full h-10 border-slate-200 focus:bg-white text-xs"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <Label htmlFor="password" className="text-[11px] tracking-[0.05em] uppercase font-bold text-slate-600">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-slate-50/50 rounded-full h-10 border-slate-200 focus:bg-white text-xs"
                  />
                </div>
              </div>

              {/* Phone field for Signup */}
              {!isLogin && (
                <div className="space-y-1">
                  <Label htmlFor="phone" className="text-[11px] tracking-[0.05em] uppercase font-bold text-slate-600">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="phone"
                      placeholder="+44 7700 900077"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-10 bg-slate-50/50 rounded-full h-10 border-slate-200 focus:bg-white text-xs"
                    />
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-3 px-8 pb-8 pt-2">
              <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium h-10 text-xs rounded-full" disabled={loading}>
                {loading ? "Authenticating..." : isLogin ? "Sign In" : "Register Supervisor"}
              </Button>

              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-[11px] text-teal-600 hover:underline mt-1 font-semibold tracking-wide uppercase"
              >
                {isLogin ? "Register a new Supervisor account" : "Already have an account? Sign in"}
              </button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
