import { Router } from "express";
import { MasterController } from "../../controllers/mobile/master.controller";

export class masterRoutes {
    router: Router;
    public masterController: MasterController = new MasterController()
    constructor() {
        this.router = Router();
        this.routes();
    }
    routes() {
        // Single endpoint for all master data
        this.router.get("/get_all_master_data", this.masterController.getAllMasterData);
    }
}