import { AdminService } from "../../services/web/admin.service"
import { APP_CONSTANTS } from "../../utils/constants";

export class AdminController {
    public adminService = new AdminService()
    adminRegister = async (req: any, res: any) => {
        try {
            const user = await this.adminService.registerAdmin(req);
            return res.status(user.responseCode).json(user);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server).json({ message: error.message });
        }
    }
    createAdmin = async (req: any, res: any) => {
        try {
            const user = await this.adminService.createAdmin(req);
            return res.status(user.responseCode).json(user);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server).json({ message: error.message });
        }
    }
     adminLogin = async (req: any, res: any) => {
        try {
            const user = await this.adminService.adminLogin(req);
            return res.status(user.responseCode).json(user);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_badrequest_code).json({ message: error.message });
        }
    }

    getAllAdmin = async (req: any, res: any) => {
        try {
            const user = await this.adminService.getAllAdmin(req);
            return res.status(user.responseCode).json(user);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server).json({ message: error.message });
        }
    }

     getAdminuser = async (req: any, res: any) => {
        try {
            const user = await this.adminService.getAdminuser(req);
            return res.status(user.responseCode).json(user);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server).json({ message: error.message });
        }
    }

     resetPassword = async (req: any, res: any) => {
        try {
            const user = await this.adminService.resetPassword(req);
            return res.status(user.responseCode).json(user);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server).json({ message: error.message });
        }
    }
    verifyOtp = async (req: any, res: any) => {
        try {
            const user = await this.adminService.verifyOtp(req);
            return res.status(user.responseCode).json(user);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server).json({ message: error.message });
        }
    }
    changePassword = async (req: any, res: any) => {
        try {
            const user = await this.adminService.changePassword(req);
            return res.status(user.responseCode).json(user);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server).json({ message: error.message });
        }
    }

    getUsersList = async (req: any, res: any) => {
        try {
            const users = await this.adminService.getUsersList(req);
            return res.status(users.responseCode).json(users);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server)
                .json({ message: error.message });
        }
    };

    getUserDetails = async (req: any, res: any) => {
        try {
            const user = await this.adminService.getUserDetails(req);
            return res.status(user.responseCode).json(user);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server)
                .json({ message: error.message });
        }
    };

    updateUserStatus = async (req: any, res: any) => {
        try {
            const result = await this.adminService.updateUserStatus(req);
            return res.status(result.responseCode).json(result);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server)
                .json({ message: error.message });
        }
    };

    deleteUser = async (req: any, res: any) => {
        try {
            const result = await this.adminService.deleteUser(req);
            return res.status(result.responseCode).json(result);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server)
                .json({ message: error.message });
        }
    };

    restoreUser = async (req: any, res: any) => {
        try {
            const result = await this.adminService.restoreUser(req);
            return res.status(result.responseCode).json(result);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server)
                .json({ message: error.message });
        }
    };

    triggerNotification = async (req: any, res: any) => {
        try {
            const user = await this.adminService.triggerNotification(req);
            return res.status(user.responseCode).json(user);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server).json({ message: error.message });
        }
    }

    getReportList = async (req: any, res: any) => {
        try {
            const user = await this.adminService.getReportList(req);
            return res.status(user.responseCode).json(user);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server).json({ message: error.message });
        }
    }

     getHelpSupportList = async (req: any, res: any) => {
        try {
            const user = await this.adminService.getHelpSupportList(req);
            return res.status(user.responseCode).json(user);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server).json({ message: error.message });
        }
    }
    getDashboardList = async (req: any, res: any) => {
        try {
            const user = await this.adminService.getDashboardList(req);
            return res.status(user.responseCode).json(user);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server).json({ message: error.message });
        }
    }
    getFilterList = async (req: any, res: any) => {
        try {
            const result = await this.adminService.getFilterList(req);
            return res.status(result.responseCode).json(result);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server).json({ message: error.message });
        }
    }
    getNotificationList = async (req:any, res: any) =>{
         try {
            const result = await this.adminService.getNotificationList(req);
            return res.status(result.responseCode).json(result);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server).json({ message: error.message });
        }
    }

    deleteAdmin = async (req: any, res: any) => {
        try {
            const result = await this.adminService.deleteAdmin(req);
            return res.status(result.responseCode).json(result);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server).json({ message: error.message });
        }
    }

    getUserFilterList = async (req: any, res: any) => {
        try {
            const result = await this.adminService.getUserFilterList(req);
            return res.status(result.responseCode).json(result);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server)
                .json({ message: error.message });
        }
    }
}