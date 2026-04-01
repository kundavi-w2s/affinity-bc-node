import {
  Table,
  Model,
  Column,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
  PrimaryKey,
  AutoIncrement
} from 'sequelize-typescript';
import User from './user';

@Table({
  tableName: 'affinity_blocked_users',
  timestamps: true,
})
export default class BlockedUser extends Model<BlockedUser> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @ForeignKey(() => User)
  @Column(DataType.INTEGER)
  user_id!: number;

  @ForeignKey(() => User)
  @Column(DataType.INTEGER)
  blocked_user_id!: number;

  @CreatedAt
  @Column(DataType.DATE)
  created_at!: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  updated_at!: Date;

  @BelongsTo(() => User, 'user_id')
  blocker!: User;

  @BelongsTo(() => User, 'blocked_user_id')
  blocked!: User;
}