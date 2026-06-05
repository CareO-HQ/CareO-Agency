"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Mail, Lock, User, Phone, Building, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { checkAgencyNameExists, createSupervisorProfile } from "@/app/actions/auth-actions";
import Image from "next/image";
import Link from "next/link";

export default function AuthScreen({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [agencyName, setAgencyName] = useState("");
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

        if (!agencyName.trim()) {
          toast.error("Please enter an agency name.");
          setLoading(false);
          return;
        }

        // Check if agency name is already taken
        const checkRes = await checkAgencyNameExists(agencyName);
        if (checkRes.error) {
          toast.error(checkRes.error);
          setLoading(false);
          return;
        }
        if (checkRes.exists) {
          toast.error("An agency with this name already exists. Please choose a different name.");
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
              agency_name: agencyName.trim(),
            },
          },
        });

        if (authError) throw authError;

        if (authData?.user) {
          // 2. Insert into public.agency_staff (via Server Action to bypass client RLS issues)
          const dbRes = await createSupervisorProfile({
            authUserId: authData.user.id,
            email: email,
            name: name,
            phone: phone,
            agencyName: agencyName.trim()
          });

          if (!dbRes.success) {
            console.error("Failed to insert staff profile:", dbRes.error);
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
    <div className="grid lg:grid-cols-2 min-h-screen w-full relative bg-white">
      {/* Helpline Button - Fixed Top Right */}
      <div className="fixed top-4 right-4 z-50">
        <Link href="https://wa.me/447741068115" target="_blank" rel="noopener noreferrer">
          <Button variant="secondary" size="sm" className="gap-2">
            <MessageCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Helpline 24x7</span>
            <span className="sm:hidden">24x7</span>
          </Button>
        </Link>
      </div>

      {/* Left Panel - White Background with Image and Testimonial (Desktop Only) */}
      <div className="hidden lg:flex flex-col items-center justify-center bg-white p-12 relative space-y-12">
        {/* Center Image */}
        <div className="flex items-center justify-center w-full">
          <div className="relative w-96 h-96">
            <Image
              src="/careo_agency_login.jpg"
              alt="Healthcare Management"
              fill
              className="object-contain rounded-lg"
              priority
            />
          </div>
        </div>

        {/* Testimonial in middle */}
        <div className="space-y-4 max-w-sm text-center mx-auto">
          <blockquote className="text-lg leading-relaxed text-slate-800 italic font-medium">
            &quot;An empathy driven tool for care teams, peace of mind a few clicks away&quot;
          </blockquote>
          <p className="text-sm text-slate-500 font-semibold uppercase tracking-wider">
            - Team CareO
          </p>
        </div>
      </div>

      {/* Right Panel - Login/Register Form */}
      <div className="flex flex-col justify-center items-center p-6 sm:p-12 bg-white min-h-screen">
        <div className="w-full max-w-md space-y-6 sm:space-y-8">
          {/* Mobile Logo and Image */}
          <div className="lg:hidden space-y-6">
            {/* Logo */}
            <div className="flex items-center justify-center gap-2">
              <div className="h-9 w-9 bg-teal-600 text-white rounded-full flex items-center justify-center shadow-md">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800 text-lg tracking-wide">
                  CareO Agency
                </h2>
                <span className="text-[8px] text-teal-600 font-bold tracking-[0.1em] uppercase block -mt-0.5">Staffing Operations</span>
              </div>
            </div>

            {/* Mobile Image */}
            <div className="flex items-center justify-center">
              <div className="relative w-48 h-48">
                <Image
                  src="/careo_agency_login.jpg"
                  alt="Healthcare Management"
                  fill
                  className="object-contain rounded-lg"
                  priority
                />
              </div>
            </div>

            {/* Mobile Testimonial */}
            <div className="space-y-2 text-center px-4 max-w-sm mx-auto">
              <p className="text-sm leading-relaxed text-slate-700 italic">
                &quot;An empathy driven tool for care teams, peace of mind a few clicks away&quot;
              </p>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                - Team CareO
              </p>
            </div>
          </div>

          {/* Desktop Logo */}
          <div className="hidden lg:flex items-center justify-center gap-3">
            <div className="h-12 w-12 bg-teal-600 text-white rounded-full flex items-center justify-center shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-2xl tracking-wide">
                CareO Agency
              </h2>
              <span className="text-[9px] text-teal-600 font-bold tracking-[0.1em] uppercase block -mt-0.5">Staffing Operations</span>
            </div>
          </div>

          {/* Header */}
          <div className="space-y-2 text-center">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-850 tracking-tight">
              {isLogin ? "Sign In to Portal" : "Register Supervisor Account"}
            </h1>
            <p className="text-sm text-slate-500">
              {isLogin ? "Enter your credentials to access your dashboard" : "Create a new supervisor account"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name field for Signup */}
            {!isLogin && (
              <div className="space-y-1">
                <Label htmlFor="name" className="text-[11px] tracking-[0.05em] uppercase font-bold text-slate-650">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="name"
                    placeholder="Jane Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 bg-slate-50/50 rounded-full h-10 border-slate-200 focus:bg-white text-xs focus-visible:ring-teal-600"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div className="space-y-1">
              <Label htmlFor="email" className="text-[11px] tracking-[0.05em] uppercase font-bold text-slate-655">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="email@agency.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-slate-50/50 rounded-full h-10 border-slate-200 focus:bg-white text-xs focus-visible:ring-teal-600"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <Label htmlFor="password" className="text-[11px] tracking-[0.05em] uppercase font-bold text-slate-655">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-slate-50/50 rounded-full h-10 border-slate-200 focus:bg-white text-xs focus-visible:ring-teal-600"
                />
              </div>
            </div>

            {/* Agency Name field for Signup */}
            {!isLogin && (
              <div className="space-y-1">
                <Label htmlFor="agencyName" className="text-[11px] tracking-[0.05em] uppercase font-bold text-slate-655">Staffing Agency Name *</Label>
                <div className="relative">
                  <Building className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="agencyName"
                    placeholder="e.g. Care Agency Co."
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    className="pl-10 bg-slate-50/50 rounded-full h-10 border-slate-200 focus:bg-white text-xs focus-visible:ring-teal-600"
                    required
                  />
                </div>
              </div>
            )}

            {/* Phone field for Signup */}
            {!isLogin && (
              <div className="space-y-1">
                <Label htmlFor="phone" className="text-[11px] tracking-[0.05em] uppercase font-bold text-slate-655">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="phone"
                    placeholder="+44 7700 900077"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10 bg-slate-50/50 rounded-full h-10 border-slate-200 focus:bg-white text-xs focus-visible:ring-teal-600"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-4">
              <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold h-10 text-xs rounded-full shadow-sm" disabled={loading}>
                {loading ? "Authenticating..." : isLogin ? "Sign In" : "Register Supervisor"}
              </Button>

              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-[11px] text-teal-650 hover:underline mt-1 font-bold tracking-wide uppercase text-center"
              >
                {isLogin ? "Register a new Supervisor account" : "Already have an account? Sign in"}
              </button>
            </div>
          </form>

          {/* Footer Links */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 text-xs text-slate-400 pt-4 sm:pt-8">
            <span className="hover:text-slate-600 cursor-pointer hover:underline">
              Terms of Service
            </span>
            <span>•</span>
            <span className="hover:text-slate-600 cursor-pointer hover:underline">
              Privacy Policy
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
