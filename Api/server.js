const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'regapp'
});

db.connect(err => {
  if (err) throw err;
  console.log('Conectado a MySQL');
});

//usuarios
app.get('/api/usuarios', (req, res) => {
  db.query('SELECT * FROM usuarios', (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});

// Verificar si el correo ya existe
app.get('/api/usuarios/email/:correo', (req, res) => {
  const { correo } = req.params;
  db.query('SELECT * FROM usuarios WHERE correo = ?', [correo], (err, results) => {
    if (err) {
      console.error('Error al verificar el correo:', err);
      return res.status(500).json({ error: 'Error al verificar el correo.' });
    }
    
    if (results.length > 0) {
      return res.status(409).json({ message: 'El correo ya está registrado.' });
    }
    
    res.status(200).json({ message: 'El correo está disponible.' });
  });
});

app.post('/api/usuarios', (req, res) => {
  const nuevoUsuario = {
    nombre: req.body.nombre,
    correo: req.body.correo,
    contraseña: req.body.contraseña,
    rol: req.body.rol
  };

  db.query('INSERT INTO usuarios SET ?', nuevoUsuario, (err, result) => {
    if (err) {
      console.error('Error al insertar usuario:', err);
      return res.status(500).json({ error: 'Error al registrar el usuario.' });
    }
    res.status(201).json({ id: result.insertId, ...nuevoUsuario });
  });
});

// API para verificar el correo y restablecer la contraseña
app.post('/api/verificar-correo', (req, res) => {
  const { correo, nuevaPassword } = req.body;

  // Verificar si el correo existe
  db.query('SELECT * FROM usuarios WHERE correo = ?', [correo], (err, results) => {
    if (err) {
      console.error('Error al verificar el correo:', err);
      return res.status(500).json({ error: 'Error en la consulta a la base de datos.' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Correo no encontrado.' });
    }

    // Actualizar la contraseña
    db.query('UPDATE usuarios SET contraseña = ? WHERE correo = ?', [nuevaPassword, correo], (err, result) => {
      if (err) {
        console.error('Error al actualizar la contraseña:', err);
        return res.status(500).json({ error: 'Error al actualizar la contraseña.' });
      }

      res.status(200).json({ message: 'Contraseña restablecida exitosamente.' });
    });
  });
});


// Obtener un usuario específico
app.get('/api/usuarios/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM usuarios WHERE id = ?', [id], (err, result) => {
    if (err) throw err;
    res.json(result[0]);
  });
});

// API para iniciar sesión
app.post('/api/login', (req, res) => {
  const { correo, contraseña } = req.body;
  db.query('SELECT * FROM usuarios WHERE correo = ? AND contraseña = ?', [correo, contraseña], (err, results) => {
    if (err) {
      console.error('Error en la consulta:', err);
      return res.status(500).json({ error: 'Error en la consulta a la base de datos.' });
    }
    if (results.length > 0) {
      const user = results[0]; // Obtén el usuario encontrado
      console.log('Usuario encontrado:', user); // Agrega esto para verificar los datos
      res.status(200).json({ message: 'Inicio de sesión exitoso', user });
    } else {
      res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }
  });
});


// Obtener clases por profesor_id
app.get('/api/clases/profesor/:profesor_id', (req, res) => {
  const { profesor_id } = req.params;
  const estado = req.query.estado; // Obtener el estado de la consulta

  // Crear la consulta SQL
  let query = `
    SELECT * FROM clases 
    WHERE profesor_id = ?
  `;

  const params = [profesor_id];

  // Si se proporciona un estado, agregarlo a la consulta
  if (estado) {
    query += ` AND estado = ?`;
    params.push(estado);
  }

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Error al obtener las clases del profesor:', err);
      return res.status(500).json({ error: 'Error al obtener las clases.' });
    }
    res.status(200).json(results);
  });
});


//clases

// Obtener clases por estado con información del profesor
app.get('/api/clases', (req, res) => {
  const estado = req.query.estado; // Obtener el estado desde los parámetros de consulta

  let query = `
    SELECT clases.id, clases.nombre AS clase_nombre, clases.estado, clases.created_at, 
           usuarios.nombre AS profesor_nombre
    FROM clases
    JOIN usuarios ON clases.profesor_id = usuarios.id
  `; // Consulta base
  const queryParams = []; // Array para los parámetros de la consulta

  // Si se proporciona un estado, filtra por estado
  if (estado) {
    query += ' WHERE clases.estado = ?';
    queryParams.push(estado);
  }

  db.query(query, queryParams, (err, results) => {
    if (err) {
      console.error('Error al obtener clases:', err);
      return res.status(500).json({ error: 'Error al obtener clases.' });
    }
    res.json(results);
  });
});


app.get('/api/clases', (req, res) => {
  db.query('SELECT * FROM clases', (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});

app.post('/api/clases', (req, res) => {
  const { nombre, profesor_id } = req.body;

  // Asegúrate de que el estado se establezca en "en curso"
  const nuevaClase = {
    nombre: nombre,
    profesor_id: profesor_id,
    estado: 'en curso', // Establecer el estado por defecto
  };

  db.query('INSERT INTO clases SET ?', nuevaClase, (err, result) => {
    if (err) {
      console.error('Error al insertar clase:', err); // Imprimir error en la consola del servidor
      return res.status(500).json({ error: 'Error al crear la clase.' });
    }
    res.status(200).json({ id: result.insertId, ...nuevaClase });
  });
});

app.put('/api/clases/:id', (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  // Verificar que el nuevo estado esté definido
  if (!estado) {
    return res.status(400).json({ error: 'Estado es requerido.' });
  }

  db.query('UPDATE clases SET estado = ? WHERE id = ?', [estado, id], (err, result) => {
    if (err) {
      console.error('Error al actualizar clase:', err);
      return res.status(500).json({ error: 'Error al actualizar la clase.' });
    }
    res.status(200).json({ message: 'Clase actualizada exitosamente.' });
  });
});


// Obtener clases por ID
app.get('/api/clases/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM clases WHERE id = ?', [id], (err, result) => {
    if (err) throw err;
    res.json(result[0]);
  });
});

// Función para manejar consultas a la base de datos con promesas
const query = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};



// API para registrar asistencia
app.post('/api/asistencia/registrar', async (req, res) => {
  try {
    const { alumno_id, clase_id } = req.body;

    // Verifica si los datos son válidos
    if (!alumno_id || !clase_id) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    // Imprime los datos recibidos en la consola
    console.log('Datos recibidos:', { alumno_id, clase_id });

    // Realiza la consulta para obtener todas las asistencias con esos criterios
    const attendanceRecords = await query(
      'SELECT * FROM asistencia_clases WHERE clase_id = ? AND estudiante_id = ?',
      [clase_id, alumno_id]
    );

    // Imprime el resultado de la consulta
    console.log('Registros de asistencia encontrados:', attendanceRecords);

    // Verifica si ya existe un registro de asistencia
    if (attendanceRecords.length > 0) {
      return res.status(409).json({ message: 'Ya existe un registro de asistencia para esta clase.' });
    }

    // Insertar nuevo registro de asistencia
    const nuevaAsistencia = {
      clase_id,
      estudiante_id: alumno_id,
    };

    const result = await query('INSERT INTO asistencia_clases SET ?', nuevaAsistencia);
    console.log('Registro de asistencia creado con ID:', result.insertId);

    return res.status(201).json({ message: 'Asistencia registrada correctamente.', id: result.insertId });
  } catch (error) {
    console.error('Error al procesar la solicitud:', error);
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
});

// API para obtener la asistencia del alumno
app.get('/api/asistencia/:alumno_id', (req, res) => {
  const { alumno_id } = req.params;

  // Verifica si el ID del alumno es válido
  if (!alumno_id) {
    return res.status(400).json({ error: 'ID de alumno no proporcionado.' });
  }

  // Realiza la consulta para obtener la asistencia
  const query = `
    SELECT c.nombre AS clase_nombre, u.nombre AS profesor_nombre, a.attended_at
    FROM asistencia_clases a
    JOIN clases c ON a.clase_id = c.id
    JOIN usuarios u ON c.profesor_id = u.id
    WHERE a.estudiante_id = ?
  `;

  db.query(query, [alumno_id], (err, results) => {
    if (err) {
      console.error('Error al obtener la asistencia:', err);
      return res.status(500).json({ error: 'Error al obtener la asistencia.' });
    }

    // Verifica si se encontraron registros
    if (results.length === 0) {
      return res.status(404).json({ message: 'No se encontraron registros de asistencia.' });
    }

    res.status(200).json(results);
  });
});

// Obtener asistencia por clase
app.get('/api/asistencia/clase/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM asistencia_clases WHERE clase_id = ?', [id], (err, result) => {
    if (err) {
      console.error('Error al obtener la asistencia por clase:', err);
      return res.status(500).json({ message: 'Error al obtener la asistencia por clase' });
    }
    res.json(result);
  });
});





// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
