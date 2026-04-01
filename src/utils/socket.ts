import { Server as SocketServer } from "socket.io";
import { APILogger } from "./logger";
import { APP_CONSTANTS } from "./constants";

let io: SocketServer;
const logger = new APILogger();

export const initSocket = (socketServer: SocketServer) => {
  try {
    if (!socketServer) {
      throw new Error("Socket server is undefined or null");
    }
    io = socketServer;
    logger.info("Socket.IO initialized successfully");
  } catch (error) {
    logger.error(`Socket.IO initialization failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const getSocket = () => {
  if (!io) {
    logger.error(APP_CONSTANTS.message.Socket_IO_not_initialized);
    return null;
  }
  return io;
};