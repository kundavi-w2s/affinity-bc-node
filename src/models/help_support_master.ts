import {
  Table,
  Model,
  Column,
  DataType,
  ForeignKey,
  BelongsTo,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
} from 'sequelize-typescript';
import User from './user'; // Adjust the path if needed (same as in ChatMaster)

@Table({
  tableName: 'affinity_help_support_master',
  timestamps: true,
})
export default class HelpSupportMaster extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id!: number;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  user_id!: number;

  @AllowNull(false)
  @Column({
    type: DataType.STRING(250),
    field: 'issue_description',
  })
  issue_description!: string;

  // Association
  @BelongsTo(() => User)
  user!: User;
}