import { useState, useEffect } from 'react';
import { API_URL, SERVER_URL } from './config';
import './AdminPanel.css';

function AdminPanel({ onBack }) {
  const [activeTab, setActiveTab] = useState('subjects');
  const [subjects, setSubjects] = useState([]);
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  
  // Формы для добавления
  const [newSubject, setNewSubject] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [newStudent, setNewStudent] = useState('');
  const [selectedSubjectForUpload, setSelectedSubjectForUpload] = useState('');
  
  // Ручное добавление вопроса
  const [manualQuestion, setManualQuestion] = useState('');
  const [manualVariants, setManualVariants] = useState(['', '', '', '', '']);
  const [manualSubjectId, setManualSubjectId] = useState('');
  
  // Просмотр всех вопросов
  const [allQuestions, setAllQuestions] = useState([]);
  const [selectedSubjectForView, setSelectedSubjectForView] = useState('');
  const [questionsLoading, setQuestionsLoading] = useState(false);
  
  // Управление разрешениями групп для предметов
  const [editingSubjectGroups, setEditingSubjectGroups] = useState(null);
  const [selectedGroupsForSubject, setSelectedGroupsForSubject] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSubjects();
    fetchGroups();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      fetchStudents(selectedGroupId);
    }
  }, [selectedGroupId]);

  useEffect(() => {
    if (activeTab === 'questions') {
      fetchAllQuestions();
    }
  }, [activeTab, selectedSubjectForView]);

  const fetchSubjects = async () => {
    try {
      const res = await fetch(`${API_URL}/subjects`);
      const data = await res.json();
      setSubjects(data);
    } catch (error) {
      console.error('Error fetching subjects:', error);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch(`${API_URL}/groups`);
      const data = await res.json();
      setGroups(data);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const fetchStudents = async (groupId) => {
    try {
      const res = await fetch(`${API_URL}/students?groupId=${groupId}`);
      const data = await res.json();
      setStudents(data);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const handleAddSubject = async () => {
    if (!newSubject.trim()) return;
    try {
      await fetch(`${API_URL}/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSubject })
      });
      setNewSubject('');
      fetchSubjects();
      setMessage('Предмет добавлен');
    } catch (error) {
      setMessage('Ошибка добавления предмета');
    }
  };

  const handleDeleteSubject = async (id) => {
    if (!confirm('Удалить предмет и все его вопросы?')) return;
    try {
      await fetch(`${API_URL}/subjects/${id}`, { method: 'DELETE' });
      fetchSubjects();
      setMessage('Предмет удален');
    } catch (error) {
      setMessage('Ошибка удаления');
    }
  };

  const handleDeleteAllQuestions = async (subjectId) => {
    const subject = subjects.find(s => s._id === subjectId);
    const subjectName = subject ? subject.name : 'предмета';
    
    if (!confirm(`Удалить все вопросы предмета "${subjectName}"? Это действие нельзя отменить.`)) return;
    
    try {
      const res = await fetch(`${API_URL}/questions/subject/${subjectId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setMessage(data.message || `Удалено ${data.deletedCount || 0} вопросов`);
        // Обновляем список вопросов, если открыта вкладка
        if (activeTab === 'questions') {
          fetchAllQuestions();
        }
      } else {
        setMessage('Ошибка удаления вопросов');
      }
    } catch (error) {
      setMessage('Ошибка удаления вопросов');
    }
  };

  const handleOpenGroupsModal = (subject) => {
    setEditingSubjectGroups(subject);
    // Устанавливаем текущие выбранные группы
    setSelectedGroupsForSubject(subject.allowedGroups?.map(g => g._id || g) || []);
  };

  const handleCloseGroupsModal = () => {
    setEditingSubjectGroups(null);
    setSelectedGroupsForSubject([]);
  };

  const handleToggleGroup = (groupId) => {
    setSelectedGroupsForSubject(prev => {
      if (prev.includes(groupId)) {
        return prev.filter(id => id !== groupId);
      } else {
        return [...prev, groupId];
      }
    });
  };

  const handleSaveGroups = async () => {
    if (!editingSubjectGroups) return;
    
    try {
      const res = await fetch(`${API_URL}/subjects/${editingSubjectGroups._id}/groups`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedGroups: selectedGroupsForSubject })
      });
      
      if (res.ok) {
        const updatedSubject = await res.json();
        // Обновляем список предметов
        fetchSubjects();
        setMessage('Разрешения групп обновлены');
        handleCloseGroupsModal();
      } else {
        setMessage('Ошибка обновления разрешений');
      }
    } catch (error) {
      setMessage('Ошибка обновления разрешений');
    }
  };

  const handleAddGroup = async () => {
    if (!newGroup.trim()) return;
    try {
      await fetch(`${API_URL}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroup })
      });
      setNewGroup('');
      fetchGroups();
      setMessage('Группа добавлена');
    } catch (error) {
      setMessage('Ошибка добавления группы');
    }
  };

  const handleDeleteGroup = async (id) => {
    if (!confirm('Удалить группу и всех студентов?')) return;
    try {
      await fetch(`${API_URL}/groups/${id}`, { method: 'DELETE' });
      fetchGroups();
      setMessage('Группа удалена');
    } catch (error) {
      setMessage('Ошибка удаления');
    }
  };

  const handleAddStudent = async () => {
    if (!newStudent.trim() || !selectedGroupId) return;
    try {
      await fetch(`${API_URL}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: newStudent, groupId: selectedGroupId })
      });
      setNewStudent('');
      fetchStudents(selectedGroupId);
      setMessage('Студент добавлен');
    } catch (error) {
      setMessage('Ошибка добавления студента');
    }
  };

  const handleDeleteStudent = async (id) => {
    if (!confirm('Удалить студента?')) return;
    try {
      await fetch(`${API_URL}/students/${id}`, { method: 'DELETE' });
      fetchStudents(selectedGroupId);
      setMessage('Студент удален');
    } catch (error) {
      setMessage('Ошибка удаления');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedSubjectForUpload) {
      setMessage('Выберите предмет и файл');
      return;
    }
    
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subjectId', selectedSubjectForUpload);
    
    try {
      const res = await fetch(`${API_URL}/questions/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage(data.message || `Обработано ${data.count} вопросов: создано ${data.created || 0}, обновлено ${data.updated || 0}`);
        // Обновить список вопросов, если открыта вкладка
        if (activeTab === 'questions') {
          fetchAllQuestions();
        }
      } else {
        // Показываем детальное сообщение об ошибке
        const errorMsg = data.error || 'Ошибка загрузки';
        const details = data.details ? `\n${data.details}` : '';
        setMessage(`${errorMsg}${details}`);
      }
    } catch (error) {
      setMessage(`Ошибка загрузки файла: ${error.message}`);
    }
    setLoading(false);
    e.target.value = '';
  };

  const handleAddManualQuestion = async () => {
    if (!manualQuestion.trim() || !manualSubjectId) {
      setMessage('Заполните вопрос и выберите предмет');
      return;
    }
    
    const variants = manualVariants
      .filter(v => v.trim())
      .map((v, i) => ({ text: v, isCorrect: i === 0 }));
    
    if (variants.length < 2) {
      setMessage('Добавьте минимум 2 варианта ответа');
      return;
    }
    
    try {
      await fetch(`${API_URL}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: manualSubjectId,
          questionText: manualQuestion,
          questionHtml: manualQuestion,
          variants
        })
      });
      setManualQuestion('');
      setManualVariants(['', '', '', '', '']);
      setMessage('Вопрос добавлен');
      if (activeTab === 'questions') {
        fetchAllQuestions();
      }
    } catch (error) {
      setMessage('Ошибка добавления вопроса');
    }
  };

  const fetchAllQuestions = async () => {
    setQuestionsLoading(true);
    try {
      const url = selectedSubjectForView 
        ? `${API_URL}/questions?subjectId=${selectedSubjectForView}`
        : `${API_URL}/questions`;
      const res = await fetch(url);
      const data = await res.json();
      setAllQuestions(data);
    } catch (error) {
      console.error('Error fetching questions:', error);
      setMessage('Ошибка загрузки вопросов');
    }
    setQuestionsLoading(false);
  };

  const handleDeleteQuestion = async (id) => {
    if (!confirm('Удалить вопрос?')) return;
    try {
      await fetch(`${API_URL}/questions/${id}`, { method: 'DELETE' });
      fetchAllQuestions();
      setMessage('Вопрос удален');
    } catch (error) {
      setMessage('Ошибка удаления вопроса');
    }
  };

  // Функция для исправления путей к изображениям
  const fixImagePaths = (html) => {
    if (!html) return html;
    // Заменяем относительные пути /uploads/ на полный URL к серверу
    return html.replace(/src="\/uploads\//g, `src="${SERVER_URL}/uploads/`);
  };

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>Админ панель</h1>
        <button onClick={onBack} className="back-btn">Вернуться на главную</button>
      </div>
      
      {message && (
        <div className="admin-message">
          {message}
          <button onClick={() => setMessage('')}>×</button>
        </div>
      )}
      
      <div className="admin-tabs">
        <button 
          className={activeTab === 'subjects' ? 'active' : ''} 
          onClick={() => setActiveTab('subjects')}
        >
          Предметы
        </button>
        <button 
          className={activeTab === 'groups' ? 'active' : ''} 
          onClick={() => setActiveTab('groups')}
        >
          Группы
        </button>
        <button 
          className={activeTab === 'students' ? 'active' : ''} 
          onClick={() => setActiveTab('students')}
        >
          Студенты
        </button>
        <button 
          className={activeTab === 'upload' ? 'active' : ''} 
          onClick={() => setActiveTab('upload')}
        >
          Загрузка вопросов
        </button>
        <button 
          className={activeTab === 'manual' ? 'active' : ''} 
          onClick={() => setActiveTab('manual')}
        >
          Ручное добавление
        </button>
        <button 
          className={activeTab === 'questions' ? 'active' : ''} 
          onClick={() => setActiveTab('questions')}
        >
          Все вопросы
        </button>
      </div>
      
      <div className="admin-content">
        {/* Предметы */}
        {activeTab === 'subjects' && (
          <div className="admin-section">
            <h2>Предметы</h2>
            <div className="add-form">
              <input 
                type="text" 
                placeholder="Название предмета"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
              />
              <button onClick={handleAddSubject}>Добавить</button>
            </div>
            <ul className="admin-list">
              {subjects.map(s => (
                <li key={s._id}>
                  <div className="subject-info">
                    <span>{s.name}</span>
                    {s.allowedGroups && s.allowedGroups.length > 0 && (
                      <span className="subject-groups-badge">
                        Доступно группам: {s.allowedGroups.map(g => g.name || g).join(', ')}
                      </span>
                    )}
                    {(!s.allowedGroups || s.allowedGroups.length === 0) && (
                      <span className="subject-groups-badge all-groups">Доступно всем группам</span>
                    )}
                  </div>
                  <div className="subject-actions">
                    <button 
                      className="manage-groups-btn"
                      onClick={() => handleOpenGroupsModal(s)}
                      title="Управление разрешениями групп"
                    >
                      Разрешения групп
                    </button>
                    <button 
                      className="delete-questions-btn"
                      onClick={() => handleDeleteAllQuestions(s._id)}
                      title="Удалить все вопросы предмета"
                    >
                      Удалить вопросы
                    </button>
                    <button onClick={() => handleDeleteSubject(s._id)}>Удалить предмет</button>
                  </div>
                </li>
              ))}
            </ul>
            
            {/* Модальное окно для управления разрешениями групп */}
            {editingSubjectGroups && (
              <div className="modal-overlay" onClick={handleCloseGroupsModal}>
                <div className="groups-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>Разрешения групп для предмета: {editingSubjectGroups.name}</h3>
                    <button className="close-modal-btn" onClick={handleCloseGroupsModal}>×</button>
                  </div>
                  <div className="modal-body">
                    <p className="modal-info">
                      Выберите группы, которым будет доступен этот предмет. 
                      Если ни одна группа не выбрана, предмет будет доступен всем группам.
                    </p>
                    <div className="groups-checkbox-list">
                      {groups.map(group => (
                        <label key={group._id} className="group-checkbox-item">
                          <input
                            type="checkbox"
                            checked={selectedGroupsForSubject.includes(group._id)}
                            onChange={() => handleToggleGroup(group._id)}
                          />
                          <span>{group.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="cancel-btn" onClick={handleCloseGroupsModal}>Отмена</button>
                    <button className="save-btn" onClick={handleSaveGroups}>Сохранить</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Группы */}
        {activeTab === 'groups' && (
          <div className="admin-section">
            <h2>Группы</h2>
            <div className="add-form">
              <input 
                type="text" 
                placeholder="Название группы (например: ИС-22-1к)"
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
              />
              <button onClick={handleAddGroup}>Добавить</button>
            </div>
            <ul className="admin-list">
              {groups.map(g => (
                <li key={g._id}>
                  <span>{g.name}</span>
                  <button onClick={() => handleDeleteGroup(g._id)}>Удалить</button>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Студенты */}
        {activeTab === 'students' && (
          <div className="admin-section">
            <h2>Студенты</h2>
            <div className="add-form">
              <select 
                value={selectedGroupId} 
                onChange={(e) => setSelectedGroupId(e.target.value)}
              >
                <option value="">Выберите группу</option>
                {groups.map(g => (
                  <option key={g._id} value={g._id}>{g.name}</option>
                ))}
              </select>
              <input 
                type="text" 
                placeholder="ФИО студента"
                value={newStudent}
                onChange={(e) => setNewStudent(e.target.value)}
              />
              <button onClick={handleAddStudent}>Добавить</button>
            </div>
            <ul className="admin-list">
              {students.map(s => (
                <li key={s._id}>
                  <span>{s.fullName}</span>
                  <button onClick={() => handleDeleteStudent(s._id)}>Удалить</button>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Загрузка вопросов из DOCX */}
        {activeTab === 'upload' && (
          <div className="admin-section">
            <h2>Загрузка вопросов из DOCX</h2>
            <p className="info-text">
              Формат файла: &lt;question&gt;Текст вопроса &lt;variant&gt;Ответ1 &lt;variant&gt;Ответ2...
              <br />Первый вариант считается правильным.
            </p>
            <div className="add-form">
              <select 
                value={selectedSubjectForUpload} 
                onChange={(e) => setSelectedSubjectForUpload(e.target.value)}
              >
                <option value="">Выберите предмет</option>
                {subjects.map(s => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
              <input 
                type="file" 
                accept=".docx,.doc,.txt"
                onChange={handleFileUpload}
                disabled={loading || !selectedSubjectForUpload}
              />
              <small style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                Поддерживаемые форматы: DOCX, DOC, TXT
              </small>
            </div>
            {loading && <p>Загрузка и парсинг файла...</p>}
          </div>
        )}
        
        {/* Ручное добавление вопроса */}
        {activeTab === 'manual' && (
          <div className="admin-section">
            <h2>Ручное добавление вопроса</h2>
            <div className="manual-form">
              <select 
                value={manualSubjectId} 
                onChange={(e) => setManualSubjectId(e.target.value)}
              >
                <option value="">Выберите предмет</option>
                {subjects.map(s => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
              
              <textarea 
                placeholder="Текст вопроса"
                value={manualQuestion}
                onChange={(e) => setManualQuestion(e.target.value)}
              />
              
              <p>Варианты ответов (первый - правильный):</p>
              {manualVariants.map((v, i) => (
                <input 
                  key={i}
                  type="text"
                  placeholder={`Вариант ${i + 1}${i === 0 ? ' (правильный)' : ''}`}
                  value={v}
                  onChange={(e) => {
                    const newVars = [...manualVariants];
                    newVars[i] = e.target.value;
                    setManualVariants(newVars);
                  }}
                />
              ))}
              
              <button onClick={handleAddManualQuestion}>Добавить вопрос</button>
            </div>
          </div>
        )}
        
        {/* Просмотр всех вопросов */}
        {activeTab === 'questions' && (
          <div className="admin-section">
            <h2>Все вопросы</h2>
            <div className="questions-filter">
              <select 
                value={selectedSubjectForView} 
                onChange={(e) => setSelectedSubjectForView(e.target.value)}
              >
                <option value="">Все предметы</option>
                {subjects.map(s => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
              <span className="questions-count">
                Всего вопросов: {allQuestions.length}
              </span>
            </div>
            
            {questionsLoading ? (
              <p>Загрузка вопросов...</p>
            ) : allQuestions.length === 0 ? (
              <p>Вопросы не найдены</p>
            ) : (
              <div className="questions-list">
                {allQuestions.map((q, idx) => (
                  <div key={q._id} className="question-item">
                    <div className="question-header">
                      <span className="question-number">#{idx + 1}</span>
                      <span className="question-subject">
                        {q.subjectId?.name || 'Без предмета'}
                      </span>
                      <button 
                        className="delete-question-btn"
                        onClick={() => handleDeleteQuestion(q._id)}
                      >
                        Удалить
                      </button>
                    </div>
                    <div 
                      className="question-text-display"
                      dangerouslySetInnerHTML={{ __html: fixImagePaths(q.questionHtml || q.questionText) }}
                    />
                    <div className="question-variants">
                      {q.variants?.map((v, vIdx) => {
                        const hasHtml = v.text && v.text.includes('<img');
                        const fixedVariantText = hasHtml ? fixImagePaths(v.text) : v.text;
                        
                        return (
                          <div 
                            key={vIdx} 
                            className={`variant-item ${v.isCorrect ? 'correct' : ''}`}
                          >
                            <span className="variant-marker">
                              {v.isCorrect ? '✓' : '○'}
                            </span>
                            {hasHtml ? (
                              <span 
                                className="variant-text" 
                                dangerouslySetInnerHTML={{ __html: fixedVariantText }}
                              />
                            ) : (
                              <span className="variant-text">{v.text}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPanel;

