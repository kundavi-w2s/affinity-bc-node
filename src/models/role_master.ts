import { Table, Model, Column, DataType, HasMany, PrimaryKey, AutoIncrement, Length, Default } from 'sequelize-typescript';
import Admin from './admin_model';
import RolePermissionMap from './role_permission_map';

@Table({
  tableName: 'affinity_role_master',
  timestamps: true,
})
export default class RoleMaster extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({
    type: DataType.INTEGER
  })
  id!: number;

  @Length({ max: 100 })
  @Column(DataType.STRING)
  name!: string;

  @Column(DataType.TEXT)
  description?: string;

  @Default(true)
  @Column(DataType.BOOLEAN)
  is_active!: boolean;

  @HasMany(() => Admin)
  admins?: Admin[];

// @HasMany(() => RolePermissionMap, { as: 'rolePermissionMaps' })
// rolePermissions?: RolePermissionMap[];
}
