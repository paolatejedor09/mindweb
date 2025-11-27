-- ==============================================
-- BASE DE DATOS: salud_mental
-- ==============================================
CREATE DATABASE Salud_mental;
GO
USE Salud_mental;
GO

-- ======================
-- TABLA: Usuarios
-- ======================
CREATE TABLE Usuarios (
    IdUsuario INT IDENTITY(1,1) PRIMARY KEY,
    Nombre NVARCHAR(100),
    Correo NVARCHAR(150) UNIQUE,
    Contrasena NVARCHAR(255),
    FechaRegistro DATETIME DEFAULT GETDATE(),
    Avatar NVARCHAR(255),
    Nivel INT DEFAULT 1,
    Puntos INT DEFAULT 0
);
GO

-- ======================
-- TABLA: Perfil
-- ======================
CREATE TABLE Perfil (
    IdPerfil INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuario INT FOREIGN KEY REFERENCES Usuarios(IdUsuario) ON DELETE CASCADE,
    FechaNacimiento DATE,
    Genero NVARCHAR(20),
    Descripcion NVARCHAR(500),
    Estado NVARCHAR(50) DEFAULT 'Activo'
);
GO

-- ======================
-- TABLA: GestionContrasenas
-- ======================
CREATE TABLE GestionContrasenas (
    IdGestion INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuario INT FOREIGN KEY REFERENCES Usuarios(IdUsuario) ON DELETE CASCADE,
    ContrasenaActual NVARCHAR(255),
    ContrasenaNueva NVARCHAR(255),
    ConfirmacionContrasena NVARCHAR(255),
    FechaSolicitud DATETIME DEFAULT GETDATE(),
    TokenCambio NVARCHAR(100),
    ExpiracionToken DATETIME,
    Estado NVARCHAR(20) DEFAULT 'Pendiente' -- Pendiente, Aprobado, Cancelado
);
GO

-- ======================
-- TABLA: Emociones
-- ======================
CREATE TABLE Emociones (
    IdEmocion INT IDENTITY(1,1) PRIMARY KEY,
    Nombre NVARCHAR(50),
    Color NVARCHAR(20),
    Icono NVARCHAR(100)
);
GO


-- ======================
-- TABLA: Notas y Registro emocional
-- ======================
CREATE TABLE RegistroEmocional (
    IdRegistro INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuario INT FOREIGN KEY REFERENCES Usuarios(IdUsuario) ON DELETE CASCADE,
    IdEmocion INT FOREIGN KEY REFERENCES Emociones(IdEmocion),
    Nota NVARCHAR(1000),
    FechaRegistro DATETIME DEFAULT GETDATE()
);
GO

-- ======================
-- TABLA: FrasesMotivacionales
-- ======================
CREATE TABLE FrasesMotivacionales (
    IdFrase INT IDENTITY(1,1) PRIMARY KEY,
    Contenido NVARCHAR(500) NOT NULL,
    Autor NVARCHAR(100),
    Categoria NVARCHAR(50),
    FechaCreacion DATETIME DEFAULT GETDATE(),
    Estado BIT DEFAULT 1
);
GO

-- ======================
-- TABLA: FrasesFavoritas
-- ======================
CREATE TABLE FrasesFavoritas (
    IdFavorito INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuario INT FOREIGN KEY REFERENCES Usuarios(IdUsuario) ON DELETE CASCADE,
    IdFrase INT FOREIGN KEY REFERENCES FrasesMotivacionales(IdFrase),
    FechaAgregado DATETIME DEFAULT GETDATE()
);
GO

-- ======================
-- TABLA: Mascotas
-- ======================
CREATE TABLE Mascotas (
    IdMascota INT IDENTITY(1,1) PRIMARY KEY,
    Nombre NVARCHAR(100),
    Tipo NVARCHAR(50),
    Nivel INT DEFAULT 1,
    Experiencia INT DEFAULT 0,
    Estado NVARCHAR(50) DEFAULT 'Feliz',
    Energia INT DEFAULT 100,
    Hambre INT DEFAULT 0,
    Imagen NVARCHAR(255)
);
GO

-- ======================
-- TABLA: Mascotas por Usuario
-- ======================
CREATE TABLE UsuarioMascota (
    IdUsuarioMascota INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuario INT FOREIGN KEY REFERENCES Usuarios(IdUsuario) ON DELETE CASCADE,
    IdMascota INT FOREIGN KEY REFERENCES Mascotas(IdMascota) ON DELETE CASCADE,
    Apodo NVARCHAR(100),
    FechaAdopcion DATETIME DEFAULT GETDATE(),
    Activa BIT DEFAULT 0
);
GO

-- ======================
-- TABLA: Acciones de la Mascota
-- ======================
CREATE TABLE AccionesMascota (
    IdAccion INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuarioMascota INT FOREIGN KEY REFERENCES UsuarioMascota(IdUsuarioMascota) ON DELETE CASCADE,
    TipoAccion NVARCHAR(50),  -- Comer, Jugar, Dormir, Ejercitarse
    FechaAccion DATETIME DEFAULT GETDATE(),
    PuntosGanados INT DEFAULT 0
);
GO

-- ======================
-- TABLA: Ejercicios
-- ======================
CREATE TABLE Ejercicios (
    IdEjercicio INT IDENTITY(1,1) PRIMARY KEY,
    Nombre NVARCHAR(150),
    Descripcion NVARCHAR(1000),
    Tipo NVARCHAR(100), -- respiración, meditación, relajación
    DuracionMin INT,
    Dificultad NVARCHAR(50)
);
GO

-- ======================
-- TABLA: Sesiones de Ejercicio
-- ======================
CREATE TABLE SesionesEjercicio (
    IdSesion INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuario INT FOREIGN KEY REFERENCES Usuarios(IdUsuario) ON DELETE CASCADE,
    IdEjercicio INT FOREIGN KEY REFERENCES Ejercicios(IdEjercicio),
    FechaSesion DATETIME DEFAULT GETDATE(),
    Completado BIT DEFAULT 1
);
GO

-- ======================
-- TABLA: Retos
-- ======================
CREATE TABLE Retos (
    IdReto INT IDENTITY(1,1) PRIMARY KEY,
    Titulo NVARCHAR(150),
    Descripcion NVARCHAR(1000),
    RecompensaPuntos INT,
    FechaInicio DATETIME DEFAULT GETDATE(),
    FechaFin DATETIME
);
GO

-- ======================
-- TABLA: Progreso de Retos
-- ======================
CREATE TABLE ProgresoRetos (
    IdProgreso INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuario INT FOREIGN KEY REFERENCES Usuarios(IdUsuario) ON DELETE CASCADE,
    IdReto INT FOREIGN KEY REFERENCES Retos(IdReto) ON DELETE CASCADE,
    Completado BIT DEFAULT 0,
    FechaCompletado DATETIME NULL
);
GO

-- ======================
-- TABLA: Calendario Emocional
-- ======================
CREATE TABLE CalendarioEmociones (
    IdCalendario INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuario INT FOREIGN KEY REFERENCES Usuarios(IdUsuario) ON DELETE CASCADE,
    IdEmocion INT FOREIGN KEY REFERENCES Emociones(IdEmocion),
    Fecha DATE,
    Nota NVARCHAR(500)
);
GO

-- ======================
-- TABLA: Recursos y Artículos
-- ======================
CREATE TABLE Articulos (
    IdArticulo INT IDENTITY(1,1) PRIMARY KEY,
    Titulo NVARCHAR(150),
    Descripcion NVARCHAR(1000),
    Categoria NVARCHAR(100),
    Autor NVARCHAR(100),
    FechaPublicacion DATETIME DEFAULT GETDATE(),
    Imagen NVARCHAR(255),
    Enlace NVARCHAR(500)
);
GO

-- ======================
-- TABLA: Notificaciones
-- ======================
CREATE TABLE Notificaciones (
    IdNotificacion INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuario INT FOREIGN KEY REFERENCES Usuarios(IdUsuario) ON DELETE CASCADE,
    Mensaje NVARCHAR(500),
    Tipo NVARCHAR(50),
    Fecha DATETIME DEFAULT GETDATE(),
    Leida BIT DEFAULT 0
);
GO

-- ===========================================================
-- INSERTS DE DATOS DE EJEMPLO
-- ===========================================================

-- Emociones básicas
INSERT INTO Emociones (Nombre, Color, Icono) VALUES
('Feliz', '#4CAF50', 'fa-face-smile'),
('Triste', '#2196F3', 'fa-face-frown'),
('Enojado', '#F44336', 'fa-face-angry'),
('Ansioso', '#FF9800', 'fa-face-meh'),
('Calmado', '#9C27B0', 'fa-face-smile-beam'),
('Energico', '#FFC107', 'fa-bolt'),
('Confundido', '#795548', 'fa-face-flushed'),
('Agradecido', '#009688', 'fa-face-grin-hearts');
GO

-- Frases Motivacionales
INSERT INTO FrasesMotivacionales (Contenido, Autor, Categoria) VALUES
('La vida es 10% lo que me pasa y 90% cómo reacciono a ello', 'Charles R. Swindoll', 'Motivación'),
('El único modo de hacer un gran trabajo es amar lo que haces', 'Steve Jobs', 'Trabajo'),
('No cuentes los días, haz que los días cuenten', 'Muhammad Ali', 'Productividad'),
('La calma es el lujo de los fuertes', 'Anónimo', 'Calma'),
('Cada día es una nueva oportunidad para cambiar tu vida', 'Anónimo', 'Oportunidad'),
('La gratitud transforma lo que tenemos en suficiente', 'Anónimo', 'Gratitud'),
('Respira. Todo va a estar bien. No siempre perfecto, pero bien', 'Anónimo', 'Respiración'),
('Pequeños pasos cada día conducen a grandes resultados', 'Anónimo', 'Progreso'),
('Tu mente es poderosa. Cuando la llenas de buenos pensamientos, tu vida comienza a cambiar', 'Anónimo', 'Mentalidad'),
('El autocuidado no es egoísmo, es preservación', 'Anónimo', 'Autocuidado');
GO

-- Usuario de ejemplo
INSERT INTO Usuarios (Nombre, Correo, Contrasena, Avatar, Nivel, Puntos)
VALUES ('Angie', 'angie@mentesana.com', '1234', '/img/avatar1.png', 2, 150);
GO

-- Perfil ejemplo
INSERT INTO Perfil (IdUsuario, FechaNacimiento, Genero, Descripcion)
VALUES (1, '2000-09-09', 'Femenino', 'Buscando equilibrio emocional con Mente Sana');
GO

-- Gestión de contraseña inicial
INSERT INTO GestionContrasenas (IdUsuario, ContrasenaActual, Estado)
VALUES (1, '1234', 'Aprobado');
GO

-- Mascotas disponibles
INSERT INTO Mascotas (Nombre, Tipo, Imagen)
VALUES
('axolote', 'axolo', '/img/axolote.png'),
('caracol', 'col', '/img/caracol.png'),
('dinosaurio', 'dino', '/img/dino.png');
GO

-- Mascota adoptada por el usuario
INSERT INTO UsuarioMascota (IdUsuario, IdMascota, Apodo, Activa)
VALUES (1, 1, 'dino', 1);
GO

-- Ejercicios de bienestar
INSERT INTO Ejercicios (Nombre, Descripcion, Tipo, DuracionMin, Dificultad) VALUES
('Respiración Profunda', 'Inhala 4 segundos, retén 4, exhala 4', 'Respiración', 5, 'Fácil'),
('Meditación Guiada', 'Meditación de 10 minutos para calmar la mente', 'Meditación', 10, 'Media'),
('Relajación Muscular', 'Ejercicio para liberar tensión corporal', 'Relajación', 8, 'Fácil');
GO

-- Retos iniciales
INSERT INTO Retos (Titulo, Descripcion, RecompensaPuntos, FechaFin)
VALUES
('Completa tu primer registro emocional', 'Anota cómo te sientes hoy y escribe una reflexión.', 50, DATEADD(DAY, 7, GETDATE())),
('Haz una sesión de respiración', 'Realiza un ejercicio de respiración guiada.', 30, DATEADD(DAY, 7, GETDATE())),
('Cuida tu mascota virtual', 'Alimenta y juega con tu mascota una vez al día.', 100, DATEADD(DAY, 14, GETDATE()));
GO

-- Artículos y recursos
INSERT INTO Articulos (Titulo, Descripcion, Categoria, Autor, Imagen, Enlace)
VALUES
('Cómo mantener una mente positiva', 'Técnicas simples para mejorar tu bienestar mental.', 'Salud Mental', 'Equipo Mente Sana', '/img/art1.jpg', 'https://mentesana.com/art1'),
('Ejercicios de respiración para el estrés', 'Guía paso a paso para calmar tu mente.', 'Ejercicios', 'Angie D.', '/img/art2.jpg', 'https://mentesana.com/art2');
GO

-- Notificación inicial
INSERT INTO Notificaciones (IdUsuario, Mensaje, Tipo)
VALUES (1, '¡Bienvenida a Mente Sana! Has recibido tu primera mascota.', 'Bienvenida');
GO

-- Registro emocional de ejemplo
INSERT INTO RegistroEmocional (IdUsuario, IdEmocion, Nota)
VALUES (1, 1, 'Hoy me siento tranquila y motivada.');
GO

-- Frase favorita de ejemplo
INSERT INTO FrasesFavoritas (IdUsuario, IdFrase)
VALUES (1, 1);
GO

-- ===========================================================
-- PROCEDIMIENTOS ALMACENADOS
-- ===========================================================

-- Procedimiento para cambiar contraseña
CREATE PROCEDURE sp_CambiarContrasena
    @IdUsuario INT,
    @ContrasenaActual NVARCHAR(255),
    @ContrasenaNueva NVARCHAR(255),
    @ConfirmacionContrasena NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- Verificar que la contraseña actual sea correcta
        IF NOT EXISTS (SELECT 1 FROM Usuarios WHERE IdUsuario = @IdUsuario AND Contrasena = @ContrasenaActual)
        BEGIN
            SELECT 0 AS Exito, 'La contraseña actual es incorrecta' AS Mensaje;
            RETURN;
        END
        
        -- Verificar que las nuevas contraseñas coincidan
        IF @ContrasenaNueva <> @ConfirmacionContrasena
        BEGIN
            SELECT 0 AS Exito, 'Las nuevas contraseñas no coinciden' AS Mensaje;
            RETURN;
        END
        
        -- Verificar que la nueva contraseña sea diferente a la actual
        IF @ContrasenaActual = @ContrasenaNueva
        BEGIN
            SELECT 0 AS Exito, 'La nueva contraseña debe ser diferente a la actual' AS Mensaje;
            RETURN;
        END
        
        -- Registrar la solicitud de cambio
        INSERT INTO GestionContrasenas (IdUsuario, ContrasenaActual, ContrasenaNueva, ConfirmacionContrasena, Estado)
        VALUES (@IdUsuario, @ContrasenaActual, @ContrasenaNueva, @ConfirmacionContrasena, 'Pendiente');
        
        -- Actualizar la contraseña en la tabla Usuarios
        UPDATE Usuarios 
        SET Contrasena = @ContrasenaNueva 
        WHERE IdUsuario = @IdUsuario;
        
        -- Actualizar el estado a Aprobado
        UPDATE GestionContrasenas 
        SET Estado = 'Aprobado' 
        WHERE IdGestion = SCOPE_IDENTITY();
        
        COMMIT TRANSACTION;
        
        SELECT 1 AS Exito, 'Contraseña cambiada exitosamente' AS Mensaje;
        
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        SELECT 0 AS Exito, 'Error al cambiar la contraseña: ' + ERROR_MESSAGE() AS Mensaje;
    END CATCH
END;
GO

-- Procedimiento para obtener frase aleatoria
CREATE PROCEDURE sp_ObtenerFraseAleatoria
    @IdUsuario INT = NULL
AS
BEGIN
    IF @IdUsuario IS NULL
    BEGIN
        SELECT TOP 1 
            IdFrase,
            Contenido,
            Autor,
            Categoria
        FROM FrasesMotivacionales 
        WHERE Estado = 1
        ORDER BY NEWID();
    END
    ELSE
    BEGIN
        SELECT TOP 1 
            f.IdFrase,
            f.Contenido,
            f.Autor,
            f.Categoria,
            CASE WHEN ff.IdFavorito IS NOT NULL THEN 1 ELSE 0 END AS EsFavorita
        FROM FrasesMotivacionales f
        LEFT JOIN FrasesFavoritas ff ON f.IdFrase = ff.IdFrase AND ff.IdUsuario = @IdUsuario
        WHERE f.Estado = 1
        ORDER BY NEWID();
    END
END;
GO

-- Procedimiento para agregar frase a favoritos
CREATE PROCEDURE sp_AgregarFraseFavorita
    @IdUsuario INT,
    @IdFrase INT
AS
BEGIN
    IF NOT EXISTS (SELECT 1 FROM FrasesFavoritas WHERE IdUsuario = @IdUsuario AND IdFrase = @IdFrase)
    BEGIN
        INSERT INTO FrasesFavoritas (IdUsuario, IdFrase)
        VALUES (@IdUsuario, @IdFrase);
        
        SELECT 1 AS Exito, 'Frase agregada a favoritos' AS Mensaje;
    END
    ELSE
    BEGIN
        SELECT 0 AS Exito, 'La frase ya está en tus favoritos' AS Mensaje;
    END
END;
GO

-- Procedimiento para quitar frase de favoritos
CREATE PROCEDURE sp_QuitarFraseFavorita
    @IdUsuario INT,
    @IdFrase INT
AS
BEGIN
    DELETE FROM FrasesFavoritas 
    WHERE IdUsuario = @IdUsuario AND IdFrase = @IdFrase;
    
    SELECT 1 AS Exito, 'Frase removida de favoritos' AS Mensaje;
END;
GO

-- Procedimiento para obtener frases favoritas de un usuario
CREATE PROCEDURE sp_ObtenerFrasesFavoritas
    @IdUsuario INT
AS
BEGIN
    SELECT 
        f.IdFrase,
        f.Contenido,
        f.Autor,
        f.Categoria,
        ff.FechaAgregado
    FROM FrasesFavoritas ff
    INNER JOIN FrasesMotivacionales f ON ff.IdFrase = f.IdFrase
    WHERE ff.IdUsuario = @IdUsuario
    ORDER BY ff.FechaAgregado DESC;
END;
GO

-- ===========================================================
-- VISTAS ÚTILES
-- ===========================================================

-- Vista para el perfil completo del usuario
CREATE VIEW vw_PerfilCompleto AS
SELECT 
    u.IdUsuario,
    u.Nombre,
    u.Correo,
    u.Avatar,
    u.Nivel,
    u.Puntos,
    p.FechaNacimiento,
    p.Genero,
    p.Descripcion,
    p.Estado AS EstadoPerfil,
    um.Apodo AS NombreMascota,
    m.Tipo AS TipoMascota,
    m.Imagen AS ImagenMascota
FROM Usuarios u
LEFT JOIN Perfil p ON u.IdUsuario = p.IdUsuario
LEFT JOIN UsuarioMascota um ON u.IdUsuario = um.IdUsuario AND um.Activa = 1
LEFT JOIN Mascotas m ON um.IdMascota = m.IdMascota;
GO

-- Vista para estadísticas emocionales
CREATE VIEW vw_EstadisticasEmocionales AS
SELECT 
    u.IdUsuario,
    u.Nombre,
    COUNT(re.IdRegistro) AS TotalRegistros,
    MIN(re.FechaRegistro) AS PrimeraFecha,
    MAX(re.FechaRegistro) AS UltimaFecha,
    e.Nombre AS EmocionFrecuente,
    COUNT(*) AS VecesEmocionFrecuente
FROM Usuarios u
LEFT JOIN RegistroEmocional re ON u.IdUsuario = re.IdUsuario
LEFT JOIN Emociones e ON re.IdEmocion = e.IdEmocion
GROUP BY u.IdUsuario, u.Nombre, e.Nombre;
GO


-- ===========================================================
-- CONSULTAS DE PRUEBA
-- ===========================================================

-- Probar cambio de contraseña
EXEC sp_CambiarContrasena 1, '1234', 'nueva123', 'nueva123';

-- Obtener frase aleatoria
EXEC sp_ObtenerFraseAleatoria 1;

-- Agregar frase a favoritos
EXEC sp_AgregarFraseFavorita 1, 2;

-- Ver perfil completo
SELECT * FROM vw_PerfilCompleto;

-- Ver estadísticas emocionales
SELECT * FROM vw_EstadisticasEmocionales;

SELECT * FROM CalendarioEmociones

-- Ver todas las tablas
SELECT 
    '? CONEXIÓN EXITOSA' as Estado,
    @@SERVERNAME as Servidor,
    DB_NAME() as BaseDatos,
    GETDATE() as FechaHora;
GO

select * from Usuarios


ALTER LOGIN sa ENABLE;
GO
ALTER LOGIN sa WITH PASSWORD = 'salud123';
GO




-- Verificar tablas principales
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_NAME IN ('Usuarios', 'Emociones', 'Mascotas', 'RegistroEmocional');

UPDATE Mascotas SET Tipo = 'axolote' WHERE IdMascota = 1;
UPDATE Mascotas SET Tipo = 'caracol' WHERE IdMascota = 2;
UPDATE Mascotas SET Tipo = 'dinosaurio' WHERE IdMascota = 3;

ALTER TABLE Mascotas
ADD CONSTRAINT UQ_Mascotas_Tipo UNIQUE (Tipo);

-- 🔍 Verificar mascotas registradas y sus tipos
SELECT 
    IdMascota,
    Nombre,
    Tipo,
    Imagen,
    Nivel,
    Experiencia,
    Estado,
    Energia,
    Hambre
FROM Mascotas;



-- 🔍 Verificar la mascota activa del usuario
SELECT 
    u.Nombre AS Usuario,
    m.Nombre AS Mascota,
    m.Tipo,
    um.Activa,
    m.Imagen
FROM UsuarioMascota um
INNER JOIN Usuarios u ON um.IdUsuario = u.IdUsuario
INNER JOIN Mascotas m ON um.IdMascota = m.IdMascota
WHERE um.Activa = 1;


-- Script para corregir posibles problemas en la base de datos

-- Verificar y corregir nombres de emociones
UPDATE Emociones SET Nombre = 'Feliz' WHERE Nombre = 'feliz';
UPDATE Emociones SET Nombre = 'Triste' WHERE Nombre = 'triste';
UPDATE Emociones SET Nombre = 'Enojado' WHERE Nombre = 'enojado';
UPDATE Emociones SET Nombre = 'Ansioso' WHERE Nombre = 'ansioso';
UPDATE Emociones SET Nombre = 'Calmado' WHERE Nombre = 'calmado';
UPDATE Emociones SET Nombre = 'Energico' WHERE Nombre = 'energico';
UPDATE Emociones SET Nombre = 'Confundido' WHERE Nombre = 'confundido';
UPDATE Emociones SET Nombre = 'Agradecido' WHERE Nombre = 'agradecido';

-- Asegurar que el usuario Angie tenga una mascota activa
UPDATE UsuarioMascota SET Activa = 1 
WHERE IdUsuario = 1 AND IdMascota = 1;

-- Verificar datos
SELECT 
    u.Nombre AS Usuario,
    e.Nombre AS Emocion,
    re.Nota,
    re.FechaRegistro
FROM RegistroEmocional re
INNER JOIN Usuarios u ON re.IdUsuario = u.IdUsuario
INNER JOIN Emociones e ON re.IdEmocion = e.IdEmocion
WHERE u.IdUsuario = 1;

SELECT 
    u.Nombre AS Usuario,
    m.Tipo AS Mascota,
    um.Activa
FROM UsuarioMascota um
INNER JOIN Usuarios u ON um.IdUsuario = u.IdUsuario
INNER JOIN Mascotas m ON um.IdMascota = m.IdMascota
WHERE u.IdUsuario = 1;




-- Ver todas las tablas
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE';

-- Ver estructura de una tabla
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'usuarios';

-- Ver datos de usuarios
SELECT * FROM usuarios;

-- Ver datos de mascotas
SELECT * FROM mascotas;

-- Ver registros de emociones
SELECT * FROM registros_emociones;