import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Calendar,
  Clock,
  LogOut,
  FileText,
  PlusCircle,
  Trash2,
  UserCog,
  School,
  AlertCircle
} from 'lucide-react';

// --- CONFIGURACIÓN BÁSICA ---

const ADMIN_EMAIL = 'antoniogg@iesmajuelo.com';
const TEACHER_EMAIL_DOMAIN = 'g.educaand.es';

// --- MOCK DATA & CONSTANTS ---

const MOTIVOS_RETRASO = [
  'Transporte escolar',
  'Consulta médica',
  'Trámite administrativo',
  'Dormido/a',
  'Indisposición',
  'Otro (Justificado)',
  'Otro (Injustificado)'
];

const MOTIVOS_AUSENCIA_PROFE = [
  'Enfermedad (Baja)',
  'Consulta Médica',
  'Deber Inexcusable',
  'Formación',
  'Asuntos Propios',
  'Excursión/Salida'
];

const GRUPOS = ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B'];

const TEACHER_ROLE_LABELS = {
  profesor: 'Profesor',
  tutor: 'Tutor',
  jefe: 'Jefe de Estudios'
};

const INITIAL_STUDENTS = [
  { id: 's1', nombre: 'María Pérez', grupo: '1A' },
  { id: 's2', nombre: 'Juan López', grupo: '1A' },
  { id: 's3', nombre: 'Sofía García', grupo: '2B' },
  { id: 's4', nombre: 'Carlos Ruiz', grupo: '2B' },
  { id: 's5', nombre: 'Ana Mola', grupo: '4A' }
];

const INITIAL_TEACHERS = [
  {
    id: 't_admin',
    nombre: 'Antonio González García',
    email: ADMIN_EMAIL,
    roles: { profesor: true, tutor: false, jefe: true }
  },
  {
    id: 't_jboncar141',
    nombre: 'Julia Belén Bonilla Carmona',
    email: 'jboncar141@g.educaand.es',
    abreviatura: 'BONIC',
    roles: { profesor: true, tutor: false, jefe: false }
  },
  {
    id: 't_msancan337',
    nombre: 'María Dolores Santos Cano',
    email: 'msancan337@g.educaand.es',
    abreviatura: 'SANCA',
    roles: { profesor: true, tutor: false, jefe: false }
  },
  {
    id: 't_mcorher739',
    nombre: 'Lola Corvillo',
    email: 'mcorher739@g.educaand.es',
    abreviatura: 'CORV',
    roles: { profesor: true, tutor: false, jefe: false }
  },
  {
    id: 't1',
    nombre: 'Antonio González',
    email: 'antoniogonzalezgarcia@g.educaand.es',
    roles: { profesor: true, tutor: true, jefe: false }
  },
  {
    id: 't2',
    nombre: 'Laura M.',
    email: 'laura@g.educaand.es',
    roles: { profesor: true, tutor: false, jefe: false }
  }
];

const INITIAL_INCIDENCIAS = [
  {
    id: 'inc1',
    tipo: 'retraso',
    alumno: 'María Pérez',
    grupo: '1A',
    motivo: 'Transporte escolar',
    fecha: '2023-10-27T08:15',
    creado_por: 'antoniogonzalezgarcia@g.educaand.es'
  }
];

const INITIAL_AUSENCIAS = [
  {
    id: 'aus1',
    profesor: 'Antonio González',
    profesorId: 't1',
    motivo: 'Consulta Médica',
    desde: '2023-10-28T08:00',
    hasta: '2023-10-28T11:00',
    estado: 'pendiente'
  }
];

// --- HELPERS ---

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const cleanProfesorName = (name) => {
  return String(name || '')
    .replace(/^(D\\.?\\s+|Dª\\.?\\s+|Dª\\s+|D\\.\\s+|D\\s+)/i, '')
    .replace(/\\s+/g, ' ')
    .trim();
};

const parseHorarioXml = (xmlText) => {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'application/xml');
  const parseError = xml.getElementsByTagName('parsererror')[0];
  if (parseError) {
    return { error: 'El XML no es válido.' };
  }

  const centro = xml.getElementsByTagName('CENTRO')[0];
  const nombreCentro = centro?.getAttribute('nombre_centro') || 'Sin nombre';
  const fecha = centro?.getAttribute('fecha') || 'Sin fecha';

  const count = (tag) => xml.getElementsByTagName(tag).length;

  const asignaturas = {};
  Array.from(xml.getElementsByTagName('ASIGNATURA')).forEach((node) => {
    const id = node.getAttribute('num_int_as');
    if (!id) return;
    asignaturas[id] = {
      abreviatura: node.getAttribute('abreviatura') || '',
      nombre: node.getAttribute('nombre') || ''
    };
  });

  const profesores = Array.from(xml.getElementsByTagName('PROFESOR')).map((node) => ({
    id: node.getAttribute('num_int_pr') || '',
    nombre: cleanProfesorName(node.getAttribute('nombre') || ''),
    abreviatura: node.getAttribute('abreviatura') || ''
  }));

  const grupos = {};
  Array.from(xml.getElementsByTagName('GRUPO')).forEach((node) => {
    const id = node.getAttribute('num_int_gr');
    if (!id) return;
    grupos[id] = {
      abreviatura: node.getAttribute('abreviatura') || '',
      nombre: node.getAttribute('nombre') || ''
    };
  });

  const tramos = Array.from(xml.getElementsByTagName('TRAMO')).map((node) => ({
    id: node.getAttribute('num_tr') || '',
    dia: Number(node.getAttribute('numero_dia') || 0),
    hora: Number(node.getAttribute('numero_hora') || 0),
    inicio: (node.getAttribute('hora_inicio') || '').trim(),
    fin: (node.getAttribute('hora_final') || '').trim()
  }));

  const horariosPorProfesor = {};
  const actividadesPorProfesorTramo = {};
  Array.from(xml.getElementsByTagName('HORARIO_PROF')).forEach((horarioNode) => {
    const profId = (horarioNode.getAttribute('hor_num_int_pr') || '').trim();
    if (!profId) return;
    const actividades = Array.from(horarioNode.getElementsByTagName('ACTIVIDAD')).map((actNode) => {
      const tramo = (actNode.getAttribute('tramo') || '').trim();
      const asignatura = (actNode.getAttribute('asignatura') || '').trim();
      const aula = (actNode.getAttribute('aula') || '').trim();
      const gruposNode = actNode.getElementsByTagName('GRUPOS_ACTIVIDAD')[0];
      const groupIds = [];
      if (gruposNode) {
        Array.from(gruposNode.attributes).forEach((attr) => {
          if (attr.name.startsWith('grupo_') && attr.value) {
            groupIds.push(String(attr.value).trim());
          }
        });
      }
      if (tramo) {
        if (!actividadesPorProfesorTramo[profId]) actividadesPorProfesorTramo[profId] = {};
        if (!actividadesPorProfesorTramo[profId][tramo]) {
          actividadesPorProfesorTramo[profId][tramo] = { groups: new Set(), aulas: new Set() };
        }
        groupIds.forEach(id => actividadesPorProfesorTramo[profId][tramo].groups.add(id));
        if (aula) actividadesPorProfesorTramo[profId][tramo].aulas.add(aula);
      }
      return { tramo, asignatura, aula };
    });
    horariosPorProfesor[profId] = actividades;
  });

  const actividadesByTramo = {};
  Array.from(xml.getElementsByTagName('HORARIO_AULA')).forEach((horarioNode) => {
    Array.from(horarioNode.getElementsByTagName('ACTIVIDAD')).forEach((actNode) => {
      const tramo = (actNode.getAttribute('tramo') || '').trim();
      const profesorId = (actNode.getAttribute('profesor') || '').trim();
      const asignaturaId = (actNode.getAttribute('asignatura') || '').trim();
      const gruposNode = actNode.getElementsByTagName('GRUPOS_ACTIVIDAD')[0];
      const groupIds = [];
      if (gruposNode) {
        Array.from(gruposNode.attributes).forEach((attr) => {
          if (attr.name.startsWith('grupo_') && attr.value) {
            groupIds.push(String(attr.value).trim());
          }
        });
      }
      if (!tramo) return;
      if (!actividadesByTramo[tramo]) actividadesByTramo[tramo] = [];
      actividadesByTramo[tramo].push({ profesorId, asignaturaId, groupIds });
    });
  });

  return {
    centro: nombreCentro,
    fecha,
    asignaturasCount: count('ASIGNATURA'),
    profesoresCount: count('PROFESOR'),
    gruposCount: count('GRUPO'),
    actividadesCount: count('ACTIVIDAD'),
    horariosAulaCount: count('HORARIO_AULA'),
    horariosProfesorCount: count('HORARIO_PROF'),
    asignaturas,
    profesores,
    grupos,
    tramos,
    horariosPorProfesor,
    actividadesPorProfesorTramo,
    actividadesByTramo
  };
};

const normalizeName = (value) => String(value || '')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .replace(/[^a-zA-Z0-9\s]/g, '')
  .trim()
  .toLowerCase();

const computeAbbreviation = (fullName) => {
  if (!fullName) return '';
  const cleaned = normalizeName(fullName);
  if (!cleaned) return '';

  let surnamePart = cleaned;
  if (cleaned.includes(',')) {
    surnamePart = cleaned.split(',')[0].trim();
  }
  const tokens = surnamePart.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    const s1 = tokens[0].slice(0, 3);
    const s2 = tokens[1].slice(0, 2);
    return (s1 + s2).toUpperCase();
  }
  if (tokens.length === 1) {
    return tokens[0].slice(0, 5).toUpperCase();
  }
  return '';
};

const splitNameAndSurnames = (fullName) => {
  const raw = String(fullName || '').trim();
  if (!raw) return { nombre: '', apellidos: '' };
  if (raw.includes(',')) {
    const [apellidos, nombre] = raw.split(',').map(s => s.trim());
    return { nombre, apellidos };
  }
  const parts = raw.split(/\s+/);
  if (parts.length <= 2) return { nombre: raw, apellidos: '' };
  const apellidos = parts.slice(-2).join(' ');
  const nombre = parts.slice(0, -2).join(' ');
  return { nombre, apellidos };
};

const findProfesorIdByName = (profesores, userName) => {
  if (!profesores || !userName) return null;
  const target = normalizeName(userName);
  const exact = profesores.find(p => normalizeName(p.nombre) === target);
  if (exact) return exact.id || null;

  const tokens = target.split(/\s+/).filter(t => t.length > 2);
  if (!tokens.length) return null;
  const partial = profesores.find(p => {
    const normalized = normalizeName(p.nombre);
    return tokens.every(t => normalized.includes(t));
  });
  return partial?.id || null;
};

const getWeekDates = (baseDate = new Date()) => {
  const date = new Date(baseDate);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return Array.from({ length: 5 }).map((_, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + idx);
    return d;
  });
};

const formatDateKey = (date) => {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const isPastSlot = (date, startTime) => {
  if (!date) return true;
  const now = new Date();
  const slotDate = new Date(date);
  const [h, m] = String(startTime || '00:00').trim().split(':').map(Number);
  slotDate.setHours(h || 0, m || 0, 0, 0);
  return slotDate < now;
};

const parseCsvText = (text) => {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const separators = ['\t', ';', '|', ','];
  const separator = separators
    .map(sep => ({ sep, count: (lines[0].match(new RegExp(`\\${sep}`, 'g')) || []).length }))
    .sort((a, b) => b.count - a.count)[0]?.sep || ',';

  const splitCsvLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];
      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (char === separator && !inQuotes) {
        result.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    result.push(current.trim());
    return result.map(value => value.replace(/^["']|["']$/g, '').trim());
  };

  const rawRows = lines.map((line) => splitCsvLine(line));
  const headerRow = rawRows[0].map(h => h.toLowerCase());

  const hasHeaders = headerRow.includes('email') || headerRow.includes('correo');
  const startIndex = hasHeaders ? 1 : 0;

  const headerMap = hasHeaders ? headerRow : ['nombre', 'email', 'profesor', 'tutor', 'jefe'];

  return rawRows.slice(startIndex).map((row) => {
    const record = {};
    headerMap.forEach((key, index) => {
      record[key] = row[index] || '';
    });
    record._row = row;
    return record;
  });
};

const parseBool = (value) => {
  const v = String(value || '').trim().toLowerCase();
  return ['1', 'true', 'si', 'sí', 'x', 'yes'].includes(v);
};

const isLikelyEmail = (value) => /@/.test(String(value || ''));

const isLikelyDni = (value) => /^[0-9]{7,8}[a-zA-Z]$/.test(String(value || '').trim());

const parseDateDMY = (value) => {
  const match = String(value || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
};

const isPastCese = (value) => {
  const date = parseDateDMY(value);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

const normalizeHeader = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '');

const inferEnsenanza = (grupo) => {
  const g = String(grupo || '').toUpperCase();
  if (/^[1-4][A-Z]$/.test(g)) return 'ESO';
  if (g.includes('BAC') || g.includes('BACH')) return 'Bachillerato';
  if (g.includes('FP') || g.includes('GM') || g.includes('GS') || g.includes('GB')) return 'FP';
  return '';
};

const getAcademicYearStart = (today = new Date()) => {
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  const startYear = m >= 9 ? y : y - 1;
  return new Date(startYear, 8, 1);
};

const extractGroup = (value) => {
  const v = String(value || '').toUpperCase().trim();
  if (!v) return '';
  const direct = v.match(/^([1-4])\s*([A-Z])$/);
  if (direct) return `${direct[1]}${direct[2]}`;
  const eso = v.match(/([1-4])\s*º?\s*ESO\s*([A-Z])/);
  if (eso) return `${eso[1]}${eso[2]}`;
  const bach = v.match(/([1-2])\s*º?\s*BACH\s*([A-Z])/);
  if (bach) return `BACH ${bach[1]}${bach[2]}`;
  return '';
};

// --- COMPONENTES AUXILIARES ---

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${className}`}>
    {children}
  </div>
);

const Badge = ({ type }) => {
  const styles = {
    retraso: 'bg-yellow-100 text-yellow-800',
    salida: 'bg-orange-100 text-orange-800',
    parte: 'bg-red-100 text-red-800',
    pendiente: 'bg-blue-100 text-blue-800',
    aprobada: 'bg-green-100 text-green-800',
    recibida: 'bg-emerald-100 text-emerald-800',
    rol: 'bg-slate-100 text-slate-700'
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${styles[type] || 'bg-gray-100 text-gray-800'}`}>
      {type}
    </span>
  );
};

// --- APP PRINCIPAL ---

export default function App() {
  const [user, setUser] = useState(null); // null | { role: 'admin' | 'profesor', ... }
  const [view, setView] = useState('dashboard');

  const [students, setStudents] = useState(INITIAL_STUDENTS);
  const [teachers, setTeachers] = useState(INITIAL_TEACHERS);
  const [incidencias, setIncidencias] = useState(INITIAL_INCIDENCIAS);
  const [ausencias, setAusencias] = useState(INITIAL_AUSENCIAS);
  const [scheduleXml, setScheduleXml] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('iesmajuelo_schedule_xml');
      if (raw) setScheduleXml(JSON.parse(raw));
    } catch (e) {
      console.warn('No se pudo cargar el XML guardado.');
    }
  }, []);

  const loginWithEmail = (emailInput) => {
    const email = normalizeEmail(emailInput);

    if (!email) return { ok: false, message: 'Introduce un correo válido.' };

    if (email === ADMIN_EMAIL) {
      const adminTeacher = teachers.find(t => normalizeEmail(t.email) === ADMIN_EMAIL);
      setUser({
        uid: 'admin123',
        email: ADMIN_EMAIL,
        role: 'admin',
        name: adminTeacher?.nombre || 'Jefatura',
        teacherId: adminTeacher?.id || 't_admin',
        teacherRoles: adminTeacher?.roles || { profesor: true, tutor: false, jefe: true },
        abreviatura: adminTeacher?.abreviatura || computeAbbreviation(adminTeacher?.nombre || 'Jefatura')
      });
      setView('admin_dashboard');
      return { ok: true };
    }

    if (!email.endsWith(`@${TEACHER_EMAIL_DOMAIN}`)) {
      return { ok: false, message: `Debes usar tu cuenta @${TEACHER_EMAIL_DOMAIN}.` };
    }

    const teacher = teachers.find(t => normalizeEmail(t.email) === email);
    if (!teacher) {
      return { ok: false, message: 'Tu cuenta no está dada de alta. Contacta con Jefatura.' };
    }

    setUser({
      uid: teacher.id,
      email,
      role: 'profesor',
      name: teacher.nombre,
      teacherId: teacher.id,
      teacherRoles: teacher.roles,
      abreviatura: teacher.abreviatura || computeAbbreviation(teacher.nombre)
    });
    setView('profe_ausencias');
    return { ok: true };
  };

  const logout = () => {
    setUser(null);
    setView('dashboard');
  };

  if (!user) {
    return (
      <LoginScreen onLogin={loginWithEmail} />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <School className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-xl font-bold text-gray-900 hidden sm:block">IES Majuelo</h1>
                <p className="text-xs text-gray-500 font-medium">{user.role === 'admin' ? 'PANEL DE JEFATURA' : 'PANEL DOCENTE'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700 hidden md:block">{user.email}</span>
              <button
                onClick={logout}
                className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-red-600 transition-colors"
                title="Cerrar Sesión"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-8 overflow-x-auto">
            {user.role === 'admin' ? (
              <>
                <NavLink active={view === 'admin_guardia'} onClick={() => setView('admin_guardia')} icon={FileText} text="Parte de Guardia" />
                <NavLink active={view === 'admin_ausencias'} onClick={() => setView('admin_ausencias')} icon={UserCog} text="Ausencias Profes" />
                <NavLink active={view === 'admin_retrasos'} onClick={() => setView('admin_retrasos')} icon={Clock} text="Retrasos" />
                <NavLink active={view === 'admin_dashboard'} onClick={() => setView('admin_dashboard')} icon={AlertCircle} text="Incidencias Alumnos" />
                <NavLink active={view === 'admin_ausencias_propias'} onClick={() => setView('admin_ausencias_propias')} icon={Calendar} text="Comunicar Ausencia" />
                <NavLink active={view === 'admin_datos'} onClick={() => setView('admin_datos')} icon={FileText} text="Datos" />
              </>
            ) : (
              <>
                <NavLink active={view === 'profe_ausencias'} onClick={() => setView('profe_ausencias')} icon={Calendar} text="Comunicar Ausencia" />
                <NavLink active={view === 'profe_guardia'} onClick={() => setView('profe_guardia')} icon={FileText} text="Parte de Guardia" />
                <NavLink active={view === 'profe_retrasos'} onClick={() => setView('profe_retrasos')} icon={Clock} text="Retrasos 1ª hora" />
                <NavLink active={view === 'profe_incidencias'} onClick={() => setView('profe_incidencias')} icon={PlusCircle} text="Incidencias Alumnos" />
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {user.role === 'admin' && view === 'admin_dashboard' && (
          <AdminDashboard incidencias={incidencias} />
        )}
        {user.role === 'admin' && view === 'admin_guardia' && (
          <ProfeGuardia
            ausencias={ausencias}
            scheduleXml={scheduleXml}
          />
        )}
        {user.role === 'admin' && view === 'admin_retrasos' && (
          <AdminRetrasos
            incidencias={incidencias}
            students={students}
          />
        )}
        {user.role === 'admin' && view === 'admin_ausencias' && (
          <AdminAusencias
            ausencias={ausencias}
            scheduleXml={scheduleXml}
            onToggleEstado={(id, fecha) => {
              setAusencias(prev => prev.map(a => {
                if (a.id !== id) return a;
                if (a.slots && fecha) {
                  const estadosPorFecha = { ...(a.estadosPorFecha || {}) };
                  const current = estadosPorFecha[fecha] || a.estado || 'pendiente';
                  estadosPorFecha[fecha] = current === 'pendiente' ? 'recibida' : 'pendiente';
                  return { ...a, estadosPorFecha };
                }
                const next = a.estado === 'pendiente' ? 'recibida' : 'pendiente';
                return { ...a, estado: next };
              }));
            }}
          />
        )}
        {user.role === 'admin' && view === 'admin_ausencias_propias' && (
          <ProfeAusencias
            onSave={(data) => setAusencias([data, ...ausencias])}
            user={user}
            misAusencias={ausencias.filter(a => a.profesorId === user.teacherId)}
            scheduleXml={scheduleXml}
          />
        )}
        {user.role === 'admin' && view === 'admin_datos' && (
          <AdminDatosMaestros
            students={students}
            setStudents={setStudents}
            teachers={teachers}
            setTeachers={setTeachers}
            scheduleXml={scheduleXml}
            setScheduleXml={setScheduleXml}
          />
        )}

        {user.role === 'profesor' && view === 'profe_incidencias' && (
          <ProfeIncidencias
            students={students}
            onSave={(data) => setIncidencias([data, ...incidencias])}
            user={user}
          />
        )}
        {user.role === 'profesor' && view === 'profe_ausencias' && (
          <ProfeAusencias
            onSave={(data) => setAusencias([data, ...ausencias])}
            user={user}
            misAusencias={ausencias.filter(a => a.profesorId === user.teacherId)}
            scheduleXml={scheduleXml}
          />
        )}
        {user.role === 'profesor' && view === 'profe_guardia' && (
          <ProfeGuardia
            ausencias={ausencias}
            scheduleXml={scheduleXml}
          />
        )}
        {user.role === 'profesor' && view === 'profe_retrasos' && (
          <ProfeRetrasosPrimeraHora
            students={students}
            onSave={(data) => setIncidencias([data, ...incidencias])}
            user={user}
          />
        )}
      </main>
    </div>
  );
}

// --- LOGIN SCREEN ---

const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const result = onLogin(email.trim());
    if (!result.ok) setError(result.message);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="text-center">
          <div className="mx-auto bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-4">
            <School className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">IES Majuelo Gestión</h1>
          <p className="text-gray-500 mt-2">Acceso de profesorado y jefatura</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center border border-red-100">
            <AlertCircle className="w-4 h-4 mr-2" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-sm font-medium text-gray-700">Correo</label>
            <input
              type="email"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              placeholder={`nombre@${TEACHER_EMAIL_DOMAIN}`}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
          >
            Entrar
          </button>
        </form>

        <div className="text-xs text-gray-400 text-center">
          Admin único: {ADMIN_EMAIL}
        </div>
      </div>
    </div>
  );
};

// --- SUB-COMPONENTES DE NAVEGACIÓN ---

const NavLink = ({ active, onClick, icon: Icon, text }) => (
  <button
    onClick={onClick}
    className={`flex items-center px-1 py-4 border-b-2 text-sm font-medium whitespace-nowrap transition-colors ${
      active
        ? 'border-blue-500 text-blue-600'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`}
  >
    <Icon className={`mr-2 h-4 w-4 ${active ? 'text-blue-500' : 'text-gray-400'}`} />
    {text}
  </button>
);

// --- COMPONENTES DE ADMINISTRACIÓN (JEFATURA) ---

const AdminDashboard = ({ incidencias }) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-bold text-gray-900">Registro de Incidencias y Retrasos</h2>
      <div className="text-sm text-gray-500">Últimos 30 días</div>
    </div>

    <Card>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alumno</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Motivo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reportado Por</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {incidencias.length === 0 ? (
              <tr><td colSpan="5" className="px-6 py-4 text-center text-gray-500">No hay registros recientes</td></tr>
            ) : incidencias.map((inc) => (
              <tr key={inc.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(inc.fecha).toLocaleString('es-ES')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{inc.alumno}</div>
                  <div className="text-sm text-gray-500">Grupo {inc.grupo}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge type={inc.tipo} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{inc.motivo}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-xs">{inc.creado_por}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  </div>
);

const AdminAusencias = ({ ausencias, scheduleXml, onToggleEstado }) => {
  const [activeTab, setActiveTab] = useState('calendario');
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [sortConfig, setSortConfig] = useState({ key: 'fecha', direction: 'desc' });

  const tramosByDay = React.useMemo(() => {
    if (!scheduleXml?.tramos) return {};
    return scheduleXml.tramos.reduce((acc, tramo) => {
      if (!acc[tramo.dia]) acc[tramo.dia] = [];
      acc[tramo.dia].push(tramo);
      return acc;
    }, {});
  }, [scheduleXml]);

  const sortedAusencias = [...ausencias].sort((a, b) => {
    const aDate = a.slots?.[0]?.fecha || a.desde || 0;
    const bDate = b.slots?.[0]?.fecha || b.desde || 0;
    return new Date(bDate) - new Date(aDate);
  });

  const tramoById = React.useMemo(() => {
    const map = new Map();
    (scheduleXml?.tramos || []).forEach(t => map.set(t.id, t));
    return map;
  }, [scheduleXml]);

  const getProfesorXmlId = (aus) => {
    if (aus.xmlProfesorId) return String(aus.xmlProfesorId);
    if (aus.abreviatura) {
      const p = scheduleXml?.profesores?.find(pr => (pr.abreviatura || '').toUpperCase() === aus.abreviatura.toUpperCase());
      return p?.id || null;
    }
    return null;
  };

  const getAbsenceRows = () => {
    const rows = [];
    sortedAusencias.forEach((aus) => {
      if (aus.slots && aus.slots.length) {
        const grouped = aus.slots.reduce((acc, slot) => {
          if (!acc[slot.fecha]) acc[slot.fecha] = [];
          acc[slot.fecha].push(slot);
          return acc;
        }, {});
        Object.entries(grouped).forEach(([fecha, slots]) => {
          const dia = new Date(fecha).getDay();
          const diaIndex = dia === 0 ? 7 : dia;
          const profId = getProfesorXmlId(aus);
          let totalTramosDia = 0;
          if (profId) {
            const actividades = scheduleXml?.horariosPorProfesor?.[profId] || [];
            totalTramosDia = actividades.reduce((count, act) => {
              const tramo = tramoById.get(act.tramo);
              if (tramo && tramo.dia === diaIndex) return count + 1;
              return count;
            }, 0);
          }
          if (!totalTramosDia) totalTramosDia = (tramosByDay[diaIndex] || []).length;
          const isFull = totalTramosDia && slots.length >= totalTramosDia;
          rows.push({
            id: `${aus.id}-${fecha}`,
            rawId: aus.id,
            profesor: aus.profesor,
            profesorId: aus.profesorId,
            fecha,
            tipo: isFull ? 'Jornada completa' : 'Tramos',
            tramos: slots,
            estado: (aus.estadosPorFecha && aus.estadosPorFecha[fecha]) || aus.estado || 'pendiente'
          });
        });
      } else if (aus.desde) {
        rows.push({
          id: aus.id,
          rawId: aus.id,
          profesor: aus.profesor,
          profesorId: aus.profesorId,
          fecha: formatDateKey(aus.desde),
          tipo: 'Tramos',
          tramos: [],
          estado: aus.estado || 'pendiente'
        });
      }
    });
    return rows;
  };

  const rows = getAbsenceRows();

  const sortedRows = [...rows].sort((a, b) => {
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    if (sortConfig.key === 'profesor') {
      return a.profesor.localeCompare(b.profesor) * dir;
    }
    if (sortConfig.key === 'fecha') {
      return (new Date(a.fecha) - new Date(b.fecha)) * dir;
    }
    if (sortConfig.key === 'tipo') {
      return a.tipo.localeCompare(b.tipo) * dir;
    }
    return 0;
  });

  const toggleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const summaryByDate = sortedAusencias.reduce((acc, aus) => {
    if (aus.slots && aus.slots.length) {
      aus.slots.forEach((slot) => {
        const key = slot.fecha;
        if (!acc[key]) acc[key] = { profesores: new Set(), tramos: 0 };
        acc[key].profesores.add(aus.profesorId || aus.profesor);
        acc[key].tramos += 1;
      });
    } else if (aus.desde) {
      const key = formatDateKey(aus.desde);
      if (!acc[key]) acc[key] = { profesores: new Set(), tramos: 0 };
      acc[key].profesores.add(aus.profesorId || aus.profesor);
      acc[key].tramos += 1;
    }
    return acc;
  }, {});

  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
  const startDay = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;
  const daysInMonth = monthEnd.getDate();
  const weeks = [];
  let currentDay = 1 - startDay;
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), currentDay);
      week.push(date);
      currentDay += 1;
    }
    weeks.push(week);
  }

  const monthLabel = calendarMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-900">Ausencias del Profesorado</h2>

      <div className="flex space-x-2 bg-white p-1 rounded-lg border border-gray-200 w-fit">
        {['calendario', 'listado'].map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md capitalize transition-colors ${
              activeTab === tab ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'calendario' && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 capitalize">{monthLabel}</h3>
            <div className="flex space-x-2">
              <button
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
              >
                Mes anterior
              </button>
              <button
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
              >
                Mes siguiente
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 text-xs text-gray-500 mb-2">
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((label) => (
              <div key={label} className="text-center font-medium">{label}</div>
            ))}
          </div>
          <div className="space-y-1">
            {weeks.map((week, idx) => (
              <div key={idx} className="grid grid-cols-7 gap-1">
                {week.map((date) => {
                  const inMonth = date.getMonth() === calendarMonth.getMonth();
                  const key = formatDateKey(date);
                  const summary = summaryByDate[key];
                  return (
                    <div
                      key={key}
                      className={`border rounded p-1 min-h-[64px] ${inMonth ? 'bg-white' : 'bg-gray-50 text-gray-400'}`}
                    >
                      <div className="text-[10px] text-right">{date.getDate()}</div>
                      {summary && (
                        <div className="mt-1 text-[10px] text-blue-700 space-y-0.5">
                          <div>Profes: {summary.profesores.size}</div>
                          <div>Tramos: {summary.tramos}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'listado' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => toggleSort('profesor')}>
                    Profesor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => toggleSort('fecha')}>
                    Día
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => toggleSort('tipo')}>
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tramos</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.profesor}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{new Date(row.fecha).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{row.tipo}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {row.tipo === 'Jornada completa' ? 'Completa' : row.tramos.map(t => `${t.inicio}-${t.fin}`).join(', ')}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        type="button"
                        onClick={() => onToggleEstado(row.rawId, row.fecha)}
                        className="rounded-full"
                      >
                        <Badge type={row.estado} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

const AdminRetrasos = ({ incidencias, students }) => {
  const [activeTab, setActiveTab] = useState('hoy');
  const [sortHoy, setSortHoy] = useState({ key: 'hora', direction: 'desc' });
  const [sortAlumno, setSortAlumno] = useState({ key: 'retrasos', direction: 'desc' });
  const [sortGrupo, setSortGrupo] = useState({ key: 'grupo', direction: 'asc' });

  const todayKey = formatDateKey(new Date());
  const inicioCurso = getAcademicYearStart(new Date());

  const retrasos = incidencias.filter(i => i.tipo === 'retraso');

  const retrasosHoy = retrasos.filter(i => formatDateKey(i.fecha) === todayKey);

  const sortedHoy = [...retrasosHoy].sort((a, b) => {
    const dir = sortHoy.direction === 'asc' ? 1 : -1;
    if (sortHoy.key === 'hora') return (new Date(a.fecha) - new Date(b.fecha)) * dir;
    if (sortHoy.key === 'alumno') return a.alumno.localeCompare(b.alumno) * dir;
    if (sortHoy.key === 'grupo') return a.grupo.localeCompare(b.grupo) * dir;
    return 0;
  });

  const retrasosCurso = retrasos.filter(i => new Date(i.fecha) >= inicioCurso);

  const alumnosMap = new Map();
  retrasosCurso.forEach((r) => {
    const key = `${r.alumno}__${r.grupo}`;
    const item = alumnosMap.get(key) || { alumno: r.alumno, grupo: r.grupo, retrasos: 0 };
    item.retrasos += 1;
    alumnosMap.set(key, item);
  });

  const alumnosRows = Array.from(alumnosMap.values());
  const sortedAlumnos = [...alumnosRows].sort((a, b) => {
    const dir = sortAlumno.direction === 'asc' ? 1 : -1;
    if (sortAlumno.key === 'alumno') return a.alumno.localeCompare(b.alumno) * dir;
    if (sortAlumno.key === 'grupo') return a.grupo.localeCompare(b.grupo) * dir;
    if (sortAlumno.key === 'retrasos') return (a.retrasos - b.retrasos) * dir;
    return 0;
  });

  const gruposMap = new Map();
  retrasosCurso.forEach((r) => {
    const grupo = r.grupo || '';
    const ensenanza = inferEnsenanza(grupo) || (students.find(s => s.grupo === grupo)?.ensenanza || '');
    const key = `${grupo}__${ensenanza}`;
    const item = gruposMap.get(key) || { grupo, ensenanza, retrasos: 0 };
    item.retrasos += 1;
    gruposMap.set(key, item);
  });

  const gruposRows = Array.from(gruposMap.values());
  const sortedGrupos = [...gruposRows].sort((a, b) => {
    const dir = sortGrupo.direction === 'asc' ? 1 : -1;
    if (sortGrupo.key === 'grupo') return a.grupo.localeCompare(b.grupo) * dir;
    if (sortGrupo.key === 'ensenanza') return a.ensenanza.localeCompare(b.ensenanza) * dir;
    if (sortGrupo.key === 'retrasos') return (a.retrasos - b.retrasos) * dir;
    return 0;
  });

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-900">Retrasos</h2>

      <div className="flex space-x-2 bg-white p-1 rounded-lg border border-gray-200 w-fit">
        {['hoy', 'estadisticas'].map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md capitalize transition-colors ${
              activeTab === tab ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab === 'hoy' ? 'Hoy' : 'Estadísticas'}
          </button>
        ))}
      </div>

      {activeTab === 'hoy' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => setSortHoy(s => ({ key: 'hora', direction: s.key === 'hora' && s.direction === 'asc' ? 'desc' : 'asc' }))}>Hora</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => setSortHoy(s => ({ key: 'alumno', direction: s.key === 'alumno' && s.direction === 'asc' ? 'desc' : 'asc' }))}>Alumno</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => setSortHoy(s => ({ key: 'grupo', direction: s.key === 'grupo' && s.direction === 'asc' ? 'desc' : 'asc' }))}>Grupo</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedHoy.length === 0 ? (
                  <tr><td colSpan="3" className="px-6 py-4 text-center text-gray-500">No hay retrasos hoy</td></tr>
                ) : sortedHoy.map(r => (
                  <tr key={r.id}>
                    <td className="px-6 py-4 text-sm text-gray-600">{new Date(r.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-6 py-4 text-sm text-gray-800">{r.alumno}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{r.grupo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'estadisticas' && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <div className="px-6 py-4 border-b text-sm font-semibold text-gray-700">Retrasos por alumno</div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => setSortAlumno(s => ({ key: 'alumno', direction: s.key === 'alumno' && s.direction === 'asc' ? 'desc' : 'asc' }))}>Alumno</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => setSortAlumno(s => ({ key: 'grupo', direction: s.key === 'grupo' && s.direction === 'asc' ? 'desc' : 'asc' }))}>Grupo</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => setSortAlumno(s => ({ key: 'retrasos', direction: s.key === 'retrasos' && s.direction === 'asc' ? 'desc' : 'asc' }))}>Retrasos</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedAlumnos.map((r) => (
                    <tr key={`${r.alumno}-${r.grupo}`}>
                      <td className="px-6 py-4 text-sm text-gray-800">{r.alumno}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{r.grupo}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-700">{r.retrasos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card>
            <div className="px-6 py-4 border-b text-sm font-semibold text-gray-700">Retrasos por grupo y enseñanza</div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => setSortGrupo(s => ({ key: 'grupo', direction: s.key === 'grupo' && s.direction === 'asc' ? 'desc' : 'asc' }))}>Grupo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => setSortGrupo(s => ({ key: 'ensenanza', direction: s.key === 'ensenanza' && s.direction === 'asc' ? 'desc' : 'asc' }))}>Enseñanza</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => setSortGrupo(s => ({ key: 'retrasos', direction: s.key === 'retrasos' && s.direction === 'asc' ? 'desc' : 'asc' }))}>Retrasos</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedGrupos.map((r) => (
                    <tr key={`${r.grupo}-${r.ensenanza}`}>
                      <td className="px-6 py-4 text-sm text-gray-800">{r.grupo}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{r.ensenanza || '-'}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-700">{r.retrasos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

const AdminDatosMaestros = ({ students, setStudents, teachers, setTeachers, scheduleXml, setScheduleXml }) => {
  const [activeTab, setActiveTab] = useState('alumnos');
  const [newStudent, setNewStudent] = useState({ nombre: '', grupo: '1A' });
  const [newTeacher, setNewTeacher] = useState({
    nombre: '',
    email: '',
    roles: { profesor: true, tutor: false, jefe: false }
  });
  const [studentSort, setStudentSort] = useState({ key: 'nombre', direction: 'asc' });

  const addStudent = (e) => {
    e.preventDefault();
    if (!newStudent.nombre) return;
    setStudents([{ ...newStudent, id: Date.now().toString() }, ...students]);
    setNewStudent({ nombre: '', grupo: '1A' });
    alert('Alumno añadido correctamente');
  };

  const handleStudentsUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        if (!rows.length) return;
        const headers = rows[0].map(h => normalizeHeader(h));
        const dataRows = rows.slice(1).filter(r => r.some(cell => String(cell || '').trim()));

        const getCell = (row, key) => {
          const idx = headers.findIndex(h => h.includes(key));
          return idx >= 0 ? row[idx] : '';
        };

        const colScore = (fn) => {
          return headers.map((_, idx) => {
            let score = 0;
            dataRows.slice(0, 50).forEach((row) => {
              const v = row[idx];
              if (fn(v)) score += 1;
            });
            return score;
          });
        };

        const groupColScores = colScore((v) => Boolean(extractGroup(v)));
        const nameColScores = colScore((v) => /[a-zA-ZÁÉÍÓÚáéíóúÑñ]/.test(String(v || '')) && !isLikelyDni(v));

        const groupColIndex = groupColScores.indexOf(Math.max(...groupColScores));
        const nameColIndex = nameColScores.indexOf(Math.max(...nameColScores));

        const parsed = dataRows.map((row, idx) => {
          const rowText = row.map(cell => String(cell || '').toLowerCase()).join(' ');
          if (rowText.includes('anulad') || rowText.includes('baja de oficio') || rowText.includes('traslad')) {
            return null;
          }
          let nombre = getCell(row, 'nombre');
          let apellidos = getCell(row, 'apellido');
          let grupo = getCell(row, 'grupo');
          let ensenanza = getCell(row, 'ensenanza') || getCell(row, 'enseñanza');
          let curso = getCell(row, 'curso');
          let unidad = getCell(row, 'unidad') || getCell(row, 'clase');

          if (!grupo && curso && unidad) {
            grupo = extractGroup(`${curso}${unidad}`) || extractGroup(`${curso} ${unidad}`);
          }

          if (!grupo && groupColIndex >= 0) {
            grupo = extractGroup(row[groupColIndex]);
          }

          if (!grupo) {
            const groupCell = row.find(cell => extractGroup(cell));
            if (groupCell) grupo = extractGroup(groupCell);
          }

          if (!nombre && row.length) {
            const textCell = row.find(cell => /[a-zA-ZÁÉÍÓÚáéíóúÑñ]/.test(String(cell || '')) && !isLikelyDni(cell));
            if (textCell) nombre = String(textCell);
          }

          if (!nombre && nameColIndex >= 0) {
            nombre = String(row[nameColIndex] || '');
          }

          const fullName = [String(nombre || '').trim(), String(apellidos || '').trim()].filter(Boolean).join(' ').trim();
          return {
            id: `${Date.now()}_${idx}`,
            nombre: fullName || 'Sin nombre',
            grupo: String(grupo || '').trim(),
            ensenanza: String(ensenanza || '').trim()
          };
        }).filter(s => s && s.nombre && s.grupo);

        if (!parsed.length) {
          alert('No se encontraron alumnos válidos en el archivo.');
          return;
        }

        const ok = window.confirm(`Se importarán ${parsed.length} alumnos. ¿Reemplazar el listado actual?`);
        if (ok) {
          setStudents(parsed);
        }
      } catch (err) {
        console.error(err);
        alert('No se pudo leer el archivo de alumnos.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const upsertTeacher = (teacher) => {
    setTeachers((prev) => {
      const existingIndex = prev.findIndex(t => normalizeEmail(t.email) === normalizeEmail(teacher.email));
      if (existingIndex === -1) return [{ ...teacher, id: Date.now().toString() }, ...prev];
      const copy = [...prev];
      copy[existingIndex] = { ...copy[existingIndex], ...teacher };
      return copy;
    });
  };

  const addTeacher = (e) => {
    e.preventDefault();
    const email = normalizeEmail(newTeacher.email);
    if (!newTeacher.nombre || !email) return;

    if (email === ADMIN_EMAIL) {
      alert('Este correo está reservado para el admin.');
      return;
    }

    upsertTeacher({
      nombre: newTeacher.nombre,
      email,
      abreviatura: computeAbbreviation(newTeacher.nombre),
      roles: newTeacher.roles
    });

    setNewTeacher({ nombre: '', email: '', roles: { profesor: true, tutor: false, jefe: false } });
    alert('Profesor añadido/actualizado correctamente');
  };

  const updateRole = (teacherId, roleKey, value) => {
    setTeachers(prev => prev.map(t => (
      t.id === teacherId ? { ...t, roles: { ...t.roles, [roleKey]: value } } : t
    )));
  };

  const handleCsvUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const records = parseCsvText(text);
      let added = 0;
      let skipped = 0;

      records.forEach((rec) => {
        let email = normalizeEmail(rec.email || rec.correo || '');
        let nombre = rec.nombre || rec.name || '';
        let fechaCese = rec.cese || rec.fecha_cese || rec.fechaCese || '';

        if (!isLikelyEmail(email) && Array.isArray(rec._row)) {
          const emailCell = rec._row.find(cell => isLikelyEmail(cell)) || '';
          email = normalizeEmail(emailCell);
        }

        if (Array.isArray(rec._row)) {
          const nameCell = rec._row.find(cell => {
            const v = String(cell || '').trim();
            if (!v) return false;
            if (isLikelyEmail(v)) return false;
            if (isLikelyDni(v)) return false;
            return /[a-zA-ZÁÉÍÓÚáéíóúÑñ]/.test(v);
          });
          if (!nombre && nameCell) nombre = String(nameCell).trim();

          if (!fechaCese) {
            const dateCells = rec._row.map(cell => String(cell || '').trim()).filter(v => parseDateDMY(v));
            if (dateCells.length >= 2) fechaCese = dateCells[1];
          }
        }

        if (nombre && nombre.includes(',')) {
          const { nombre: first, apellidos } = splitNameAndSurnames(nombre);
          nombre = [first, apellidos].filter(Boolean).join(' ').trim();
        }

        if (fechaCese && isPastCese(fechaCese)) {
          skipped += 1;
          return;
        }

        if (!email || !isLikelyEmail(email) || !nombre || email === ADMIN_EMAIL) {
          skipped += 1;
          return;
        }
        upsertTeacher({
          nombre,
          email,
          abreviatura: computeAbbreviation(nombre),
          roles: {
            profesor: true,
            tutor: parseBool(rec.tutor),
            jefe: parseBool(rec.jefe)
          }
        });
        added += 1;
      });

      alert(`Carga completada. Altas/actualizaciones: ${added}. Omitidos: ${skipped}.`);
    };
    reader.readAsText(file, 'iso-8859-1');
    e.target.value = '';
  };

  const handleXmlUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const parsed = parseHorarioXml(text);
      if (parsed.error) {
        alert(parsed.error);
        return;
      }
      const payload = {
        fileName: file.name,
        size: file.size,
        ...parsed
      };
      setScheduleXml(payload);
      try {
        localStorage.setItem('iesmajuelo_schedule_xml', JSON.stringify(payload));
      } catch (e) {
        console.warn('No se pudo guardar el XML en localStorage.');
      }
    };
    reader.readAsText(file, 'iso-8859-1');
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <div className="flex space-x-2 bg-white p-1 rounded-lg border border-gray-200 w-fit">
        {['alumnos', 'profesores', 'horarios'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            type="button"
            className={`px-4 py-2 text-sm font-medium rounded-md capitalize transition-colors ${
              activeTab === tab
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab === 'profesores' ? 'Profesorado' : tab}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-12 gap-6">
        <div className="md:col-span-4">
          <Card className="p-6 sticky top-24">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center">
              <PlusCircle className="w-5 h-5 mr-2 text-blue-600" />
              {activeTab === 'alumnos' ? 'Añadir Alumno' : activeTab === 'profesores' ? 'Añadir Profesor/a' : 'Gestión Horarios'}
            </h3>

            {activeTab === 'alumnos' && (
              <form onSubmit={addStudent} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre Completo</label>
                  <input
                    type="text"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    value={newStudent.nombre}
                    onChange={e => setNewStudent({ ...newStudent, nombre: e.target.value })}
                    placeholder="Ej. Ana García"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Grupo</label>
                  <select
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    value={newStudent.grupo}
                    onChange={e => setNewStudent({ ...newStudent, grupo: e.target.value })}
                  >
                    {GRUPOS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">Guardar</button>
                <div className="pt-4 border-t border-gray-100">
                  <label className="block text-sm font-medium text-gray-700">Subir Excel de alumnado</label>
                  <p className="text-xs text-gray-500 mt-1">Formato .xls/.xlsx con columnas de nombre y grupo.</p>
                  <input
                    type="file"
                    accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleStudentsUpload}
                    className="mt-2 block w-full text-sm text-gray-600"
                  />
                </div>
              </form>
            )}

            {activeTab === 'profesores' && (
              <form onSubmit={addTeacher} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre Profesor/a</label>
                  <input
                    type="text"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    value={newTeacher.nombre}
                    onChange={e => setNewTeacher({ ...newTeacher, nombre: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email Corporativo</label>
                  <input
                    type="email"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    value={newTeacher.email}
                    onChange={e => setNewTeacher({ ...newTeacher, email: e.target.value })}
                    placeholder={`nombre@${TEACHER_EMAIL_DOMAIN}`}
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={newTeacher.roles.tutor}
                      onChange={(e) => setNewTeacher({
                        ...newTeacher,
                        roles: { ...newTeacher.roles, tutor: e.target.checked }
                      })}
                    />
                    <span>Tutor/a</span>
                  </label>
                  <label className="flex items-center space-x-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={newTeacher.roles.jefe}
                      onChange={(e) => setNewTeacher({
                        ...newTeacher,
                        roles: { ...newTeacher.roles, jefe: e.target.checked }
                      })}
                    />
                    <span>Jefe/a de estudios</span>
                  </label>
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">Guardar</button>

                <div className="pt-4 border-t border-gray-100">
                  <label className="block text-sm font-medium text-gray-700">Subir CSV de profesores</label>
                  <p className="text-xs text-gray-500 mt-1">Formato: nombre,email,profesor,tutor,jefe</p>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCsvUpload}
                    className="mt-2 block w-full text-sm text-gray-600"
                  />
                </div>
              </form>
            )}

            {activeTab === 'horarios' && (
              <div className="text-sm text-gray-500 text-center py-4">
                <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p>Suba el XML de horarios generado por Séneca/HORW.</p>
                <label className="mt-4 w-full border border-dashed border-gray-300 p-2 rounded text-gray-600 hover:bg-gray-50 cursor-pointer block">
                  Subir XML Horarios
                  <input
                    type="file"
                    accept=".xml,text/xml,application/xml"
                    onChange={handleXmlUpload}
                    className="hidden"
                  />
                </label>
                {scheduleXml && (
                  <div className="mt-4 text-left text-xs text-gray-600 space-y-1">
                    <div><strong>Archivo:</strong> {scheduleXml.fileName}</div>
                    <div><strong>Centro:</strong> {scheduleXml.centro}</div>
                    <div><strong>Fecha:</strong> {scheduleXml.fecha}</div>
                    <div><strong>Asignaturas:</strong> {scheduleXml.asignaturasCount}</div>
                    <div><strong>Profesores:</strong> {scheduleXml.profesoresCount}</div>
                    <div><strong>Grupos:</strong> {scheduleXml.gruposCount}</div>
                    <div><strong>Actividades:</strong> {scheduleXml.actividadesCount}</div>
                    <div><strong>Horarios aula:</strong> {scheduleXml.horariosAulaCount}</div>
                    <div><strong>Horarios profesor:</strong> {scheduleXml.horariosProfesorCount}</div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="md:col-span-8 min-w-0">
          {activeTab === 'alumnos' && (
            <div className="text-sm text-gray-500 mb-2">
              Total alumnos: <span className="font-semibold text-gray-700">{students.length}</span>
            </div>
          )}
          <Card>
            <div className="max-h-[600px] overflow-y-auto overflow-x-hidden">
              <table className="w-full table-fixed divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {activeTab === 'alumnos' && (
                      <>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer"
                          onClick={() => setStudentSort(s => ({ key: 'nombre', direction: s.key === 'nombre' && s.direction === 'asc' ? 'desc' : 'asc' }))}
                        >
                          Nombre
                        </th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer"
                          onClick={() => setStudentSort(s => ({ key: 'grupo', direction: s.key === 'grupo' && s.direction === 'asc' ? 'desc' : 'asc' }))}
                        >
                          Grupo
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                      </>
                    )}
                    {activeTab === 'profesores' && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-[30%]">Profesor/a</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-[34%]">Email</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase w-[10%]">Tutor/a</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase w-[16%]">Jefe/a de estudios</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase w-[10%]">Acciones</th>
                      </>
                    )}
                    {activeTab === 'horarios' && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vista Previa Horarios (Demo)</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activeTab === 'alumnos' && [...students].sort((a, b) => {
                    const dir = studentSort.direction === 'asc' ? 1 : -1;
                    if (studentSort.key === 'grupo') return a.grupo.localeCompare(b.grupo) * dir;
                    return a.nombre.localeCompare(b.nombre) * dir;
                  }).map(s => (
                    <tr key={s.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{s.nombre}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{s.grupo}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-blue-600 hover:text-blue-900 cursor-pointer">Editar</td>
                    </tr>
                  ))}
                  {activeTab === 'profesores' && teachers.map(t => (
                    <tr key={t.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 truncate">{t.nombre}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate">{t.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-center">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={Boolean(t.roles?.tutor)}
                          onChange={(e) => updateRole(t.id, 'tutor', e.target.checked)}
                          aria-label="Tutor/a"
                        />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-center">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={Boolean(t.roles?.jefe)}
                          onChange={(e) => updateRole(t.id, 'jefe', e.target.checked)}
                          aria-label="Jefe/a de estudios"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <button
                          type="button"
                          onClick={() => setTeachers(prev => prev.filter(p => p.id !== t.id))}
                          className="text-gray-400 hover:text-red-600"
                          title="Eliminar profesor"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {activeTab === 'horarios' && (
                    <tr>
                      <td className="px-6 py-4 text-sm text-gray-500 text-center">
                        {scheduleXml ? 'XML cargado correctamente.' : 'No hay horarios cargados. Utilice el panel izquierdo.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENTES DE PROFESORADO ---

const ProfeIncidencias = ({ students, onSave, user }) => {
  const [grupoSeleccionado, setGrupoSeleccionado] = useState('');
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState('');
  const [tipo, setTipo] = useState('retraso');
  const [motivo, setMotivo] = useState(MOTIVOS_RETRASO[0]);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 16));
  const [obs, setObs] = useState('');

  const alumnosFiltrados = grupoSeleccionado
    ? students.filter(s => s.grupo === grupoSeleccionado)
    : [];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!alumnoSeleccionado) return;

    const alumnoData = students.find(s => s.id === alumnoSeleccionado);

    onSave({
      id: Date.now().toString(),
      tipo,
      alumno: alumnoData.nombre,
      grupo: alumnoData.grupo,
      motivo,
      fecha: fecha,
      creado_por: user.email,
      observaciones: obs
    });

    alert('Registro guardado correctamente');
    setObs('');
    setFecha(new Date().toISOString().slice(0, 16));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
          <FileText className="w-5 h-5 mr-2 text-blue-600" />
          Nueva Incidencia / Retraso
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">1. Seleccionar Grupo</label>
              <select
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border bg-gray-50"
                value={grupoSeleccionado}
                onChange={(e) => {
                  setGrupoSeleccionado(e.target.value);
                  setAlumnoSeleccionado('');
                }}
              >
                <option value="">-- Grupo --</option>
                {GRUPOS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">2. Seleccionar Alumno</label>
              <select
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                value={alumnoSeleccionado}
                onChange={(e) => setAlumnoSeleccionado(e.target.value)}
                disabled={!grupoSeleccionado}
              >
                <option value="">-- Alumno --</option>
                {alumnosFiltrados.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <div className="flex space-x-2">
                {['retraso', 'salida', 'parte'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    className={`flex-1 py-2 px-2 text-xs font-bold uppercase rounded-md border ${
                      tipo === t
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha y Hora</label>
              <input
                type="datetime-local"
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (Lista Cerrada)</label>
            <select
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            >
              {MOTIVOS_RETRASO.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones (Opcional)</label>
            <textarea
              rows="3"
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Detalles adicionales..."
            ></textarea>
          </div>

          <button
            type="submit"
            disabled={!alumnoSeleccionado}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Registrar Incidencia
          </button>
        </form>
      </div>
    </div>
  );
};

const ProfeRetrasosPrimeraHora = ({ students, onSave, user }) => {
  const [grupo, setGrupo] = useState('');
  const [alumnoId, setAlumnoId] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 16));

  const gruposDisponibles = useMemo(() => {
    const set = new Set(students.map(s => s.grupo).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [students]);

  const alumnosFiltrados = grupo ? students.filter(s => s.grupo === grupo) : [];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!alumnoId) return;
    const alumno = students.find(s => s.id === alumnoId);
    if (!alumno) return;
    onSave({
      id: Date.now().toString(),
      tipo: 'retraso',
      alumno: alumno.nombre,
      grupo: alumno.grupo,
      motivo: 'Retraso 1ª hora',
      fecha,
      creado_por: user.email
    });
    alert('Retraso registrado correctamente');
    setAlumnoId('');
    setFecha(new Date().toISOString().slice(0, 16));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
          <Clock className="w-5 h-5 mr-2 text-blue-600" />
          Retrasos 1ª hora
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grupo</label>
              <select
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border bg-gray-50"
                value={grupo}
                onChange={(e) => {
                  setGrupo(e.target.value);
                  setAlumnoId('');
                }}
              >
                <option value="">-- Grupo --</option>
                {gruposDisponibles.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alumno</label>
              <select
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                value={alumnoId}
                onChange={(e) => setAlumnoId(e.target.value)}
                disabled={!grupo}
              >
                <option value="">-- Alumno --</option>
                {alumnosFiltrados.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha y hora</label>
            <input
              type="datetime-local"
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={!alumnoId}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Registrar retraso
          </button>
        </form>
      </div>
    </div>
  );
};

const ProfeAusencias = ({ onSave, user, misAusencias, scheduleXml }) => {
  const [motivo, setMotivo] = useState('');
  const [selectedTramos, setSelectedTramos] = useState(new Set());

  const weekDates = getWeekDates(new Date());
  const dayLabels = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

  const profesorId = (() => {
    if (!scheduleXml?.profesores) return null;
    if (user?.abreviatura) {
      const byAbbr = scheduleXml.profesores.find(p => (p.abreviatura || '').toUpperCase() === user.abreviatura.toUpperCase());
      if (byAbbr) return byAbbr.id || null;
    }
    return findProfesorIdByName(scheduleXml.profesores, user.name);
  })();

  const tramosByDay = React.useMemo(() => {
    if (!scheduleXml?.tramos) return {};
    return scheduleXml.tramos.reduce((acc, tramo) => {
      if (!acc[tramo.dia]) acc[tramo.dia] = [];
      acc[tramo.dia].push(tramo);
      return acc;
    }, {});
  }, [scheduleXml]);

  const availableTramos = React.useMemo(() => {
    const ids = new Set();
    if (!scheduleXml || !profesorId) return ids;
    const actividades = scheduleXml.horariosPorProfesor?.[profesorId] || [];
    actividades.forEach(act => {
      if (act.tramo) ids.add(act.tramo);
    });
    return ids;
  }, [scheduleXml, profesorId]);

  const uniqueHoras = React.useMemo(() => {
    const day1 = tramosByDay[1] || [];
    return day1
      .map(t => t.hora)
      .filter((v, idx, arr) => arr.indexOf(v) === idx)
      .sort((a, b) => a - b);
  }, [tramosByDay]);

  const actividadByTramo = React.useMemo(() => {
    if (!scheduleXml || !profesorId) return {};
    const actividades = scheduleXml.horariosPorProfesor?.[profesorId] || [];
    return actividades.reduce((acc, act) => {
      const tramoId = act.tramo;
      if (!tramoId) return acc;
      if (!acc[tramoId]) acc[tramoId] = [];
      acc[tramoId].push(act.asignatura);
      return acc;
    }, {});
  }, [scheduleXml, profesorId]);

  const toggleTramo = (tramoId) => {
    setSelectedTramos(prev => {
      const next = new Set(prev);
      if (next.has(tramoId)) next.delete(tramoId);
      else next.add(tramoId);
      return next;
    });
  };

  const toggleDay = (dia) => {
    const tramos = tramosByDay[dia] || [];
    if (!tramos.length) return;
    setSelectedTramos(prev => {
      const next = new Set(prev);
      const eligible = tramos.filter(t => {
        if (!availableTramos.has(t.id)) return false;
        const date = weekDates[dia - 1];
        return !isPastSlot(date, t.inicio);
      });
      if (!eligible.length) return next;
      const allSelected = eligible.every(t => next.has(t.id));
      eligible.forEach(t => {
        if (allSelected) next.delete(t.id);
        else next.add(t.id);
      });
      return next;
    });
  };

  const buildSlotsPayload = () => {
    if (!scheduleXml?.tramos) return [];
    const tramoMap = new Map(scheduleXml.tramos.map(t => [t.id, t]));
    return Array.from(selectedTramos).map((id) => {
      if (!availableTramos.has(id)) return null;
      const tramo = tramoMap.get(id);
      if (!tramo) return null;
      const date = weekDates[tramo.dia - 1];
      return {
        tramoId: id,
        dia: tramo.dia,
        hora: tramo.hora,
        fecha: date.toISOString().slice(0, 10),
        inicio: tramo.inicio,
        fin: tramo.fin
      };
    }).filter(Boolean);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const slots = buildSlotsPayload();
    if (!slots.length || !motivo.trim()) return;
    if (slots.some(slot => isPastSlot(slot.fecha, slot.inicio))) {
      alert('No puedes comunicar ausencias en fechas u horas pasadas.');
      return;
    }
    const weekLabel = `${weekDates[0].toLocaleDateString()} - ${weekDates[4].toLocaleDateString()}`;
    onSave({
      id: Date.now().toString(),
      profesor: user.name,
      profesorId: user.teacherId,
      abreviatura: user.abreviatura,
      xmlProfesorId: profesorId,
      motivo: motivo.trim(),
      semana: weekLabel,
      slots,
      estado: 'pendiente'
    });
    setMotivo('');
    setSelectedTramos(new Set());
    alert('Ausencia notificada correctamente');
  };

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div>
        <Card className="p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-blue-600" />
            Notificar Ausencia
          </h2>
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
            Esta comunicación sirve a efectos de organizar el servicio de guardia en tu ausencia y NO EXIME de presentar en Séneca el Anexo I con la documentación necesaria para justificarla.
          </div>

          {!scheduleXml && (
            <div className="text-sm text-gray-600 bg-yellow-50 border border-yellow-200 rounded-md p-3">
              El horario no está cargado. Pide a Jefatura que suba el XML en Datos → Horarios.
            </div>
          )}

          {scheduleXml && !profesorId && (
            <div className="text-sm text-gray-600 bg-yellow-50 border border-yellow-200 rounded-md p-3">
              No se ha encontrado tu nombre en el XML. Revisa que coincida con el horario.
            </div>
          )}

          {scheduleXml && profesorId && (
            <div className="overflow-x-auto mt-4">
              <table className="min-w-full text-xs border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left border-r border-gray-200">Hora</th>
                    {dayLabels.map((label, idx) => (
                      <th
                        key={label}
                        className="p-2 text-center border-r border-gray-200 cursor-pointer hover:bg-blue-50"
                        onClick={() => toggleDay(idx + 1)}
                        title="Seleccionar jornada completa"
                      >
                        <div className="font-semibold">{label}</div>
                        <div className="text-[10px] text-gray-500">{weekDates[idx].toLocaleDateString()}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {uniqueHoras.map((hora) => {
                    const tramoLabel = (tramosByDay[1] || []).find(t => t.hora === hora);
                    const timeLabel = tramoLabel ? `${tramoLabel.inicio} - ${tramoLabel.fin}` : `Hora ${hora}`;
                    return (
                      <tr key={hora} className="border-t border-gray-200">
                        <td className="p-2 border-r border-gray-200 text-gray-600">{timeLabel}</td>
                        {dayLabels.map((_, idx) => {
                          const dia = idx + 1;
                          const tramo = (tramosByDay[dia] || []).find(t => t.hora === hora);
                          if (!tramo) {
                            return <td key={dia} className="p-2 border-r border-gray-200 bg-gray-50"></td>;
                          }
                          const date = weekDates[dia - 1];
                          const isPast = isPastSlot(date, tramo.inicio);
                          const isAvailable = availableTramos.has(tramo.id);
                          const isSelected = selectedTramos.has(tramo.id);
                          const actividades = actividadByTramo[tramo.id] || [];
                          const asignaturaId = actividades[0];
                          const asignatura = scheduleXml.asignaturas?.[asignaturaId];
                          return (
                            <td
                              key={dia}
                              className={`p-2 border-r border-gray-200 text-center ${
                                !isAvailable
                                  ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                  : isPast
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : isSelected
                                    ? 'bg-blue-100 text-blue-800 cursor-pointer'
                                    : 'hover:bg-blue-50 cursor-pointer'
                              }`}
                              onClick={() => {
                                if (!isPast && isAvailable) toggleTramo(tramo.id);
                              }}
                            >
                              {asignatura?.abreviatura || (actividades.length ? 'Clase' : '')}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Motivo</label>
              <textarea
                rows="3"
                className="mt-1 block w-full rounded-md border-gray-300 p-2 border"
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Explica el motivo de la ausencia"
              />
            </div>
            <button
              type="submit"
              disabled={!selectedTramos.size || !motivo.trim()}
              className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition disabled:bg-gray-300"
            >
              Guardar ausencia
            </button>
          </form>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Historial de Ausencias</h3>
        <div className="space-y-4">
          {[...misAusencias].sort((a, b) => {
            const aDate = a.slots?.[0]?.fecha || a.desde || 0;
            const bDate = b.slots?.[0]?.fecha || b.desde || 0;
            return new Date(bDate) - new Date(aDate);
          }).map(aus => (
            <div key={aus.id} className="bg-white p-4 rounded-lg shadow border border-gray-100 flex justify-between items-center">
              <div>
                <p className="font-bold text-gray-800">{aus.motivo}</p>
                <p className="text-xs text-gray-500">
                  {aus.semana ? `Semana: ${aus.semana}` : `${new Date(aus.desde).toLocaleDateString()} - ${new Date(aus.hasta).toLocaleDateString()}`}
                </p>
              </div>
              <Badge type={aus.estado} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ProfeGuardia = ({ ausencias, scheduleXml }) => {
  const baseToday = new Date();
  const [selectedDate, setSelectedDate] = useState(new Date(baseToday));
  const selectedKey = formatDateKey(selectedDate);
  const dayIndex = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();

  const allowedDates = (() => {
    const today = new Date(baseToday);
    const day = today.getDay() === 0 ? 7 : today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day - 1));
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    const dates = [];
    for (let d = new Date(today); d <= friday; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
    if (day === 5) {
      const nextMonday = new Date(friday);
      nextMonday.setDate(friday.getDate() + 3);
      for (let i = 0; i < 3; i++) {
        const nd = new Date(nextMonday);
        nd.setDate(nextMonday.getDate() + i);
        dates.push(nd);
      }
    }
    return dates.map(d => new Date(d));
  })();

  const allowedKeys = allowedDates.map(d => formatDateKey(d));
  const currentIndex = allowedKeys.indexOf(selectedKey);

  if (!scheduleXml) {
    return (
      <Card className="p-6 text-sm text-gray-600">
        No hay horario cargado. Pide a Jefatura que suba el XML.
      </Card>
    );
  }

  if (dayIndex > 5) {
    return (
      <Card className="p-6 text-sm text-gray-600">
        Hoy no hay clases. El parte de guardia se muestra de lunes a viernes.
      </Card>
    );
  }

  const tramosHoy = (scheduleXml.tramos || []).filter(t => t.dia === dayIndex).sort((a, b) => a.hora - b.hora);

  const absencesByTramo = {};
  ausencias.forEach((aus) => {
    (aus.slots || []).forEach((slot) => {
      if (slot.fecha !== selectedKey) return;
      if (!absencesByTramo[slot.tramoId]) absencesByTramo[slot.tramoId] = [];
      absencesByTramo[slot.tramoId].push({
        profesor: aus.profesor,
        profesorId: aus.profesorId,
        xmlProfesorId: aus.xmlProfesorId,
        abreviatura: aus.abreviatura
      });
    });
  });

  const getGroupsForProfessor = (tramoId, xmlProfesorId, abreviatura) => {
    let profId = xmlProfesorId;
    if (!profId && abreviatura) {
      const p = scheduleXml.profesores?.find(pr => (pr.abreviatura || '').toUpperCase() === abreviatura.toUpperCase());
      profId = p?.id;
    }
    if (!profId) return [];
    const tramoData = scheduleXml.actividadesPorProfesorTramo?.[String(profId)]?.[String(tramoId)];
    let groupIds = tramoData?.groups ? Array.from(tramoData.groups) : [];
    let aulas = tramoData?.aulas ? Array.from(tramoData.aulas) : [];
    if (!groupIds.length) {
      const actividades = scheduleXml.actividadesByTramo?.[String(tramoId)] || [];
      const byProfesor = actividades.filter(a => String(a.profesorId).trim() === String(profId).trim());
      groupIds = byProfesor.flatMap(a => a.groupIds || []);
      if (!groupIds.length) {
        const profActs = scheduleXml.horariosPorProfesor?.[String(profId)] || [];
        const asignaturas = profActs.filter(a => String(a.tramo) === String(tramoId)).map(a => String(a.asignatura));
        if (asignaturas.length) {
          const byAsignatura = actividades.filter(a => asignaturas.includes(String(a.asignaturaId)));
          groupIds = byAsignatura.flatMap(a => a.groupIds || []);
        }
      }
    }
    const unique = Array.from(new Set(groupIds));
    const grupos = unique.map(id => scheduleXml.grupos?.[id]?.abreviatura || id);
    return { grupos, aulas };
  };

  const renderSection = (title, tramos) => (
    <Card className="p-4">
      <h3 className="font-semibold text-gray-800 mb-3">{title}</h3>
      <div className="space-y-2">
        {tramos.map((tramo) => {
          const absences = absencesByTramo[tramo.id] || [];
          return (
            <div key={tramo.id} className="border rounded p-3">
              <div className="text-sm font-medium text-gray-700">
                {tramo.inicio} - {tramo.fin}
              </div>
              {absences.length === 0 ? (
                <div className="text-xs text-gray-400 mt-1">Sin ausencias</div>
              ) : (
                <div className="mt-2 space-y-1">
                  {absences.map((abs, idx) => {
                    const { grupos, aulas } = getGroupsForProfessor(tramo.id, abs.xmlProfesorId, abs.abreviatura);
                    return (
                      <div key={`${abs.profesor}-${idx}`} className="text-xs text-gray-700">
                        <span className="font-semibold">{abs.profesor}</span>
                        {grupos.length ? ` · ${grupos.join(', ')}` : ' · (Sin grupo)'}
                        {aulas.length ? ` · Aula ${aulas.join(', ')}` : ''}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );

  const morning = tramosHoy.filter(t => Number(String(t.inicio).split(':')[0]) < 14);
  const afternoon = tramosHoy.filter(t => Number(String(t.inicio).split(':')[0]) >= 14);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Parte de Guardia</h2>
          <div className="text-sm text-gray-500">{selectedDate.toLocaleDateString()}</div>
        </div>
        <div className="flex space-x-2">
          <button
            type="button"
            disabled={currentIndex <= 0}
            onClick={() => {
              if (currentIndex > 0) setSelectedDate(new Date(allowedDates[currentIndex - 1]));
            }}
            className="px-3 py-1 text-sm border rounded disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={currentIndex === -1 || currentIndex >= allowedDates.length - 1}
            onClick={() => {
              if (currentIndex < allowedDates.length - 1) setSelectedDate(new Date(allowedDates[currentIndex + 1]));
            }}
            className="px-3 py-1 text-sm border rounded disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {renderSection('Mañana', morning)}
        {renderSection('Tarde', afternoon)}
      </div>
    </div>
  );
};
