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
  tableName: 'affinity_chat_history',
  timestamps: true,
})
export default class ChatHistory extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
  })
  channel_id!: string;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  sender_id!: number;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  receiver_id!: number;

  @Column(DataType.STRING(255))
  chat_message!: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  is_read!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  is_archived!: boolean;

  @Column({
    type: DataType.JSON,
    defaultValue: [],
  })
  deleted_for_users!: number[];

   @Column({
    type: DataType.JSON,
    defaultValue: [],
  })
  archived_for_users!: number[];

  @CreatedAt
  @Column({ field: 'created_at', type: DataType.DATE })
  created_at!: Date;

  @UpdatedAt
  @Column({ field: 'updated_at', type: DataType.DATE })
  updated_at!: Date;

  @BelongsTo(() => User, 'sender_id')
  sender!: User;

  @BelongsTo(() => User, 'receiver_id')
  receiver!: User;
}
