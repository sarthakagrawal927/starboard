import { auth } from "@/lib/auth";
import { fetchAllStarredRepos } from "@/lib/github";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const repos = await fetchAllStarredRepos(session.accessToken);
    return NextResponse.json(repos);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch stars" }, { status: 500 });
  }
}
