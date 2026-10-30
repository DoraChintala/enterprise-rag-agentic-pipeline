/**
 * Identity & permissioning (Netflix JD: "the identity and permissioning
 * that lets them act safely").
 *
 * An Identity is WHO an agent acts as, plus the SCOPES (allowed tools) it
 * may use. Before any tool call the runtime checks the scope — unauthorized
 * tool calls are BLOCKED, not executed. This is enforcement, not cosmetics.
 *
 * Scopes use a "tool:<name>" convention, with "tool:*" meaning all tools.
 */
export interface Identity {
  principal: string; // e.g. "user:dora" or "agent:research-v1"
  role: string; // human-facing role (also used for answer framing)
  scopes: string[]; // e.g. ["tool:rag", "tool:planner"]
}

/** Default scope sets per role. The planner + rag are the baseline tools. */
const ROLE_SCOPES: Record<string, string[]> = {
  'Financial Analyst': ['tool:planner', 'tool:rag'],
  'Portfolio Manager': ['tool:planner', 'tool:rag'],
  'Investment Banker': ['tool:planner', 'tool:rag'],
  'Tech Lead': ['tool:*'], // tech leads can use everything
  'Compliance Officer': ['tool:rag'], // read-only: no multi-step planning
};

/** Build an Identity from a role, falling back to a safe default. */
export function identityForRole(role?: string): Identity {
  const resolvedRole = role && ROLE_SCOPES[role] ? role : 'Financial Analyst';
  return {
    principal: `user:${resolvedRole.toLowerCase().replace(/\s+/g, '-')}`,
    role: resolvedRole,
    scopes: ROLE_SCOPES[resolvedRole],
  };
}

/** Is the identity allowed to use this tool? */
export function isAllowed(identity: Identity, tool: string): boolean {
  return (
    identity.scopes.includes('tool:*') ||
    identity.scopes.includes(`tool:${tool}`)
  );
}
