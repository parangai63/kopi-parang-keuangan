import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRoutes, apiRoutes } from "./routes";
import { errorMiddleware } from "./utils/httpError";

const app = express();

// Sesi memakai cookie, jadi CORS harus menyebut origin frontend secara eksplisit.
const origins = (process.env.KPK_CORS_ORIGIN ?? "http://localhost:5174")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "kopi-parang-keuangan-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api", apiRoutes);

// Fallback 404
app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use(errorMiddleware);

export default app;
