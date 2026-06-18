-- Seed data for Campus Food Time
-- Run after 0001_initial_schema.sql

-- School
INSERT INTO schools (id, name) VALUES (1, '上海星河湾双语学校');

-- Admin user (password will be set via environment variable, this is placeholder)
INSERT INTO users (id, type, phone, password, name, school_id) VALUES
  ('admin_001', 'admin', 'admin', '1qaz!QAZ', '管理员', 1);

-- Default classes (grades 1-9, 2 classes each)
INSERT INTO classes (id, name, grade, class_number, school_id, visible) VALUES
  ('class:1:1:1', '一年级(1)班', 1, 1, 1, 1),
  ('class:1:1:2', '一年级(2)班', 1, 2, 1, 1),
  ('class:1:2:1', '二年级(1)班', 2, 1, 1, 1),
  ('class:1:2:2', '二年级(2)班', 2, 2, 1, 1),
  ('class:1:3:1', '三年级(1)班', 3, 1, 1, 1),
  ('class:1:3:2', '三年级(2)班', 3, 2, 1, 1),
  ('class:1:4:1', '四年级(1)班', 4, 1, 1, 1),
  ('class:1:4:2', '四年级(2)班', 4, 2, 1, 1),
  ('class:1:5:1', '五年级(1)班', 5, 1, 1, 1),
  ('class:1:5:2', '五年级(2)班', 5, 2, 1, 1),
  ('class:1:6:1', '六年级(1)班', 6, 1, 1, 1),
  ('class:1:6:2', '六年级(2)班', 6, 2, 1, 1),
  ('class:1:7:1', '七年级(1)班', 7, 1, 1, 1),
  ('class:1:7:2', '七年级(2)班', 7, 2, 1, 1),
  ('class:1:8:1', '八年级(1)班', 8, 1, 1, 1),
  ('class:1:8:2', '八年级(2)班', 8, 2, 1, 1),
  ('class:1:9:1', '九年级(1)班', 9, 1, 1, 1),
  ('class:1:9:2', '九年级(2)班', 9, 2, 1, 1);

-- Default semesters
INSERT INTO semesters (id, name, start_date, end_date, is_active, school_id) VALUES
  ('2025-2026-1', '2025-2026学年第一学期', '2025-09-01', '2026-01-31', 1, 1),
  ('2025-2026-2', '2025-2026学年第二学期', '2026-03-01', '2026-06-30', 0, 1);

-- System config
INSERT INTO config (key, value) VALUES
  ('school_name', '上海星河湾双语学校'),
  ('max_daily_images', '6'),
  ('max_daily_videos', '4'),
  ('max_weekly_images', '5'),
  ('image_quality', '0.8'),
  ('image_max_height', '1080'),
  ('video_max_size_mb', '100'),
  ('session_expiry_days', '30'),
  ('snapshot_keep_count', '20'),
  ('cache_ttl_seconds', '3600'),
  ('share_link_ttl_seconds', '3600');
