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
  tableName: 'affinity_liked_profiles',
  timestamps: true,
})
export default class LikedProfile extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'user_profile_id'
  })
  userProfileId!: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'liked_profile_id'
  })
  likedProfileId!: number;

  @Column({
    type: DataType.ENUM('pending', 'accepted', 'rejected', 'disliked'),
    defaultValue: 'pending',
  })
  status!: 'pending' | 'accepted' | 'rejected' | 'disliked';

  @BelongsTo(() => User, 'user_profile_id')
  liker!: User;

  @BelongsTo(() => User, 'liked_profile_id')
  liked!: User;

  @CreatedAt
  created_at!: Date;

  @UpdatedAt
  updated_at!: Date;
}