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
  tableName: 'affinity_report_users',
  timestamps: true,
})
class ReportUser extends Model<ReportUser> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  user_id!: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  reported_user_id!: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  reason!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  description?: string;

  @Column({
    type: DataType.ENUM('pending', 'reviewed', 'resolved', 'dismissed'),
    defaultValue: 'pending',
  })
  status!: 'pending' | 'reviewed' | 'resolved' | 'dismissed';

  @BelongsTo(() => User, 'user_id')
  reporter!: User;

  @BelongsTo(() => User, 'reported_user_id')
  reported!: User;

  @CreatedAt
  @Column(DataType.DATE)
  created_at!: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  updated_at!: Date;
}

export default ReportUser;