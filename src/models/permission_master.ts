import { Table, Model, Column, DataType, HasMany, PrimaryKey, AutoIncrement } from 'sequelize-typescript';
import RolePermissionMap from './role_permission_map';

@Table({
  tableName: 'affinity_permission_master',
  timestamps: true,
})
export default class Permission extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({
    type: DataType.INTEGER
  })
  id!: number;

  @Column({
    type: DataType.TEXT,
  })
  permission_name!: string;

  @Column
  is_active!: boolean;

  @Column({
    type: DataType.TEXT,
  })
  category!: string;

  // @HasMany(() => RolePermissionMap)
  // rolePermissions?: RolePermissionMap[];
}
