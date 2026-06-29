import { NextRequest, NextResponse } from "next/server";

/**
 * Webhook endpoint for Parallel Monitor API events.
 *
 * When a monitor detects a new event, Parallel POSTs here.
 * We store the event in memory (for demo) so the frontend
 * can pick it up without polling the Parallel API.
 *
 * For production: use a database or Redis.
 * For this demo: in-memory store + Server-Sent Events to push to clients.
 */

export interface WebhookEvent {
  monitorId: string;
  eventId: string;
  eventDate: string;
  type: string;
  content: unknown;
  receivedAt: string;
}

// In-memory event store (resets on deploy/restart — fine for demo)
const recentEvents: WebhookEvent[] = [];
const MAX_EVENTS = 500;

// SSE clients waiting for updates
const clients = new Set<ReadableStreamDefaultController>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const event: WebhookEvent = {
      monitorId: body.data?.monitor_id || "",
      eventId: body.data?.event?.event_id || "",
      eventDate: body.data?.event?.event_date || new Date().toISOString(),
      type: body.type || "unknown",
      content: body.data?.event?.output?.content || body.data,
      receivedAt: new Date().toISOString(),
    };

    // Store
    recentEvents.unshift(event);
    if (recentEvents.length > MAX_EVENTS) recentEvents.pop();

    // Notify all SSE clients
    const message = `data: ${JSON.stringify(event)}\n\n`;
    for (const controller of clients) {
      try {
        controller.enqueue(new TextEncoder().encode(message));
      } catch {
        clients.delete(controller);
      }
    }

    console.log(
      `[webhook] ${event.type} from ${event.monitorId}: ${typeof event.content === "object" ? JSON.stringify(event.content).slice(0, 100) : event.content}`
    );

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[webhook] Error:", e);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}

// SSE endpoint — clients connect here to get real-time pushes
export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      clients.add(controller);

      // Send recent events as initial data
      for (const event of recentEvents.slice(0, 10)) {
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      }

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
          clients.delete(controller);
        }
      }, 30000);
    },
    cancel() {
      // Client disconnected
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

// Export for the monitors route to read
export function getRecentWebhookEvents(): WebhookEvent[] {
  return recentEvents;
}
