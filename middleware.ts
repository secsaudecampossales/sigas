import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized: ({ token }) => Boolean(token),
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/produtos/:path*",
    "/estoque/:path*",
    "/entradas/:path*",
    "/saidas/:path*",
    "/solicitacoes/:path*",
    "/transferencias/:path*",
    "/inventarios/:path*",
    "/relatorios/:path*",
    "/usuarios/:path*",
    "/configuracoes/:path*",
    "/auditoria/:path*",
    "/api/produtos/:path*",
    "/api/estoque/:path*",
    "/api/movimentacoes/:path*",
    "/api/solicitacoes/:path*",
    "/api/transferencias/:path*",
    "/api/inventarios/:path*",
    "/api/usuarios/:path*",
  ],
};
