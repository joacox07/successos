-- Seed 30 days of realistic data for SuccessOS visual testing
-- User ID: 1

-- Clean existing seed data (keep real data before Feb 18)
DELETE FROM daily_entries WHERE user_id = 1 AND date >= '2026-02-18';
DELETE FROM habit_logs WHERE user_id = 1 AND date >= '2026-02-18';
DELETE FROM goal_logs WHERE user_id = 1 AND date >= '2026-02-18';
DELETE FROM study_sessions WHERE user_id = 1 AND date >= '2026-02-18';
DELETE FROM patterns WHERE user_id = 1;
DELETE FROM sent_checkins WHERE user_id = 1 AND date >= '2026-02-18';

-- ══════════════════════════════════════════════════
-- DAILY ENTRIES (30 days: Feb 18 → Mar 19)
-- Realistic pattern: weekdays productive, weekends relaxed
-- ══════════════════════════════════════════════════

INSERT INTO daily_entries (user_id, date, sleep_quality, wake_time, bedtime, energy_level, mood, exercise_done, exercise_type, exercise_duration, diet_quality, focus_hours, tasks_completed, procrastination, day_rating, overall_score, biggest_win, emotional_state, goal_progress) VALUES
-- Week 1 (Feb 18-24) - Starting strong
(1, '2026-02-18', 7, '07:00', '23:30', 7, 7, 1, 'gym', 60, 7, 5.5, 4, 0, 7, 72, 'Cerré propuesta con cliente nuevo', 'motivado', '{"1": "envié 2 propuestas", "4": "leí 40 páginas"}'),
(1, '2026-02-19', 8, '06:45', '23:00', 8, 8, 1, 'correr', 35, 8, 6.0, 5, 0, 8, 80, 'Corrí 5K en 27 min', 'energético', '{"9": "5K en 27:12"}'),
(1, '2026-02-20', 6, '07:30', '00:00', 6, 6, 0, NULL, NULL, 6, 4.0, 3, 1, 6, 58, NULL, 'cansado', '{"1": "llamada con potencial cliente"}'),
(1, '2026-02-21', 7, '07:00', '23:15', 7, 7, 1, 'gym', 75, 7, 5.0, 4, 0, 7, 70, 'PR en press de banca', 'determinado', '{"2": "medí body fat 18.5%"}'),
(1, '2026-02-22', 8, '06:30', '22:45', 8, 8, 1, 'gym', 60, 8, 6.5, 6, 0, 9, 85, 'Facturé 350K en un día', 'excelente', '{"1": "facturé 350K", "3": "ahorré 50 USD"}'),
(1, '2026-02-23', 6, '09:00', '01:00', 5, 6, 0, NULL, NULL, 5, 1.0, 1, 1, 5, 45, 'Descansé bien', 'relajado', NULL),
(1, '2026-02-24', 7, '08:30', '23:30', 6, 7, 1, 'correr', 30, 6, 2.0, 2, 0, 6, 55, 'Corrí liviano', 'tranquilo', '{"4": "leí 25 páginas"}'),

-- Week 2 (Feb 25 - Mar 3) - Building momentum
(1, '2026-02-25', 8, '06:45', '23:00', 8, 8, 1, 'gym', 70, 8, 6.0, 5, 0, 8, 82, 'Empecé proyecto grande', 'enfocado', '{"1": "nuevo proyecto $800K"}'),
(1, '2026-02-26', 7, '07:00', '23:30', 7, 7, 1, 'correr', 40, 7, 5.5, 4, 0, 7, 74, 'Corrí 5K en 26:45', 'contento', '{"9": "5K en 26:45"}'),
(1, '2026-02-27', 7, '07:15', '23:15', 7, 6, 1, 'gym', 60, 7, 5.0, 4, 1, 7, 68, NULL, 'normal', '{"1": "avancé en proyecto"}'),
(1, '2026-02-28', 8, '06:30', '22:45', 8, 8, 1, 'gym', 65, 8, 7.0, 6, 0, 9, 88, 'Mejor día del mes', 'inspirado', '{"1": "facturé 450K", "3": "ahorré 100 USD"}'),
(1, '2026-03-01', 5, '08:00', '01:30', 4, 5, 0, NULL, NULL, 5, 2.0, 2, 1, 5, 40, NULL, 'agotado', NULL),
(1, '2026-03-02', 6, '09:30', '00:30', 5, 6, 0, NULL, NULL, 6, 1.0, 1, 0, 5, 42, 'Descansé', 'recuperando', '{"4": "leí 50 páginas terminé libro"}'),
(1, '2026-03-03', 7, '07:00', '23:00', 7, 7, 1, 'gym', 60, 7, 5.5, 5, 0, 7, 73, 'Volví con todo', 'motivado', '{"1": "2 reuniones productivas"}'),

-- Week 3 (Mar 4-10) - Peak performance
(1, '2026-03-04', 8, '06:30', '22:30', 9, 8, 1, 'gym', 75, 8, 7.0, 6, 0, 9, 90, 'Día perfecto casi', 'flow', '{"1": "cerré contrato 600K", "3": "ahorré 150 USD"}'),
(1, '2026-03-05', 7, '07:00', '23:00', 7, 7, 1, 'correr', 35, 7, 6.0, 5, 0, 8, 78, 'Corrí bien', 'estable', '{"9": "5K en 26:20"}'),
(1, '2026-03-06', 8, '06:45', '23:00', 8, 8, 1, 'gym', 70, 8, 6.5, 5, 0, 8, 83, 'Buena semana', 'positivo', '{"1": "avancé proyecto", "4": "leí 30 pag"}'),
(1, '2026-03-07', 6, '07:30', '00:00', 6, 6, 1, 'gym', 45, 6, 4.5, 3, 1, 6, 60, NULL, 'cansado', '{"2": "midió 18%"}'),
(1, '2026-03-08', 7, '07:00', '23:00', 7, 8, 1, 'correr', 40, 7, 5.0, 4, 0, 8, 76, 'PR en 5K: 25:50!', 'eufórico', '{"9": "5K en 25:50!"}'),
(1, '2026-03-09', 5, '10:00', '02:00', 4, 5, 0, NULL, NULL, 4, 0.5, 0, 1, 4, 32, 'Salí con amigos', 'resaca', NULL),
(1, '2026-03-10', 6, '08:00', '23:30', 6, 6, 1, 'caminar', 30, 6, 3.0, 3, 0, 6, 52, 'Me recuperé', 'neutral', '{"4": "leí 20 pag"}'),

-- Week 4 (Mar 11-17) - Consistent
(1, '2026-03-11', 7, '07:00', '23:00', 7, 7, 1, 'gym', 65, 7, 5.5, 5, 0, 7, 74, 'Semana productiva empieza', 'determinado', '{"1": "3 propuestas enviadas"}'),
(1, '2026-03-12', 8, '06:30', '22:30', 8, 8, 1, 'gym', 70, 8, 6.5, 5, 0, 8, 84, 'Gran día de facturación', 'excelente', '{"1": "facturé 500K", "3": "ahorré 100 USD"}'),
(1, '2026-03-13', 7, '07:00', '23:15', 7, 7, 1, 'correr', 35, 7, 5.0, 4, 0, 7, 72, 'Corrí consistente', 'estable', '{"9": "5K en 26:00"}'),
(1, '2026-03-14', 6, '07:30', '00:00', 6, 6, 1, 'gym', 55, 6, 4.0, 3, 1, 6, 58, NULL, 'meh', '{"4": "leí 35 pag"}'),
(1, '2026-03-15', 8, '06:45', '22:45', 8, 9, 1, 'gym', 75, 9, 7.0, 6, 0, 9, 92, 'Mejor día del proyecto', 'increíble', '{"1": "facturé 700K!!", "3": "ahorré 200 USD"}'),
(1, '2026-03-16', 6, '09:00', '01:00', 5, 6, 0, NULL, NULL, 5, 1.5, 1, 0, 5, 44, 'Día libre merecido', 'relajado', '{"4": "terminé libro 8"}'),
(1, '2026-03-17', 7, '07:30', '23:30', 7, 7, 1, 'correr', 30, 7, 4.0, 3, 0, 7, 66, 'Vuelta al ruedo', 'normal', '{"9": "5K en 25:40"}'),

-- Week 5 (Mar 18-19)
(1, '2026-03-18', 8, '06:30', '22:30', 8, 8, 1, 'gym', 70, 8, 6.0, 5, 0, 8, 82, 'Arranqué fuerte la semana', 'motivado', '{"1": "2 reuniones cerradas", "3": "ahorré 100 USD"}'),
(1, '2026-03-19', 7, '07:00', '23:00', 7, 7, 1, 'gym', 60, 7, 5.5, 4, 0, 7, 75, 'Buen día productivo', 'enfocado', '{"1": "avancé en proyecto grande"}');

-- ══════════════════════════════════════════════════
-- HABIT LOGS (30 days)
-- Habits: 1=Gym, 2=Meditar, 3=Leer, 4=No redes, 5=Rezar, 6=Journaling, 7=Ejercicio, 8=Agua 2L, 9=Rosario
-- Realistic: ~70-80% completion, weekends lower
-- ══════════════════════════════════════════════════

-- Feb 18 (Tue)
INSERT INTO habit_logs (habit_id, user_id, date, completed) VALUES
(1,1,'2026-02-18',1),(2,1,'2026-02-18',1),(3,1,'2026-02-18',1),(5,1,'2026-02-18',1),(6,1,'2026-02-18',1),(7,1,'2026-02-18',1),(8,1,'2026-02-18',1),(9,1,'2026-02-18',1),
-- Feb 19 (Wed)
(1,1,'2026-02-19',1),(2,1,'2026-02-19',1),(3,1,'2026-02-19',1),(4,1,'2026-02-19',1),(5,1,'2026-02-19',1),(7,1,'2026-02-19',1),(8,1,'2026-02-19',1),(9,1,'2026-02-19',1),
-- Feb 20 (Thu) - tired day
(2,1,'2026-02-20',1),(3,1,'2026-02-20',1),(5,1,'2026-02-20',1),(8,1,'2026-02-20',1),
-- Feb 21 (Fri)
(1,1,'2026-02-21',1),(2,1,'2026-02-21',1),(3,1,'2026-02-21',1),(4,1,'2026-02-21',1),(5,1,'2026-02-21',1),(6,1,'2026-02-21',1),(7,1,'2026-02-21',1),(8,1,'2026-02-21',1),(9,1,'2026-02-21',1),
-- Feb 22 (Sat) - great day
(1,1,'2026-02-22',1),(2,1,'2026-02-22',1),(4,1,'2026-02-22',1),(5,1,'2026-02-22',1),(7,1,'2026-02-22',1),(8,1,'2026-02-22',1),(9,1,'2026-02-22',1),
-- Feb 23 (Sun) - rest day
(5,1,'2026-02-23',1),(9,1,'2026-02-23',1),(8,1,'2026-02-23',1),
-- Feb 24 (Sun)
(3,1,'2026-02-24',1),(5,1,'2026-02-24',1),(7,1,'2026-02-24',1),(8,1,'2026-02-24',1),(9,1,'2026-02-24',1),
-- Feb 25 (Tue)
(1,1,'2026-02-25',1),(2,1,'2026-02-25',1),(3,1,'2026-02-25',1),(4,1,'2026-02-25',1),(5,1,'2026-02-25',1),(6,1,'2026-02-25',1),(7,1,'2026-02-25',1),(8,1,'2026-02-25',1),(9,1,'2026-02-25',1),
-- Feb 26 (Wed)
(1,1,'2026-02-26',1),(2,1,'2026-02-26',1),(3,1,'2026-02-26',1),(5,1,'2026-02-26',1),(6,1,'2026-02-26',1),(7,1,'2026-02-26',1),(8,1,'2026-02-26',1),(9,1,'2026-02-26',1),
-- Feb 27 (Thu)
(1,1,'2026-02-27',1),(2,1,'2026-02-27',1),(4,1,'2026-02-27',1),(5,1,'2026-02-27',1),(7,1,'2026-02-27',1),(8,1,'2026-02-27',1),(9,1,'2026-02-27',1),
-- Feb 28 (Fri) - best day
(1,1,'2026-02-28',1),(2,1,'2026-02-28',1),(3,1,'2026-02-28',1),(4,1,'2026-02-28',1),(5,1,'2026-02-28',1),(6,1,'2026-02-28',1),(7,1,'2026-02-28',1),(8,1,'2026-02-28',1),(9,1,'2026-02-28',1),
-- Mar 1 (Sat) - exhausted
(5,1,'2026-03-01',1),(8,1,'2026-03-01',1),
-- Mar 2 (Sun)
(3,1,'2026-03-02',1),(5,1,'2026-03-02',1),(8,1,'2026-03-02',1),(9,1,'2026-03-02',1),
-- Mar 3 (Mon)
(1,1,'2026-03-03',1),(2,1,'2026-03-03',1),(3,1,'2026-03-03',1),(4,1,'2026-03-03',1),(5,1,'2026-03-03',1),(6,1,'2026-03-03',1),(7,1,'2026-03-03',1),(8,1,'2026-03-03',1),(9,1,'2026-03-03',1),
-- Mar 4 (Tue) - peak
(1,1,'2026-03-04',1),(2,1,'2026-03-04',1),(3,1,'2026-03-04',1),(4,1,'2026-03-04',1),(5,1,'2026-03-04',1),(6,1,'2026-03-04',1),(7,1,'2026-03-04',1),(8,1,'2026-03-04',1),(9,1,'2026-03-04',1),
-- Mar 5 (Wed)
(1,1,'2026-03-05',1),(2,1,'2026-03-05',1),(3,1,'2026-03-05',1),(5,1,'2026-03-05',1),(7,1,'2026-03-05',1),(8,1,'2026-03-05',1),(9,1,'2026-03-05',1),
-- Mar 6 (Thu)
(1,1,'2026-03-06',1),(2,1,'2026-03-06',1),(3,1,'2026-03-06',1),(4,1,'2026-03-06',1),(5,1,'2026-03-06',1),(6,1,'2026-03-06',1),(7,1,'2026-03-06',1),(8,1,'2026-03-06',1),(9,1,'2026-03-06',1),
-- Mar 7 (Fri) - tired
(1,1,'2026-03-07',1),(5,1,'2026-03-07',1),(7,1,'2026-03-07',1),(8,1,'2026-03-07',1),(9,1,'2026-03-07',1),
-- Mar 8 (Sat) - running PR
(2,1,'2026-03-08',1),(5,1,'2026-03-08',1),(7,1,'2026-03-08',1),(8,1,'2026-03-08',1),(9,1,'2026-03-08',1),(3,1,'2026-03-08',1),
-- Mar 9 (Sun) - hangover
(9,1,'2026-03-09',1),
-- Mar 10 (Mon) - recovery
(2,1,'2026-03-10',1),(3,1,'2026-03-10',1),(5,1,'2026-03-10',1),(7,1,'2026-03-10',1),(8,1,'2026-03-10',1),(9,1,'2026-03-10',1),
-- Mar 11 (Tue)
(1,1,'2026-03-11',1),(2,1,'2026-03-11',1),(3,1,'2026-03-11',1),(4,1,'2026-03-11',1),(5,1,'2026-03-11',1),(6,1,'2026-03-11',1),(7,1,'2026-03-11',1),(8,1,'2026-03-11',1),(9,1,'2026-03-11',1),
-- Mar 12 (Wed)
(1,1,'2026-03-12',1),(2,1,'2026-03-12',1),(3,1,'2026-03-12',1),(4,1,'2026-03-12',1),(5,1,'2026-03-12',1),(6,1,'2026-03-12',1),(7,1,'2026-03-12',1),(8,1,'2026-03-12',1),(9,1,'2026-03-12',1),
-- Mar 13 (Thu)
(1,1,'2026-03-13',1),(2,1,'2026-03-13',1),(3,1,'2026-03-13',1),(5,1,'2026-03-13',1),(7,1,'2026-03-13',1),(8,1,'2026-03-13',1),(9,1,'2026-03-13',1),
-- Mar 14 (Fri) - meh
(1,1,'2026-03-14',1),(3,1,'2026-03-14',1),(5,1,'2026-03-14',1),(7,1,'2026-03-14',1),(8,1,'2026-03-14',1),
-- Mar 15 (Sat) - best day
(1,1,'2026-03-15',1),(2,1,'2026-03-15',1),(3,1,'2026-03-15',1),(4,1,'2026-03-15',1),(5,1,'2026-03-15',1),(6,1,'2026-03-15',1),(7,1,'2026-03-15',1),(8,1,'2026-03-15',1),(9,1,'2026-03-15',1),
-- Mar 16 (Sun) - off
(3,1,'2026-03-16',1),(5,1,'2026-03-16',1),(8,1,'2026-03-16',1),(9,1,'2026-03-16',1),
-- Mar 17 (Mon)
(2,1,'2026-03-17',1),(5,1,'2026-03-17',1),(7,1,'2026-03-17',1),(8,1,'2026-03-17',1),(9,1,'2026-03-17',1),(3,1,'2026-03-17',1),
-- Mar 18 (Tue)
(1,1,'2026-03-18',1),(2,1,'2026-03-18',1),(3,1,'2026-03-18',1),(4,1,'2026-03-18',1),(5,1,'2026-03-18',1),(6,1,'2026-03-18',1),(7,1,'2026-03-18',1),(8,1,'2026-03-18',1),(9,1,'2026-03-18',1),
-- Mar 19 (Wed)
(1,1,'2026-03-19',1),(2,1,'2026-03-19',1),(3,1,'2026-03-19',1),(5,1,'2026-03-19',1),(6,1,'2026-03-19',1),(7,1,'2026-03-19',1),(8,1,'2026-03-19',1),(9,1,'2026-03-19',1);

-- ══════════════════════════════════════════════════
-- GOAL LOGS (progressive advancement)
-- ══════════════════════════════════════════════════

-- Goal 1: Facturar 5M ARS/mes (current: 2.1M → building up)
INSERT INTO goal_logs (goal_id, user_id, date, action, value_change, note) VALUES
(1,1,'2026-02-18','progress',150000,'2 propuestas enviadas'),
(1,1,'2026-02-22','progress',350000,'Facturación del día'),
(1,1,'2026-02-25','progress',200000,'Nuevo proyecto iniciado'),
(1,1,'2026-02-28','progress',450000,'Gran día de facturación'),
(1,1,'2026-03-04','progress',600000,'Cerré contrato importante'),
(1,1,'2026-03-08','progress',100000,'Pagos recibidos'),
(1,1,'2026-03-12','progress',500000,'Facturación fuerte'),
(1,1,'2026-03-15','progress',700000,'Mejor día del mes'),
(1,1,'2026-03-18','progress',300000,'2 reuniones cerradas'),
(1,1,'2026-03-19','progress',150000,'Avance en proyecto');

-- Goal 2: Bajar a 15% BF (current: 19% → 17.8%)
INSERT INTO goal_logs (goal_id, user_id, date, action, value_change, note) VALUES
(2,1,'2026-02-21','measurement',-0.5,'Medición: 18.5%'),
(2,1,'2026-03-01','measurement',-0.3,'Medición: 18.2%'),
(2,1,'2026-03-07','measurement',-0.2,'Medición: 18.0%'),
(2,1,'2026-03-14','measurement',-0.2,'Medición: 17.8%');

-- Goal 3: Ahorrar 2000 USD (current: 850 → 1400)
INSERT INTO goal_logs (goal_id, user_id, date, action, value_change, note) VALUES
(3,1,'2026-02-22','deposit',50,'Ahorro semanal'),
(3,1,'2026-02-28','deposit',100,'Ahorro quincenal'),
(3,1,'2026-03-04','deposit',150,'Buen mes'),
(3,1,'2026-03-12','deposit',100,'Ahorro semanal'),
(3,1,'2026-03-15','deposit',200,'Ahorro extra'),
(3,1,'2026-03-18','deposit',100,'Ahorro semanal');

-- Goal 4: Leer 24 libros (current: 7 → 9)
INSERT INTO goal_logs (goal_id, user_id, date, action, value_change, note) VALUES
(4,1,'2026-03-02','completed',1,'Terminé "Atomic Habits"'),
(4,1,'2026-03-16','completed',1,'Terminé "Deep Work"');

-- Goal 5: Meditar 30 días seguidos (current: 12 → tracking streak)
INSERT INTO goal_logs (goal_id, user_id, date, action, value_change, note) VALUES
(5,1,'2026-02-18','streak',1,'Día 1 del streak'),
(5,1,'2026-02-25','streak',7,'7 días seguidos'),
(5,1,'2026-03-01','reset',0,'Rompí el streak (día agotado)'),
(5,1,'2026-03-03','streak',1,'Nuevo streak'),
(5,1,'2026-03-10','streak',7,'7 días de nuevo'),
(5,1,'2026-03-17','streak',14,'2 semanas seguidas!');

-- Goal 9: Correr 5K < 25min (current: 28min → 25:40)
INSERT INTO goal_logs (goal_id, user_id, date, action, value_change, note) VALUES
(9,1,'2026-02-19','run',-0.8,'5K en 27:12'),
(9,1,'2026-02-26','run',-0.5,'5K en 26:45'),
(9,1,'2026-03-05','run',-0.4,'5K en 26:20'),
(9,1,'2026-03-08','run',-0.5,'5K en 25:50 - PR!'),
(9,1,'2026-03-13','run',-0.2,'5K en 26:00'),
(9,1,'2026-03-17','run',-0.3,'5K en 25:40 - nuevo PR!');

-- Update current values on goals
UPDATE goals SET current_value = '3500000' WHERE id = 1;
UPDATE goals SET current_value = '17.8' WHERE id = 2;
UPDATE goals SET current_value = '1400' WHERE id = 3;
UPDATE goals SET current_value = '9' WHERE id = 4;
UPDATE goals SET current_value = '14' WHERE id = 5;
UPDATE goals SET current_value = '25.67' WHERE id = 9;

-- ══════════════════════════════════════════════════
-- STUDY SESSIONS (Pomodoro & Flow)
-- ══════════════════════════════════════════════════

INSERT INTO study_sessions (user_id, date, method, subject, focus_minutes, break_minutes, cycles_completed, quality, note, started_at, ended_at) VALUES
(1,'2026-02-18','pomodoro','Negocio - propuestas',100,20,4,8,'Buena sesión de propuestas','2026-02-18 09:00:00','2026-02-18 11:00:00'),
(1,'2026-02-19','flow','Lectura',45,0,1,7,'Lectura concentrada','2026-02-19 21:00:00','2026-02-19 21:45:00'),
(1,'2026-02-22','pomodoro','Negocio - facturación',125,25,5,9,'Súper productivo','2026-02-22 08:00:00','2026-02-22 10:30:00'),
(1,'2026-02-25','pomodoro','Negocio - proyecto nuevo',100,20,4,8,'Arranqué proyecto','2026-02-25 09:00:00','2026-02-25 11:00:00'),
(1,'2026-02-28','flow','Negocio',90,0,1,9,'Flow state total','2026-02-28 09:00:00','2026-02-28 10:30:00'),
(1,'2026-03-03','pomodoro','Negocio',75,15,3,7,'Reuniones + trabajo','2026-03-03 10:00:00','2026-03-03 11:30:00'),
(1,'2026-03-04','pomodoro','Negocio - contrato',125,25,5,9,'Cerré contrato grande','2026-03-04 08:30:00','2026-03-04 11:00:00'),
(1,'2026-03-06','flow','Lectura',60,0,1,8,'Lectura Deep Work','2026-03-06 21:00:00','2026-03-06 22:00:00'),
(1,'2026-03-11','pomodoro','Negocio - propuestas',100,20,4,8,'3 propuestas','2026-03-11 09:00:00','2026-03-11 11:00:00'),
(1,'2026-03-12','pomodoro','Negocio - facturación',100,20,4,9,'Día productivo','2026-03-12 09:00:00','2026-03-12 11:00:00'),
(1,'2026-03-14','flow','Lectura',50,0,1,6,'Lectura pero distraído','2026-03-14 21:00:00','2026-03-14 21:50:00'),
(1,'2026-03-15','pomodoro','Negocio',150,30,6,10,'Mejor sesión del mes','2026-03-15 08:00:00','2026-03-15 11:00:00'),
(1,'2026-03-18','pomodoro','Negocio',100,20,4,8,'Arranque de semana','2026-03-18 09:00:00','2026-03-18 11:00:00'),
(1,'2026-03-19','flow','Negocio - proyecto',75,0,1,7,'Avance en proyecto','2026-03-19 14:00:00','2026-03-19 15:15:00');

-- ══════════════════════════════════════════════════
-- PATTERNS (detected correlations)
-- ══════════════════════════════════════════════════

INSERT INTO patterns (user_id, pattern_type, area_a, area_b, description, correlation, data_points, confidence, active) VALUES
(1,'correlation','sleep_quality','productivity','Cuando dormís 7+ horas, tu productividad sube 35%. Los días con <6hs, completás la mitad de tareas.',0.82,25,0.9,1),
(1,'correlation','exercise','mood','Los días que entrenás, tu mood promedio es 7.5 vs 5.5 los días sin ejercicio. El gym tiene más impacto que correr.',0.78,28,0.88,1),
(1,'correlation','meditation','focus_hours','Las mañanas que meditás, lográs 1.5hs más de foco. El efecto es mayor cuando meditás antes de las 8am.',0.71,20,0.85,1),
(1,'trend','facturacion','','Tu facturación viene creciendo 15% semana a semana. Si mantenés este ritmo, llegás a 5M en abril.',0,12,0.8,1),
(1,'insight','weekends','productivity','Los domingos son tu punto débil: 0 hábitos completados en promedio. Considerá un set mínimo de 3 hábitos para domingos.',0,8,0.75,1),
(1,'correlation','diet_quality','energy_level','Los días con dieta 8+ tenés 30% más energía al día siguiente. La comida chatarra te baja la energía por 2 días.',0.68,22,0.82,1);

-- ══════════════════════════════════════════════════
-- SENT CHECKINS (so scheduler doesn't resend)
-- ══════════════════════════════════════════════════

INSERT INTO sent_checkins (user_id, checkin_type, date, sent_at) VALUES
(1,'morning','2026-03-19','2026-03-19 07:00:00'),
(1,'evening','2026-03-19','2026-03-19 22:00:00'),
(1,'morning','2026-03-20','2026-03-20 07:00:00');
