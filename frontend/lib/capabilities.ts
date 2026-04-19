import { getApiUrl } from "./config";

/** Matches `GET /api/capabilities` — safe to call without auth. */
export interface ApiCapabilities {
  analyze_enabled: boolean;
  node_env: string;
  /** True when API runs planner in-process (MOCK_LAMBDAS); informational. */
  mock_lambdas?: boolean;
}

export async function fetchCapabilities(): Promise<ApiCapabilities> {
  const r = await fetch(`${getApiUrl()}/api/capabilities`);
  if (!r.ok) {
    throw new Error(`capabilities HTTP ${r.status}`);
  }
  return r.json() as Promise<ApiCapabilities>;
}
