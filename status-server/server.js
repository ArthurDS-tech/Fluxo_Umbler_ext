/**
 * Servidor de status de disponibilidade — UTalk Atendente
 *
 * A extensão do navegador chama POST /status para atualizar o status.
 * O bot da Umbler Talk chama GET /status?memberId=xxx para consultar.
 *
 * Iniciar: node server.js
 * Porta padrão: 3000
 */

const http = require("http");
const PORT = process.env.PORT || 3000;

// Armazena em memória: { [memberId]: boolean }
// Em produção, substitua por Redis ou banco de dados.
const statusMap = {};

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight CORS
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // GET /status?memberId=xxx
  // Retorna se a atendente está disponível para receber novos chats.
  // Use este endpoint no webhook/condição do bot da Umbler Talk.
  if (req.method === "GET" && url.pathname === "/status") {
    const memberId = url.searchParams.get("memberId");

    if (!memberId) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: "memberId obrigatório" }));
      return;
    }

    // Se nunca foi definido, assume disponível
    const available = statusMap[memberId] !== false;

    res.writeHead(200);
    res.end(JSON.stringify({ memberId, available }));
    return;
  }

  // POST /status  body: { memberId, available }
  // Chamado pela extensão quando a atendente muda o status.
  if (req.method === "POST" && url.pathname === "/status") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { memberId, available } = JSON.parse(body);

        if (!memberId || typeof available !== "boolean") {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "memberId e available são obrigatórios" }));
          return;
        }

        statusMap[memberId] = available;
        console.log(`[${new Date().toISOString()}] ${memberId} → ${available ? "disponível" : "indisponível"}`);

        res.writeHead(200);
        res.end(JSON.stringify({ memberId, available }));
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "JSON inválido" }));
      }
    });
    return;
  }

  // GET /status/all — lista todos os status (útil para debug/admin)
  if (req.method === "GET" && url.pathname === "/status/all") {
    res.writeHead(200);
    res.end(JSON.stringify(statusMap));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Rota não encontrada" }));
});

server.listen(PORT, () => {
  console.log(`Servidor de status rodando em http://localhost:${PORT}`);
  console.log(`  GET  /status?memberId=xxx  → consulta disponibilidade`);
  console.log(`  POST /status               → atualiza disponibilidade`);
  console.log(`  GET  /status/all           → lista todos os status`);
});
