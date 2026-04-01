import dotenv from "dotenv";
import { Sequelize } from "sequelize-typescript";

import User from "../models/user";
import Admin from "../models/admin_model";
import RoleMaster from "../models/role_master";
import RolePermissionMap from "../models/role_permission_map";
import Permission from "../models/permission_master";
import UserLocation from "../models/user_location";
import UserProfile from "../models/user_profile";
import UserImage from "../models/image_master";
import UserGallery from "../models/image_master";
import MasterItem from "../models/master_item";
import UserPreference from "../models/user_preference";
import BlockedUser from "../models/blocked_user";
import ReportUser from "../models/report_user";
import NotificationMaster from "../models/notification_master";
import LikedProfile from "../models/liked_profile";
import ChatHistory from "../models/chat_history";
import HelpSupportMaster from "../models/help_support_master";
import AdminNotification from "../models/admin_notification";
import ChatArchive from "../models/chat_archive";

dotenv.config();


function logPoolStats(sequelize: any) {
    try {
        const pool = sequelize.connectionManager.pool;
        if (!pool) return;

        const stats = {
            size: pool.size,
            available: pool.available,
            borrowed: pool.borrowed,
            pending: pool.pending,
            max: pool._factory.max,
            min: pool._factory.min,
        };

    } catch (err) {
        console.log("Failed to read pool stats");
    }
}

function addPoolDebugging(sequelize: any) {
    const pool = sequelize.connectionManager.pool;

    if (!pool) {
        console.warn("No pool detected. Pool debugging disabled.");
        return;
    }

    const originalAcquire = pool.acquire.bind(pool);
    const originalRelease = pool.release.bind(pool);

    pool.acquire = async function (...args: any[]) {
        const res = await originalAcquire(...args);
        logPoolStats(sequelize);
        return res;
    };

    pool.release = function (...args: any[]) {
        const res = originalRelease(...args);
        logPoolStats(sequelize);
        return res;
    };
}


export const sequelize = new Sequelize({
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306"),
    dialect: "mysql",
    logging: false,
    pool: {
        max: 20,
        min: 2,
        acquire: 60000,
        idle: 30000,
        evict: 1000,
    },
    dialectOptions: {
        connectTimeout: 60000,
    },

    models: [
        User,
        Admin,
        RoleMaster,
        RolePermissionMap,
        Permission,
        UserLocation,
        BlockedUser,
        ReportUser,
        NotificationMaster,
        LikedProfile,
        ChatHistory,
        UserProfile,
        UserImage,
        UserGallery,
        MasterItem,
        UserPreference,
        HelpSupportMaster,
        AdminNotification,
        ChatArchive
    ],
} as any);

// addPoolDebugging(sequelize);


export const connectDB = async (): Promise<void> => {
    try {
        await sequelize.authenticate();

        await sequelize.sync({ alter: true });
    } catch (error) {
        console.error("Database connection or sync failed:", error);
        process.exit(1);
    }
};
