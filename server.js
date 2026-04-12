const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const app = express();

app.use(express.json());

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
    if (!usuario) return res.send("Usuário não encontrado!");
    const valido = await bcrypt.compare(senha, usuario.senha);
    if (valido) {
      res.send("Login realizado com sucesso!");
    } else {
      res.send("Senha incorreta!");
    }
  } catch (err) {
    res.send("Erro no login: " + err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
