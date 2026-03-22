const MUTATION_VERBS = [
  "create",
  "add",
  "generate",
  "build",
  "implement",
  "scaffold",
  "modify",
  "update",
  "edit",
  "refactor",
  "rename",
  "delete",
  "remove",
  "move",
  "convert",
  "migrate",
  "wire",
  "setup",
  "set up",
  "make"
];

const MUTATION_TARGETS = [
  "file",
  "files",
  "folder",
  "folders",
  "website",
  "site",
  "app",
  "application",
  "webapp",
  "ui",
  "frontend",
  "backend",
  "dashboard",
  "landing page",
  "landing",
  "page",
  "pages",
  "component",
  "components",
  "route",
  "routes",
  "endpoint",
  "endpoints",
  "api",
  "module",
  "modules",
  "test",
  "tests",
  "middleware",
  "service",
  "controller",
  "view",
  "screen",
  "feature",
  "project",
  "repo",
  "repository",
  "workspace"
];

export function shouldRouteToAgent(content: string): boolean {
  const normalized = content.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (normalized.startsWith("/agent")) {
    return true;
  }

  if (normalized.startsWith("/")) {
    return false;
  }

  if (/^(how|what|why|when|where|who)\b/.test(normalized) || normalized.endsWith("?")) {
    return false;
  }

  const hasVerb = MUTATION_VERBS.some((verb) => normalized.includes(verb));
  const hasTarget = MUTATION_TARGETS.some((target) => normalized.includes(target));
  const startsAsImperative = MUTATION_VERBS.some((verb) => normalized.startsWith(`${verb} `));

  return startsAsImperative || (hasVerb && hasTarget);
}

export function normalizeAgentTask(content: string): string {
  return content.trim().replace(/^\/agent\b/i, "").trim();
}

export function isMutationTask(content: string): boolean {
  return shouldRouteToAgent(content);
}
