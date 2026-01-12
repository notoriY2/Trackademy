// src/components/admin/CourseModal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Save,
  X,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface FacultyRow { id: string; name: string; code?: string }
interface DepartmentRow { id: string; name: string; faculty_id: string; code?: string }
interface ProgramRow { id: string; name: string; department_id: string; faculty_id?: string; code?: string }

interface ScheduleSlot {
  enabled: boolean;
  startTime: string;
  endTime: string;
  venue: string;
}

interface CourseFormData {
  name: string;
  code: string;
  faculty: string;
  department: string;
  program: string;
  credits: number | string;
  description: string;
  prerequisites: string;
  semester: string;
  year: string;
  maxStudents: number | string;
  lecturer: string;
  lecturerId?: string | null;
  status: 'active' | 'inactive' | string;
  schedule: {
    monday: ScheduleSlot;
    tuesday: ScheduleSlot;
    wednesday: ScheduleSlot;
    thursday: ScheduleSlot;
    friday: ScheduleSlot;
  };
  budget?: number | string;
  established?: number | string;
  students?: number | string;
  lecturers?: number | string;
  courses?: number | string;
}

interface CourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  course?: any;
  onSave: (courseData: any) => void;
}

type LecturerRow = {
  id: string;
  lecturer_number?: string | null;
  profile_id?: string | null;
  profile?: {
    id: string;
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    user_number?: string | null;
    user_id?: string | null;
  } | null;
  email?: string | null;
};

const DAY_KEYS = ['monday','tuesday','wednesday','thursday','friday'] as const;

const CourseModal: React.FC<CourseModalProps> = ({ isOpen, onClose, course, onSave }) => {
    // DB-backed lists
  const [faculties, setFaculties] = useState<FacultyRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);

  // courses used for prerequisite suggestions
  interface CourseRow { id: string; code?: string | null; name?: string | null; program_id?: string | null; department_id?: string | null; }
  const [courses, setCourses] = useState<CourseRow[]>([]);

  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  // current signed-in user id (optional)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // form state
  const [formData, setFormData] = useState<CourseFormData>({
    name: '',
    code: '',
    faculty: '',
    department: '',
    program: '',
    credits: 3,
    description: '',
    prerequisites: '',
    semester: '',
    year: '1',
    maxStudents: 50,
    lecturer: '',
    lecturerId: null,
    status: 'active',
    schedule: {
      monday: { enabled: false, startTime: '', endTime: '', venue: '' },
      tuesday: { enabled: false, startTime: '', endTime: '', venue: '' },
      wednesday: { enabled: false, startTime: '', endTime: '', venue: '' },
      thursday: { enabled: false, startTime: '', endTime: '', venue: '' },
      friday: { enabled: false, startTime: '', endTime: '', venue: '' }
    }
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // UI banners
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // prerequisites suggestions (client-side)
  const [prereqSuggestions, setPrereqSuggestions] = useState<{ id: string; code: string; name: string; departmentId: string }[]>([]);
  const [showPrereqList, setShowPrereqList] = useState(false);

  // lecturer suggestions (server-backed)
  const [lecturerSuggestions, setLecturerSuggestions] = useState<LecturerRow[]>([]);
  const [showLecturerList, setShowLecturerList] = useState(false);

  // load faculties/departments/programs
  useEffect(() => {
    let mounted = true;
    const loadMeta = async () => {
      setIsLoadingMeta(true);
      setMetaError(null);
      try {
                const [fRes, dRes, pRes, cRes] = await Promise.all([
          supabase.from('faculties').select('id,name,code').order('name'),
          supabase.from('departments').select('id,name,faculty_id,code').order('name'),
          supabase.from('programs').select('id,name,department_id,faculty_id,code').order('name'),
          // fetch courses for prereq suggestions; include program relation so we can get department_id
          supabase.from('courses').select(`
            id,
            code,
            name,
            program_id,
            program:program_id ( id, department_id )
          `).order('name')
        ]);


        if (!mounted) return;

        if (fRes.error) throw fRes.error;
        if (dRes.error) throw dRes.error;
        if (pRes.error) throw pRes.error;

                setFaculties(fRes.data ?? []);
        setDepartments(dRes.data ?? []);
        setPrograms(pRes.data ?? []);
        // normalize courses so each has department_id (prefer program.department_id when available)
        const normalizedCourses: CourseRow[] = (cRes.data ?? []).map((cr: any) => ({
          id: cr.id,
          code: cr.code ?? null,
          name: cr.name ?? null,
          program_id: cr.program_id ?? (cr.program?.id ?? null),
          department_id: cr.program?.department_id ?? null
        }));
        setCourses(normalizedCourses);

      } catch (err: any) {
        console.error('Failed to load meta:', err);
        setMetaError(err?.message || 'Failed to load metadata from DB');
      } finally {
        if (mounted) setIsLoadingMeta(false);
      }
    };

    loadMeta();
    return () => { mounted = false; };
  }, []);

  // fetch current user id once — robust: supabase auth OR localStorage fallback
  useEffect(() => {
    let mounted = true;
    const detectUser = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const user = data?.session?.user;
        if (user && mounted) {
          setCurrentUserId(user.id);
        } else if (mounted) {
          setCurrentUserId(null);
        }
      } catch (err) {
        console.error("Error detecting current user id", err);
        if (mounted) setCurrentUserId(null);
      }
    };
    detectUser();
    return () => { mounted = false; };
  }, []);

    const existingCourses = useMemo(() => {
    const makeCode = (id: string, idx: number) => {
      const prefix = id
        .split('-')
        .slice(0, 2)
        .map(s => (s.length > 0 ? s[0].toUpperCase() + (s[1] || '') : ''))
        .join('')
        .replace(/[^A-Z]/g, '')
        .slice(0, 3) || 'CRS';
      const suffix = 100 + (idx % 900);
      return `${prefix}${suffix}`;
    };

    return (courses || []).map((c, idx) => ({
      id: c.id,
      // ensure code/name are strings for later toLowerCase() calls
      code: (c.code && String(c.code).trim()) || makeCode(c.id, idx),
      name: c.name ?? '',
      // normalise to non-null strings so consumers don't need to handle null
      departmentId: c.department_id ?? '',
      programId: c.program_id ?? ''
    }));
  }, [courses]);


  const filteredDepartments = departments.filter(d => !formData.faculty || d.faculty_id === formData.faculty);
  const filteredPrograms = programs.filter(p => !formData.department || p.department_id === formData.department);

  // ---------- HELPERS: convert schedules between form shape and DB rows ----------
  const scheduleFromRows = (rows: any[] | null) => {
    const base = {
      monday: { enabled: false, startTime: '', endTime: '', venue: '' },
      tuesday: { enabled: false, startTime: '', endTime: '', venue: '' },
      wednesday: { enabled: false, startTime: '', endTime: '', venue: '' },
      thursday: { enabled: false, startTime: '', endTime: '', venue: '' },
      friday: { enabled: false, startTime: '', endTime: '', venue: '' }
    } as CourseFormData['schedule'];

    if (!Array.isArray(rows)) return base;

    rows.forEach(r => {
      const day = String(r.day_of_week || '').toLowerCase();
      if (!DAY_KEYS.includes(day as any)) return;
      const start = r.start_time ? String(r.start_time).slice(0,5) : '';
      const end = r.end_time ? String(r.end_time).slice(0,5) : '';
      base[day as keyof typeof base] = {
        enabled: !!r.is_active,
        startTime: start,
        endTime: end,
        venue: r.venue || ''
      };
    });

    return base;
  };

  // ---------- Fetch authoritative course & related records when editing ----------
  useEffect(() => {
    if (!isOpen) return;
    if (!course || !course.id) {
      // reset (create mode)
      setFormData({
        name: '',
        code: '',
        faculty: '',
        department: '',
        program: '',
        credits: 3,
        description: '',
        prerequisites: '',
        semester: '',
        year: '1',
        maxStudents: 50,
        lecturer: '',
        lecturerId: null,
        status: 'active',
        schedule: {
          monday: { enabled: false, startTime: '', endTime: '', venue: '' },
          tuesday: { enabled: false, startTime: '', endTime: '', venue: '' },
          wednesday: { enabled: false, startTime: '', endTime: '', venue: '' },
          thursday: { enabled: false, startTime: '', endTime: '', venue: '' },
          friday: { enabled: false, startTime: '', endTime: '', venue: '' }
        }
      });
      setErrors({});
      setErrorBanner(null);
      setSuccessMessage(null);
      return;
    }

    let mounted = true;
    const fetchFullCourse = async () => {
      try {
        // Select course with program, lecturer summary and schedules
        const { data: fetched, error } = await supabase
          .from('courses')
          .select(`
            *,
            program:program_id ( id, name, department_id, faculty_id ),
            lecturer:lecturer_id ( id, lecturer_number, profile_id ),
            schedules:course_schedules ( id, day_of_week, start_time, end_time, venue, is_active )
          `)
          .eq('id', course.id)
          .maybeSingle();

        if (error) {
          console.warn('[CourseModal] fetchFullCourse fallback to provided course:', error);
          // fallback: map using provided course object (less authoritative)
        }

        const source = fetched ?? course;

        // determine program / department / faculty
        const programId = source.program?.id ?? source.program_id ?? source.program ?? '';
        const facultyId = source.program?.faculty_id ?? source.faculty ?? source.faculty_id ?? '';
        const departmentId = source.program?.department_id ?? source.department ?? source.department_id ?? '';

        // schedules mapping
        const schedulesRows = (fetched && fetched.schedules) ? fetched.schedules : (course.schedules ?? null);
        const scheduleShape = scheduleFromRows(schedulesRows);

        // lecturer display: fetch profile & user email if necessary
        let lecturerDisplay = '';
        let lecturerId = source.lecturer?.id ?? source.lecturer_id ?? source.lecturerId ?? null;
        if (lecturerId) {
          try {
            const { data: lectRow, error: lectErr } = await supabase
              .from('lecturers')
              .select('id, lecturer_number, profile_id')
              .eq('id', lecturerId)
              .maybeSingle();
            if (!lectErr && lectRow) {
              // try fetch profile and user email
              const profId = lectRow.profile_id;
              if (profId) {
                const { data: prof } = await supabase
                  .from('profiles')
                  .select('id, full_name, first_name, last_name, user_id')
                  .eq('id', profId)
                  .maybeSingle();
                let email = '';
                if (prof?.user_id) {
                  const { data: u } = await supabase
                    .from('users')
                    .select('email')
                    .eq('id', prof.user_id)
                    .maybeSingle();
                  email = u?.email ?? '';
                }
                lecturerDisplay = prof?.full_name ? String(prof.full_name) : `${prof?.first_name ?? ''} ${prof?.last_name ?? ''}`.trim();
                if (!lecturerDisplay && lectRow.lecturer_number) lecturerDisplay = String(lectRow.lecturer_number);
                if (!lecturerDisplay && email) lecturerDisplay = email;
              } else {
                // no profile: fall back to lecturer_number
                lecturerDisplay = lectRow.lecturer_number ?? '';
              }
            }
          } catch (e) {
            console.debug('[CourseModal] lecturer display fetch failed', e);
            // fallback to whatever we have
          }
        }

        if (!mounted) return;

        setFormData(prev => ({
          ...prev,
          name: source.name ?? prev.name,
          code: source.code ?? prev.code,
          program: programId || '',
          faculty: facultyId || '',
          department: departmentId || '',
          credits: source.credits ?? prev.credits,
          description: source.description ?? prev.description,
          prerequisites: source.prerequisites ?? prev.prerequisites ?? '',
          semester: source.semester ?? prev.semester ?? '',
          year: (source.year_level ?? source.year ?? prev.year) ? String(source.year_level ?? source.year ?? prev.year) : prev.year,
          maxStudents: source.max_students ?? prev.maxStudents,
          lecturer: lecturerDisplay || prev.lecturer || '',
          lecturerId: lecturerId ?? null,
          status: source.status ?? prev.status,
          schedule: scheduleShape
        }));

        setErrors({});
        setErrorBanner(null);
        setSuccessMessage(null);
      } catch (err: any) {
        console.error('[CourseModal] fetchFullCourse unexpected', err);
        setErrorBanner('Failed to load full course details');
      }
    };

    fetchFullCourse();

    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, course, programs, departments, faculties]);

  // ---------- validation (kept mostly same) ----------
  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    const timeToMinutes = (t: string) => {
      if (!t || typeof t !== 'string') return NaN;
      const parts = t.split(':');
      if (parts.length !== 2) return NaN;
      const hh = Number(parts[0]);
      const mm = Number(parts[1]);
      if (Number.isNaN(hh) || Number.isNaN(mm)) return NaN;
      return hh * 60 + mm;
    };

    if (!formData.name || !formData.name.toString().trim()) newErrors.name = 'Course name is required';

    if (!formData.code || !formData.code.toString().trim()) newErrors.code = 'Course code is required';
    else if (formData.code.toString().length > 50) newErrors.code = 'Course code must be 50 characters or less';
    else if (!/^[A-Za-z0-9\-_.]+$/.test(formData.code.toString())) newErrors.code = 'Course code contains invalid characters';

    if (!formData.faculty || !formData.faculty.toString().trim()) newErrors.faculty = 'Faculty is required';
    if (!formData.department || !formData.department.toString().trim()) newErrors.department = 'Department is required';
    if (!formData.program || !formData.program.toString().trim()) newErrors.program = 'Program is required';

    if (formData.credits === '' || formData.credits === null || formData.credits === undefined) {
      newErrors.credits = 'Credits are required';
    } else {
      const creditsNum = Number(formData.credits);
      if (Number.isNaN(creditsNum) || !Number.isInteger(creditsNum) || creditsNum < 0) newErrors.credits = 'Credits must be a whole number ≥ 0';
      else if (creditsNum > 30) newErrors.credits = 'Credits seem too large';
    }

    if (formData.year === '' || formData.year === null || formData.year === undefined) {
      newErrors.year = 'Year level is required';
    } else {
      const levelNum = Number(formData.year);
      if (Number.isNaN(levelNum) || !Number.isInteger(levelNum) || levelNum < 1 || levelNum > 10) {
        newErrors.year = 'Please enter a valid year level (1 - 10)';
      }
    }

    if (formData.maxStudents === '' || formData.maxStudents === null || formData.maxStudents === undefined) {
      newErrors.maxStudents = 'Maximum students is required';
    } else {
      const maxNum = Number(formData.maxStudents);
      if (Number.isNaN(maxNum) || !Number.isInteger(maxNum) || maxNum <= 0) newErrors.maxStudents = 'Max students must be a whole number > 0';
      else if (maxNum > 10000) newErrors.maxStudents = 'Max students seems unreasonably large';
    }
    // Schedule validation
    (DAY_KEYS as readonly string[]).forEach(day => {
      const slot = (formData.schedule as any)[day] as ScheduleSlot;
      if (!slot) return;
      if (slot.enabled) {
        const s = (slot.startTime || '').toString();
        const e = (slot.endTime || '').toString();
        if (!s) {
          newErrors[`schedule.${day}.startTime`] = `${day[0].toUpperCase() + day.slice(1)} start time is required`;
          return;
        }
        if (!e) {
          newErrors[`schedule.${day}.endTime`] = `${day[0].toUpperCase() + day.slice(1)} end time is required`;
          return;
        }
        const sMin = timeToMinutes(s);
        const eMin = timeToMinutes(e);
        if (Number.isNaN(sMin) || Number.isNaN(eMin)) {
          newErrors[`schedule.${day}`] = `${day[0].toUpperCase() + day.slice(1)} times must be in HH:MM format`;
        } else if (sMin >= eMin) {
          newErrors[`schedule.${day}`] = `${day[0].toUpperCase() + day.slice(1)} start time must be before end time`;
        }
        if (!slot.venue || !slot.venue.toString().trim()) {
          newErrors[`schedule.${day}.venue`] = `${day[0].toUpperCase() + day.slice(1)} venue is required when schedule is enabled`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // schedule handlers
  const handleToggleDay = (day: keyof CourseFormData['schedule']) => {
    setFormData(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: {
          ...prev.schedule[day],
          enabled: !prev.schedule[day].enabled
        }
      }
    }));
    setErrors(prev => {
      const copy = { ...prev };
      delete copy[`schedule.${day}`];
      delete copy[`schedule.${day}.startTime`];
      delete copy[`schedule.${day}.endTime`];
      delete copy[`schedule.${day}.venue`];
      return copy;
    });
  };

  const handleScheduleTimeChange = (day: keyof CourseFormData['schedule'], field: 'startTime' | 'endTime', value: string) => {
    setFormData(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: {
          ...prev.schedule[day],
          [field]: value
        }
      }
    }));
    setErrors(prev => ({ ...prev, [`schedule.${day}`]: '' }));
  };

  const handleScheduleVenueChange = (day: keyof CourseFormData['schedule'], value: string) => {
    setFormData(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: {
          ...prev.schedule[day],
          venue: value
        }
      }
    }));
    setErrors(prev => ({ ...prev, [`schedule.${day}.venue`]: '' }));
  };

  // input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    // lecturer field: special (clear selected id)
    if (name === 'lecturer') {
      setFormData(prev => ({ ...prev, lecturer: String(value), lecturerId: null }));
      updateLecturerSuggestions(String(value));
      if (errors.lecturer) setErrors(prev => ({ ...prev, lecturer: '' }));
      return;
    }

    if (name === 'faculty') {
      setFormData(prev => ({ ...prev, faculty: value, department: '', program: '' }));
      setErrors(prev => ({ ...prev, faculty: '', department: '', program: '' }));
      return;
    }

    if (name === 'department') {
      setFormData(prev => ({ ...prev, department: value, program: '' }));
      setErrors(prev => ({ ...prev, department: '', program: '' }));
      return;
    }

    // treat numeric fields specially — include 'year' as a numeric-like field (level)
    const coerced =
      name === 'credits' || name === 'maxStudents' || name === 'year'
        ? (value === '' ? '' : Number(value))
        : value;

    setFormData(prev => ({ ...prev, [name]: coerced } as any));

    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));

    if (name === 'prerequisites') updatePrereqSuggestions(String(value));
  };

  // prerequisites logic
const updatePrereqSuggestions = (fullValue: string) => {
  const tokens = fullValue.split(',').map(t => t.trim());
  const last = tokens[tokens.length - 1] || '';

  let candidateDeptIds: string[] = [];
  if (formData.program) {
    const prog = programs.find(p => p.id === formData.program);
    if (prog) candidateDeptIds = [prog.department_id];
  } else if (formData.department) {
    candidateDeptIds = [formData.department];
  } else if (formData.faculty) {
    candidateDeptIds = departments.filter(d => d.faculty_id === formData.faculty).map(d => d.id);
  } else {
    candidateDeptIds = departments.map(d => d.id);
  }

  const q = last.toLowerCase();

  const suggestions = existingCourses.filter(ec => {
    // ec.departmentId is now a string (may be ''), but still guard against empty
    if (!ec.departmentId) return false;
    const inDept = candidateDeptIds.includes(ec.departmentId);
    if (!inDept) return false;

    // if user hasn't typed a token to filter by, keep the candidate
    if (!q) return true;

    // guard nullability and compare case-insensitively
    return (ec.code ?? '').toLowerCase().includes(q) || (ec.name ?? '').toLowerCase().includes(q);
  });

  setPrereqSuggestions(suggestions.slice(0, 10));
  setShowPrereqList(true);
};


  const handleSelectPrereq = (suggestion: { id: string; code: string; name: string }) => {
    const current = formData.prerequisites || '';
    const tokens = current.split(',').map(t => t.trim()).filter(Boolean);

    const already = tokens.some(t => t.toLowerCase() === suggestion.code.toLowerCase() || t.toLowerCase() === suggestion.name.toLowerCase());
    if (!already) tokens.push(suggestion.code);

    const newVal = tokens.join(', ');
    setFormData(prev => ({ ...prev, prerequisites: newVal }));
    setPrereqSuggestions([]);
    setShowPrereqList(false);
    setErrors(prev => ({ ...prev, prerequisites: '' }));
  };

  useEffect(() => {
    if (formData.prerequisites) updatePrereqSuggestions(formData.prerequisites);
    else {
      setPrereqSuggestions([]);
      setShowPrereqList(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.faculty, formData.department, formData.program]);

  // ---------- Lecturer autocomplete (unchanged) ----------
  const updateLecturerSuggestions = async (typed: string) => {
    const q = (typed || '').trim();
    try {
      if (!q) {
        const { data: recentLects, error: rErr } = await supabase
          .from('lecturers')
          .select('id, lecturer_number, profile_id')
          .order('created_at', { ascending: false })
          .limit(12);
        if (rErr) throw rErr;

        const profileIds = Array.from(new Set((recentLects ?? []).map((r: any) => r.profile_id).filter(Boolean)));
        let profilesMap: Record<string, any> = {};
        if (profileIds.length > 0) {
          const { data: profRows } = await supabase
            .from('profiles')
            .select('id, full_name, first_name, last_name, user_number, user_id')
            .in('id', profileIds);
          if (profRows) profilesMap = profRows.reduce((acc: any, p: any) => { acc[p.id] = p; return acc; }, {});
        }

        const list = (recentLects ?? []).map((r: any) => ({
          id: r.id,
          lecturer_number: r.lecturer_number ?? null,
          profile_id: r.profile_id ?? null,
          profile: profilesMap[r.profile_id] ?? null,
          email: null
        })) as LecturerRow[];

        setLecturerSuggestions(list.slice(0, 10));
        setShowLecturerList(true);
        return;
      }

      const likeQ = `%${q.replace(/%/g, '\\%')}%`;

      const { data: profMatches } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name, user_number, user_id')
        .or(`full_name.ilike.${likeQ},first_name.ilike.${likeQ},last_name.ilike.${likeQ},user_number.ilike.${likeQ}`)
        .limit(200);

      const { data: lectByNumber } = await supabase
        .from('lecturers')
        .select('id, lecturer_number, profile_id')
        .ilike('lecturer_number', likeQ)
        .limit(200);

      const profileIdsFromProfiles = (profMatches ?? []).map((p: any) => p.id);
      const profileIdsFromLect = (lectByNumber ?? []).map((l: any) => l.profile_id).filter(Boolean);
      const allProfileIds = Array.from(new Set([...profileIdsFromProfiles, ...profileIdsFromLect]));

      const lecturersByProfile = allProfileIds.length > 0
        ? (await supabase.from('lecturers').select('id, lecturer_number, profile_id').in('profile_id', allProfileIds)).data ?? []
        : [];

      const mergedLects: any[] = [];
      const seen = new Set<string>();
      [...lecturersByProfile, ...(lectByNumber ?? [])].forEach((r: any) => {
        if (!seen.has(r.id)) { mergedLects.push(r); seen.add(r.id); }
      });

      const uniqProfilesMap: Record<string, any> = {};
      (profMatches ?? []).forEach((p: any) => { uniqProfilesMap[p.id] = p; });

      const neededProfileIds = Array.from(new Set(mergedLects.map(r => r.profile_id).filter(Boolean)));
      const missingProfileIds = neededProfileIds.filter(pid => !uniqProfilesMap[pid]);
      if (missingProfileIds.length > 0) {
        const { data: missingProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, first_name, last_name, user_number, user_id')
          .in('id', missingProfileIds);
        if (missingProfiles) missingProfiles.forEach((p: any) => { uniqProfilesMap[p.id] = p; });
      }

      const userIdsToFetch = Array.from(new Set(Object.values(uniqProfilesMap).map((p: any) => p?.user_id).filter(Boolean)));
      let userEmailMap: Record<string, string> = {};
      if (userIdsToFetch.length > 0) {
        const { data: usersRows } = await supabase
          .from('users')
          .select('id, email')
          .in('id', userIdsToFetch);
        if (usersRows) userEmailMap = usersRows.reduce((acc: any, u: any) => { acc[u.id] = u.email; return acc; }, {});
      }

      const list: LecturerRow[] = mergedLects.map(r => {
        const prof = r.profile_id ? uniqProfilesMap[r.profile_id] : null;
        const email = prof?.user_id ? userEmailMap[prof.user_id] : null;
        return {
          id: r.id,
          lecturer_number: r.lecturer_number ?? null,
          profile_id: r.profile_id ?? null,
          profile: prof ? {
            id: prof.id,
            full_name: prof.full_name ?? null,
            first_name: prof.first_name ?? null,
            last_name: prof.last_name ?? null,
            user_number: prof.user_number ?? null,
            user_id: prof.user_id ?? null
          } : null,
          email
        };
      });

      const lc = q.toLowerCase();
      const filtered = list.filter(l => {
        const name = (l.profile?.full_name ?? `${l.profile?.first_name ?? ''} ${l.profile?.last_name ?? ''}`).toLowerCase();
        const pnum = (l.profile?.user_number || '').toLowerCase();
        const lnum = (l.lecturer_number || '').toLowerCase();
        const em = (l.email || '').toLowerCase();
        return name.includes(lc) || pnum.includes(lc) || lnum.includes(lc) || em.includes(lc);
      });

      setLecturerSuggestions(filtered.slice(0, 12));
      setShowLecturerList(true);
    } catch (err: any) {
      console.error('Unexpected lecturer search error', err);
      setErrorBanner(err?.message || 'Failed to search lecturers');
      setLecturerSuggestions([]);
      setShowLecturerList(false);
    }
  };

  // display helpers for lecturer rows
  const computeDisplayName = (l: LecturerRow) => {
    const prof = l.profile;
    if (prof?.full_name && prof.full_name.trim()) return prof.full_name.trim();
    const firstLast = `${prof?.first_name ?? ''} ${prof?.last_name ?? ''}`.trim();
    if (firstLast) return firstLast;
    if (prof?.user_number) return prof.user_number;
    if (l.lecturer_number) return l.lecturer_number;
    if (l.email) return l.email;
    return '(no name)';
  };

  const computeSecondary = (l: LecturerRow) => {
    const parts: string[] = [];
    if (l.lecturer_number) parts.push(l.lecturer_number);
    if (l.profile?.user_number && l.profile.user_number !== l.lecturer_number) parts.push(l.profile.user_number);
    if (l.email) parts.push(l.email);
    return parts.join(' • ');
  };

  const handleSelectLecturer = (l: LecturerRow) => {
    const display = computeDisplayName(l);
    setFormData(prev => ({ ...prev, lecturer: display, lecturerId: l.id }));
    setLecturerSuggestions([]);
    setShowLecturerList(false);
    setErrors(prev => ({ ...prev, lecturer: '' }));
  };

  useEffect(() => {
    // clear suggestions on filter changes
    setLecturerSuggestions([]);
    setShowLecturerList(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.faculty, formData.department, formData.program]);

  // ---------- Sync course_schedules (create/update/delete) ----------
  const syncCourseSchedules = async (courseId: string, schedule: CourseFormData['schedule']) => {
    if (!courseId) return;

    try {
      // load existing rows for the course
      const { data: existingRows, error: existingErr } = await supabase
        .from('course_schedules')
        .select('id, day_of_week, start_time, end_time, venue, is_active')
        .eq('course_id', courseId);

      if (existingErr) {
        console.warn('[CourseModal] failed reading course_schedules:', existingErr);
        return;
      }

      const existingByDay: Record<string, any> = {};
      (existingRows ?? []).forEach((r: any) => {
        existingByDay[String(r.day_of_week).toLowerCase()] = r;
      });

      // upsert/insert & delete lists
      const toInsert: any[] = [];
      const toUpdate: Array<{ id: string; payload: any }> = [];
      const toDeleteIds: string[] = [];

      (DAY_KEYS as readonly string[]).forEach(day => {
        const slot = (schedule as any)[day] as ScheduleSlot;
        const existing = existingByDay[day];
        if (slot && slot.enabled) {
          const payload = {
            course_id: courseId,
            day_of_week: day,
            start_time: slot.startTime || null,
            end_time: slot.endTime || null,
            venue: slot.venue || null,
            is_active: true
          };
          if (existing) {
            // update if changed
            const changed =
              String(existing.start_time || '').slice(0,5) !== (payload.start_time || '') ||
              String(existing.end_time || '').slice(0,5) !== (payload.end_time || '') ||
              String(existing.venue || '') !== String(payload.venue || '') ||
              !!existing.is_active !== !!payload.is_active;
            if (changed) toUpdate.push({ id: existing.id, payload });
          } else {
            toInsert.push(payload);
          }
        } else {
          // not enabled -> delete existing if any
          if (existing) toDeleteIds.push(existing.id);
        }
      });

      // perform DB ops
      if (toDeleteIds.length) {
        await supabase.from('course_schedules').delete().in('id', toDeleteIds);
      }
      if (toUpdate.length) {
        // supabase doesn't support multi-update different payloads in single call;
        // do serially (small number of days)
        for (const up of toUpdate) {
          await supabase.from('course_schedules').update(up.payload).eq('id', up.id);
        }
      }
      if (toInsert.length) {
        await supabase.from('course_schedules').insert(toInsert);
      }
    } catch (err) {
      console.error('[CourseModal] syncCourseSchedules failed', err);
    }
  };

  // ---------- submit ----------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    setSuccessMessage(null);

    if (!validateForm()) return;
    setIsSubmitting(true);

    try {
      const payload: any = {
        program_id: formData.program,
        name: String(formData.name).trim(),
        code: String(formData.code).trim(),
        credits: Number(formData.credits),
        semester: formData.semester || null,
        year_level: Number(formData.year),
        max_students: Number(formData.maxStudents),
        status: formData.status || 'active',
        description: formData.description || null,
        prerequisites: formData.prerequisites || null,
        lecturer_id: formData.lecturerId ?? null
      };

      if (currentUserId) {
        payload.updated_by = currentUserId;
      }

      let res;
      if (course && course.id) {
        res = await supabase
          .from('courses')
          .update(payload)
          .eq('id', course.id)
          .select()
          .single();
      } else {
        if (currentUserId) {
          payload.created_by = currentUserId;
        }
        res = await supabase
          .from('courses')
          .insert([payload])
          .select()
          .single();
      }

      if (res.error) {
        console.error('Supabase error', res.error);
        setErrorBanner(`Failed to save course: ${res.error.message}${res.error.details ? ' — ' + res.error.details : ''}`);
        setIsSubmitting(false);
        return;
      }

      const saved = res.data;
      const courseId = saved.id;

      // sync schedules AFTER course exists
      try {
        await syncCourseSchedules(courseId, formData.schedule);
      } catch (e) {
        console.warn('[CourseModal] schedule sync failed (non-fatal)', e);
      }

      // Build parent-friendly object to return to parent
      const facultyObj = faculties.find(f => f.id === formData.faculty);
      const deptObj = departments.find(d => d.id === formData.department);
      const progObj = programs.find(p => p.id === formData.program);

      const courseForParent = {
        id: saved.id,
        name: saved.name,
        code: saved.code,
        program_id: saved.program_id,
        program: progObj?.name ?? formData.program,
        department: deptObj?.name ?? formData.department,
        faculty: facultyObj?.name ?? formData.faculty,
        credits: saved.credits,
        semester: saved.semester,
        year_level: saved.year_level ?? null,
        max_students: saved.max_students,
        enrolled_students: saved.enrolled_students,
        status: saved.status,
        description: saved.description,
        prerequisites: saved.prerequisites,
        lecturer_id: saved.lecturer_id ?? null,
        lecturer: formData.lecturer || '',
        schedule: formData.schedule
      };

      setSuccessMessage(course ? 'Course updated successfully.' : 'Course created successfully.');
      onSave(courseForParent);

      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 900);
    } catch (err: any) {
      console.error('Unexpected error saving course:', err);
      setErrorBanner(err?.message || 'Unexpected error while saving course');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // choose the year-level options you need; here we offer 1..6 (common), can extend
  const yearLevelOptions = [1, 2, 3, 4, 5, 6];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <BookOpen className="h-6 w-6 text-blue-600" />
            <h3 className="text-xl font-semibold text-gray-900">{course ? 'Edit Course' : 'Add New Course'}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close modal">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* banners */}
          {successMessage && (
            <div className="mb-4 p-3 rounded-md bg-green-50 border border-green-200 text-green-800 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172 4.707 7.879a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8z" clipRule="evenodd"/></svg>
                <span className="font-medium">{successMessage}</span>
              </div>
            </div>
          )}

          {(errorBanner || metaError) && (
            <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-800 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5" />
                <div className="text-sm">
                  <div>{errorBanner}</div>
                  {metaError && <div className="mt-1 text-xs text-gray-600">Meta load error: {metaError}</div>}
                </div>
              </div>
              <button type="button" onClick={() => { setErrorBanner(null); setMetaError(null); }} className="text-red-600 underline text-sm">Dismiss</button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Information */}
            <div className="md:col-span-2">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <BookOpen className="h-5 w-5 mr-2" />
                Basic Information
              </h4>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Course Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name ? 'border-red-300' : 'border-gray-300'}`}
                placeholder="e.g., Introduction to Programming"
              />
              {errors.name && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.name}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Course Code *</label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.code ? 'border-red-300' : 'border-gray-300'}`}
                placeholder="e.g., ICT101"
                maxLength={50}
              />
              {errors.code && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.code}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Faculty *</label>
              <select name="faculty" value={formData.faculty} onChange={handleInputChange} className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.faculty ? 'border-red-300' : 'border-gray-300'}`}>
                <option value="">{isLoadingMeta ? 'Loading faculties...' : 'Select Faculty'}</option>
                {faculties.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              {errors.faculty && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.faculty}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Department *</label>
              <select name="department" value={formData.department} onChange={handleInputChange} disabled={!formData.faculty} className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.department ? 'border-red-300' : 'border-gray-300'} ${!formData.faculty ? 'bg-gray-50' : ''}`}>
                <option value="">{formData.faculty ? 'Select Department' : 'Select Faculty first'}</option>
                {filteredDepartments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {errors.department && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.department}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Program *</label>
              <select name="program" value={formData.program} onChange={handleInputChange} disabled={!formData.department} className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.program ? 'border-red-300' : 'border-gray-300'} ${!formData.department ? 'bg-gray-50' : ''}`}>
                <option value="">{formData.department ? 'Select Program' : 'Select Department first'}</option>
                {filteredPrograms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {errors.program && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.program}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Credits *</label>
              <input type="number" name="credits" value={formData.credits as any} onChange={handleInputChange} min={0} className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.credits ? 'border-red-300' : 'border-gray-300'}`} placeholder="e.g., 3" />
              {errors.credits && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.credits}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
              <select name="semester" value={formData.semester} onChange={handleInputChange} className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.semester ? 'border-red-300' : 'border-gray-300'}`}>
                <option value="">Select Semester</option>
                <option value="Semester 1">1st Semester</option>
                <option value="Semester 2">2nd Semester</option>
              </select>
              {errors.semester && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.semester}</div>}
            </div>

            {/* YEAR LEVEL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Year Level *</label>
              <select name="year" value={formData.year} onChange={handleInputChange} className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.year ? 'border-red-300' : 'border-gray-300'}`}>
                <option value="">{'Select Year Level'}</option>
                {yearLevelOptions.map(opt => <option key={opt} value={String(opt)}>{`${opt} ${opt === 1 ? '(1st year)' : opt === 2 ? '(2nd year)' : opt === 3 ? '(3rd year)' : '(year ' + opt + ')'}`}</option>)}
              </select>
              {errors.year && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.year}</div>}
            </div>

            {/* Course Details */}
            <div className="md:col-span-2 mt-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <BookOpen className="h-5 w-5 mr-2" />
                Course Details
              </h4>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea name="description" value={formData.description} onChange={handleInputChange} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Short description of the course" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Prerequisites (type to search)</label>
              <div className="relative">
                <input
                  type="text"
                  name="prerequisites"
                  value={formData.prerequisites}
                  onChange={handleInputChange}
                  onFocus={() => { if (formData.prerequisites) updatePrereqSuggestions(formData.prerequisites); }}
                  onBlur={() => setTimeout(() => setShowPrereqList(false), 150)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.prerequisites ? 'border-red-300' : 'border-gray-300'}`}
                  placeholder="e.g., ICT101, BIO201"
                  aria-autocomplete="list"
                />
                {showPrereqList && prereqSuggestions.length > 0 && (
                  <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 shadow-sm max-h-48 overflow-auto rounded" role="listbox">
                    {prereqSuggestions.map(s => (
                      <li
                        key={s.id}
                        role="option"
                        onMouseDown={(ev) => { ev.preventDefault(); handleSelectPrereq(s); }}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                      >
                        <span className="font-medium mr-2">{s.code}</span>
                        <span className="text-gray-600">{s.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Students *</label>
              <input type="number" name="maxStudents" value={formData.maxStudents as any} onChange={handleInputChange} min={1} className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.maxStudents ? 'border-red-300' : 'border-gray-300'}`} placeholder="e.g., 50" />
              {errors.maxStudents && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.maxStudents}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Lecturer</label>
              <div className="relative">
                <input
                  type="text"
                  name="lecturer"
                  value={formData.lecturer}
                  onChange={handleInputChange}
                  onFocus={() => updateLecturerSuggestions(formData.lecturer || '')}
                  onBlur={() => setTimeout(() => setShowLecturerList(false), 150)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.lecturer ? 'border-red-300' : 'border-gray-300'}`}
                  placeholder="Search lecturer by name, staff number or email"
                  aria-autocomplete="list"
                />
                {showLecturerList && lecturerSuggestions.length > 0 && (
                  <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 shadow-sm max-h-48 overflow-auto rounded" role="listbox">
                    {lecturerSuggestions.map(s => (
                      <li
                        key={s.id}
                        role="option"
                        onMouseDown={(ev) => { ev.preventDefault(); handleSelectLecturer(s); }}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                      >
                        <div className="font-medium">{computeDisplayName(s)}</div>
                        <div className="text-xs text-gray-600">{computeSecondary(s)}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {errors.lecturer && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.lecturer}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select name="status" value={formData.status} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Schedule */}
            <div className="md:col-span-2 mt-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Schedule
              </h4>

              <div className="grid grid-cols-1 gap-4">
                {DAY_KEYS.map(day => {
                  const slot = formData.schedule?.[day];
                  const dayLabel = day[0].toUpperCase() + day.slice(1);
                  return (
                    <div key={day} className="flex items-center gap-4">
                      <div className="flex items-center space-x-2 w-48">
                        <input id={`sch-${day}`} type="checkbox" checked={!!slot?.enabled} onChange={() => handleToggleDay(day)} className="h-4 w-4 text-blue-600" />
                        <label htmlFor={`sch-${day}`} className="text-sm font-medium text-gray-700">{dayLabel}</label>
                      </div>

                      <div className="flex items-center gap-2">
                        <input type="time" name={`${day}.startTime`} value={slot?.startTime || ''} onChange={(e) => handleScheduleTimeChange(day, 'startTime', e.target.value)} disabled={!slot?.enabled} className={`px-2 py-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[`schedule.${day}.startTime`] ? 'border-red-300' : 'border-gray-300'}`} />
                        <span className="text-sm text-gray-500">to</span>
                        <input type="time" name={`${day}.endTime`} value={slot?.endTime || ''} onChange={(e) => handleScheduleTimeChange(day, 'endTime', e.target.value)} disabled={!slot?.enabled} className={`px-2 py-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[`schedule.${day}.endTime`] ? 'border-red-300' : 'border-gray-300'}`} />
                        <input type="text" name={`${day}.venue`} value={slot?.venue || ''} onChange={(e) => handleScheduleVenueChange(day, e.target.value)} disabled={!slot?.enabled} placeholder="Venue" className={`ml-2 px-3 py-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[`schedule.${day}.venue`] ? 'border-red-300' : 'border-gray-300'}`} />
                      </div>

                      {errors[`schedule.${day}`] && <div className="text-sm text-red-600 ml-4">{errors[`schedule.${day}`]}</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Submit buttons */}
            <div className="md:col-span-2 mt-8 flex justify-end space-x-3">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>{isSubmitting ? (course ? 'Updating...' : 'Saving...') : (course ? 'Update Course' : 'Create Course')}</span>
              </button>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
};

export default CourseModal;
