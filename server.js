const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();

const SECRET = process.env.JWT_SECRET || "stevejobs"; // use variável de ambiente no Render

app.use(express.json({ limit: '50mb' })); // Aumentar limite de tamanho
app.use(cors({
    origin: ["https://exploitsroblox.github.io", "http://localhost:3000", "http://localhost:5500"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

//MongoDB
mongoose.connect("mongodb+srv://Admin:cleusaaposentou@nexusgames.96iuubq.mongodb.net/?appName=nexusgames")
  .then(() => console.log("Conectado ao MongoDB Atlas"))
  .catch(err => console.error("Erro na conexão:", err));

// Modelo Usuario
const Usuario = mongoose.model('Usuario', new mongoose.Schema({
  nome: { type: String, unique: true },
  senha: String,
  moedas: { type: Number, default: 0 },
  isAdmin: { type: Boolean, default: false },
  jogosSecretos: [String],
  itensComprados: [String],
  tempo_jogo: { type: Number, default: 0 },
  tagPersonalizada: { type: String, default: '' },
  foto_perfil: { type: String, default: '' }
}));

// Modelo Backup
const Backup = mongoose.model('Backup', new mongoose.Schema({
  usuario: { type: String, required: true, unique: true },
  dados: { type: Object, default: {} },
  atualizadoEm: { type: Date, default: Date.now }
}));

// Modelo Compra (para rastrear compras na loja)
const Compra = mongoose.model('Compra', new mongoose.Schema({
  usuario: { type: String, required: true },
  itemId: { type: String, required: true },
  itemNome: { type: String, required: true },
  preco: { type: Number, required: true },
  data: { type: Date, default: Date.now }
}));

// Cadastro
// Registro
app.post("/registrar", async (req, res) => {
  try {
    const { nome, senha } = req.body;
    const existente = await Usuario.findOne({ nome });
    if (existente) {
      return res.status(400).json({ ok: false, mensagem: "Usuário já existe!" });
    }

    const hash = await bcrypt.hash(senha, 10);
    const novoUsuario = new Usuario({ nome, senha: hash });
    await novoUsuario.save();

    const token = jwt.sign({ nome: novoUsuario.nome, isAdmin: novoUsuario.isAdmin }, SECRET, { expiresIn: "1h" });
    res.json({ ok: true, mensagem: "Conta criada com sucesso!", token, isAdmin: novoUsuario.isAdmin });
  } catch (err) {
    res.status(500).json({ ok: false, mensagem: "Erro ao criar conta: " + err.message });
  }
});

app.get('/api/ultimo-commit', async (req, res) => {
    const owner = "exploitsroblox";
    const repo = "games";

    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits`, {
            headers: {
                "Authorization": `token ${process.env.GITHUB_TOKEN}`
            }
        });

        const commits = await response.json();
        const ultimoCommit = commits[0].commit.committer.date;
        res.json({ date: ultimoCommit });
    } catch (error) {
        res.status(500).json({ error: "Erro ao buscar commit" });
    }
});

// Teste de CORS
app.get('/teste-cors', (req, res) => {
  res.json({ ok: true, mensagem: "CORS funcionando corretamente!" });
});

// Login
app.post("/login", async (req, res) => {
  try {
    const { nome, senha } = req.body;
    const usuario = await Usuario.findOne({ nome });
    if (!usuario) {
      return res.status(400).json({ ok: false, mensagem: "Usuário não encontrado!" });
    }

    const valido = await bcrypt.compare(senha, usuario.senha);
    if (!valido) {
      return res.status(400).json({ ok: false, mensagem: "Senha incorreta!" });
    }

    const token = jwt.sign({ nome: usuario.nome, isAdmin: usuario.isAdmin }, SECRET, { expiresIn: "1h" });
    res.json({ ok: true, mensagem: "Login realizado com sucesso!", token, isAdmin: usuario.isAdmin });
  } catch (err) {
    res.status(500).json({ ok: false, mensagem: "Erro no login: " + err.message });
  }
});

function autenticar(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  
  console.log('[AUTH] Header:', authHeader?.substring(0, 50) + '...');
  console.log('[AUTH] Token existe:', !!token);
  
  if (!token) {
    console.log('[AUTH] ERRO: Token não fornecido!');
    return res.status(401).json({ ok: false, mensagem: "Token não fornecido!" });
  }

  jwt.verify(token, SECRET, (err, usuario) => {
    if (err) {
      console.log('[AUTH] ERRO ao verificar token:', err.message);
      return res.status(403).json({ ok: false, mensagem: "Token inválido ou expirado! " + err.message });
    }
    console.log('[AUTH] Token válido para usuário:', usuario.nome);
    req.usuario = usuario;
    next();
  });
}


// Salvar backup (rota protegida)
app.post("/salvarBackup", autenticar, async (req, res) => {
  try {
    const { dados } = req.body;
    await Backup.updateOne(
      { usuario: req.usuario.nome },
      { dados, atualizadoEm: new Date() },
      { upsert: true }
    );
    res.json({ ok: true, mensagem: "Backup salvo com sucesso!" });
  } catch (err) {
    res.status(500).json({ ok: false, mensagem: "Erro ao salvar backup: " + err.message });
  }
});

app.get("/carregarBackup", autenticar, async (req, res) => {
  try {
    const backup = await Backup.findOne({ usuario: req.usuario.nome });
    if (!backup) {
      return res.json({ ok: false, dados: {}, mensagem: "Nenhum backup encontrado." });
    }
    res.json({ ok: true, dados: backup.dados });
  } catch (err) {
    console.error("Erro ao carregar backup:", err);
    res.status(500).json({ ok: false, mensagem: "Erro ao carregar backup: " + err.message });
  }
});

// === ROTAS DE ADMIN ===
function verificarAdmin(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ ok: false, mensagem: "Acesso negado! Token de administrador inválido." });
  }
  next();
}

app.post("/admin/adicionar-moedas", autenticar, verificarAdmin, async (req, res) => {
  try {
    const { nomeUsuario, quantidade } = req.body;
    const usuario = await Usuario.findOne({ nome: nomeUsuario });
    
    if (!usuario) {
      return res.status(404).json({ ok: false, mensagem: "Usuário não encontrado!" });
    }
    
    usuario.moedas = (usuario.moedas || 0) + quantidade;
    await usuario.save();
    
    res.json({ ok: true, mensagem: `✅ ${quantidade} moedas adicionadas a ${nomeUsuario}!` });
  } catch (err) {
    res.status(500).json({ ok: false, mensagem: "Erro: " + err.message });
  }
});

app.post("/admin/desbloquear-jogo", autenticar, verificarAdmin, async (req, res) => {
  try {
    const { nomeUsuario, jogoId } = req.body;
    const usuario = await Usuario.findOne({ nome: nomeUsuario });
    
    if (!usuario) {
      return res.status(404).json({ ok: false, mensagem: "Usuário não encontrado!" });
    }
    
    if (!usuario.jogosSecretos.includes(jogoId)) {
      usuario.jogosSecretos.push(jogoId);
      await usuario.save();
    }
    
    res.json({ ok: true, mensagem: `✅ Jogo ${jogoId} desbloqueado para ${nomeUsuario}!` });
  } catch (err) {
    res.status(500).json({ ok: false, mensagem: "Erro: " + err.message });
  }
});

app.post("/admin/adicionar-item", autenticar, verificarAdmin, async (req, res) => {
  try {
    const { nomeUsuario, itemId } = req.body;
    const usuario = await Usuario.findOne({ nome: nomeUsuario });
    
    if (!usuario) {
      return res.status(404).json({ ok: false, mensagem: "Usuário não encontrado!" });
    }
    
    if (!usuario.itensComprados.includes(itemId)) {
      usuario.itensComprados.push(itemId);
      await usuario.save();
    }
    
    res.json({ ok: true, mensagem: `✅ Item ${itemId} adicionado a ${nomeUsuario}!` });
  } catch (err) {
    res.status(500).json({ ok: false, mensagem: "Erro: " + err.message });
  }
});

app.post("/admin/definir-admin", autenticar, verificarAdmin, async (req, res) => {
  try {
    const { nomeUsuario } = req.body;
    const usuario = await Usuario.findOne({ nome: nomeUsuario });
    
    if (!usuario) {
      return res.status(404).json({ ok: false, mensagem: "Usuário não encontrado!" });
    }
    
    usuario.isAdmin = true;
    await usuario.save();
    
    res.json({ ok: true, mensagem: `✅ ${nomeUsuario} agora é um administrador!` });
  } catch (err) {
    res.status(500).json({ ok: false, mensagem: "Erro: " + err.message });
  }
});

app.get("/admin/listar-usuarios", autenticar, verificarAdmin, async (req, res) => {
  try {
    const usuarios = await Usuario.find({}, { nome: 1, moedas: 1, isAdmin: 1, _id: 0 });
    res.json({ ok: true, usuarios });
  } catch (err) {
    res.status(500).json({ ok: false, mensagem: "Erro: " + err.message });
  }
});

// === ENDPOINTS DE LEADERBOARD ===
app.get("/leaderboard", async (req, res) => {
  try {
    const usuarios = await Usuario.find({}, { nome: 1, tempo_jogo: 1, moedas: 1, foto_perfil: 1, _id: 0 })
      .sort({ tempo_jogo: -1 })
      .limit(10)
      .lean(); // Converter para objeto puro do JavaScript
    
    // Distribuir prêmios
    const usuariosComPremio = usuarios.map((user, index) => {
      let premio = 0;
      if (index === 0) premio = 10000;
      else if (index === 1) premio = 5000;
      else if (index === 2) premio = 2000;
      else if (index >= 3 && index <= 9) premio = 1500;
      
      return {
        nome: user.nome,
        tempo_jogo: user.tempo_jogo || 0,
        moedas: user.moedas || 0,
        foto_perfil: user.foto_perfil || '',
        premio: premio,
        posicao: index + 1
      };
    });
    
    console.log('[LEADERBOARD] Retornando:', usuariosComPremio.length, 'usuários');
    res.json({ ok: true, usuarios: usuariosComPremio });
  } catch (err) {
    console.error('[LEADERBOARD] Erro:', err);
    res.status(500).json({ ok: false, mensagem: "Erro ao obter leaderboard: " + err.message });
  }
});

// === ENDPOINTS DE COMPRAS ===
app.post("/registrar-compra", autenticar, async (req, res) => {
  try {
    const { itemId, itemNome, preco } = req.body;
    const novaCompra = new Compra({
      usuario: req.usuario.nome,
      itemId,
      itemNome,
      preco
    });
    await novaCompra.save();
    res.json({ ok: true, mensagem: "Compra registrada!" });
  } catch (err) {
    res.status(500).json({ ok: false, mensagem: "Erro: " + err.message });
  }
});

app.get("/admin/compras", autenticar, verificarAdmin, async (req, res) => {
  try {
    const compras = await Compra.find({}).sort({ data: -1 }).limit(20);
    res.json({ ok: true, compras });
  } catch (err) {
    res.status(500).json({ ok: false, mensagem: "Erro: " + err.message });
  }
});

// === ENDPOINTS DE TAG PERSONALIZADA ===
app.post("/definir-tag", autenticar, async (req, res) => {
  try {
    const { tag } = req.body;
    
    if (!tag || tag.length < 1 || tag.length > 10) {
      return res.status(400).json({ ok: false, mensagem: "Tag deve ter entre 1 e 10 caracteres!" });
    }
    
    const usuario = await Usuario.findOne({ nome: req.usuario.nome });
    usuario.tagPersonalizada = tag;
    await usuario.save();
    
    res.json({ ok: true, mensagem: `✅ Tag personalizada definida para: ${tag}` });
  } catch (err) {
    res.status(500).json({ ok: false, mensagem: "Erro: " + err.message });
  }
});

// === ENDPOINT PARA ATUALIZAR TEMPO DE JOGO ===
app.post("/atualizar-tempo-jogo", autenticar, async (req, res) => {
  try {
    const { minutos } = req.body;
    const usuario = await Usuario.findOne({ nome: req.usuario.nome });
    usuario.tempo_jogo = (usuario.tempo_jogo || 0) + minutos;
    await usuario.save();
    res.json({ ok: true, mensagem: "Tempo atualizado!" });
  } catch (err) {
    res.status(500).json({ ok: false, mensagem: "Erro: " + err.message });
  }
});


app.get("/dadosSecretos", autenticar, (req, res) => {
  res.send(`Bem-vindo, ${req.usuario.nome}! Aqui estão seus dados secretos.`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));