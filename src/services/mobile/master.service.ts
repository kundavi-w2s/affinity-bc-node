
import { APP_CONSTANTS, MASTER_KEYS } from "../../utils/constants";
import { MasterRepository } from "../../repositories/mobile/master.repository";
import { APILogger } from "../../utils/logger";

export class MasterService {
    public Logger = new APILogger();
    public MasterRepository: MasterRepository = new MasterRepository()
    constructor() {
        this.Logger = new APILogger();
        this.MasterRepository = new MasterRepository()
    }

    getAllMasterData = async () => {
        try {
            // Single DB call for all required keys
            const keys = [
                MASTER_KEYS.EDUCATION,
                MASTER_KEYS.RELATIONSHIP,
                MASTER_KEYS.LOOKING_FOR,
                MASTER_KEYS.FAMILY_CHILDREN_HAVE,
                MASTER_KEYS.FAMILY_CHILDREN_WANT,
                MASTER_KEYS.HABIT,
                MASTER_KEYS.HOBBY,
                MASTER_KEYS.POLITICAL_BELIEF,
                MASTER_KEYS.ETHNICITY,
                MASTER_KEYS.RELIGION,
                MASTER_KEYS.LANGUAGE
            ];

            const rows = await this.MasterRepository.getItemsByKeys(keys);

            // Group by key
            const grouped: Record<string, Array<{ id: number; value: string; is_active: boolean }>> = {};
            for (const r of rows) {
                if (!grouped[r.key]) grouped[r.key] = [];
                grouped[r.key].push({ id: r.id, value: r.value, is_active: r.is_active });
            }

            this.Logger.success('All master data fetched successfully (single query)');

            // Single mapping pass to transform groups into previous shapes
            const education = (grouped[MASTER_KEYS.EDUCATION] || []).map(i => ({ id: i.id, education: i.value }));
            const relationship = (grouped[MASTER_KEYS.RELATIONSHIP] || []).map(i => ({ id: i.id, relationship_type: i.value }));
            const looking_for = (grouped[MASTER_KEYS.LOOKING_FOR] || []).map(i => ({ id: i.id, looking_for: i.value }));

            const family_have_children = (grouped[MASTER_KEYS.FAMILY_CHILDREN_HAVE] || []).map(i => ({ id: i.id, have_children: i.value, want_children: '' }));
            const family_want_children = (grouped[MASTER_KEYS.FAMILY_CHILDREN_WANT] || []).map(i => ({ id: i.id, have_children: '', want_children: i.value }));

            const habits = (grouped[MASTER_KEYS.HABIT] || []).map(i => ({ id: i.id, habit_value: i.value }));
            const hobbies = (grouped[MASTER_KEYS.HOBBY] || []).map(i => ({ id: i.id, hobbies: i.value, is_active: i.is_active }));
            const political_beliefs = (grouped[MASTER_KEYS.POLITICAL_BELIEF] || []).map(i => ({ id: i.id, political_belief: i.value }));
            const ethnicity = (grouped[MASTER_KEYS.ETHNICITY] || []).map(i => ({ id: i.id, ethnicity: i.value }));
            const religion = (grouped[MASTER_KEYS.RELIGION] || []).map(i => ({ id: i.id, religion: i.value }));
            const language = (grouped[MASTER_KEYS.LANGUAGE] || []).map(i => ({ id: i.id, language: i.value }));

            return {
                data: {
                    education,
                    relationship,
                    looking_for,
                    family_have_children,
                    family_want_children,
                    habits,
                    hobbies,
                    political_beliefs,
                    ethnicity,
                    religion,
                    language
                },
                status: true,
                responseCode: APP_CONSTANTS.code.status_success_code
            };
        }
        catch (error) {
            this.Logger.error(error as string);
            return ({
                message: APP_CONSTANTS.message.something_went_wrong,
                status: false,
                responseCode: APP_CONSTANTS.code.status_internal_server
            });
        }
    }

}