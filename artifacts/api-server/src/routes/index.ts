import { Router, type IRouter } from "express";
import healthRouter from "./health";
import selfbeatRouter from "./selfbeat";
import usersRouter from "./users";
import stripeRouter from "./stripe";
import authRouter from "./auth";
import trialRouter from "./trial";
import statsRouter from "./stats";
import votesRouter from "./votes";

const router: IRouter = Router();

router.use("/auth", authRouter);
router.use(healthRouter);
router.use("/users", usersRouter);
router.use("/stripe", stripeRouter);
router.use("/trial", trialRouter);
router.use(statsRouter);
router.use(votesRouter);
router.use(selfbeatRouter);

export default router;
