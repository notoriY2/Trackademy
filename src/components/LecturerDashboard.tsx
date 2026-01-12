// LecturerDashboard.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import UserProfileModal from './UserProfileModal';
import { GraduationCap, BookOpen, Users, BarChart3, Upload, LogOut, User, FileText, CheckCircle, XCircle, Plus, CreditCard as Edit, Download, Bell, Send, TrendingUp, AlertTriangle, Target, Eye, Search as SearchIcon } from 'lucide-react';

/** Types */
interface User {
  userId: string;
  userNumber: string;
  role: string;
  name: string;
}

interface AssessmentTypeRow {
  id: string;
  name: string;
}


interface ResourceFile {
  id: string;
  name: string;
  url: string;
}

interface Assessment {
  id: string;
  type: string;   // 👈 fetched from DB (assessment_types.name)
  name: string;
  weight: number;
  maxMarks: number;
  dueDate: string;
  status: 'draft' | 'published' | 'completed';
  courseId: string;
}


interface Student {
  id: string;
  firstName?: string;
  lastName?: string;
  name: string; // derived for convenience
  studentNumber: string;
  assessments: Record<string, number | null>;
  courseworkTotal: number;
  examEligible: boolean;
}


interface Course {
  id: string;
  name: string;
  code: string;
  students: Student[];
  assessments: Assessment[];
  upcomingClasses: Array<{
    date: string;
    time: string;
    topic: string;
    venue: string;
  }>;
  completionProgress: number;
  totalTopics: number;
  completedTopics: number;

  // 👇 NEW: add these lines
  totalAssessments: number;
  markedAssessments: number;
}


type Toast = { id: string; message: string; type?: 'success' | 'error' | 'info' };

/** Helper: compute coursework total percent for a student in a course */
// compute coursework percentage (0 - 100)
// excludes any assessment whose type string contains "exam" (case-insensitive)
// normalizes by the sum of coursework weights so result is a percent.
const computeCourseworkTotal = (student: Student, course: Course) => {
  if (!course?.assessments?.length) return 0;

  // Only coursework assessments (exclude exams)
  const courseworkAssessments = course.assessments.filter(a =>
    !String(a.type ?? '').toLowerCase().includes('exam')
  );

  if (!courseworkAssessments.length) return 0;

  const totalCourseworkWeight = courseworkAssessments.reduce((sum, a) => sum + (Number(a.weight) || 0), 0);
  if (totalCourseworkWeight <= 0) return 0;

  let weightedSum = 0;
  courseworkAssessments.forEach(a => {
    const score = student.assessments[a.id];
    if (typeof score === 'number' && Number(a.maxMarks) > 0) {
      // contribution in same units as weight (e.g. weight 20 means contributes up to 20)
      weightedSum += (score / a.maxMarks) * Number(a.weight);
    }
  });

  // weightedSum is out of totalCourseworkWeight -> normalize to 0-100
  const percent = (weightedSum / totalCourseworkWeight) * 100;
  return Math.round(percent);
};


const LecturerDashboard: React.FC = () => {
  const navigate = useNavigate();

  /** user auth */
  const [user, setUser] = useState<User | null>(null);

  /** UI state */
  const [activeTab, setActiveTab] = useState<'dashboard' | 'assessments' | 'marks' | 'reports'>('dashboard');
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showMarksModal, setShowMarksModal] = useState(false);

  const [showViewAssessmentModal, setShowViewAssessmentModal] = useState(false);
  const [viewAssessment, setViewAssessment] = useState<Assessment | null>(null);
  const [assessmentTypes, setAssessmentTypes] = useState<AssessmentTypeRow[]>([]);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadAssessment, setUploadAssessment] = useState<Assessment | null>(null);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  /** announcements with attachments */
  const [announcements, setAnnouncements] = useState<Array<{ id: string; courseId: string; title: string; message: string; createdAt: string; attachments?: ResourceFile[] }>>([]);

  /** toasts */
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pushToast = (message: string, type: Toast['type'] = 'success') => {
    const id = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  /** Lecturer data (stateful) */
  const [lecturerData, setLecturerData] = useState<{ courses: Course[] }>({ courses: [] });

  /** Marks filter and search */
  const [marksFilterAssessmentId, setMarksFilterAssessmentId] = useState<string | 'all'>('all');
  const [marksSearch, setMarksSearch] = useState<string>('');

  /** New assessment & announcement state */
  const [newAssessment, setNewAssessment] = useState({
  type: '',  // 👈 default to empty, will be selected from dropdown
  name: '',
  weight: 10,
  maxMarks: 100,
  dueDate: '',
  courseId: '' // ✅ string instead of number
});


  const [announcement, setAnnouncement] = useState({
    title: '',
    message: '',
    courseId: '' // ✅ string instead of number
  });

  const [announcementAttachments, setAnnouncementAttachments] = useState<ResourceFile[]>([]);

  /** Marks modal state */
  const [marksModalAssessmentId, setMarksModalAssessmentId] = useState<string | null>(null);
  const [marksModalValues, setMarksModalValues] = useState<Record<string, number | null>>({});

  // --- NEW: course completion state ---
const [avgCompletion, setAvgCompletion] = useState<number>(0);


  /** Authentication effect */
  /** Authentication effect */
useEffect(() => {
  const userData = localStorage.getItem('user');
  if (!userData) { navigate('/login'); return; }
  const parsedUser = JSON.parse(userData);
  if (parsedUser.role !== 'lecturer') { navigate('/login'); return; }
  setUser(parsedUser);
}, [navigate]);




useEffect(() => {
  if (!user) return;
  let mounted = true;

  const fetchLecturerData = async () => {
  try {
    // 1) find lecturer record by lecturer_number (adjust if you use profile_id instead)
    const { data: lecRow, error: lecErr } = await supabase
      .from('lecturers')
      .select('id, profile_id')
      .eq('lecturer_number', user.userNumber)
      .maybeSingle();
    if (lecErr) throw lecErr;
    if (!lecRow) {
      pushToast('Lecturer record not found', 'error');
      return;
    }

    const lecturerId = lecRow.id;

    // 2) pull assessment types (so we can map id <-> name)
    const { data: assessmentTypes, error: typeErr } = await supabase
      .from('assessment_types')
      .select('id,name');

    if (typeErr) throw typeErr;

    // 3) fetch courses taught by lecturer with nested relationships
    const { data: courses, error: courseErr } = await supabase
      .from('courses')
      .select(`
        id,
        name,
        code,
        lecturer_id,
        assessments:assessments(*),
        course_schedules(id, day_of_week, start_time, end_time, venue),
        enrollments:enrollments(
          id,
          student_id,
          final_grade,
          is_exam_eligible,
          student:students(
            id,
            student_number,
            profile:profiles(first_name, last_name)
          )
        )
      `)
      .eq('lecturer_id', lecturerId);

    if (courseErr) throw courseErr;

    // 4) map server rows -> UI shape
    const mapped: Course[] = (courses || []).map((c: any) => {
      const assessments: Assessment[] = (c.assessments || []).map((a: any) => ({
        id: a.id,
        type:
          assessmentTypes?.find((t: any) => t.id === a.assessment_type_id)?.name ??
          'Exam',
        name: a.name,
        weight: Number(a.weight_percentage ?? 0),
        maxMarks: Number(a.maximum_marks ?? 100),
        dueDate: a.due_date,
        status: a.status,
        courseId: String(c.id),
      }));

      const students: Student[] = (c.enrollments || []).map((se: any) => ({
        id: se.student_id ?? se.student?.id,
        firstName: se.student?.profile?.first_name ?? '',
        lastName: se.student?.profile?.last_name ?? '',
        name: `${se.student?.profile?.first_name ?? ''} ${
          se.student?.profile?.last_name ?? ''
        }`.trim(),
        studentNumber: se.student?.student_number ?? '',
        assessments: {},
        courseworkTotal: Number(se.final_grade ?? 0),
        examEligible: !!se.is_exam_eligible,
      }));

      const upcomingClasses = (c.course_schedules || []).map((s: any) => ({
        date: s.session_date ?? s.day_of_week ?? '',
        time: s.start_time ?? '',
        topic: s.topic ?? '',
        venue: s.venue ?? '',
      }));

      return {
  id: String(c.id),
  name: c.name,
  code: c.code,
  students,
  assessments,
  upcomingClasses,
  completionProgress: 0,
  totalTopics: 0,
  completedTopics: 0,
  totalAssessments: 0,
  markedAssessments: 0,
};

    });

    // 5) load all marks for the assessments we fetched, then map into students.assessments
    const assessmentIds = mapped.flatMap((m) => m.assessments.map((a) => a.id));
    if (assessmentIds.length) {
      const { data: marks, error: markErr } = await supabase
        .from('student_assessment_marks')
        .select('student_id, assessment_id, marks_obtained')
        .in('assessment_id', assessmentIds);

      if (markErr) throw markErr;

      const marksByStudent: Record<string, Record<string, number>> = {};
      (marks || []).forEach((m: any) => {
        marksByStudent[m.student_id] = marksByStudent[m.student_id] || {};
        marksByStudent[m.student_id][m.assessment_id] = Number(m.marks_obtained);
      });

      // apply marks to mapped structure + compute completion progress locally
      mapped.forEach((course: any) => {
        course.students.forEach((s: any) => {
          const assessmentMap: Record<string, number | null> = {};
          course.assessments.forEach((a: any) => {
            assessmentMap[a.id] = marksByStudent[s.id]?.[a.id] ?? null;
          });
          s.assessments = assessmentMap;
          s.courseworkTotal = computeCourseworkTotal(s, course);
          s.examEligible = s.courseworkTotal >= 50;
        });

        // --- optional: local fallback progress ---
        const totalAssessments = course.assessments.length;
        let markedAssessments = 0;
        if (totalAssessments > 0) {
          markedAssessments = course.assessments.filter((a: any) =>
            marks?.some((m: any) => m.assessment_id === a.id)
          ).length;
        }

        course.totalAssessments = totalAssessments;
        course.markedAssessments = markedAssessments;
        course.completionProgress =
          totalAssessments > 0
            ? Math.round((markedAssessments / totalAssessments) * 100)
            : 0;
      });
    }

    // 6) Fetch completion progress per course from SQL view (vw_course_completion_progress)
    const { data: progressData, error: progressErr } = await supabase
      .from('vw_course_completion_progress')
      .select(
        'course_id, total_assessments, marked_assessments, completion_progress'
      )
      .eq('lecturer_id', lecturerId);

    if (progressErr) throw progressErr;

    // Build a quick lookup map
    const progressMap = Object.fromEntries(
      (progressData ?? []).map((p: any) => [String(p.course_id), p])
    );

    // Merge into each course (override local values with DB ones)
    mapped.forEach((course: any) => {
      const p = progressMap[course.id];
      course.totalAssessments = p?.total_assessments ?? course.totalAssessments ?? 0;
      course.markedAssessments =
        p?.marked_assessments ?? course.markedAssessments ?? 0;
      course.completionProgress =
        p?.completion_progress ?? course.completionProgress ?? 0;
    });

    if (mounted) setLecturerData({ courses: mapped });
  } catch (err: any) {
    console.error('fetchLecturerData error', err);
    pushToast('Failed to load lecturer data', 'error');
  }
};

  

  fetchLecturerData();
  return () => {
    mounted = false;
  };
}, [user]);


useEffect(() => {
  const fetchTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('assessment_types')
        .select('id, name, description');

      if (error) throw error;
      setAssessmentTypes(data || []);
    } catch (err) {
      console.error('Failed to fetch assessment types', err);
      pushToast('Could not load assessment types', 'error');
    }
  };

  fetchTypes();
}, []);


  /** Set default selected course */
  useEffect(() => {
    if (selectedCourse === null && lecturerData.courses.length > 0) {
      setSelectedCourse(lecturerData.courses[0].id);
      setNewAssessment(prev => ({ ...prev, courseId: lecturerData.courses[0].id }));
      setAnnouncement(prev => ({ ...prev, courseId: lecturerData.courses[0].id }));
    }
  }, [lecturerData.courses, selectedCourse]);

  useEffect(() => {
  if (selectedCourse === null && lecturerData.courses.length > 0) {
    setSelectedCourse(lecturerData.courses[0].id);
    setNewAssessment(prev => ({ ...prev, courseId: lecturerData.courses[0].id }));
    setAnnouncement(prev => ({ ...prev, courseId: lecturerData.courses[0].id }));
  }
}, [lecturerData.courses, selectedCourse]);

// --- NEW: Fetch average completion from view ---
useEffect(() => {
  if (!user) return;

  const fetchCompletion = async () => {
    try {
      // 1. Find lecturer ID
      const { data: lecRow, error: lecErr } = await supabase
        .from('lecturers')
        .select('id')
        .eq('lecturer_number', user.userNumber)
        .maybeSingle();

      if (lecErr || !lecRow) return;

      // 2. Query view
      const { data: completionData, error } = await supabase
        .from('vw_course_completion_progress')
        .select('course_id, completion_progress')
        .eq('lecturer_id', lecRow.id);

      if (error) throw error;

      // 3. Compute average
      const avg = Math.round(
        (completionData?.reduce(
          (sum, c) => sum + (c.completion_progress || 0),
          0
        ) || 0) / Math.max(1, completionData?.length || 1)
      );

      setAvgCompletion(avg);
    } catch (err) {
      console.error('fetchCompletion error', err);
    }
  };

  fetchCompletion();
}, [user]);


  /** Update student mark helper */
  const updateStudentMark = async (
  courseId: string,
  studentId: string,
  assessmentId: string,
  value: number | null
) => {
  try {
    // find course + assessment (local state)
    const course = lecturerData.courses.find(c => String(c.id) === courseId);
    const assessment = course?.assessments.find(a => a.id === assessmentId);
    if (!course || !assessment) throw new Error("Course or assessment not found");

    // percentage for this assessment (0-100) or null
    const percentage =
      value === null || !assessment?.maxMarks
        ? null
        : (value / assessment.maxMarks) * 100;

    // 1) persist the student_assessment_marks row
    const { error: markError } = await supabase
      .from("student_assessment_marks")
      .upsert(
        {
          student_id: studentId,
          assessment_id: assessmentId,
          marks_obtained: value,
          percentage,
          created_by: user?.userId,
          updated_by: user?.userId,
        },
        { onConflict: "student_id,assessment_id" }
      );
    if (markError) throw markError;

    // 2) update local UI immediately (optimistic)
    setLecturerData(prev => {
      const courses = prev.courses.map(c => {
        if (String(c.id) !== courseId) return c;
        const students = c.students.map(s => {
          if (s.id !== studentId) return s;
          const newAssess = { ...s.assessments, [assessmentId]: value };
          const updatedStudent = {
            ...s,
            assessments: newAssess,
            courseworkTotal: computeCourseworkTotal({ ...s, assessments: newAssess }, c),
          };
          updatedStudent.examEligible = updatedStudent.courseworkTotal >= 50;
          return updatedStudent;
        });
        return { ...c, students };
      });
      return { ...prev, courses };
    });

    // 3) IMPORTANT: compute coursework total using a temp student (don't rely on async state)
    const courseState = lecturerData.courses.find(c => String(c.id) === courseId);
    const studentState = courseState?.students.find(s => s.id === studentId);

    const newAssessMap = { ...(studentState?.assessments ?? {}), [assessmentId]: value };

    const tempStudent: Student = {
      id: studentId,
      firstName: studentState?.firstName ?? '',
      lastName: studentState?.lastName ?? '',
      name: studentState?.name ?? '',
      studentNumber: studentState?.studentNumber ?? '',
      assessments: newAssessMap,
      courseworkTotal: 0,
      examEligible: false,
    };

    const courseworkTotal = computeCourseworkTotal(tempStudent, course);
    const isEligible = courseworkTotal >= 50;

    // 4) persist is_exam_eligible to enrollments
    const { error: enrollError } = await supabase
      .from("enrollments")
      .update({ is_exam_eligible: isEligible })
      .eq("student_id", studentId)
      .eq("course_id", courseId);
    if (enrollError) throw enrollError;

    // 5) If this assessment is an exam -> compute final percentage and grade, persist them
    if (String(assessment.type ?? '').toLowerCase().includes('exam')) {
      const examPct = percentage ?? 0; // 0-100
      const finalPercentage = courseworkTotal * 0.5 + examPct * 0.5; // 50/50 weighting

      let finalGrade = "F";
      let gradePoints = 0.0;
      if (finalPercentage >= 75) { finalGrade = "A"; gradePoints = 4.0; }
      else if (finalPercentage >= 60) { finalGrade = "B"; gradePoints = 3.0; }
      else if (finalPercentage >= 50) { finalGrade = "C"; gradePoints = 2.0; }
      else if (finalPercentage >= 40) { finalGrade = "D"; gradePoints = 1.0; }

      const { error: finalError } = await supabase
        .from("enrollments")
        .update({
          final_percentage: Number(finalPercentage.toFixed(2)),
          final_grade: finalGrade,
          grade_points: gradePoints,
        })
        .eq("student_id", studentId)
        .eq("course_id", courseId);

      if (finalError) throw finalError;

      pushToast(`Final grade saved: ${finalGrade} (${finalPercentage.toFixed(2)}%)`, 'success');
    } else {
      pushToast('Mark saved successfully', 'success');
    }
  } catch (err) {
    console.error('Error saving mark:', err);
    pushToast('Failed to save mark', 'error');
  }
};




  /** Create assessment */
const handleCreateAssessment = async () => {
  if (!newAssessment.name.trim() || !newAssessment.dueDate || newAssessment.weight <= 0) {
    pushToast('Please fill required fields', 'error');
    return;
  }

  try {
    // find assessment_type_id by name (you may cache this map at top-level)
    const { data: types, error: typeErr } = await supabase
      .from('assessment_types')
      .select('id,name');

    if (typeErr) throw new Error(`Type lookup failed: ${typeErr.message}`);

    const typeRow = types?.find(t => t.name === newAssessment.type);
    if (!typeRow) throw new Error(`Unknown assessment type: ${newAssessment.type}`);

    // Insert assessment
    const { data, error } = await supabase
      .from('assessments')
      .insert([{
        course_id: newAssessment.courseId,
        assessment_type_id: typeRow.id,
        name: newAssessment.name.trim(),
        weight_percentage: newAssessment.weight,
        maximum_marks: newAssessment.maxMarks,
        due_date: newAssessment.dueDate,
        status: 'published',
        created_by: user?.userId,
        updated_by: user?.userId
      }])
      .select()
      .single();

    if (error) throw new Error(`Insert failed: ${error.message}`);

    if (!data) throw new Error('Insert returned no data');

    // Update local UI
    setLecturerData(prev => {
      const courses = prev.courses.map(c => {
        if (String(c.id) !== newAssessment.courseId) return c;
        const asses: Assessment[] = [...c.assessments, {
          id: data.id,
          type: newAssessment.type,
          name: data.name,
          weight: data.weight_percentage,
          maxMarks: data.maximum_marks,
          dueDate: data.due_date,
          status: data.status as 'draft' | 'published' | 'completed',
          courseId: String(c.id)
        }];
        const students = c.students.map(s => ({
          ...s,
          assessments: { ...s.assessments, [data.id]: null }
        }));
        return { ...c, assessments: asses, students };
      });
      return { ...prev, courses };
    });

    pushToast('Assessment created successfully', 'success');
    setShowAssessmentModal(false);

  } catch (err: any) {
    console.error('Assessment creation error:', err);
    pushToast(`Could not create assessment: ${err.message}`, 'error');
  }
};


  /** Send announcement */
const handleSendAnnouncement = async () => {
  if (!announcement.title.trim() || !announcement.message.trim()) {
    pushToast('Provide title and message', 'error');
    return;
  }

  try {
    const { data, error } = await supabase
      .from('announcements')
      .insert([{
        title: announcement.title.trim(),
        content: announcement.message.trim(),
        course_id: announcement.courseId,
        created_by: user?.userId,   // ✅ keep this
        published_at: new Date().toISOString(),
        status: 'published'
      }])
      .select()
      .single();

    if (error) throw new Error(`Insert failed: ${error.message}`);
    if (!data) throw new Error('Insert returned no data');

    setAnnouncements(prev => [
      ...prev,
      {
        id: data.id,
        courseId: data.course_id,
        title: data.title,
        message: data.content,
        createdAt: data.published_at,
        attachments: announcementAttachments
      }
    ]);

    pushToast('Announcement sent successfully', 'success');
    setShowAnnouncementModal(false);
    setAnnouncement({ title: '', message: '', courseId: announcement.courseId });
    setAnnouncementAttachments([]);

  } catch (err: any) {
    console.error('Announcement error:', err);
    pushToast(`Failed to send announcement: ${err.message}`, 'error');
  }
};



  /** Marks modal open */
  const openMarksModalForAssessment = (courseId: string, assessmentId: string | null) => {
    const course = lecturerData.courses.find(c => String(c.id) === courseId);
    if (!course) return;
    setMarksModalAssessmentId(assessmentId);
    const values: Record<string, number | null> = {};
    course.students.forEach(s => values[s.id] = assessmentId ? (s.assessments[assessmentId] ?? null) : null);
    setMarksModalValues(values);
    setShowMarksModal(true);
  };

  /** Save marks from marks modal */
  const handleSaveMarksModal = () => {
    if (!marksModalAssessmentId || !selectedCourse) { pushToast('Select an assessment', 'error'); return; }
    const assessmentId = marksModalAssessmentId;
    const courseId = selectedCourse;
    Object.entries(marksModalValues).forEach(([studentIdStr, markVal]) => {
      const studentId = studentIdStr; // ✅ keep UUID as-is
      const course = lecturerData.courses.find(c => String(c.id) === courseId);
      const assessment = course?.assessments.find(a => a.id === assessmentId);
      if (!assessment) return;
      const clamped = markVal === null ? null : Math.max(0, Math.min(assessment.maxMarks, Math.round(markVal)));
      updateStudentMark(courseId, studentId, assessmentId, clamped);
    });
    setShowMarksModal(false);
    pushToast('Marks saved', 'success');
  };

  /** Inline save all */
  const handleSaveAllMarks = () => pushToast('All marks saved', 'success');

  /** CSV download helpers */
  const downloadCSV = (filename: string, csvContent: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.setAttribute('download', filename);
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  };
  const downloadClassPerformance = (courseId: string) => {
    const course = lecturerData.courses.find(c => String(c.id) === courseId); if (!course) return;
    const headers = ['Student', 'StudentNumber', 'CourseworkTotal', 'ExamEligible', ...course.assessments.map(a => `${a.name}(${a.maxMarks})`)];
    const rows = course.students.map(s => [s.name, s.studentNumber, `${s.courseworkTotal}`, s.examEligible ? 'Yes' : 'No', ...course.assessments.map(a => (s.assessments[a.id] ?? '').toString())].join(','));
    downloadCSV(`${course.code}_Class_Performance.csv`, [headers.join(','), ...rows].join('\n'));
    pushToast('Class Performance Sheet downloaded', 'success');
  };
  const downloadExamEligibility = (courseId: string) => {
    const course = lecturerData.courses.find(c => String(c.id) === courseId); if (!course) return;
    const headers = ['Student', 'StudentNumber', 'CourseworkTotal', 'ExamEligible'];
    const rows = course.students.map(s => [s.name, s.studentNumber, `${s.courseworkTotal}`, s.examEligible ? 'Yes' : 'No'].join(','));
    downloadCSV(`${course.code}_Exam_Eligibility.csv`, [headers.join(','), ...rows].join('\n'));
    pushToast('Exam Eligibility Report downloaded', 'success');
  };
  const downloadAssessmentSummary = (courseId: string) => {
    const course = lecturerData.courses.find(c => String(c.id) === courseId); if (!course) return;
    const headers = ['Assessment', 'Type', 'Weight', 'MaxMarks', 'AverageScore', 'DueDate', 'Status'];
    const rows = course.assessments.map(a => {
      const scores = course.students.map(s => (s.assessments[a.id] ?? 0));
      const avg = (scores.reduce((s, x) => s + (x ?? 0), 0) / (scores.length || 1)).toFixed(2);
      return [a.name, a.type, `${a.weight}`, `${a.maxMarks}`, avg, a.dueDate, a.status].join(',');
    });
    downloadCSV(`${course.code}_Assessment_Summary.csv`, [headers.join(','), ...rows].join('\n'));
    pushToast('Assessment Summary downloaded', 'success');
  };

  /** Announcement attachments handler */
  const handleAnnouncementFiles = (files: FileList | null) => {
    if (!files) return;
    const newFiles: ResourceFile[] = Array.from(files).map(f => ({
  id: String(Date.now() + Math.floor(Math.random() * 1000)), // ✅ now a string
  name: f.name,
  url: URL.createObjectURL(f)
}));

    setAnnouncementAttachments(prev => [...prev, ...newFiles]);
  };
  const removeAnnouncementAttachment = (id: string) => setAnnouncementAttachments(prev => prev.filter(a => a.id !== id));

  /** Sidebar sticky classes: we will style sidebar to remain sticky below the header (header height is h-16 -> 64px). */
  const handleLogout = () => { localStorage.removeItem('user'); navigate('/'); };
  if (!user) return null;

  /** Renderning helpers */
  const renderDashboard = () => {
    // Collect unique student IDs across all courses
const allStudents = lecturerData.courses.flatMap(course => course.students);
const uniqueStudents = Array.from(new Map(allStudents.map(s => [s.id, s])).values());
const totalStudents = uniqueStudents.length;

// For eligible students, also deduplicate by ID
const uniqueEligibleStudents = Array.from(
  new Map(
    allStudents
      .filter(s => s.examEligible)
      .map(s => [s.id, s])
  ).values()
);
const eligibleStudents = uniqueEligibleStudents.length;
    const avgCompletionDisplay = avgCompletion;
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <BookOpen className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Courses</p>
                <p className="text-2xl font-bold text-gray-900">{lecturerData.courses.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Students</p>
                <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Exam Eligible</p>
                <p className="text-2xl font-bold text-gray-900">{eligibleStudents}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Completion</p>
                <p className="text-2xl font-bold text-gray-900">{avgCompletionDisplay}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Course Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {lecturerData.courses.map(course => (
            <div key={course.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{course.name}</h3>
                  <p className="text-gray-600">{course.code}</p>
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => { setSelectedCourse(course.id); setActiveTab('assessments'); }} className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-700 transition-colors">Manage</button>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Course Progress</span>
                  <span>{course.markedAssessments}/{course.totalAssessments} marked</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${course.completionProgress}%` }}></div>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="font-medium text-gray-900 mb-2">Upcoming Classes</h4>
                <div className="space-y-2">
                  {course.upcomingClasses.slice(0, 2).map((c, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div><p className="text-sm font-medium text-gray-900">{c.topic}</p><p className="text-xs text-gray-600">{c.venue}</p></div>
                      <div className="text-right"><p className="text-xs text-gray-600">{c.date}</p><p className="text-xs text-gray-600">{c.time}</p></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-lg font-bold text-blue-600">{course.students.length}</div>
                  <div className="text-xs text-gray-600">Students</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-lg font-bold text-green-600">{course.students.filter(s => s.examEligible).length}</div>
                  <div className="text-xs text-gray-600">Eligible</div>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-lg font-bold text-orange-600">{course.assessments.length}</div>
                  <div className="text-xs text-gray-600">Assessments</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button onClick={() => setShowAssessmentModal(true)} className="flex flex-col items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
              <Plus className="h-8 w-8 text-blue-600 mb-2" /><span className="text-sm font-medium text-blue-900">Create Assessment</span>
            </button>
            <button onClick={() => { setSelectedCourse(selectedCourse ?? lecturerData.courses[0].id); setActiveTab('marks'); }} className="flex flex-col items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
              <Edit className="h-8 w-8 text-green-600 mb-2" /><span className="text-sm font-medium text-green-900">Enter Marks</span>
            </button>
            <button onClick={() => setShowAnnouncementModal(true)} className="flex flex-col items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
              <Bell className="h-8 w-8 text-purple-600 mb-2" /><span className="text-sm font-medium text-purple-900">Send Announcement</span>
            </button>
            <button onClick={() => setActiveTab('reports')} className="flex flex-col items-center p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors">
              <Download className="h-8 w-8 text-orange-600 mb-2" /><span className="text-sm font-medium text-orange-900">Download Reports</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderAssessments = () => {
    const course = lecturerData.courses.find(c => String(String(c.id)) === selectedCourse) || lecturerData.courses[0];
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div><h2 className="text-2xl font-bold text-gray-900">Assessment Management</h2><p className="text-gray-600">{course.name} ({course.code})</p></div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setNewAssessment(prev => ({ ...prev, courseId: course.id })); setShowAssessmentModal(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"><Plus className="h-4 w-4 mr-2" />Create Assessment</button>
            <button onClick={() => { setSelectedCourse(course.id); setActiveTab('marks'); }} className="px-4 py-2 border rounded">Enter Marks</button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200"><h3 className="text-lg font-semibold text-gray-900">Assessments</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assessment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max Marks</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {course.assessments.map(assessment => (
                  <tr key={assessment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{assessment.name}</div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">{assessment.type}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{assessment.weight}%</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{assessment.maxMarks}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{assessment.dueDate}</td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 py-1 text-xs font-medium rounded-full ${assessment.status === 'completed' ? 'bg-green-100 text-green-800' : assessment.status === 'published' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>{assessment.status}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button onClick={() => { setViewAssessment(assessment); setShowViewAssessmentModal(true); }} className="text-blue-600 hover:text-blue-900" title="View assessment"><Eye className="h-4 w-4" /></button>

                      <button onClick={() => { setMarksModalAssessmentId(assessment.id); openMarksModalForAssessment(course.id, assessment.id); }} className="text-green-600 hover:text-green-900" title="Enter marks"><Edit className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderMarks = () => {
    const course = lecturerData.courses.find(c => String(String(c.id)) === selectedCourse) || lecturerData.courses[0];

    // assessmentsToShow based on filter
    const assessmentsToShow = course.assessments.filter(a => (marksFilterAssessmentId === 'all' || a.id === marksFilterAssessmentId));

    // filtered students via search
    const filteredStudents = course.students.filter(s => {
      const q = marksSearch.trim().toLowerCase();
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.studentNumber.toLowerCase().includes(q);
    });

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Mark Recording</h2>
            <p className="text-gray-600">{course.name} ({course.code})</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="flex items-center border rounded px-2 py-1 bg-white">
              <SearchIcon className="h-4 w-4 text-gray-500 mr-2" />
              <input value={marksSearch} onChange={(e) => setMarksSearch(e.target.value)} placeholder="Search students..." className="outline-none text-sm" />
            </div>

            <select value={marksFilterAssessmentId} onChange={(e) => {
              const v = e.target.value;
              if (v === 'all') setMarksFilterAssessmentId('all');
else setMarksFilterAssessmentId(v); // ✅ keep as string
            }} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">All Assessments</option>
              {course.assessments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>

            <button onClick={handleSaveAllMarks} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">Save All Marks</button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200"><h3 className="text-lg font-semibold text-gray-900">Student Marks</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Number</th>
                  {assessmentsToShow.map(a => <th key={a.id} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{a.name} ({a.maxMarks})</th>)}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coursework Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exam Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredStudents.map(student => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{student.name}</div></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.studentNumber}</td>

                    {assessmentsToShow.map(assessment => (
                      <td key={assessment.id} className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number" min={0} max={assessment.maxMarks}
                          value={student.assessments[assessment.id] ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            const num = val === '' ? null : Number(val);
                            updateStudentMark(course.id, student.id, assessment.id, num);
                          }}
                          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="—"
                        />
                      </td>
                    ))}

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${student.courseworkTotal >= 50 ? 'text-green-600' : 'text-red-600'}`}>{student.courseworkTotal}%</span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      {student.examEligible ? <span className="flex items-center text-green-600"><CheckCircle className="h-4 w-4 mr-1" />Eligible</span> :
                        <span className="flex items-center text-red-600"><XCircle className="h-4 w-4 mr-1" />Not Eligible</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderReports = () => {
    const course = lecturerData.courses.find(c => String(c.id) === selectedCourse) || lecturerData.courses[0];
    const passRate = Math.round((course.students.filter(s => s.examEligible).length / Math.max(1, course.students.length)) * 100);

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div><h2 className="text-2xl font-bold text-gray-900">Reports & Analytics</h2><p className="text-gray-600">Performance insights and downloadable reports</p></div>
          <select value={selectedCourse || lecturerData.courses[0].id} onChange={(e) => setSelectedCourse(String(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            {lecturerData.courses.map(c => <option key={String(c.id)} value={String(c.id)}>{c.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Pass Rate</p><p className="text-3xl font-bold text-green-600">{passRate}%</p></div><TrendingUp className="h-12 w-12 text-green-600 opacity-20" /></div>
            <div className="mt-4"><div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-green-500 h-2 rounded-full" style={{ width: `${passRate}%` }}></div></div></div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Average Score</p><p className="text-3xl font-bold text-blue-600">{Math.round(course.students.reduce((sum, s) => sum + s.courseworkTotal, 0) / Math.max(1, course.students.length))}%</p></div><BarChart3 className="h-12 w-12 text-blue-600 opacity-20" /></div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">At Risk Students</p><p className="text-3xl font-bold text-red-600">{course.students.filter(s => !s.examEligible).length}</p></div><AlertTriangle className="h-12 w-12 text-red-600 opacity-20" /></div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Download Reports</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button onClick={() => downloadClassPerformance(course.id)} className="flex items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"><Download className="h-5 w-5 text-blue-600 mr-2" /><span>Class Performance Sheet</span></button>
            <button onClick={() => downloadExamEligibility(course.id)} className="flex items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"><Download className="h-5 w-5 text-green-600 mr-2" /><span>Exam Eligibility Report</span></button>
            <button onClick={() => downloadAssessmentSummary(course.id)} className="flex items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"><Download className="h-5 w-5 text-purple-600 mr-2" /><span>Assessment Summary</span></button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200"><h3 className="text-lg font-semibold text-gray-900">Student Performance Summary</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coursework Total</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th></tr></thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {course.students.map(student => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{student.name}</div><div className="text-sm text-gray-500">{student.studentNumber}</div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className={`text-sm font-medium ${student.courseworkTotal >= 75 ? 'text-green-600' : student.courseworkTotal >= 50 ? 'text-blue-600' : 'text-red-600'}`}>{student.courseworkTotal}%</span></td>
                    <td className="px-6 py-4 whitespace-nowrap">{student.examEligible ? <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Exam Eligible</span> : <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Not Eligible</span>}</td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="w-full bg-gray-200 rounded-full h-2"><div className={`h-2 rounded-full ${student.courseworkTotal >= 75 ? 'bg-green-500' : student.courseworkTotal >= 50 ? 'bg-blue-500' : 'bg-red-500'}`} style={{ width: `${Math.min(student.courseworkTotal, 100)}%` }}></div></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const tabs = [
    { id: 'dashboard', name: 'Dashboard', icon: BarChart3 },
    { id: 'assessments', name: 'Assessments', icon: FileText },
    { id: 'marks', name: 'Mark Recording', icon: Edit },
    { id: 'reports', name: 'Reports', icon: Download }
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
              <span className="ml-4 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">Lecturer Portal</span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsProfileModalOpen(true)}
                className="flex items-center space-x-2 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors"
              >
                <User className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-700">{user.name}</span>
                <span className="text-xs text-gray-500">({user.userNumber})</span>
              </button>
              <button onClick={handleLogout} className="flex items-center space-x-1 text-gray-600 hover:text-red-600 transition-colors">
                <LogOut className="h-4 w-4" /><span className="text-sm">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - sticky below header (header h-16 = 64px -> top-16) */}
        <div className="w-64 bg-white shadow-sm border-r border-gray-200">
          <nav className="sticky top-16 h-[calc(100vh-64px)] overflow-y-auto py-6">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`w-full flex items-center px-6 py-3 text-left hover:bg-gray-50 transition-colors ${activeTab === tab.id ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600' : 'text-gray-700'}`}>
                  <Icon className="h-5 w-5 mr-3" />{tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main Content - scrollable independently */}
        <main className="flex-1 p-8 overflow-auto h-[calc(100vh-64px)]">
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'assessments' && renderAssessments()}
          {activeTab === 'marks' && renderMarks()}
          {activeTab === 'reports' && renderReports()}
        </main>
      </div>

      {/* Create Assessment Modal */}
      {showAssessmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200"><h3 className="text-lg font-semibold">Create New Assessment</h3><button onClick={() => setShowAssessmentModal(false)} className="text-gray-400 hover:text-gray-600">×</button></div>
            <div className="p-6">
              <form onSubmit={(e) => { e.preventDefault(); handleCreateAssessment(); }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Assessment Type</label>
                    <select
  value={newAssessment.type}
  onChange={(e) => setNewAssessment(prev => ({ ...prev, type: e.target.value }))}
  className="border rounded-lg px-3 py-2"
>
  <option value="">-- Select type --</option>
  {assessmentTypes.map(t => (
    <option key={t.id} value={t.name}>
      {t.name}
    </option>
  ))}
</select>

                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Assessment Name</label>
                    <input type="text" value={newAssessment.name} onChange={(e) => setNewAssessment(prev => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2 border rounded" placeholder="Enter assessment name" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Weight (%)</label>
                    <input type="number" min={1} max={100} value={newAssessment.weight} onChange={(e) => setNewAssessment(prev => ({ ...prev, weight: Number(e.target.value) }))} className="w-full px-3 py-2 border rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Maximum Marks</label>
                    <input type="number" min={1} value={newAssessment.maxMarks} onChange={(e) => setNewAssessment(prev => ({ ...prev, maxMarks: Number(e.target.value) }))} className="w-full px-3 py-2 border rounded" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                    <input type="date" value={newAssessment.dueDate} onChange={(e) => setNewAssessment(prev => ({ ...prev, dueDate: e.target.value }))} className="w-full px-3 py-2 border rounded" />
                  </div>
                </div>
              </form>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end space-x-3"><button onClick={() => setShowAssessmentModal(false)} className="px-4 py-2 border rounded">Cancel</button><button onClick={handleCreateAssessment} className="px-4 py-2 bg-blue-600 text-white rounded">Create Assessment</button></div>
          </div>
        </div>
      )}

      {/* Announcement Modal */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b"><h3 className="text-lg font-semibold">Send Announcement</h3><button onClick={() => setShowAnnouncementModal(false)} className="text-gray-400 hover:text-gray-600">×</button></div>
            <div className="p-6">
              <form onSubmit={(e) => { e.preventDefault(); handleSendAnnouncement(); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Course</label>
                  <select value={announcement.courseId} onChange={(e) => setAnnouncement(prev => ({ ...prev, courseId: e.target.value }))} className="w-full px-3 py-2 border rounded">
                    {lecturerData.courses.map(c => <option key={String(c.id)} value={String(c.id)}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                  <input type="text" value={announcement.title} onChange={(e) => setAnnouncement(prev => ({ ...prev, title: e.target.value }))} className="w-full px-3 py-2 border rounded" placeholder="Enter announcement title" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                  <textarea value={announcement.message} onChange={(e) => setAnnouncement(prev => ({ ...prev, message: e.target.value }))} rows={6} className="w-full px-3 py-2 border rounded" placeholder="Enter your announcement message..." />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Attach files (optional)</label>
                  <input type="file" multiple onChange={(e) => handleAnnouncementFiles(e.target.files)} />
                  <div className="mt-2 space-y-1 text-sm">
                    {announcementAttachments.map(f => (
                      <div key={f.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <a href={f.url} download={f.name} className="underline">{f.name}</a>
                        <button onClick={() => removeAnnouncementAttachment(f.id)} className="text-red-600 text-sm">Remove</button>
                      </div>
                    ))}
                  </div>
                </div>
              </form>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end space-x-3"><button onClick={() => setShowAnnouncementModal(false)} className="px-4 py-2 border rounded">Cancel</button><button onClick={handleSendAnnouncement} className="px-4 py-2 bg-blue-600 text-white rounded flex items-center"><Send className="h-4 w-4 mr-2" />Send Announcement</button></div>
          </div>
        </div>
      )}

      {/* Marks Modal */}
      {showMarksModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b"><h3 className="text-lg font-semibold">Enter Marks</h3><button onClick={() => setShowMarksModal(false)} className="text-gray-400 hover:text-gray-600">×</button></div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">Quick mark entry interface</p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Assessment</label>
                <select value={marksModalAssessmentId ?? ''} onChange={(e) => {
                  const val = e.target.value;
const parsed = val === '' ? null : val; // ✅ keep as string
setMarksModalAssessmentId(parsed);
                  if (parsed && selectedCourse) {
                    const course = lecturerData.courses.find(c => String(c.id) === selectedCourse);
                    if (course) {
                      const newVals: Record<string, number | null> = {};
course.students.forEach(s => newVals[s.id] = s.assessments[parsed!] ?? null);
                      setMarksModalValues(newVals);
                    }
                  }
                }} className="w-full px-3 py-2 border rounded">
                  <option value="">Select assessment</option>
                  {(lecturerData.courses.find(c => String(c.id) === selectedCourse)?.assessments ?? []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 overflow-auto">
                <table className="w-full">
                  <thead className="bg-gray-50"><tr><th className="p-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th><th className="p-3 text-left text-xs font-medium text-gray-500 uppercase">Student Number</th><th className="p-3 text-left text-xs font-medium text-gray-500 uppercase">Mark</th></tr></thead>
                  <tbody>
                    {(lecturerData.courses.find(c => String(c.id) === selectedCourse)?.students ?? []).map(s => (
                      <tr key={s.id} className="border-t">
                        <td className="p-3 text-sm text-gray-700">
  {s.name || '—'}
</td>
                        <td className="p-3 text-sm text-gray-700">{s.studentNumber}</td>
                        <td className="p-3"><input type="number" min={0} value={marksModalValues[s.id] ?? ''} onChange={(e) => { const v = e.target.value; setMarksModalValues(prev => ({ ...prev, [s.id]: v === '' ? null : Number(v) })); }} className="w-28 px-2 py-1 border rounded" placeholder="—" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end space-x-3"><button onClick={() => setShowMarksModal(false)} className="px-4 py-2 border rounded">Cancel</button><button onClick={handleSaveMarksModal} className="px-4 py-2 bg-green-600 text-white rounded">Save Marks</button></div>
          </div>
        </div>
      )}

      {/* View Assessment Modal */}
      {showViewAssessmentModal && viewAssessment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b"><h3 className="text-lg font-semibold">{viewAssessment.name}</h3><button onClick={() => { setShowViewAssessmentModal(false); setViewAssessment(null); }} className="text-gray-400 hover:text-gray-600">×</button></div>
            <div className="p-6 space-y-4">
              <div><strong>Type:</strong> {viewAssessment.type}</div>
              <div><strong>Weight:</strong> {viewAssessment.weight}%</div>
              <div><strong>Max Marks:</strong> {viewAssessment.maxMarks}</div>
              <div><strong>Due Date:</strong> {viewAssessment.dueDate}</div>
              <div><strong>Status:</strong> {viewAssessment.status}</div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end"><button onClick={() => { setShowViewAssessmentModal(false); setViewAssessment(null); }} className="px-4 py-2 border rounded">Close</button></div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(t => <div key={t.id} className={`px-4 py-2 rounded shadow text-sm ${t.type === 'success' ? 'bg-green-600 text-white' : t.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-800 text-white'}`}>{t.message}</div>)}
      </div>
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

export default LecturerDashboard;
