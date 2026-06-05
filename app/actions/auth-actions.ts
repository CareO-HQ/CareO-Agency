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

// Helper to initialize a user-scoped Supabase client on the server
function getSupabaseClientForToken(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing Supabase env configuration for server actions");
  }
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

/**
 * Creates a supervisor profile in public.agency_staff table.
 * Verified against authUserId to ensure authenticity.
 */
export async function createSupervisorProfile(data: {
  authUserId: string;
  email: string;
  name: string;
  phone?: string;
  agencyName: string;
}) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { authUserId, email, name, phone, agencyName } = data;

    if (!authUserId || !email || !name || !agencyName) {
      throw new Error("Required fields are missing.");
    }

    // 1. Verify auth user exists in auth.users
    const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(authUserId);
    if (authUserError || !authUser?.user) {
      throw new Error("Auth user does not exist.");
    }

    // 2. Verify email matches
    if (authUser.user.email?.toLowerCase() !== email.trim().toLowerCase()) {
      throw new Error("Unauthorized: Email mismatch.");
    }

    // 3. Verify profile does not already exist
    const { data: existingProfile, error: checkError } = await supabaseAdmin
      .from("agency_staff")
      .select("id")
      .eq("email", email.trim())
      .maybeSingle();

    if (existingProfile) {
      // Profile already exists, return success to be idempotent
      return { success: true, message: "Profile already exists." };
    }

    // 4. Insert supervisor profile
    const { error: dbError } = await supabaseAdmin
      .from("agency_staff")
      .insert({
        auth_user_id: authUserId,
        email: email.trim(),
        name: name,
        role: "supervisor",
        phone: phone,
        status: "available",
        agency_name: agencyName.trim(),
        skills: ["Personal Care", "Daily Living Help"],
        certifications: ["NVQ Level 2"],
        compliance_documents: [
          { type: "DBS Check", status: "verified", date: new Date().toISOString() },
          { type: "Right to Work", status: "verified", date: new Date().toISOString() }
        ]
      });

    if (dbError) throw dbError;

    return { success: true };
  } catch (error: any) {
    console.error("Error in createSupervisorProfile Server Action:", error);
    return { success: false, error: error.message || "Failed to create supervisor profile." };
  }
}

/**
 * Creates both auth credentials and agency staff profile on the server.
 * Bypasses database RLS securely after validating caller's supervisor session token.
 */
export async function createAgencyStaff(data: {
  token: string;
  name: string;
  email: string;
  role: "nurse" | "care_assistant";
  password?: string;
  phone?: string;
  skills?: string[];
  certifications?: string[];
  supervisorId: string;
  agencyName: string;
}) {
  try {
    const { token, name, email, role, password, phone, skills, certifications, supervisorId, agencyName } = data;

    if (!token) {
      throw new Error("Unauthorized: Token is missing.");
    }

    // 1. Verify caller session using user client
    const userClient = getSupabaseClientForToken(token);
    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      throw new Error("Unauthorized: Invalid session.");
    }

    // 2. Verify caller is a supervisor or saas_admin
    const isSupervisor = user.app_metadata?.is_agency_staff && user.app_metadata?.role === 'supervisor';
    const isSaaSAdmin = user.app_metadata?.is_saas_admin || user.app_metadata?.role === 'saas_admin';
    if (!isSupervisor && !isSaaSAdmin) {
      throw new Error("Forbidden: Only supervisors or SaaS admins can add staff.");
    }

    // 3. Create the auth user first
    const supabaseAdmin = getSupabaseAdmin();
    const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
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

    if (createAuthError) throw createAuthError;
    if (!authData?.user) {
      throw new Error("Failed to create auth credentials.");
    }

    // 4. Insert profile row with auth_user_id set directly
    const { error: dbError } = await supabaseAdmin
      .from("agency_staff")
      .insert({
        auth_user_id: authData.user.id,
        email: email.trim(),
        name,
        role,
        phone,
        status: "available",
        skills: skills || [],
        certifications: certifications || [],
        supervisor_id: supervisorId,
        agency_name: agencyName,
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

    if (dbError) {
      // Rollback auth user if profile insert failed to maintain consistency
      try {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      } catch (delErr) {
        console.error("Failed to delete orphaned user on rollback:", delErr);
      }
      throw dbError;
    }

    return { success: true, userId: authData.user.id };
  } catch (error: any) {
    console.error("Error in createAgencyStaff Server Action:", error);
    return { success: false, error: error.message || "Failed to create staff member." };
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

/**
 * Permanently deletes an agency staff member.
 * Removes auth user, agency_staff row (which cascade-deletes agency_requests, agency_shifts).
 * Caller must be a supervisor.
 */
export async function deleteAgencyStaff(data: {
  token: string;
  staffId: string;
}) {
  try {
    const { token, staffId } = data;

    if (!token || !staffId) {
      throw new Error("Unauthorized: Token and staffId are required.");
    }

    // 1. Verify caller session
    const userClient = getSupabaseClientForToken(token);
    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      throw new Error("Unauthorized: Invalid session.");
    }

    // 2. Verify caller is a supervisor or saas_admin
    const isSupervisor = user.app_metadata?.is_agency_staff && user.app_metadata?.role === 'supervisor';
    const isSaaSAdmin = user.app_metadata?.is_saas_admin || user.app_metadata?.role === 'saas_admin';
    if (!isSupervisor && !isSaaSAdmin) {
      throw new Error("Forbidden: Only supervisors or SaaS admins can delete staff.");
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 3. Fetch the staff record to get auth_user_id
    const { data: staffRecord, error: fetchError } = await supabaseAdmin
      .from("agency_staff")
      .select("id, auth_user_id, email, name")
      .eq("id", staffId)
      .single();

    if (fetchError || !staffRecord) {
      throw new Error("Staff member not found.");
    }

    // 4. If the staff member has an auth account, sign them out and delete the auth user
    if (staffRecord.auth_user_id) {
      // Force sign-out all sessions
      try {
        await supabaseAdmin.auth.admin.signOut(staffRecord.auth_user_id, "global");
      } catch (signOutErr) {
        console.warn("Could not sign out user (may already be signed out):", signOutErr);
      }

      // Delete auth user
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(staffRecord.auth_user_id);
      if (deleteAuthError) {
        console.error("Failed to delete auth user:", deleteAuthError);
        throw new Error("Failed to delete staff auth account.");
      }
    }

    // 5. Delete the agency_staff row (cascade-deletes agency_requests and agency_shifts)
    const { error: deleteError } = await supabaseAdmin
      .from("agency_staff")
      .delete()
      .eq("id", staffId);

    if (deleteError) throw deleteError;

    return { success: true };
  } catch (error: any) {
    console.error("Error in deleteAgencyStaff Server Action:", error);
    return { success: false, error: error.message || "Failed to delete staff member." };
  }
}

