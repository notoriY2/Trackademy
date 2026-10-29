// src/components/StudentDashboard.tsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import UserProfileModal from './UserProfileModal';
import { 
  GraduationCap, 
  BookOpen, 
  Calendar, 
  BarChart3, 
  CheckCircle, 
  XCircle,
  LogOut,
  User,
  Clock,
  FileText,
  Download,
  Bell,
  Target,
  AlertTriangle,
  Plus,
  Edit,
  Trash2,
  Eye,
  MapPin,
  Users,
  Award,
  TrendingUp,
  BookmarkPlus,
  ChevronUp,
  ChevronDown,
  CalendarDays,
  MessageSquare,
  Settings,
  Search,
  Filter,
  RefreshCw,
  Star,
  ChevronRight,
  Home,
  PieChart
} from 'lucide-react';

interface User {
  userNumber: string;
  role: string;
  name: string;
}

interface StudyGoal {
  id: number | string;
  title: string;
  description: string;
  targetDate: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  course: string;
}

interface CalendarEvent {
  id: number | string;
  title: string;
  date: string;
  time: string;
  type: string; // will now be the event type name (e.g., "exam", "lecture") — always lowercase
  venue?: string;
  course?: string;
  description?: string;
  color?: string; // color from event_types.color_code
  eventTypeId?: string; // optional reference to event_types.id
}

interface Announcement {
  id: number | string;
  title: string;
  message: string;
  sender: string;
  date: string;
  course?: string;
  priority: 'high' | 'medium' | 'low';
  read: boolean;
}

/** Only count assessments that have actually been graded; an ungraded assessment is not the
 *  same thing as a 0% and must never drag an average down. */
const isGraded = (a: any) => a && a.percentage !== null && a.percentage !== undefined;

/** Average of an assessment list's percentages, counting only graded ones. */
const averagePercentage = (assessments: any[]): number => {
  const graded = (assessments || []).filter(isGraded);
  if (graded.length === 0) return 0;
  const total = graded.reduce((sum, a) => sum + Number(a.percentage), 0);
  return Math.round(total / graded.length);
};

/** Coursework (non-exam) average for a course's assessment list — this is the real,
 *  DB-backed substitute for the previously-invented "year mark" (which was just final x 0.4). */
const computeCourseworkAverage = (courseAssessments: any[]): number | null => {
  const coursework = (courseAssessments || []).filter(
    a => !String(a.type ?? '').toLowerCase().includes('exam')
  );
  const graded = coursework.filter(isGraded);
  if (graded.length === 0) return null;
  const total = graded.reduce((sum, a) => sum + Number(a.percentage), 0);
  return Math.round(total / graded.length);
};

/** Programs store duration as free text (e.g. "3 years"); pull the first number out of it
 *  instead of letting it get string-concatenated onto the current year. */
const parseDurationYears = (duration: any): number => {
  if (duration === null || duration === undefined || duration === '') return 3;
  if (typeof duration === 'number' && !Number.isNaN(duration)) return duration;
  const match = String(duration).match(/\d+/);
  return match ? Number(match[0]) : 3;
};

const StudentDashboard: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [studyGoals, setStudyGoals] = useState<StudyGoal[]>([]);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);


  // semester / course / event filters
  const [semesterFilter, setSemesterFilter] = useState<'all' | string>('all');
  const [courseFilter, setCourseFilter] = useState<'all' | string>('all');
  const [eventFilter, setEventFilter] = useState<'all' | 'exam' | 'assignment' | 'lecture' | 'registration' | 'holiday'>('all');
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [expandedYears, setExpandedYears] = useState<{[key: string]: boolean}>({});
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  /* -------------------------
     Supabase-backed student data
     ------------------------- */
  const [studentId, setStudentId] = useState<string | null>(null); // the students.id PK, needed for writes (goals, announcement reads)
  const [courses, setCourses] = useState<Array<any>>([]); // UI shape expected by renderers
  const [courseSchedules, setCourseSchedules] = useState<any[]>([]);
  const [academicRecord, setAcademicRecord] = useState<any | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [announcementsFromDB, setAnnouncementsFromDB] = useState<Announcement[]>([]);
  const [isLoadingStudentData, setIsLoadingStudentData] = useState<boolean>(false);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    targetDate: '',
    priority: 'medium' as StudyGoal['priority'],
    course: ''
  });

  const navigate = useNavigate();

  // load logged-in user from localStorage (your app's auth)
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      if (parsedUser.role === 'student') {
        setUser(parsedUser);
        // Study goals are persisted in the `study_goals` table (see loadStudentData) — no
        // localStorage fallback is used anymore.
      } else {
        navigate('/login');
      }
    } else {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
  if (!user) return;
  let mounted = true;

  const loadStudentData = async () => {
  setIsLoadingStudentData(true);
  try {
    // --- 1. Find student row ---
    const { data: studentRow, error: studentErr } = await supabase
      .from('students')
      .select('id, profile_id, student_number, program_id, year_of_study')
      .eq('student_number', user.userNumber)
      .maybeSingle();

    if (studentErr) throw studentErr;
    if (!studentRow) {
      setCourses([]);
      setAcademicRecord(null);
      setUpcomingEvents([]);
      setAnnouncementsFromDB([]);
      return;
    }

    if (mounted) setStudentId(studentRow.id);

    // --- 2. Fetch enrollments (enriched nested course) ---
    const { data: enrolls, error: enrollErr } = await supabase
      .from('enrollments')
      .select(`
        id,
        course_id,
        enrollment_date,
        final_grade,
        final_percentage,
        grade_points,
        status,
        is_exam_eligible,
        created_at,
        updated_at,
        courses (
          id,
          name,
          code,
          credits,
          semester,
          year_level,
          lecturer_id,
          program:program_id ( id, name, total_credits, department_id, duration )
        )
      `)
      .eq('student_id', studentRow.id);

    if (enrollErr) throw enrollErr;
    const rawEnrollList: any[] = enrolls || [];

    // --- 3. Build courseIds list and fetch courses for missing metadata ---
    const courseIds = Array.from(
      new Set(
        rawEnrollList
          .map((en: any) => en.course_id || en.courses?.id)
          .filter(Boolean)
      )
    );
    let coursesById: Record<string, any> = {};
    if (courseIds.length) {
      const { data: courseRows, error: courseErr } = await supabase
        .from('courses')
        .select('id, name, code, credits, semester, year_level, lecturer_id, program_id')
        .in('id', courseIds);
      if (courseErr) throw courseErr;
      coursesById = Object.fromEntries((courseRows || []).map((c: any) => [c.id, c]));
    }

    // --- FETCH student assessments WITH marks FOR LOGGED-IN STUDENT ---
    let assessmentsByCourse: Record<string, any[]> = {};
    if (courseIds.length) {
      const { data: assessmentRows, error: assessmentErr } = await supabase
        .from('assessments')
        .select(`
          id,
          course_id,
          name,
          weight_percentage,
          maximum_marks,
          due_date,
          assessment_types ( name ),
          student_assessment_marks (
            marks_obtained,
            percentage,
            submitted_date,
            graded_date,
            status,
            student_id
          )
        `)
        .in('course_id', courseIds);

      if (assessmentErr) {
        console.error('❌ Failed to fetch assessments:', assessmentErr.message || assessmentErr);
      } else {
        (assessmentRows || []).forEach((a: any) => {
          const cid = String(a.course_id ?? '');
          const studentMark = (a.student_assessment_marks || []).find(
            (m: any) => m.student_id === studentRow.id
          );

          const max = Number(a.maximum_marks ?? 100) || 100;
          // Distinguish "ungraded" from "scored zero": only treat the assessment as graded
          // when a mark actually exists.
          const hasMark = studentMark?.marks_obtained !== undefined && studentMark?.marks_obtained !== null;
          const score = hasMark ? Number(studentMark.marks_obtained) : null;
          const percentage = hasMark
            ? (studentMark?.percentage ?? (max > 0 ? Math.round(((score as number) / max) * 100) : 0))
            : null;

          const normalized = {
            id: a.id,
            course_id: a.course_id,
            name: a.name,
            type: a.assessment_types?.name ?? 'Assessment',
            weight: a.weight_percentage ?? 0,
            score,
            maxScore: max,
            percentage,
            due_date: a.due_date,
            submitted_date: studentMark?.submitted_date,
            graded_date: studentMark?.graded_date,
            status: studentMark?.status,
          };

          if (!assessmentsByCourse[cid]) assessmentsByCourse[cid] = [];
          assessmentsByCourse[cid].push(normalized);
        });
      }
    }

    console.log('✅ assessmentsByCourse (logged-in student only)', assessmentsByCourse);

    // --- 4. Filter enrollments by course.year_level <= student.year_of_study ---
    const studentYear = Number(studentRow.year_of_study ?? 0);
    const prelimFiltered = rawEnrollList.filter((en: any) => {
      const nested = en.courses ?? {};
      const nestedYear =
        nested.year_level !== undefined && nested.year_level !== null
          ? Number(nested.year_level)
          : NaN;
      if (!Number.isNaN(nestedYear)) {
        return nestedYear <= studentYear;
      }
      return true; // keep if missing, refine later
    });

    const finalEnrollList = prelimFiltered.filter((en: any) => {
      const nested = en.courses ?? {};
      const nestedYear =
        nested.year_level !== undefined && nested.year_level !== null
          ? Number(nested.year_level)
          : NaN;
      if (!Number.isNaN(nestedYear)) {
        return nestedYear <= studentYear;
      }
      const courseId = nested.id ?? en.course_id;
      const fromTable = courseId ? coursesById[courseId] : null;
      const tableYear =
        fromTable?.year_level !== undefined && fromTable?.year_level !== null
          ? Number(fromTable.year_level)
          : NaN;
      if (!Number.isNaN(tableYear)) {
        return tableYear <= studentYear;
      }
      return true;
    });

    // --- 5. Enforce "at most one repeat" policy for display ---
    function keepAtMostOneRepeat(enrollListInput: any[], coursesMap: Record<string, any> = {}) {
      const byCode: Record<string, any[]> = {};

      (enrollListInput || []).forEach((en) => {
        const nested = en.courses ?? {};
        const fromTable = coursesMap[en.course_id] ?? {};
        const code = String(nested.code ?? fromTable.code ?? en.course_code ?? en.course_id);
        const dateVal = en.enrollment_date ?? en.created_at ?? en.updated_at ?? null;
        const ts = dateVal ? new Date(dateVal).getTime() : 0;

        byCode[code] = byCode[code] || [];
        byCode[code].push({
          ...en,
          _norm_course_code: code,
          _norm_enrollment_ts: ts,
        });
      });

      const finalKept: any[] = [];

      Object.keys(byCode).forEach((code) => {
        const attempts = (byCode[code] || []).sort((a, b) => (a._norm_enrollment_ts || 0) - (b._norm_enrollment_ts || 0));

        if (attempts.length === 1) {
          finalKept.push({ ...attempts[0], attemptNumber: 1, is_repeat: false });
          return;
        }

        if (attempts.length === 2) {
          finalKept.push({ ...attempts[0], attemptNumber: 1, is_repeat: false });
          finalKept.push({ ...attempts[1], attemptNumber: 2, is_repeat: true });
          return;
        }

        console.warn(`>2 attempts detected for course code ${code}. Keeping original + latest as single allowed repeat.`);
        finalKept.push({ ...attempts[0], attemptNumber: 1, is_repeat: false });
        const last = attempts[attempts.length - 1];
        finalKept.push({ ...last, attemptNumber: 2, is_repeat: true });
      });

      return finalKept.sort((a, b) => {
        const aC = a._norm_course_code ?? '';
        const bC = b._norm_course_code ?? '';
        if (aC === bC) return (a.attemptNumber || 0) - (b.attemptNumber || 0);
        return aC.localeCompare(bC);
      });
    }

    const displayEnrollments = keepAtMostOneRepeat(finalEnrollList, coursesById);

    // --- 6. Build courseRows UI shape from displayEnrollments (merge enroll + course) ---
    const courseRows = (displayEnrollments || []).map((en: any) => {
      const nested = en.courses ?? {};
      const courseId = nested.id ?? en.course_id;
      const cFromTable = coursesById[courseId] || {};
      const lecturer_id = nested.lecturer_id ?? cFromTable.lecturer_id ?? null;

      // "Course Progress" is how much of the course's assessments have actually been graded —
      // it must never be the student's final grade (final_percentage), which is a result, not
      // a measure of how much of the course has been completed.
      const courseAssessments = assessmentsByCourse[String(courseId)] || [];
      const gradedCount = courseAssessments.filter(isGraded).length;
      const completionPercentage = courseAssessments.length > 0
        ? Math.round((gradedCount / courseAssessments.length) * 100)
        : 0;

      return {
        id: courseId,
        name: nested.name ?? cFromTable.name ?? undefined,
        code: nested.code ?? cFromTable.code ?? undefined,
        credits: Number(nested.credits ?? cFromTable.credits ?? 0),
        semester: nested.semester ?? cFromTable.semester ?? '',
        year_level: Number(nested.year_level ?? cFromTable.year_level ?? NaN),
        lecturer_id,
        lecturer: '',
        eligibleForExam: Boolean(en.is_exam_eligible) === true,
        completionPercentage,
        assessments: courseAssessments,
        nextClass: { date: '', time: '', venue: '', topic: '' },
        upcomingAssessments: [] as any[],
        program: nested.program ?? cFromTable.program_id ?? null,
        attemptNumber: en.attemptNumber ?? 1,
        is_repeat: Boolean(en.is_repeat ?? false),
        enrollment_row_id: en.id,
        enrollment_date: en.enrollment_date ?? en.created_at ?? null,
        final_percentage: en.final_percentage ?? null,
        grade_points: en.grade_points ?? null,
      };
    });

    // --- 7. Fetch lecturer names ---
    const lecturerIds = Array.from(new Set(courseRows.map((c: any) => c.lecturer_id).filter(Boolean)));
    const lecturerNameById: Record<string, string> = {};
    if (lecturerIds.length) {
      const { data: lectRows } = await supabase
        .from('lecturers')
        .select('id, profile_id')
        .in('id', lecturerIds);

      const profileIds = (lectRows || []).map((l: any) => l.profile_id).filter(Boolean);
      if (profileIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', profileIds);
        const profMap: Record<string, string> = {};
        (profiles || []).forEach((p: any) => { profMap[p.id] = p.full_name ?? ''; });
        (lectRows || []).forEach((l: any) => { lecturerNameById[l.id] = profMap[l.profile_id] ?? `Lecturer ${l.id}`; });
      }
    }

    // --- 8. Events + announcements + study goals ---
    let upcoming: CalendarEvent[] = [];
    const now = new Date();
    const todayISO = now.toISOString().slice(0, 10);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // midnight today

    // Fetch event types
    const { data: eventTypeRows, error: eventTypeErr } = await supabase
      .from('event_types')
      .select('id, name, color_code');
    if (eventTypeErr) throw eventTypeErr;

    const eventTypeMap: Record<string, { name: string; color: string }> = {};
    (eventTypeRows || []).forEach((et) => {
      eventTypeMap[et.id] = { name: et.name, color: et.color_code || '#6b7280' };
    });

    // Fetch upcoming events — scoped to this student: either tied to one of their enrolled
    // courses, or institution-wide (no course_id at all). Previously every event for every
    // course was shown to every student regardless of enrollment.
    let eventsQuery = supabase
      .from('events')
      .select('id, title, event_date, start_time, end_time, venue, course_id, description, event_type_id')
      .gte('event_date', todayISO)
      .order('event_date', { ascending: true });

    eventsQuery = courseIds.length
      ? eventsQuery.or(`course_id.in.(${courseIds.join(',')}),course_id.is.null`)
      : eventsQuery.is('course_id', null);

    const { data: eventsRows, error: eventsErr } = await eventsQuery;

    if (eventsErr) throw eventsErr;

    upcoming = (eventsRows || []).map((ev: any) => {
      const typeInfo = eventTypeMap[ev.event_type_id] || { name: 'event', color: '#6b7280' };
      return {
        id: ev.id,
        title: ev.title,
        date: ev.event_date,
        time: ev.start_time ?? ev.end_time ?? '',
        // event_types.name is stored lowercase in the DB ('exam', 'assignment', ...) — keep it
        // as-is so it matches the (lowercase) calendar filter values.
        type: String(typeInfo.name || 'event').toLowerCase(),
        color: typeInfo.color,
        venue: ev.venue,
        course: ev.course_id ? String(ev.course_id) : undefined,
        description: ev.description
      } as CalendarEvent;
    });

    // Announcements — resolve the real sender name instead of showing a raw UUID, and load
    // which of these this student has already read from `announcement_reads` instead of
    // always starting every announcement as unread.
    let ann: Announcement[] = [];
    if (courseIds.length) {
      const { data: annRows, error: annErr } = await supabase
        .from('announcements')
        .select('id, title, content, published_at, course_id, created_by')
        .in('course_id', courseIds)
        .order('published_at', { ascending: false })
        .limit(50);

      if (annErr) console.error('Failed to fetch announcements', annErr);

      const annList = annRows || [];

      const creatorIds = Array.from(new Set(annList.map((a: any) => a.created_by).filter(Boolean)));
      let nameByUserId: Record<string, string> = {};
      if (creatorIds.length) {
        const { data: creatorProfiles, error: creatorErr } = await supabase
          .from('profiles')
          .select('user_id, full_name, first_name, last_name')
          .in('user_id', creatorIds);
        if (creatorErr) {
          console.error('Failed to resolve announcement senders', creatorErr);
        } else {
          (creatorProfiles || []).forEach((p: any) => {
            nameByUserId[p.user_id] = p.full_name || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim();
          });
        }
      }

      const annIds = annList.map((a: any) => a.id);
      let readIds = new Set<string | number>();
      if (annIds.length) {
        const { data: readRows, error: readErr } = await supabase
          .from('announcement_reads')
          .select('announcement_id')
          .eq('student_id', studentRow.id)
          .in('announcement_id', annIds);
        if (readErr) console.error('Failed to fetch announcement read status', readErr);
        else readIds = new Set((readRows || []).map((r: any) => r.announcement_id));
      }

      ann = annList.map((a: any) => ({
        id: a.id,
        title: a.title,
        message: a.content,
        sender: nameByUserId[a.created_by] || 'Course Lecturer',
        date: a.published_at,
        course: a.course_id ? String(a.course_id) : undefined,
        priority: 'medium',
        read: readIds.has(a.id),
      }));
    }

    // Study goals — persisted in `study_goals`, not localStorage.
    let dbGoals: StudyGoal[] = [];
    try {
      const { data: goalRows } = await supabase
        .from('study_goals')
        .select('id, title, description, target_date, completion_percentage, status, course_id, priority')
        .eq('student_id', studentRow.id);
      dbGoals = (goalRows || []).map((g: any) => ({
        id: g.id,
        title: g.title,
        description: g.description,
        targetDate: g.target_date ?? '',
        completed: g.status === 'completed' || (g.completion_percentage ?? 0) >= 100,
        priority: (g.priority as StudyGoal['priority']) ?? 'medium',
        course: g.course_id ? String(g.course_id) : '',
      }));
    } catch { /* ignore */ }

    // --- FETCH course schedules so the Timetable can render real data instead of a fake
    //     `courses[(col + row) % n]` fill pattern ---
    let scheduleRows: any[] = [];
    if (courseIds.length) {
      const { data: schedData, error: scheduleErr } = await supabase
        .from('course_schedules')
        .select('id, course_id, day_of_week, start_time, end_time, venue, is_active')
        .in('course_id', courseIds)
        .eq('is_active', true);

      if (scheduleErr) {
        console.error('❌ Failed to fetch course schedules:', scheduleErr.message || scheduleErr);
      } else {
        scheduleRows = schedData || [];
      }
    }

    const daysOfWeekOrder = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const todayIndex = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

    let courseSchedulesByCourse: Record<string, any[]> = {};
    scheduleRows.forEach((s: any) => {
      const cid = String(s.course_id);
      if (!courseSchedulesByCourse[cid]) courseSchedulesByCourse[cid] = [];
      courseSchedulesByCourse[cid].push(s);
    });
    console.log('✅ courseSchedulesByCourse', courseSchedulesByCourse);

    // --- 9. Build mappedCourses (UI shape) including the next-class lookup ---
    const mappedCourses = courseRows.map((c: any) => {
      const key = String(c.id);
      const schedules = courseSchedulesByCourse[key] || [];

      // find the next class in the week
      let nextClass: any = { date: '', time: '', venue: '', topic: '' };
      if (schedules.length) {
        // sort schedules by day_of_week starting from today
        const sortedSchedules = schedules
          .map((s: any) => ({ ...s, dayIndex: daysOfWeekOrder.indexOf(String(s.day_of_week ?? '').toLowerCase()) }))
          .filter((s: any) => s.dayIndex >= 0) // discard malformed day_of_week
          .sort((a: any, b: any) => {
            const offsetA = (a.dayIndex - todayIndex + 7) % 7;
            const offsetB = (b.dayIndex - todayIndex + 7) % 7;
            // if same offset, compare start_time (lexicographic okay for HH:mm)
            return offsetA - offsetB || String(a.start_time ?? '').localeCompare(String(b.start_time ?? ''));
          });

        if (sortedSchedules.length) {
          const nextSched = sortedSchedules[0];
          const nextDate = new Date(now);
          const offset = (nextSched.dayIndex - todayIndex + 7) % 7;
          nextDate.setDate(now.getDate() + offset);

          nextClass = {
            topic: `${c.code ?? c.name ?? 'Class'} Class`,
            date: nextDate.toISOString().slice(0, 10),
            time: nextSched.start_time ?? '',
            venue: nextSched.venue ?? '',
          };
        }
      }

      // upcoming assessments: filter for not submitted and due >= today start
      const upcomingAssessments = (assessmentsByCourse[key] || [])
        .filter((a: any) => a.submitted_date === null || a.submitted_date === undefined)
        .filter((a: any) => {
          if (!a.due_date) return true;
          try {
            const d = new Date(a.due_date);
            return d >= todayStart;
          } catch {
            return true;
          }
        })
        .sort((a: any, b: any) => {
          const da = a.due_date ? new Date(a.due_date).getTime() : 0;
          const db = b.due_date ? new Date(b.due_date).getTime() : 0;
          return da - db;
        });

      return {
        id: c.id,
        name: c.name,
        code: c.code,
        credits: c.credits,
        semester: c.semester,
        lecturer_id: c.lecturer_id,
        lecturer: lecturerNameById[c.lecturer_id] ?? '',
        eligibleForExam: c.eligibleForExam,
        completionPercentage: c.completionPercentage ?? 0,
        assessments: assessmentsByCourse[key] ?? [],
        nextClass,
        upcomingAssessments,
      };
    });

    // --- 10. Compute academic summary & grouped records from displayEnrollments ---
    interface AcademicRecord {
      currentGPA: string | null;
      totalCredits: number | null;
      completedCredits: number | null;
      yearOfStudy: string | number | null;
      program: string | null | { id?: string; name?: string; total_credits?: number };
      department: string | null;
      expectedGraduation: string | null;
      records: any[];
    }

    const academicSummary: AcademicRecord = {
      currentGPA: null,
      totalCredits: null,
      completedCredits: null,
      yearOfStudy: studentRow.year_of_study ?? null,
      program: null,
      department: null,
      expectedGraduation: null,
      records: [],
    };

    // Credits for a given enrollment row, used both for "completed credits" and for the
    // credit-weighted GPA below.
    const creditsForEnrollment = (e: any) =>
      Number((e.courses?.credits ?? coursesById[e.course_id]?.credits) ?? 0);

    const completedEnrolls = (displayEnrollments || []).filter(
      (e) => e.final_percentage !== null && e.final_percentage !== undefined
    );
    academicSummary.completedCredits = completedEnrolls.reduce(
      (sum: number, e: any) => sum + creditsForEnrollment(e),
      0
    );

    // GPA must be credit-weighted (sum(grade_points * credits) / sum(credits)), not a flat
    // average of grade points across courses — a 1-credit course and a 20-credit course do
    // not count equally toward GPA.
    const gpaEligibleEnrolls = completedEnrolls.filter(
      (e: any) => e.grade_points !== null && e.grade_points !== undefined
    );
    const totalGradePointCredits = gpaEligibleEnrolls.reduce(
      (sum: number, e: any) => sum + Number(e.grade_points) * creditsForEnrollment(e),
      0
    );
    const totalGpaCredits = gpaEligibleEnrolls.reduce(
      (sum: number, e: any) => sum + creditsForEnrollment(e),
      0
    );
    academicSummary.currentGPA = (totalGpaCredits > 0 ? totalGradePointCredits / totalGpaCredits : 0).toFixed(2);

    const grouped: Record<string, any> = {};
    (displayEnrollments || []).forEach((en) => {
      const c = (en.courses as any) || coursesById[en.course_id] || {};
      const year = (c.year_level !== undefined && c.year_level !== null) ? String(Number(c.year_level)) : '1';
      const sem = c.semester ?? '1';
      const key = `${year}-${sem}`;
      if (!grouped[key]) grouped[key] = { year, semester: sem, courses: [] };
      grouped[key].courses.push({
        id: c.id ?? en.course_id,
        name: c.name,
        code: c.code,
        // Real coursework (continuous-assessment) average, replacing the previous invented
        // "year mark" that was simply `final_percentage * 0.4` with no actual basis.
        courseworkAverage: computeCourseworkAverage(assessmentsByCourse[String(en.course_id)] || []),
        finalMark: en.final_percentage ?? '-',
        result: Number(en.final_percentage) >= 50 ? 'PASS' : 'FAIL',
        credits: Number(c.credits ?? 0),
        gradePoints: en.grade_points,
        assessments: assessmentsByCourse[String(en.course_id)] || [],
        attemptNumber: en.attemptNumber ?? 1,
        is_repeat: Boolean(en.is_repeat ?? false),
      });
    });

    academicSummary.records = Object.values(grouped);

    // --- 11. Program / total credits robust assignment ---
    if (studentRow.program_id) {
      const { data: prog } = await supabase
        .from('programs')
        .select('id, name, total_credits, department_id, duration')
        .eq('id', studentRow.program_id)
        .maybeSingle();
      if (prog) {
        academicSummary.program = prog.name ?? prog ?? null;
        academicSummary.totalCredits = prog.total_credits ?? academicSummary.totalCredits;
        // `duration` is free text like "3 years" — parse the number out of it rather than
        // adding the whole string to the current year (which previously produced "20263 years").
        academicSummary.expectedGraduation = `${new Date().getFullYear() + parseDurationYears(prog.duration)}`;
        if (prog.department_id) {
          const { data: dept } = await supabase
            .from('departments')
            .select('name')
            .eq('id', prog.department_id)
            .maybeSingle();
          if (dept) academicSummary.department = dept.name ?? academicSummary.department;
        }
      }
    }

    if (!academicSummary.totalCredits) {
      const creditsFromGrouped = Object.values(grouped || {}).reduce((s: number, rec: any) => {
        return s + ((rec.courses || []).reduce((cs: number, c: any) => cs + (Number(c.credits) || 0), 0));
      }, 0);
      academicSummary.totalCredits = creditsFromGrouped || null;
    }

    // --- 12. Update UI state ---
    if (mounted) {
      setCourses(mappedCourses);
      setCourseSchedules(scheduleRows);
      setAcademicRecord(academicSummary);
      setUpcomingEvents(upcoming);
      setAnnouncementsFromDB(ann);
      setStudyGoals(dbGoals);
    }
  } catch (err) {
    console.error('Failed to load student data', err);
  } finally {
    if (mounted) setIsLoadingStudentData(false);
  }
};





  loadStudentData();
  return () => { mounted = false; };
}, [user]);


  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/');
  };

  /** Persist a study goal to `study_goals` instead of localStorage. */
  const handleCreateGoal = async () => {
    if (!studentId) {
      setNotification({ type: 'error', message: 'Could not find your student record ❌' });
      return;
    }
    if (!newGoal.title.trim()) {
      setNotification({ type: 'error', message: 'Please give the goal a title' });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('study_goals')
        .insert([{
          student_id: studentId,
          title: newGoal.title.trim(),
          description: newGoal.description,
          target_date: newGoal.targetDate || null,
          course_id: newGoal.course || null,
          priority: newGoal.priority,
          status: 'in_progress',
          completion_percentage: 0,
        }])
        .select()
        .single();

      if (error) throw error;

      const goal: StudyGoal = {
        id: data.id,
        title: data.title,
        description: data.description,
        targetDate: data.target_date ?? '',
        completed: false,
        priority: (data.priority as StudyGoal['priority']) ?? newGoal.priority,
        course: data.course_id ? String(data.course_id) : ''
      };

      setStudyGoals(prev => [...prev, goal]);
      setShowGoalModal(false);
      setNewGoal({
        title: '',
        description: '',
        targetDate: '',
        priority: 'medium',
        course: ''
      });

      setNotification({ type: 'success', message: 'Study goal added successfully ✅' });
    } catch (err) {
      console.error('Failed to add goal', err);
      setNotification({ type: 'error', message: 'Something went wrong while adding the goal ❌' });
    }
  };

useEffect(() => {
  if (notification) {
    const timer = setTimeout(() => setNotification(null), 3000);
    return () => clearTimeout(timer);
  }
}, [notification]);


  const toggleGoalComplete = async (goalId: number | string) => {
    const current = studyGoals.find(g => g.id === goalId);
    if (!current) return;
    const nextCompleted = !current.completed;

    // optimistic local update
    setStudyGoals(prev => prev.map(goal => (goal.id === goalId ? { ...goal, completed: nextCompleted } : goal)));

    try {
      const { error } = await supabase
        .from('study_goals')
        .update({
          status: nextCompleted ? 'completed' : 'in_progress',
          completion_percentage: nextCompleted ? 100 : 0,
        })
        .eq('id', goalId);
      if (error) throw error;

      setNotification({
        type: 'success',
        message: nextCompleted ? 'Goal marked as completed 🎉' : 'Goal marked as incomplete ↩️'
      });
    } catch (err) {
      console.error('Failed to toggle goal', err);
      // revert optimistic update on failure
      setStudyGoals(prev => prev.map(goal => (goal.id === goalId ? { ...goal, completed: !nextCompleted } : goal)));
      setNotification({ type: 'error', message: 'Something went wrong updating the goal ❌' });
    }
  };

const deleteGoal = async (goalId: number | string) => {
  const previous = studyGoals;
  setStudyGoals(prev => prev.filter(goal => goal.id !== goalId));

  try {
    const { error } = await supabase.from('study_goals').delete().eq('id', goalId);
    if (error) throw error;
    setNotification({ type: 'success', message: 'Goal deleted 🗑️' });
  } catch (err) {
    console.error('Failed to delete goal', err);
    setStudyGoals(previous);
    setNotification({ type: 'error', message: 'Something went wrong deleting the goal ❌' });
  }
};
  const toggleYearExpansion = (yearSemester: string) => {
    setExpandedYears(prev => ({ ...prev, [yearSemester]: !prev[yearSemester] }));
  };

  /** Mark one announcement as read for this student — persisted via `announcement_reads`
   *  instead of being reset to unread on every reload. */
  const markAnnouncementRead = async (announcementId: number | string) => {
    if (!studentId) return;
    setAnnouncementsFromDB(prev => prev.map(a => (a.id === announcementId ? { ...a, read: true } : a)));
    try {
      const { error } = await supabase
        .from('announcement_reads')
        .upsert(
          { student_id: studentId, announcement_id: announcementId, read_at: new Date().toISOString() },
          { onConflict: 'student_id,announcement_id' }
        );
      if (error) throw error;
    } catch (err) {
      console.error('Failed to persist announcement read status', err);
    }
  };

  if (!user) return null;

  // derive semester options from loaded courses
  const semesterOptions = (() => {
    const sems = courses.map(c => c.semester).filter(Boolean);
    return ['all', ...Array.from(new Set(sems))];
  })();

  // filtered courses
  const filteredCourses = courses.filter(c =>
    (semesterFilter === 'all' || c.semester === semesterFilter) &&
    (courseFilter === 'all' || c.id?.toString() === courseFilter)
  );

  // average for a course, counting only graded assessments (ungraded ones no longer count as 0)
  const calculateStudentAverage = (assessments: any[]) => averagePercentage(assessments);

// usage in overall stats
const getOverallStats = () => {
  const totalCourses = courses.length || 0;
  const eligibleCourses = courses.filter(c => c.eligibleForExam).length;
  const avgCompletion = totalCourses === 0
    ? 0
    : Math.round(courses.reduce((sum, c) => sum + (c.completionPercentage || 0), 0) / totalCourses);
  
  const avgScore = totalCourses === 0
    ? 0
    : Math.round(courses.reduce((sum, course) => sum + calculateStudentAverage(course.assessments), 0) / totalCourses);

  return { totalCourses, eligibleCourses, avgCompletion, avgScore };
};


  // flattened assessments for UI from filtered courses
  const filteredAssessments = filteredCourses.flatMap(c =>
    (c.assessments || []).map((a: any) => ({ ...a, courseId: c.id, courseCode: c.code, courseName: c.name }))
  );

  const totalAssessmentsCount = filteredAssessments.length;
  // Only graded assessments contribute to the average — an assessment nobody has marked yet
  // is not a 0%.
  const avgScoreForFiltered = averagePercentage(filteredAssessments);

  const eligibleCountForFiltered = filteredCourses.filter(c => c.eligibleForExam).length;
  const filteredCoursesCount = filteredCourses.length;

  // events
  const filteredEvents = eventFilter === 'all' ? upcomingEvents : upcomingEvents.filter(e => e.type === eventFilter);

  // build map dateKey -> events
  const eventsByDate: Record<string, CalendarEvent[]> = {};
  (upcomingEvents || []).forEach(ev => {
    let key = String(ev.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
      const parsed = new Date(key);
      if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        key = `${y}-${m}-${d}`;
      }
    }
    if (!eventsByDate[key]) eventsByDate[key] = [];
    eventsByDate[key].push(ev);
  });

  // month nav
  const prevMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  const nextMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));

  // ----------------- DOWNLOAD / VIEW REPORTS (NEW) ------------------
  /**
   * generateReportHTML(type)
   * Produces a clean HTML string with inline styles that will render nicely when converted to PDF.
   * We include a compact stylesheet so the report looks modern even when opened in a new tab.
   */
  const generateReportHTML = (type: 'Semester Results' | 'Academic Record' | 'Full Transcript') => {
    const acad = academicRecord ?? {};
    const header = `
<div class="report-header" style="
  display:flex;
  align-items:center;
  gap:12px;
  margin-bottom:18px;
  font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
">
  <!-- Logo (blue cap) -->
  <div aria-hidden="true" style="display:flex;align-items:center;justify-content:center;">
    <svg width="36" height="20" viewBox="0 0 36 20" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Trackademy logo">
      <!-- cap -->
      <path d="M17.999 1.5 2 7.5l16 7 15-6.79V15a1 1 0 0 1-1 1h-2v1h4v1H2v-1h4v-1H4a1 1 0 0 1-1-1V13.71L18 9.5V1.5z" fill="#0B63D6"/>
      <!-- tassel -->
      <path d="M25.5 5.2c0 .83-1.5 1.5-3.33 1.5S18.84 6.03 18.84 5.2 20.34 3.7 22.17 3.7 25.5 4.37 25.5 5.2z" fill="#0B63D6" opacity="0.98"/>
    </svg>
  </div>

  <!-- Text -->
  <div style="line-height:1;">
    <div style="font-size:18px;font-weight:700;color:#0B63D6;letter-spacing:0.1px;">
      Trackademy
    </div>
    <!-- optional subtitle: remove if you don't want it -->
    <div style="font-size:12px;color:#6b7280;margin-top:2px;">
      Student Portal — Generated: ${new Date().toLocaleString()}
    </div>
  </div>
</div>
`;


    const style = `
      <style>
        body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color: #111827; padding: 24px; }
        .container { max-width: 820px; margin: 0 auto; }
        .card { background: #fff; border-radius: 10px; padding: 16px; box-shadow: 0 1px 4px rgba(2,6,23,0.06); margin-bottom: 12px; }
        .muted { color: #6b7280; font-size: 12px; }
        .grid { display: grid; gap: 12px; grid-template-columns: repeat(3, 1fr); }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #eef2f7; font-size: 13px; }
        th { color: #374151; font-weight: 600; }
        .small { font-size:12px; color:#6b7280; }
      </style>
    `;

    // academic summary block
    const summary = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div>
            <div style="font-weight:700;font-size:15px;color:#111827;">Academic Summary</div>
            <div class="muted">Student: ${user?.name ?? '-'} • Number: ${user?.userNumber ?? '-'}</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700;font-size:18px;color:#111827;">GPA: ${acad?.currentGPA ?? '-'}</div>
            <div class="small">Credits: ${acad?.completedCredits ?? 0}/${acad?.totalCredits ?? '-'}</div>
          </div>
        </div>
      </div>
    `;

    // records table
    const recordsHtml = (Array.isArray(acad?.records) ? acad.records : []).map((rec: any) => {
      const rows = (rec.courses || []).map((c: any) => `
        <tr>
          <td>${c.code ?? '-'}</td>
          <td>${c.name ?? '-'}</td>
          <td>${c.finalMark ?? '-'}</td>
          <td>${c.result ?? '-'}</td>
          <td>${c.credits ?? 0}</td>
        </tr>
      `).join('');
      return `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div style="font-weight:700">Year ${rec.year} • Semester ${rec.semester}</div>
            <div class="small">${(rec.courses || []).length} courses</div>
          </div>
          <div style="overflow:auto">
            <table>
              <thead>
                <tr><th>Code</th><th>Subject</th><th>Final</th><th>Result</th><th>Credits</th></tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');

    // optionally include course-level assessments for Semester Results only
    let courseSection = '';
    if (type === 'Semester Results') {
      courseSection = (courses || []).map((c: any) => {
        const assessRows = (c.assessments || []).map((a: any) => `
          <tr>
            <td>${a.type}</td>
            <td>${a.score ?? '—'}/${a.maxScore ?? '-'}</td>
            <td>${a.weight ?? 0}%</td>
          </tr>
        `).join('');

        return `
          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <div style="font-weight:700">${c.code} — ${c.name}</div>
              <div class="small">Progress: ${c.completionPercentage ?? 0}%</div>
            </div>
            <table>
              <thead>
                <tr><th>Assessment</th><th>Score</th><th>Weight</th></tr>
              </thead>
              <tbody>
                ${assessRows}
              </tbody>
            </table>
          </div>
        `;
      }).join('');
    }

    // build final HTML
    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>${type}</title>
          ${style}
        </head>
        <body>
          <div class="container">
            ${header}
            ${summary}
            ${recordsHtml}
            ${courseSection}
            <div style="margin-top:18px;font-size:12px;color:#6b7280;">Generated by Trackademy. Student Portal</div>
          </div>
        </body>
      </html>
    `;

    return html;
  };

  /**
   * downloadAndOpenAsPDF
   * Tries to create a real PDF using html2canvas + jsPDF (client-side). If those libs are not available
   * it falls back to opening a printable HTML in a new tab (user can Save as PDF from Print dialog).
   */
  const downloadAndOpenAsPDF = async (type: 'Semester Results' | 'Academic Record' | 'Full Transcript') => {
    try {
      const html = generateReportHTML(type);

      // create an offscreen container to render the HTML with the site's styles
      const wrapper = document.createElement('div');
      wrapper.style.position = 'fixed';
      wrapper.style.left = '-9999px';
      wrapper.style.top = '0';
      wrapper.style.width = '820px';
      wrapper.innerHTML = html;
      document.body.appendChild(wrapper);

      // Try to dynamically import html2canvas + jspdf
      let html2canvas: any = null;
      let jsPDF: any = null;
      try {
        // html2canvas default export
        const html2canvasModule = await import('html2canvas');
        html2canvas = html2canvasModule?.default ?? html2canvasModule;

        // jspdf exports vary between versions: prefer named export `jsPDF`, then `default`, then module itself
        const jspdfModule = await import('jspdf');
        jsPDF = (jspdfModule && ((jspdfModule as any).jsPDF ?? (jspdfModule as any).default ?? jspdfModule)) as any;
      } catch (impErr) {
        // library not installed — fallback will handle later
        html2canvas = null;
        jsPDF = null;
      }

      const filename = `${type.toLowerCase().replace(/\s+/g, '_')}_${(user?.userNumber || 'student')}.pdf`;

      if (html2canvas && jsPDF) {
        // Render the wrapper to canvas, then to PDF pages (A4 size)
        const canvas = await html2canvas(wrapper, { scale: 2, useCORS: true, allowTaint: true });
        const imgData = canvas.toDataURL('image/jpeg', 1.0);

        const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        // Draw the full image on page 1, then keep adding pages — shifting the image up by one
        // page height each time — only while content genuinely remains below the fold. The
        // previous `heightLeft > -1` condition always added one extra, unwanted page.
        let heightLeft = pdfHeight - pageHeight;
        let position = 0;
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);

        while (heightLeft > 0) {
          position = heightLeft - pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
          heightLeft -= pageHeight;
        }

        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);

        // trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();

        // open in new tab for immediate viewing
        window.open(url, '_blank');

        // cleanup
        URL.revokeObjectURL(url);
        wrapper.remove();
        return;
      }

      // FALLBACK: open printable HTML in a new tab; user can use "Save as PDF" in Print dialog
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');

      // keep the offscreen wrapper only briefly then remove
      setTimeout(() => { try { wrapper.remove(); } catch { } }, 2000);

    } catch (err) {
      console.error('Failed to generate report', err);
      setNotification({ type: 'error', message: 'Failed to generate report. Please try again.' });
    }
  };

  // --- Updated handleDownload to call the real generator ---
  const handleDownload = (type: string) => {
    if (type === 'Semester Results' || type === 'Academic Record' || type === 'Full Transcript') {
      // cast and call
      downloadAndOpenAsPDF(type as any);
    } else {
      // generic fallback
      const link = document.createElement('a');
      link.href = '#';
      link.download = `${type.toLowerCase().replace(' ', '_')}.pdf`;
      link.click();
      setShowDownloadMenu(false);
    }
    setShowDownloadMenu(false);
  };

  const renderDashboard = () => {
    const stats = getOverallStats();
    const upcomingDeadlines = (upcomingEvents || []).filter(event =>
      new Date(event.date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    ).slice(0, 5);

    return (
      <div className="space-y-8">
        {/* Welcome */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold mb-2">Welcome back, {user.name}!</h1>
              <p className="text-blue-100 mb-4">Here's your academic overview for today</p>
              <div className="flex items-center space-x-4 text-sm">
                <span className="flex items-center">
                  <Award className="h-4 w-4 mr-1" />
                  GPA: {academicRecord?.currentGPA ?? '—'}
                </span>
                <span className="flex items-center">
                  <BookOpen className="h-4 w-4 mr-1" />
                  Year {academicRecord?.yearOfStudy ?? '—'}
                </span>
                <span className="flex items-center">
                  <Users className="h-4 w-4 mr-1" />
                  {academicRecord?.program ?? '—'}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{stats.avgScore}%</div>
              <div className="text-sm text-blue-100">Overall Average</div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <BookOpen className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Enrolled Courses</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalCourses}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Exam Eligible</p>
                <p className="text-2xl font-bold text-gray-900">{stats.eligibleCourses}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Completion</p>
                <p className="text-2xl font-bold text-gray-900">{stats.avgCompletion}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Upcoming Events</p>
                <p className="text-2xl font-bold text-gray-900">{upcomingDeadlines.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Course Overview */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Course Progress</h3>
                <button 
                  onClick={() => setActiveTab('courses')}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
                >
                  View All <ChevronRight className="h-4 w-4 ml-1" />
                </button>
              </div>
              <div className="space-y-4">
                {courses.map((course) => {
                  const average = calculateStudentAverage(course.assessments || []);
                  return (
                    <div key={course.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900">{course.name}</h4>
                          <p className="text-sm text-gray-600">{course.code} • {course.lecturer}</p>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold ${average >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                            {average}%
                          </div>
                          <div className="text-xs text-gray-500">Average</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <div className="text-sm text-gray-600 mb-1">Course Progress</div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full"
                              style={{ width: `${course.completionPercentage ?? 0}%` }}
                            ></div>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{course.completionPercentage ?? 0}% Complete</div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>Next: {course.nextClass?.topic ?? ''}</span>
                          <span>{course.nextClass?.date ?? ''} at {course.nextClass?.time ?? ''}</span>
                        </div>
                        {course.eligibleForExam ? (
                          <span className="flex items-center text-green-600 text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Exam Eligible
                          </span>
                        ) : (
                          <span className="flex items-center text-red-600 text-xs">
                            <XCircle className="h-3 w-3 mr-1" />
                            Not Eligible
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Study Goals */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Study Goals</h3>
                <button
                  onClick={() => setShowGoalModal(true)}
                  className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-700 transition-colors flex items-center"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Goal
                </button>
              </div>
              <div className="space-y-3">
                {studyGoals.slice(0, 3).map((goal) => (
                  <div key={goal.id} className={`p-3 rounded-lg border ${goal.completed ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <button
                          onClick={() => toggleGoalComplete(goal.id)}
                          className={`mt-1 w-4 h-4 rounded border-2 flex items-center justify-center ${
                            goal.completed ? 'bg-green-500 border-green-500' : 'border-gray-300'
                          }`}
                        >
                          {goal.completed && <CheckCircle className="h-3 w-3 text-white" />}
                        </button>
                        <div>
                          <h4 className={`font-medium ${goal.completed ? 'text-green-800 line-through' : 'text-gray-900'}`}>
                            {goal.title}
                          </h4>
                          <p className={`text-sm ${goal.completed ? 'text-green-600' : 'text-gray-600'}`}>
                            {goal.description}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              goal.priority === 'high' ? 'bg-red-100 text-red-800' :
                              goal.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {goal.priority}
                            </span>
                            <span className="text-xs text-gray-500">{goal.course}</span>
                            <span className="text-xs text-gray-500">Due: {goal.targetDate}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteGoal(goal.id)}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {studyGoals.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No study goals set. Create your first goal to get started!</p>
                )}
                {studyGoals.length > 3 && (
                  <button 
                    onClick={() => setActiveTab('study-tools')}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    View all {studyGoals.length} goals
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Upcoming Deadlines */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Deadlines</h3>
              <div className="space-y-3">
                {upcomingEvents.slice(0,5).map((event) => (
                  <div key={event.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      event.type === 'exam' ? 'bg-red-500' :
                      event.type === 'assignment' ? 'bg-blue-500' :
                      event.type === 'registration' ? 'bg-purple-500' :
                      'bg-green-500'
                    }`}></div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 text-sm">{event.title}</h4>
                      <p className="text-xs text-gray-600">{event.date} at {event.time}</p>
                      {event.venue && <p className="text-xs text-gray-500">{event.venue}</p>}
                    </div>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setActiveTab('calendar')}
                className="w-full mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                View Full Calendar
              </button>
            </div>

            {/* Recent Announcements */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Announcements</h3>
                <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                  {(announcementsFromDB || []).filter(a => !a.read).length} new
                </span>
              </div>
              <div className="space-y-3">
                {(announcementsFromDB || []).slice(0, 3).map((announcement) => (
                  <div 
                    key={announcement.id} 
                    className={`p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors ${
                      !announcement.read ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                    }`}
                    onClick={() => {
                      setSelectedAnnouncement(announcement);
                      setShowAnnouncementModal(true);
                      markAnnouncementRead(announcement.id);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 text-sm">{announcement.title}</h4>
                        <p className="text-xs text-gray-600 mt-1">{announcement.sender}</p>
                        <p className="text-xs text-gray-500">{announcement.date}</p>
                      </div>
                      {!announcement.read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setActiveTab('communication')}
                className="w-full mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                View All Announcements
              </button>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <button 
                  onClick={() => setActiveTab('records')}
                  className="w-full flex items-center justify-between p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <span className="flex items-center text-blue-900">
                    <Download className="h-4 w-4 mr-2" />
                    Download Transcript
                  </span>
                  <ChevronRight className="h-4 w-4 text-blue-600" />
                </button>
                <button 
                  onClick={() => setActiveTab('timetable')}
                  className="w-full flex items-center justify-between p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                >
                  <span className="flex items-center text-green-900">
                    <Calendar className="h-4 w-4 mr-2" />
                    View Timetable
                  </span>
                  <ChevronRight className="h-4 w-4 text-green-600" />
                </button>
                <button 
                  onClick={() => setActiveTab('assessments')}
                  className="w-full flex items-center justify-between p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                >
                  <span className="flex items-center text-purple-900">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Assessment Tracking
                  </span>
                  <ChevronRight className="h-4 w-4 text-purple-600" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };


  const renderCourses = () => (
    <div className="space-y-6">
     

      <div className="flex space-x-2">
        <select
          value={semesterFilter}
          onChange={(e) => setSemesterFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {semesterOptions.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All Semesters' : s}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredCourses.map((course) => {
          const average = calculateStudentAverage(course.assessments || []);
          return (
            <div key={course.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{course.name}</h3>
                  <p className="text-gray-600">{course.code} • {course.lecturer}</p>
                  <div className="flex items-center space-x-4 text-sm text-gray-500 mt-2">
                    <span>{course.credits} Credits</span>
                    <span>{course.semester}</span>
                  </div>
                </div>
                <div className="text-right">
                  {course.eligibleForExam ? (
                    <div className="flex items-center space-x-1 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                      <CheckCircle className="h-4 w-4" />
                      <span>Exam Eligible</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm">
                      <XCircle className="h-4 w-4" />
                      <span>Not Eligible</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Assessments */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900 flex items-center">
                    <FileText className="h-4 w-4 mr-2" />
                    Assessments
                  </h4>
                  {(course.assessments || []).map((assessment: any, index: number) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="text-sm text-gray-600">{assessment.type}</span>
                        <div className="text-xs text-gray-500">{assessment.due_date}</div>
                      </div>
                      <div className="text-right">
                        <span className="font-medium text-gray-900">
                          {assessment.score != null ? assessment.score : '—'}/{assessment.maxScore ?? 0}
                        </span>
                        <div className="text-xs text-gray-500">{assessment.weight}% weight</div>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <span className="text-sm font-medium text-blue-900">Average</span>
                    <span className="font-bold text-blue-900">{average}%</span>
                  </div>
                </div>

                {/* Progress & Attendance */}
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Course Progress</h4>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-gray-900 mb-1">{course.completionPercentage ?? 0}%</div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${course.completionPercentage ?? 0}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Upcoming */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Upcoming</h4>
                  <div className="space-y-2">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="text-sm font-medium text-blue-900">Next Class</div>
                      <div className="text-xs text-blue-700">{course.nextClass?.topic}</div>
                      <div className="text-xs text-blue-600">{course.nextClass?.date} at {course.nextClass?.time}</div>
                      <div className="text-xs text-blue-600">{course.nextClass?.venue}</div>
                    </div>
                    {(course.upcomingAssessments || []).map((assessment: any, index: number) => (
                      <div key={index} className="p-3 bg-orange-50 rounded-lg">
                        <div className="text-sm font-medium text-orange-900">{assessment.type}</div>
                        <div className="text-xs text-orange-700">{assessment.due_date}</div>
                        <div className="text-xs text-orange-600">{assessment.venue ?? ''} • {assessment.weight ?? ''}% weight</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderAssessments = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Assessment Tracking</h2>
        <div className="flex items-center space-x-3">
          <select
            value={semesterFilter}
            onChange={(e) => { setSemesterFilter(e.target.value); setCourseFilter('all'); }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {semesterOptions.map(s => (
              <option key={s} value={s}>{s === 'all' ? 'All Semesters' : s}</option>
            ))}
          </select>

          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Courses</option>
            {filteredCourses.map(course => (
              <option key={course.id} value={course.id?.toString()}>
                {course.code} — {course.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Assessments</p>
              <p className="text-3xl font-bold text-blue-600">{totalAssessmentsCount}</p>
            </div>
            <FileText className="h-12 w-12 text-blue-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Score</p>
              <p className="text-3xl font-bold text-green-600">{avgScoreForFiltered}%</p>
            </div>
            <TrendingUp className="h-12 w-12 text-green-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Exam Eligible</p>
              <p className="text-3xl font-bold text-purple-600">
                {filteredCoursesCount === 0 ? `0/0` : `${eligibleCountForFiltered}/${filteredCoursesCount}`}
              </p>
            </div>
            <CheckCircle className="h-12 w-12 text-purple-600 opacity-20" />
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Assessment Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assessment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAssessments.map((assessment, idx) => {
                const graded = isGraded(assessment);
                const pct = graded ? Number(assessment.percentage) : 0;
                return (
                  <tr key={`${assessment.courseId}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{assessment.courseCode}</div>
                      <div className="text-sm text-gray-500">{assessment.courseName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{assessment.type}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${
                        !graded ? 'text-gray-400' : pct >= 50 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {assessment.score != null ? assessment.score : '—'}/{assessment.maxScore ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{assessment.weight}%</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{assessment.due_date}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {graded ? (
                        <>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                pct >= 75 ? 'bg-green-500' :
                                pct >= 50 ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{pct}%</div>
                        </>
                      ) : (
                        <div className="text-xs text-gray-400">Not graded yet</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // --- Study Tools (uses `studyGoals` from state) ---
const renderStudyTools = () => (
  <div className="space-y-6">
    {notification && (
  <div
    className={`fixed top-5 right-5 px-4 py-3 rounded-lg shadow-lg text-white transition-all ${
      notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
    }`}
  >
    <div className="flex items-center space-x-2">
      {notification.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
      <span>{notification.message}</span>
    </div>
    <button
      className="ml-3 text-sm underline"
      onClick={() => setNotification(null)}
    >
      Close
    </button>
  </div>
)}

    <div className="flex justify-between items-center">
      <h2 className="text-2xl font-bold text-gray-900">Study Tools</h2>
      <button
        onClick={() => setShowGoalModal(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Study Goal
      </button>
    </div>

    {/* Study Goals */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Study Goals & Planner</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {studyGoals.map((goal) => (
          <div
            key={goal.id}
            className={`p-4 rounded-lg border ${
              goal.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start space-x-3">
                <button
                  onClick={() => toggleGoalComplete(goal.id)}
                  className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center ${
                    goal.completed ? 'bg-green-500 border-green-500' : 'border-gray-300'
                  }`}
                >
                  {goal.completed && <CheckCircle className="h-4 w-4 text-white" />}
                </button>
                <div className="flex-1">
                  <h4 className={`font-medium ${goal.completed ? 'text-green-800 line-through' : 'text-gray-900'}`}>
                    {goal.title}
                  </h4>
                </div>
              </div>
              <button onClick={() => deleteGoal(goal.id)} className="text-gray-400 hover:text-red-600 transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <p className={`text-sm mb-3 ${goal.completed ? 'text-green-600' : 'text-gray-600'}`}>{goal.description}</p>

            <div className="flex items-center justify-between">
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  goal.priority === 'high' ? 'bg-red-100 text-red-800' : goal.priority === 'medium'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {goal.priority}
              </span>
              <span className="text-xs text-gray-500">{goal.targetDate}</span>
            </div>

            <div className="mt-2 text-xs text-gray-500">{goal.course}</div>
          </div>
        ))}

        {studyGoals.length === 0 && (
          <div className="col-span-full text-center py-8">
            <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No study goals set yet. Create your first goal to get started!</p>
          </div>
        )}
      </div>
    </div>

    {/* Study Statistics */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Goals</p>
            <p className="text-3xl font-bold text-blue-600">{studyGoals.length}</p>
          </div>
          <Target className="h-12 w-12 text-blue-600 opacity-20" />
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Completed</p>
            <p className="text-3xl font-bold text-green-600">{studyGoals.filter(g => g.completed).length}</p>
          </div>
          <CheckCircle className="h-12 w-12 text-green-600 opacity-20" />
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Completion Rate</p>
            <p className="text-3xl font-bold text-purple-600">
              {studyGoals.length > 0 ? Math.round((studyGoals.filter(g => g.completed).length / studyGoals.length) * 100) : 0}%
            </p>
          </div>
          <PieChart className="h-12 w-12 text-purple-600 opacity-20" />
        </div>
      </div>
    </div>
  </div>
);

// Replace your existing `renderCalendar` with this version (defines the missing helpers inside the function)
// ✅ Full updated renderCalendar — dynamic event types and colors
const renderCalendar = () => {
  // --- month helpers ---
  const monthStart = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
  const monthStartWeekday: number = monthStart.getDay(); // 0 = Sun .. 6 = Sat
  const daysInMonth: number = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate();

  const formatDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // --- normalize and group events by date ---
  const eventsByDate: Record<string, CalendarEvent[]> = {};
  (upcomingEvents || []).forEach(ev => {
    let key = String(ev.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
      const parsed = new Date(key);
      if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        key = `${y}-${m}-${d}`;
      }
    }
    if (!eventsByDate[key]) eventsByDate[key] = [];
    eventsByDate[key].push(ev);
  });

  // --- filter events ---
  const filteredEvents =
    eventFilter === 'all'
      ? upcomingEvents
      : (upcomingEvents || []).filter(e => e.type === eventFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Academic Calendar</h2>

        {/* Event type filter */}
        <div className="flex space-x-2 items-center">
          <label className="text-sm text-gray-600 mr-2">Show</label>
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Events</option>
            {/* event_types.name is stored lowercase in the DB ('exam', 'assignment', ...), and
                events are tagged with that exact lowercase value — these option values must
                match it, or the filter silently matches nothing. */}
            <option value="exam">Exams</option>
            <option value="assignment">Assignments</option>
            <option value="lecture">Lectures</option>
            <option value="registration">Registration</option>
            <option value="holiday">Holidays</option>
          </select>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <button onClick={prevMonth} className="p-2 rounded hover:bg-gray-100">‹</button>
            <div className="text-lg font-semibold">
              {calendarDate.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
            </div>
            <button onClick={nextMonth} className="p-2 rounded hover:bg-gray-100">›</button>
          </div>
          <div className="text-sm text-gray-600">
            Click a day to see events (colored badges show event types)
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-2 text-xs text-center text-gray-500 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="font-medium">{d}</div>
          ))}
        </div>

        {/* Month grid */}
        <div className="grid grid-cols-7 gap-2">
          {/* Empty cells for offset */}
          {Array.from({ length: monthStartWeekday }).map((_, i) => (
            <div key={`blank-${i}`} className="h-28 p-2 border border-transparent"></div>
          ))}

          {/* Calendar days */}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dateObj = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
            const dateKey = formatDateKey(dateObj);
            const dayEvents = (eventsByDate[dateKey] || []).filter(ev =>
              eventFilter === 'all' ? true : ev.type === eventFilter
            );

            return (
              <div key={dateKey} className="h-28 p-2 border rounded-lg flex flex-col overflow-hidden hover:bg-gray-50 transition">
                <div className="flex items-start justify-between">
                  <div className="text-sm font-medium text-gray-700">{day}</div>
                  {dayEvents.length > 0 && (
                    <div className="text-xs text-white bg-blue-600 rounded-full px-2 py-0.5">
                      {dayEvents.length}
                    </div>
                  )}
                </div>

                <div className="mt-2 overflow-hidden">
                  {dayEvents.slice(0, 2).map(ev => (
                    <div
                      key={ev.id}
                      className="mb-1 text-xs truncate px-1 py-0.5 rounded text-white"
                      title={`${ev.title} • ${ev.time}`}
                      style={{ backgroundColor: ev.color || '#6b7280' }}
                    >
                      {ev.type}: {ev.title}
                    </div>
                  ))}

                  {dayEvents.length > 2 && (
                    <div className="text-xs text-gray-500 mt-1">
                      +{dayEvents.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming Events List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Upcoming Events ({filteredEvents.length})
        </h3>

        <div className="space-y-4">
          {filteredEvents.length === 0 && (
            <div className="text-sm text-gray-500">No events match the selected filter.</div>
          )}

          {filteredEvents.map((event) => (
            <div
              key={event.id}
              className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
            >
              {/* Dot color */}
              <div
                className="w-3 h-3 rounded-full mt-2"
                style={{ backgroundColor: event.color || '#6b7280' }}
              ></div>

              {/* Details */}
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-gray-900">{event.title}</h4>
                    <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                      <span className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {event.date}
                      </span>
                      <span className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {event.time}
                      </span>
                      {event.venue && (
                        <span className="flex items-center">
                          <MapPin className="h-4 w-4 mr-1" />
                          {event.venue}
                        </span>
                      )}
                    </div>
                    {event.course && (
                      <span className="inline-block mt-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {event.course}
                      </span>
                    )}
                  </div>

                  {/* Type badge */}
                  <span
                    className="px-2 py-1 text-xs font-medium rounded-full capitalize"
                    style={{
                      backgroundColor: `${event.color}20`,
                      color: event.color || '#111827'
                    }}
                  >
                    {event.type}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};



// --- Timetable: renders the student's REAL weekly schedule from `course_schedules`,
// instead of the previous fake `courses[(col + row) % n]` fill pattern. ---
const renderTimetable = () => {
  const dayColumns: Array<{ key: string; label: string }> = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
  ];

  const timeSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];

  const toMinutes = (t: string) => {
    const [h, m] = String(t || '00:00').slice(0, 5).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const courseById: Record<string, any> = Object.fromEntries(courses.map(c => [String(c.id), c]));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Class Timetable</h2>
      </div>

      {/* Weekly Timetable */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Weekly Schedule</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                {dayColumns.map(day => (
                  <th key={day.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{day.label}</th>
                ))}
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {timeSlots.map((slot) => {
                const slotStart = toMinutes(slot);
                const slotEnd = slotStart + 60;
                const [h] = slot.split(':').map(Number);
                const nextLabel = `${String((h + 1) % 24).padStart(2, '0')}:00`;

                return (
                  <tr key={slot} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{slot}-{nextLabel}</td>

                    {dayColumns.map(day => {
                      // Real schedule entries that overlap this hour slot, on this real weekday.
                      const entries = (courseSchedules || []).filter((cs: any) => {
                        if (String(cs.day_of_week ?? '').toLowerCase() !== day.key) return false;
                        const csStart = toMinutes(cs.start_time);
                        const csEnd = toMinutes(cs.end_time);
                        return csStart < slotEnd && csEnd > slotStart;
                      });

                      return (
                        <td key={day.key} className="px-6 py-4 align-top">
                          {entries.map((e: any) => {
                            const course = courseById[String(e.course_id)];
                            return (
                              <div key={e.id} className="p-2 mb-1 bg-blue-50 rounded border-l-4 border-blue-500">
                                <div className="text-sm font-medium text-blue-900">
                                  {course?.code ?? 'Course'}
                                </div>
                                <div className="text-xs text-blue-700">
                                  {String(e.start_time).slice(0, 5)}–{String(e.end_time).slice(0, 5)}
                                </div>
                                <div className="text-xs text-blue-700">{e.venue ?? 'TBA'}</div>
                              </div>
                            );
                          })}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {courseSchedules.length === 0 && (
          <div className="p-6 text-sm text-gray-500 text-center">No scheduled classes found for your enrolled courses.</div>
        )}
      </div>
    </div>
  );
};

// --- Records (uses `academicRecord`, `courses`, `announcementsFromDB`) ---
const renderRecords = () => {
  const acad = academicRecord ?? {};
// Program / qualification (prefer `academicRecord.program`)
// handle both shapes: acad.program can be a string, or an object { name, ... }
const qualificationName = (typeof acad?.program === 'string' ? acad.program : (acad?.program?.name ?? acad?.qualification?.name ?? acad?.program ?? null));
const qualificationCode = acad?.qualification?.code ?? '';
const records = Array.isArray(acad?.records) ? acad.records : [];

/**
 * Total credits possible:
 *  - prefer program total (acad.totalCredits or acad.total_credits)
 *  - fallback: sum credits across all record courses (if program total missing)
 */
const totalCreditsFromProgram = acad?.totalCredits ?? acad?.total_credits ?? null;
const sumCreditsFromRecords = records.reduce((rsum: number, r: any) => {
  return rsum + ((r.courses || []).reduce((csum: number, c: any) => csum + (Number(c.credits) || 0), 0));
}, 0);
const totalCreditsRequired = totalCreditsFromProgram ?? (sumCreditsFromRecords || null);

/**
 * Completed credits:
 *  - prefer acad.completedCredits
 *  - fallback: sum credits for courses with passing finalMark (>=50) in records
 */
const completedCreditsFromAcad = acad?.completedCredits ?? acad?.completed_credits ?? null;
const completedCreditsFallback = records.reduce((rsum: number, r: any) => {
  return rsum + ((r.courses || []).reduce((csum: number, c: any) => {
    const finalMark = Number(c.finalMark ?? 0);
    return csum + ((finalMark >= 50) ? (Number(c.credits) || 0) : 0);
  }, 0));
}, 0);
const completedCredits = completedCreditsFromAcad ?? completedCreditsFallback ?? 0;

/** Overall progress percentage (rounded) */
const overallProgressPct = totalCreditsRequired ? Math.round((Number(completedCredits) / Number(totalCreditsRequired || 1)) * 100) : 0;

/**
 * Helper: get assessments for a course from multiple possible sources:
 *  - the `course` object itself (course.assessments)
 *  - the grouped records (academicRecord.records)
 *  - the `courses` state (mappedCourses)
 */
const getAssessmentsForCourse = (course: any) => {
  if (Array.isArray(course.assessments) && course.assessments.length) return course.assessments;

  // search in academicRecord.records
  for (const rec of records) {
    const found = (rec.courses || []).find((c: any) => {
      // match by id or code
      if (course.id && c.id && String(c.id) === String(course.id)) return true;
      if (course.code && c.code && String(c.code) === String(course.code)) return true;
      return false;
    });
    if (found && Array.isArray(found.assessments) && found.assessments.length) return found.assessments;
  }

  // fallback: search global courses state (mappedCourses)
  const mapped = (courses || []).find((c: any) => c && ((course.id && String(c.id) === String(course.id)) || (course.code && c.code === course.code)));
  if (mapped && Array.isArray(mapped.assessments) && mapped.assessments.length) return mapped.assessments;

  return [];
};

/** Normaliser: for an assessment entry, return consistent fields ({ id, name/type, score, max, weight, percentage, marks_field }) */
const normalizeAssessment = (a: any) => {
  const hasScore = a.score !== null && a.score !== undefined;
  const score = hasScore ? Number(a.score) : null;
  const max = Number(a.maxScore ?? a.maximum_marks ?? a.maxMarks ?? 100) || 100;
  const weight = a.weight ?? a.weight_percentage ?? a.weightPercentage ?? 0;
  const percentage = a.percentage !== null && a.percentage !== undefined
    ? Number(a.percentage)
    : (hasScore && max > 0 ? Math.round(((score as number) / max) * 100) : null);
  return {
    id: a.id ?? a.assessment_id ?? null,
    name: a.type ?? a.name ?? 'Assessment',
    score,
    max,
    weight,
    percentage,
    raw: a
  };
};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Academic Records</h2>

        <div className="relative">
          <button
            onClick={() => setShowDownloadMenu(!showDownloadMenu)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Download Records</span>
          </button>

          {showDownloadMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
              <div className="py-2">
                <button onClick={() => handleDownload && handleDownload("Semester Results")} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2">
                  <FileText className="h-4 w-4" />
                  <div>
                    <div className="font-medium">Semester Results</div>
                    <div className="text-xs text-gray-500">Current semester grades</div>
                  </div>
                </button>

                <button onClick={() => handleDownload && handleDownload("Academic Record")} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2">
                  <Award className="h-4 w-4" />
                  <div>
                    <div className="font-medium">Academic Record</div>
                    <div className="text-xs text-gray-500">Yearly academic summary</div>
                  </div>
                </button>

                <button onClick={() => handleDownload && handleDownload("Full Transcript")} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2">
                  <BookOpen className="h-4 w-4" />
                  <div>
                    <div className="font-medium">Full Transcript</div>
                    <div className="text-xs text-gray-500">Complete academic history</div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Academic Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Academic Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{acad?.currentGPA ?? '-'}</div>
            <div className="text-sm text-gray-600">Current GPA</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{completedCredits ?? '-'}</div>
            <div className="text-sm text-gray-600">Credits Completed</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{acad?.yearOfStudy ?? '-'}</div>
            <div className="text-sm text-gray-600">Year of Study</div>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{totalCreditsRequired ?? '-'}</div>
            <div className="text-sm text-gray-600">Total Credits Required</div>
          </div>
        </div>
      </div>

      {/* Qualification Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Award className="h-6 w-6 text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Qualification: {qualificationName ? qualificationName : (qualificationCode ? qualificationCode : '-')}
            </h3>
            <div className="text-sm text-gray-600">Program: {qualificationName ?? '-'}</div>
          </div>
        </div>
      </div>

      {/* Records by Year/Semester */}
      <div className="space-y-4">
        {records.map((record: any, recordIndex: number) => {
          const key = `${record.year}-${record.semester}-${recordIndex}`;
          const isExpanded = !!expandedYears?.[key];
          const avg = Array.isArray(record.courses) && record.courses.length
            ? Math.round(record.courses.reduce((s: number, c: any) => s + (Number(c.finalMark ?? 0)), 0) / record.courses.length)
            : 0;

          return (
            <div key={recordIndex} className="bg-white rounded-lg shadow-sm border border-gray-200">
              <button onClick={() => toggleYearExpansion(key)} className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center space-x-3">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <div className="text-left">
                    <h4 className="text-lg font-semibold text-gray-900">Year: {record.year} - {record.semester}</h4>
                    <p className="text-sm text-gray-600">{(record.courses?.length ?? 0)} courses • Average: {avg}%</p>
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
              </button>

              {isExpanded && (
                <div className="border-t border-gray-200">
                  {Array.isArray(record.courses) && record.courses.map((course: any, idx: number) => (
                    <div key={idx} className="p-6 border-b border-gray-100 last:border-b-0">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h5 className="text-lg font-semibold text-gray-900">Subject: {course.code} - {course.name}</h5>
                          <p className="text-sm text-gray-600 mt-1">Academic Period: {record.semester}</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center space-x-4 text-sm">
                            <span className="text-gray-600">Coursework Average: <span className="font-semibold text-gray-900">{course.courseworkAverage ?? '-'}</span></span>
                            <span className="text-gray-600">Final Mark: <span className="font-semibold text-gray-900">{course.finalMark ?? '-'}</span></span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${String(course.result).toUpperCase() === 'PASS' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>Result: {course.result ?? '-'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Assessment Breakdown */}
<div className="bg-gray-50 rounded-lg p-4">
  <h6 className="text-sm font-medium text-gray-900 mb-3">Assessment Breakdown</h6>

  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
    {(() => {
      const assessments = getAssessmentsForCourse(course) || [];
      if (!assessments || assessments.length === 0) {
        return <div className="text-sm text-gray-500 col-span-full">No assessments recorded for this course.</div>;
      }

      return assessments.map((ass: any, ai: number) => {
        const n = normalizeAssessment(ass);
        const pct = n.percentage ?? 0;
        const barClass = pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-red-500';
        return (
          <div key={ai} className="bg-white p-3 rounded border">
            <div className="text-xs font-medium text-gray-600 mb-1">{n.name}</div>
            <div className="text-lg font-semibold text-gray-900">{n.score ?? '—'}/{n.max}</div>
            <div className="text-xs text-gray-500">Weight: {n.weight}% • {n.percentage != null ? `${n.percentage}%` : 'Not graded'}</div>
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
            {/* optionally show submission/graded info if available */}
            {ass?.submitted_date || ass?.graded_date ? (
              <div className="text-xs text-gray-400 mt-2">
                {ass?.submitted_date ? `Submitted: ${new Date(ass.submitted_date).toLocaleDateString()}` : null}
                {ass?.graded_date ? ` • Graded: ${new Date(ass.graded_date).toLocaleDateString()}` : null}
              </div>
            ) : null}
          </div>
        );
      });
    })()}
  </div>
</div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Degree Progress */}
<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
  <h3 className="text-lg font-semibold text-gray-900 mb-4">Degree Progress</h3>
  <div className="space-y-4">
    <div>
      <div className="flex justify-between text-sm text-gray-600 mb-2">
        <span>Overall Progress</span>
        <span>{Number(completedCredits) ?? 0}/{totalCreditsRequired ?? '-'} credits</span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className="bg-blue-500 h-3 rounded-full"
          style={{ width: `${Math.max(0, Math.min(100, overallProgressPct))}%` }}
        />
      </div>

      <div className="text-xs text-gray-500 mt-1">
        {totalCreditsRequired ? `${overallProgressPct}% Complete` : 'Total credits required not available'}
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="text-sm font-medium text-gray-900 mb-2">Program Information</div>
        <div className="space-y-1 text-sm text-gray-600">
          <div>Program: {qualificationName ?? (qualificationCode ? qualificationCode : '-')}</div>
          <div>Department: {acad?.department ?? '-'}</div>
          <div>Expected Graduation: {acad?.expectedGraduation ?? '-'}</div>
        </div>
      </div>

      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="text-sm font-medium text-gray-900 mb-2">Academic Standing</div>
        <div className="space-y-1 text-sm text-gray-600">
          <div>Status: {acad?.standing ?? 'Good Standing'}</div>
          <div>Dean's List: {acad?.deans_list ?? '—'}</div>
          <div>Honors: {acad?.honors ?? '—'}</div>
        </div>
      </div>
    </div>
  </div>
</div>

    </div>
  );
};


  // Replace your existing renderCommunication with this typed version.
// It uses `announcementsFromDB` and `upcomingEvents` (state variables from the component),
// fixes implicit `any` parameters, and adds a "Mark All Read" handler.

const renderCommunication = () => {
  const announcements: Announcement[] = announcementsFromDB || [];
  const events: CalendarEvent[] = upcomingEvents || [];

  const unreadCount = announcements.filter((ann: Announcement) => !ann.read).length;

  const handleMarkAllRead = async () => {
    const unread = announcements.filter((a: Announcement) => !a.read);
    if (unread.length === 0) return;

    // optimistic local update
    setAnnouncementsFromDB(prev => prev.map((a: Announcement) => ({ ...a, read: true })));

    if (!studentId) return;
    try {
      const rows = unread.map(a => ({
        student_id: studentId,
        announcement_id: a.id,
        read_at: new Date().toISOString()
      }));
      const { error } = await supabase
        .from('announcement_reads')
        .upsert(rows, { onConflict: 'student_id,announcement_id' });
      if (error) throw error;
    } catch (err) {
      console.error('Failed to persist mark-all-read', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Communication Center</h2>
        <div className="flex space-x-2">
          <button
            onClick={handleMarkAllRead}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Mark All Read
          </button>
        </div>
      </div>

      {/* Announcements */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Announcements</h3>
          <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
            {unreadCount} unread
          </span>
        </div>

        <div className="space-y-4">
          {announcements.map((announcement: Announcement) => (
            <div
              key={announcement.id}
              className={`p-4 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors ${
                !announcement.read ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
              }`}
              onClick={() => {
                setSelectedAnnouncement(announcement);
                setShowAnnouncementModal(true);
                markAnnouncementRead(announcement.id);
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="font-medium text-gray-900">{announcement.title}</h4>

                    {!announcement.read && <div className="w-2 h-2 bg-blue-500 rounded-full" />}

                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        announcement.priority === 'high'
                          ? 'bg-red-100 text-red-800'
                          : announcement.priority === 'medium'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {announcement.priority}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mb-2">
                    {announcement.message ? announcement.message.substring(0, 150) + (announcement.message.length > 150 ? '...' : '') : ''}
                  </p>

                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>From: {announcement.sender}</span>
                    <span>{announcement.date}</span>
                    {announcement.course && <span>Course: {announcement.course}</span>}
                  </div>
                </div>

                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          ))}

          {announcements.length === 0 && (
            <div className="text-sm text-gray-500 py-6 text-center">No announcements available.</div>
          )}
        </div>
      </div>

      {/* Upcoming Deadlines */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Deadlines</h3>
        <div className="space-y-3">
          {events
            .filter((event: CalendarEvent) => event.type === 'assignment' || event.type === 'exam')
            .map((event: CalendarEvent) => (
              <div
                key={event.id}
                className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      event.type === 'exam' ? 'bg-red-500' : 'bg-blue-500'
                    }`}
                  />
                  <div>
                    <h4 className="font-medium text-gray-900">{event.title}</h4>
                    <p className="text-sm text-gray-600">{event.course}</p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">{event.date}</div>
                  <div className="text-xs text-gray-500">{event.time}</div>
                </div>
              </div>
            ))}

          {events.filter((e: CalendarEvent) => e.type === 'assignment' || e.type === 'exam').length === 0 && (
            <div className="text-sm text-gray-500">No upcoming deadlines.</div>
          )}
        </div>
      </div>
    </div>
  );
};



  const tabs = [
    { id: 'dashboard', name: 'Dashboard', icon: Home },
    { id: 'courses', name: 'My Courses', icon: BookOpen },
    { id: 'assessments', name: 'Assessment Tracking', icon: BarChart3 },
    { id: 'study-tools', name: 'Study Tools', icon: Target },
    { id: 'calendar', name: 'Academic Calendar', icon: CalendarDays },
    { id: 'timetable', name: 'Timetable', icon: Clock },
    { id: 'records', name: 'Academic Records', icon: FileText },
    { id: 'communication', name: 'Communication', icon: MessageSquare }
  ];

  return (
  <div className="min-h-screen bg-gray-50">
    {/* Header */}
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <GraduationCap className="h-8 w-8 text-blue-600" />
            <span className="ml-2 text-2xl font-bold text-gray-900">Trackademy</span>
            <span className="ml-4 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">Student Portal</span>
          </div>
          <div className="flex items-center space-x-4">
            <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors relative">
              <Bell className="h-5 w-5" />
              {(announcementsFromDB || []).filter(a => !a.read).length > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
              )}
            </button>
            <button
                onClick={() => setIsProfileModalOpen(true)}
                className="flex items-center space-x-2 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors"
              >
                <User className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-700">{user.name}</span>
                <span className="text-xs text-gray-500">({user.userNumber})</span>
              </button>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1 text-gray-600 hover:text-red-600 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>

    <div className="flex">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-sm border-r border-gray-200">
        <nav className="sticky top-16 h-[calc(100vh-64px)] overflow-y-auto py-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center px-6 py-3 text-left hover:bg-gray-50 transition-colors ${
                  activeTab === tab.id ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600' : 'text-gray-700'
                }`}
              >
                <Icon className="h-5 w-5 mr-3" />
                {tab.name}
                {tab.id === 'communication' && (announcementsFromDB || []).filter(a => !a.read).length > 0 && (
                  <span className="ml-auto w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-auto h-[calc(100vh-64px)]">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'courses' && renderCourses()}
        {activeTab === 'assessments' && renderAssessments()}
        {activeTab === 'study-tools' && renderStudyTools()}
        {activeTab === 'calendar' && renderCalendar()}
        {activeTab === 'timetable' && renderTimetable()}
        {activeTab === 'records' && renderRecords()}
        {activeTab === 'communication' && renderCommunication()}
      </div>
    </div>

    {/* Study Goal Modal */}
    {showGoalModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Create Study Goal</h3>
            <button
              onClick={() => setShowGoalModal(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              ×
            </button>
          </div>
          <div className="p-6">
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Goal Title</label>
                <input
                  type="text"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your study goal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={newGoal.description}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe your goal in detail"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Course</label>
                  <select
                    value={newGoal.course}
                    onChange={(e) => setNewGoal(prev => ({ ...prev, course: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Course</option>
                    {courses.map(course => (
                      // Use the course id (a real FK target for study_goals.course_id), not its
                      // display code, now that goals are actually persisted to the database.
                      <option key={course.id} value={course.id}>{course.code} - {course.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select
                    value={newGoal.priority}
                    onChange={(e) => setNewGoal(prev => ({ ...prev, priority: e.target.value as StudyGoal['priority'] }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Target Date</label>
                <input
                  type="date"
                  value={newGoal.targetDate}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, targetDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </form>
          </div>
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg flex justify-end space-x-3">
            <button
              onClick={() => setShowGoalModal(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateGoal}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Goal
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Announcement Modal */}
    {showAnnouncementModal && selectedAnnouncement && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">{selectedAnnouncement.title}</h3>
            <button
              onClick={() => setShowAnnouncementModal(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              ×
            </button>
          </div>
          <div className="p-6">
            <div className="flex items-center space-x-4 mb-4">
              <span className="text-sm text-gray-600">From: {selectedAnnouncement.sender}</span>
              <span className="text-sm text-gray-600">{selectedAnnouncement.date}</span>
              {selectedAnnouncement.course && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {selectedAnnouncement.course}
                </span>
              )}
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                selectedAnnouncement.priority === 'high' ? 'bg-red-100 text-red-800' :
                selectedAnnouncement.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {selectedAnnouncement.priority}
              </span>
            </div>
            <div className="prose max-w-none">
              <p className="text-gray-700">{selectedAnnouncement.message}</p>
            </div>
          </div>
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg flex justify-end">
            <button
              onClick={() => setShowAnnouncementModal(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}
    <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={{
          name: user?.name || '',
          userNumber: user?.userNumber || '',
          role: user?.role || '',
          email: `${user?.userNumber}@university.edu`
        }}
      />
  </div>
);
};

export default StudentDashboard;