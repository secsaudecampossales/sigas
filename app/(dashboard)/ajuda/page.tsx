import Link from "next/link";

/**
 * Ajuda rápida do sistema: o que é cada fluxo, quem faz o quê e glossário.
 * Página estática (somente leitura) acessível a qualquer perfil autenticado.
 */
const FLUXOS = [
  {
    titulo: "Registrar uma entrada",
    passos: [
      "Abra Entradas no menu (ou “Nova entrada” no dashboard).",
      "Escolha o produto, o almoxarifado (já vem pré-preenchido quando você só tem um) e a quantidade.",
      "Informe o tipo de entrada (compra, devolução, doação...) e, se tiver, a nota fiscal.",
      "Clique em “Registrar entrada” — o saldo sobe na hora.",
    ],
  },
  {
    titulo: "Registrar uma saída",
    passos: [
      "Abra Saídas no menu (ou “Nova saída” no dashboard).",
      "Escolha o produto, o almoxarifado de origem e a quantidade.",
      "O saldo disponível aparece antes de confirmar — a saída nunca deixa o estoque negativo.",
      "Após confirmar, gere o comprovante em PDF: as duas partes digitam o nome e assinam.",
    ],
  },
  {
    titulo: "Solicitar materiais",
    passos: [
      "Quem precisa cria a solicitação (Solicitações → Nova) informando setor, itens e quantidades.",
      "O gestor analisa e aprova (total ou parcial) ou rejeita com justificativa.",
      "O almoxarife inicia o atendimento, baixa o estoque e marca como atendida.",
      "Solicitação cancelada pelo solicitante também é registrada na auditoria.",
    ],
  },
  {
    titulo: "Transferir entre almoxarifados",
    passos: [
      "Crie a transferência informando origem, destino, itens e observações.",
      "A origem confirma a saída (o estoque sai de lá).",
      "O destino confirma o recebimento (o estoque entra aqui) — é a assinatura das duas partes.",
      "Qualquer das partes pode cancelar antes do recebimento.",
    ],
  },
  {
    titulo: "Fazer um inventário",
    passos: [
      "Abra o inventário escolhendo o almoxarifado (um por vez).",
      "A abertura congela o saldo esperado; conte o que existe fisicamente.",
      "Divergências pedem justificativa antes de finalizar.",
      "O ajuste cria movimentações de correção e o inventário é concluído.",
    ],
  },
  {
    titulo: "Emitir relatórios",
    passos: [
      "Abra Relatórios, escolha o período e o tipo (estoque, movimentações, solicitações...).",
      "A pré-visão aparece na tela; o botão gera o PDF com o mesmo filtro.",
      "Relatórios respeitam o seu perfil: você só vê os almoxarifados que tem acesso.",
    ],
  },
];

const PERFIS = [
  {
    perfil: "Administrador",
    acesso: "Acesso total: usuários, configurações, auditoria e todos os módulos.",
  },
  {
    perfil: "Gestor",
    acesso:
      "Analisa e aprova solicitações, vê relatórios e auditoria. Não mexe em cadastros.",
  },
  {
    perfil: "Operador do almoxarifado",
    acesso:
      "Cadastra produtos, registra entradas e saídas, atende solicitações, faz transferências e inventários.",
  },
  {
    perfil: "Solicitante",
    acesso:
      "Cria solicitações e acompanha o próprio histórico. Vê o estoque para conferir disponibilidade.",
  },
  {
    perfil: "Consulta",
    acesso: "Somente leitura: estoque, movimentações e relatórios.",
  },
];

const GLOSSARIO = [
  {
    termo: "Saldo físico",
    definicao: "Quantidade real do produto no almoxarifado.",
  },
  {
    termo: "Saldo reservado",
    definicao:
      "Quantidade “guardada” para uma demanda futura. Hoje nenhum fluxo reserva — fica sempre 0.",
  },
  {
    termo: "Saldo disponível",
    definicao: "Físico menos reservado — o que pode sair agora.",
  },
  {
    termo: "Abaixo do mínimo",
    definicao:
      "Saldo menor que o estoque mínimo do produto. É um alerta informativo: não bloqueia movimentações.",
  },
  {
    termo: "Ponto de reordenação",
    definicao: "Nível em que vale repor o estoque. Apenas informativo.",
  },
  {
    termo: "Documento / NF",
    definicao:
      "Referência do papel que autoriza a movimentação (nota fiscal, requisição...). Opcional.",
  },
  {
    termo: "Auditoria",
    definicao:
      "Registro automático de quem fez o quê e quando. Nada é apagado — ações de teste podem ser removidas por administrador.",
  },
  {
    termo: "Comprovante de saída",
    definicao:
      "PDF com as assinaturas de quem entregou e quem recebeu — disponível na página de Saídas.",
  },
];

export default async function AjudaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Ajuda</h1>
        <p className="text-sm text-slate-600">
          Guia rápido do SIGAS Saúde: como executar cada fluxo, o que cada
          perfil pode fazer e o que significam os termos do sistema.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-medium text-slate-900">Fluxos do dia a dia</h2>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {FLUXOS.map((fluxo) => (
            <article
              key={fluxo.titulo}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <h3 className="font-medium text-slate-900">{fluxo.titulo}</h3>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-sm text-slate-600">
                {fluxo.passos.map((passo) => (
                  <li key={passo}>{passo}</li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-medium text-slate-900">
          O que cada perfil pode fazer
        </h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {PERFIS.map((perfil) => (
            <li key={perfil.perfil} className="py-3 text-sm">
              <p className="font-medium text-slate-900">{perfil.perfil}</p>
              <p className="mt-0.5 text-slate-600">{perfil.acesso}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          O menu lateral já mostra apenas os módulos do seu perfil. Para trocar
          de perfil ou almoxarifados, fale com um administrador.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-medium text-slate-900">Glossário</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {GLOSSARIO.map((item) => (
            <div
              key={item.termo}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3"
            >
              <dt className="text-sm font-medium text-slate-900">
                {item.termo}
              </dt>
              <dd className="mt-0.5 text-sm text-slate-600">
                {item.definicao}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-medium text-slate-900">Sua conta</h2>
        <p className="mt-2 text-sm text-slate-600">
          Seu nome e sua senha ficam em{" "}
          <Link
            href="/conta"
            className="font-medium text-sky-700 hover:underline"
          >
            Minha conta
          </Link>{" "}
          (link no cabeçalho). Para alterar perfil, almoxarifados ou status de
          outro usuário, acesse Usuários (somente administradores).
        </p>
      </section>
    </div>
  );
}
