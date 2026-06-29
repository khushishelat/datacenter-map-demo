import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Cache the full enrichments in memory after first fetch
let cachedEnrichments: Record<string, unknown> | null = null;

async function loadEnrichments(): Promise<Record<string, unknown>> {
  if (cachedEnrichments) return cachedEnrichments;

  const blobUrl = process.env.ENRICHMENTS_BLOB_URL;

  if (blobUrl) {
    // Production: fetch from Vercel Blob
    const res = await fetch(blobUrl, { cache: "no-store" });
    if (res.ok) {
      cachedEnrichments = await res.json();
      return cachedEnrichments!;
    }
  }

  // Dev fallback: read from local file
  try {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "public/data/enrichments.json");
    if (fs.existsSync(filePath)) {
      cachedEnrichments = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return cachedEnrichments!;
    }
  } catch {
    // Not available
  }

  return {};
}

export async function GET(request: NextRequest) {
  const facilityIndex = request.nextUrl.searchParams.get("facility");
  const field = request.nextUrl.searchParams.get("field");

  if (!facilityIndex) {
    return NextResponse.json({ error: "Missing facility param" }, { status: 400 });
  }

  const enrichments = await loadEnrichments();
  const entry = enrichments[facilityIndex] as {
    enrichment?: Record<string, unknown>;
    basis?: { field?: string; reasoning?: string; citations?: { url?: string; title?: string; excerpts?: string[] }[] }[];
  } | undefined;

  if (!entry) {
    return NextResponse.json({ citations: [], reasoning: "" });
  }

  const basis = entry.basis || [];

  // If a specific field is requested, filter basis to that field
  if (field) {
    const fieldBasis = basis.filter((b) => b.field === field);
    const reasoning = fieldBasis[0]?.reasoning || "";
    const citations = fieldBasis.flatMap((b) =>
      (b.citations || []).map((c) => ({
        field: b.field || "",
        url: c.url || "",
        title: c.title || "Source",
        excerpts: c.excerpts || [],
      }))
    );

    return NextResponse.json({ citations, reasoning });
  }

  // Return all basis for this facility
  const citations = basis.flatMap((b) =>
    (b.citations || []).map((c) => ({
      field: b.field || "",
      url: c.url || "",
      title: c.title || "Source",
    }))
  );
  const reasoning: Record<string, string> = {};
  for (const b of basis) {
    if (b.field && b.reasoning) reasoning[b.field] = b.reasoning;
  }

  return NextResponse.json({ citations, reasoning });
}
