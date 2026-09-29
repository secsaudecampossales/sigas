import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // No Prisma 7 o Prisma CLI usa este `url` para Migrate (`db push`,
    // `migrate`, etc.). Como antes usávamos `directUrl` para migrations,
    // passamos aqui a conexão direta (porta 5432) — e não o pooler.
    // `process.env` em vez de `env()`: assim `prisma generate` continua
    // funcionando em ambientes onde só existe a variável de runtime.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
