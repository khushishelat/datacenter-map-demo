import { NextRequest, NextResponse } from "next/server";
import { put, list } from "@vercel/blob";

export const dynamic = "force-dynamic";

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";

interface Subscriber {
  email: string;
  subscribedAt: string;
}

async function getSubscribers(): Promise<Subscriber[]> {
  if (!BLOB_TOKEN) return [];
  try {
    const { blobs } = await list({ prefix: "newsletters/", token: BLOB_TOKEN });
    const subBlob = blobs.find((b) => b.pathname === "newsletters/subscribers.json");
    if (!subBlob) return [];
    const res = await fetch(subBlob.downloadUrl, {
      headers: { Authorization: `Bearer ${BLOB_TOKEN}` },
    });
    if (res.ok) {
      const data = await res.json();
      return data.subscribers || [];
    }
  } catch {}
  return [];
}

async function saveSubscribers(subscribers: Subscriber[]) {
  if (!BLOB_TOKEN) return;
  await put("newsletters/subscribers.json", JSON.stringify({ subscribers }), {
    access: "private",
    allowOverwrite: true,
    contentType: "application/json",
    token: BLOB_TOKEN,
  });
}

// POST: subscribe
export async function POST(request: NextRequest) {
  const { email } = await request.json();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const subscribers = await getSubscribers();
  if (subscribers.some((s) => s.email === email)) {
    return NextResponse.json({ status: "already_subscribed", email });
  }

  subscribers.push({ email, subscribedAt: new Date().toISOString() });
  await saveSubscribers(subscribers);

  return NextResponse.json({ status: "subscribed", email });
}

// DELETE: unsubscribe
export async function DELETE(request: NextRequest) {
  const { email } = await request.json();
  const subscribers = await getSubscribers();
  const filtered = subscribers.filter((s) => s.email !== email);
  await saveSubscribers(filtered);
  return NextResponse.json({ status: "unsubscribed" });
}

// GET: list subscribers + check status
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  const subscribers = await getSubscribers();

  if (email) {
    const sub = subscribers.find((s) => s.email === email);
    return NextResponse.json({ subscribed: !!sub, email });
  }

  return NextResponse.json({ subscribers, count: subscribers.length });
}
