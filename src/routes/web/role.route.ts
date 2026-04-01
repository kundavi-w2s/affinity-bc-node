import { Router } from "express";
import {authMiddleware } from "../../middleware/auth.middleware"
import { RoleController } from "../../controllers/web/role.controller";
export class RoleRoutes {
    router: Router;
    public roleController: RoleController = new RoleController()

    constructor() {
        this.router = Router();
        this.routes();
    }
    routes() {
        this.router.post("/create_role", authMiddleware, this.roleController.createRole);
        this.router.get("/permission_list/:id", authMiddleware, this.roleController.getPermissionList);
        this.router.get("/permission_list", authMiddleware, this.roleController.getPermissionList);
        this.router.post("/assignPermissions", authMiddleware, this.roleController.assignPermission);
        this.router.get("/get_rolelist", authMiddleware, this.roleController.getRoleList);
        this.router.get("/view_role/:id", authMiddleware, this.roleController.viewRole);
        this.router.put("/edit_role/:id", authMiddleware, this.roleController.editRole);
        this.router.put("/delete_role/:id", authMiddleware, this.roleController.deleteRole);    
    }
}