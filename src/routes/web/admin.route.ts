import { Router } from "express";
import { AdminController } from "../../controllers/web/admin.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { validation } from "../../middleware/validation.middleware"
import { adminConfirmpassword, adminLoginSchema, adminRegisterSchema, adminresetPassword, triggerNotificationSchema, verfiyOtpSchema } from "../../utils/validation";

export class AdminRoutes {
    router: Router;
    public adminController: AdminController = new AdminController();

    constructor() {
        this.router = Router();
        this.routes();
    }
    routes() {
        // Admin Management Routes
        this.router.post("/create_admin", authMiddleware, this.adminController.createAdmin);
        this.router.post("/admin_register", this.adminController.adminRegister);
        this.router.post("/admin_login",validation(adminLoginSchema),this.adminController.adminLogin);
        this.router.get("/get_admin_list", authMiddleware, this.adminController.getAllAdmin);
        this.router.get("/get_admin_user", authMiddleware, this.adminController.getAdminuser);
        this.router.post("/admin_resetpassword", validation(adminresetPassword), this.adminController.resetPassword);
        this.router.post("/admin_verify_otp", validation(verfiyOtpSchema), this.adminController.verifyOtp);
        this.router.post("/admin_changepassword", validation(adminConfirmpassword), this.adminController.changePassword);
        this.router.put("/delete_admin/:id",authMiddleware, this.adminController.deleteAdmin);
        this.router.post("/trigger_notification",authMiddleware, this. adminController.triggerNotification)
      
        this.router.get("/get_report_list", authMiddleware, this.adminController.getReportList)
        this.router.get("/get_help_support_list", authMiddleware, this.adminController.getHelpSupportList)
        this.router.get("/get_dashboard_list", authMiddleware, this.adminController.getDashboardList)
        this.router.get("/get_filter_list", authMiddleware, this.adminController.getFilterList)
        this.router.get("/get_notification_list", authMiddleware,this.adminController.getNotificationList)

        this.router.get("/user_filter_list",authMiddleware,this.adminController.getUserFilterList);


        // User Management Routes
        this.router.get("/users", authMiddleware, this.adminController.getUsersList);
        this.router.get("/users/:id", authMiddleware, this.adminController.getUserDetails);
        this.router.put("/users/:id", authMiddleware, this.adminController.updateUserStatus);
        this.router.put("/delete_user/:id", authMiddleware, this.adminController.deleteUser);
        this.router.put("/restore_user/:id", authMiddleware, this.adminController.restoreUser);
    }
}