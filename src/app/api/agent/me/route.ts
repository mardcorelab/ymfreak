import { currentClient } from "@/server/portal/session";
import { noStore } from "@/server/agent/http";

export const dynamic = "force-dynamic";

/** The signed-in client's first name, so the assistant can say hello. Nothing else leaves the server. */
export async function GET() {
  const client = await currentClient();
  return noStore({ firstName: client ? (client.name.split(" ")[0] ?? client.name) : null });
}
