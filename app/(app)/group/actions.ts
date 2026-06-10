"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function promoteAction(
  groupId: string,
  userId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("promote_member", {
    target_group_id: groupId,
    target_user_id: userId,
  });
  if (error) return { error: error.message };
  revalidatePath("/group");
  return { ok: true };
}

export async function removeAction(
  groupId: string,
  userId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", {
    target_group_id: groupId,
    target_user_id: userId,
  });
  if (error) return { error: error.message };
  revalidatePath("/group");
  return { ok: true };
}

export async function resetCodeAction(
  groupId: string,
): Promise<{ ok: true; code: string } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reset_invite_code", {
    target_group_id: groupId,
  });
  if (error) return { error: error.message };
  revalidatePath("/group");
  return { ok: true, code: data as string };
}

export async function renameGroupAction(
  groupId: string,
  name: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rename_group", {
    target_group_id: groupId,
    new_name: name,
  });
  if (error) return { error: error.message };
  revalidatePath("/group");
  revalidatePath("/");
  return { ok: true };
}

export async function updateMyDisplayNameAction(
  groupId: string,
  name: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_display_name", {
    target_group_id: groupId,
    new_display_name: name,
  });
  if (error) return { error: error.message };
  // Best-effort: mirror into auth metadata so future bracket joins default
  // to the new name (signup stores it there; onboarding reads it back).
  await supabase.auth.updateUser({ data: { display_name: name } });
  revalidatePath("/group");
  return { ok: true };
}

export async function leaveGroupAction(
  groupId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_group", {
    target_group_id: groupId,
  });
  if (error) return { error: error.message };
  redirect("/onboarding");
}

export async function deleteGroupAction(
  groupId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_group", {
    target_group_id: groupId,
  });
  if (error) return { error: error.message };
  redirect("/onboarding");
}
