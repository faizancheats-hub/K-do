import { describe, expect, it } from "vitest";
import { normalizeAgentTask, shouldRouteToAgent } from "../../src/utils/IntentRouting";

describe("IntentRouting", () => {
  it("routes slash agent commands to the agent", () => {
    expect(shouldRouteToAgent("/agent create auth routes")).toBe(true);
    expect(normalizeAgentTask("/agent create auth routes")).toBe("create auth routes");
  });

  it("routes imperative file modification requests to the agent", () => {
    expect(shouldRouteToAgent("create a new file for auth middleware")).toBe(true);
    expect(shouldRouteToAgent("add tests for the login service")).toBe(true);
    expect(shouldRouteToAgent("create anime streaming website")).toBe(true);
    expect(shouldRouteToAgent("build a movie app with login and admin dashboard")).toBe(true);
  });

  it("keeps normal questions in chat mode", () => {
    expect(shouldRouteToAgent("how do i create a file in node?")).toBe(false);
    expect(shouldRouteToAgent("what does this middleware do?")).toBe(false);
    expect(shouldRouteToAgent("/explain this code")).toBe(false);
  });
});
