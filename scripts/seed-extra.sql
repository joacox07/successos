-- HABIT LOGS
INSERT INTO habit_logs (user_id, habit_id, date, completed) VALUES
(1,1,'2026-02-10',1),(1,1,'2026-02-12',1),(1,1,'2026-02-14',1),(1,1,'2026-02-17',1),(1,1,'2026-02-19',1),
(1,1,'2026-02-21',1),(1,1,'2026-02-24',1),(1,1,'2026-02-26',1),(1,1,'2026-02-28',1),(1,1,'2026-03-02',1),
(1,1,'2026-03-04',1),(1,1,'2026-03-06',1),(1,1,'2026-03-08',1),(1,1,'2026-03-10',1),(1,1,'2026-03-12',1),
(1,2,'2026-02-10',1),(1,2,'2026-02-11',1),(1,2,'2026-02-13',1),(1,2,'2026-02-14',1),(1,2,'2026-02-17',1),
(1,2,'2026-02-18',1),(1,2,'2026-02-19',1),(1,2,'2026-02-21',1),(1,2,'2026-02-25',1),(1,2,'2026-02-26',1),
(1,2,'2026-02-28',1),(1,2,'2026-03-02',1),(1,2,'2026-03-03',1),(1,2,'2026-03-04',1),(1,2,'2026-03-05',1),
(1,2,'2026-03-09',1),(1,2,'2026-03-10',1),(1,2,'2026-03-11',1),
(1,3,'2026-02-10',1),(1,3,'2026-02-11',1),(1,3,'2026-02-14',1),(1,3,'2026-02-17',1),(1,3,'2026-02-18',1),
(1,3,'2026-02-25',1),(1,3,'2026-02-26',1),(1,3,'2026-02-28',1),(1,3,'2026-03-02',1),(1,3,'2026-03-04',1),
(1,3,'2026-03-09',1),(1,3,'2026-03-11',1),
(1,4,'2026-02-17',1),(1,4,'2026-02-18',1),(1,4,'2026-02-19',1),(1,4,'2026-02-21',1),(1,4,'2026-02-25',1),
(1,4,'2026-02-26',1),(1,4,'2026-02-28',1),(1,4,'2026-03-02',1),(1,4,'2026-03-03',1),(1,4,'2026-03-04',1),
(1,4,'2026-03-05',1),(1,4,'2026-03-08',1),(1,4,'2026-03-09',1),(1,4,'2026-03-10',1),(1,4,'2026-03-11',1),
(1,5,'2026-02-10',1),(1,5,'2026-02-11',1),(1,5,'2026-02-13',1),(1,5,'2026-02-14',1),(1,5,'2026-02-16',1),
(1,5,'2026-02-17',1),(1,5,'2026-02-18',1),(1,5,'2026-02-21',1),(1,5,'2026-02-25',1),(1,5,'2026-02-26',1),
(1,5,'2026-02-27',1),(1,5,'2026-02-28',1),(1,5,'2026-03-01',1),(1,5,'2026-03-02',1),(1,5,'2026-03-03',1),
(1,5,'2026-03-04',1),(1,5,'2026-03-09',1),(1,5,'2026-03-10',1),(1,5,'2026-03-11',1),(1,5,'2026-03-12',1);

-- GOAL LOGS
INSERT INTO goal_logs (user_id, goal_id, date, action, value_change, note) VALUES
(1,1,'2026-02-10','progress',2,'Empece con 60kg'),
(1,1,'2026-02-17','progress',5,'RM 70kg'),
(1,1,'2026-02-24','progress',2,'72kg'),
(1,1,'2026-02-28','progress',1,'72kg firme'),
(1,1,'2026-03-04','progress',3,'75kg RM'),
(1,1,'2026-03-10','progress',0,'75kg consolidando'),
(1,2,'2026-02-11','progress',0,'Caps 1-2'),
(1,2,'2026-02-18','progress',0,'Cap 3'),
(1,2,'2026-02-25','progress',0,'Parcial 8'),
(1,2,'2026-03-03','progress',0,'Caps 5-6'),
(1,2,'2026-03-09','progress',0,'Cap 7 completo'),
(1,3,'2026-02-14','progress',1,'Termine Atomic Habits'),
(1,3,'2026-03-05','progress',0,'Empece Deep Work'),
(1,4,'2026-02-13','progress',0,'Presupuesto enviado'),
(1,4,'2026-02-19','progress',1,'Cliente nuevo'),
(1,4,'2026-03-04','progress',1,'Otro cliente'),
(1,5,'2026-02-22','progress',-1,'29min'),
(1,5,'2026-03-08','progress',-1,'28min'),
(1,6,'2026-02-28','progress',40000,'Cobre proyecto'),
(1,6,'2026-03-11','progress',30000,'Ahorre 30K');

-- STUDY SESSIONS
INSERT INTO study_sessions (user_id, date, method, focus_minutes, break_minutes, cycles_completed, quality, started_at, ended_at) VALUES
(1,'2026-02-10','pomodoro',90,20,3,8,'2026-02-10 09:00','2026-02-10 11:00'),
(1,'2026-02-11','flow',120,0,1,9,'2026-02-11 08:30','2026-02-11 10:30'),
(1,'2026-02-13','pomodoro',75,15,3,7,'2026-02-13 10:00','2026-02-13 11:30'),
(1,'2026-02-17','531',60,0,3,8,'2026-02-17 14:00','2026-02-17 15:00'),
(1,'2026-02-18','pomodoro',90,20,3,7,'2026-02-18 09:00','2026-02-18 11:00'),
(1,'2026-02-21','flow',105,0,1,8,'2026-02-21 08:00','2026-02-21 09:45'),
(1,'2026-02-25','flow',150,0,1,10,'2026-02-25 07:00','2026-02-25 09:30'),
(1,'2026-02-26','pomodoro',75,15,3,7,'2026-02-26 10:00','2026-02-26 11:30'),
(1,'2026-02-28','531',90,0,3,9,'2026-02-28 09:00','2026-02-28 10:30'),
(1,'2026-03-02','flow',135,0,1,9,'2026-03-02 07:30','2026-03-02 09:45'),
(1,'2026-03-03','pomodoro',90,20,3,7,'2026-03-03 10:00','2026-03-03 12:00'),
(1,'2026-03-04','531',90,0,3,10,'2026-03-04 08:00','2026-03-04 09:30'),
(1,'2026-03-05','pomodoro',75,15,3,7,'2026-03-05 10:00','2026-03-05 11:30'),
(1,'2026-03-09','flow',135,0,1,9,'2026-03-09 07:00','2026-03-09 09:15'),
(1,'2026-03-10','pomodoro',75,15,3,7,'2026-03-10 10:00','2026-03-10 11:30'),
(1,'2026-03-11','flow',120,0,1,8,'2026-03-11 08:00','2026-03-11 10:00'),
(1,'2026-03-12','pomodoro',60,10,2,7,'2026-03-12 10:00','2026-03-12 11:10');

-- PATTERNS (correlaciones) - using actual schema: pattern_type, area_a, area_b, description, correlation, data_points, confidence
DELETE FROM patterns WHERE user_id = 1;
INSERT INTO patterns (user_id, pattern_type, area_a, area_b, description, correlation, data_points, confidence) VALUES
(1,'correlation','exercise','mood','Los dias que vas al gym tu mood promedio es 7.8 vs 6.2 sin gym (+26%)',0.72,30,0.85),
(1,'correlation','sleep','energy','Dormir antes de 23:00 = energia 8.0 vs 5.5 (+45%)',0.68,30,0.80),
(1,'correlation','procrastination','focus','Procrastinacion: mood 5.5 focus 0.8hs. Sin: mood 7.6 focus 3.3hs',-0.78,30,0.90),
(1,'correlation','meditation','focus','Meditar correlaciona con +1.2 puntos de focus hours',0.55,30,0.70),
(1,'trend','bench_press','fitness','Press plano: 60kg a 75kg en 30 dias (+25%). Ritmo: 100kg en ~2 meses',0.95,6,0.75),
(1,'trend','focus','productivity','Horas foco semanales: Sem1 2.5hs/dia a Sem4 3.2hs/dia (+28%)',0.85,30,0.80),
(1,'correlation','weekend','productivity','Fines de semana productividad baja 60%. Mejores dias: martes y jueves',-0.65,30,0.85),
(1,'correlation','alcohol','mood','Alcohol noche anterior = -2.3 mood y -1.8 energia al dia siguiente',-0.82,8,0.88),
(1,'trend','habits','consistency','Consistencia habitos: Sem1 40% a Sem4 73% (+33 puntos)',0.88,30,0.82),
(1,'insight','combo','score','Mejor combo: gym + dormir antes 23:00 + no redes = score 8.7/10',0.90,12,0.90);

-- Update goals current values
UPDATE goals SET current_value = 75 WHERE id = 1;
UPDATE goals SET current_value = 3 WHERE id = 3;
UPDATE goals SET current_value = 2 WHERE id = 4;
UPDATE goals SET current_value = 28 WHERE id = 5;
UPDATE goals SET current_value = 180000 WHERE id = 6;
