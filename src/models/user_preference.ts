import { Table, Model, Column, DataType, ForeignKey, BelongsTo, PrimaryKey, AutoIncrement } from 'sequelize-typescript';
import User from './user';

@Table({
  tableName: 'affinity_user_preference',
  timestamps: true,
})
export default class UserPreference extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  id!: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false, unique: true })
  user_id!: number;

  @Column({ type: DataType.JSON, allowNull: true })
  gender?: string[]; 

  @Column({ type: DataType.INTEGER, allowNull: true })
  age_min?: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  age_max?: number;

 
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

  @Column({ type: DataType.JSON, allowNull: true })
  languages?: string[]; 

  @Column({ type: DataType.INTEGER, allowNull: true })
  height_min_cm?: number; 

  @Column({ type: DataType.INTEGER, allowNull: true })
  height_max_cm?: number; 

  @Column({ type: DataType.JSON, allowNull: true })
  religion?: string[]; 

  @Column({ type: DataType.JSON, allowNull: true })
  education_level?: string[];

  @BelongsTo(() => User)
  user?: User;
}
