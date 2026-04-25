import { Router, type IRouter } from "express";
import healthRouter from "./health";
import selfbeatRouter from "./selfbeat";
import usersRouter from "./users";
import stripeRouter from "./stripe";
import authRouter from "./auth";
import trialRouter from "./trial";
import statsRouter from "./stats";
import votesRouter from "./votes";
import dailyQuestionRouter from "./dailyQuestion";
import adminRouter from "./admin";
import emailRouter from "./email";
import referralRouter from "./referral";
import giftsRouter from "./gifts";
import featuredRouter from "./featured";

const router: IRouter = Router();

router.use("/auth", authRouter);
router.use(healthRouter);
router.use("/users", usersRouter);
router.use("/stripe", stripeRouter);
router.use("/trial", trialRouter);
router.use(statsRouter);
router.use(votesRouter);
router.use(dailyQuestionRouter);
router.use("/admin", adminRouter);
router.use(emailRouter);
router.use(referralRouter);
router.use(giftsRouter);
router.use(featuredRouter);
router.use(selfbeatRouter);

export default router;
