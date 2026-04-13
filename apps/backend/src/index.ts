import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { cookie } from "@elysiajs/cookie";
import { prisma } from "../prisma/db";
import { createOAuthClient, getAuthUrl } from "./auth";
import { getCourses, getCourseWorks, getSubmissions } from "./classroom";
import type { ApiResponse, HealthCheck, User } from "shared";

const tokenStore = new Map<string, { access_token: string; refresh_token?: string }>();

const app = new Elysia()
  .use(cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://44.222.193.229:5173"
    ],
    credentials: true
  }))
  .use(swagger())
  .use(cookie())

  .onRequest(({ request, set }) => {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/users")) {
      const origin = request.headers.get("origin");
      const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
      const key = url.searchParams.get("key");

      if (origin === frontendUrl) {
        return;
      }

      if (key !== process.env.API_KEY) {
        set.status = 401;
        return {
          message: "Unauthorized: Access denied without valid API Key",
        };
      }
    }
  })

  .get("/", (): ApiResponse<HealthCheck> => ({
    data: { status: "ok" },
    message: "server running",
  }))

  .get("/users", async (): Promise<ApiResponse<User[]>> => {
    const users = await prisma.user.findMany();
    return {
      data: users,
      message: "User list retrieved",
    };
  });

app.listen(3000);

console.log(`🦊 Backend → http://localhost:3000`);
