import "reflect-metadata";
import express, { Application } from "express";
import dotenv from "dotenv";
import cors from "cors";
import { Server as SocketServer } from "socket.io";
import http from "http";

import { connectDB } from "./config/database";
import redisClient from "./config/redis";

import { masterRoutes } from "./routes/mobile/master.route";
import { userRoutes } from "./routes/mobile/users.route";
import { ProfileRoutes } from "./routes/mobile/profile.route";
import { AdminRoutes } from "./routes/web/admin.route";
import { RoleRoutes } from "./routes/web/role.route";
import { LikeRoutes } from "./routes/mobile/like.routes";
import { PreferenceRoutes } from "./routes/mobile/preference.route";
import { ChatRoutes } from "./routes/mobile/chat.routes";
import { NotificationRoutes } from "./routes/mobile/notification.routes";

import { initSocket } from "./utils/socket";

dotenv.config();

class Server {
  public app: Application;
  public port: number;
  public server: http.Server;
  public io: SocketServer;

  constructor() {
    this.app = express();

    this.port = Number(process.env.PORT) || 3000;

    this.server = http.createServer(this.app);

    this.io = new SocketServer(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    initSocket(this.io);

    this.config();
    this.routes();
    this.socketEvents();
    this.start().catch((error) => {
      console.error("Failed to start server:", error);
      process.exit(1);
    });
  }

  private config(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cors());
  }

  private routes(): void {
    this.app.use("/api/master", new masterRoutes().router);
    this.app.use("/api/users", new userRoutes().router);
    this.app.use("/api/users/profile", new ProfileRoutes().router);
    this.app.use("/api/admin", new AdminRoutes().router);
    this.app.use("/api/role", new RoleRoutes().router);
    this.app.use("/api/likes", new LikeRoutes().router);
    this.app.use("/api/preference", new PreferenceRoutes().router);
    this.app.use("/api/chat", new ChatRoutes().router);
    this.app.use("/api/notifications", new NotificationRoutes().router);

    // REQUIRED for Kubernetes liveness/readiness probes
    this.app.get("/health", (_req, res) => {
      res.status(200).send("OK");
    });
  }

  private socketEvents(): void {
    this.io.on("connection", (socket) => {
      console.log("Socket connected:", socket.id);

      socket.on("disconnect", () => {
        console.log("Socket disconnected:", socket.id);
      });
    });
  }

  public async start(): Promise<void> {
    try {
      //  Connect to DB (DB_HOST is used inside database config)
      await connectDB();
      console.log("Database connected");

      if (!redisClient.isOpen) {
        await redisClient.connect();
        console.log(`[REDIS INIT] ${new Date().toISOString()} - Redis connected successfully`);
      } else {
        console.log(`[REDIS INIT] ${new Date().toISOString()} - Redis was already connected`);
      }

      redisClient.on("error", (err) => {
        console.error(`[REDIS ERROR] ${new Date().toISOString()} - Redis error:`, err.message);
      });

      redisClient.on("disconnect", () => {
        console.warn(`[REDIS DISCONNECT] ${new Date().toISOString()} - Redis disconnected`);
      });

      //  MOST IMPORTANT FIX: bind to 0.0.0.0 for Kubernetes
      this.server.listen(this.port, "0.0.0.0", () => {
        console.log(`Server running on port ${this.port}`);
      });

    } catch (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }
  }
}

new Server();
