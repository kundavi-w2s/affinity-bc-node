import { Table, Model, Column, DataType, PrimaryKey, AutoIncrement, Default } from "sequelize-typescript";

@Table({
  tableName: "affinity_master_items",
  timestamps: true,
})
export default class MasterItem extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  id!: number;

  // grouping key, e.g. 'language', 'hobby', 'habit', 'education'
  @Column({ type: DataType.STRING, allowNull: false })
  key!: string;

  // human readable value
  @Column({ type: DataType.STRING, allowNull: false })
  value!: string;

  // active flag
  @Default(true)
  @Column({ type: DataType.BOOLEAN })
  is_active!: boolean;
}
