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

/**
 * Checks if an agency name already exists in the agency_staff database table.
 * It uses ILIKE for case-insensitive matching.
 */
export async function checkAgencyNameExists(agencyName: string, excludeSupervisorId?: string) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    
    let query = supabaseAdmin
      .from("agency_staff")
      .select("id")
      .ilike("agency_name", agencyName.trim());

    if (excludeSupervisorId) {
      query = query.neq("id", excludeSupervisorId);
    }

    const { data, error } = await query.limit(1);

    if (error) throw error;
    return { exists: (data && data.length > 0) || false };
  } catch (error: any) {
    console.error("Error checking agency name existence:", error);
    return { error: error.message || "Failed to check agency name" };
  }
}

/**
 * Diagnoses why a care home link code failed to retrieve a care home on the client.
 * Differentiates between missing records and Row-Level Security (RLS) blockage.
 */
export async function diagnoseLinkCode(linkCode: string) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    
    // Fetch using high-privilege admin client to bypass RLS
    const { data: home, error } = await supabaseAdmin
      .from("care_homes")
      .select("id, name")
      .eq("agency_link_code", linkCode)
      .maybeSingle();

    if (error) throw error;
    return { found: !!home, homeName: home?.name || null };
  } catch (error: any) {
    console.error("Error diagnosing link code:", error);
    return { error: error.message || "Failed to query care homes via admin client" };
  }
}

