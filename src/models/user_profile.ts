import { Table, Model, Column, DataType, ForeignKey, BelongsTo, HasMany, PrimaryKey, AutoIncrement } from 'sequelize-typescript';
import User from './user';
import UserLocation from './user_location';
import UserImage from './image_master';

@Table({
  tableName: 'affinity_user_profile',
  timestamps: true,
})
export default class UserProfile extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  id!: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  user_id!: number;

   @Column({ type: DataType.STRING, allowNull: true })
   profile_id?: string;


  @Column({ type: DataType.STRING, allowNull: false })
  first_name!: string;

  @Column({ type: DataType.STRING, allowNull: false })
  last_name!: string;

  @Column({ 
    type: DataType.TEXT, 
    allowNull: true,
    validate: {
      len: [100, 300]
    }
  })
  short_bio?: string;

  @Column({ 
    type: DataType.DATEONLY, 
    allowNull: false,
    get() {
      const rawValue = this.getDataValue('dob');
      if (!rawValue) return null;
      if (typeof rawValue === 'string') return rawValue;
      if (rawValue instanceof Date) return rawValue.toISOString().split('T')[0];
      return null;
    }
  })
  dob!: Date;

  @Column({ type: DataType.INTEGER, allowNull: false })
  age!: number;

  @Column({ type: DataType.STRING, allowNull: false })
  gender!: string;

  @Column({ type: DataType.JSON, allowNull: false, defaultValue: [] })
  profile_images!: string[];

  @Column({ type: DataType.STRING, allowNull: true })
  height?: string;

  @Column({ type: DataType.STRING, allowNull: true })
  education?: string;

  @Column({ type: DataType.STRING, allowNull: true })
  education_level?: string;

  @Column({ type: DataType.STRING, allowNull: true })
  work_place?: string;

  @Column({ type: DataType.STRING, allowNull: true })
  job_title?: string;

  @Column({ type: DataType.STRING, allowNull: true })
  orientation?: string;

  @Column({ type: DataType.STRING, allowNull: true })
  relationship_type?: string;

  @Column({ type: DataType.STRING, allowNull: true })
  looking_for_gender?: string;

  @Column({ type: DataType.STRING, allowNull: true })
  looking_for_intention?: string;

  @Column({ type: DataType.STRING, allowNull: true })
  ethnicity?: string;

  @Column({ type: DataType.STRING, allowNull: true })
  hometown?: string;

  @Column({ type: DataType.STRING, allowNull: true })
  family_children_status?: string;

  @Column({ type: DataType.STRING, allowNull: true })
  family_want_children?: string;

  @Column({ type: DataType.STRING, allowNull: true })
  religion?: string;

  @Column({ type: DataType.STRING, allowNull: true })
  political_beliefs?: string;

  @Column({ type: DataType.STRING, allowNull: true })
  drink?: string;

  @Column({ type: DataType.STRING, allowNull: true })
  smoke?: string;

  @Column({ type: DataType.JSON, allowNull: true })
  hobbies?: string[];

  @Column({ type: DataType.JSON, allowNull: true })
  interests?: string[];

  @Column({ type: DataType.JSON, allowNull: true })
  languages?: string[];

  @Column({ type: DataType.STRING, allowNull: true })
  location?: string;

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  is_profile_completed!: boolean;

  
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  is_admin_blocked!: boolean;

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  is_image_verified!: boolean;

  @BelongsTo(() => User)
  user?: User;

  @BelongsTo(() => UserLocation, { foreignKey: 'user_id', targetKey: 'user_id' })
  user_location?: UserLocation;

  @HasMany(() => UserImage, { foreignKey: 'user_id', sourceKey: 'user_id' })
  images?: UserImage[];
}