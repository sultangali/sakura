import { useState, useEffect } from 'react';
import { API_URL } from './config';
import './StudentModal.css';

function StudentModal({ onComplete }) {
  const [step, setStep] = useState(1); // 1 - группа, 2 - студент, 3 - предмет
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchGroups();
    fetchSubjects();
  }, []);

  const fetchGroups = async () => {
    try {
      const res = await fetch(`${API_URL}/groups`);
      const data = await res.json();
      setGroups(data);
      setLoading(false);
    } catch (err) {
      setError('Ошибка загрузки групп');
      setLoading(false);
    }
  };

  const fetchSubjects = async (groupId = null) => {
    try {
      const url = groupId 
        ? `${API_URL}/subjects?groupId=${groupId}`
        : `${API_URL}/subjects`;
      const res = await fetch(url);
      const data = await res.json();
      setSubjects(data);
    } catch (err) {
      console.error('Error fetching subjects:', err);
    }
  };

  const fetchStudents = async (groupId) => {
    try {
      const res = await fetch(`${API_URL}/students?groupId=${groupId}`);
      const data = await res.json();
      setStudents(data);
    } catch (err) {
      setError('Ошибка загрузки студентов');
    }
  };

  const handleGroupSelect = async (group) => {
    setSelectedGroup(group);
    await fetchStudents(group._id);
    // Загружаем предметы, доступные для выбранной группы
    await fetchSubjects(group._id);
    setStep(2);
  };

  const handleStudentSelect = (student) => {
    setSelectedStudent(student);
    setStep(3);
  };

  const handleSubjectSelect = (subject) => {
    setSelectedSubject(subject);
    onComplete({
      group: selectedGroup,
      student: selectedStudent,
      subject: subject
    });
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="student-modal">
          <div className="modal-loading">Загрузка...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="student-modal">
        <div className="modal-header">
          <h2>Добро пожаловать</h2>
          <p>Выберите данные для начала тестирования</p>
        </div>
        
        {error && <div className="modal-error">{error}</div>}
        
        <div className="modal-steps">
          <div className={`step ${step >= 1 ? 'active' : ''}`}>1. Группа</div>
          <div className={`step ${step >= 2 ? 'active' : ''}`}>2. Студент</div>
          <div className={`step ${step >= 3 ? 'active' : ''}`}>3. Предмет</div>
        </div>
        
        <div className="modal-content">
          {step === 1 && (
            <div className="selection-list">
              <label>Выберите группу:</label>
              <select 
                value="" 
                onChange={(e) => {
                  const group = groups.find(g => g._id === e.target.value);
                  if (group) handleGroupSelect(group);
                }}
              >
                <option value="">-- Выберите группу --</option>
                {groups.map(g => (
                  <option key={g._id} value={g._id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}
          
          {step === 2 && (
            <div className="selection-list">
              <div className="selected-info">
                <span>Группа: <strong>{selectedGroup?.name}</strong></span>
                <button onClick={() => setStep(1)}>Изменить</button>
              </div>
              <label>Выберите себя из списка:</label>
              <select 
                value="" 
                onChange={(e) => {
                  const student = students.find(s => s._id === e.target.value);
                  if (student) handleStudentSelect(student);
                }}
              >
                <option value="">-- Выберите студента --</option>
                {students.map(s => (
                  <option key={s._id} value={s._id}>{s.fullName}</option>
                ))}
              </select>
            </div>
          )}
          
          {step === 3 && (
            <div className="selection-list">
              <div className="selected-info">
                <span>Группа: <strong>{selectedGroup?.name}</strong></span>
              </div>
              <div className="selected-info">
                <span>Студент: <strong>{selectedStudent?.fullName}</strong></span>
                <button onClick={() => setStep(2)}>Изменить</button>
              </div>
              <label>Выберите предмет:</label>
              <select 
                value="" 
                onChange={(e) => {
                  const subject = subjects.find(s => s._id === e.target.value);
                  if (subject) handleSubjectSelect(subject);
                }}
              >
                <option value="">-- Выберите предмет --</option>
                {subjects.map(s => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StudentModal;

