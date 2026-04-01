import { Table, Model, Column, DataType, ForeignKey, PrimaryKey, AutoIncrement } from 'sequelize-typescript';
import User from './user';

@Table({
  tableName: 'affinity_user_location',
  timestamps: false,
})
export default class UserLocation extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({
    type: DataType.INTEGER,
  })
  id!: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  user_id!: number;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  latitude?: number;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  longitude?: number;

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

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  country?: string;
}