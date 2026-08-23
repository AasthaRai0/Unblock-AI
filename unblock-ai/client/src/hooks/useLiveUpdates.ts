import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "../sockets/socket";

/**
 * Mounted once near the app root. Every live event from the backend
 * invalidates the relevant React Query cache keys so every page that
 * cares re-fetches automatically — no manual refresh, no prop drilling.
 */
export function useLiveUpdates(onEvent?: (event: string, payload: any) => void) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    const invalidate = (keys: string[][]) => {
      keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
    };

    const handlers: Record<string, (payload: any) => void> = {
      "transaction:updated": () => invalidate([["dashboard"], ["transactions"], ["deadlocks"]]),
      "deadlock:detected": () => invalidate([["dashboard"], ["deadlocks"], ["transactions"]]),
      "deadlock:updated": () => invalidate([["dashboard"], ["deadlocks"], ["transactions"], ["human-review"]]),
      "recovery:started": () => invalidate([["dashboard"], ["deadlocks"], ["audit"]]),
      "recovery:progress": () => invalidate([["missions"]]),
      "recovery:success": () =>
        invalidate([["dashboard"], ["deadlocks"], ["transactions"], ["vendors"], ["audit"]]),
      "recovery:failed": () => invalidate([["dashboard"], ["deadlocks"]]),
      "audit:new": () => invalidate([["audit"], ["dashboard"]]),
      "vendor:health_updated": () => invalidate([["vendors"]]),
      "mission:progress": () => invalidate([["missions"], ["dashboard"]]),
      "notification:new": () => invalidate([["notifications"]]),
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, (payload: any) => {
        handler(payload);
        onEvent?.(event, payload);
      });
    });

    return () => {
      Object.keys(handlers).forEach((event) => socket.off(event));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);
}
