import { Server as IOServer } from "socket.io";

declare global {
  // eslint-disable-next-line no-var
  var io: IOServer | undefined;
}

export {};