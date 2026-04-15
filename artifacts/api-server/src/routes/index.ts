import { Router, type IRouter } from "express";
import healthRouter from "./health";
import selfbeatRouter from "./selfbeat";

const router: IRouter = Router();

router.use(healthRouter);
router.use(selfbeatRouter);

export default router;
