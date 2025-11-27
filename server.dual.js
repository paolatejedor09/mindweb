// server.dual.js - DUAL DB: SQL Server (local) + SQLite (Render)
// Generated to run SQL Server locally and SQLite on Render (process.env.RENDER === 'true')

const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Detect environment
const USE_SQLITE = process.env.RENDER === 'true' || process.env.USE_SQLITE === 'true';

// ==================== CONFIGURACIÓN PUERTO ====================
const PORT = process.env.PORT || 3000;
const app = express();
app.use(cors());
app.use(express.json());

// ==================== STATIC FILES ====================
app.use(express.static(path.join(__dirname, 'fronted')));
app.use('/imagvideos', express.static(path.join(__dirname, 'imagvideos')));

// ==================== JWT ====================
const JWT_SECRET = process.env.JWT_SECRET || 'salud_mental_secreto_2024';
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token de acceso requerido' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = { userId: decoded.userId, email: decoded.email };
    next();
  });
}

// ==================== DB: SQL Server config ====================
const dbConfig = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'salud123',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'Salud_mental',
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true }
};

let pool; // for sql server
let sqlite; // sqlite3.Database

async function connectSqlServer() {
  try {
    pool = await sql.connect(dbConfig);
    console.log('✅ Conectado a SQL Server -', dbConfig.database);
  } catch (err) {
    console.error('❌ Error conectando a SQL Server:', err.message || err);
  }
}

function initSqlite() {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.join(__dirname, 'database.db');
  sqlite = new sqlite3.Database(dbPath, (err) => {
    if (err) return console.error('❌ Error abriendo SQLite:', err.message);
    console.log('🟢 SQLite inicializado en', dbPath);
  });
}

// Initialize appropriate DB
if (USE_SQLITE) {
  initSqlite();
} else {
  connectSqlServer();
}

// Helper: run SQL Server with inputs builder
function sqlRequestFromParams(params = {}) {
  const req = pool.request();
  for (const p of Object.keys(params)) {
    const val = params[p];
    // infer type simply (could be improved)
    if (typeof val === 'number') req.input(p, sql.Int, val);
    else if (typeof val === 'boolean') req.input(p, sql.Bit, val);
    else if (val instanceof Date) req.input(p, sql.DateTime, val);
    else req.input(p, sql.NVarChar, val);
  }
  return req;
}

// Helper: promisified sqlite functions
function sqliteAll(q, params = []) {
  return new Promise((resolve, reject) => {
    sqlite.all(q, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}
function sqliteGet(q, params = []) {
  return new Promise((resolve, reject) => {
    sqlite.get(q, params, (err, row) => err ? reject(err) : resolve(row));
  });
}
function sqliteRun(q, params = []) {
  return new Promise((resolve, reject) => {
    sqlite.run(q, params, function(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

// Utility to convert simple SQL Server style to SQLite param style
function replaceSqlParams(query) {
  // replace @param with ? — note: order matters, endpoints below will provide params array in same order
  return query.replace(/@\w+/g, '?');
}

// ================ START ROUTES ================

// Serve index
app.get('/', (req, res) => {
  const filePath = path.join(__dirname, 'fronted', 'index.html');
  if (fs.existsSync(filePath)) return res.sendFile(filePath);
  return res.status(404).send('Archivo index.html no encontrado');
});

// ----------------- AUTH - REGISTER -----------------
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nombre, email, correo, password, contrasena } = req.body;
    const correoFinal = (email || correo || '').trim();
    const passwordFinal = (password || contrasena || '').trim();
    const nombreFinal = (nombre || '').trim();

    if (!correoFinal || !passwordFinal || !nombreFinal) return res.status(400).json({ error: 'Faltan datos obligatorios.' });

    const hashedPassword = await bcrypt.hash(passwordFinal, 10);

    if (USE_SQLITE) {
      // Ensure Usuarios table exists
      await sqliteRun(`CREATE TABLE IF NOT EXISTS Usuarios (IdUsuario INTEGER PRIMARY KEY AUTOINCREMENT, Nombre TEXT, Correo TEXT UNIQUE, Contrasena TEXT, Nivel INTEGER, Puntos INTEGER, FechaRegistro TEXT)`);
      // check existing
      const exists = await sqliteGet('SELECT IdUsuario FROM Usuarios WHERE Correo = ?', [correoFinal]);
      if (exists) return res.status(400).json({ error: 'El usuario ya existe.' });

      const insert = await sqliteRun('INSERT INTO Usuarios (Nombre, Correo, Contrasena, Nivel, Puntos, FechaRegistro) VALUES (?, ?, ?, 1, 0, datetime("now"))', [nombreFinal, correoFinal, hashedPassword]);
      const newUser = { IdUsuario: insert.lastID, Nombre: nombreFinal, Correo: correoFinal, FechaRegistro: new Date().toISOString(), Nivel: 1, Puntos: 0 };

      // ensure Perfil
      await sqliteRun('CREATE TABLE IF NOT EXISTS Perfil (IdPerfil INTEGER PRIMARY KEY AUTOINCREMENT, IdUsuario INTEGER, NombreCompleto TEXT, CorreoElectronico TEXT, FechaDeNacimiento TEXT, Genero TEXT, Biografia TEXT)');
      await sqliteRun('INSERT OR IGNORE INTO Perfil (IdUsuario) VALUES (?)', [newUser.IdUsuario]);

      const token = jwt.sign({ userId: newUser.IdUsuario, email: newUser.Correo }, JWT_SECRET, { expiresIn: '30d' });
      return res.json({ token, user: newUser });
    } else {
      // SQL Server path (original)
      const userCheck = await sqlRequestFromParams({ correo: correoFinal }).query('SELECT IdUsuario FROM Usuarios WHERE Correo = @correo');
      if (userCheck.recordset.length > 0) return res.status(400).json({ error: 'El usuario ya existe.' });

      const result = await sqlRequestFromParams({ nombre: nombreFinal, correo: correoFinal, contrasena: hashedPassword }).query(`INSERT INTO Usuarios (Nombre, Correo, Contrasena, Nivel, Puntos, FechaRegistro) OUTPUT INSERTED.IdUsuario, INSERTED.Nombre, INSERTED.Correo, INSERTED.FechaRegistro, INSERTED.Nivel, INSERTED.Puntos VALUES (@nombre, @correo, @contrasena, 1, 0, GETDATE())`);
      const newUser = result.recordset[0];

      try { await sqlRequestFromParams({ idUsuario: newUser.IdUsuario }).query('INSERT INTO Perfil (IdUsuario) VALUES (@idUsuario)'); } catch (e) {}

      const token = jwt.sign({ userId: newUser.IdUsuario, email: newUser.Correo }, JWT_SECRET, { expiresIn: '30d' });
      return res.json({ token, user: newUser });
    }
  } catch (error) {
    console.error('❌ Error en registro:', error.message || error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ----------------- AUTH - LOGIN -----------------
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, correo, password, contrasena } = req.body;
    const correoFinal = (email || correo || '').trim();
    const passwordFinal = (password || contrasena || '').trim();
    if (!correoFinal || !passwordFinal) return res.status(400).json({ error: 'Correo y contraseña requeridos.' });

    if (USE_SQLITE) {
      await sqliteRun(`CREATE TABLE IF NOT EXISTS Usuarios (IdUsuario INTEGER PRIMARY KEY AUTOINCREMENT, Nombre TEXT, Correo TEXT UNIQUE, Contrasena TEXT, Nivel INTEGER, Puntos INTEGER, FechaRegistro TEXT)`);
      const user = await sqliteGet('SELECT * FROM Usuarios WHERE Correo = ?', [correoFinal]);
      if (!user) return res.status(400).json({ error: 'Usuario no encontrado.' });
      const passwordMatch = await bcrypt.compare(passwordFinal, user.Contrasena);
      if (!passwordMatch) return res.status(401).json({ error: 'Contraseña incorrecta.' });
      const token = jwt.sign({ userId: user.IdUsuario, email: user.Correo }, JWT_SECRET, { expiresIn: '30d' });
      return res.json({ token, user });
    } else {
      const result = await sqlRequestFromParams({ correo: correoFinal }).query('SELECT * FROM Usuarios WHERE Correo = @correo');
      if (result.recordset.length === 0) return res.status(400).json({ error: 'Usuario no encontrado.' });
      const user = result.recordset[0];
      const passwordMatch = await bcrypt.compare(passwordFinal, user.Contrasena);
      if (!passwordMatch) return res.status(401).json({ error: 'Contraseña incorrecta.' });
      const token = jwt.sign({ userId: user.IdUsuario, email: user.Correo }, JWT_SECRET, { expiresIn: '30d' });
      return res.json({ token, user });
    }
  } catch (error) {
    console.error('❌ Error en login:', error.message || error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ----------------- EJERCICIOS - COMPLETAR -----------------
app.post('/api/ejercicios/completar', authenticateToken, async (req, res) => {
  try {
    const { idEjercicio } = req.body;
    const userId = req.user.userId;
    if (!idEjercicio) return res.status(400).json({ error: 'idEjercicio es requerido' });

    if (USE_SQLITE) {
      await sqliteRun('CREATE TABLE IF NOT EXISTS SesionesEjercicio (IdSesion INTEGER PRIMARY KEY AUTOINCREMENT, IdUsuario INTEGER, IdEjercicio INTEGER, FechaSesion TEXT, Completado INTEGER, RespuestaGratitud TEXT)');
      await sqliteRun('CREATE TABLE IF NOT EXISTS Ejercicios (IdEjercicio INTEGER PRIMARY KEY, Nombre TEXT)');
      const ejercicioCheck = await sqliteGet('SELECT IdEjercicio, Nombre FROM Ejercicios WHERE IdEjercicio = ?', [idEjercicio]);
      if (!ejercicioCheck) return res.status(400).json({ error: 'Ejercicio no encontrado' });
      const result = await sqliteRun('INSERT INTO SesionesEjercicio (IdUsuario, IdEjercicio, FechaSesion, Completado) VALUES (?, ?, datetime("now"), 1)', [userId, idEjercicio]);
      await sqliteRun('UPDATE Usuarios SET Puntos = COALESCE(Puntos,0) + 10 WHERE IdUsuario = ?', [userId]);
      return res.json({ success: true, message: 'Ejercicio guardado en base de datos', puntosGanados: 10, idSesion: result.lastID });
    } else {
      const ejercicioCheck = await sqlRequestFromParams({ idEjercicio }).query('SELECT IdEjercicio, Nombre FROM Ejercicios WHERE IdEjercicio = @idEjercicio');
      if (ejercicioCheck.recordset.length === 0) return res.status(400).json({ error: 'Ejercicio no encontrado' });
      const result = await sqlRequestFromParams({ idUsuario: userId, idEjercicio }).query(`INSERT INTO SesionesEjercicio (IdUsuario, IdEjercicio, FechaSesion, Completado) OUTPUT INSERTED.IdSesion VALUES (@idUsuario, @idEjercicio, GETDATE(), 1)`);
      const idSesion = result.recordset[0].IdSesion;
      await sqlRequestFromParams({ idUsuario: userId }).query('UPDATE Usuarios SET Puntos = Puntos + 10 WHERE IdUsuario = @idUsuario');
      return res.json({ success: true, message: 'Ejercicio guardado en base de datos', puntosGanados: 10, idSesion });
    }
  } catch (error) {
    console.error('💥 Error en /api/ejercicios/completar:', error);
    res.status(500).json({ error: 'Error del servidor: ' + (error.message || error) });
  }
});

// ----------------- EJERCICIOS - GRATITUD -----------------
app.post('/api/ejercicios/gratitud', authenticateToken, async (req, res) => {
  try {
    const { gratitud1, gratitud2, gratitud3 } = req.body;
    const userId = req.user.userId;
    if (!gratitud1 || !gratitud2 || !gratitud3) return res.status(400).json({ error: 'Las 3 cosas de gratitud son requeridas' });
    const respuestaCompleta = `1. ${gratitud1} | 2. ${gratitud2} | 3. ${gratitud3}`;

    if (USE_SQLITE) {
      await sqliteRun('INSERT INTO SesionesEjercicio (IdUsuario, IdEjercicio, FechaSesion, Completado, RespuestaGratitud) VALUES (?, 4, datetime("now"), 1, ?)', [userId, respuestaCompleta]);
      await sqliteRun('UPDATE Usuarios SET Puntos = COALESCE(Puntos,0) + 10 WHERE IdUsuario = ?', [userId]);
      const last = await sqliteGet('SELECT MAX(IdSesion) as IdSesion FROM SesionesEjercicio');
      return res.json({ success: true, message: 'Diario de gratitud guardado en base de datos', puntosGanados: 10, idSesion: last.IdSesion });
    } else {
      const result = await sqlRequestFromParams({ idUsuario: userId, idEjercicio: 4, respuestaGratitud: respuestaCompleta }).query(`INSERT INTO SesionesEjercicio (IdUsuario, IdEjercicio, FechaSesion, Completado, RespuestaGratitud) OUTPUT INSERTED.IdSesion VALUES (@idUsuario, @idEjercicio, GETDATE(), 1, @respuestaGratitud)`);
      const idSesion = result.recordset[0].IdSesion;
      await sqlRequestFromParams({ idUsuario: userId }).query('UPDATE Usuarios SET Puntos = Puntos + 10 WHERE IdUsuario = @idUsuario');
      return res.json({ success: true, message: 'Diario de gratitud guardado en base de datos', puntosGanados: 10, idSesion });
    }
  } catch (error) {
    console.error('💥 Error en la ruta de gratitud:', error);
    res.status(500).json({ error: 'Error del servidor: ' + (error.message || error) });
  }
});

// ----------------- RETOS -----------------
app.get('/api/retos', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    if (USE_SQLITE) {
      await sqliteRun('CREATE TABLE IF NOT EXISTS Retos (IdReto INTEGER PRIMARY KEY AUTOINCREMENT, IdUsuario INTEGER, Titulo TEXT, Estado TEXT, FechaCreacion TEXT, FechaCumplido TEXT)');
      const rows = await sqliteAll('SELECT * FROM Retos WHERE IdUsuario = ? ORDER BY FechaCreacion DESC', [userId]);
      return res.json(rows);
    } else {
      const result = await sqlRequestFromParams({ IdUsuario: userId }).query('SELECT * FROM Retos WHERE IdUsuario = @IdUsuario ORDER BY FechaCreacion DESC');
      return res.json(result.recordset);
    }
  } catch (err) { console.error('ERROR obteniendo retos:', err); res.status(500).json({ error: 'Error al obtener retos' }); }
});

app.post('/api/retos', authenticateToken, async (req, res) => {
  try {
    const { Titulo } = req.body; const userId = req.user.userId; if (!Titulo) return res.status(400).json({ error: 'El título es obligatorio' });
    if (USE_SQLITE) {
      const r = await sqliteRun('INSERT INTO Retos (IdUsuario, Titulo, FechaCreacion) VALUES (?, ?, datetime("now"))', [userId, Titulo]);
      const row = await sqliteGet('SELECT * FROM Retos WHERE IdReto = ?', [r.lastID]);
      return res.json(row);
    } else {
      const result = await sqlRequestFromParams({ IdUsuario: userId, Titulo }).query('INSERT INTO Retos (IdUsuario, Titulo) OUTPUT INSERTED.* VALUES (@IdUsuario, @Titulo)');
      return res.json(result.recordset[0]);
    }
  } catch (err) { console.error('❌ ERROR guardando reto:', err); res.status(500).json({ error: 'Error al guardar reto' }); }
});

app.put('/api/retos/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params; const { Cumplido } = req.body; const userId = req.user.userId;
    if (USE_SQLITE) {
      if (Cumplido) await sqliteRun('UPDATE Retos SET Estado = ?, FechaCumplido = datetime("now") WHERE IdReto = ? AND IdUsuario = ?', ['Cumplido', id, userId]);
      else await sqliteRun('UPDATE Retos SET Estado = ?, FechaCumplido = NULL WHERE IdReto = ? AND IdUsuario = ?', ['Fallido', id, userId]);
      const row = await sqliteGet('SELECT * FROM Retos WHERE IdReto = ?', [id]);
      return res.json(row);
    } else {
      const q = Cumplido ? "UPDATE Retos SET Estado = 'Cumplido', FechaCumplido = GETDATE() WHERE IdReto = @IdReto AND IdUsuario = @IdUsuario" : "UPDATE Retos SET Estado = 'Fallido', FechaCumplido = NULL WHERE IdReto = @IdReto AND IdUsuario = @IdUsuario";
      const result = await sqlRequestFromParams({ IdReto: id, IdUsuario: userId }).query(q);
      if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'Reto no encontrado' });
      const retoActualizado = await sqlRequestFromParams({ IdReto: id }).query('SELECT * FROM Retos WHERE IdReto = @IdReto');
      return res.json(retoActualizado.recordset[0]);
    }
  } catch (err) { console.error('ERROR actualizando reto:', err); res.status(500).json({ error: 'Error al actualizar reto' }); }
});

app.delete('/api/retos/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params; const userId = req.user.userId;
    if (USE_SQLITE) {
      const r = await sqliteRun('DELETE FROM Retos WHERE IdReto = ? AND IdUsuario = ?', [id, userId]);
      if (r.changes === 0) return res.status(404).json({ error: 'Reto no encontrado' });
      return res.json({ message: 'Reto eliminado correctamente' });
    } else {
      const result = await sqlRequestFromParams({ IdReto: id, IdUsuario: userId }).query('DELETE FROM Retos WHERE IdReto = @IdReto AND IdUsuario = @IdUsuario');
      if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'Reto no encontrado' });
      return res.json({ message: 'Reto eliminado correctamente' });
    }
  } catch (err) { console.error('ERROR eliminando reto:', err); res.status(500).json({ error: 'Error al eliminar reto' }); }
});

// ----------------- EMOCIONES -----------------
app.get('/api/emociones', async (req, res) => {
  try {
    if (USE_SQLITE) {
      await sqliteRun('CREATE TABLE IF NOT EXISTS Emociones (IdEmocion INTEGER PRIMARY KEY, Nombre TEXT, Color TEXT, Icono TEXT)');
      const rows = await sqliteAll('SELECT IdEmocion, Nombre, Color, Icono FROM Emociones ORDER BY IdEmocion');
      return res.json(rows);
    } else {
      const result = await pool.request().query('SELECT IdEmocion, Nombre, Color, Icono FROM Emociones ORDER BY IdEmocion');
      return res.json(result.recordset);
    }
  } catch (error) { console.error('❌ Error obteniendo emociones:', error); res.status(500).json({ error: 'Error al obtener las emociones.' }); }
});

app.post('/api/emociones/registrar', authenticateToken, async (req, res) => {
  try {
    const { tipo, notas } = req.body;
    const userId = req.user.userId;
    if (USE_SQLITE) {
      const emocion = await sqliteGet('SELECT IdEmocion FROM Emociones WHERE LOWER(Nombre) = LOWER(?)', [tipo]);
      if (!emocion) return res.status(400).json({ error: 'Tipo de emoción no válido' });
      await sqliteRun('CREATE TABLE IF NOT EXISTS RegistroEmocional (IdRegistro INTEGER PRIMARY KEY AUTOINCREMENT, IdUsuario INTEGER, IdEmocion INTEGER, Nota TEXT, FechaRegistro TEXT)');
      await sqliteRun('INSERT INTO RegistroEmocional (IdUsuario, IdEmocion, Nota, FechaRegistro) VALUES (?, ?, ?, datetime("now"))', [userId, emocion.IdEmocion, notas || '']);
      return res.json({ success: true, message: 'Emoción registrada correctamente' });
    } else {
      const emocionResult = await sqlRequestFromParams({ tipo }).query('SELECT IdEmocion FROM Emociones WHERE LOWER(Nombre) = LOWER(@tipo)');
      if (emocionResult.recordset.length === 0) return res.status(400).json({ error: 'Tipo de emoción no válido' });
      const idEmocion = emocionResult.recordset[0].IdEmocion;
      await sqlRequestFromParams({ idUsuario: userId, idEmocion, nota: notas || '' }).query('INSERT INTO RegistroEmocional (IdUsuario, IdEmocion, Nota, FechaRegistro) VALUES (@idUsuario, @idEmocion, @nota, GETDATE())');
      return res.json({ success: true, message: 'Emoción registrada correctamente' });
    }
  } catch (error) { console.error('❌ Error registrando emoción:', error); res.status(500).json({ error: 'Error interno del servidor' }); }
});

app.get('/api/emociones/usuario', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    if (USE_SQLITE) {
      const rows = await sqliteAll(`SELECT e.Nombre, re.Nota, re.FechaRegistro, time(re.FechaRegistro) as Hora, date(re.FechaRegistro) as Fecha FROM RegistroEmocional re INNER JOIN Emociones e ON re.IdEmocion = e.IdEmocion WHERE re.IdUsuario = ? ORDER BY re.FechaRegistro DESC`, [userId]);
      return res.json(rows);
    } else {
      const result = await sqlRequestFromParams({ idUsuario: userId }).query(`SELECT e.Nombre, re.Nota, re.FechaRegistro, CONVERT(VARCHAR, re.FechaRegistro, 108) AS Hora, CONVERT(VARCHAR, re.FechaRegistro, 23) AS Fecha FROM RegistroEmocional re INNER JOIN Emociones e ON re.IdEmocion = e.IdEmocion WHERE re.IdUsuario = @idUsuario ORDER BY re.FechaRegistro DESC`);
      return res.json(result.recordset);
    }
  } catch (error) { console.error('❌ Error obteniendo emociones del usuario:', error); res.status(500).json({ error: 'Error al obtener el historial emocional' }); }
});

app.get('/api/calendario/emociones', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    if (USE_SQLITE) {
      const rows = await sqliteAll(`SELECT e.Nombre as emocion, e.Color, e.Icono, re.Nota, re.FechaRegistro, date(re.FechaRegistro) as fecha, time(re.FechaRegistro) as Hora FROM RegistroEmocional re INNER JOIN Emociones e ON re.IdEmocion = e.IdEmocion WHERE re.IdUsuario = ? ORDER BY re.FechaRegistro DESC`, [userId]);
      return res.json(rows);
    } else {
      const result = await sqlRequestFromParams({ idUsuario: userId }).query(`SELECT e.Nombre AS emocion, e.Color, e.Icono, re.Nota, re.FechaRegistro, CONVERT(VARCHAR, re.FechaRegistro, 23) AS fecha, CONVERT(VARCHAR, re.FechaRegistro, 108) AS Hora FROM RegistroEmocional re INNER JOIN Emociones e ON re.IdEmocion = e.IdEmocion WHERE re.IdUsuario = @idUsuario ORDER BY re.FechaRegistro DESC`);
      return res.json(result.recordset);
    }
  } catch (error) { console.error('❌ Error obteniendo emociones para calendario:', error); res.status(500).json({ error: 'Error al obtener las emociones del calendario' }); }
});

// ----------------- MASCOTA (OBTENER ACTIVA) -----------------
app.get('/api/mascota/actual', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    if (USE_SQLITE) {
      await sqliteRun('CREATE TABLE IF NOT EXISTS UsuarioMascota (IdUsuarioMascota INTEGER PRIMARY KEY AUTOINCREMENT, IdUsuario INTEGER, IdMascota INTEGER, Tipo TEXT, FechaAdopcion TEXT, Activa INTEGER, Nivel INTEGER, Experiencia INTEGER, ExperienciaNecesaria INTEGER, Felicidad INTEGER, Energia INTEGER, Hambre INTEGER, Monedas INTEGER, Estado TEXT)');
      const row = await sqliteGet('SELECT * FROM UsuarioMascota WHERE IdUsuario = ? AND Activa = 1 ORDER BY FechaAdopcion DESC LIMIT 1', [userId]);
      return res.json(row || null);
    } else {
      const result = await sqlRequestFromParams({ IdUsuario: userId }).query(`SELECT TOP 1 * FROM UsuarioMascota WHERE IdUsuario = @IdUsuario AND Activa = 1 ORDER BY FechaAdopcion DESC`);
      if (result.recordset.length === 0) return res.json(null);
      return res.json(result.recordset[0]);
    }
  } catch (error) { console.error('❌ Error cargando mascota:', error); return res.status(500).json({ error: 'Error cargando mascota' }); }
});

// ----------------- MASCOTA - SELECCIONAR -----------------
app.post('/api/mascota/seleccionar', authenticateToken, async (req, res) => {
  const Tipo = req.body.Tipo; const IdUsuario = req.user.userId;
  if (!Tipo) return res.status(400).json({ error: 'Tipo de mascota requerido' });

  try {
    if (USE_SQLITE) {
      await sqliteRun('CREATE TABLE IF NOT EXISTS Mascotas (IdMascota INTEGER PRIMARY KEY AUTOINCREMENT, Tipo TEXT)');
      await sqliteRun('CREATE TABLE IF NOT EXISTS UsuarioMascota (IdUsuarioMascota INTEGER PRIMARY KEY AUTOINCREMENT, IdUsuario INTEGER, IdMascota INTEGER, Tipo TEXT, FechaAdopcion TEXT, Activa INTEGER, Nivel INTEGER, Experiencia INTEGER, ExperienciaNecesaria INTEGER, Felicidad INTEGER, Energia INTEGER, Hambre INTEGER, Monedas INTEGER, Estado TEXT)');

      // buscar existente
      const existente = await sqliteGet('SELECT * FROM UsuarioMascota WHERE IdUsuario = ? AND Tipo = ? ORDER BY FechaAdopcion DESC LIMIT 1', [IdUsuario, Tipo]);
      // desactivar todas
      await sqliteRun('UPDATE UsuarioMascota SET Activa = 0 WHERE IdUsuario = ?', [IdUsuario]);
      if (existente) {
        await sqliteRun('UPDATE UsuarioMascota SET Activa = 1 WHERE IdUsuarioMascota = ?', [existente.IdUsuarioMascota]);
        return res.json(existente);
      }
      const mascotaBase = await sqliteGet('SELECT * FROM Mascotas WHERE Tipo = ? LIMIT 1', [Tipo]);
      if (!mascotaBase) return res.status(400).json({ error: 'Tipo de mascota no válido' });
      const inserted = await sqliteRun('INSERT INTO UsuarioMascota (IdUsuario, IdMascota, Tipo, FechaAdopcion, Activa, Nivel, Experiencia, ExperienciaNecesaria, Felicidad, Energia, Hambre, Monedas, Estado) VALUES (?, ?, ?, datetime("now"), 1, 1, 0, 100, 50, 100, 0, 50, ?)', [IdUsuario, mascotaBase.IdMascota, mascotaBase.Tipo, 'Feliz']);
      const newRow = await sqliteGet('SELECT * FROM UsuarioMascota WHERE IdUsuarioMascota = ?', [inserted.lastID]);
      return res.json(newRow);
    } else {
      const transaction = new sql.Transaction(pool);
      await transaction.begin();
      try {
        const txReq1 = new sql.Request(transaction);
        const existente = await txReq1.input('IdUsuario', sql.Int, IdUsuario).input('Tipo', sql.NVarChar, Tipo).query(`SELECT TOP 1 * FROM UsuarioMascota WHERE IdUsuario = @IdUsuario AND Tipo = @Tipo ORDER BY FechaAdopcion DESC`);
        const txReq2 = new sql.Request(transaction);
        await txReq2.input('IdUsuario', sql.Int, IdUsuario).query(`UPDATE UsuarioMascota SET Activa = 0 WHERE IdUsuario = @IdUsuario`);
        if (existente.recordset.length > 0) {
          const masc = existente.recordset[0];
          const txReq3 = new sql.Request(transaction);
          await txReq3.input('IdUsuarioMascota', sql.Int, masc.IdUsuarioMascota).query(`UPDATE UsuarioMascota SET Activa = 1 WHERE IdUsuarioMascota = @IdUsuarioMascota`);
          await transaction.commit();
          return res.json(masc);
        }
        const txReq4 = new sql.Request(transaction);
        const mascotaBase = await txReq4.input('Tipo', sql.NVarChar, Tipo).query('SELECT TOP 1 * FROM Mascotas WHERE Tipo = @Tipo');
        if (mascotaBase.recordset.length === 0) { await transaction.rollback(); return res.status(400).json({ error: 'Tipo de mascota no válido' }); }
        const data = mascotaBase.recordset[0];
        const txReq5 = new sql.Request(transaction);
        const inserted = await txReq5.input('IdUsuario', sql.Int, IdUsuario).input('IdMascota', sql.Int, data.IdMascota).input('Tipo', sql.NVarChar, data.Tipo).input('FechaAdopcion', sql.DateTime, new Date()).input('Activa', sql.Bit, 1).input('Nivel', sql.Int, 1).input('Experiencia', sql.Int, 0).input('ExperienciaNecesaria', sql.Int, 100).input('Felicidad', sql.Int, 50).input('Energia', sql.Int, 100).input('Hambre', sql.Int, 0).input('Monedas', sql.Int, 50).input('Estado', sql.NVarChar, 'Feliz').query(`INSERT INTO UsuarioMascota (IdUsuario, IdMascota, Tipo, FechaAdopcion, Activa, Nivel, Experiencia, ExperienciaNecesaria, Felicidad, Energia, Hambre, Monedas, Estado) OUTPUT INSERTED.* VALUES (@IdUsuario, @IdMascota, @Tipo, @FechaAdopcion, @Activa, @Nivel, @Experiencia, @ExperienciaNecesaria, @Felicidad, @Energia, @Hambre, @Monedas, @Estado)`);
        await transaction.commit();
        return res.json(inserted.recordset[0]);
      } catch (err) { try { await transaction.rollback(); } catch (e) {} console.error('⚠ ERROR EN /api/mascota/seleccionar:', err.message); return res.status(500).json({ error: 'Error interno al seleccionar mascota' }); }
    }
  } catch (err) { console.error('ERROR mascota/seleccionar:', err); return res.status(500).json({ error: 'Error interno' }); }
});

// ----------------- MASCOTA - ACTUALIZAR -----------------
app.put('/api/mascota/actualizar', authenticateToken, async (req, res) => {
  try {
    const data = req.body; const IdUsuario = req.user.userId; if (!data.IdUsuarioMascota) return res.status(400).json({ error: 'IdUsuarioMascota requerido' });
    if (USE_SQLITE) {
      const check = await sqliteGet('SELECT 1 FROM UsuarioMascota WHERE IdUsuarioMascota = ? AND IdUsuario = ?', [data.IdUsuarioMascota, IdUsuario]);
      if (!check) return res.status(403).json({ error: 'No autorizado para actualizar esta mascota' });
      await sqliteRun('UPDATE UsuarioMascota SET Nivel = ?, Experiencia = ?, ExperienciaNecesaria = ?, Felicidad = ?, Energia = ?, Hambre = ?, Monedas = ?, Estado = ? WHERE IdUsuarioMascota = ?', [data.Nivel, data.Experiencia, data.ExperienciaNecesaria, data.Felicidad, data.Energia, data.Hambre, data.Monedas, data.Estado, data.IdUsuarioMascota]);
      return res.json({ ok: true });
    } else {
      const check = await sqlRequestFromParams({ IdUsuarioMascota: data.IdUsuarioMascota, IdUsuario }).query('SELECT 1 FROM UsuarioMascota WHERE IdUsuarioMascota = @IdUsuarioMascota AND IdUsuario = @IdUsuario');
      if (check.recordset.length === 0) return res.status(403).json({ error: 'No autorizado para actualizar esta mascota' });
      await sqlRequestFromParams({ IdUsuarioMascota: data.IdUsuarioMascota, Nivel: data.Nivel, Experiencia: data.Experiencia, ExperienciaNecesaria: data.ExperienciaNecesaria, Felicidad: data.Felicidad, Energia: data.Energia, Hambre: data.Hambre, Monedas: data.Monedas, Estado: data.Estado }).query(`UPDATE UsuarioMascota SET Nivel=@Nivel, Experiencia=@Experiencia, ExperienciaNecesaria=@ExperienciaNecesaria, Felicidad=@Felicidad, Energia=@Energia, Hambre=@Hambre, Monedas=@Monedas, Estado=@Estado WHERE IdUsuarioMascota=@IdUsuarioMascota`);
      return res.json({ ok: true });
    }
  } catch (err) { console.error('⚠ Error SQL en mascota/actualizar:', err); return res.status(500).json({ error: 'Error actualizando mascota' }); }
});

// ----------------- ESTADÍSTICAS -----------------
app.get('/api/estadisticas/generales', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    if (USE_SQLITE) {
      const emocionesResult = await sqliteGet('SELECT COUNT(*) as Total FROM RegistroEmocional WHERE IdUsuario = ?', [userId]);
      const ejerciciosResult = await sqliteGet('SELECT COUNT(*) as Total FROM SesionesEjercicio WHERE IdUsuario = ?', [userId]);
      const retosResult = await sqliteGet('SELECT COUNT(*) as Total FROM ProgresoRetos WHERE IdUsuario = ? AND Completado = 1', [userId]);
      const diasResult = await sqliteGet('SELECT COUNT(DISTINCT date(FechaRegistro)) as Dias FROM RegistroEmocional WHERE IdUsuario = ? AND FechaRegistro >= datetime(\'now\', '-7 day')', [userId]);
      return res.json({ emocionesRegistradas: emocionesResult.Total || 0, ejerciciosRealizados: ejerciciosResult.Total || 0, retosCompletados: retosResult.Total || 0, diasConsecutivos: diasResult.Dias || 0 });
    } else {
      const emocionesResult = await sqlRequestFromParams({ idUsuario: userId }).query('SELECT COUNT(*) as Total FROM RegistroEmocional WHERE IdUsuario = @idUsuario');
      const ejerciciosResult = await sqlRequestFromParams({ idUsuario: userId }).query('SELECT COUNT(*) as Total FROM SesionesEjercicio WHERE IdUsuario = @idUsuario');
      const retosResult = await sqlRequestFromParams({ idUsuario: userId }).query('SELECT COUNT(*) as Total FROM ProgresoRetos WHERE IdUsuario = @idUsuario AND Completado = 1');
      const diasResult = await sqlRequestFromParams({ idUsuario: userId }).query(`SELECT COUNT(DISTINCT CONVERT(DATE, FechaRegistro)) as Dias FROM RegistroEmocional WHERE IdUsuario = @idUsuario AND FechaRegistro >= DATEADD(day, -7, GETDATE())`);
      return res.json({ emocionesRegistradas: emocionesResult.recordset[0].Total, ejerciciosRealizados: ejerciciosResult.recordset[0].Total, retosCompletados: retosResult.recordset[0].Total, diasConsecutivos: diasResult.recordset[0].Dias });
    }
  } catch (error) { console.error('❌ Error obteniendo estadísticas:', error); res.status(500).json({ error: 'Error al obtener estadísticas' }); }
});

// ----------------- PERFIL -----------------
app.post('/api/perfil/guardar', async (req, res) => {
  try {
    const { idUsuario, nombreCompleto, correoElectronico, fechaDeNacimiento, genero, biografia, contrasenaActual, nuevaContrasena, confirmarNuevaContrasena } = req.body;
    if (!idUsuario) return res.status(400).json({ error: 'Falta idUsuario' });
    if (USE_SQLITE) {
      await sqliteRun('CREATE TABLE IF NOT EXISTS Perfil (IdPerfil INTEGER PRIMARY KEY AUTOINCREMENT, IdUsuario INTEGER, NombreCompleto TEXT, CorreoElectronico TEXT, FechaDeNacimiento TEXT, Genero TEXT, Biografia TEXT, ContrasenaActual TEXT, NuevaContrasena TEXT, ConfirmarNuevaContrasena TEXT)');
      const existe = await sqliteGet('SELECT * FROM Perfil WHERE IdUsuario = ?', [idUsuario]);
      if (!existe) {
        await sqliteRun('INSERT INTO Perfil (IdUsuario, NombreCompleto, CorreoElectronico, FechaDeNacimiento, Genero, Biografia, ContrasenaActual, NuevaContrasena, ConfirmarNuevaContrasena) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [idUsuario, nombreCompleto || '', correoElectronico || '', fechaDeNacimiento || null, genero || '', biografia || '', contrasenaActual || '', nuevaContrasena || '', confirmarNuevaContrasena || '']);
      } else {
        await sqliteRun('UPDATE Perfil SET NombreCompleto = ?, CorreoElectronico = ?, FechaDeNacimiento = ?, Genero = ?, Biografia = ? WHERE IdUsuario = ?', [nombreCompleto || '', correoElectronico || '', fechaDeNacimiento || null, genero || '', biografia || '', idUsuario]);
      }
      return res.json({ success: true, message: 'Perfil guardado correctamente' });
    } else {
      const existe = await sqlRequestFromParams({ IdUsuario: idUsuario }).query('SELECT * FROM Perfil WHERE IdUsuario = @IdUsuario');
      if (existe.recordset.length === 0) {
        await sqlRequestFromParams({ IdUsuario: idUsuario, NombreCompleto: nombreCompleto || '', CorreoElectronico: correoElectronico || '', FechaDeNacimiento: fechaDeNacimiento || null, Genero: genero || '', Biografia: biografia || '', ContrasenaActual: contrasenaActual || '', NuevaContrasena: nuevaContrasena || '', ConfirmarNuevaContrasena: confirmarNuevaContrasena || '' }).query(`INSERT INTO Perfil (IdUsuario, NombreCompleto, CorreoElectronico, FechaDeNacimiento, Genero, Biografia, ContrasenaActual, NuevaContrasena, ConfirmarNuevaContrasena) VALUES (@IdUsuario, @NombreCompleto, @CorreoElectronico, @FechaDeNacimiento, @Genero, @Biografia, @ContrasenaActual, @NuevaContrasena, @ConfirmarNuevaContrasena)`);
      } else {
        await sqlRequestFromParams({ IdUsuario: idUsuario, NombreCompleto: nombreCompleto || '', CorreoElectronico: correoElectronico || '', FechaDeNacimiento: fechaDeNacimiento || null, Genero: genero || '', Biografia: biografia || '' }).query(`UPDATE Perfil SET NombreCompleto = @NombreCompleto, CorreoElectronico = @CorreoElectronico, FechaDeNacimiento = @FechaDeNacimiento, Genero = @Genero, Biografia = @Biografia WHERE IdUsuario = @IdUsuario`);
      }
      return res.json({ success: true, message: 'Perfil guardado correctamente' });
    }
  } catch (err) { console.error('❌ Error en POST /api/perfil/guardar:', err); res.status(500).json({ error: 'Error al guardar perfil: ' + (err.message || err) }); }
});

// ----------------- HEALTH -----------------
app.get('/api/health', async (req, res) => {
  try {
    if (USE_SQLITE) {
      await sqliteRun('SELECT 1');
      return res.json({ status: 'OK', database: 'SQLite', timestamp: new Date().toISOString() });
    } else {
      await pool.request().query('SELECT 1 as Status');
      return res.json({ status: 'OK', database: 'SQL Server', timestamp: new Date().toISOString() });
    }
  } catch (error) { return res.status(500).json({ status: 'Error', database: USE_SQLITE ? 'SQLite' : 'SQL Server', error: error.message }); }
});

// 404
app.use('*', (req, res) => { res.status(404).json({ error: 'Endpoint no encontrado' }); });

// Start
app.listen(PORT, () => {
  console.log('══════════════════════════════════════');
  console.log('🚀 SERVIDOR MENTE SANA INICIADO (DUAL DB)');
  console.log(`📄 Página web: http://localhost:${PORT}`);
  console.log(`🔧 API Health: http://localhost:${PORT}/api/health`);
  console.log(`🗄️ Usando DB: ${USE_SQLITE ? 'SQLite (Render / production)' : 'SQL Server (local)'}`);
  console.log('══════════════════════════════════════');
});
