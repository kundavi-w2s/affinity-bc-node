import { 
  Table, 
  Column, 
  Model, 
  DataType, 
  PrimaryKey, 
  AutoIncrement, 
  AllowNull, 
} from 'sequelize-typescript';

@Table({
  tableName: 'affinity_admin_notification',
  timestamps: true,
})
export default class AdminNotification extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @AllowNull(false)
  @Column(DataType.STRING)
  notification_title!: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  notification_message!: string;
  
  @AllowNull(false)
  @Column(DataType.STRING)
  trigger_to!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  city?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  state?: string;
}
