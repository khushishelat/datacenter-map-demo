import { NextRequest, NextResponse } from "next/server";
import { list, put } from "@vercel/blob";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const API_KEY = process.env.PARALLEL_API_KEY || "";
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";
const RESEND_KEY = process.env.RESEND_API_KEY || "";
const BASE_URL = "https://api.parallel.ai";

function getIssueNumber() {
  return Math.floor((Date.now() - new Date("2024-01-01").getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function markdownToEmailHtml(md: string): string {
  let html = md;
  html = html.replace(/&/g, "&amp;");
  const refSection = html.split("## References");
  if (refSection.length > 1) {
    const refs: Record<string, { title: string; url: string }> = {};
    for (const line of refSection[1].split("\n")) {
      const m = line.match(/^(\d+)\.\s+\*(.+?)\*\.\s+(https?:\/\/\S+)/);
      if (m) refs[m[1]] = { title: m[2], url: m[3] };
    }
    html = refSection[0];
    html = html.replace(/\[(\d+)\]/g, (_, num) => {
      const ref = refs[num];
      if (ref) { const domain = ref.url.split("/")[2]?.replace("www.", "").split(".")[0] || "source"; return `(<a href="${ref.url}" style="color:#FB631B">${domain}</a>)`; }
      return `[${num}]`;
    });
  }
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:15px;font-weight:500;color:#1D1B16;margin:18px 0 6px">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:17px;font-weight:500;color:#1D1B16;margin:24px 0 8px;padding-bottom:5px;border-bottom:1px solid #E5E5E5">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:20px;font-weight:500;color:#1D1B16;margin:28px 0 10px">$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#1D1B16;font-weight:500">$1</strong>');
  html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em style="color:#858483">$1</em>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#FB631B;text-decoration:none">$1</a>');
  html = html.replace(/^- (.+)$/gm, '<li style="font-size:14px;line-height:22px;color:#5C5B59;margin-bottom:4px">$1</li>');
  html = html.replace(/((?:<li[^>]*>.*?<\/li>\n?)+)/g, '<ul style="padding-left:18px;margin:0 0 12px">$1</ul>');
  html = html.replace(/\n\n/g, '</p><p style="font-size:14px;line-height:22px;color:#5C5B59;margin:0 0 10px">');
  html = html.replace(/\n/g, "<br>");
  html = '<p style="font-size:14px;line-height:22px;color:#5C5B59;margin:0 0 10px">' + html + "</p>";
  const issueNumber = getIssueNumber();
  return `<div style="max-width:644px;margin:0 auto;background:#fff;font-family:'Helvetica Neue',Arial,sans-serif"><div style="padding:28px 30px 18px;border-bottom:1px solid #E5E5E5;background:#FCFBFA"><div style="font-family:'Courier New',monospace;font-weight:700;font-size:18px;color:#1D1B16;margin-bottom:14px">parallel</div><div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-family:'Courier New',monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#1D1B16">Datacenter Signal</span><span style="font-family:'Courier New',monospace;font-size:9px;color:#A6A5A4">Issue ${issueNumber}</span></div></div><div style="padding:24px 30px">${html}</div><div style="padding:24px 30px;background:#FCFBFA;border-top:1px solid #E5E5E5"><div style="font-family:'Courier New',monospace;font-weight:700;font-size:13px;color:#1D1B16;opacity:0.6;margin-bottom:8px">parallel</div><div style="font-family:'Courier New',monospace;font-size:9px;color:#A6A5A4">hello@parallel.ai · Palo Alto, CA · <a href="#" style="color:#A6A5A4">Unsubscribe</a></div></div></div>`;
}

// GET: fetch latest issue — if generating, check task status and finalize
export async function GET(request: NextRequest) {
  const issueParam = request.nextUrl.searchParams.get("issue");
  const issueNumber = issueParam ? parseInt(issueParam) : getIssueNumber();

  if (!BLOB_TOKEN) return NextResponse.json({ status: "not_found", issueNumber });

  try {
    const { blobs } = await list({ prefix: `newsletters/issue-${issueNumber}`, token: BLOB_TOKEN });
    if (blobs.length === 0) return NextResponse.json({ status: "not_found", issueNumber });

    const res = await fetch(blobs[0].downloadUrl, { headers: { Authorization: `Bearer ${BLOB_TOKEN}` } });
    if (!res.ok) return NextResponse.json({ status: "not_found", issueNumber });

    const data = await res.json();

    // Already complete
    if (data.content) return NextResponse.json({ ...data, status: "found" });

    // Still generating — check task status
    if (data.runId && data.status === "generating" && API_KEY) {
      const statusRes = await fetch(`${BASE_URL}/v1/tasks/runs/${data.runId}`, { headers: { "x-api-key": API_KEY } });
      if (statusRes.ok) {
        const statusData = await statusRes.json();

        if (statusData.status === "completed") {
          // Fetch result, finalize, save, and send emails
          const resultRes = await fetch(`${BASE_URL}/v1/tasks/runs/${data.runId}/result`, { headers: { "x-api-key": API_KEY } });
          if (resultRes.ok) {
            const result = await resultRes.json();
            const content = result.output?.content || "";
            const emailHtml = markdownToEmailHtml(content);

            const issueData = {
              ...data, content, emailHtml, generatedAt: new Date().toISOString(), status: "completed",
            };

            await put(`newsletters/issue-${issueNumber}.json`, JSON.stringify(issueData), {
              access: "private", allowOverwrite: true, contentType: "application/json", token: BLOB_TOKEN,
            });

            // Send emails
            if (RESEND_KEY) {
              try {
                const subRes = await fetch(blobs.find(b => b.pathname === "newsletters/subscribers.json")?.downloadUrl || "", {
                  headers: { Authorization: `Bearer ${BLOB_TOKEN}` },
                });
                if (subRes.ok) {
                  const subData = await subRes.json();
                  const resend = new Resend(RESEND_KEY);
                  for (const sub of subData.subscribers || []) {
                    try {
                      await resend.emails.send({
                        from: "Datacenter Signal <onboarding@resend.dev>",
                        to: sub.email,
                        subject: `Datacenter Signal — Issue ${issueNumber}`,
                        html: emailHtml,
                      });
                    } catch {}
                  }
                }
              } catch {}
            }

            return NextResponse.json({ ...issueData, status: "found" });
          }
        }

        return NextResponse.json({ status: "generating", issueNumber, runId: data.runId });
      }
    }

    return NextResponse.json({ status: "generating", issueNumber });
  } catch {
    return NextResponse.json({ status: "not_found", issueNumber });
  }
}
