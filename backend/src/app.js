import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import membersRouter from "./routes/members.js";
import matchingRouter from "./routes/matching.js";
import chatRouter from "./routes/chat.js";
import courtsRouter from "./routes/courts.js";
import forumRouter from "./routes/forum.js";

const app = express();

app.set("trust proxy", 1);

app.use(cors({
  origin: config.env === "production" ? false : ["http://localhost:3000", "http://127.0.0.1:5500"],
  credentials: true,
}));

app.use(express.json({ limit: "128kb" }));
app.use(cookieParser());

const limiter = rateLimit({
  windowMs: 60_000,
  max: config.rateLimit.perMinute,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: "RATE_LIMITED", message: "Too many requests", details: null },
});
app.use(limiter);

app.use("/v1", healthRouter);
app.use("/v1/auth", authRouter);
app.use("/v1/members", membersRouter);
app.use("/v1/matches", matchingRouter);
app.use("/v1/chat", chatRouter);
app.use("/v1/courts", courtsRouter);
app.use("/v1/forum", forumRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
