import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { email, password, role } = await req.json();

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ user: data.user });
}