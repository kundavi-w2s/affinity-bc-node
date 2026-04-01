// src/models/user.ts
import {
  Table,
  Model,
  Column,
  DataType,
  PrimaryKey,
  AutoIncrement,
  HasOne,
  HasMany,
  CreatedAt,
  UpdatedAt,
  AllowNull,
  Default,
} from 'sequelize-typescript';

import UserLocation from './user_location';
import BlockedUser from './blocked_user';
import ReportUser from './report_user';
import NotificationMaster from './notification_master';
import LikedProfile from './liked_profile';
import UserProfile from './user_profile';
import UserPreference from './user_preference';
import UserImage from './image_master';

@Table({
  tableName: 'affinity_users',
  timestamps: true,
})
export default class User extends Model<User> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @AllowNull(true)
  @Column(DataType.STRING(255))
  email?: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(5))
  country_code?: string | null;

  @AllowNull(true)
  @Column(DataType.BIGINT)
  phone_number?: number | null;

  @AllowNull(true)
  @Column({
    type: DataType.STRING,
    comment: 'bcrypt hashed password',
  })
  password_hash?: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  otp?: string;

  @AllowNull(true)
  @Column(DataType.DATE)
  otp_expires_at?: Date;

  @Default(true)
  @Column(DataType.BOOLEAN)
  is_active!: boolean;


  @Default(false)
  @Column(DataType.BOOLEAN)
  is_mobile_verification!: boolean;

  @CreatedAt
  @Column(DataType.DATE)
  created_at!: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  updated_at!: Date;


  @AllowNull(true)
  @Column(DataType.STRING)
  device_token?: string;
  
  @AllowNull(true)
  @Column(DataType.STRING)
  device_type?: string;

  @AllowNull(true)
  @Column(DataType.DATE)
  deleted_at?: Date | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  deleted_by?: string | null;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  deleted_by_admin_id?: number | null;

  @AllowNull(true)
  @Column(DataType.DATE)
  can_recreate_after?: Date | null;

  @Default(false)
  @Column(DataType.BOOLEAN)
  is_deleted!: boolean;

  
  @Default(false)
  @Column(DataType.BOOLEAN)
  is_verified!: boolean;


  // ========================
  // RELATIONSHIPS
  // ========================

  @HasOne(() => UserProfile, { foreignKey: "user_id" })
  profile?: UserProfile;

  @HasOne(() => UserLocation, { foreignKey: "user_id" })
  userLocation?: UserLocation;

  @HasOne(() => UserPreference, { foreignKey: "user_id" })
  preference?: UserPreference;

  @HasMany(() => UserImage, { foreignKey: "user_id", sourceKey: "id" })
  images?: UserImage[];


  @HasMany(() => BlockedUser, 'user_id')
  blockedUsers!: BlockedUser[];

  @HasMany(() => BlockedUser, 'blocked_user_id')
  blockedByUsers!: BlockedUser[];

  @HasMany(() => ReportUser, { foreignKey: 'user_id' })
  reportedUsers!: ReportUser[];

  @HasMany(() => ReportUser, { foreignKey: 'reported_user_id' })
  reportedByUsers!: ReportUser[];

  @HasMany(() => NotificationMaster, { foreignKey: 'sender_id' })
  sentNotifications!: NotificationMaster[];

  @HasMany(() => NotificationMaster, { foreignKey: 'receiver_id' })
  receivedNotifications!: NotificationMaster[];

  @HasMany(() => LikedProfile, 'user_profile_id')
  sentLikes!: LikedProfile[];

  @HasMany(() => LikedProfile, 'liked_profile_id')
  receivedLikes!: LikedProfile[];
}
