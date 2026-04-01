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
  AutoIncrement,
  AllowNull,
} from 'sequelize-typescript';
import User from './user';

@Table({
  tableName: 'affinity_chat_archive',
  timestamps: true,
})
export default class ChatArchive extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  user_id!: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
  })
  channel_id!: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  other_user_id!: number;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  archive_reason?: string;

  @CreatedAt
  @Column({ field: 'created_at', type: DataType.DATE })
  created_at!: Date;

  @UpdatedAt
  @Column({ field: 'updated_at', type: DataType.DATE })
  updated_at!: Date;

  @BelongsTo(() => User, 'user_id')
  user!: User;

  @BelongsTo(() => User, 'other_user_id')
  otherUser!: User;
}
