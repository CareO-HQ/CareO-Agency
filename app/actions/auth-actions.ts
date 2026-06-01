"use server";

import { createClient } from "@supabase/supabase-js";

// Helper to initialize the Supabase Admin Client using service role key
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase env configuration for server actions");
  }
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function createAgencyStaffAuthOnly(data: {
  name: string;
  email: string;
  role: "supervisor" | "nurse" | "care_assistant";
  password?: string;
}) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { name, email, role, password } = data;

    if (!email || !password) {
      throw new Error("Email and password are required.");
    }

    // Create auth user with metadata using the admin client (which handles auth.users)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role,
        is_agency_staff: true,
      },
      app_metadata: {
        role,
        is_agency_staff: true,
      }
    });

    if (authError) throw authError;
    if (!authData?.user) {
      throw new Error("Failed to create auth user.");
    }

    return { success: true, userId: authData.user.id };
  } catch (error: any) {
    console.error("Error in createAgencyStaffAuthOnly server action:", error);
    return { success: false, error: error.message || "Failed to create staff auth account" };
  }
}
