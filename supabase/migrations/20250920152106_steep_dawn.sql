-- =============================================
-- TRACKADEMY ACADEMIC MANAGEMENT SYSTEM
-- Postgres (12+) — Full Migration (drop-in)
-- Converts your previous MySQL-style migration to Postgres
-- - Uses pgcrypto gen_random_uuid()
-- - Creates enum types
-- - Adds trigger for updated_at timestamps
-- - Uses timestamptz for timestamps
-- - Replaces is_email_verified with is_password_changed
-- - Faculties.head_name (plain text), no head_profile_id on departments
-- Created: 2025-09-26
-- =============================================

-- 0) Extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) ENUM types
DO $$
BEGIN
  -- roles / user types
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_enum') THEN
    CREATE TYPE role_enum AS ENUM('student','lecturer','admin','exam_officer');
  END IF;

  -- faculty/department/program/course statuses
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'faculty_status_enum') THEN
    CREATE TYPE faculty_status_enum AS ENUM('active','inactive');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dept_status_enum') THEN
    CREATE TYPE dept_status_enum AS ENUM('active','inactive');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'program_status_enum') THEN
    CREATE TYPE program_status_enum AS ENUM('active','inactive');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'course_status_enum') THEN
    CREATE TYPE course_status_enum AS ENUM('active','inactive');
  END IF;

  -- student enums
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_enum') THEN
    CREATE TYPE gender_enum AS ENUM('male','female','other');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'marital_status_enum') THEN
    CREATE TYPE marital_status_enum AS ENUM('single','married','divorced','widowed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'student_status_enum') THEN
    CREATE TYPE student_status_enum AS ENUM('active','inactive','graduated','suspended');
  END IF;

  -- lecturer enums
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lecturer_status_enum') THEN
    CREATE TYPE lecturer_status_enum AS ENUM('active','inactive');
  END IF;

  -- semester enum used in course
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'semester_enum') THEN
    CREATE TYPE semester_enum AS ENUM('1','2','Summer');
  END IF;

  -- enrollment
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_status_enum') THEN
    CREATE TYPE enrollment_status_enum AS ENUM('enrolled','dropped','completed');
  END IF;

  -- assessment
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assessment_type_enum') THEN
    CREATE TYPE assessment_type_enum AS ENUM('class_test','assignment','project','mid_term','final_exam','practical','quiz');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assessment_status_enum') THEN
    CREATE TYPE assessment_status_enum AS ENUM('draft','published','completed');
  END IF;

  -- attendance/session
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status_enum') THEN
    CREATE TYPE attendance_status_enum AS ENUM('present','absent','late','excused');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status_enum') THEN
    CREATE TYPE session_status_enum AS ENUM('scheduled','completed','cancelled');
  END IF;

  -- exam eligibility rule types
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'exam_rule_type_enum') THEN
    CREATE TYPE exam_rule_type_enum AS ENUM('assessment_threshold','attendance_threshold','prerequisite_completion');
  END IF;

  -- events
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type_enum') THEN
    CREATE TYPE event_type_enum AS ENUM('lecture','exam','assignment_due','holiday','meeting','workshop','seminar');
  END IF;

  -- announcements / communications
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'announcement_priority_enum') THEN
    CREATE TYPE announcement_priority_enum AS ENUM('low','medium','high','urgent');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'announcement_target_enum') THEN
    CREATE TYPE announcement_target_enum AS ENUM('all','students','lecturers','specific_course','specific_program');
  END IF;

  -- notification types
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notif_type_enum') THEN
    CREATE TYPE notif_type_enum AS ENUM('info','warning','error','success');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_category_enum') THEN
    CREATE TYPE notification_category_enum AS ENUM('academic','administrative','system','personal');
  END IF;

  -- report/type & file formats
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_type_enum') THEN
    CREATE TYPE report_type_enum AS ENUM('student_performance','attendance','course_analytics','faculty_summary','exam_eligibility');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'file_format_enum') THEN
    CREATE TYPE file_format_enum AS ENUM('pdf','excel','csv');
  END IF;

  -- transcript type
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transcript_type_enum') THEN
    CREATE TYPE transcript_type_enum AS ENUM('official','unofficial','interim');
  END IF;
END $$;

-- 2) updated_at trigger helper
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================
-- CORE SYSTEM TABLES
-- =============================================

-- Users (authentication / accounts)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_number VARCHAR(20) UNIQUE NOT NULL, -- STU001, LEC001, ADM001
    email varchar(320),
    password_hash TEXT NOT NULL,
    role role_enum NOT NULL DEFAULT 'student',
    is_active BOOLEAN DEFAULT true,
    is_password_changed BOOLEAN DEFAULT false, -- requested change
    last_login timestamptz,
    password_reset_token TEXT,
    password_reset_expires timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_user_number ON users(user_number);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- System Settings (renamed from system_settings to system_configuration for clarity)
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_category VARCHAR(50),
    description TEXT,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Activity logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    activity_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    ip_address inet,
    user_agent TEXT,
    created_at timestamptz DEFAULT now(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);


-- =============================================
-- ORGANIZATIONAL STRUCTURE TABLES
-- =============================================

-- Faculties
CREATE TABLE IF NOT EXISTS faculties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(10) UNIQUE NOT NULL,
    head_name VARCHAR(255), -- plain text name field as requested
    email VARCHAR(255),
    phone VARCHAR(20),
    location VARCHAR(255),
    established_year INTEGER,
    annual_budget NUMERIC(15,2),
    status faculty_status_enum DEFAULT 'active',
    description TEXT,
    vision TEXT,
    mission TEXT,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Departments (no head_profile_id)
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faculty_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    head_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    location VARCHAR(255),
    established_year INTEGER,
    annual_budget NUMERIC(15,2),
    status dept_status_enum DEFAULT 'active',
    description TEXT,
    vision TEXT,
    mission TEXT,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    FOREIGN KEY (faculty_id) REFERENCES faculties(id) ON DELETE CASCADE,
    UNIQUE (faculty_id, code)
);

-- Programs
CREATE TABLE IF NOT EXISTS programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(15) UNIQUE NOT NULL,
    level VARCHAR(50) NOT NULL,
    duration VARCHAR(50) NOT NULL,
    total_credits INTEGER,
    delivery_mode VARCHAR(50) DEFAULT 'Full-time',
    coordinator_name VARCHAR(255),
    max_students INTEGER DEFAULT 100,
    annual_tuition_fee NUMERIC(12,2),
    application_deadline DATE,
    start_date DATE,
    accreditation VARCHAR(255),
    established_year INTEGER,
    status program_status_enum DEFAULT 'active',
    description TEXT,
    admission_requirements TEXT,
    career_prospects TEXT,
    vision TEXT,
    mission TEXT,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
);


-- =============================================
-- PEOPLE TABLES
-- =============================================

-- Students
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL,
    student_number VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    gender gender_enum,
    id_number VARCHAR(20) UNIQUE,
    marital_status marital_status_enum,
    home_language VARCHAR(50),
    citizenship VARCHAR(100),
    date_of_birth DATE,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    program_id UUID NOT NULL,
    year_of_study INTEGER DEFAULT 1,
    enrollment_date DATE DEFAULT CURRENT_DATE,
    graduation_date DATE,
    status student_status_enum DEFAULT 'active',
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_students_student_number ON students(student_number);
CREATE INDEX IF NOT EXISTS idx_students_program_id ON students(program_id);
CREATE INDEX IF NOT EXISTS idx_students_year_of_study ON students(year_of_study);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);

-- Lecturers
CREATE TABLE IF NOT EXISTS lecturers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL,
    lecturer_number VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    office_location VARCHAR(255),
    position VARCHAR(100) NOT NULL,
    qualification VARCHAR(100) NOT NULL,
    specialization VARCHAR(255),
    start_date DATE,
    status lecturer_status_enum DEFAULT 'active',
    experience TEXT,
    research_areas TEXT,
    publications_count INTEGER DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lecturers_lecturer_number ON lecturers(lecturer_number);
CREATE INDEX IF NOT EXISTS idx_lecturers_status ON lecturers(status);

-- Lecturer-Faculty associations (many-to-many)
CREATE TABLE IF NOT EXISTS lecturer_faculties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lecturer_id UUID NOT NULL,
    faculty_id UUID NOT NULL,
    created_at timestamptz DEFAULT now(),
    FOREIGN KEY (lecturer_id) REFERENCES lecturers(id) ON DELETE CASCADE,
    FOREIGN KEY (faculty_id) REFERENCES faculties(id) ON DELETE CASCADE,
    UNIQUE (lecturer_id, faculty_id)
);


-- =============================================
-- ACADEMIC STRUCTURE TABLES
-- =============================================

-- Courses
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(15) UNIQUE NOT NULL,
    credits INTEGER NOT NULL DEFAULT 3,
    semester semester_enum NOT NULL,
    year INTEGER NOT NULL,
    description TEXT,
    prerequisites TEXT,
    max_students INTEGER DEFAULT 50,
    lecturer_id UUID,
    enrolled_students INTEGER DEFAULT 0,
    status course_status_enum DEFAULT 'active',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
    FOREIGN KEY (lecturer_id) REFERENCES lecturers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(code);
CREATE INDEX IF NOT EXISTS idx_courses_program_id ON courses(program_id);
CREATE INDEX IF NOT EXISTS idx_courses_lecturer_id ON courses(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_courses_semester_year ON courses(semester, year);

-- Course schedule
CREATE TABLE IF NOT EXISTS course_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL,
    day_of_week VARCHAR(20) NOT NULL CHECK (day_of_week IN ('monday','tuesday','wednesday','thursday','friday')),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    venue VARCHAR(255) NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE (course_id, day_of_week)
);

-- Student enrollments
CREATE TABLE IF NOT EXISTS student_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    course_id UUID NOT NULL,
    enrollment_date DATE DEFAULT CURRENT_DATE,
    status enrollment_status_enum DEFAULT 'enrolled',
    final_grade VARCHAR(5),
    final_percentage NUMERIC(5,2),
    grade_points NUMERIC(3,2),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE (student_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_student_enrollments_student_id ON student_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_course_id ON student_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_status ON student_enrollments(status);


-- =============================================
-- ASSESSMENT TABLES
-- =============================================

-- Assessments
CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    type assessment_type_enum NOT NULL,
    weight_percentage NUMERIC(5,2) NOT NULL,
    maximum_marks INTEGER NOT NULL DEFAULT 100,
    due_date DATE,
    instructions TEXT,
    status assessment_status_enum DEFAULT 'draft',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assessments_course_id ON assessments(course_id);

-- Student marks
CREATE TABLE IF NOT EXISTS student_marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    assessment_id UUID NOT NULL,
    marks_obtained NUMERIC(7,2),
    percentage NUMERIC(5,2),
    submitted_at timestamptz,
    graded_at timestamptz,
    graded_by UUID, -- lecturer id
    feedback TEXT,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    FOREIGN KEY (graded_by) REFERENCES lecturers(id) ON DELETE SET NULL,
    UNIQUE (student_id, assessment_id)
);

CREATE INDEX IF NOT EXISTS idx_student_marks_student_id ON student_marks(student_id);
CREATE INDEX IF NOT EXISTS idx_student_marks_assessment_id ON student_marks(assessment_id);


-- =============================================
-- ATTENDANCE TABLES
-- =============================================

-- Attendance sessions
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL,
    session_date DATE NOT NULL,
    session_time TIME NOT NULL,
    venue VARCHAR(255),
    topic VARCHAR(255),
    lecturer_id UUID,
    status session_status_enum DEFAULT 'scheduled',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (lecturer_id) REFERENCES lecturers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_course_id ON attendance_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date ON attendance_sessions(session_date);

-- Student attendance records
CREATE TABLE IF NOT EXISTS student_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    session_id UUID NOT NULL,
    status attendance_status_enum NOT NULL,
    check_in_time timestamptz,
    notes TEXT,
    recorded_by UUID, -- lecturer id
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES lecturers(id) ON DELETE SET NULL,
    UNIQUE (student_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_student_attendance_student_id ON student_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_student_attendance_session_id ON student_attendance(session_id);


-- =============================================
-- EXAM ELIGIBILITY TABLES
-- =============================================

CREATE TABLE IF NOT EXISTS exam_eligibility_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID,
    program_id UUID,
    rule_type exam_rule_type_enum NOT NULL,
    threshold_percentage NUMERIC(5,2),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS student_exam_eligibility (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    course_id UUID NOT NULL,
    is_eligible BOOLEAN NOT NULL DEFAULT false,
    assessment_percentage NUMERIC(5,2),
    attendance_percentage NUMERIC(5,2),
    eligibility_reason TEXT,
    checked_at timestamptz DEFAULT now(),
    checked_by UUID, -- admin or system user
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (checked_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (student_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_eligibility_student_id ON student_exam_eligibility(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_eligibility_course_id ON student_exam_eligibility(course_id);
CREATE INDEX IF NOT EXISTS idx_exam_eligibility_is_eligible ON student_exam_eligibility(is_eligible);


-- =============================================
-- EVENT & CALENDAR
-- =============================================

CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    event_type event_type_enum NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    venue VARCHAR(255) NOT NULL,
    course_id UUID,
    lecturer_id UUID,
    max_attendees INTEGER,
    current_attendees INTEGER DEFAULT 0,
    status session_status_enum DEFAULT 'scheduled',
    created_by UUID,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (lecturer_id) REFERENCES lecturers(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_course_id ON events(course_id);
CREATE INDEX IF NOT EXISTS idx_events_lecturer_id ON events(lecturer_id);

CREATE TABLE IF NOT EXISTS event_attendees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    student_id UUID NOT NULL,
    registration_date timestamptz DEFAULT now(),
    attendance_status VARCHAR(20) DEFAULT 'registered',
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE (event_id, student_id)
);


-- =============================================
-- COMMUNICATIONS
-- =============================================

CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    priority announcement_priority_enum DEFAULT 'medium',
    target_audience announcement_target_enum NOT NULL,
    course_id UUID,
    program_id UUID,
    author_id UUID NOT NULL,
    is_published BOOLEAN DEFAULT false,
    publish_date timestamptz,
    expire_date timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS announcement_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL,
    user_id UUID NOT NULL,
    read_at timestamptz DEFAULT now(),
    FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (announcement_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL,
    recipient_id UUID NOT NULL,
    subject VARCHAR(255),
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'direct',
    course_id UUID,
    is_read BOOLEAN DEFAULT false,
    read_at timestamptz,
    parent_message_id UUID,
    created_at timestamptz DEFAULT now(),
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);


-- =============================================
-- STUDENT GOALS & PROGRESS
-- =============================================

CREATE TABLE IF NOT EXISTS student_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    course_id UUID,
    priority VARCHAR(10) DEFAULT 'medium',
    target_date DATE,
    status VARCHAR(20) DEFAULT 'active',
    completion_date DATE,
    progress_percentage INTEGER DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS student_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    course_id UUID NOT NULL,
    semester VARCHAR(10) NOT NULL,
    year INTEGER NOT NULL,
    total_assessments INTEGER DEFAULT 0,
    completed_assessments INTEGER DEFAULT 0,
    average_percentage NUMERIC(5,2),
    attendance_percentage NUMERIC(5,2),
    is_exam_eligible BOOLEAN DEFAULT false,
    gpa NUMERIC(3,2),
    credits_earned INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'in_progress',
    last_updated timestamptz DEFAULT now(),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE (student_id, course_id, semester, year)
);


-- =============================================
-- NOTIFICATIONS
-- =============================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type notif_type_enum DEFAULT 'info',
    category notification_category_enum DEFAULT 'academic',
    is_read BOOLEAN DEFAULT false,
    read_at timestamptz,
    action_url VARCHAR(500),
    expires_at timestamptz,
    created_at timestamptz DEFAULT now(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);


-- =============================================
-- REPORTING & TRANSCRIPTS
-- =============================================

CREATE TABLE IF NOT EXISTS report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    report_type report_type_enum NOT NULL,
    template_config JSONB,
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS generated_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID,
    name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500),
    file_format file_format_enum NOT NULL,
    parameters JSONB,
    generated_by UUID,
    generated_at timestamptz DEFAULT now(),
    expires_at timestamptz,
    download_count INTEGER DEFAULT 0,
    FOREIGN KEY (template_id) REFERENCES report_templates(id) ON DELETE SET NULL,
    FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS student_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    transcript_type transcript_type_enum DEFAULT 'official',
    issue_date DATE DEFAULT CURRENT_DATE,
    issued_by UUID,
    total_credits INTEGER DEFAULT 0,
    gpa NUMERIC(3,2),
    cumulative_gpa NUMERIC(3,2),
    academic_status VARCHAR(50),
    graduation_date DATE,
    file_path VARCHAR(500),
    is_verified BOOLEAN DEFAULT false,
    verification_code VARCHAR(50),
    created_at timestamptz DEFAULT now(),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS transcript_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transcript_id UUID NOT NULL,
    course_code VARCHAR(15) NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    credits INTEGER NOT NULL,
    grade VARCHAR(5) NOT NULL,
    grade_points NUMERIC(3,2) NOT NULL,
    semester VARCHAR(10) NOT NULL,
    year INTEGER NOT NULL,
    FOREIGN KEY (transcript_id) REFERENCES student_transcripts(id) ON DELETE CASCADE
);


-- =============================================
-- PERFORMANCE / ADDITIONAL INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_activity_type ON activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_student_progress_student_course ON student_progress(student_id, course_id);
CREATE INDEX IF NOT EXISTS idx_report_templates_type ON report_templates(report_type);


-- =============================================
-- TRIGGERS: Attach updated_at trigger to tables that have updated_at
-- =============================================
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'users','system_settings','activity_logs',
    'faculties','departments','programs',
    'students','lecturers','lecturer_faculties',
    'courses','course_schedules','student_enrollments',
    'assessments','student_marks','attendance_sessions','student_attendance',
    'exam_eligibility_rules','student_exam_eligibility',
    'events','event_attendees',
    'announcements','announcement_reads','messages',
    'student_goals','student_progress',
    'notifications','report_templates','generated_reports',
    'student_transcripts','transcript_courses'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    BEGIN
      -- Attempt to drop stale trigger if exists, ignore if table missing
      EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I;', tbl, tbl);
      -- Create trigger only if the table exists
      EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();', tbl, tbl);
    EXCEPTION WHEN undefined_table THEN
      -- ignore if table does not exist
      NULL;
    END;
  END LOOP;
END $$;


-- =============================================
-- NOTE (migration / usage)
-- =============================================
-- * Before running this on an existing DB: backup first.
-- * If you currently have Supabase auth (auth.users), migrate rows into users:
--     - map auth.users.id -> users.id
--     - email -> users.email
--     - provider info -> role/auth_provider (as appropriate)
--     - determine is_password_changed from metadata / set to true where password exists
-- * Add row-level security policies or additional indexes based on query patterns.
-- * Run ANALYZE after heavy migrations: ANALYZE;

-- End of migration