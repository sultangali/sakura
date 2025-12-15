import { useState, useEffect, useRef } from 'react';
import 'boxicons/css/boxicons.min.css';
import './App.css';
import AdminPanel from './AdminPanel';
import StudentModal from './StudentModal';
import { API_URL, SERVER_URL } from './config';

function App() {
  const [showAdmin, setShowAdmin] = useState(false);
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  
  const [showModal, setShowModal] = useState(true);
  const [sessionData, setSessionData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(40 * 60); // 40 минут в секундах
  const [timerActive, setTimerActive] = useState(false);

  // Таймер обратного отсчета
  useEffect(() => {
    if (!timerActive || timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timerActive, timeLeft]);

  // Форматирование времени
  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Загрузка вопросов
  const fetchQuestions = async (subjectId) => {
    try {
      const res = await fetch(`${API_URL}/questions?subjectId=${subjectId}`);
      const data = await res.json();
      
      // Перемешиваем варианты ответов для каждого вопроса
      const shuffledQuestions = data.map(q => ({
        ...q,
        variants: shuffleVariants(q.variants)
      }));
      
      setQuestions(shuffledQuestions);
    } catch (error) {
      console.error('Error fetching questions:', error);
    }
  };

  // Перемешивание вариантов
  const shuffleVariants = (variants) => {
    const shuffled = [...variants];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Обработка завершения выбора в модальном окне
  const handleModalComplete = async (data) => {
    setSessionData(data);
    setShowModal(false);
    await fetchQuestions(data.subject._id);
    setTimerActive(true);
  };

  // Авторизация админа
  const handleAdminLogin = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword })
      });
      const data = await res.json();
      if (data.success) {
        setIsAdminAuth(true);
        setAdminError('');
      } else {
        setAdminError('Пароль қате родной артқа қайт');
      }
    } catch (error) {
      setAdminError('униктың инеті как всегда подвел');
    }
  };

  // Проверка URL для админки
  useEffect(() => {
    if (window.location.pathname === '/admin') {
      setShowAdmin(true);
    }
  }, []);

  // Если админ панель
  if (showAdmin) {
    if (!isAdminAuth) {
      return (
        <div className="admin-login">
          <div className="admin-login-box">
            <h2>Кет бар мында не жоғалттың</h2>
            <input
              type="password"
              placeholder="Жүрегімнің кілтін тер"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
            />
            <button onClick={handleAdminLogin}>Кіріп көр кіре алсаң</button>
            {adminError && <p className="error">{adminError}</p>}
            <button className="back-link" onClick={() => setShowAdmin(false)}>
              Қайт ауылға
            </button>
          </div>
        </div>
      );
    }
    return <AdminPanel onBack={() => { setShowAdmin(false); setIsAdminAuth(false); }} />;
  }

  return (
    <div className="app-container">
      {/* Модальное окно выбора */}
      {showModal && <StudentModal onComplete={handleModalComplete} />}
      
      {/* Левая боковая панель (на всю высоту экрана) */}
      <LeftSidebar onAdminClick={() => setShowAdmin(true)} />
      
      {/* Правая часть: верхнее меню и контент */}
      <div className="right-section">
        {/* Верхнее меню */}
        <TopMenu />
        
        {/* Основной контент */}
        <div className="main-content">
          <TestInterface 
            questions={questions}
            currentIndex={currentQuestionIndex}
            setCurrentIndex={setCurrentQuestionIndex}
            timeLeft={timeLeft}
            formatTime={formatTime}
            sessionData={sessionData}
          />
        </div>
      </div>
    </div>
  );
}

// Компонент верхнего меню
function TopMenu() {
  return (
    <header className="top-menu">
      <div className="top-menu-content">
        {/* Правая часть меню */}
        <div className="top-menu-right">
          {/* Кнопка "Сайт картасы" */}
          <button className="site-map-button">
            <span className='tf-icons bx bx-sitemap me-1'></span>
            <span>&nbsp;Сайт картасы</span>
          </button>

          {/* Переключатель языков */}
          <div className="language-switcher">
            <span className="language-active">KZ</span>
            <span className="language-separator">|</span>
            <span className="language-option">RU</span>
            <span className="language-separator">|</span>
            <span className="language-option">EN</span>
          </div>

          {/* Иконка сообщений */}
          <button className="icon-button">
            <i className='bx bx-envelope bx-sm' style={{
              color: 'gray'
            }}></i>
          </button>

          {/* Иконка уведомлений с бейджем */}
          <button className="icon-button notification-button">
            <i className='bx bx-bell bx-sm' style={{
              color: 'gray'
            }}></i>
            <span className="notification-badge">5</span>
          </button>

          {/* Иконка профиля пользователя */}
          <button className="icon-button profile-button">
            <div className="profile-avatar-wrapper" >
              <img 
                className="profile-avatar"
                
                src={"data:image/JPEG;base64,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"} 
                alt="user"
                
              />
              <span className="online-indicator"></span>
            </div>
          </button>
        </div>
      </div>
    </header>
  )
}

// Компонент левой боковой панели
function LeftSidebar({ onAdminClick }) {
  return (
    <aside className="left-sidebar">
      {/* Логотип PLATONUS */}
      <div className="sidebar-logo" onClick={onAdminClick} style={{ cursor: 'pointer' }} title="Админ панель">
        <div className="logo-icon">
          <img 
            className="logo-svg" 
            src="https://platonus.buketov.edu.kz/img/logos/logo.svg" 
            alt="PLATONUS Logo"
          />
        </div>
      </div>

      {/* Навигационное меню */}
      <nav className="sidebar-nav">
        <a className="nav-item plt-menu-icon" href="#" title="Книга">
          <img src="https://platonus.buketov.edu.kz/img/menuLogo/tutorials.svg" alt="" />
        </a>
        <a className="nav-item plt-menu-icon" href="#" title="Монитор">
          <img src="https://platonus.buketov.edu.kz/img/menuLogo/educational-process.svg" alt="" />
        </a>
        <a className="nav-item plt-menu-icon" href="#" title="Пользователь">
          <img src="https://platonus.buketov.edu.kz/img/menuLogo/monitoring-education-process.svg" alt="" />
        </a>
        <a className="nav-item plt-menu-icon" href="#" title="Документ">
          <img src="https://platonus.buketov.edu.kz/img/menuLogo/interim-attestation.svg" alt="" />
        </a>
        <a className="nav-item plt-menu-icon" href="#" title="Пользователь-монитор">
          <img src="https://platonus.buketov.edu.kz/img/menuLogo/testing.svg" alt="" />
        </a>
        <a className="nav-item plt-menu-icon" href="#" title="Атом">
          <img src="https://platonus.buketov.edu.kz/img/menuLogo/extracurricular-activity.svg" alt="" />
        </a>
        <a className="nav-item plt-menu-icon" href="#" title="Сетка">
          <img src="https://platonus.buketov.edu.kz/img/menuLogo/additional.svg" style={{
            background: 'black'
          }} alt="" />
        </a>
      </nav>
    </aside>
  );
}

// Компонент интерфейса тестирования
function TestInterface({ questions, currentIndex, setCurrentIndex, timeLeft, formatTime, sessionData }) {
  const currentQuestion = questions[currentIndex] || null;
  const totalQuestions = questions.length;
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);
  
  // Находим правильный вариант для текущего вопроса
  const correctVariantIndex = currentQuestion?.variants?.findIndex(v => v.isCorrect) ?? -1;
  
  // Вычисляем количество активных кнопок пагинации на основе прошедшего времени
  // 40 минут = 2400 секунд
  const totalTime = 40 * 60; // 2400 секунд
  const elapsedTime = Math.max(0, totalTime - timeLeft);
  const progressPercent = Math.min(100, (elapsedTime / totalTime) * 100);
  const activeButtonsCount = Math.ceil((25 * progressPercent) / 100);
  
  // Функция для исправления путей к изображениям
  const fixImagePaths = (html) => {
    if (!html) return html;
    // Заменяем относительные пути /uploads/ на полный URL к серверу
    return html.replace(/src="\/uploads\//g, `src="${SERVER_URL}/uploads/`);
  };
  
  // Получаем исправленный HTML с правильными путями к изображениям
  const questionHtmlWithFixedImages = currentQuestion 
    ? fixImagePaths(currentQuestion.questionHtml || currentQuestion.questionText)
    : '';
  
  // Функция поиска по вопросам
  const handleSearch = (query) => {
    if (!query.trim() || questions.length === 0) {
      return;
    }
    
    // Ищем вопрос по тексту (без учета регистра)
    const searchLower = query.toLowerCase();
    const foundIndex = questions.findIndex((q) => {
      // Ищем в тексте вопроса (убираем HTML теги)
      const questionText = (q.questionText || '').replace(/<[^>]*>/g, '').toLowerCase();
      // Ищем в вариантах ответов (убираем HTML теги)
      const variantsText = (q.variants || [])
        .map(v => (v.text || '').replace(/<[^>]*>/g, '').toLowerCase())
        .join(' ');
      
      return questionText.includes(searchLower) || variantsText.includes(searchLower);
    });
    
    // Если нашли, переключаемся на найденный вопрос
    if (foundIndex !== -1) {
      setCurrentIndex(foundIndex);
    }
  };
  
  // Обработка изменения поискового запроса
  useEffect(() => {
    if (searchQuery.trim()) {
      handleSearch(searchQuery);
    }
  }, [searchQuery, questions]);
  
  // Обработка нажатий клавиш для поиска
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Если нажата буква или цифра (не в инпуте и не в select)
      if (e.target.tagName !== 'INPUT' && 
          e.target.tagName !== 'TEXTAREA' && 
          e.target.tagName !== 'SELECT' &&
          !e.target.isContentEditable &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey) {
        const char = e.key;
        // Проверяем, что это буква или цифра
        if (/[a-zA-Zа-яА-Я0-9]/.test(char) && char.length === 1) {
          // Фокусируемся на поисковом инпуте и добавляем символ
          if (searchInputRef.current) {
            e.preventDefault();
            searchInputRef.current.focus();
            setSearchQuery(prev => prev + char);
          }
        }
        // Если нажат Backspace, удаляем последний символ
        if (char === 'Backspace' && searchInputRef.current && searchQuery.length > 0) {
          e.preventDefault();
          searchInputRef.current.focus();
          setSearchQuery(prev => prev.slice(0, -1));
        }
        // Если нажат Escape, очищаем поиск и убираем фокус
        if (char === 'Escape' && searchInputRef.current) {
          e.preventDefault();
          setSearchQuery('');
          searchInputRef.current.blur();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [searchQuery]);
  
  return (
    <div className="test-container">
      {/* Шапка с информацией о студенте */}
      <div className="test-header">
        <div className="student-info">
          {/* Имя студента сверху */}
          <h3 className="student-name">{sessionData?.student?.fullName || 'Студент'}</h3>
          
          {/* Ниже: слева аватар, справа информация */}
          <div className="student-bottom-section" style={{ margin: '20px 0' }}>
            <div className="student-avatar">
              <img style={{
                borderRadius: '50%',
                width: 'auto',
                height: '100px'
              }} src="data:image/JPEG;base64,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" alt="" />
            </div>
            <div className="test-info">
              <div className="info-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
                  <path d="M6.012 18H21V4a2 2 0 0 0-2-2H6c-1.206 0-3 .799-3 3v14c0 2.201 1.794 3 3 3h15v-2H6.012C5.55 19.988 5 19.805 5 19s.55-.988 1.012-1zM8 6h9v2H8V6z" fill="currentColor"/>
                </svg>
                <span>План: <strong>{sessionData?.subject?.name || 'Предмет'}</strong></span>
              </div>
              <div className="info-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
                  <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10s10-4.486 10-10S17.514 2 12 2zm3.293 14.707L11 12.414V6h2v5.586l3.707 3.707l-1.414 1.414z" fill="currentColor"/>
                </svg>
                <span>Тестілеудің уақыты: <strong>40 мин.</strong></span>
              </div>
              <div className="info-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M4 6h2v2H4zm0 5h2v2H4zm0 5h2v2H4zm16-8V6H8.023v2H18.8zM8 11h12v2H8zm0 5h12v2H8z"/>
                </svg>
                <span>Білімалу түрі: <strong>Емтихан</strong></span>
              </div>
              <div
              style={{
               
                // left: 0,
                // right: 0,
                bottom: 24,
                // display: 'flex',
                // justifyContent: 'center',
                // zIndex: 1000,
                pointerEvents: 'none',
              }}
            >
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchQuery('');
                    e.target.blur();
                  }
                  if (e.key === 'Enter') {
                    setSearchQuery('');
                    e.target.blur();
                  }
                }}
                placeholder="балапан іздеп болсаң мышканы басқа жерге бас"
                className="question-search-input"
                autoComplete="off"
                spellCheck="false"
                style={{
                  minWidth: 280,
                  maxWidth: 330,
                  
                  
                  boxShadow: 'none',
                  border:  'none' ,
                  outline:  'none',
                  borderRadius: 8,
                  background: 'transparent',
                  pointerEvents: 'auto',
                 
                }}
              />
            </div>
            </div>
          </div>
        </div>
        
        <div className="test-timer-section">
          <div className="test-timer-box">
            <span className="timer-label">Аяқталуға қалды</span>
            <div className="timer-value">{formatTime(timeLeft)}</div>
            <span className="timer-date">
              <span style={{ color: '#1c76ae', fontWeight: '600' }}>{25}</span> сұрақтың 
              <span style={{ color: '#1c76ae', fontWeight: '600' }}> {1}</span> жауап берілді
            </span>
          </div>
          <button className="show-all-btn">Барлық сұрақты көрсету</button>
        </div>
      </div>

      {/* Вопрос */}
      <div className="question-content">
        <div className="questions-navigation">
          <div className="nav-controls">
            <button 
              className="nav-btn" 
              style={{ padding: '0' }}
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
            >
              <i className='bx bx-chevron-left' style={{ fontSize: '24px', fontWeight: '400', color: 'gray' }}></i>
            </button>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <select
                className="question-counter"
                value={currentIndex}
                onChange={(e) => setCurrentIndex(parseInt(e.target.value))}
                style={{
                  fontSize: '12px',
                  fontWeight: 400,
                  color: '#111827',
                  border: '1px solid #e5e7eb',
                  borderRadius: 4,
                  padding: '8px 26px 8px 12px',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  minWidth: 85,
                }}
              >
                {questions.length > 0 ? (
                  questions.map((_, idx) => (
                    <option key={idx} value={idx}>
                      {`Сұрақ №${idx + 1}`}
                    </option>
                  ))
                ) : (
                  [...Array(200)].map((_, idx) => (
                    <option key={idx} value={idx}>
                      {`Сұрақ №${idx + 1}`}
                    </option>
                  ))
                )}
              </select>
              <svg
                style={{
                  position: 'absolute',
                  pointerEvents: 'none',
                  right: 7,
                  top: '50%',
                  transform: 'translateY(-48%)',
                  width: 16,
                  height: 16,
                  color: '#6b7280',
                }}
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <button 
              className="nav-btn" 
              style={{ padding: '0' }}
              onClick={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))}
              disabled={currentIndex >= questions.length - 1}
            >
              <i className='bx bx-chevron-right' style={{ fontSize: '24px', fontWeight: '400', color: 'gray' }}></i>
            </button>
          </div>
          <button className="star-btn">
            <i className='bx bxs-star' style={{ color: '#fbbf24', fontSize: '18px' }}></i>
          </button>
        </div>
        
        {currentQuestion ? (
          <>
            <h4 className="question-text" dangerouslySetInnerHTML={{ __html: questionHtmlWithFixedImages }} />
            
            {/* Скрытый инпут для поиска */}
            
            
            {/* Варианты ответов */}
            <div className="answer-options">
              {currentQuestion.variants.map((variant, idx) => {
                // Проверяем, содержит ли вариант HTML (изображение формулы)
                const hasHtml = variant.text && variant.text.includes('<img');
                const fixedVariantText = hasHtml ? fixImagePaths(variant.text) : variant.text;
                
                return (
                  <label key={idx} className="answer-option">
                    <input 
                      type="radio" 
                      name="answer" 
                      checked={variant.isCorrect} 
                      readOnly 
                    />
                    <span className={`radio-custom ${variant.isCorrect ? 'correct' : ''}`}></span>
                    {hasHtml ? (
                      <span 
                        className="answer-text" 
                        dangerouslySetInnerHTML={{ __html: fixedVariantText }}
                      />
                    ) : (
                      <span className="answer-text">{variant.text}</span>
                    )}
                  </label>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <h4 className="question-text">
              Загрузка вопросов... Выберите группу, студента и предмет для начала тестирования.
            </h4>
            <div className="answer-options">
              <label className="answer-option">
                <input type="radio" name="answer" readOnly />
                <span className="radio-custom"></span>
                <span className="answer-text">Вариант 1</span>
              </label>
              <label className="answer-option">
                <input type="radio" name="answer" readOnly />
                <span className="radio-custom"></span>
                <span className="answer-text">Вариант 2</span>
              </label>
              <label className="answer-option">
                <input type="radio" name="answer" readOnly />
                <span className="radio-custom"></span>
                <span className="answer-text">Вариант 3</span>
              </label>
              <label className="answer-option">
                <input type="radio" name="answer" readOnly />
                <span className="radio-custom"></span>
                <span className="answer-text">Вариант 4</span>
              </label>
              <label className="answer-option">
                <input type="radio" name="answer" readOnly />
                <span className="radio-custom"></span>
                <span className="answer-text">Вариант 5</span>
              </label>
            </div>
          </>
        )}
        
        <div className="pagination">
          <div className="page-numbers">
            {[...Array(25)].map((_, idx) => (
              <button 
                key={idx} 
                className={`page-num ${idx < activeButtonsCount ? 'active' : ''}`}
                disabled
              >
                {idx + 1}
              </button>
            ))}
          </div>
          <button className="finish-btn">Аяқтау</button>
        </div>
       
      </div>
    </div>
  );
}

export default App
