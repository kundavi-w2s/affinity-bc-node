
import MasterItem from "../../models/master_item";
import { MASTER_KEYS } from "../../utils/constants";

export class MasterRepository {
    // Generic: fetch multiple keys in one query and return full rows
    getItemsByKeys = async (keys: string[]) => {
        if (!keys || keys.length === 0) return [];
        const rows = await MasterItem.findAll({ where: { key: keys }, order: [['key', 'ASC'], ['id', 'ASC']] });
        return rows.map(r => ({ id: r.id, key: (r as any).key, value: r.value, is_active: r.is_active }));
    }
}