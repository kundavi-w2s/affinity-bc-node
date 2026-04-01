import RoleMaster from "../../models/role_master";
import permission from "../../models/permission_master";
import rolepermissionmap from "../../models/role_permission_map";
import { PaginationUtil } from "../../utils/pagination";
export class RoleRepository {

    checkRoleName = async (name: any) => {
        return await RoleMaster.findOne({ where: { name: name, is_active: true } })
    }
    createRole = async (req: any) => {
        const name = req.name;
        const description = req.description;
        return await RoleMaster.create({ name, description })
    }
    getRoleCount = async () => {
        return await RoleMaster.count();
    };

    getRoleList = async (page: number, perpage: number) => {
        return await PaginationUtil.paginate(RoleMaster, {
            page,
            limit: perpage,
            where: { is_active: true },
            order: [['createdAt', 'DESC']],
        });
    };



    getAllroleList = async () => {
        return await RoleMaster.findAll({
            where: { is_active: true },
        })
    }
    countRolelist = async () => {
        return await RoleMaster.count({
            where: { is_active: true }
        })
    }

    getRolebyId = async (id: any) => {
        return await RoleMaster.findOne({
            where: { is_active: true, id: id }
        })
    }

    getPermissionList = async (req: any) => {
        return await permission.findAll({
            where: { is_active: true },
            attributes: ["id", "permission_name", "category"]
        })
    }

    deleteRolePermissions = async (req: any) => {
        const roleId = req.body.role_id
        return await rolepermissionmap.destroy({ where: { role_id: roleId } });
    }

    insertPermissions = async (req: any) => {
        const permissions = req.body.permissions
        const roleId = req.body.role_id
        const newMappings = permissions.map((permission_id: any) => ({
            role_id: roleId,
            permission_id: permission_id.id
        }));

        return await rolepermissionmap.bulkCreate(newMappings, {
            fields: ["role_id", "permission_id"],
        });
    }

    getPermissionListById = async (roleId: any) => {
        const rolePermissions = await rolepermissionmap.findAll({
            where: { role_id: roleId },
            include: [
                {
                    model: permission,
                    as: "permission",
                    attributes: ["id", "permission_name", "category"],
                },
            ],
            attributes: [],
        });
        const permissions = rolePermissions.map((rp) => rp.dataValues.permission.get());
        return permissions;
    }

    getRolepermission = async (role_id: any) => {
        return rolepermissionmap.findAll({
            where: { role_id: role_id }
        })
    }
    deleteRole = async (role_id: number) => {
        return RoleMaster.update(
            { is_active: false },
            { where: { id: role_id } }
        )
    }
}