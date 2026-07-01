import { NextRequest, NextResponse } from "next/server";
import { list } from "@vercel/blob";

export const dynamic = "force-dynamic";

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";

function getIssueNumber() {
  return Math.floor((Date.now() - new Date("2024-01-01").getTime()) / (7 * 24 * 60 * 60 * 1000));
}

// GET: fetch latest or specific issue
export async function GET(request: NextRequest) {
  const issueParam = request.nextUrl.searchParams.get("issue");
  const issueNumber = issueParam ? parseInt(issueParam) : getIssueNumber();

  if (!BLOB_TOKEN) {
    return NextResponse.json({ error: "No blob storage configured" }, { status: 500 });
  }

  try {
    const { blobs } = await list({ prefix: `newsletters/issue-${issueNumber}`, token: BLOB_TOKEN });
    if (blobs.length === 0) {
      return NextResponse.json({ status: "not_found", issueNumber });
    }

    const res = await fetch(blobs[0].downloadUrl, {
      headers: { Authorization: `Bearer ${BLOB_TOKEN}` },
    });
    if (!res.ok) {
      return NextResponse.json({ status: "not_found", issueNumber });
    }

    const data = await res.json();
    return NextResponse.json({ status: "found", ...data });
  } catch {
    return NextResponse.json({ error: "Failed to fetch issue" }, { status: 500 });
  }
}
