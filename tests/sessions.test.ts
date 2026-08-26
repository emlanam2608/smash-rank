import { describe, expect, it } from "vitest";
import { sessionFromSnapshot } from "@/lib/sessions";

describe("sessionFromSnapshot", () => {
  it("maps a valid active session", () => {
    expect(
      sessionFromSnapshot("session-1", {
        hostId: "host-1",
        title: "Thursday Evening Court",
        code: "5921",
        createdAt: "timestamp",
        closedAt: null,
        status: "active",
        playerIds: ["host-1", "player-2"],
      }),
    ).toEqual({
      id: "session-1",
      hostId: "host-1",
      title: "Thursday Evening Court",
      code: "5921",
      createdAt: "timestamp",
      closedAt: null,
      status: "active",
      playerIds: ["host-1", "player-2"],
    });
  });

  it("uses safe defaults for incomplete session documents", () => {
    expect(sessionFromSnapshot("session-2", {})).toMatchObject({
      id: "session-2",
      hostId: "",
      title: "Session",
      code: "",
      status: "active",
      playerIds: [],
    });
  });
});
