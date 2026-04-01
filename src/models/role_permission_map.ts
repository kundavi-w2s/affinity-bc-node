import { Table, Model, Column, DataType, ForeignKey, BelongsTo, PrimaryKey, AutoIncrement } from 'sequelize-typescript';
import Permission from './permission_master';
import RoleMaster from './role_master';

@Table({
  tableName: 'affinity_rolepermission_mapping',
  timestamps: false,
})
export default class RolePermissionMap extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column
  id!: number;

  @ForeignKey(() => RoleMaster)
  @Column(DataType.INTEGER)
  role_id!: number;

  @ForeignKey(() => Permission)
  @Column(DataType.INTEGER)
  permission_id!: number;

  @BelongsTo(() => Permission)
  permission?: Permission;

  @BelongsTo(() => RoleMaster)
  role?: RoleMaster;
}
