// src/components/StudentDashboard.tsx
import React, { useEffect, useState, useMemo } from 'react';
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
  type: string; // will now be the event type name (e.g., "Exam Week", "Lecture")
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
        // local fallback goals
        const savedGoals = localStorage.getItem(`studyGoals_${parsedUser.userNumber}`);
        if (savedGoals) {
          try { setStudyGoals(JSON.parse(savedGoals)); } catch { /* ignore */ }
        }
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

    // --- Step: Fetch courses for student's current year (NEW) ---
    // This fetch brings in courses for the student's program and current academic year.
    // We then merge them into coursesById so downstream logic can leverage richer metadata.
    try {
      if (studentRow.program_id) {
        const { data: yearCourses, error: yearCourseErr } = await supabase
          .from('courses')
          .select(`
            id,
            name,
            code,
            credits,
            semester,
            academic_year,
            program:program_id ( id, name ),
            lecturer:lecturer_id ( id, profile_id )
          `)
          .eq('program_id', studentRow.program_id)
          .eq('academic_year', String(studentRow.year_of_study))
          .eq('status', 'active');

        if (yearCourseErr) {
          // throw or log depending on desired behaviour; log and continue to avoid breaking the whole load
          console.warn('⚠️ Failed to fetch year-specific courses:', yearCourseErr);
        } else {
          (yearCourses || []).forEach((yc: any) => {
            // normalize the returned row to match coursesById shape used later
            const normalized = {
              id: yc.id,
              name: yc.name,
              code: yc.code,
              credits: yc.credits,
              semester: yc.semester,
              academic_year: yc.academic_year,
              // prefer nested program id if present, otherwise fallback to program_id field
              program_id: (yc.program && yc.program.id) || yc.program_id || studentRow.program_id,
              // lecturer could be nested object or scalar id
              lecturer_id: (yc.lecturer && yc.lecturer.id) || yc.lecturer_id || null,
              // keep year_level if available elsewhere; fall back to academic_year where appropriate
              year_level: yc.year_level ?? (yc.academic_year ? Number(yc.academic_year) : undefined),
            };
            coursesById[String(normalized.id)] = {
              ...(coursesById[String(normalized.id)] || {}),
              ...normalized,
            };
          });
        }
      }
    } catch (yrErr) {
      console.warn('⚠️ Year courses fetch failed unexpectedly:', yrErr);
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
          ) || {};

          const score = Number(studentMark.marks_obtained ?? 0);
          const max = Number(a.maximum_marks ?? 100) || 100;
          const normalized = {
            id: a.id,
            course_id: a.course_id,
            name: a.name,
            type: a.assessment_types?.name ?? 'Assessment',
            weight: a.weight_percentage ?? 0,
            score,
            maxScore: max,
            percentage:
              studentMark.percentage ?? (max > 0 ? Math.round((score / max) * 100) : 0),
            due_date: a.due_date,
            submitted_date: studentMark.submitted_date,
            graded_date: studentMark.graded_date,
            status: studentMark.status,
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
        completionPercentage: Number(en.final_percentage ?? 0),
        assessments: assessmentsByCourse[String(courseId)] || [],
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

    // Fetch upcoming events
    const { data: eventsRows, error: eventsErr } = await supabase
      .from('events')
      .select('id, title, event_date, start_time, end_time, venue, course_id, description, event_type_id')
      .gte('event_date', todayISO)
      .order('event_date', { ascending: true });

    if (eventsErr) throw eventsErr;

    upcoming = (eventsRows || []).map((ev: any) => {
      const typeInfo = eventTypeMap[ev.event_type_id] || { name: 'Event', color: '#6b7280' };
      return {
        id: ev.id,
        title: ev.title,
        date: ev.event_date,
        time: ev.start_time ?? ev.end_time ?? '',
        type: typeInfo.name,
        color: typeInfo.color,
        venue: ev.venue,
        course: ev.course_id ? String(ev.course_id) : undefined,
        description: ev.description
      } as CalendarEvent;
    });

    // Announcements
    let ann: Announcement[] = [];
    if (courseIds.length) {
      const { data: annRows } = await supabase
        .from('announcements')
        .select('id, title, content, published_at, course_id, created_by')
        .in('course_id', courseIds)
        .order('published_at', { ascending: false })
        .limit(50);
      ann = (annRows || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        message: a.content,
        sender: String(a.created_by),
        date: a.published_at,
        course: a.course_id ? String(a.course_id) : undefined,
        priority: 'medium',
        read: false,
      }));
    }

    // Study goals
    let dbGoals: StudyGoal[] = [];
    try {
      const { data: goalRows } = await supabase
        .from('study_goals')
        .select('id, title, description, target_date, completion_percentage, status, course_id')
        .eq('student_id', studentRow.id);
      dbGoals = (goalRows || []).map((g: any) => ({
        id: g.id,
        title: g.title,
        description: g.description,
        targetDate: g.target_date ?? '',
        completed: g.status === 'completed' || (g.completion_percentage ?? 0) >= 100,
        priority: 'medium' as const,
        course: g.course_id ? String(g.course_id) : '',
      }));
    } catch { /* ignore */ }

    // --- FETCH course schedules and prepare map for nextClass calculation ---
    const daysOfWeekOrder = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const todayIndex = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

    let courseSchedulesByCourse: Record<string, any[]> = {};
    if (courseIds.length) {
      const { data: scheduleRows, error: scheduleErr } = await supabase
        .from('course_schedules')
        .select('id, course_id, day_of_week, start_time, end_time, venue, is_active')
        .in('course_id', courseIds)
        .eq('is_active', true);

      if (scheduleErr) {
        console.error('❌ Failed to fetch course schedules:', scheduleErr.message || scheduleErr);
      } else {
        scheduleRows?.forEach((s: any) => {
          const cid = String(s.course_id);
          if (!courseSchedulesByCourse[cid]) courseSchedulesByCourse[cid] = [];
          courseSchedulesByCourse[cid].push(s);
        });
      }
    }
    console.log('✅ courseSchedulesByCourse', courseSchedulesByCourse);

    // --- 9. Build mappedCourses (UI shape) including the new nextClass logic ---
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

    const completedEnrolls = (displayEnrollments || []).filter((e) => e.final_percentage !== null && e.final_percentage !== undefined);
    academicSummary.completedCredits = completedEnrolls.reduce((sum: number, e: any) => {
      const credits = Number((e.courses?.credits ?? coursesById[e.course_id]?.credits) ?? 0);
      return sum + credits;
    }, 0);

    academicSummary.currentGPA = (
      completedEnrolls.reduce((sum: number, e: any) => sum + (Number(e.grade_points) || 0), 0) /
      (completedEnrolls.length || 1)
    ).toFixed(2);

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
        yearMark: en.final_percentage ? Math.round(Number(en.final_percentage) * 0.4) : '-',
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
        academicSummary.expectedGraduation = `${new Date().getFullYear() + (prog.duration || 3)}`;
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
      setAcademicRecord(academicSummary);
      setUpcomingEvents(upcoming);
      setAnnouncementsFromDB(ann);
      if (dbGoals.length) setStudyGoals(dbGoals);
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

  const handleCreateGoal = () => {
  try {
    const goal: StudyGoal = {
      id: Date.now(),
      ...newGoal,
      completed: false
    };
    const updatedGoals = [...studyGoals, goal];
    setStudyGoals(updatedGoals);
    localStorage.setItem(`studyGoals_${user?.userNumber}`, JSON.stringify(updatedGoals));

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


  const toggleGoalComplete = (goalId: number | string) => {
  try {
    const updatedGoals = studyGoals.map(goal =>
      goal.id === goalId ? { ...goal, completed: !goal.completed } : goal
    );
    setStudyGoals(updatedGoals);
    localStorage.setItem(`studyGoals_${user?.userNumber}`, JSON.stringify(updatedGoals));

    const toggledGoal = updatedGoals.find(g => g.id === goalId);
    if (toggledGoal?.completed) {
      setNotification({ type: 'success', message: 'Goal marked as completed 🎉' });
    } else {
      setNotification({ type: 'success', message: 'Goal marked as incomplete ↩️' });
    }
  } catch (err) {
    console.error('Failed to toggle goal', err);
    setNotification({ type: 'error', message: 'Something went wrong updating the goal ❌' });
  }
};

const deleteGoal = (goalId: number | string) => {
  try {
    const updatedGoals = studyGoals.filter(goal => goal.id !== goalId);
    setStudyGoals(updatedGoals);
    localStorage.setItem(`studyGoals_${user?.userNumber}`, JSON.stringify(updatedGoals));

    setNotification({ type: 'success', message: 'Goal deleted 🗑️' });
  } catch (err) {
    console.error('Failed to delete goal', err);
    setNotification({ type: 'error', message: 'Something went wrong deleting the goal ❌' });
  }
};
  const toggleYearExpansion = (yearSemester: string) => {
    setExpandedYears(prev => ({ ...prev, [yearSemester]: !prev[yearSemester] }));
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

  // calculate average for a course using student_assessment_marks percentage
const calculateStudentAverage = (assessments: any[]) => {
  if (!assessments || assessments.length === 0) return 0;

  const validPercentages = assessments
    .map(a => Number(a.percentage ?? a.student_assessment_marks?.[0]?.percentage ?? 0))
    .filter(p => !isNaN(p));

  if (validPercentages.length === 0) return 0;

  const total = validPercentages.reduce((sum, p) => sum + p, 0);
  return Math.round(total / validPercentages.length);
};

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
  const avgScoreForFiltered = filteredAssessments.length
  ? Math.round(
      filteredAssessments.reduce((sum, a) => {
        const score = Number(a.score ?? a.marks_obtained ?? a.marks ?? 0);
        const max = Number(a.maxScore ?? a.maximum_marks ?? a.max ?? 100) || 100;
        return sum + (max === 0 ? 0 : (score / max) * 100);
      }, 0) / filteredAssessments.length
    )
  : 0;

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
            <td>${a.score ?? 0}/${a.maxMarks ?? '-'}</td>
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
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        // If content longer than one page, add pages
        let heightLeft = pdfHeight;
        let position = 0;
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
        while (heightLeft > -1) {
          position = heightLeft - pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
          heightLeft -= pdf.internal.pageSize.getHeight();
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
                        <div className="text-xs text-gray-500">{assessment.date}</div>
                      </div>
                      <div className="text-right">
                        <span className="font-medium text-gray-900">
                          {assessment.score ?? 0}/{assessment.maxScore ?? 0}
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
                        <div className="text-xs text-orange-700">{assessment.date}</div>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAssessments.map((assessment, idx) => (
                <tr key={`${assessment.courseId}-${idx}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{assessment.courseCode}</div>
                    <div className="text-sm text-gray-500">{assessment.courseName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{assessment.type}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${
                      ((assessment.score ?? 0) / (assessment.maxScore || 1)) * 100 >= 50 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {assessment.score ?? 0}/{assessment.maxScore ?? 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{assessment.weight}%</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{assessment.date}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          ((assessment.score ?? 0) / (assessment.maxScore || 1)) * 100 >= 75 ? 'bg-green-500' :
                          ((assessment.score ?? 0) / (assessment.maxScore || 1)) * 100 >= 50 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${((assessment.score ?? 0) / (assessment.maxScore || 1)) * 100}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {Math.round(((assessment.score ?? 0) / (assessment.maxScore || 1)) * 100)}%
                    </div>
                  </td>
                </tr>
              ))}
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
            {/* If you load event types dynamically, this can be replaced by a .map over your event_types */}
            <option value="Exam">Exams</option>
            <option value="Assignment">Assignments</option>
            <option value="Lecture">Lectures</option>
            <option value="Registration">Registration</option>
            <option value="Holiday">Holidays</option>
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



// --- Timetable (uses `courses` state for schedule placeholders) ---
const renderTimetable = () => {
  // NOTE: depends on whether you store timetable/schedule in DB. For now use `courses` state to render nextClass or placeholders.
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monday</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tuesday</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wednesday</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thursday</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Friday</th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {['08:00-09:00','09:00-10:00','10:00-11:00','11:00-12:00','12:00-13:00','13:00-14:00','14:00-15:00','15:00-16:00'].map((time, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{time}</td>

                  {/* For each weekday cell, try to show a matching nextClass from courses if available, otherwise keep placeholder */}
                  {['mon','tue','wed','thu','fri'].map((day, colIndex) => {
                    // simple heuristic: map some sample courses into cells using index; replace this logic with your course schedule mapping
                    const courseForCell = courses?.[ (colIndex + index) % (courses?.length || 1) ] ?? null;
                    return (
                      <td key={day} className="px-6 py-4 whitespace-nowrap">
                        {courseForCell ? (
                          <div className="p-2 bg-blue-50 rounded border-l-4 border-blue-500">
                            <div className="text-sm font-medium text-blue-900">{courseForCell.code ?? courseForCell.name}</div>
                            <div className="text-xs text-blue-700">{courseForCell.nextClass?.venue ?? courseForCell.venue ?? 'TBA'}</div>
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    const finalMark = Number(c.finalMark ?? c.yearMark ?? 0);
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
  const score = Number(a.score ?? a.marks_obtained ?? a.marks ?? 0);
  const max = Number(a.maxScore ?? a.maximum_marks ?? a.maxMarks ?? 100) || 100;
  const weight = a.weight ?? a.weight_percentage ?? a.weightPercentage ?? 0;
  const percentage = a.percentage ?? (max > 0 ? Math.round((score / max) * 100) : 0);
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
                            <span className="text-gray-600">Year Mark: <span className="font-semibold text-gray-900">{course.yearMark ?? '-'}</span></span>
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
        const barClass = n.percentage >= 70 ? 'bg-green-500' : n.percentage >= 50 ? 'bg-blue-500' : 'bg-red-500';
        return (
          <div key={ai} className="bg-white p-3 rounded border">
            <div className="text-xs font-medium text-gray-600 mb-1">{n.name}</div>
            <div className="text-lg font-semibold text-gray-900">{n.score}/{n.max}</div>
            <div className="text-xs text-gray-500">Weight: {n.weight}% • {n.percentage}%</div>
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full ${barClass}`} style={{ width: `${n.percentage}%` }} />
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

  const handleMarkAllRead = () => {
    // mark locally; if you want to persist to supabase, add an API call here
    const updated = announcements.map((a: Announcement) => ({ ...a, read: true }));
    setAnnouncementsFromDB(updated);
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
                      <option key={course.id} value={course.code}>{course.code} - {course.name}</option>
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