// models/admin.model.ts
import {
  Table,
  Model,
  Column,
  DataType,
  PrimaryKey,
  AutoIncrement,
  Default,
  Is,
  ForeignKey,
} from 'sequelize-typescript';
import RoleMaster from './role_master';

@Table({
  tableName: 'affinity_admin',
  timestamps: true,
})
export default class Admin extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({
    type: DataType.INTEGER,
  })
  id!: number;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
  full_name!: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    // We'll handle uniqueness through application logic
  })
  email!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  password?: string;

  @Default(true)
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
  })
  is_active?: boolean;

  @Is(/^\d{4}$/)
  @Column({
    type: DataType.STRING,
    allowNull: true,
    comment: '4-digit numeric OTP',
  })
  otp?: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  otp_expire_time?: Date;

  @ForeignKey(() => RoleMaster)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  role_id?: number;

  @Default(true)
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
  })
  is_account_owner!: boolean;
}