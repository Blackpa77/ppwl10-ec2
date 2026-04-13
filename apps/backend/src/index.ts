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

  // Redirect mahasiswa ke halaman login Google
  .get("/auth/login", ({ redirect }: { redirect: (url: string) => Response }) => {
    const oauth2Client = createOAuthClient();
    const url = getAuthUrl(oauth2Client);
    return redirect(url);
  })

  // Google callback setelah login
  .get("/auth/callback", async ({ query, set, cookie: { session }, redirect }: { query: Record<string, string>; set: { status: number }; cookie: { session: any }; redirect: (url: string) => Response }) => {
    const { code } = query as { code: string };

    if (!code) {
      set.status = 400;
      return { error: "Missing authorization code" };
    }

    const oauth2Client = createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    // Simpan token dengan session ID sederhana
    const sessionId = crypto.randomUUID();
    tokenStore.set(sessionId, {
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token ?? undefined,
    });
    if (!session) return;

    // Set cookie session
    session.value = sessionId;
    session.maxAge = 60 * 60 * 24; // 1 hari

    // Redirect ke frontend
    return redirect("http://localhost:5173/classroom");
  })

  // Cek status login
  .get("/auth/me", ({ cookie: { session } }: { cookie: { session: any } }) => {
    const sessionId = session?.value as string;
    if (!sessionId || !tokenStore.has(sessionId)) {
      return { loggedIn: false };
    }
    return { loggedIn: true, sessionId };
  })

  // Logout
  .post("/auth/logout", ({ cookie: { session } }: { cookie: { session: any } }) => {
    if(!session) return { success: false };

    const sessionId = session?.value as string;
    if (sessionId) {
      tokenStore.delete(sessionId);
      session.remove();
    }
    return { success: true };
  })

  // --- CLASSROOM ROUTES ---

  // Ambil daftar courses mahasiswa
  .get("/classroom/courses", async ({ cookie: { session }, set }: { cookie: { session: any }; set: { status: number } }) => {
    const sessionId = session?.value as string;
    const tokens = sessionId ? tokenStore.get(sessionId) : null;

    if (!tokens) {
      set.status = 401;
      return { error: "Unauthorized. Silakan login terlebih dahulu." };
    }

    const courses = await getCourses(tokens.access_token);
    return { data: courses, message: "Courses retrieved" };
  })

  // Ambil coursework + submisi untuk satu course
  .get("/classroom/courses/:courseId/submissions", async ({ params, cookie: { session }, set }: { params: Record<string, string>; cookie: { session: any }; set: { status: number } }) => {
    const sessionId = session?.value as string;
    const tokens = sessionId ? tokenStore.get(sessionId) : null;

    if (!tokens) {
      set.status = 401;
      return { error: "Unauthorized. Silakan login terlebih dahulu." };
    }

    const { courseId } = params;

    const [courseWorks, submissions] = await Promise.all([
      getCourseWorks(tokens.access_token, courseId),
      getSubmissions(tokens.access_token, courseId),
    ]);

    // Gabungkan coursework dengan submisi
    const submissionMap = new Map(submissions.map((s: any) => [s.courseWorkId, s]));

    const result = courseWorks.map((cw: any) => ({
      courseWork: cw,
      submission: submissionMap.get(cw.id) ?? null,
    }));

    return { data: result, message: "Course submissions retrieved" };
  })

  .listen(3000);

console.log(`🦊 Backend → http://localhost:${app.server?.port}`);
console.log(`🦊 FRONTEND_URL → ${process.env.FRONTEND_URL}`);
console.log(`📖 DATABASE_URL: ${process.env.DATABASE_URL}`);
console.log(`📖 GOOGLE_REDIRECT_URI: ${process.env.GOOGLE_REDIRECT_URI}`);
console.log(`📖 Swagger → http://localhost:${app.server?.port}/swagger`);

export type App = typeof app;
console.log(`🦊 Backend → http://localhost:3000`);
