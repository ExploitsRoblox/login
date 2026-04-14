const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();

const SECRET = process.env.JWT_SECRET || "stevejobs"; // use variável de ambiente no Render

app.use(express.json());
app.use(cors({ origin: "https://exploitsroblox.github.io" }));

//MongoDB
mongoose.connect("mongodb+srv://Admin:cleusaaposentou@nexusgames.96iuubq.mongodb.net/?appName=nexusgames")
  .then(() => console.log("Conectado ao MongoDB Atlas"))
  .catch(err => console.error("Erro na conexão:", err));

// Modelo Usuario
const Usuario = mongoose.model('Usuario', new mongoose.Schema({
  nome: { type: String, unique: true },
  senha: String
}));

// Modelo Backup
const Backup = mongoose.model('Backup', new mongoose.Schema({
  usuario: { type: String, required: true, unique: true },
  dados: { type: Object, default: {} },
  atualizadoEm: { type: Date, default: Date.now }
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

    res.json({ ok: true, mensagem: "Conta criada com sucesso!" });
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

    const token = jwt.sign({ nome: usuario.nome }, SECRET, { expiresIn: "1h" });
    res.json({ ok: true, mensagem: "Login realizado com sucesso!", token });
  } catch (err) {
    res.status(500).json({ ok: false, mensagem: "Erro no login: " + err.message });
  }
});

function autenticar(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).send("Token não fornecido!");

  jwt.verify(token, SECRET, (err, usuario) => {
    if (err) return res.status(403).send("Token inválido!");
    req.usuario = usuario; // guarda info do usuário
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


app.get("/dadosSecretos", autenticar, (req, res) => {
  res.send(`Bem-vindo, ${req.usuario.nome}! Aqui estão seus dados secretos.`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
