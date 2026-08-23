import { Server } from "socket.io";

let ioInstance: Server | null = null;

export function initSocket(io: Server) {
  ioInstance = io;
  io.on("connection", (socket) => {
    // eslint-disable-next-line no-console
    console.log("client connected", socket.id);
    socket.on("disconnect", () => {
      // eslint-disable-next-line no-console
      console.log("client disconnected", socket.id);
    });
  });
}

/**
 * Central emit point used by every service so real-time events are
 * consistent no matter which controller triggered the mutation.
 *
 * Event catalogue:
 *   transaction:updated | deadlock:detected | deadlock:updated
 *   recovery:started | recovery:progress | recovery:success | recovery:failed
 *   audit:new | vendor:health_updated | mission:progress | notification:new
 */
export function emitEvent(event: string, payload: any) {
  if (!ioInstance) return;
  ioInstance.emit(event, payload);
}
