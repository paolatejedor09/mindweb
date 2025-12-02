// server.js - DUAL DB: SQL Server (local) + SQLite (producción)
const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// ------------------------------------------------------
//  MODO DE EJECUCIÓN
// ------------------------------------------------------
const IS_PRODUCTION =
  (process.env.NODE_ENV && process.env.NODE_ENV.toLowerCase() === 'production') ||
  (process.env.RAILWAY && process.env.RAILWAY.toLowerCase().trim() === 'true');

const USE_SQLITE =
  IS_PRODUCTION || 
  (process.env.USE_SQLITE && process.env.USE_SQLITE.toLowerCase().trim() === 'true');

console.log("📌 MODO:", IS_PRODUCTION ? "PRODUCCIÓN" : "LOCAL");
console.log("🗄️ BASE DE DATOS:", USE_SQLITE ? "SQLite" : "SQL Server");

// ------------------------------------------------------
//  SERVIDOR / PUERTO
// ------------------------------------------------------
const PORT = process.env.PORT || 3000;
const app = express();
app.use(cors());
app.use(express.json());

// ------------------------------------------------------
//  ARCHIVOS ESTÁTICOS (FRONTEND)
// ------------------------------------------------------
app.use(express.static(path.join(__dirname, '..', 'fronted')));
app.use('/imagvideos', express.static(path.join(__dirname, '..', 'imagvideos')));

// INDEX MAIN
app.get('/', (req, res) => {
  const filePath = path.join(__dirname, '..', 'fronted', 'index.html');
  if (fs.existsSync(filePath)) return res.sendFile(filePath);
  return res.status(404).send('Archivo index.html no encontrado');
});

// ------------------------------------------------------
//  JWT
// ------------------------------------------------------
const JWT_SECRET = process.env.JWT_SECRET || 'salud_mental_secreto_2024';

function authenticateToken(req, res, next) {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Token requerido' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });

    req.user = { userId: decoded.userId, email: decoded.email };
    next();
  });
}

// ------------------------------------------------------
//  BASE DE DATOS: SQL SERVER (LOCAL)
// ------------------------------------------------------
const dbConfig = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'salud123',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'Salud_mental',
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true }
};

let pool;      // SQL Server
let sqlite;    // SQLite3

async function connectSqlServer() {
  try {
    pool = await sql.connect(dbConfig);
    console.log('✅ Conectado a SQL Server');
  } catch (err) {
    console.error('❌ Error conectando a SQL Server:', err.message);
  }
}

// ------------------------------------------------------
//  BASE DE DATOS: SQLITE (PRODUCCIÓN / CELULAR)
// ------------------------------------------------------
function initSqlite() {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.join(__dirname, 'database.db');

  sqlite = new sqlite3.Database(dbPath, (err) => {
    if (err) return console.error('❌ SQLite error:', err.message);
    console.log('🟢 SQLite inicializado en', dbPath);
  });
}

// INICIAR DB
if (USE_SQLITE) initSqlite();
else connectSqlServer();

// ------------------------------------------------------
//  INICIALIZAR TODAS LAS TABLAS SQLITE
// ------------------------------------------------------
async function inicializarTablasSQLite() {
  if (!USE_SQLITE || !sqlite) {
    console.log("ℹ️ SQLite no está activo, saltando inicialización de tablas");
    return;
  }
  
  console.log("📋 INICIALIZANDO TABLAS SQLITE...");
  
  try {
    // 1. Tabla Usuarios
    await sqliteRun(`
      CREATE TABLE IF NOT EXISTS Usuarios (
        IdUsuario INTEGER PRIMARY KEY AUTOINCREMENT,
        Nombre TEXT,
        Correo TEXT UNIQUE,
        Contrasena TEXT,
        Nivel INTEGER DEFAULT 1,
        Puntos INTEGER DEFAULT 0,
        FechaRegistro TEXT DEFAULT (datetime('now'))
      )
    `);
    console.log("✅ Tabla 'Usuarios' lista");
    
    // 2. Tabla Perfil
    await sqliteRun(`
      CREATE TABLE IF NOT EXISTS Perfil (
        IdPerfil INTEGER PRIMARY KEY AUTOINCREMENT,
        IdUsuario INTEGER,
        NombreCompleto TEXT,
        CorreoElectronico TEXT,
        FechaDeNacimiento TEXT,
        Genero TEXT,
        Biografia TEXT
      )
    `);
    console.log("✅ Tabla 'Perfil' lista");
    
    // 3. Tabla Emociones (DATOS BASE)
    await sqliteRun(`
      CREATE TABLE IF NOT EXISTS Emociones (
        IdEmocion INTEGER PRIMARY KEY,
        Nombre TEXT,
        Color TEXT,
        Icono TEXT
      )
    `);
    console.log("✅ Tabla 'Emociones' lista");
    
    // Insertar emociones base si la tabla está vacía
    const countEmociones = await sqliteGet('SELECT COUNT(*) as total FROM Emociones');
    if (countEmociones.total === 0) {
      console.log("📝 Insertando emociones base...");
      await sqliteRun(`
        INSERT INTO Emociones (IdEmocion, Nombre, Color, Icono) VALUES 
        (1, 'Feliz', '#FFD700', '😊'),
        (2, 'Triste', '#3498DB', '😢'),
        (3, 'Enojado', '#E74C3C', '😠'),
        (4, 'Ansioso', '#9B59B6', '😰'),
        (5, 'Relajado', '#2ECC71', '😌'),
        (6, 'Cansado', '#95A5A6', '😴'),
        (7, 'Energico', '#FF9800', '😄'),
        (8, 'Confundido', '#795548', '😕'),
        (9, 'Agradecido', '#009688', '🙏'),
        (10, 'Calmado', '#8E24AA', '😌')
      `);
      console.log("✅ Emociones base insertadas");
    }
    
    // 4. Tabla RegistroEmocional
    await sqliteRun(`
      CREATE TABLE IF NOT EXISTS RegistroEmocional (
        IdRegistro INTEGER PRIMARY KEY AUTOINCREMENT,
        IdUsuario INTEGER,
        IdEmocion INTEGER,
        Nota TEXT,
        FechaRegistro TEXT DEFAULT (datetime('now'))
      )
    `);
    console.log("✅ Tabla 'RegistroEmocional' lista");
    
    // 5. Tabla Ejercicios
    await sqliteRun(`
      CREATE TABLE IF NOT EXISTS Ejercicios (
        IdEjercicio INTEGER PRIMARY KEY,
        Nombre TEXT
      )
    `);
    console.log("✅ Tabla 'Ejercicios' lista");
    
    // Insertar ejercicios base
    const countEjercicios = await sqliteGet('SELECT COUNT(*) as total FROM Ejercicios');
    if (countEjercicios.total === 0) {
      await sqliteRun(`
        INSERT INTO Ejercicios (IdEjercicio, Nombre) VALUES 
        (1, 'Respiración'),
        (2, 'Meditación'),
        (3, 'Ejercicio Físico'),
        (4, 'Gratitud')
      `);
      console.log("✅ Ejercicios base insertados");
    }
    
    // 6. Tabla SesionesEjercicio
    await sqliteRun(`
      CREATE TABLE IF NOT EXISTS SesionesEjercicio (
        IdSesion INTEGER PRIMARY KEY AUTOINCREMENT,
        IdUsuario INTEGER,
        IdEjercicio INTEGER,
        FechaSesion TEXT DEFAULT (datetime('now')),
        Completado INTEGER DEFAULT 0,
        RespuestaGratitud TEXT
      )
    `);
    console.log("✅ Tabla 'SesionesEjercicio' lista");
    
    // 7. Tabla Retos
    await sqliteRun(`
      CREATE TABLE IF NOT EXISTS Retos (
        IdReto INTEGER PRIMARY KEY AUTOINCREMENT,
        IdUsuario INTEGER,
        Titulo TEXT,
        Estado TEXT DEFAULT 'Pendiente',
        FechaCreacion TEXT DEFAULT (datetime('now')),
        FechaCumplido TEXT
      )
    `);
    console.log("✅ Tabla 'Retos' lista");
    
    // 8. Tabla Mascotas (VERSIÓN CORREGIDA)
await sqliteRun(`
  CREATE TABLE IF NOT EXISTS Mascotas (
    IdMascota INTEGER PRIMARY KEY AUTOINCREMENT,
    Nombre TEXT,
    Tipo TEXT,
    Imagen TEXT
  )
`);
console.log("✅ Tabla 'Mascotas' lista");

// Insertar mascotas base (VERSIÓN CORREGIDA)
const countMascotas = await sqliteGet('SELECT COUNT(*) as total FROM Mascotas');
if (countMascotas.total === 0) {
  await sqliteRun(`
    INSERT INTO Mascotas (Nombre, Tipo, Imagen) VALUES 
    ('Axolote', 'axolote', 'imagvideos/axolo.png'),
    ('Caracol', 'caracol', 'imagvideos/caracoli.png'),
    ('Dinosaurio', 'dinosaurio', 'imagvideos/dinosau.png')
  `);
  console.log("✅ Mascotas base insertadas (axolote, caracol, dinosaurio)");
}
    
    // 9. Tabla UsuarioMascota (VERSIÓN CORREGIDA)
await sqliteRun(`
  CREATE TABLE IF NOT EXISTS UsuarioMascota (
    IdUsuarioMascota INTEGER PRIMARY KEY AUTOINCREMENT,
    IdUsuario INTEGER,
    IdMascota INTEGER,
    Tipo TEXT,
    FechaAdopcion TEXT DEFAULT (datetime('now')),
    Activa INTEGER DEFAULT 0,
    Nivel INTEGER DEFAULT 1,
    Experiencia INTEGER DEFAULT 0,
    ExperienciaNecesaria INTEGER DEFAULT 100,
    Felicidad INTEGER DEFAULT 100,
    Energia INTEGER DEFAULT 100,
    Hambre INTEGER DEFAULT 0,
    Monedas INTEGER DEFAULT 50,
    Estado TEXT DEFAULT 'Feliz'
  )
`);
console.log("✅ Tabla 'UsuarioMascota' lista");
   
    
    console.log("🎉 TODAS LAS TABLAS SQLITE INICIALIZADAS CORRECTAMENTE");
    
  } catch (error) {
    console.error("❌ ERROR inicializando tablas SQLite:");
    console.error("❌ Mensaje:", error.message);
    console.error("❌ Stack:", error.stack);
  }
}

// ------------------------------------------------------
//  HELPERS SQLITE / SQL SERVER
// ------------------------------------------------------
function sqlRequestFromParams(params = {}) {
  const req = pool.request();
  for (const key of Object.keys(params)) {
    const value = params[key];
    if (typeof value === "number") req.input(key, sql.Int, value);
    else req.input(key, sql.NVarChar, value);
  }
  return req;
}

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
    sqlite.run(q, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

// ------------------------------------------------------
//  AUTH: REGISTER
// ------------------------------------------------------
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nombre, email, correo, password, contrasena } = req.body;

    const correoFinal = (email || correo || '').trim();
    const passwordFinal = (password || contrasena || '').trim();
    const nombreFinal = (nombre || '').trim();

    if (!correoFinal || !passwordFinal || !nombreFinal)
      return res.status(400).json({ error: 'Faltan datos obligatorios.' });

    const hashed = await bcrypt.hash(passwordFinal, 10);

    // ------------------------- SQLITE -------------------------
    if (USE_SQLITE) {
      await sqliteRun(`
        CREATE TABLE IF NOT EXISTS Usuarios (
          IdUsuario INTEGER PRIMARY KEY AUTOINCREMENT,
          Nombre TEXT,
          Correo TEXT UNIQUE,
          Contrasena TEXT,
          Nivel INTEGER,
          Puntos INTEGER,
          FechaRegistro TEXT
        )
      `);

      const exists = await sqliteGet('SELECT IdUsuario FROM Usuarios WHERE Correo = ?', [correoFinal]);
      if (exists) return res.status(400).json({ error: 'El usuario ya existe.' });

      const insert = await sqliteRun(
        `INSERT INTO Usuarios (Nombre, Correo, Contrasena, Nivel, Puntos, FechaRegistro)
         VALUES (?, ?, ?, 1, 0, datetime("now"))`,
        [nombreFinal, correoFinal, hashed]
      );

      const newUser = {
        IdUsuario: insert.lastID,
        Nombre: nombreFinal,
        Correo: correoFinal,
        Nivel: 1,
        Puntos: 0,
        FechaRegistro: new Date().toISOString()
      };

      await sqliteRun(`
        CREATE TABLE IF NOT EXISTS Perfil (
          IdPerfil INTEGER PRIMARY KEY AUTOINCREMENT,
          IdUsuario INTEGER,
          NombreCompleto TEXT,
          CorreoElectronico TEXT,
          FechaDeNacimiento TEXT,
          Genero TEXT,
          Biografia TEXT
        )
      `);

      await sqliteRun('INSERT OR IGNORE INTO Perfil (IdUsuario) VALUES (?)', [newUser.IdUsuario]);

      const token = jwt.sign({ userId: newUser.IdUsuario, email: newUser.Correo }, JWT_SECRET, { expiresIn: '30d' });
      return res.json({ token, user: newUser });
    }

    // ------------------------- SQL SERVER -------------------------
    const check = await sqlRequestFromParams({ correo: correoFinal }).query(`
      SELECT IdUsuario FROM Usuarios WHERE Correo = @correo
    `);

    if (check.recordset.length > 0)
      return res.status(400).json({ error: 'El usuario ya existe.' });

    const result = await sqlRequestFromParams({
      nombre: nombreFinal,
      correo: correoFinal,
      contrasena: hashed
    }).query(`
      INSERT INTO Usuarios (Nombre, Correo, Contrasena, Nivel, Puntos, FechaRegistro)
      OUTPUT INSERTED.*
      VALUES (@nombre, @correo, @contrasena, 1, 0, GETDATE())
    `);

    const newUser = result.recordset[0];

    const token = jwt.sign({ userId: newUser.IdUsuario, email: newUser.Correo }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({ token, user: newUser });

  } catch (e) {
    console.error('❌ Error REGISTER:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ------------------------------------------------------
//  AUTH: LOGIN
// ------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, correo, password, contrasena } = req.body;

    const correoFinal = (email || correo || '').trim();
    const passwordFinal = (password || contrasena || '').trim();

    if (!correoFinal || !passwordFinal)
      return res.status(400).json({ error: 'Correo y contraseña requeridos' });

    // ------------------------- SQLITE -------------------------
    if (USE_SQLITE) {
      await sqliteRun(`
        CREATE TABLE IF NOT EXISTS Usuarios (
          IdUsuario INTEGER PRIMARY KEY AUTOINCREMENT,
          Nombre TEXT,
          Correo TEXT UNIQUE,
          Contrasena TEXT,
          Nivel INTEGER,
          Puntos INTEGER,
          FechaRegistro TEXT
        )
      `);

      const user = await sqliteGet('SELECT * FROM Usuarios WHERE Correo = ?', [correoFinal]);
      if (!user) return res.status(400).json({ error: 'Usuario no encontrado.' });

      const ok = await bcrypt.compare(passwordFinal, user.Contrasena);
      if (!ok) return res.status(401).json({ error: 'Contraseña incorrecta.' });

      const token = jwt.sign({ userId: user.IdUsuario, email: user.Correo }, JWT_SECRET, { expiresIn: '30d' });
      return res.json({ token, user });
    }

    // ------------------------- SQL SERVER -------------------------
    const result = await sqlRequestFromParams({ correo: correoFinal }).query(`
      SELECT * FROM Usuarios WHERE Correo = @correo
    `);

    if (result.recordset.length === 0)
      return res.status(400).json({ error: 'Usuario no encontrado.' });

    const user = result.recordset[0];
    const ok = await bcrypt.compare(passwordFinal, user.Contrasena);

    if (!ok) return res.status(401).json({ error: 'Contraseña incorrecta.' });

    const token = jwt.sign({ userId: user.IdUsuario, email: user.Correo }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({ token, user });

  } catch (e) {
    console.error('❌ Error LOGIN:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


// ----------------- EJERCICIOS - COMPLETAR -----------------
app.post('/api/ejercicios/completar', authenticateToken, async (req, res) => {
  try {
    const { idEjercicio } = req.body;
    const userId = req.user.userId;

    if (!idEjercicio)
      return res.status(400).json({ error: 'idEjercicio es requerido' });

    if (USE_SQLITE) {
      // Crear tablas si no existen
      await sqliteRun(`
        CREATE TABLE IF NOT EXISTS Ejercicios (
          IdEjercicio INTEGER PRIMARY KEY,
          Nombre TEXT
        )
      `);

      await sqliteRun(`
        CREATE TABLE IF NOT EXISTS SesionesEjercicio (
          IdSesion INTEGER PRIMARY KEY AUTOINCREMENT,
          IdUsuario INTEGER,
          IdEjercicio INTEGER,
          FechaSesion TEXT,
          Completado INTEGER,
          RespuestaGratitud TEXT
        )
      `);

      const ejercicio = await sqliteGet(
        'SELECT IdEjercicio FROM Ejercicios WHERE IdEjercicio = ?',
        [idEjercicio]
      );

      if (!ejercicio)
        return res.status(400).json({ error: 'Ejercicio no encontrado' });

      const result = await sqliteRun(
        `INSERT INTO SesionesEjercicio (IdUsuario, IdEjercicio, FechaSesion, Completado)
         VALUES (?, ?, datetime('now'), 1)`,
        [userId, idEjercicio]
      );

      await sqliteRun(
        'UPDATE Usuarios SET Puntos = COALESCE(Puntos,0) + 10 WHERE IdUsuario = ?',
        [userId]
      );

      return res.json({
        success: true,
        message: "Ejercicio guardado",
        puntosGanados: 10,
        idSesion: result.lastID
      });
    }

    // ---------------- SQL SERVER ----------------
    const ejercicioCheck = await sqlRequestFromParams({ idEjercicio })
      .query(`
        SELECT IdEjercicio FROM Ejercicios WHERE IdEjercicio = @idEjercicio
      `);

    if (ejercicioCheck.recordset.length === 0)
      return res.status(400).json({ error: 'Ejercicio no encontrado' });

    const result = await sqlRequestFromParams({ idUsuario: userId, idEjercicio })
      .query(`
        INSERT INTO SesionesEjercicio (IdUsuario, IdEjercicio, FechaSesion, Completado)
        OUTPUT INSERTED.IdSesion
        VALUES (@idUsuario, @idEjercicio, GETDATE(), 1)
      `);

    await sqlRequestFromParams({ idUsuario: userId })
      .query('UPDATE Usuarios SET Puntos = Puntos + 10 WHERE IdUsuario = @idUsuario');

    return res.json({
      success: true,
      message: "Ejercicio guardado",
      puntosGanados: 10,
      idSesion: result.recordset[0].IdSesion
    });

  } catch (error) {
    console.error("💥 Error en /api/ejercicios/completar:", error);
    return res.status(500).json({ error: "Error del servidor" });
  }
});


// ----------------- EJERCICIOS - GRATITUD -----------------
app.post('/api/ejercicios/gratitud', authenticateToken, async (req, res) => {
  try {
    const { gratitud1, gratitud2, gratitud3 } = req.body;
    const userId = req.user.userId;

    if (!gratitud1 || !gratitud2 || !gratitud3)
      return res.status(400).json({ error: "Se requieren las 3 gratitudes" });

    const texto = `1. ${gratitud1} | 2. ${gratitud2} | 3. ${gratitud3}`;

    if (USE_SQLITE) {

      await sqliteRun(`
        CREATE TABLE IF NOT EXISTS SesionesEjercicio (
          IdSesion INTEGER PRIMARY KEY AUTOINCREMENT,
          IdUsuario INTEGER,
          IdEjercicio INTEGER,
          FechaSesion TEXT,
          Completado INTEGER,
          RespuestaGratitud TEXT
        )
      `);

      await sqliteRun(`
        INSERT INTO SesionesEjercicio (IdUsuario, IdEjercicio, FechaSesion, Completado, RespuestaGratitud)
        VALUES (?, 4, datetime('now'), 1, ?)
      `, [userId, texto]);

      await sqliteRun(
        'UPDATE Usuarios SET Puntos = COALESCE(Puntos,0) + 10 WHERE IdUsuario = ?',
        [userId]
      );

      const last = await sqliteGet('SELECT MAX(IdSesion) AS IdSesion FROM SesionesEjercicio');

      return res.json({
        success: true,
        message: "Gratitud guardada",
        puntosGanados: 10,
        idSesion: last.IdSesion
      });
    }

    // SQL SERVER
    const result = await sqlRequestFromParams({
      idUsuario: userId,
      idEjercicio: 4,
      respuestaGratitud: texto
    }).query(`
      INSERT INTO SesionesEjercicio (IdUsuario, IdEjercicio, FechaSesion, Completado, RespuestaGratitud)
      OUTPUT INSERTED.IdSesion
      VALUES (@idUsuario, @idEjercicio, GETDATE(), 1, @respuestaGratitud)
    `);

    await sqlRequestFromParams({ idUsuario: userId })
      .query('UPDATE Usuarios SET Puntos = Puntos + 10 WHERE IdUsuario = @idUsuario');

    return res.json({
      success: true,
      message: "Gratitud guardada",
      puntosGanados: 10,
      idSesion: result.recordset[0].IdSesion
    });

  } catch (e) {
    console.error("💥 Error /gratitud:", e);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});


// ----------------- RETOS -----------------
async function ensureSQLiteRetos() {
  await sqliteRun(`
    CREATE TABLE IF NOT EXISTS Retos (
      IdReto INTEGER PRIMARY KEY AUTOINCREMENT,
      IdUsuario INTEGER,
      Titulo TEXT,
      Estado TEXT DEFAULT 'Pendiente',
      FechaCreacion TEXT,
      FechaCumplido TEXT
    )
  `);
}

// GET retos
app.get('/api/retos', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    if (USE_SQLITE) {
      await ensureSQLiteRetos();
      const rows = await sqliteAll(
        'SELECT * FROM Retos WHERE IdUsuario = ? ORDER BY FechaCreacion DESC',
        [userId]
      );
      return res.json(rows);
    }

    const result = await sqlRequestFromParams({ IdUsuario: userId })
      .query('SELECT * FROM Retos WHERE IdUsuario = @IdUsuario ORDER BY FechaCreacion DESC');

    return res.json(result.recordset);

  } catch (err) {
    console.error("❌ Error GET retos:", err);
    res.status(500).json({ error: "No se pudieron obtener retos" });
  }
});

// POST crear reto
app.post('/api/retos', authenticateToken, async (req, res) => {
  try {
    const { Titulo } = req.body;
    const userId = req.user.userId;

    if (!Titulo)
      return res.status(400).json({ error: "El título es obligatorio" });

    if (USE_SQLITE) {
      await ensureSQLiteRetos();

      const r = await sqliteRun(
        `INSERT INTO Retos (IdUsuario, Titulo, Estado, FechaCreacion)
         VALUES (?, ?, 'Pendiente', datetime('now'))`,
        [userId, Titulo]
      );

      const row = await sqliteGet('SELECT * FROM Retos WHERE IdReto = ?', [r.lastID]);
      return res.json(row);
    }

    const result = await sqlRequestFromParams({ IdUsuario: userId, Titulo })
      .query(`
        INSERT INTO Retos (IdUsuario, Titulo, Estado, FechaCreacion)
        OUTPUT INSERTED.*
        VALUES (@IdUsuario, @Titulo, 'Pendiente', GETDATE())
      `);

    return res.json(result.recordset[0]);

  } catch (err) {
    console.error("❌ Error POST retos:", err);
    res.status(500).json({ error: "No se pudo guardar el reto" });
  }
});

// PUT actualizar reto
app.put('/api/retos/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { Cumplido } = req.body;
    const userId = req.user.userId;

    const nuevoEstado = Cumplido ? "Cumplido" : "Fallido";

    if (USE_SQLITE) {
      await ensureSQLiteRetos();

      if (Cumplido) {
        await sqliteRun(
          `UPDATE Retos SET Estado=?, FechaCumplido=datetime('now')
           WHERE IdReto=? AND IdUsuario=?`,
          [nuevoEstado, id, userId]
        );
      } else {
        await sqliteRun(
          `UPDATE Retos SET Estado=?, FechaCumplido=NULL
           WHERE IdReto=? AND IdUsuario=?`,
          [nuevoEstado, id, userId]
        );
      }

      const row = await sqliteGet('SELECT * FROM Retos WHERE IdReto = ?', [id]);
      return res.json(row);
    }

    const q = Cumplido
      ? `UPDATE Retos SET Estado='Cumplido', FechaCumplido=GETDATE() WHERE IdReto=@IdReto AND IdUsuario=@IdUsuario`
      : `UPDATE Retos SET Estado='Fallido', FechaCumplido=NULL WHERE IdReto=@IdReto AND IdUsuario=@IdUsuario`;

    const update = await sqlRequestFromParams({ IdReto: id, IdUsuario: userId }).query(q);

    if (update.rowsAffected[0] === 0)
      return res.status(404).json({ error: "Reto no encontrado" });

    const row = await sqlRequestFromParams({ IdReto: id })
      .query('SELECT * FROM Retos WHERE IdReto=@IdReto');

    return res.json(row.recordset[0]);

  } catch (err) {
    console.error("❌ Error PUT retos:", err);
    res.status(500).json({ error: "No se pudo actualizar el reto" });
  }
});

// DELETE reto
app.delete('/api/retos/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    if (USE_SQLITE) {
      await ensureSQLiteRetos();

      const r = await sqliteRun(
        'DELETE FROM Retos WHERE IdReto=? AND IdUsuario=?',
        [id, userId]
      );

      if (r.changes === 0)
        return res.status(404).json({ error: "Reto no encontrado" });

      return res.json({ message: "Reto eliminado" });
    }

    const result = await sqlRequestFromParams({ IdReto: id, IdUsuario: userId })
      .query('DELETE FROM Retos WHERE IdReto=@IdReto AND IdUsuario=@IdUsuario');

    if (result.rowsAffected[0] === 0)
      return res.status(404).json({ error: "Reto no encontrado" });

    return res.json({ message: "Reto eliminado" });

  } catch (err) {
    console.error("❌ Error DELETE retos:", err);
    res.status(500).json({ error: "No se pudo eliminar" });
  }
});


// ----------------- EMOCIONES -----------------
app.get('/api/emociones', async (req, res) => {
  try {
    if (USE_SQLITE) {
      await sqliteRun(`
        CREATE TABLE IF NOT EXISTS Emociones (
          IdEmocion INTEGER PRIMARY KEY,
          Nombre TEXT,
          Color TEXT,
          Icono TEXT
        )
      `);

      const rows = await sqliteAll(
        'SELECT * FROM Emociones ORDER BY IdEmocion'
      );

      return res.json(rows);
    }

    const result = await pool.request()
      .query('SELECT IdEmocion, Nombre, Color, Icono FROM Emociones ORDER BY IdEmocion');

    return res.json(result.recordset);

  } catch (e) {
    console.error("❌ Error GET emociones:", e);
    res.status(500).json({ error: "No se pudieron obtener emociones" });
  }
});


// Registrar emoción
app.post('/api/emociones/registrar', authenticateToken, async (req, res) => {
  try {
    const { tipo, notas } = req.body;
    const userId = req.user.userId;

    if (USE_SQLITE) {

      const emocion = await sqliteGet(
        'SELECT IdEmocion FROM Emociones WHERE LOWER(Nombre)=LOWER(?)',
        [tipo]
      );

      if (!emocion)
        return res.status(400).json({ error: "Tipo de emoción no válido" });

      await sqliteRun(`
        CREATE TABLE IF NOT EXISTS RegistroEmocional (
          IdRegistro INTEGER PRIMARY KEY AUTOINCREMENT,
          IdUsuario INTEGER,
          IdEmocion INTEGER,
          Nota TEXT,
          FechaRegistro TEXT
        )
      `);

      await sqliteRun(
        `INSERT INTO RegistroEmocional (IdUsuario, IdEmocion, Nota, FechaRegistro)
         VALUES (?, ?, ?, datetime('now'))`,
        [userId, emocion.IdEmocion, notas || ""]
      );

      return res.json({ success: true, message: "Guardado" });
    }

    // SQL SERVER
    const emocionResult = await sqlRequestFromParams({ tipo })
      .query('SELECT IdEmocion FROM Emociones WHERE LOWER(Nombre)=LOWER(@tipo)');

    if (emocionResult.recordset.length === 0)
      return res.status(400).json({ error: "Tipo de emoción no válido" });

    const idEmocion = emocionResult.recordset[0].IdEmocion;

    await sqlRequestFromParams({
      idUsuario: userId,
      idEmocion,
      nota: notas || ""
    }).query(`
      INSERT INTO RegistroEmocional (IdUsuario, IdEmocion, Nota, FechaRegistro)
      VALUES (@idUsuario, @idEmocion, @nota, GETDATE())
    `);

    return res.json({ success: true, message: "Guardado" });

  } catch (e) {
    console.error("❌ Error POST emociones:", e);
    res.status(500).json({ error: "Error registrando emoción" });
  }
});


// Historial emociones
app.get('/api/emociones/usuario', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    if (USE_SQLITE) {
      const rows = await sqliteAll(`
        SELECT 
          e.Nombre, 
          re.Nota, 
          re.FechaRegistro,
          time(re.FechaRegistro) AS Hora,
          date(re.FechaRegistro) AS Fecha
        FROM RegistroEmocional re
        INNER JOIN Emociones e ON re.IdEmocion = e.IdEmocion
        WHERE re.IdUsuario = ?
        ORDER BY re.FechaRegistro DESC
      `, [userId]);

      return res.json(rows);
    }

    const result = await sqlRequestFromParams({ idUsuario: userId })
      .query(`
        SELECT e.Nombre, re.Nota, re.FechaRegistro,
        CONVERT(VARCHAR, re.FechaRegistro, 108) AS Hora,
        CONVERT(VARCHAR, re.FechaRegistro, 23) AS Fecha
        FROM RegistroEmocional re
        INNER JOIN Emociones e ON re.IdEmocion = e.IdEmocion
        WHERE re.IdUsuario = @idUsuario
        ORDER BY re.FechaRegistro DESC
      `);

    return res.json(result.recordset);

  } catch (e) {
    console.error("❌ Error historial emociones:", e);
    res.status(500).json({ error: "Error servidor" });
  }
});


// Emociones para calendario
app.get('/api/calendario/emociones', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    if (USE_SQLITE) {
      const rows = await sqliteAll(`
        SELECT 
          e.Nombre AS emocion,
          e.Color,
          e.Icono,
          re.Nota,
          re.FechaRegistro,
          date(re.FechaRegistro) AS fecha,
          time(re.FechaRegistro) AS Hora
        FROM RegistroEmocional re
        INNER JOIN Emociones e ON re.IdEmocion = e.IdEmocion
        WHERE re.IdUsuario = ?
        ORDER BY re.FechaRegistro DESC
      `, [userId]);

      return res.json(rows);
    }

    const result = await sqlRequestFromParams({ idUsuario: userId })
      .query(`
        SELECT e.Nombre AS emocion, e.Color, e.Icono, re.Nota,
        re.FechaRegistro,
        CONVERT(VARCHAR, re.FechaRegistro, 23) AS fecha,
        CONVERT(VARCHAR, re.FechaRegistro, 108) AS Hora
        FROM RegistroEmocional re
        INNER JOIN Emociones e ON re.IdEmocion = e.IdEmocion
        WHERE re.IdUsuario = @idUsuario
        ORDER BY re.FechaRegistro DESC
      `);

    return res.json(result.recordset);

  } catch (e) {
    console.error("❌ Error calendario emociones:", e);
    res.status(500).json({ error: "Error servidor" });
  }
});

// =========================================================
// 🐾 MASCOTA - OBTENER MASCOTA ACTIVA
// =========================================================
app.get('/api/mascota/actual', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    if (USE_SQLITE) {
      await sqliteRun(`
        CREATE TABLE IF NOT EXISTS UsuarioMascota (
          IdUsuarioMascota INTEGER PRIMARY KEY AUTOINCREMENT,
          IdUsuario INTEGER,
          IdMascota INTEGER,
          Tipo TEXT,
          FechaAdopcion TEXT,
          Activa INTEGER,
          Nivel INTEGER,
          Experiencia INTEGER,
          ExperienciaNecesaria INTEGER,
          Felicidad INTEGER,
          Energia INTEGER,
          Hambre INTEGER,
          Monedas INTEGER,
          Estado TEXT
        )
      `);

      const row = await sqliteGet(
        `SELECT * FROM UsuarioMascota
         WHERE IdUsuario = ? AND Activa = 1
         ORDER BY FechaAdopcion DESC LIMIT 1`,
        [userId]
      );

      return res.json(row || null);
    }

    // SQL SERVER
    const result = await sqlRequestFromParams({ IdUsuario: userId }).query(`
      SELECT TOP 1 * FROM UsuarioMascota
      WHERE IdUsuario = @IdUsuario AND Activa = 1
      ORDER BY FechaAdopcion DESC
    `);

    return res.json(result.recordset[0] || null);

  } catch (error) {
    console.error("❌ Error cargando mascota:", error);
    res.status(500).json({ error: "Error cargando mascota" });
  }
});


// =========================================================
// 🐾 MASCOTA - SELECCIONAR / ADOPTAR
// =========================================================
app.post('/api/mascota/seleccionar', authenticateToken, async (req, res) => {
  const Tipo = req.body.Tipo;
  const IdUsuario = req.user.userId;

  if (!Tipo) return res.status(400).json({ error: "Tipo de mascota requerido" });

  try {
    if (USE_SQLITE) {
      await sqliteRun(`
        CREATE TABLE IF NOT EXISTS Mascotas (
          IdMascota INTEGER PRIMARY KEY AUTOINCREMENT,
          Tipo TEXT,
          Imagen TEXT
        )
      `);

      await sqliteRun(`
        CREATE TABLE IF NOT EXISTS UsuarioMascota (
          IdUsuarioMascota INTEGER PRIMARY KEY AUTOINCREMENT,
          IdUsuario INTEGER,
          IdMascota INTEGER,
          Tipo TEXT,
          FechaAdopcion TEXT,
          Activa INTEGER,
          Nivel INTEGER,
          Experiencia INTEGER,
          ExperienciaNecesaria INTEGER,
          Felicidad INTEGER,
          Energia INTEGER,
          Hambre INTEGER,
          Monedas INTEGER,
          Estado TEXT
        )
      `);

      // desactivar mascotas previas
      await sqliteRun(`UPDATE UsuarioMascota SET Activa = 0 WHERE IdUsuario = ?`, [IdUsuario]);

      // existe?
      const existente = await sqliteGet(
        `SELECT * FROM UsuarioMascota
         WHERE IdUsuario = ? AND Tipo = ?
         ORDER BY FechaAdopcion DESC LIMIT 1`,
        [IdUsuario, Tipo]
      );

      if (existente) {
        await sqliteRun(
          `UPDATE UsuarioMascota SET Activa = 1 WHERE IdUsuarioMascota = ?`,
          [existente.IdUsuarioMascota]
        );
        return res.json(existente);
      }

      // nueva adopción
      const mascotaBase = await sqliteGet(
        `SELECT * FROM Mascotas WHERE Tipo = ? LIMIT 1`, [Tipo]
      );
      if (!mascotaBase) return res.status(400).json({ error: "Tipo de mascota no válido" });

      const inserted = await sqliteRun(
        `INSERT INTO UsuarioMascota
          (IdUsuario, IdMascota, Tipo, FechaAdopcion, Activa,
           Nivel, Experiencia, ExperienciaNecesaria,
           Felicidad, Energia, Hambre, Monedas, Estado)
         VALUES (?, ?, ?, datetime('now'), 1,
                 1, 0, 100,
                 100, 100, 0, 50, 'Feliz')`,
        [
          IdUsuario,
          mascotaBase.IdMascota,
          mascotaBase.Tipo
        ]
      );

      const newRow = await sqliteGet(
        `SELECT * FROM UsuarioMascota WHERE IdUsuarioMascota = ?`,
        [inserted.lastID]
      );

      return res.json(newRow);
    }

    // ======================================================
    // SQL SERVER
    // ======================================================
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const tx = new sql.Request(transaction);

      // desactivar todas
      await tx
        .input("IdUsuario", sql.Int, IdUsuario)
        .query(`UPDATE UsuarioMascota SET Activa = 0 WHERE IdUsuario = @IdUsuario`);

      // buscar si ya tenía esta mascota
      const existente = await tx
        .input("IdUsuario", sql.Int, IdUsuario)
        .input("Tipo", sql.NVarChar, Tipo)
        .query(`
          SELECT TOP 1 * FROM UsuarioMascota
          WHERE IdUsuario = @IdUsuario AND Tipo = @Tipo
          ORDER BY FechaAdopcion DESC
        `);

      if (existente.recordset.length > 0) {
        const masc = existente.recordset[0];
        await tx.input("IdUsuarioMascota", sql.Int, masc.IdUsuarioMascota)
          .query(`UPDATE UsuarioMascota SET Activa = 1 WHERE IdUsuarioMascota = @IdUsuarioMascota`);

        await transaction.commit();
        return res.json(masc);
      }

      // buscar mascota base
      const mascotaBase = await tx
        .input("Tipo", sql.NVarChar, Tipo)
        .query(`SELECT TOP 1 * FROM Mascotas WHERE Tipo = @Tipo`);

      if (mascotaBase.recordset.length === 0) {
        await transaction.rollback();
        return res.status(400).json({ error: "Tipo de mascota no válido" });
      }

      const m = mascotaBase.recordset[0];

      // insertar nueva adopción
      const inserted = await tx
        .input("IdUsuario", sql.Int, IdUsuario)
        .input("IdMascota", sql.Int, m.IdMascota)
        .input("Tipo", sql.NVarChar, m.Tipo)
        .query(`
          INSERT INTO UsuarioMascota
          (IdUsuario, IdMascota, Tipo, FechaAdopcion, Activa,
           Nivel, Experiencia, ExperienciaNecesaria,
           Felicidad, Energia, Hambre, Monedas, Estado)
          OUTPUT INSERTED.*
          VALUES (@IdUsuario, @IdMascota, @Tipo, GETDATE(), 1,
                  1, 0, 100,
                  100, 100, 0, 50, 'Feliz')
        `);

      await transaction.commit();
      return res.json(inserted.recordset[0]);

    } catch (err) {
      await transaction.rollback();
      console.error("⚠ ERROR SQL mascota/seleccionar:", err);
      return res.status(500).json({ error: "Error seleccionando mascota" });
    }

  } catch (err) {
    console.error("❌ Error mascota/seleccionar:", err);
    return res.status(500).json({ error: "Error interno" });
  }
});


// =========================================================
// 🐾 MASCOTA - ACTUALIZAR PARÁMETROS
// =========================================================
app.put('/api/mascota/actualizar', authenticateToken, async (req, res) => {
  try {
    const data = req.body;
    const IdUsuario = req.user.userId;

    if (!data.IdUsuarioMascota)
      return res.status(400).json({ error: "IdUsuarioMascota requerido" });

    if (USE_SQLITE) {
      const check = await sqliteGet(
        `SELECT 1 FROM UsuarioMascota
         WHERE IdUsuarioMascota = ? AND IdUsuario = ?`,
        [data.IdUsuarioMascota, IdUsuario]
      );

      if (!check)
        return res.status(403).json({ error: "No autorizado para actualizar esta mascota" });

      await sqliteRun(
        `UPDATE UsuarioMascota
         SET Nivel=?, Experiencia=?, ExperienciaNecesaria=?,
             Felicidad=?, Energia=?, Hambre=?, Monedas=?, Estado=?
         WHERE IdUsuarioMascota=?`,
        [
          data.Nivel,
          data.Experiencia,
          data.ExperienciaNecesaria,
          data.Felicidad,
          data.Energia,
          data.Hambre,
          data.Monedas,
          data.Estado,
          data.IdUsuarioMascota
        ]
      );

      return res.json({ ok: true });
    }

    // SQL SERVER
    const check = await sqlRequestFromParams({
      IdUsuarioMascota: data.IdUsuarioMascota,
      IdUsuario
    }).query(`
      SELECT 1 FROM UsuarioMascota
      WHERE IdUsuarioMascota = @IdUsuarioMascota
        AND IdUsuario = @IdUsuario
    `);

    if (check.recordset.length === 0)
      return res.status(403).json({ error: "No autorizado" });

    await sqlRequestFromParams({
      ...data
    }).query(`
      UPDATE UsuarioMascota SET
        Nivel=@Nivel,
        Experiencia=@Experiencia,
        ExperienciaNecesaria=@ExperienciaNecesaria,
        Felicidad=@Felicidad,
        Energia=@Energia,
        Hambre=@Hambre,
        Monedas=@Monedas,
        Estado=@Estado
      WHERE IdUsuarioMascota=@IdUsuarioMascota
    `);

    return res.json({ ok: true });

  } catch (err) {
    console.error("⚠ Error mascota/actualizar:", err);
    res.status(500).json({ error: "Error actualizando mascota" });
  }
});

// ----------------- ESTADÍSTICAS -----------------
app.get('/api/estadisticas/generales', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    if (USE_SQLITE) {
      // Total emociones registradas
      const emocionesResult = await sqliteGet(
        'SELECT COUNT(*) as Total FROM RegistroEmocional WHERE IdUsuario = ?',
        [userId]
      );

      // Ejercicios completados
      const ejerciciosResult = await sqliteGet(
        'SELECT COUNT(*) as Total FROM SesionesEjercicio WHERE IdUsuario = ?',
        [userId]
      );

      // Retos completados (SQLite usa tabla Retos)
      const retosResult = await sqliteGet(
        "SELECT COUNT(*) as Total FROM Retos WHERE IdUsuario = ? AND Estado = 'Cumplido'",
        [userId]
      );

      // Días consecutivos con emociones registradas
      const diasResult = await sqliteGet(
        "SELECT COUNT(DISTINCT date(FechaRegistro)) as Dias FROM RegistroEmocional WHERE IdUsuario = ? AND FechaRegistro >= datetime('now', '-7 day')",
        [userId]
      );

      return res.json({
        emocionesRegistradas: emocionesResult.Total || 0,
        ejerciciosRealizados: ejerciciosResult.Total || 0,
        retosCompletados: retosResult.Total || 0,
        diasConsecutivos: diasResult.Dias || 0
      });
    }

    // ---------------- SQL SERVER ----------------
    const emocionesResult = await sqlRequestFromParams({ idUsuario: userId })
      .query('SELECT COUNT(*) as Total FROM RegistroEmocional WHERE IdUsuario = @idUsuario');

    const ejerciciosResult = await sqlRequestFromParams({ idUsuario: userId })
      .query('SELECT COUNT(*) as Total FROM SesionesEjercicio WHERE IdUsuario = @idUsuario');

    const retosResult = await sqlRequestFromParams({ idUsuario: userId })
      .query("SELECT COUNT(*) as Total FROM ProgresoRetos WHERE IdUsuario = @idUsuario AND Completado = 1");

    const diasResult = await sqlRequestFromParams({ idUsuario: userId })
      .query(`SELECT COUNT(DISTINCT CONVERT(DATE, FechaRegistro)) as Dias 
              FROM RegistroEmocional 
              WHERE IdUsuario = @idUsuario 
              AND FechaRegistro >= DATEADD(day, -7, GETDATE())`);

    return res.json({
      emocionesRegistradas: emocionesResult.recordset[0].Total,
      ejerciciosRealizados: ejerciciosResult.recordset[0].Total,
      retosCompletados: retosResult.recordset[0].Total,
      diasConsecutivos: diasResult.recordset[0].Dias
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// ----------------- PERFIL -----------------
app.post('/api/perfil/guardar', async (req, res) => {
  try {
    const { idUsuario, nombreCompleto, correoElectronico, fechaDeNacimiento, genero, biografia } = req.body;

    if (!idUsuario)
      return res.status(400).json({ error: 'Falta idUsuario' });

    if (USE_SQLITE) {
      await sqliteRun(`
        CREATE TABLE IF NOT EXISTS Perfil (
          IdPerfil INTEGER PRIMARY KEY AUTOINCREMENT,
          IdUsuario INTEGER,
          NombreCompleto TEXT,
          CorreoElectronico TEXT,
          FechaDeNacimiento TEXT,
          Genero TEXT,
          Biografia TEXT
        )
      `);

      const existe = await sqliteGet('SELECT 1 FROM Perfil WHERE IdUsuario = ?', [idUsuario]);

      if (!existe) {
        await sqliteRun(
          `INSERT INTO Perfil (IdUsuario, NombreCompleto, CorreoElectronico, FechaDeNacimiento, Genero, Biografia)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [idUsuario, nombreCompleto, correoElectronico, fechaDeNacimiento, genero, biografia]
        );
      } else {
        await sqliteRun(
          `UPDATE Perfil 
           SET NombreCompleto=?, CorreoElectronico=?, FechaDeNacimiento=?, Genero=?, Biografia=?
           WHERE IdUsuario=?`,
          [nombreCompleto, correoElectronico, fechaDeNacimiento, genero, biografia, idUsuario]
        );
      }

      return res.json({ success: true, message: 'Perfil guardado correctamente' });
    }

    // ---------------- SQL SERVER ----------------
    const existe = await sqlRequestFromParams({ IdUsuario: idUsuario })
      .query('SELECT 1 FROM Perfil WHERE IdUsuario = @IdUsuario');

    if (existe.recordset.length === 0) {
      await sqlRequestFromParams({
        IdUsuario: idUsuario,
        NombreCompleto: nombreCompleto,
        CorreoElectronico: correoElectronico,
        FechaDeNacimiento: fechaDeNacimiento,
        Genero: genero,
        Biografia: biografia
      }).query(`
        INSERT INTO Perfil (IdUsuario, NombreCompleto, CorreoElectronico, FechaDeNacimiento, Genero, Biografia)
        VALUES (@IdUsuario, @NombreCompleto, @CorreoElectronico, @FechaDeNacimiento, @Genero, @Biografia)
      `);
    } else {
      await sqlRequestFromParams({
        IdUsuario: idUsuario,
        NombreCompleto: nombreCompleto,
        CorreoElectronico: correoElectronico,
        FechaDeNacimiento: fechaDeNacimiento,
        Genero: genero,
        Biografia: biografia
      }).query(`
        UPDATE Perfil 
        SET NombreCompleto=@NombreCompleto, CorreoElectronico=@CorreoElectronico,
            FechaDeNacimiento=@FechaDeNacimiento, Genero=@Genero, Biografia=@Biografia
        WHERE IdUsuario=@IdUsuario
      `);
    }

    return res.json({ success: true, message: 'Perfil guardado correctamente' });

  } catch (err) {
    console.error('❌ Error en POST /api/perfil/guardar:', err);
    res.status(500).json({ error: 'Error al guardar perfil' });
  }
});

// ----------------- HEALTH -----------------
app.get('/api/health', async (req, res) => {
  try {
    if (USE_SQLITE) {
      await sqliteRun('SELECT 1'); 
      return res.json({
        status: 'OK',
        database: 'SQLite',
        timestamp: new Date().toISOString()
      });
    }

    await pool.request().query('SELECT 1 as Status');
    return res.json({
      status: 'OK',
      database: 'SQL Server',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return res.status(500).json({
      status: 'Error',
      database: USE_SQLITE ? 'SQLite' : 'SQL Server',
      error: error.message
    });
  }
});


// 404
app.use('*', (req, res) => { res.status(404).json({ error: 'Endpoint no encontrado' }); });

app.listen(PORT, () => {
  console.log('══════════════════════════════════════');
  console.log('🚀 SERVIDOR MENTE SANA INICIADO (DUAL DB)');
  console.log(`📄 Página web: http://localhost:${PORT}`);
  console.log(`🔧 API Health: http://localhost:${PORT}/api/health`);
  console.log(`🗄️ Usando DB: ${USE_SQLITE ? 'SQLite ( RAILWAY/ production)' : 'SQL Server (local)'}`);
  console.log('══════════════════════════════════════');
});
