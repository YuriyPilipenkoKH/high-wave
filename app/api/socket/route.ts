//app/api/socket/route.ts
import { Server } from "socket.io";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  if (!(global as any).io) {
    const io = new Server(3001, {
      cors: { origin: "*" },
    });

    io.on("connection", (socket) => {
      console.log("Connected:", socket.id);

      socket.on("join-room", (roomId) => {
        socket.join(roomId);
      });

      socket.on("signal", ({ roomId, data }) => {
        socket.to(roomId).emit("signal", data);
      });
    });

    (global as any).io = io;
  }

  return new Response("Socket running");
}