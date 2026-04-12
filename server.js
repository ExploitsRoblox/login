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

// Modelo
const Usuario = mongoose.model('Usuario', new mongoose.Schema({
  nome: { type: String, unique: true },
  senha: String
}));

// Cadastro
app.post('/registrar', async (req, res) => {
  try {
    const { nome, senha } = req.body;
    if (!nome || !senha) {
      return res.status(400).send("Nome e senha são obrigatórios.");
    }

    const usuarioExistente = await Usuario.findOne({ nome });
    if (usuarioExistente) {
      return res.status(400).send("Usuário já existe!");
    }

    const hash = await bcrypt.hash(senha, 10);
    const novoUsuario = new Usuario({ nome, senha: hash });
    await novoUsuario.save();
    res.send("Conta criada com sucesso!");
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).send("Usuário já existe!");
    }
    res.status(500).send("Erro ao criar conta: " + err.message);
  }
});

// Login
app.post('/login', async (req, res) => {
  try {
    const { nome, senha } = req.body;
    const usuario = await Usuario.findOne({ nome });
    if (!usuario) return res.status(401).send("Usuário não encontrado!");

    const valido = await bcrypt.compare(senha, usuario.senha);
    if (!valido) return res.status(401).send("Senha incorreta!");

    // Gerar token JWT
    const token = jwt.sign({ nome: usuario.nome }, SECRET, { expiresIn: "1h" });

    res.json({ ok: true, mensagem: "Login realizado com sucesso!", token });
  } catch (err) {
    res.status(500).send("Erro no login: " + err.message);
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

app.get("/dadosSecretos", autenticar, (req, res) => {
  res.send(`Bem-vindo, ${req.usuario.nome}! Aqui estão seus dados secretos.`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
