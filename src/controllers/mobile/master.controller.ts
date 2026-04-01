import { APP_CONSTANTS } from "../../utils/constants"
import { MasterService } from "../../services/mobile/master.service"

export class MasterController {
    public masterService: MasterService
    constructor() {
        this.masterService = new MasterService()
    }
    getAllMasterData = async (req: any, res: any) => {
        try {
            const data = await this.masterService.getAllMasterData()
            return res.status(data.responseCode).json(data);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server).json({ message: error.message });
        }
    }
}