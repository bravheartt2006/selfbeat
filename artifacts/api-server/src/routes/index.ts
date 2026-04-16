import { Router, type IRouter } from "express";
import healthRouter from "./health";
import selfbeatRouter from "./selfbeat";
import usersRouter from "./users";
import stripeRouter from "./stripe";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/users", usersRouter);
router.use("/stripe", stripeRouter);
router.use(selfbeatRouter);

export default router;
