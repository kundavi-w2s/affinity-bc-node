import { Model, ModelCtor } from 'sequelize-typescript';
import { FindAndCountOptions } from 'sequelize';

export interface PaginationParams<T extends Model> extends Omit<FindAndCountOptions<T["_attributes"]>, "limit" | "offset"> {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  totalPages: number;     // ← Fixed: was broken!
  currentPage: number;    // ← Fixed indentation & syntax
  limit: number;
}

export class PaginationUtil {
  static async paginate<T extends Model>(
    model: ModelCtor<T>,
    { page = 1, limit = 10, ...options }: PaginationParams<T> = {} // ← Add = {} for safety
  ): Promise<PaginatedResult<T>> {
    const validPage = page < 1 ? 1 : page;
    const validLimit = limit < 1 ? 10 : limit;
    const offset = (validPage - 1) * validLimit;

    const { count, rows } = await model.findAndCountAll({
      ...options,
      limit: validLimit,
      offset,
    });

    const totalPages = validLimit > 0 ? Math.ceil(count / validLimit) : 1;

    return {
      data: rows,
      total: count,
      totalPages,
      currentPage: validPage,
      limit: validLimit,
    };
  }
}