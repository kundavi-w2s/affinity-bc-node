import { AdminRepository } from "../../repositories/web/admin.repository";
import dotenv from "dotenv";
dotenv.config();
import { sequelize } from "../../config/database";
import { APP_CONSTANTS } from "../../utils/constants";
import { RoleRepository } from "../../repositories/web/role.repository";
import { getSocket } from "../../utils/socket";

export class RoleService {
  private RoleRepository: RoleRepository;
  private AdminRepository: AdminRepository;
  constructor() {
    this.RoleRepository = new RoleRepository();
    this.AdminRepository = new AdminRepository()
  }
  createRole = async (req: any, res: any) => {
    try {
      const reqBody = {
        name: req.body?.name,
        description: req.body?.description,
      };

      // ✅ Check if role name already exists
      const roleExist = await this.RoleRepository.checkRoleName(reqBody.name);
      if (roleExist) {
        return {
          message: APP_CONSTANTS.message.role_name_exist,
          status: false,
          responseCode: APP_CONSTANTS.code.status_badrequest_code,
        };
      }

      // ✅ Check total number of roles already created
      const totalRoles = await this.RoleRepository.getRoleCount();
      if (totalRoles >= 5) {
        return {
          message: "Maximum role limit reached. You can only create up to 5 roles.",
          status: false,
          responseCode: APP_CONSTANTS.code.status_badrequest_code,
        };
      }

      // ✅ Create role if within limit
      const createdRole = await this.RoleRepository.createRole(reqBody);
      if (createdRole) {
        // Emit socket event for real-time update
        const io = getSocket();
        if (io) {
          io.emit(APP_CONSTANTS.socket_fields.roleCreated, { name: reqBody.name, description: reqBody.description });
        }
        return {
          message: APP_CONSTANTS.message.role_created,
          status: true,
          responseCode: APP_CONSTANTS.code.status_success_code,
        };
      } else {
        return {
          message: APP_CONSTANTS.message.role_not_created,
          status: false,
          responseCode: APP_CONSTANTS.code.status_internal_server,
        };
      }

    } catch (error) {
      console.error("Error creating role:", error);
      return {
        message: APP_CONSTANTS.message.something_went_wrong,
        status: false,
        responseCode: APP_CONSTANTS.code.status_internal_server,
      };
    }
  };


  getPermissionList = async (req: any) => {
    try {

      const roleId = req.params?.id;
      let permissionList: any;
      if (roleId) {
        permissionList = await this.RoleRepository.getPermissionListById(
          roleId
        );
      } else {
        permissionList = await this.RoleRepository.getPermissionList(req);
      }
      if (permissionList) {
        return {
          result: {data:permissionList},
          message: APP_CONSTANTS.message.permissions_fetched,
          status: true,
          responseCode: APP_CONSTANTS.code.status_success_code,
        };
      } else {
        return {
          message: APP_CONSTANTS.message.permission_not_found,
          status: true,
          responseCode: APP_CONSTANTS.code.status_success_code,
        };
      }
    } catch (error) {
      return ({
        message: APP_CONSTANTS.message.something_went_wrong,
        status: false,
        responseCode: APP_CONSTANTS.code.status_internal_server
      })
    }
  };

  assignPermission = async (req: any) => {
    const transaction = await sequelize.transaction(); // Start transaction
    try {
      const deleteRolepermissions =
        await this.RoleRepository.deleteRolePermissions(req);
      const assingedpermissionList =
        await this.RoleRepository.insertPermissions(req);
      await transaction.commit();
      if (assingedpermissionList) {
        return {
          message: APP_CONSTANTS.message.permisson_assigned,
          status: true,
          responseCode: APP_CONSTANTS.code.status_success_code,
        };
      }
      else {
        return {
          message: APP_CONSTANTS.message.permisson_assigned,
          status: true,
          responseCode: APP_CONSTANTS.code.status_success_code,
        };
      }
    } catch (error) {
      await transaction.rollback();
      return ({
        message: APP_CONSTANTS.message.something_went_wrong,
        status: false,
        responseCode: APP_CONSTANTS.code.status_internal_server
      })
    }
  };

  getRoleList = async (req: any) => {
    try {
      const page = req.query.page || 1;
      const perpage = req.query.perpage || 5;
      let roleList: any
      if (page && perpage) {
        roleList = await this.RoleRepository.getRoleList(parseInt(page), parseInt(perpage));
      }
      else {
        roleList = await this.RoleRepository.getAllroleList();
      }
      let count = await this.RoleRepository.countRolelist()
      return ({
        result: roleList,
        message: APP_CONSTANTS.message.data_fetched,
        status: true,
        responseCode: APP_CONSTANTS.code.status_success_code,
      })
    }
    catch (error) {
      return ({
        message: APP_CONSTANTS.message.something_went_wrong,
        status: false,
        responseCode: APP_CONSTANTS.code.status_internal_server
      })
    }
  }
  viewRole = async (req: any) => {
    try {
      const id = req.params.id
      const roleList: any = await this.RoleRepository.getRolebyId(id);
      let role_user = roleList.toJSON()
      const roleLists = await this.RoleRepository.getPermissionListById(id);
      let final_result = { ...role_user, permission: roleLists }
      return ({
        result: final_result,
        message: APP_CONSTANTS.message.data_fetched,
        status: true,
        responseCode: APP_CONSTANTS.code.status_success_code,
      })
    }
    catch (error) {
      return ({
        message: APP_CONSTANTS.message.something_went_wrong,
        status: false,
        responseCode: APP_CONSTANTS.code.status_internal_server
      })
    }
  }
  editRole = async (req: any) => {
    try {
      const id = req.params.id
      const role_name = req.body.name;
      const role_description = req.body.description;
      const roleList: any = await this.RoleRepository.getRolebyId(id);
      if (roleList) {
        roleList.name = role_name;
        roleList.description = role_description;
        return roleList.save()
          .then((result: any) => {
            return {
              message: APP_CONSTANTS.message.role_updated,
              status: true,
              responseCode: APP_CONSTANTS.code.status_success_code,
            }
          })
      }
      else {
        return {
          message: APP_CONSTANTS.message.role_not_found,
          status: false,
          responseCode: APP_CONSTANTS.code.status_notdatafound_code,
        }
      }
    }
    catch (error) {
      return ({
        message: APP_CONSTANTS.message.something_went_wrong,
        status: false,
        responseCode: APP_CONSTANTS.code.status_internal_server
      })
    }
  }
  deleteRole = async (req: any) => {
    try {
      const role_id = req.params.id;
      const check_admin = await this.AdminRepository.getAdminbyRole(role_id)
      if (check_admin.length == 0) {
        const delete_role = await this.RoleRepository.deleteRole(role_id)
        return ({
          message: APP_CONSTANTS.message.role_deleted,
          status: true,
          responseCode: APP_CONSTANTS.code.status_success_code
        })
      }
      else {
        return ({
          message: APP_CONSTANTS.message.role_cant_delete,
          status: false,
          responseCode: APP_CONSTANTS.code.status_badrequest_code
        })
      }
    }
    catch (error) {
      return ({
        message: APP_CONSTANTS.message.something_went_wrong,
        status: false,
        responseCode: APP_CONSTANTS.code.status_internal_server
      })
    }
  }
}
