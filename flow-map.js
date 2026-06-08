import React, { useCallback } from "react";
import { createRoot } from "react-dom/client";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow
} from "https://esm.sh/@xyflow/react@12.6.4?external=react,react-dom";

const h = React.createElement;

function FlowCard({ data }) {
  return h(
    "article",
    { className: `flow-node ${data.variant || "start"}` },
    h(Handle, { type: "target", position: Position.Left }),
    h("span", { className: "kind" }, data.kind),
    h("h2", null, data.title),
    h("p", null, data.text),
    data.items?.length
      ? h("ul", null, data.items.map((item) => h("li", { key: item }, item)))
      : null,
    h(Handle, { type: "source", position: Position.Right })
  );
}

function NoteCard({ data }) {
  return h(
    "aside",
    { className: "flow-note" },
    h("strong", null, data.title),
    h("p", null, data.text)
  );
}

function SectionCard({ data }) {
  return h("div", { className: "flow-section" }, data.title);
}

const nodeTypes = {
  flowCard: FlowCard,
  note: NoteCard,
  section: SectionCard
};

const nodes = [
  section("sec-entry", "Entrada e decisao inicial", 0, -140),
  card("start", "Entrada", "Cliente chama no WhatsApp", "O fluxo começa quando o cliente entra por um canal do Despachante Marcelino.", 0, 0, "start"),
  card("channel", "Conferencia", "Identifica a unidade", "O fluxo entende por qual canal o cliente chegou e mantém cada unidade na sua própria fila.", 340, 0, "decision"),
  card("partner", "Decisao", "Cliente é parceiro?", "Se tiver etiqueta Parceiro, o fluxo não usa etiqueta antiga de atendente para decidir o destino.", 680, -150, "decision"),
  card("partner-note", "Nota interna", "Registra que é parceiro", "O chat recebe uma nota interna explicando que vai seguir pela fila da unidade.", 1020, -150, "special"),
  card("owner", "Decisao", "Cliente tem atendente marcada?", "Se o contato tiver uma etiqueta de atendente válida para Florianópolis, o fluxo tenta voltar para essa responsável.", 680, 150, "decision"),
  card("owner-check", "Conferencia", "Confere se a responsável pode receber", "O sistema do Arthur verifica se a atendente está disponível no momento.", 1020, 150, "decision"),
  card("owner-transfer", "Transferencia", "Volta para a responsável", "Se a responsável puder receber, o atendimento volta para ela e fica em esperando para continuar.", 1360, 150, "transfer"),
  card("queue", "Fila", "Vai para a fila principal", "Quando não existe responsável válida, ou ela não pode receber, o sistema do Arthur usa a ordem da fila.", 1360, -150, "decision", [
    "Bruna",
    "Isa",
    "Julia",
    "Kenia",
    "Ana"
  ]),
  card("queue-check", "Fila", "Confere a vez de cada atendente", "O sistema do Arthur verifica quem está disponível e quem é a próxima da fila.", 1700, -150, "decision"),
  card("queue-transfer", "Transferencia", "Transfere para a próxima", "Quando encontra a pessoa certa, transfere e adiciona a etiqueta dela no contato.", 2040, -150, "transfer"),

  section("sec-menu", "Boas-vindas e escolha do servico", 2040, 270),
  card("welcome", "Mensagem", "Boas-vindas", "O cliente recebe a apresentação do Despachante Marcelino.", 2040, 390, "start"),
  card("menu", "Menu", "Cliente escolhe o serviço", "O fluxo mostra as opções principais para entender o que o cliente precisa.", 2380, 390, "decision", [
    "Veículo apreendido",
    "Licenciamento",
    "Transferência",
    "Primeiro emplacamento",
    "ATPV",
    "Outros assuntos"
  ]),

  section("sec-services", "Caminhos dos servicos", 2820, 40),
  card("patio", "Servico", "Veículo apreendido ou pátio", "Este caminho é especial. No fluxo principal, o atendimento de pátio vai para Isa.", 2820, -170, "special"),
  card("patio-check", "Conferencia", "Isa pode receber?", "O sistema do Arthur verifica se Isa está disponível. Se não estiver, ainda assim o atendimento fica em esperando dela.", 3160, -170, "decision"),
  card("patio-wait", "Esperando", "Fica para Isa", "O cliente fica em um ponto seguro para Isa continuar assim que possível.", 3500, -170, "waiting"),

  card("licensing", "Servico", "Licenciamento", "Coleta placa, modelo e confirma se o cliente é proprietário.", 2820, 120, "service"),
  card("licensing-data", "Coleta", "Dados para orçamento", "Depois de receber as informações, o fluxo avisa que o orçamento será feito.", 3160, 120, "service"),
  card("licensing-wait", "Esperando", "Aguarda a atendente", "O atendimento deve parar aqui. Não deve voltar para a fila depois disso.", 3500, 120, "waiting"),

  card("transfer-doc", "Servico", "Transferência", "Explica os dados e documentos necessários para seguir com transferência de veículo.", 2820, 380, "service"),
  card("transfer-wait", "Esperando", "Continua com a responsável", "Depois das informações, o cliente fica aguardando a equipe dar sequência.", 3160, 380, "waiting"),

  card("first-plate", "Servico", "Primeiro emplacamento", "Coleta dados iniciais e orienta o cliente sobre o próximo passo.", 2820, 620, "service"),
  card("first-plate-wait", "Esperando", "Aguarda conferência", "O atendimento fica parado para a equipe continuar com segurança.", 3160, 620, "waiting"),

  card("atpv", "Servico", "ATPV e intenção de venda", "Pergunta a relação do cliente com o vendedor e orienta os documentos do comprador e vendedor.", 2820, 860, "service"),
  card("atpv-wait", "Esperando", "Aguarda documentos", "Depois das orientações, a equipe acompanha o envio e continua o atendimento.", 3160, 860, "waiting"),

  card("others", "Servico", "Outros assuntos", "O cliente explica com as próprias palavras o que precisa.", 2820, 1100, "service"),
  card("others-wait", "Esperando", "Equipe assume", "O atendimento fica disponível para a responsável atual entender o caso.", 3160, 1100, "waiting"),

  section("sec-after-hours", "Fora do horario", 0, 520),
  card("after-hours", "Horario", "Chegou fora do horário?", "Se o cliente chamar fora do horário, o fluxo orienta com calma e coleta o necessário para a equipe responder depois.", 0, 640, "decision"),
  card("after-menu", "Menu", "Escolhe o assunto", "Mesmo fora do horário, o cliente pode informar o serviço que precisa.", 340, 640, "service"),
  card("after-wait", "Esperando", "Fica para retorno", "O atendimento fica guardado para a equipe continuar no próximo horário de atendimento.", 680, 640, "waiting"),

  note("note-partner", "Parceiro", "Parceiro não fica preso em etiqueta antiga de atendente. Isso evita mandar o cliente para uma pessoa só porque ela participou no passado.", 1040, -430),
  note("note-owner", "Atendente marcada", "As etiquetas antigas não são apagadas. Elas ajudam a entender quem já cuidou do cliente. O fluxo só usa a etiqueta quando ela faz sentido para a unidade.", 1040, 420),
  note("note-queue", "Sistema do Arthur", "A fila não é aleatória. Quando uma atendente recebe, a próxima fica preparada para o atendimento seguinte.", 1700, -430),
  note("note-waiting", "Esperando", "Este é o ponto mais importante: quando o cliente entra em esperando, o fluxo deve parar. Assim ele não cai em outra atendente depois de responder.", 3500, 430),
  note("note-patio", "Pátio", "No fluxo principal, pátio é tratado como prioridade da Isa. Se ela não puder atender na hora, o cliente continua esperando por ela.", 3500, -430),
  note("note-409", "Aviso sobre 409", "Quando o histórico mostra 409, significa apenas que aquela atendente não era a próxima ou não podia receber. O fluxo segue para a próxima verificação.", 2040, -430),
  note("note-final", "Objetivo", "No final, todo cliente precisa cair em algum lugar seguro: responsável antiga, próxima da fila, Isa no pátio ou esperando para retorno.", 3500, 1080)
];

const edges = [
  edge("start", "channel"),
  edge("channel", "partner", "verifica parceiro", "warning"),
  edge("partner", "partner-note", "sim", "warning"),
  edge("partner-note", "queue", "segue fila"),
  edge("partner", "owner", "nao"),
  edge("owner", "owner-check", "tem etiqueta", "warning"),
  edge("owner-check", "owner-transfer", "pode receber", "positive"),
  edge("owner", "queue", "sem responsavel"),
  edge("owner-check", "queue", "nao pode agora"),
  edge("queue", "queue-check"),
  edge("queue-check", "queue-transfer", "proxima disponivel", "positive"),
  edge("queue-transfer", "welcome"),
  edge("owner-transfer", "welcome", "continua fluxo"),
  edge("welcome", "menu"),
  edge("menu", "patio", "1", "service-edge"),
  edge("patio", "patio-check"),
  edge("patio-check", "patio-wait", "Isa"),
  edge("menu", "licensing", "2", "service-edge"),
  edge("licensing", "licensing-data"),
  edge("licensing-data", "licensing-wait"),
  edge("menu", "transfer-doc", "3", "service-edge"),
  edge("transfer-doc", "transfer-wait"),
  edge("menu", "first-plate", "4", "service-edge"),
  edge("first-plate", "first-plate-wait"),
  edge("menu", "atpv", "5", "service-edge"),
  edge("atpv", "atpv-wait"),
  edge("menu", "others", "6", "service-edge"),
  edge("others", "others-wait"),
  edge("after-hours", "after-menu"),
  edge("after-menu", "after-wait")
];

function card(id, kind, title, text, x, y, variant, items = []) {
  return {
    id,
    type: "flowCard",
    position: { x, y },
    data: { kind, title, text, variant, items }
  };
}

function note(id, title, text, x, y) {
  return {
    id,
    type: "note",
    position: { x, y },
    data: { title, text },
    draggable: true
  };
}

function section(id, title, x, y) {
  return {
    id,
    type: "section",
    position: { x, y },
    data: { title },
    draggable: false,
    selectable: false
  };
}

function edge(source, target, label = "", className = "") {
  return {
    id: `${source}-${target}`,
    source,
    target,
    label,
    className,
    markerEnd: { type: MarkerType.ArrowClosed },
    type: "smoothstep"
  };
}

function FlowMap() {
  const { fitView } = useReactFlow();
  const onInit = useCallback(() => {
    window.setTimeout(() => fitView({ padding: 0.12, duration: 500 }), 80);
  }, [fitView]);

  return h(ReactFlow, {
    nodes,
    edges,
    nodeTypes,
    onInit,
    fitView: true,
    minZoom: 0.18,
    maxZoom: 1.2,
    defaultEdgeOptions: {
      animated: false,
      style: { stroke: "#647084" }
    },
    children: [
      h(Background, { key: "bg", color: "#cfd6e2", gap: 28 }),
      h(MiniMap, {
        key: "mini",
        pannable: true,
        zoomable: true,
        nodeStrokeWidth: 3,
        nodeColor: (node) => {
          if (node.type === "note") return "#fff3d8";
          if (node.type === "section") return "#172033";
          if (node.data?.variant === "waiting") return "#ffe8f1";
          if (node.data?.variant === "transfer") return "#e4f7ed";
          return "#eaf3ff";
        }
      }),
      h(Controls, { key: "controls", showInteractive: false })
    ]
  });
}

function App() {
  return h(ReactFlowProvider, null, h(FlowMap));
}

createRoot(document.getElementById("flow-root")).render(h(App));
