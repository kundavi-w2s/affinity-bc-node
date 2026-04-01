import { RoleService } from "../../services/web/role.service";
import { APP_CONSTANTS } from "../../utils/constants";
export class RoleController {
    public RoleService = new RoleService()

    createRole = async (req: any, res: any) => {
        try {
            const user = await this.RoleService.createRole(req, res);
            return res.status(user.responseCode).json(user);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server).json({ message: error.message });
        }
    }

    getPermissionList = async (req: any, res: any) => {
        try {
            const permissions = await this.RoleService.getPermissionList(req);
            return res.status(permissions.responseCode).json(permissions);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server).json({ message: error.message });
        }
    }

    assignPermission = async (req: any, res: any) => {
        try {
            const permissions = await this.RoleService.assignPermission(req);
            return res.status(permissions.responseCode).json(permissions);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server).json({ message: error.message });
        }
    }
    getRoleList = async (req: any, res: any) => {
        try {
            const permissions = await this.RoleService.getRoleList(req);
            return res.status(permissions.responseCode).json(permissions);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server).json({ message: error.message });
        }
    }
    viewRole = async (req: any, res: any) => {
        try {
            const permissions = await this.RoleService.viewRole(req);
            return res.status(permissions.responseCode).json(permissions);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server).json({ message: error.message });
        }
    }
    editRole = async (req: any, res: any) => {
        try {
            const permissions = await this.RoleService.editRole(req);
            return res.status(permissions.responseCode).json(permissions);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server).json({ message: error.message });
        }
    }
    deleteRole = async (req: any, res: any) => {
        try {
            const permissions = await this.RoleService.deleteRole(req);
            return res.status(permissions.responseCode).json(permissions);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server).json({ message: error.message });
        }
    }

}