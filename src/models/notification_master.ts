import {
  Table,
  Model,
  Column,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  PrimaryKey,
  AutoIncrement
} from 'sequelize-typescript';
import User from './user';

interface INotificationMasterCreationAttributes {
  sender_id: number;
  receiver_id: number;
  message: string;
  notification_type: string;
  is_seen: boolean;
}

@Table({
  tableName: 'affinity_notification_master',
  timestamps: true,
  updatedAt: false,
})
class NotificationMaster extends Model<NotificationMaster, INotificationMasterCreationAttributes> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  sender_id!: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  receiver_id!: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  message!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  notification_type!: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  is_seen!: boolean;

  @BelongsTo(() => User, 'sender_id')
  sender!: User;

  @BelongsTo(() => User, 'receiver_id')
  receiver!: User;

  @CreatedAt
  @Column(DataType.DATE)
  created_at!: Date;
}

export default NotificationMaster;