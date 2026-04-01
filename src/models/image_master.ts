import { Table, Model, Column, DataType, ForeignKey, BelongsTo, PrimaryKey, AutoIncrement } from 'sequelize-typescript';
import User from './user';

@Table({
  tableName: 'affinity_user_images',
  timestamps: true,
})
export default class UserImage extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  image_id!: number;


  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  user_id!: number;

  @Column({ type: DataType.INTEGER })
  id!: number;

  @Column({ type: DataType.STRING, allowNull: false })
  image_url!: string;

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  is_profile_pic!: boolean;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  order_index!: number;

}
