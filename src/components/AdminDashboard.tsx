import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getPerformanceMetrics, getDepartmentPerformance, getCoursePerformance, type PerformanceMetrics, type DepartmentPerformance as DeptPerf, type CoursePerformance } from '../lib/analytics';
import { GraduationCap, Users, BookOpen, BarChart3, Settings, LogOut, ChevronLeft, User, ChevronRight, ArrowLeft, ArrowUp, ArrowDown, Minus, Plus, Bell, Activity, CreditCard as Edit, Trash2, Eye, Building, Boxes, X, Award, Calendar, FileText, Zap, Download, Upload, Info, Search, Filter, UserPlus, UserCheck, AlertTriangle, TrendingUp, TrendingDown, Save, Target, Clock, CheckCircle, XCircle, Mail, Phone, MapPin, DollarSign } from 'lucide-react';

import FacultyModal from './admin/FacultyModal';
import StudentModal from './admin/StudentModal';
import ProgramModal from './admin/ProgramModal';
import CourseModal from './admin/CourseModal';
import ExportModal from './admin/ExportModal';
import LecturerModal from './admin/LecturerModal';
import DepartmentModal from './admin/DepartmentModal';
import UserProfileModal from './UserProfileModal';

// --- imports here ---

// ✅ define this right near the top of your component
const safeLower = (val: any): string =>
  typeof val === 'string' ? val.toLowerCase() : '';


// Define helper row types
type EventTypeRow = { id: string; name: string };
type CourseRow = { id: string; code: string; name: string };
type LecturerRow = { id: string; profiles: { first_name: string; last_name: string }[] };

// helper: choose first value that is not null/undefined
const coalesce = <T,>(...vals: (T | undefined | null)[]): T | undefined => {
  for (const v of vals) if (v !== undefined && v !== null) return v;
  return undefined;
};

interface User {
  userNumber: string;
  role: string;
  name: string;
}

interface ViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  type: 'student' | 'lecturer' | 'course' | 'department' | 'program' | 'faculty';
}

const ViewModal: React.FC<ViewModalProps> = ({ isOpen, onClose, data, type }) => {
  if (!isOpen || !data) return null;

  const renderContent = () => {
    switch (type) {
      case 'student':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Personal Information</h4>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Name:</span> {data.firstName} {data.lastName}</div>
                <div><span className="font-medium">Student Number:</span> {data.studentNumber}</div>
                <div><span className="font-medium">Email:</span> {data.email}</div>
                <div><span className="font-medium">Status:</span> 
                  <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Active</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Academic Information</h4>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Department:</span> {data.department}</div>
                <div><span className="font-medium">Program:</span> {data.program}</div>
                <div><span className="font-medium">Year of Study:</span> {data.yearOfStudy}</div>
                <div><span className="font-medium">GPA:</span> 3.2</div>
              </div>
            </div>
          </div>
        );
      
      case 'lecturer':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Personal Information</h4>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Name:</span> {data.firstName} {data.lastName}</div>
                <div><span className="font-medium">Lecturer Number:</span> {data.lecturerNumber}</div>
                <div><span className="font-medium">Email:</span> {data.email}</div>
                <div><span className="font-medium">Status:</span> 
                  <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Active</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Professional Information</h4>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Faculty:</span> {data.faculty}</div>
                <div><span className="font-medium">Position:</span> {data.position}</div>
                <div><span className="font-medium">Qualification:</span> {data.qualification}</div>
                <div><span className="font-medium">Courses:</span> 3</div>
              </div>
            </div>
          </div>
        );
      
      case 'course':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Course Details</h4>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Name:</span> {data.courseName}</div>
                <div><span className="font-medium">Code:</span> {data.courseCode}</div>
                <div><span className="font-medium">Faculty:</span> {data.faculty}</div>
                <div><span className="font-medium">Credits:</span> {data.credits}</div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Course Information</h4>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Semester:</span> {data.semester}</div>
                <div><span className="font-medium">Lecturer:</span> {data.lecturer}</div>
                <div><span className="font-medium">Enrolled:</span> 42/50</div>
                <div><span className="font-medium">Status:</span> 
                  <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Active</span>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'faculty':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Faculty Information</h4>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium">Name:</span> {data.name}</div>
                  <div><span className="font-medium">Code:</span> {data.code}</div>
                  <div><span className="font-medium">Head:</span> {data.head}</div>
                  <div><span className="font-medium">Status:</span> 
                    <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Active</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Statistics</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{data.students}</div>
                    <div className="text-xs text-gray-600">Students</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{data.lecturers}</div>
                    <div className="text-xs text-gray-600">Lecturers</div>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{data.courses}</div>
                    <div className="text-xs text-gray-600">Courses</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

        case 'department':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Department Information</h4>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium">Name:</span> {data.name}</div>
                  <div><span className="font-medium">Code:</span> {data.code}</div>
                  <div><span className="font-medium">Status:</span> 
                    <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Active</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Statistics</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{data.students}</div>
                    <div className="text-xs text-gray-600">Students</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{data.lecturers}</div>
                    <div className="text-xs text-gray-600">Lecturers</div>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{data.courses}</div>
                    <div className="text-xs text-gray-600">Courses</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'program':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Program Details</h4>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Name:</span> {data.name}</div>
                <div><span className="font-medium">Code:</span> {data.code}</div>
                <div><span className="font-medium">Faculty:</span> {data.faculty}</div>
                <div><span className="font-medium">Duration:</span> {data.duration}</div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Program Information</h4>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Credits:</span> {data.credits}</div>
                <div><span className="font-medium">Enrolled Students:</span> 89</div>
                <div><span className="font-medium">Status:</span> 
                  <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Active</span>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return <div>No data available</div>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 capitalize">
            {type === 'faculty' ? 'Faculty' : type.charAt(0).toUpperCase() + type.slice(1)} Details
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ×
          </button>
        </div>
        <div className="p-6">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

interface Faculty {
  id: number;
  name: string;
  code: string;
  head: string;
  email: string;
  phone: string;
  location: string;
  established: string;
  budget: number;
  status: 'active' | 'inactive';
  description: string;
  vision: string;
  mission: string;
  students: number;
  lecturers: number;
  courses: number;
}

interface Course {
  id: number;
  name: string;
  code: string;
  faculty: string;
  department: string;
  program: string;
  credits: number;
  description: string;
  prerequisites: string;
  semester: string;
  year: string;
  maxStudents: number;
  lecturer: string;
  status: 'active' | 'inactive';
  state?: string; // <-- add this line (optional fallback field)
  enrolledStudents: number;
  schedule: {
    monday: { enabled: boolean; startTime: string; endTime: string; venue: string };
    tuesday: { enabled: boolean; startTime: string; endTime: string; venue: string };
    wednesday: { enabled: boolean; startTime: string; endTime: string; venue: string };
    thursday: { enabled: boolean; startTime: string; endTime: string; venue: string };
    friday: { enabled: boolean; startTime: string; endTime: string; venue: string };
  };
}

// ---------- types (put near your other interfaces) ----------
interface AdminAlert {
  id: number | string;
  type?: string;
  title?: string;
  message: string;
  count?: number;
  color?: string;
  details?: string;
  priority?: string;
  deadline?: string | null;
  created_at?: string | null;
}

interface RecentActivity {
  id?: number | string;
  type?: string;
  message: string;
  time?: string | Date | null;
  icon?: React.ComponentType<any>;
}

type Trend = 'up' | 'down' | 'flat';

interface AnalyticsKpi {
  value?: number;
  trend?: Trend;
  change?: number;
}

interface AnalyticsData {
  kpis?: {
    passRate?: AnalyticsKpi;
    retention?: AnalyticsKpi;
    eligibility?: AnalyticsKpi;
    employment?: AnalyticsKpi;
    enrollment?: AnalyticsKpi;
    // keep open for future keys
    [key: string]: any;
  };

  departmentPerformance?: DepartmentPerformanceItem[]; // <-- typed
  enrollmentTrends?: any[];
  courseAnalytics?: any[];
  retentionAnalysis?: any[];
  examEligibility?: any[];

  // optional fallbacks / alternate shapes your code uses
  timeRangeMonths?: number;
  rangeMonths?: number;
  period?: string | number;
  time_range?: string | number;
  ongoingAssessments?: number;
  assessments?: { ongoing?: number } | null;
  upcomingExams?: number;
  passRate?: number;
  dropoutRate?: number;
  enrollment?: number;

  [key: string]: any;
}

// add near AnalyticsData (top of file, with other interfaces)
interface DepartmentPerformanceItem {
  name: string;
  students: number;
  passRate: number;
  avgGPA: number;
  completion: number;
  trend: Trend;
  // allow extra props that downstream code might rely on
  [key: string]: any;
}





interface Program {
  id: number;
  name: string;
  code: string;
  faculty: string;
  department: string;
  level: string;
  duration: string;
  credits: number;
  tuitionFee: number;
  coordinator: string;
  maxStudents: number;
  applicationDeadline: string;
  startDate: string;
  accreditation: string;
  deliveryMode: string;
  status: 'active' | 'inactive';
  description: string;
  admissionRequirements: string;
  careerProspects: string;
  vision: string;
  mission: string;
  enrolledStudents: number;
  established: string;
}

interface Student {
  id: number;
  firstName: string;
  lastName: string;
  studentNumber: string;
  email: string;
  faculty: string;
  department: string;
  program: string;
  yearOfStudy: number;
  status: 'active' | 'inactive' | 'graduated';
  gpa: number;
  enrollmentDate: string;
}

interface Lecturer {
  id: number;
  firstName: string;
  lastName: string;
  lecturerNumber: string;
  email: string;
  phone: string;
  faculty: string;
  department: string;
  position: string;
  qualification: string;
  specialization: string;
  officeLocation: string;
  startDate: string;
  status: 'active' | 'inactive';
  courses: number;
  students: number;
  experience: string;
  researchAreas: string;
  publications: number;
}

interface Department {
  id: number;
  name: string;
  code: string;
  faculty: string;
  students: number;
  lecturers: number;
  courses: number;
  budget: number;
  status: 'active' | 'inactive';
}

// after
interface ScheduleEvent {
  id: string; // uuid from supabase
  type: 'lecture' | 'meeting' | 'event';
  title: string;
  course?: string;
  lecturer?: string;
  venue: string;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  date: string;      // "YYYY-MM-DD"
  attendees?: number;
  maxAttendees?: number;
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  description?: string;
}

interface EventFormData {
  type: 'lecture' | 'meeting' | 'event';
  title: string;
  course: string;
  lecturer: string;
  venue: string;
  startTime: string;
  endTime: string;
  date: string;
  maxAttendees: string;
  description: string;
}

/* -------------------------
   Message UI: Banner / Toast / Card
   ------------------------- */
interface Message {
  text: string;
  type: 'success' | 'error' | 'info' | 'warning';
  style: 'banner' | 'toast' | 'card';
}

const MessageDisplay: React.FC<{ message: Message; onClose: () => void }> = ({ message, onClose }) => {
  const colors: Record<Message['type'], string> = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800'
  };

  const common = `flex items-center justify-between p-3 border rounded-md shadow-sm ${colors[message.type]}`;

  if (message.style === 'banner') {
    return (
      <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[min(1200px,calc(100%-2rem))] ${common}`}>
        <div className="flex items-center space-x-3">
          <CheckCircle className="h-5 w-5" />
          <div className="text-sm">{message.text}</div>
        </div>
        <button onClick={onClose} className="text-sm underline">Close</button>
      </div>
    );
  }

  if (message.style === 'toast') {
    return (
      <div className={`fixed bottom-6 right-6 z-50 max-w-xs ${common}`}>
        <div className="flex items-center space-x-3">
          <CheckCircle className="h-5 w-5" />
          <div className="text-sm">{message.text}</div>
        </div>
        <button onClick={onClose} className="ml-3 text-sm"><XCircle className="h-4 w-4" /></button>
      </div>
    );
  }

  // card (inline)
  return (
    <div className={`my-4 ${common}`}>
      <div className="flex items-center space-x-3">
        <CheckCircle className="h-5 w-5" />
        <div className="text-sm">{message.text}</div>
      </div>
      <button onClick={onClose} className="text-sm underline">Dismiss</button>
    </div>
  );
};
/* -------------------------
   End Message UI
   ------------------------- */


const AdminDashboard: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
    const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
    const [showEventModal, setShowEventModal] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [filterType, setFilterType] = useState<string>('all');
      const [isSubmitting, setIsSubmitting] = useState(false);
      const [successMessage, setSuccessMessage] = useState('');
      const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
      const [eventToDelete, setEventToDelete] = useState<ScheduleEvent | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFaculty, setFilterFaculty] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterProgram, setFilterProgram] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  
  // Modal states
  const [isFacultyModalOpen, setIsFacultyModalOpen] = useState(false);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false);
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [isLecturerModalOpen, setIsLecturerModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [analyticsTimeRange, setAnalyticsTimeRange] = useState('12');
  const [analyticsDepartment, setAnalyticsDepartment] = useState('all');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  

  // ---------- state (add next to other useState hooks) ----------

// --- State (add near other useState declarations) ---
const [defaultSemester, setDefaultSemester] = useState<string | null>(null);
const [ongoingAssessmentsCount, setOngoingAssessmentsCount] = useState<number | null>(null);
const [upcomingExamsCount, setUpcomingExamsCount] = useState<number | null>(null);
const [enrollmentVal, setEnrollmentVal] = useState<number | null>(null);

// KPI state (we set pass/dropout values you supplied)
const [passKpiVal, setPassKpiVal] = useState<number | null>(null); // will show 0%
const [passKpiTrend, setPassKpiTrend] = useState<string | null>(null);
const [dropoutVal, setDropoutVal] = useState<number | null>(null); // 12% as you specified

// Derived percent values for bars (0-100 clamped)
const passPct = Math.max(0, Math.min(100, Math.round((passKpiVal ?? 0) * 10) / 10));
const dropoutPct = Math.max(0, Math.min(100, Math.round((dropoutVal ?? 0) * 10) / 10));


  
  const [formData, setFormData] = useState<EventFormData>({
      type: 'lecture',
      title: '',
      course: '',
      lecturer: '',
      venue: '',
      startTime: '',
      endTime: '',
      date: '',
      maxAttendees: '50',
      description: ''
    });

    /* ---------- sample lists (Course and Lecturer objects) ---------- */
  

    // replace mock array with:
const [scheduleEvents, setScheduleEvents] = useState<ScheduleEvent[]>([]);
      

  const venues = [
    'Room A101',
    'Room A102',
    'Room B201',
    'Room B202',
    'Room C205',
    'Lab A',
    'Lab B',
    'Lab C',
    'Hall A',
    'Hall B',
    'Main Auditorium',
    'Conference Room',
    'Library Hall',
    'Seminar Room 1',
    'Seminar Room 2'
  ];

  // Autocomplete visibility
  const [showCourseSuggestions, setShowCourseSuggestions] = useState(false);
  const [showLecturerSuggestions, setShowLecturerSuggestions] = useState(false);
  const [showVenueSuggestions, setShowVenueSuggestions] = useState(false);

  const resetForm = () => {
    setFormData({
      type: 'lecture',
      title: '',
      course: '',
      lecturer: '',
      venue: '',
      startTime: '',
      endTime: '',
      date: '',
      maxAttendees: '50',
      description: ''
    });
    setShowCourseSuggestions(false);
    setShowLecturerSuggestions(false);
    setShowVenueSuggestions(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'course') setShowCourseSuggestions(value.trim().length > 0);
    if (name === 'lecturer') setShowLecturerSuggestions(value.trim().length > 0);
    if (name === 'venue') setShowVenueSuggestions(value.trim().length > 0);
  };

    
  
    // helper to get current user id (existing function in your file; re-use it)
const getCurrentUserId = async () => {
  try {
    const session = await getCurrentUser();
return session?.user?.id ?? null;

  } catch (err) {
    console.error('getCurrentUserId err', err);
    return null;
  }
};

// ✅ Add Event
// ✅ Full updated handleAddEvent (created_by can be null if no user found)
const handleAddEvent = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsSubmitting(true);

  try {
    // --- 1️⃣ Resolve event type (try select, create if missing) ---
    let eventTypeId: string | null = null;
    try {
      const { data: etRows, error: etErr } = await supabase
        .from('event_types')
        .select('id, name')
        .ilike('name', formData.type)
        .limit(1);

      if (etErr) throw etErr;
      const types = (etRows ?? []) as { id: string; name: string }[];
      if (types.length > 0) {
        eventTypeId = types[0].id;
      } else {
        // create event type on-the-fly (safer than failing because events.event_type_id is NOT NULL)
        const { data: newType, error: createErr } = await supabase
          .from('event_types')
          .insert({ name: formData.type, description: null })
          .select('id')
          .limit(1)
          .single();
        if (createErr) throw createErr;
        eventTypeId = newType.id;
      }
    } catch (err) {
      console.error('Error resolving/creating event type:', err);
      // If eventTypeId couldn't be resolved/created we should abort because event_type_id is NOT NULL in schema
      throw new Error('Unable to resolve or create event type.');
    }

    // --- 2️⃣ Resolve course (optional) ---
    let courseId: string | null = null;
    if (formData.course) {
      const code = formData.course.split(' - ')[0].trim();
      try {
        const { data: courseRows, error: courseErr } = await supabase
          .from('courses')
          .select('id, code, name')
          .ilike('code', code)
          .limit(1);

        if (courseErr) throw courseErr;
        const courses = (courseRows ?? []) as { id: string; code: string; name: string }[];
        if (courses.length > 0) courseId = courses[0].id;
      } catch (err) {
        console.error('Error fetching course:', err);
      }
    }

    // --- 3️⃣ Resolve lecturer (optional) ---
    let lecturerId: string | null = null;
    if (formData.lecturer) {
      const [first, ...rest] = formData.lecturer.trim().split(' ');
      const last = rest.join(' ');
      try {
        const { data: lecturerRows, error: lecturerErr } = await supabase
          .from('lecturers')
          .select('id, profiles ( first_name, last_name )')
          .ilike('profiles.first_name', `${first}%`)
          .ilike('profiles.last_name', `${last}%`)
          .limit(1);

        if (lecturerErr) throw lecturerErr;
        const lecturers = (lecturerRows ?? []) as { id: string; profiles?: { first_name: string; last_name: string }[] }[];
        if (lecturers.length > 0) lecturerId = lecturers[0].id;
      } catch (err) {
        console.error('Error fetching lecturer:', err);
      }
    }

    // --- 4️⃣ Determine creator (allow null now) ---
    const creatorId = await getCurrentUserId(); // may return null
    if (!creatorId) {
      console.warn('No authenticated user found. Proceeding with created_by = null.');
      // NOTE: your DB schema currently defines created_by as NOT NULL; inserting a null may fail.
      // We allow proceeding with null here per your request, but if the DB rejects, we catch that below
      // and surface a helpful message.
    }

    // --- 5️⃣ Build insert payload (allow created_by null) ---
    const insertPayload: any = {
      event_type_id: eventTypeId,
      course_id: courseId,
      lecturer_id: lecturerId,
      title: formData.title,
      description: formData.description || null,
      event_date: formData.date,
      start_time: formData.startTime,
      end_time: formData.endTime,
      venue: formData.venue,
      max_attendees: formData.maxAttendees ? parseInt(formData.maxAttendees, 10) : null,
      // allow null if no user found
      created_by: creatorId ?? null
    };

    // --- 6️⃣ Insert and return related rows using plural relationship names ---
    const { data: insertData, error: insertError } = await supabase
      .from('events')
      .insert(insertPayload)
      .select(`
        id, title, description, event_date, start_time, end_time, venue,
        max_attendees, current_attendees, status,
        event_types ( name ),
        courses ( id, code, name ),
        lecturers ( id, profiles ( first_name, last_name ) )
      `)
      .single();

    if (insertError) {
      // If the DB rejects because created_by is null and NOT NULL constraint exists, give a friendly message
      console.error('Supabase insert error:', insertError);

      // Helpful diagnostic for NOT NULL / FK problems
      const msgLower = (insertError.message || '').toLowerCase();
      if ((creatorId == null) && (msgLower.includes('null') || msgLower.includes('not null') || insertError.code === '23502')) {
        // 23502 is PostgreSQL NOT NULL violation code; PostgREST may wrap errors differently
        setSuccessMessage('Failed to create event: server requires an authenticated user (created_by).');
      } else {
        setSuccessMessage('Failed to create event. Check console for details.');
      }
      throw insertError;
    }

    // --- 7️⃣ Map DB result to ScheduleEvent (local UI model) ---
    const r: any = insertData;
    const mapped: ScheduleEvent = {
      id: String(r.id),
      type:
        Array.isArray(r.event_types) && r.event_types.length > 0
          ? r.event_types[0].name
          : (formData.type as ScheduleEvent['type']),
      title: r.title ?? '',
      course:
        Array.isArray(r.courses) && r.courses.length > 0
          ? `${r.courses[0].code} - ${r.courses[0].name}`
          : undefined,
      lecturer:
        Array.isArray(r.lecturers) &&
        r.lecturers.length > 0 &&
        Array.isArray(r.lecturers[0].profiles) &&
        r.lecturers[0].profiles.length > 0
          ? `${r.lecturers[0].profiles[0].first_name} ${r.lecturers[0].profiles[0].last_name}`
          : undefined,
      venue: r.venue ?? '',
      startTime: (r.start_time ?? '').slice(0, 5),
      endTime: (r.end_time ?? '').slice(0, 5),
      date: r.event_date ?? '',
      attendees: r.current_attendees ?? undefined,
      maxAttendees: r.max_attendees ?? undefined,
      status: (r.status ?? 'scheduled') as ScheduleEvent['status'],
      description: r.description ?? undefined
    };

    // --- 8️⃣ Update local state + UI ---
    setScheduleEvents(prev => [...prev, mapped]);
    setSuccessMessage(`Event "${mapped.title}" has been successfully created!`);
    setShowAddModal(false);
    resetForm();
  } catch (err) {
    console.error('handleAddEvent error', err);
    // If we didn't already set a specific message, set a general one:
    if (!successMessage) setSuccessMessage('Failed to create event. Check console for details.');
  } finally {
    setIsSubmitting(false);
    // clear the successMessage after a short delay
    setTimeout(() => setSuccessMessage(''), 3000);
  }
};

  // ✅ Edit Event
const handleEditEvent = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!editingEvent) return;
  setIsSubmitting(true);

  try {
    // Resolve event type
    let eventTypeId: string | null = null;
    try {
      const { data: etRows, error: etErr } = await supabase
        .from('event_types')
        .select('id, name')
        .eq('name', formData.type)
        .limit(1);
      if (!etErr && etRows && etRows.length > 0) eventTypeId = etRows[0].id;
    } catch {}

    // Resolve course
    let courseId: string | null = null;
    if (formData.course) {
      const code = formData.course.split(' - ')[0].trim();
      try {
        const { data: courseRows, error: courseErr } = await supabase
          .from('courses')
          .select('id, code, name')
          .ilike('code', code)
          .limit(1);
        if (!courseErr && courseRows && courseRows.length > 0) courseId = courseRows[0].id;
      } catch {}
    }

    // Resolve lecturer
    let lecturerId: string | null = null;
    if (formData.lecturer) {
      const [first, ...rest] = formData.lecturer.trim().split(' ');
      const last = rest.join(' ');
      try {
        const { data: lecturerRows, error: lecturerErr } = await supabase
          .from('lecturers')
          .select('id, profiles ( first_name, last_name )')
          .ilike('profiles.first_name', `${first}%`)
          .ilike('profiles.last_name', `${last}%`)
          .limit(1);
        if (!lecturerErr && lecturerRows && lecturerRows.length > 0) lecturerId = lecturerRows[0].id;
      } catch {}
    }

    // Update payload
    const updatePayload: any = {
      event_type_id: eventTypeId,
      course_id: courseId,
      lecturer_id: lecturerId,
      title: formData.title,
      description: formData.description || null,
      event_date: formData.date,
      start_time: formData.startTime,
      end_time: formData.endTime,
      venue: formData.venue,
      max_attendees: formData.maxAttendees ? parseInt(formData.maxAttendees, 10) : null,
      updated_at: new Date().toISOString()
    };

    const { data: updatedRow, error: updateError } = await supabase
      .from('events')
      .update(updatePayload)
      .eq('id', editingEvent.id)
      .select(`
        id, title, description, event_date, start_time, end_time, venue, max_attendees, current_attendees, status,
        event_types ( name ), courses ( id, code, name ), lecturers ( id, profiles ( first_name, last_name ) )
      `)
      .single();

    if (updateError) throw updateError;

    // Map updated row
    const r = updatedRow;
    const mapped: ScheduleEvent = {
      id: String(r.id),
      type:
        Array.isArray(r.event_types) && r.event_types.length > 0
          ? r.event_types[0].name
          : (formData.type as ScheduleEvent['type']),
      title: r.title ?? '',
      course:
        Array.isArray(r.courses) && r.courses.length > 0
          ? `${r.courses[0].code} - ${r.courses[0].name}`
          : undefined,
      lecturer:
        Array.isArray(r.lecturers) &&
        r.lecturers.length > 0 &&
        Array.isArray(r.lecturers[0].profiles) &&
        r.lecturers[0].profiles.length > 0
          ? `${r.lecturers[0].profiles[0].first_name} ${r.lecturers[0].profiles[0].last_name}`
          : undefined,
      venue: r.venue ?? '',
      startTime: (r.start_time ?? '').slice(0, 5),
      endTime: (r.end_time ?? '').slice(0, 5),
      date: r.event_date ?? '',
      attendees: r.current_attendees ?? undefined,
      maxAttendees: r.max_attendees ?? undefined,
      status: (r.status ?? 'scheduled') as ScheduleEvent['status'],
      description: r.description ?? undefined
    };

    setScheduleEvents(prev => prev.map(ev => (ev.id === editingEvent.id ? mapped : ev)));
    setSuccessMessage(`Event "${mapped.title}" has been successfully updated!`);
    setShowEditModal(false);
    setEditingEvent(null);
    resetForm();
  } catch (err) {
    console.error('handleEditEvent error', err);
    setSuccessMessage('Failed to update event. See console for details.');
  } finally {
    setIsSubmitting(false);
    setTimeout(() => setSuccessMessage(''), 3000);
  }
};


    // ✅ Delete Event
const handleDeleteEvent = async () => {
  if (!eventToDelete) return;
  setIsSubmitting(true);

  try {
    const { error } = await supabase.from('events').delete().eq('id', eventToDelete.id);
    if (error) throw error;

    setScheduleEvents(prev => prev.filter(event => event.id !== eventToDelete.id));
    setSuccessMessage(`Event "${eventToDelete.title}" has been successfully deleted!`);
    setShowDeleteModal(false);
    setEventToDelete(null);
  } catch (err) {
    console.error('handleDeleteEvent error', err);
    setSuccessMessage('Failed to delete event. See console for details.');
  } finally {
    setIsSubmitting(false);
    setTimeout(() => setSuccessMessage(''), 3000);
  }
};


  const openEditModal = (event: ScheduleEvent) => {
    setEditingEvent(event);
    setFormData({
      type: event.type,
      title: event.title,
      course: event.course || '',
      lecturer: event.lecturer || '',
      venue: event.venue,
      startTime: event.startTime,
      endTime: event.endTime,
      date: event.date,
      maxAttendees: event.maxAttendees?.toString() || '50',
      description: event.description || ''
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (event: ScheduleEvent) => {
    setEventToDelete(event);
    setShowDeleteModal(true);
  };

  const getCurrentUser = async () => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user ?? null;

  if (!user) return null;

  // Example: fetch lecturer faculties if you need them
  const { data: facultyData, error: facultyError } = await supabase
    .from('lecturer_faculties_agg')
    .select('*')
    .eq('lecturer_id', user.id);

  if (facultyError) throw facultyError;

  return { user, faculties: facultyData };
  
};

// ✅ bulletproof search filter
const filteredEvents = Array.isArray(scheduleEvents)
  ? scheduleEvents.filter((event: ScheduleEvent | null | undefined) => {
      if (!event || typeof event !== 'object') return false;

      const search = safeLower(searchTerm);
      const type = event?.type ?? '';
      const title = safeLower(event?.title);
      const course = safeLower(event?.course);
      const lecturer = safeLower(event?.lecturer);
      const venue = safeLower(event?.venue);

      const matchesType = filterType === 'all' || type === filterType;
      const matchesSearch =
        !search ||
        title.includes(search) ||
        course.includes(search) ||
        lecturer.includes(search) ||
        venue.includes(search);

      return matchesType && matchesSearch;
    })
  : [];




  const exportSchedule = () => {
    const csvContent = [
      ['Title', 'Type', 'Date', 'Start Time', 'End Time', 'Venue', 'Course', 'Lecturer', 'Status'],
      ...filteredEvents.map(event => [
        event.title,
        event.type,
        event.date,
        event.startTime,
        event.endTime,
        event.venue,
        event.course || '',
        event.lecturer || '',
        event.status
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `academic-schedule-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getWeekDates = (date: Date) => {
    const week = [];
    const startDate = new Date(date);
    const day = startDate.getDay();
    const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
    startDate.setDate(diff);

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      week.push(currentDate);
    }
    return week;
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const getEventsForDate = (date: string) => {
    return scheduleEvents.filter(event => event.date === date);
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDate(newDate);
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'lecture': return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'meeting': return 'bg-purple-100 border-purple-300 text-purple-800';
      case 'event': return 'bg-green-100 border-green-300 text-green-800';
      default: return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'ongoing': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const weekDates = getWeekDates(currentDate);

  const handleQuickAction = (action: string) => {
  switch (action) {
    case 'schedule':
      setActiveTab('schedule');
      break;
    default:
      console.log('Unknown action:', action);
  }
};

  // Edit states

  const [alertModal, setAlertModal] = useState<{isOpen: boolean, alert: any}>({
    isOpen: false,
    alert: null
  });

  const [viewModal, setViewModal] = useState<{isOpen: boolean, data: any, type: any}>({
    isOpen: false,
    data: null,
    type: null
  });
  const [editFaculty, setEditFaculty] = useState<Faculty | undefined>();
  const [editLecturer, setEditLecturer] = useState<Lecturer | undefined>();
  const [editStudent, setEditStudent] = useState<Student | undefined>();
  const [editDepartment, setEditDepartment] = useState<Department | undefined>();
  const [editCourse, setEditCourse] = useState<Course | undefined>();
  const [editProgram, setEditProgram] = useState<Program | undefined>();

  const [courses, setCourses] = useState<Course[]>([]);
const [lecturers, setLecturers] = useState<Lecturer[]>([]);
const [students, setStudents] = useState<Student[]>([]);
const [faculties, setFaculties] = useState<Faculty[]>([]);
const [departments, setDepartments] = useState<Department[]>([]);
const [programs, setPrograms] = useState<Program[]>([]);

  // Message state (for banner / toast / card)
    const [message, setMessage] = useState<Message | null>(null);
  
    const showMessage = (text: string, type: Message['type'] = 'success', style: Message['style'] = 'toast') => {
      setMessage({ text, type, style });
      // auto-dismiss toast/banner after 4s, keep card until dismissed
      if (style !== 'card') {
        setTimeout(() => {
          setMessage(null);
        }, 4000);
      }
    };

    // ---------- state ---------- //
const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(true);

// ---------- helpers (reuse/define near imports) ---------- //
const safeNum = (v: any): number => {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

const decideTrend = (value: number, goodThreshold = 80, warnThreshold = 70): Trend => {
  if (value >= goodThreshold) return 'up';
  if (value >= warnThreshold) return 'flat';
  return 'down';
};

  const navigate = useNavigate();

  const handleViewAlert = (alert: any) => {
    setAlertModal({ isOpen: true, alert });
  };

  // update signature to accept optional
const getTrendIcon = (trend?: string) => {
  switch (trend) {
    case 'up': return <ArrowUp className="h-4 w-4 text-green-500" />;
    case 'down': return <ArrowDown className="h-4 w-4 text-red-500" />;
    default: return <Minus className="h-4 w-4 text-gray-500" />;
  }
};


  const getPerformanceColor = (value: number, type: 'rate' | 'gpa' | 'score') => {
    if (type === 'rate') {
      if (value >= 80) return 'text-green-600';
      if (value >= 70) return 'text-yellow-600';
      return 'text-red-600';
    }
    if (type === 'gpa') {
      if (value >= 3.0) return 'text-green-600';
      if (value >= 2.5) return 'text-yellow-600';
      return 'text-red-600';
    }
    if (type === 'score') {
      if (value >= 75) return 'text-green-600';
      if (value >= 65) return 'text-yellow-600';
      return 'text-red-600';
    }
    return 'text-gray-600';
  };

  const getPerformanceBadge = (value: number, type: 'rate' | 'gpa' | 'score') => {
    if (type === 'rate') {
      if (value >= 80) return 'bg-green-100 text-green-800';
      if (value >= 70) return 'bg-yellow-100 text-yellow-800';
      return 'bg-red-100 text-red-800';
    }
    if (type === 'gpa') {
      if (value >= 3.0) return 'bg-green-100 text-green-800';
      if (value >= 2.5) return 'bg-yellow-100 text-yellow-800';
      return 'bg-red-100 text-red-800';
    }
    if (type === 'score') {
      if (value >= 75) return 'bg-green-100 text-green-800';
      if (value >= 65) return 'bg-yellow-100 text-yellow-800';
      return 'bg-red-100 text-red-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  // safe formatters — paste right after your imports
const formatNumber = (val?: number | string | null): string => {
  if (val === undefined || val === null || val === '') return '-';
  const n = Number(val);
  if (Number.isNaN(n)) return '-';
  return n.toLocaleString();
};

const formatCurrency = (val?: number | string | null): string => {
  if (val === undefined || val === null || val === '') return '-';
  const n = Number(val);
  if (Number.isNaN(n)) return '-';
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};


  useEffect(() => {
  let mounted = true;

  const fetchAdminData = async () => {
  try {
    // 1) Fetch core tables (simple selects) + lecturer_faculties
    const [
      courseRes,
      lecturerRes,
      facultyRes,
      deptRes,
      progRes,
      studentRes,
      lecturerFacRes
    ] = await Promise.all([
      supabase.from('courses').select('*'),
      supabase.from('lecturers').select('*'),
      supabase.from('faculties').select('*'),
      supabase.from('departments').select('*'),
      supabase.from('programs').select('*'),
      supabase.from('students').select('*'),
      supabase.from('lecturer_faculties').select('lecturer_id, faculty_id')
    ]);

    if (!mounted) return;

    // set basic lists (faculties kept for filters, programs/departments will be set after mapping)
    if (!courseRes.error) {
      setCourses(courseRes.data ?? []);
    }
    if (!facultyRes.error) setFaculties(facultyRes.data ?? []);

    console.debug('fetch summary', {
      courses: courseRes.data?.length ?? 0,
      lecturers: lecturerRes.data?.length ?? 0,
      faculties: facultyRes.data?.length ?? 0,
      departments: deptRes.data?.length ?? 0,
      programs: progRes.data?.length ?? 0,
      students: studentRes.data?.length ?? 0,
      lecturer_faculties: lecturerFacRes.data?.length ?? 0,
      lecturer_faculties_error: lecturerFacRes.error ?? null
    });

    // normalize raw arrays
    const studentsRaw = Array.isArray(studentRes.data) ? studentRes.data : [];
    const lecturersRaw = Array.isArray(lecturerRes.data) ? lecturerRes.data : [];
    const programsRaw = Array.isArray(progRes.data) ? progRes.data : [];
    const facultiesList = Array.isArray(facultyRes.data) ? facultyRes.data : [];
    const deptsList = Array.isArray(deptRes.data) ? deptRes.data : [];
    const coursesList = Array.isArray(courseRes.data) ? courseRes.data : [];
    const lecturerFacRows = Array.isArray(lecturerFacRes.data) ? lecturerFacRes.data : [];

    // 2) Build lookups for programs/faculties/departments
    const progById = programsRaw.reduce<Record<string, any>>((acc, p: any) => { if (p?.id) acc[p.id] = p; return acc; }, {});
    const facById = facultiesList.reduce<Record<string, any>>((acc, f: any) => { if (f?.id) acc[f.id] = f; return acc; }, {});
    const deptById = deptsList.reduce<Record<string, any>>((acc, d: any) => { if (d?.id) acc[d.id] = d; return acc; }, {});

    // quick name->id map for faculty string matches
    const facIdByName: Record<string, string> = {};
    for (const fid of Object.keys(facById)) {
      const fn = (facById[fid]?.name ?? '').toString().trim();
      if (fn) facIdByName[fn.toLowerCase()] = fid;
    }

    // Map programs to include faculty/department names for UI
    const mappedPrograms = programsRaw.map((p: any) => {
      let facultyLabel = '';
      if (p?.faculty_id && facById[p.faculty_id]) facultyLabel = facById[p.faculty_id].name ?? '';
      else if (p?.faculty && typeof p.faculty === 'string') facultyLabel = p.faculty;

      let departmentLabel = '';
      if (p?.department_id && deptById[p.department_id]) departmentLabel = deptById[p.department_id].name ?? '';
      else if (p?.department && typeof p.department === 'string') departmentLabel = p.department;

      return { ...p, faculty: facultyLabel, department: departmentLabel };
    });

    if (!mounted) return;
    setPrograms(mappedPrograms);

    // 3) Build lecturer -> program_id(s) map using courses (courses.lecturer_id -> program_id)
    const lecturerProgramsMap: Record<string, Set<string>> = {};
    for (const course of coursesList) {
      const lecId = course?.lecturer_id;
      const progId = course?.program_id;
      if (!lecId) continue;
      if (!lecturerProgramsMap[lecId]) lecturerProgramsMap[lecId] = new Set<string>();
      if (progId) lecturerProgramsMap[lecId].add(progId);
    }

    // 3.b) Build lecturer -> faculty_id(s) map from lecturer_faculties (preferred)
    const lecturerFacMapByLecturerId: Record<string, string[]> = {};
    for (const row of lecturerFacRows) {
      if (!row || !row.lecturer_id) continue;
      if (!lecturerFacMapByLecturerId[row.lecturer_id]) lecturerFacMapByLecturerId[row.lecturer_id] = [];
      lecturerFacMapByLecturerId[row.lecturer_id].push(row.faculty_id);
    }

    console.debug('facById sample keys', Object.keys(facById).slice(0,10));
    console.debug('lecturerFacMap sample (first 10):', Object.entries(lecturerFacMapByLecturerId).slice(0,10));
    console.debug('lecturerProgramsMap sample (first 10):', Object.entries(lecturerProgramsMap).slice(0,10));

    // Convert to lecturer -> facultyName by prioritizing lecturer_faculties (if present), otherwise falling back
    const lecturerFacultyById: Record<string, string> = {};
    const allLecturerIds = new Set<string>([
      ...Object.keys(lecturerProgramsMap),
      ...Object.keys(lecturerFacMapByLecturerId),
      ...lecturersRaw.map((l:any) => l?.id).filter(Boolean)
    ]);

    for (const lecId of allLecturerIds) {
      const names: string[] = [];

      // 1) If lecturer_faculties exists for this lecturer, resolve faculty names
      const mappedFacultyIds = lecturerFacMapByLecturerId[lecId] ?? [];
      for (const fid of mappedFacultyIds) {
        const f = facById[fid];
        if (f && f.name) names.push(f.name);
        else if (fid) names.push(String(fid));
      }

      // 2) Fallback: try the courses->program->faculty path
      if (names.length === 0) {
        const progIds = lecturerProgramsMap[lecId] ?? new Set<string>();
        for (const pid of progIds) {
          const p = progById[pid];
          if (!p) continue;
          if (p.faculty_id && facById[p.faculty_id]) {
            names.push(facById[p.faculty_id].name ?? '');
            break;
          } else if (p.faculty && typeof p.faculty === 'string') {
            names.push(p.faculty);
            break;
          }
        }
      }

      // 3) Fallback: lecturer row might include faculty or faculty_id fields
      if (names.length === 0) {
        const lr = lecturersRaw.find((x: any) => x?.id === lecId);
        if (lr) {
          if (lr.faculty_id && facById[lr.faculty_id]) names.push(facById[lr.faculty_id].name ?? '');
          else if (lr.faculty && typeof lr.faculty === 'string') names.push(lr.faculty);
        }
      }

      lecturerFacultyById[lecId] = names.length > 0 ? names.filter(Boolean).join(', ') : '';
    }

    // 4) Collect profile_ids for students + lecturers and fetch profiles
    const profileIdsSet = new Set<string>();
    studentsRaw.forEach(s => { if (s?.profile_id) profileIdsSet.add(s.profile_id); });
    lecturersRaw.forEach(l => { if (l?.profile_id) profileIdsSet.add(l.profile_id); });
    const profileIds = Array.from(profileIdsSet);

    let profilesById: Record<string, any> = {};
    if (profileIds.length > 0) {
      const { data: profilesData, error: profilesErr } = await supabase
        .from('profiles')
        .select('*')
        .in('id', profileIds);
      console.debug('profiles fetch', { profilesErr, count: profilesData?.length ?? 0 });
      if (!profilesErr && Array.isArray(profilesData)) {
        profilesById = profilesData.reduce<Record<string, any>>((acc, p: any) => { if (p?.id) acc[p.id] = p; return acc; }, {});
      }
    }

    // 5) From profiles fetch users for emails
    const userIdsSet = new Set<string>();
    Object.values(profilesById).forEach((p: any) => { if (p?.user_id) userIdsSet.add(p.user_id); });
    const userIds = Array.from(userIdsSet);

    let usersById: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: usersData, error: usersErr } = await supabase
        .from('users')
        .select('id,email')
        .in('id', userIds);
      console.debug('users fetch', { usersErr, count: usersData?.length ?? 0 });
      if (!usersErr && Array.isArray(usersData)) {
        usersById = usersData.reduce<Record<string, any>>((acc, u: any) => { if (u?.id) acc[u.id] = u; return acc; }, {});
      }
    }

    // 6) Map students to UI-friendly Student type
    const mappedStudents = studentsRaw.map((s: any) => {
      const profile = s.profile_id ? profilesById[s.profile_id] : undefined;
      const email = profile?.user_id ? usersById[profile.user_id]?.email : '';

      const programObj = s.program_id ? progById[s.program_id] : null;
      const programLabel = programObj ? (programObj.name ?? programObj.code ?? '') : (s.program ?? s.program_id ?? '');

      const facultyName = programObj?.faculty_id ? (facById[programObj.faculty_id]?.name ?? '') : (programObj?.faculty ?? '');

      const departmentName = programObj?.department_id ? (deptById[programObj.department_id]?.name ?? '') : (programObj?.department ?? '');

      return {
        id: s.id,
        firstName: profile?.first_name ?? s.first_name ?? '',
        lastName: profile?.last_name ?? s.last_name ?? '',
        studentNumber: s.student_number ?? '',
        email: email ?? s.email ?? '',
        faculty: facultyName,
        department: departmentName,
        program: programLabel,
        yearOfStudy: s.year_of_study ?? '',
        status: s.status ?? '',
        enrollmentDate: s.enrollment_date ?? null,
        gpa: typeof s.gpa !== 'undefined' && s.gpa !== null ? Number(s.gpa) : null
      } as any;
    });

    if (!mounted) return;
    setStudents(mappedStudents);

    // 7) Map lecturers and assign faculty via lecturerFacultyById lookup
    const mappedLecturers = lecturersRaw.map((l: any) => {
      const profile = l.profile_id ? profilesById[l.profile_id] : undefined;
      const email = profile?.user_id ? usersById[profile.user_id]?.email : undefined;
      const fullName = profile?.full_name ?? `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim();

      const facultyFromLookup = lecturerFacultyById[l.id] ?? '';

      return {
        id: l.id,
        lecturerNumber: l.lecturer_number ?? '',
        firstName: profile?.first_name ?? l.first_name ?? '',
        lastName: profile?.last_name ?? l.last_name ?? '',
        fullName,
        email: email ?? l.email ?? '',
        position: l.position ?? '',
        qualification: l.qualification ?? '',
        specialization: l.specialization ?? '',
        officeLocation: l.office_location ?? '',
        startDate: l.start_date ?? null,
        status: l.status ?? '',
        experience: l.experience ?? '',
        researchAreas: l.research_areas ?? '',
        publicationsCount: typeof l.publications_count !== 'undefined' ? Number(l.publications_count) : 0,
        faculty: facultyFromLookup,
        createdAt: l.created_at ?? null,
        updatedAt: l.updated_at ?? null
      } as any;
    });

    if (!mounted) return;
    setLecturers(mappedLecturers);

    // 8) Map courses to UI-friendly shape (populate faculty/department/program/lecturer)
    const lecById = lecturersRaw.reduce<Record<string, any>>((acc, lr: any) => { if (lr?.id) acc[lr.id] = lr; return acc; }, {});

    const mappedCourses = coursesList.map((c: any) => {
      const programObj = c.program_id ? progById[c.program_id] : null;
      const programLabel = programObj ? (programObj.name ?? programObj.code ?? '') : (c.program ?? c.program_id ?? '');

      // faculty via program first, then course-level fallback
      let facultyLabel = '';
      if (programObj) {
        if (programObj.faculty_id && facById[programObj.faculty_id]) facultyLabel = facById[programObj.faculty_id].name ?? '';
        else if (programObj.faculty && typeof programObj.faculty === 'string') facultyLabel = programObj.faculty;
      }
      if (!facultyLabel) {
        if (c.faculty_id && facById[c.faculty_id]) facultyLabel = facById[c.faculty_id].name ?? '';
        else if (c.faculty && typeof c.faculty === 'string') facultyLabel = c.faculty;
      }

      // department via program first, then course fallback
      let departmentLabel = '';
      if (programObj) {
        if (programObj.department_id && deptById[programObj.department_id]) departmentLabel = deptById[programObj.department_id].name ?? '';
        else if (programObj.department && typeof programObj.department === 'string') departmentLabel = programObj.department;
      }
      if (!departmentLabel) {
        if (c.department_id && deptById[c.department_id]) departmentLabel = deptById[c.department_id].name ?? '';
        else if (c.department && typeof c.department === 'string') departmentLabel = c.department;
      }

      // lecturer name resolution via profiles (if lecturer record references profile)
      let lecturerLabel = '';
      if (c.lecturer_id && lecById[c.lecturer_id]) {
        const lr = lecById[c.lecturer_id];
        const prof = lr?.profile_id ? profilesById[lr.profile_id] : undefined;
        if (prof) lecturerLabel = (prof.full_name ?? `${prof.first_name ?? ''} ${prof.last_name ?? ''}`).trim();
        else lecturerLabel = lr.lecturer_number ?? lr.email ?? '';
      } else if (c.lecturer && typeof c.lecturer === 'string') {
        lecturerLabel = c.lecturer;
      } else if (c.lecturer_number) {
        const found = lecturersRaw.find((lr: any) => (lr.lecturer_number ?? '') === c.lecturer_number);
        if (found) {
          const pf = found.profile_id ? profilesById[found.profile_id] : undefined;
          lecturerLabel = pf ? (pf.full_name ?? `${pf.first_name ?? ''} ${pf.last_name ?? ''}`).trim() : (found.lecturer_number ?? '');
        }
      }

      return {
  ...c,
  program: programLabel,
  faculty: facultyLabel,
  department: departmentLabel,
  lecturer: lecturerLabel,
  status: (c.status ?? c.state ?? 'inactive') as 'active' | 'inactive' | string
};
    });

    if (!mounted) return;
    setCourses(mappedCourses);

    // --- DEPARTMENTS: compute faculty name + counts (courses, distinct lecturers, students) ---
    if (!mounted) return;
    const deptIds = Object.keys(deptById);

    const resolveCourseDepartmentId = (course: any) => {
      if (course?.department_id) return course.department_id;
      if (course?.program_id) {
        const p = progById[course.program_id];
        if (p?.department_id) return p.department_id;
      }
      return null;
    };

    const courseCountsByDept: Record<string, number> = {};
    for (const dId of deptIds) courseCountsByDept[dId] = 0;
    for (const c of coursesList) {
      const deptId = resolveCourseDepartmentId(c);
      if (deptId && Object.prototype.hasOwnProperty.call(courseCountsByDept, deptId)) courseCountsByDept[deptId] += 1;
    }

    const lecturerSetByDept: Record<string, Set<string>> = {};
    for (const dId of deptIds) lecturerSetByDept[dId] = new Set<string>();
    for (const [lecId, progIdSet] of Object.entries(lecturerProgramsMap)) {
      for (const pid of Array.from(progIdSet)) {
        const p = progById[pid];
        const depId = p?.department_id ?? null;
        if (depId && lecturerSetByDept[depId]) lecturerSetByDept[depId].add(lecId);
      }
    }
    const lecturerCountsByDept: Record<string, number> = {};
    for (const dId of deptIds) lecturerCountsByDept[dId] = lecturerSetByDept[dId]?.size ?? 0;

    const studentCountsByDept: Record<string, number> = {};
    for (const dId of deptIds) studentCountsByDept[dId] = 0;
    for (const s of studentsRaw) {
      const pid = s?.program_id;
      if (!pid) continue;
      const p = progById[pid];
      const depId = p?.department_id ?? null;
      if (depId && Object.prototype.hasOwnProperty.call(studentCountsByDept, depId)) studentCountsByDept[depId] += 1;
    }

    const mappedDepartments = deptIds.map((dId) => {
      const d = deptById[dId];
      const facultyName = d?.faculty_id ? (facById[d.faculty_id]?.name ?? '') : (d?.faculty ?? '');
      return {
        ...d,
        faculty: facultyName,
        courses: courseCountsByDept[dId] ?? 0,
        lecturers: lecturerCountsByDept[dId] ?? 0,
        students: studentCountsByDept[dId] ?? 0
      };
    });

    if (!mounted) return;
    setDepartments(mappedDepartments);

    // --- FACULTIES: compute head, students count, lecturers count, budget --- //
    const tryParseBudget = (f: any) => {
      const keys = ['budget', 'allocated_budget', 'annual_budget', 'budget_amount', 'budget_total', 'funding'];
      for (const k of keys) {
        if (f?.[k] !== undefined && f?.[k] !== null && f?.[k] !== '') {
          const val = f[k];
          if (typeof val === 'number') return val;
          if (typeof val === 'string') {
            const cleaned = val.replace(/[^0-9.-]/g, '');
            const n = Number(cleaned);
            if (!Number.isNaN(n)) return n;
          }
        }
      }
      return null;
    };

    // Build map: facultyId -> Set(lecturerIds)
    const lecturerIdsByFacultyId: Record<string, Set<string>> = {};
    for (const fid of Object.keys(facById)) lecturerIdsByFacultyId[fid] = new Set<string>();

    // 1) from lecturer_faculties rows (explicit mapping)
    for (const [lecId, fIds] of Object.entries(lecturerFacMapByLecturerId)) {
      for (const fid of fIds) {
        if (!fid) continue;
        if (!lecturerIdsByFacultyId[fid]) lecturerIdsByFacultyId[fid] = new Set<string>();
        lecturerIdsByFacultyId[fid].add(lecId);
      }
    }

    // 2) from lecturerProgramsMap -> program -> faculty_id
    for (const [lecId, progSet] of Object.entries(lecturerProgramsMap)) {
      for (const pid of Array.from(progSet)) {
        const p = progById[pid];
        if (!p) continue;
        if (p.faculty_id && facById[p.faculty_id]) {
          if (!lecturerIdsByFacultyId[p.faculty_id]) lecturerIdsByFacultyId[p.faculty_id] = new Set<string>();
          lecturerIdsByFacultyId[p.faculty_id].add(lecId);
        } else if (p.faculty && typeof p.faculty === 'string') {
          const matchId = facIdByName[p.faculty.toLowerCase()];
          if (matchId) {
            if (!lecturerIdsByFacultyId[matchId]) lecturerIdsByFacultyId[matchId] = new Set<string>();
            lecturerIdsByFacultyId[matchId].add(lecId);
          }
        }
      }
    }

    // 3) from lecturer rows themselves (faculty_id or faculty string)
    for (const lr of lecturersRaw) {
      if (!lr || !lr.id) continue;
      const lecId = lr.id;
      if (lr.faculty_id && facById[lr.faculty_id]) {
        if (!lecturerIdsByFacultyId[lr.faculty_id]) lecturerIdsByFacultyId[lr.faculty_id] = new Set<string>();
        lecturerIdsByFacultyId[lr.faculty_id].add(lecId);
      } else if (lr.faculty && typeof lr.faculty === 'string') {
        const matchId = facIdByName[lr.faculty.toLowerCase()];
        if (matchId) {
          if (!lecturerIdsByFacultyId[matchId]) lecturerIdsByFacultyId[matchId] = new Set<string>();
          lecturerIdsByFacultyId[matchId].add(lecId);
        }
      }
    }

    // STUDENTS by faculty:
    const studentCountsByFacultyId: Record<string, number> = {};
    for (const fid of Object.keys(facById)) studentCountsByFacultyId[fid] = 0;

    for (const s of studentsRaw) {
      if (s?.faculty_id && facById[s.faculty_id]) {
        studentCountsByFacultyId[s.faculty_id] = (studentCountsByFacultyId[s.faculty_id] || 0) + 1;
        continue;
      }
      const pid = s?.program_id;
      if (!pid) {
        if (s?.faculty && typeof s.faculty === 'string') {
          const matchFid = facIdByName[s.faculty.toLowerCase()];
          if (matchFid) {
            studentCountsByFacultyId[matchFid] = (studentCountsByFacultyId[matchFid] || 0) + 1;
            continue;
          }
        }
        continue;
      }
      const p = progById[pid];
      if (!p) continue;
      if (p.faculty_id && facById[p.faculty_id]) {
        studentCountsByFacultyId[p.faculty_id] = (studentCountsByFacultyId[p.faculty_id] || 0) + 1;
      } else if (p.faculty && typeof p.faculty === 'string') {
        const matchFid = facIdByName[p.faculty.toLowerCase()];
        if (matchFid) studentCountsByFacultyId[matchFid] = (studentCountsByFacultyId[matchFid] || 0) + 1;
      }
    }

    // HEAD resolution and final mapped faculties
    const mappedFaculties = Object.keys(facById).map((fid) => {
      const f = facById[fid];

      const rawBudget = tryParseBudget(f);
      const budgetDisplay = rawBudget === null ? '-' : `$${Number(rawBudget).toLocaleString()}`;

      // head resolution
let headDisplay = '-';
if (f?.head_name && typeof f.head_name === 'string' && f.head_name.trim()) headDisplay = f.head_name;
else if (f?.head && typeof f.head === 'string' && f.head.trim()) headDisplay = f.head;
else if (f?.head_id) {
  const headLec = mappedLecturers.find((ml: any) => ml.id === f.head_id);
  if (headLec && headLec.fullName) headDisplay = headLec.fullName;
  else {
    const prof = profilesById[f.head_id];
    if (prof) {
      const constructed = `${prof.first_name ?? ''} ${prof.last_name ?? ''}`.trim();
      const resolvedName = prof.full_name ?? constructed;
      headDisplay = resolvedName || headDisplay;
    }
  }
} else if (f?.head_profile_id) {
  const prof = profilesById[f.head_profile_id];
  if (prof) {
    const constructed = `${prof.first_name ?? ''} ${prof.last_name ?? ''}`.trim();
    const resolvedName = prof.full_name ?? constructed;
    headDisplay = resolvedName || headDisplay;
  }
} else if (f?.head_user_id) {
  const profileMatch = Object.values(profilesById).find((p: any) => p?.user_id === f.head_user_id);
  if (profileMatch) {
    const constructed = `${profileMatch.first_name ?? ''} ${profileMatch.last_name ?? ''}`.trim();
    const resolvedName = profileMatch.full_name ?? constructed;
    headDisplay = resolvedName || headDisplay;
  } else if (usersById[f.head_user_id]) {
    headDisplay = usersById[f.head_user_id].email ?? headDisplay;
  }
} else if (f?.head_lecturer_number) {
  const found = mappedLecturers.find((ml: any) => ml.lecturerNumber === f.head_lecturer_number);
  if (found && found.fullName) headDisplay = found.fullName;
}


      const studentsCount = studentCountsByFacultyId[fid] ?? 0;
      const lecturersCount = (lecturerIdsByFacultyId[fid] ?? new Set<string>()).size;

      return {
        ...f,
        id: fid,
        name: f.name ?? f.title ?? '',
        code: f.code ?? '',
        headDisplay,
        students: studentsCount,
        lecturers: lecturersCount,
        budget: rawBudget,
        budgetDisplay
      };
    });

    if (!mounted) return;
    setFaculties(mappedFaculties);

    // diagnostics: unresolved lecturers
    const unresolved = mappedLecturers.filter((ml: any) => !ml.faculty);
    if (unresolved.length > 0) {
      console.info('Lecturers with no resolved faculty (count):', unresolved.length);
      console.debug('Sample unresolved lecturers:', unresolved.slice(0, 6));
      console.debug('Lecturer -> programId map sample:', Object.entries(lecturerProgramsMap).slice(0, 6));
      console.debug('lecturerFacultyById sample:', Object.entries(lecturerFacultyById).slice(0,6));
    } else {
      console.info('All lecturers resolved to a faculty where possible via lecturer_faculties or courses -> programs -> faculties');
    }
  } catch (err) {
    console.error('Admin fetch error', err);
    if (mounted) {
      setStudents([]);
      setLecturers([]);
      setCourses([]);
      setDepartments([]);
      setPrograms([]);
      setFaculties([]);
    }
  }

};



  fetchAdminData();

  return () => {
    mounted = false;
  };
}, []);



  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      if (parsedUser.role === 'admin') {
        setUser(parsedUser);
      } else {
        navigate('/login');
      }
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/');
  };

  useEffect(() => {
  let mounted = true;

  const fetchEvents = async () => {
    try {
      // select joined fields where helpful; adjust if your DB schema differs
      const { data, error } = await supabase
        .from('events')
        .select(`
          id,
          title,
          description,
          event_date,
          start_time,
          end_time,
          venue,
          max_attendees,
          current_attendees,
          status,
          event_types ( name ),
          courses ( id, code, name ),
          lecturers ( id, profiles ( first_name, last_name ) )
        `)
        .order('event_date', { ascending: true });

      if (error) {
        console.error('fetchEvents error', error);
        return;
      }

      if (!mounted || !Array.isArray(data)) return;

      const mapped: ScheduleEvent[] = data.map((r: any) => {
        // get event type name (fallback to 'event')
        const type = r.event_types?.name ?? 'event';

        // build course string if course object present
        const courseStr = r.courses ? `${r.courses.code} - ${r.courses.name}` : undefined;

        // build lecturer full name if available via profiles join
        const lecturerName = r.lecturers?.profiles
          ? `${r.lecturers.profiles.first_name} ${r.lecturers.profiles.last_name}`
          : undefined;

        // format times: assuming r.start_time is "HH:MM:SS" from DB, keep HH:MM
        const formatTime = (t: string | null | undefined) =>
          t ? t.toString().slice(0,5) : '';

        return {
          id: String(r.id),
          type: type as ScheduleEvent['type'],
          title: r.title || '',
          course: courseStr,
          lecturer: lecturerName,
          venue: r.venue || '',
          startTime: formatTime(r.start_time),
          endTime: formatTime(r.end_time),
          date: r.event_date ? new Date(r.event_date).toISOString().split('T')[0] : '',
          attendees: typeof r.current_attendees === 'number' ? r.current_attendees : undefined,
          maxAttendees: typeof r.max_attendees === 'number' ? r.max_attendees : undefined,
          status: (r.status || 'scheduled') as ScheduleEvent['status'],
          description: r.description || undefined
        };
      });

      setScheduleEvents(mapped);
    } catch (err) {
      console.error('fetchEvents failed', err);
    }
  };

  fetchEvents();

  return () => { mounted = false; };
}, []);

// ---------- compute analytics effect ---------- //
useEffect(() => {
  // compute when source data or filters change
  const computeAnalytics = async () => {
    setAnalyticsLoading(true);

    try {
      // defensive local aliases (these are set by your fetchAdminData earlier)
      const coursesList = Array.isArray(courses) ? courses : [];
      const studentsList = Array.isArray(students) ? students : [];
      const programsList = Array.isArray(programs) ? programs : [];
      const facultiesList = Array.isArray(faculties) ? faculties : [];
      const departmentsList = Array.isArray(departments) ? departments : [];

      // --- COURSE ANALYTICS ---
      const courseAnalytics = coursesList.map((c: any) => {
        const enrolled =
          safeNum(coalesce(c.enrolled, c.enrolled_students, c.enrolledCount, c.enrolled_count)) || 0;

        const passRateCandidate = coalesce(c.pass_rate, c.passRate);
        const passRate =
          safeNum(passRateCandidate) ||
          (safeNum(c.passed) && enrolled ? Math.round((safeNum(c.passed) / enrolled) * 100 * 10) / 10 : 0) ||
          0;

        const avgScore = safeNum(coalesce(c.avg_score, c.average_score, c.avgScore)) || 0;

        const dropoutRate =
          safeNum(coalesce(c.dropout_rate, c.dropoutRate)) ||
          (safeNum(c.dropped) && enrolled ? Math.round((safeNum(c.dropped) / enrolled) * 100 * 10) / 10 : 0) ||
          0;

        return {
          name: coalesce(c.name, c.courseName, c.course_name, 'Unknown') as string,
          code: coalesce(c.code, c.courseCode, c.course_code, '') as string,
          enrolled,
          passRate: Math.round(passRate * 10) / 10,
          avgScore: Math.round(avgScore * 10) / 10,
          dropoutRate: Math.round(dropoutRate * 10) / 10
        };
      });

      // --- LOOKUPS ---
      const progById: Record<string, any> = {};
      programsList.forEach((p: any) => { if (p?.id) progById[p.id] = p; });

      const facById: Record<string, any> = {};
      facultiesList.forEach((f: any) => { if (f?.id) facById[f.id] = f; });

      const deptById: Record<string, any> = {};
      departmentsList.forEach((d: any) => { if (d?.id) deptById[d.id] = d; });

      // --- DEPARTMENT / FACULTY AGGREGATION ---
      type DeptStats = { students: number; gpaSum: number; gpaCount: number; coursePassRates: number[]; completionCount: number; totalForCompletion: number };
      const deptStats: Record<string, DeptStats> = {};

      const resolveStudentKey = (s: any) => {
        if (!s) return 'dept:unknown';
        if (s.department_id && deptById[s.department_id]) return `dept:${s.department_id}`;
        if (s.program_id && progById[s.program_id]) {
          const p = progById[s.program_id];
          if (p.department_id && deptById[p.department_id]) return `dept:${p.department_id}`;
          if (p.faculty_id && facById[p.faculty_id]) return `fac:${p.faculty_id}`;
          if (p.faculty && typeof p.faculty === 'string') return `fac_name:${p.faculty}`;
        }
        if (s.faculty_id && facById[s.faculty_id]) return `fac:${s.faculty_id}`;
        if (s.faculty && typeof s.faculty === 'string') return `fac_name:${s.faculty}`;
        return 'dept:unknown';
      };

      studentsList.forEach((s: any) => {
        const key = resolveStudentKey(s);
        if (!deptStats[key]) deptStats[key] = { students: 0, gpaSum: 0, gpaCount: 0, coursePassRates: [], completionCount: 0, totalForCompletion: 0 };
        deptStats[key].students += 1;
        const gpa = safeNum(coalesce(s.gpa, s.avg_gpa, s.average_gpa));
        if (gpa > 0) { deptStats[key].gpaSum += gpa; deptStats[key].gpaCount += 1; }
        if (s.status === 'graduated' || s.status === 'Graduated') deptStats[key].completionCount += 1;
        deptStats[key].totalForCompletion += 1;
      });

      coursesList.forEach((c: any) => {
        const passRate = safeNum(coalesce(c.pass_rate, c.passRate)) || 0;
        let key: string | null = null;
        if (c.department_id && deptById[c.department_id]) key = `dept:${c.department_id}`;
        else if (c.program_id && progById[c.program_id]) {
          const p = progById[c.program_id];
          if (p.department_id && deptById[p.department_id]) key = `dept:${p.department_id}`;
          else if (p.faculty_id && facById[p.faculty_id]) key = `fac:${p.faculty_id}`;
        } else if (c.faculty_id && facById[c.faculty_id]) key = `fac:${c.faculty_id}`;
        else if (c.faculty && typeof c.faculty === 'string') key = `fac_name:${c.faculty}`;

        if (!key) key = 'dept:unknown';
        if (!deptStats[key]) deptStats[key] = { students: 0, gpaSum: 0, gpaCount: 0, coursePassRates: [], completionCount: 0, totalForCompletion: 0 };
        if (passRate > 0) deptStats[key].coursePassRates.push(passRate);
      });

      const departmentPerformance = Object.entries(deptStats).map(([key, stats]) => {
        let name = key;
        if (key.startsWith('dept:')) {
          const id = key.replace('dept:', '');
          name = deptById[id]?.name ?? deptById[id]?.title ?? `Dept ${id}`;
        } else if (key.startsWith('fac:')) {
          const id = key.replace('fac:', '');
          name = facById[id]?.name ?? `Faculty ${id}`;
        } else if (key.startsWith('fac_name:')) {
          name = key.replace('fac_name:', '');
        } else if (key === 'dept:unknown') {
          name = 'Unassigned';
        }

        const passRate = stats.coursePassRates.length > 0 ? Math.round((stats.coursePassRates.reduce((a,b)=>a+b,0)/stats.coursePassRates.length) * 10) / 10 : 0;
        const avgGPA = stats.gpaCount > 0 ? Math.round((stats.gpaSum / stats.gpaCount) * 10) / 10 : 0;
        const completion = stats.totalForCompletion > 0 ? Math.round((stats.completionCount / stats.totalForCompletion) * 100 * 10) / 10 : 0;
        const trend = decideTrend(passRate);

        // replace the `as AnalyticsData['departmentPerformance'][0]` cast
return { name, students: stats.students, passRate, avgGPA, completion, trend } as DepartmentPerformanceItem;
      });

      // apply analyticsDepartment filter if set
      let filteredDepartmentPerformance = departmentPerformance;
      if (analyticsDepartment && analyticsDepartment !== 'all') {
        const needle = analyticsDepartment.toLowerCase();
        filteredDepartmentPerformance = departmentPerformance.filter(d => (d.name ?? '').toLowerCase().includes(needle));
      }

      // --- ENROLLMENT TRENDS ---
      const months = Number(analyticsTimeRange) || 12;
      const now = new Date();
      const buckets: { start: Date; end: Date; label: string; enrollments: number; graduations: number }[] = [];
      for (let m = months - 1; m >= 0; m -= 3) {
        const start = new Date(now.getFullYear(), now.getMonth() - m, 1);
        const end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
        const label = `${start.toLocaleString(undefined, { month: 'short' })}-${end.toLocaleString(undefined, { month: 'short' })} ${start.getFullYear()}`;
        buckets.push({ start, end, label, enrollments: 0, graduations: 0 });
      }

      studentsList.forEach((s: any) => {
        const ed = coalesce(s.enrollment_date, s.created_at, s.registered_at, s.registered_on);
        if (!ed) return;
        const d = new Date(ed);
        for (const b of buckets) {
          if (d >= b.start && d <= b.end) {
            b.enrollments += 1;
            if (s.status === 'graduated' || s.status === 'Graduated') b.graduations += 1;
            break;
          }
        }
      });

      const enrollmentTrends = buckets.map(b => ({ period: b.label, enrollments: b.enrollments, graduations: b.graduations }));

      // --- RETENTION ANALYSIS ---
      const countsByYear: Record<string, number> = {};
      studentsList.forEach((s: any) => {
        const yrRaw = coalesce(s.year_of_study, s.yearOfStudy, s.year);
        const yr = (yrRaw ?? 'Unknown').toString();
        countsByYear[yr] = (countsByYear[yr] || 0) + 1;
      });
      const firstYearCount = countsByYear['1'] || countsByYear['First'] || Object.values(countsByYear)[0] || 0;
      const retentionAnalysis = Object.keys(countsByYear).sort().map(yr => {
        const count = countsByYear[yr];
        const rate = firstYearCount > 0 ? Math.round((count / firstYearCount) * 100 * 10) / 10 : 0;
        return { year: yr, rate, students: count };
      });

      // --- EXAM ELIGIBILITY ---
      const eligibilityByDept: Record<string, { eligible: number; total: number }> = {};
      studentsList.forEach((s: any) => {
        const key = resolveStudentKey(s);
        if (!eligibilityByDept[key]) eligibilityByDept[key] = { eligible: 0, total: 0 };
        const eligibleFlag = s.eligible === true || s.exam_eligible === true || s.eligible_for_exams === true;
        if (eligibleFlag) eligibilityByDept[key].eligible += 1;
        eligibilityByDept[key].total += 1;
      });

      const examEligibility = Object.entries(eligibilityByDept).map(([key, val]) => {
        let department = key;
        if (key.startsWith('dept:')) department = deptById[key.replace('dept:', '')]?.name ?? 'Unassigned';
        else if (key.startsWith('fac:')) department = facById[key.replace('fac:', '')]?.name ?? 'Unassigned';
        else if (key.startsWith('fac_name:')) department = key.replace('fac_name:', '');
        else if (key === 'dept:unknown') department = 'Unassigned';
        const percentage = val.total > 0 ? Math.round((val.eligible / val.total) * 100 * 10) / 10 : 0;
        return { department, eligible: val.eligible, total: val.total, percentage };
      });

      // --- KPIs ---
      const allDeptPassRates = filteredDepartmentPerformance.map(d => d.passRate).filter(v => v > 0);
      const passKpi = allDeptPassRates.length > 0 ? Math.round((allDeptPassRates.reduce((a,b)=>a+b,0)/allDeptPassRates.length) * 10) / 10 : 0;
      const retentionValue = retentionAnalysis.length > 0 ? Math.round(retentionAnalysis[0].rate * 10) / 10 : 0;
      const retentionChange = retentionAnalysis.length > 1 ? Math.round((retentionAnalysis[0].rate - retentionAnalysis[1].rate) * 10) / 10 : 0;
      const retentionTrend = retentionChange > 0 ? 'up' : retentionChange < 0 ? 'down' : 'flat';
      const eligPercentages = examEligibility.map(x => x.percentage).filter(v => v > 0);
      const eligibilityKpi = eligPercentages.length > 0 ? Math.round((eligPercentages.reduce((a,b)=>a+b,0)/eligPercentages.length) * 10) / 10 : 0;
      const employmentRates: number[] = [];
      studentsList.forEach((s: any) => {
        if (typeof s.employed_rate === 'number') employmentRates.push(s.employed_rate);
        if (s.employed === true) employmentRates.push(100);
      });
      const employmentKpi = employmentRates.length > 0 ? Math.round((employmentRates.reduce((a,b)=>a+b,0)/employmentRates.length) * 10) / 10 : 0;

      // Fetch real department and course performance from database
      const deptPerformanceData = await getDepartmentPerformance();
      const coursePerformanceData = await getCoursePerformance();

      // Convert database results to analytics format
      const dbDepartmentPerformance = deptPerformanceData.map(d => ({
        name: d.departmentName,
        students: d.totalStudents,
        passRate: d.passRate,
        avgGPA: d.averageGpa,
        completion: d.passRate,
        trend: decideTrend(d.passRate)
      })) as DepartmentPerformanceItem[];

      // Merge with existing logic or prefer database data
      const finalDepartmentPerformance = dbDepartmentPerformance.length > 0
        ? dbDepartmentPerformance
        : filteredDepartmentPerformance;

      // Update course analytics with real data
      const dbCourseAnalytics = coursePerformanceData.map(c => ({
        name: c.name,
        code: c.code,
        department: c.departmentName,
        faculty: c.facultyName,
        enrollments: c.enrolledStudents,
        pass_rate: c.passRate,
        passRate: c.passRate,
        average: c.averagePercentage,
        avgGPA: c.averageGpa,
        trend: decideTrend(c.passRate)
      }));

      const finalCourseAnalytics = dbCourseAnalytics.length > 0
        ? dbCourseAnalytics
        : courseAnalytics;

      // --- assemble analytics object (typed) ---
      const analyticsObj: AnalyticsData = {
        kpis: {
          passRate: { value: passKpi, trend: decideTrend(passKpi), change: 0 },
          retention: { value: retentionValue, trend: retentionTrend as Trend, change: retentionChange },
          eligibility: { value: eligibilityKpi, trend: decideTrend(eligibilityKpi), change: 0 },
          employment: { value: employmentKpi, trend: decideTrend(employmentKpi, 75, 60), change: 0 }
        },
        enrollmentTrends,
        departmentPerformance: finalDepartmentPerformance,
        courseAnalytics: finalCourseAnalytics,
        retentionAnalysis,
        examEligibility
      };

      setAnalyticsData(analyticsObj);
    } catch (err) {
      console.error('computeAnalytics error', err);
      setAnalyticsData(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  computeAnalytics();
  // dependencies: recompute when your data sources or filters change
}, [courses, students, programs, faculties, departments, analyticsTimeRange, analyticsDepartment]);  




// --- Fetcher (add a single effect) ---
useEffect(() => {
  let mounted = true;
  async function loadDashboardCounts() {
    try {
      // 1) Get default semester from institution_settings (assume single row)
      const { data: settings, error: settingsErr } = await supabase
        .from('institution_settings')
        .select('default_semester')
        .single();

      if (mounted) {
        setDefaultSemester(settings?.default_semester ?? null);
      }

      // 2) Ongoing assessments count
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const { count: ongoingCount } = await supabase
        .from('assessments')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'completed');

      let ongoing = ongoingCount ?? null;
      if (ongoing === null) {
        const { data: rows, count } = await supabase
          .from('assessments')
          .select('id', { count: 'exact' })
          .neq('status', 'completed');
        ongoing = count ?? (rows ? rows.length : null);
      }

      // 3) Upcoming exams
      const { data: examType } = await supabase
        .from('assessment_types')
        .select('id, name')
        .eq('name', 'Exam')
        .limit(1)
        .maybeSingle();

      let upcomingExams = null;
      if (examType?.id) {
        const { count: upcomingCount } = await supabase
          .from('assessments')
          .select('id', { count: 'exact', head: true })
          .eq('assessment_type_id', examType.id)
          .gte('due_date', today)
          .neq('status', 'completed');

        upcomingExams = upcomingCount ?? null;
        if (upcomingExams === null) {
          const { count } = await supabase
            .from('assessments')
            .select('id', { count: 'exact' })
            .eq('assessment_type_id', examType.id)
            .gte('due_date', today)
            .neq('status', 'completed');
          upcomingExams = count ?? 0;
        }
      } else {
        const { count: fallbackCount } = await supabase
          .from('assessments')
          .select('id', { count: 'exact' })
          .ilike('name', '%exam%')
          .gte('due_date', today)
          .neq('status', 'completed');

        upcomingExams = fallbackCount ?? 0;
      }

      // 4) Fetch real performance metrics
      const metrics = await getPerformanceMetrics();

      // Apply results
      if (mounted) {
        setOngoingAssessmentsCount(ongoing);
        setUpcomingExamsCount(upcomingExams);
        setEnrollmentVal(metrics.totalStudents);
        setPassKpiVal(metrics.overallPassRate);
        setPassKpiTrend(metrics.overallPassRate >= 75 ? 'up' : metrics.overallPassRate >= 60 ? 'flat' : 'down');
        setDropoutVal(metrics.dropoutRate);
      }
    } catch (err) {
      console.error('Failed to load analytics counts', err);
      if (mounted) {
        setDefaultSemester(null);
        setOngoingAssessmentsCount(null);
        setUpcomingExamsCount(0);
        setEnrollmentVal(null);
        setPassKpiVal(0);
        setDropoutVal(0);
      }
    }
  }

  loadDashboardCounts();
  return () => { mounted = false; };
}, []); // run once on mount



  // Faculty handlers
const handleSaveFaculty = (facultyData: Faculty) => {
  if (editFaculty) {
    setFaculties(faculties.map(f => f.id === editFaculty.id ? { ...facultyData, id: editFaculty.id } : f));
    showMessage(`Faculty "${facultyData.name || facultyData.code || editFaculty.id}" updated successfully.`, 'success', 'toast');
  } else {
    setFaculties([...faculties, { ...facultyData, id: Date.now() }]);
    showMessage(`Faculty "${facultyData.name || facultyData.code || 'New Faculty'}" created successfully.`, 'success', 'banner');
  }
  setIsFacultyModalOpen(false);
  setEditFaculty(undefined);
};

const handleView = (type: any, data: any) => {
  setViewModal({ isOpen: true, data, type });
};

const modalType = editingEvent?.type ?? formData.type;

// Edit faculty modal open
const handleEditFaculty = (faculty: Faculty) => {
  setEditFaculty(faculty);
  setIsFacultyModalOpen(true);
};

/* ---------------------------
     Delete modal state & generic handlers
     --------------------------- */
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteEntityType, setDeleteEntityType] = useState<
    'faculty' | 'lecturer' | 'department' | 'student' | 'course' | 'program' | null
  >(null);
  const [entityToDelete, setEntityToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  /* Generic opener used by all entity delete buttons */
  const handleDeleteEntity = (
    type: 'faculty' | 'lecturer' | 'department' | 'student' | 'course' | 'program',
    entity: any
  ) => {
    setDeleteEntityType(type);
    setEntityToDelete(entity);
    setShowDeleteModal(true);
  };

  /* Confirm delete for whichever entity type is selected */
  const handleConfirmDeleteEntity = async () => {
  if (!deleteEntityType || !entityToDelete) return;
  setIsDeleting(true);

  try {
    switch (deleteEntityType) {
      case 'student': {
        // 1) load the student row (to get profile_id)
        const { data: studentRow, error: studentFetchErr } = await supabase
          .from('students')
          .select('id, profile_id, student_number')
          .eq('id', entityToDelete.id)
          .maybeSingle();

        if (studentFetchErr) throw studentFetchErr;
        if (!studentRow) {
          showMessage('Student not found in database.', 'error', 'toast');
          break;
        }

        // 2) Delete students row first
        const { error: delStudentErr } = await supabase
          .from('students')
          .delete()
          .eq('id', studentRow.id);

        if (delStudentErr) throw delStudentErr;

        // 3) Attempt to fetch & delete profile (if exists)
        const { data: profileRow, error: profileFetchErr } = await supabase
          .from('profiles')
          .select('id, user_id')
          .eq('id', studentRow.profile_id)
          .maybeSingle();

        if (profileFetchErr) {
          // non-fatal: profile lookup failed, but student already deleted
          console.warn('Profile fetch failed after deleting student:', profileFetchErr);
        }

        if (profileRow) {
          const { error: delProfileErr } = await supabase
            .from('profiles')
            .delete()
            .eq('id', profileRow.id);

          if (delProfileErr) {
            // non-fatal but surface warning
            console.warn('Failed to delete profile:', delProfileErr);
          } else {
            // 4) If profile had a user, delete user (this will cascade where appropriate)
            if (profileRow.user_id) {
              const { error: delUserErr } = await supabase
                .from('users')
                .delete()
                .eq('id', profileRow.user_id);

              if (delUserErr) {
                console.warn('Failed to delete user:', delUserErr);
                // not fatal here; you might want to surface to admin
              }
            }
          }
        }

        // 5) Update UI state
        setStudents(prev => prev.filter((s: Student) => s.id !== entityToDelete.id));
        showMessage(
          `Student "${entityToDelete.firstName} ${entityToDelete.lastName}" deleted.`,
          'info',
          'toast'
        );
        break;
      }

      // You can replace other entity branches with real DB deletes similarly.
      case 'faculty': {
  const { error } = await supabase
    .from('faculties')
    .delete()
    .eq('id', entityToDelete.id);

  if (error) throw error;

  setFaculties(prev => prev.filter((f: Faculty) => f.id !== entityToDelete.id));
  showMessage(
    `Faculty "${entityToDelete.name || entityToDelete.code}" deleted.`,
    'info',
    'toast'
  );
  break;
}

      case 'lecturer': {
  // 1) fetch lecturer row to get profile_id
  const { data: lecturerRow, error: lecFetchErr } = await supabase
    .from('lecturers')
    .select('id, profile_id')
    .eq('id', entityToDelete.id)
    .maybeSingle();

  if (lecFetchErr) throw lecFetchErr;
  if (!lecturerRow) {
    showMessage('Lecturer not found in database.', 'error', 'toast');
    break;
  }

  // 2) fetch profile to get user_id
  const { data: profileRow, error: profileErr } = await supabase
    .from('profiles')
    .select('id, user_id')
    .eq('id', lecturerRow.profile_id)
    .maybeSingle();

  if (profileErr) throw profileErr;

  if (profileRow?.user_id) {
    // 3) delete the user → cascades to profile → cascades to lecturer
    const { error: userDelErr } = await supabase
      .from('users')
      .delete()
      .eq('id', profileRow.user_id);

    if (userDelErr) throw userDelErr;
  } else {
    // fallback: delete lecturer directly if no user_id
    const { error: lecDelErr } = await supabase
      .from('lecturers')
      .delete()
      .eq('id', entityToDelete.id);

    if (lecDelErr) throw lecDelErr;
  }

  // 4) update UI state
  setLecturers(prev => prev.filter((l: Lecturer) => l.id !== entityToDelete.id));
  showMessage(
    `Lecturer "${entityToDelete.firstName} ${entityToDelete.lastName}" deleted.`,
    'info',
    'toast'
  );
  break;
}


      case 'department': {
  const { error } = await supabase
    .from('departments')
    .delete()
    .eq('id', entityToDelete.id);

  if (error) throw error;

  setDepartments(prev => prev.filter((d: Department) => d.id !== entityToDelete.id));
  showMessage(`Department "${entityToDelete.name}" deleted.`, 'info', 'toast');
  break;
}

case 'course': {
  const { error } = await supabase
    .from('courses')
    .delete()
    .eq('id', entityToDelete.id);

  if (error) throw error;

  setCourses(prev => prev.filter((c: Course) => c.id !== entityToDelete.id));
  showMessage(
    `Course "${entityToDelete.name || entityToDelete.courseCode}" deleted.`,
    'info',
    'toast'
  );
  break;
}

case 'program': {
  const { error } = await supabase
    .from('programs')
    .delete()
    .eq('id', entityToDelete.id);

  if (error) throw error;

  setPrograms(prev => prev.filter((p: Program) => p.id !== entityToDelete.id));
  showMessage(`Program "${entityToDelete.name}" deleted.`, 'info', 'toast');
  break;
}
    }
  } catch (err: any) {
    console.error('Delete error', err);
    showMessage(`Failed to delete item: ${err?.message ?? String(err)}`, 'error', 'toast');
  } finally {
    setIsDeleting(false);
    setShowDeleteModal(false);
    setEntityToDelete(null);
    setDeleteEntityType(null);
  }
};


  /* Cancel deletion */
  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setEntityToDelete(null);
    setDeleteEntityType(null);
    setIsDeleting(false);
  };

// Lecturer handlers
const handleSaveLecturer = (lecturerData: Lecturer) => {
  if (editLecturer) {
    setLecturers(lecturers.map(l => l.id === editLecturer.id ? { ...lecturerData, id: editLecturer.id } : l));
    showMessage(`Lecturer ${lecturerData.firstName} ${lecturerData.lastName} ${lecturerData.lecturerNumber} updated successfully.`, 'success', 'toast');
  } else {
    setLecturers([...lecturers, { ...lecturerData, id: Date.now() }]);
    showMessage(`Lecturer ${lecturerData.firstName} ${lecturerData.lastName} ${lecturerData.lecturerNumber} registered successfully.`, 'success', 'banner');
  }
  setIsLecturerModalOpen(false);
  setEditLecturer(undefined);
};

const handleEditLecturer = (lecturer: Lecturer) => {
  setEditLecturer(lecturer);
  setIsLecturerModalOpen(true);
};

// Department handlers
const handleSaveDepartment = (departmentData: Department) => {
  if (editDepartment) {
    setDepartments(departments.map(d => d.id === editDepartment.id ? { ...departmentData, id: editDepartment.id } : d));
    showMessage(`Department "${departmentData.name || departmentData.code || editDepartment.id}" updated successfully.`, 'success', 'toast');
  } else {
    setDepartments([...departments, { ...departmentData, id: Date.now() }]);
    showMessage(`Department "${departmentData.name || 'New Department'}" created successfully.`, 'success', 'banner');
  }
  setIsDepartmentModalOpen(false);
  setEditDepartment(undefined);
};

const handleEditDepartment = (department: Department) => {
  setEditDepartment(department);
  setIsDepartmentModalOpen(true);
};



// Student handlers
const handleSaveStudent = (studentData: Student) => {
  if (editStudent) {
    setStudents(students.map(s => s.id === editStudent.id ? { ...studentData, id: editStudent.id } : s));
    showMessage(`Student ${studentData.firstName} ${studentData.lastName} ${studentData.studentNumber} updated successfully.`, 'success', 'toast');
  } else {
    setStudents([...students, { ...studentData, id: Date.now() }]);
    showMessage(`Student ${studentData.firstName} ${studentData.lastName} ${studentData.studentNumber} registered successfully.`, 'success', 'banner');
  }
  setIsStudentModalOpen(false);
  setEditStudent(undefined);
};

const handleEditStudent = (student: Student) => {
  setEditStudent(student);
  setIsStudentModalOpen(true);
};

// Course handlers
const handleSaveCourse = (courseData: Course) => {
  if (editCourse) {
    setCourses(courses.map(c => c.id === editCourse.id ? { ...courseData, id: editCourse.id } : c));
    showMessage(`Course ${courseData.name} ${courseData.code} updated successfully.`, 'success', 'toast');
  } else {
    setCourses([...courses, { ...courseData, id: Date.now() }]);
    showMessage(`Course ${courseData.name} ${courseData.code} created successfully.`, 'success', 'banner');
  }
  setIsCourseModalOpen(false);
  setEditCourse(undefined);
};

const handleEditCourse = (course: Course) => {
  setEditCourse(course);
  setIsCourseModalOpen(true);
};

// Program handlers
const handleSaveProgram = (programData: Program) => {
  if (editProgram) {
    setPrograms(programs.map(p => p.id === editProgram.id ? { ...programData, id: editProgram.id } : p));
    showMessage(`Program "${programData.name || programData.code || editProgram.id}" updated successfully.`, 'success', 'toast');
  } else {
    setPrograms([...programs, { ...programData, id: Date.now() }]);
    showMessage(`Program "${programData.name || 'New Program'}" created successfully.`, 'success', 'banner');
  }
  setIsProgramModalOpen(false);
  setEditProgram(undefined);
};

const handleEditProgram = (program: Program) => {
  setEditProgram(program);
  setIsProgramModalOpen(true);
};


  if (!user) return null;

  
  

  const filteredFaculties = faculties.filter(faculty => {
  const matchesSearch =
    safeLower(faculty.name).includes(safeLower(searchTerm)) ||
    safeLower(faculty.code).includes(safeLower(searchTerm)) ||
    safeLower(faculty.head).includes(safeLower(searchTerm));
  const matchesStatus = !filterStatus || faculty.status === filterStatus;
  return matchesSearch && matchesStatus;
});


  const filteredCourses = courses.filter(course => {
  const matchesSearch =
    safeLower(course.name).includes(safeLower(searchTerm)) ||
    safeLower(course.code).includes(safeLower(searchTerm)) ||
    safeLower(course.lecturer).includes(safeLower(searchTerm));
  const matchesFaculty = !filterFaculty || course.faculty === filterFaculty;
  const matchesDepartment = !filterDepartment || course.department === filterDepartment;
  const matchesProgram = !filterProgram || course.program === filterProgram;
  const matchesSemester = !filterSemester || course.semester === filterSemester;
  const matchesStatus = !filterStatus || course.status === filterStatus;
  return matchesSearch && matchesFaculty && matchesDepartment && matchesProgram && matchesSemester && matchesStatus;
});

 

  // Use the state arrays for suggestions
  const filteredCourseSuggestions: Course[] = formData.course.trim().length > 0
    ? courses.filter(c => (`${c.code} ${c.name}`.toLowerCase()).includes(formData.course.toLowerCase()))
    : [];

  const filteredLecturerSuggestions: Lecturer[] = formData.lecturer.trim().length > 0
    ? lecturers.filter(l => (`${l.firstName} ${l.lastName}`.toLowerCase()).includes(formData.lecturer.toLowerCase()))
    : [];

  const filteredVenueSuggestions: string[] = formData.venue.trim().length > 0
    ? venues.filter(v => v.toLowerCase().includes(formData.venue.toLowerCase()))
    : [];

    // selection handlers accept full objects / string for venues
  const handleSelectCourse = (course: Course) => {
    setFormData(prev => ({ ...prev, course: `${course.code} - ${course.name}` }));
    setShowCourseSuggestions(false);
  };

  const handleSelectLecturer = (lecturer: Lecturer) => {
    setFormData(prev => ({ ...prev, lecturer: `${lecturer.firstName} ${lecturer.lastName}` }));
    setShowLecturerSuggestions(false);
  };

  const handleSelectVenue = (venue: string) => {
    setFormData(prev => ({ ...prev, venue }));
    setShowVenueSuggestions(false);
  };

  // derived option lists (place near your component body, after programs state)
const facultyOptions = Array.from(new Set(programs.map(p => p.faculty)));
const departmentOptions = filterFaculty
  ? Array.from(new Set(programs.filter(p => p.faculty === filterFaculty).map(p => p.department)))
  : Array.from(new Set(programs.map(p => p.department)));

const filteredPrograms = programs.filter(program => {
  const q = safeLower(searchTerm.trim());
  const matchesSearch =
    !q ||
    safeLower(program.name).includes(q) ||
    safeLower(program.code).includes(q) ||
    safeLower(program.coordinator).includes(q);
  const matchesStatus = !filterStatus || program.status === filterStatus;
  const matchesFaculty = !filterFaculty || program.faculty === filterFaculty;
  const matchesDepartment = !filterDepartment || program.department === filterDepartment;
  return matchesSearch && matchesStatus && matchesFaculty && matchesDepartment;
});

const filteredStudents = students.filter(student => {
  const fullName = safeLower(`${student.firstName} ${student.lastName}`);
  const matchesSearch =
    fullName.includes(safeLower(searchTerm)) ||
    safeLower(student.studentNumber).includes(safeLower(searchTerm)) ||
    safeLower(student.email).includes(safeLower(searchTerm));
  const matchesStatus = !filterStatus || student.status === filterStatus;
  const matchesFaculty = !filterFaculty || student.faculty === filterFaculty;
  const matchesDepartment = !filterDepartment || student.department === filterDepartment;
  const matchesProgram = !filterProgram || student.program === filterProgram;
  return matchesSearch && matchesStatus && matchesFaculty && matchesDepartment && matchesProgram;
});

const filteredLecturers = lecturers.filter(lecturer => {
  const fullName = safeLower(`${lecturer.firstName} ${lecturer.lastName}`);
  const matchesSearch =
    fullName.includes(safeLower(searchTerm)) ||
    safeLower(lecturer.lecturerNumber).includes(safeLower(searchTerm)) ||
    safeLower(lecturer.email).includes(safeLower(searchTerm));
  const matchesStatus = !filterStatus || lecturer.status === filterStatus;
  const matchesFaculty = !filterFaculty || lecturer.faculty === filterFaculty;
  const matchesDepartment = !filterDepartment || lecturer.department === filterDepartment;
  return matchesSearch && matchesStatus && matchesFaculty && matchesDepartment;
});

const filteredDepartments = departments.filter(department => {
  const matchesSearch =
    safeLower(department.name).includes(safeLower(searchTerm)) ||
    safeLower(department.code).includes(safeLower(searchTerm));
  const matchesStatus = !filterStatus || department.status === filterStatus;
  return matchesSearch && matchesStatus;
});

  // 1) Add this state near your other state declarations (inside AdminDashboard) const [analyticsFaculty, setAnalyticsFaculty] = useState<string>('all'); // 2) derive faculty options from your faculties state (place near states) // put this near your other state/useMemo declarations inside AdminDashboard const facultyOptions: string[] = React.useMemo(() => { // gather possible sources (adjust to your actual state names) const fromPrograms = Array.isArray(programs) ? programs.map(p => p.faculty) : []; const fromFaculties = Array.isArray(faculties) ? faculties.map(f => f.name) : []; // combine, remove falsy values, dedupe, keep stable order const combined = [...fromFaculties, ...fromPrograms].filter(Boolean) as string[]; return ['all', ...Array.from(new Set(combined))]; }, [programs, faculties]); // 3) Safe filtered analytics memo (place after analyticsTimeRange / analyticsFaculty) const filteredAnalytics = React.useMemo(() => { // defensive handling in case analyticsData is missing or shape differs const src: any = (analyticsData as any) || {}; const timeRange = parseInt(analyticsTimeRange || '12', 10) || 12; const facultyFilter = analyticsFaculty === 'all' ? null : analyticsFaculty; const result: any = { ...src }; // enrollmentTrends: take last N (if present) if (Array.isArray(src.enrollmentTrends)) { result.enrollmentTrends = src.enrollmentTrends.slice(-timeRange); } else { result.enrollmentTrends = []; } // helper to match faculty strings defensively const matchFaculty = (value?: string) => { if (!facultyFilter) return true; if (!value) return false; return value.toString().toLowerCase().includes(facultyFilter.toLowerCase()); }; // retentionAnalysis (if exists) if (Array.isArray(src.retentionAnalysis)) { result.retentionAnalysis = src.retentionAnalysis.filter((r: any) => { // prefer department/faculty fields if available, otherwise keep if no filter if (r.faculty) return matchFaculty(r.faculty); if (r.department) return matchFaculty(r.department); return !facultyFilter; }); } else { result.retentionAnalysis = []; } // departmentPerformance (filter by faculty if name exists in the record) if (Array.isArray(src.departmentPerformance)) { result.departmentPerformance = src.departmentPerformance.filter((d: any) => { if (!facultyFilter) return true; // some records may include a faculty / name / department field if (d.faculty) return matchFaculty(d.faculty); if (d.name) return matchFaculty(d.name); if (d.department) return matchFaculty(d.department); return false; }); } else { result.departmentPerformance = []; } // courseAnalytics: filter by course.faculty OR course.name fallback if (Array.isArray(src.courseAnalytics)) { result.courseAnalytics = src.courseAnalytics.filter((c: any) => { if (!facultyFilter) return true; if (c.faculty) return matchFaculty(c.faculty); if (c.department) return matchFaculty(c.department); if (c.name) return matchFaculty(c.name); return false; }); } else { result.courseAnalytics = []; } // examEligibility: filter by department/faculty field if present if (Array.isArray(src.examEligibility)) { result.examEligibility = src.examEligibility.filter((e: any) => { if (!facultyFilter) return true; if (e.faculty) return matchFaculty(e.faculty); if (e.department) return matchFaculty(e.department); return false; }); } else { result.examEligibility = []; } // fallback for KPIs — just use src.kpis if present result.kpis = src.kpis || {}; return result; }, [analyticsData, analyticsTimeRange, analyticsFaculty]); // 4) Replace your renderReports implementation with the version below (uses filteredAnalytics & analyticsFaculty) // Note: keep your utility functions (getTrendIcon, getPerformanceColor, getPerformanceBadge, etc.) available.

  const renderDashboard = () => {
  // Defensive defaults
  const studentsArr = Array.isArray(students) ? students : [];
  const lecturersArr = Array.isArray(lecturers) ? lecturers : [];
  const coursesArr = Array.isArray(courses) ? courses : [];
  const programsArr = Array.isArray(programs) ? programs : [];
  const facultiesArr = Array.isArray(faculties) ? faculties : [];
  const departmentsArr = Array.isArray(departments) ? departments : [];

  // Derived counts
  const totalStudents = studentsArr.length;
  const totalLecturers = lecturersArr.length;
  const totalCourses = coursesArr.length;
  const activeCourses = coursesArr.filter(c => ((c.status ?? c.state ?? '') as string).toLowerCase() === 'active').length;
  const totalPrograms = programsArr.length;
  const totalFaculties = facultiesArr.length;

  

  // Layout
  return (
    <div className="space-y-8">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Students</p>
              <p className="text-3xl font-bold text-blue-600">{formatNumber(totalStudents)}</p>
            </div>
            <Users className="h-12 w-12 text-blue-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Courses</p>
              <p className="text-3xl font-bold text-green-600">{formatNumber(activeCourses)}</p>
            </div>
            <BookOpen className="h-12 w-12 text-green-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Lecturers</p>
              <p className="text-3xl font-bold text-purple-600">{formatNumber(totalLecturers)}</p>
            </div>
            <User className="h-12 w-12 text-purple-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Programs</p>
              <p className="text-3xl font-bold text-orange-600">{formatNumber(totalPrograms)}</p>
            </div>
            <BookOpen className="h-12 w-12 text-orange-600 opacity-20" />
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-gray-600">Across {formatNumber(totalFaculties)} faculties</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button onClick={() => { setEditStudent(undefined); setIsStudentModalOpen(true); }}
            className="flex flex-col items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
            <UserPlus className="h-8 w-8 text-blue-600 mb-2" />
            <span className="text-sm font-medium text-blue-900">Add Student</span>
          </button>

          <button onClick={() => { setEditLecturer(undefined); setIsLecturerModalOpen(true); }}
            className="flex flex-col items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
            <UserCheck className="h-8 w-8 text-green-600 mb-2" />
            <span className="text-sm font-medium text-green-900">Add Lecturer</span>
          </button>

          <button onClick={() => { setEditCourse(undefined); setIsCourseModalOpen(true); }}
            className="flex flex-col items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
            <BookOpen className="h-8 w-8 text-purple-600 mb-2" />
            <span className="text-sm font-medium text-purple-900">Add Course</span>
          </button>

          <button onClick={() => handleQuickAction('schedule')}
            className="flex flex-col items-center p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors">
            <Calendar className="h-8 w-8 text-orange-600 mb-2" />
            <span className="text-sm font-medium text-orange-900">Schedule</span>
          </button>
        </div>
      </div>

      {/* Active Semester Overview & Performance */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Semester Overview</h3>
    <div className="space-y-4">
      <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
        <div>
          <p className="font-medium text-blue-900">Current Semester</p>
          <p className="text-sm text-blue-700">
            { /* prefer institution_settings.default_semester */ }
            {defaultSemester ?? ('N/A')}
          </p>
        </div>
        <Calendar className="h-8 w-8 text-blue-600" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <p className="text-2xl font-bold text-green-600">
            {formatNumber(ongoingAssessmentsCount)}
          </p>
          <p className="text-sm text-green-700">Ongoing Assessments</p>
        </div>

        <div className="text-center p-4 bg-purple-50 rounded-lg">
          <p className="text-2xl font-bold text-purple-600">
            {formatNumber(upcomingExamsCount)}
          </p>
          <p className="text-sm text-purple-700">Upcoming Exams</p>
        </div>
      </div>
    </div>
  </div>

  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
    <div className="space-y-4">
      {/* Pass Rate */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-600 flex items-center">
          Pass Rate
          <span className={`ml-3 text-xs px-2 py-0.5 rounded ${getPerformanceBadge(passKpiVal ?? 0, 'rate')}`}>
            {typeof passKpiVal === 'number' ? `${passKpiVal}%` : '—'}
          </span>
        </span>

        <div className="flex items-center">
          <span className="text-lg font-bold text-gray-900">{passKpiVal}%</span>
          <span className="ml-2" title={`Trend: ${String(passKpiTrend ?? 'flat')}`}>
            {getTrendIcon(passKpiTrend ?? 'flat')}
          </span>
        </div>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-green-500 h-2 rounded-full"
          style={{ width: `${passPct}%` }}
          role="progressbar"
          aria-valuenow={passPct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      {/* Dropout Rate */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-600">Dropout Rate</span>
        <div className="flex items-center">
          <span className="text-lg font-bold text-gray-900">{dropoutVal}%</span>
          <TrendingDown className="h-4 w-4 text-green-500 ml-2" />
        </div>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-red-500 h-2 rounded-full"
          style={{ width: `${dropoutPct}%` }}
          role="progressbar"
          aria-valuenow={dropoutPct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      {/* Enrollment quick stat */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">Total Enrollment</p>
          <p className="text-xl font-bold text-gray-900">{formatNumber(enrollmentVal)}</p>
        </div>

        <div className="text-right">
          <p className="text-xs text-gray-500">Compared to previous</p>
          <p className="text-sm font-medium text-gray-800">
            {analyticsData?.kpis?.enrollment?.change
              ? `${analyticsData.kpis.enrollment.change >= 0 ? '+' : ''}${analyticsData.kpis.enrollment.change}%`
              : '—'}
          </p>
        </div>
      </div>
    </div>
  </div>
</div>
    </div>
  );
};


  


  const renderFaculties = () => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Faculty Management</h2>
        <p className="text-gray-600">Manage university faculties and their information</p>
      </div>
      <button
        onClick={() => {
          setEditFaculty(undefined);
          setIsFacultyModalOpen(true);
        }}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
      >
        <Plus className="h-4 w-4" />
        <span>Add Faculty</span>
      </button>
    </div>

    {/* Search and Filters */}
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search faculties..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
    </div>

    {/* Faculties Table */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Faculty</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Head</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Students</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lecturers</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Budget</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {(filteredFaculties || []).map((faculty: any) => {
              const studentsText = formatNumber(faculty?.students);
              const lecturersText = formatNumber(faculty?.lecturers);
              const budgetStr = formatCurrency(faculty?.budget);
              const budgetDisplay = budgetStr === '-' ? '-' : `R${budgetStr}`;

              // head fallback: sometimes column is head_name or head
              const headDisplay = faculty?.head_name ?? faculty?.head ?? '-';

              return (
                <tr key={faculty?.id ?? Math.random()} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{faculty?.name ?? '-'}</div>
                      <div className="text-sm text-gray-500">{faculty?.code ?? '-'}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{headDisplay}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{studentsText}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{lecturersText}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{budgetDisplay}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleView('faculty', faculty)}
                      className="text-green-600 hover:text-green-900 transition-colors"
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleEditFaculty(faculty)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDeleteEntity('faculty', faculty)} className="text-red-600 hover:text-red-900">
                      <Trash2 className="h-4 w-4" />
                    </button>
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


  const renderCourses = () => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Courses Management</h2>
        <p className="text-gray-600">Manage university courses and their information</p>
      </div>
      <button
        onClick={() => {
          setEditCourse(undefined);
          setIsCourseModalOpen(true);
        }}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
      >
        <Plus className="h-4 w-4" />
        <span>Add Course</span>
      </button>
    </div>

    {/* Search and Filters */}
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center space-x-4 overflow-x-auto w-full">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search courses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <select
          value={filterFaculty}
          onChange={(e) => setFilterFaculty(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Faculties</option>
          {faculties.map(f => (
  <option key={f.id} value={f.name}>{f.name}</option>
))}
        </select>
        <select
          value={filterDepartment}
          onChange={(e) => setFilterDepartment(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Departments</option>
          {departments.map(d => (
  <option key={d.id} value={d.name}>{d.name}</option>
))}
        </select>
        <select
          value={filterProgram}
          onChange={(e) => setFilterProgram(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Programs</option>
          {programs.map(p => (
  <option key={p.id} value={p.name}>{p.name}</option>
))}
        </select>
        <select
          value={filterSemester}
          onChange={(e) => setFilterSemester(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Semesters</option>
          {[...new Set(courses.map(c => c.semester))].map((sem, idx) => (
  <option key={`semester-${idx}-${sem}`} value={sem}>
    {sem || "Unknown Semester"}
  </option>
))}


        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
    </div>

    {/* Courses Table */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Faculty</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Semester</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lecturer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Credits</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredCourses.map(course => (
              <tr key={course.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{course.name}</div>
                    <div className="text-sm text-gray-500">{course.code}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{course.faculty}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{course.department}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{course.program}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{course.semester}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{course.lecturer}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{course.credits}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => handleView('course', course)}
                    className="text-green-600 hover:text-green-900"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleEditCourse(course)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDeleteEntity('course', course)} className="text-red-600 hover:text-red-900">
                      <Trash2 className="h-4 w-4" />
                    </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {/* Course Modal */}
    <CourseModal
      isOpen={isCourseModalOpen}
      onClose={() => setIsCourseModalOpen(false)}
      onSave={handleSaveCourse}
      course={editCourse}
    />
  </div>
);

  const renderPrograms = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Program Management</h2>
          <p className="text-gray-600">Manage academic programs and their details</p>
        </div>
        <button
          onClick={() => {
            setEditProgram(undefined);
            setIsProgramModalOpen(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Program</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search programs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {/* FACULTY */}
<select
  value={filterFaculty}
  onChange={(e) => {
    const val = e.target.value;
    setFilterFaculty(val);

    // if a department is selected but doesn't belong to the new faculty, clear it
    if (filterDepartment) {
      const deptStillValid = programs.some(
        p => p.department === filterDepartment && (val ? p.faculty === val : true)
      );
      if (!deptStillValid) setFilterDepartment('');
    }
  }}
  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
>
  <option value="">All Faculties</option>
  {faculties.map(f => (
  <option key={f.id} value={f.name}>{f.name}</option>
))}
</select>
          {/* DEPARTMENT */}
<select
  value={filterDepartment}
  onChange={(e) => setFilterDepartment(e.target.value)}
  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
>
  <option value="">All Departments</option>
  {departments.map(d => (
  <option key={d.id} value={d.name}>{d.name}</option>
))}
</select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Programs Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Faculty</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPrograms.map((program) => (
                <tr key={program.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{program.name}</div>
                      <div className="text-sm text-gray-500">{program.code}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{program.faculty}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{program.department}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                      {program.level}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{program.duration}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleView('program', program)}
                      className="text-green-600 hover:text-green-900 transition-colors"
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleEditProgram(program)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDeleteEntity('program', program)} className="text-red-600 hover:text-red-900">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderStudents = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Student Management</h2>
          <p className="text-gray-600">Manage university students and their information</p>
        </div>
        <button
          onClick={() => {
            setEditStudent(undefined);
            setIsStudentModalOpen(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Student</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center space-x-4 overflow-x-auto w-full">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search faculties..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <select
          value={filterFaculty}
          onChange={(e) => setFilterFaculty(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Faculties</option>
          {faculties.map(f => (
  <option key={f.id} value={f.name}>{f.name}</option>
))}
        </select>
        <select
          value={filterDepartment}
          onChange={(e) => setFilterDepartment(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Departments</option>
          {departments.map(d => (
  <option key={d.id} value={d.name}>{d.name}</option>
))}
        </select>
        <select
          value={filterProgram}
          onChange={(e) => setFilterProgram(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Programs</option>
          {programs.map(p => (
  <option key={p.id} value={p.name}>{p.name}</option>
))}
        </select>
        <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Faculty</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{student.firstName}</div>
                      <div className="text-sm text-gray-500">{student.lastName}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.studentNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
  {student.email || '—'}
</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.faculty}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.department}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.program}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleView('student', student)}
                      className="text-green-600 hover:text-green-900 transition-colors"
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleEditStudent(student)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDeleteEntity('student', student)} className="text-red-600 hover:text-red-900">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderLecturers = () => (
  <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Lecturer Management</h2>
          <p className="text-gray-600">Manage university lecturers and their information</p>
        </div>
        <button
          onClick={() => {
            setEditLecturer(undefined);
            setIsLecturerModalOpen(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Lecturer</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search lecturers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        <select
          value={filterFaculty}
          onChange={(e) => setFilterFaculty(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Faculties</option>
          {faculties.map(f => (
  <option key={f.id} value={f.name}>{f.name}</option>
))}
        </select>
        <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Lecturers Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lecturer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lecturer Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Faculty</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Office</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLecturers.map((lecturer) => (
                <tr key={lecturer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{lecturer.firstName}</div>
                      <div className="text-sm text-gray-500">{lecturer.lastName}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{lecturer.lecturerNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
  {lecturer.email || "—"}
</td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{lecturer.faculty}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
  {lecturer.position || "—"}
</td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{lecturer.officeLocation}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleView('lecturer', lecturer)}
                      className="text-green-600 hover:text-green-900 transition-colors"
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleEditLecturer(lecturer)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDeleteEntity('lecturer', lecturer)} className="text-red-600 hover:text-red-900">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
);

  const renderDepartments = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Department Management</h2>
          <p className="text-gray-600">Manage university departments and their structure</p>
        </div>
        <button
          onClick={() => {
            setEditDepartment(undefined);
            setIsDepartmentModalOpen(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Department</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search departments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Departments Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Faculty</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Courses</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lectures</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Students</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDepartments.map((department) => (
                <tr key={department.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{department.name}</div>
                      <div className="text-sm text-gray-500">{department.code}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{department.faculty}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{department.courses}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{department.lecturers}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{department.students}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => handleView('department', department)}
                    className="text-green-600 hover:text-green-900"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleEditDepartment(department)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDeleteEntity('department', department)} className="text-red-600 hover:text-red-900">
  <Trash2 className="h-4 w-4" />
</button>
                </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderReports = () => {
  // show loading / placeholder while analytics are computing or not available
  if (analyticsLoading || !analyticsData) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300" />
          <p className="text-gray-600">Computing analytics... please wait.</p>
        </div>
      </div>
    );
  }

  // analyticsData is available below
  // safer destructure inside renderReports()
const {
  kpis = {},
  enrollmentTrends = [],
  departmentPerformance = [],
  courseAnalytics = [],
  retentionAnalysis = [],
  examEligibility = []
} = (analyticsData ?? {}) as {
  kpis?: Record<string, any>;
  enrollmentTrends?: any[];
  departmentPerformance?: DepartmentPerformanceItem[];
  courseAnalytics?: any[];
  retentionAnalysis?: any[];
  examEligibility?: any[];
};


  // --- Actionable insights derivation (dynamic) ---
  // Worst performing departments by pass rate (ascending)
  const worstDepts = (Array.isArray(departmentPerformance) ? departmentPerformance : [])
    .slice()
    .sort((a, b) => (a.passRate ?? 0) - (b.passRate ?? 0))
    .slice(0, 3);

  // Departments with low completion or low pass (below thresholds)
  const lowCompletionDepts = (Array.isArray(departmentPerformance) ? departmentPerformance : [])
    .filter(d => (d.completion ?? 0) < 70 || (d.passRate ?? 0) < 70)
    .slice(0, 3);

  // Courses with high dropout or low pass rate
  const concerningCourses = (Array.isArray(courseAnalytics) ? courseAnalytics : [])
    .filter(c => (c.dropoutRate ?? 0) >= 8 || (c.passRate ?? 0) < 70)
    .slice()
    .sort((a, b) => (b.dropoutRate ?? 0) - (a.dropoutRate ?? 0) || (a.passRate ?? 0) - (b.passRate ?? 0))
    .slice(0, 3);

  // Top departments and courses (success stories)
  const topDepts = (Array.isArray(departmentPerformance) ? departmentPerformance : [])
    .slice()
    .sort((a, b) => (b.passRate ?? 0) - (a.passRate ?? 0))
    .slice(0, 3);

  const topCourses = (Array.isArray(courseAnalytics) ? courseAnalytics : [])
    .slice()
    .sort((a, b) => (b.passRate ?? 0) - (a.passRate ?? 0) || (a.dropoutRate ?? 0) - (b.dropoutRate ?? 0))
    .slice(0, 3);

  // Overall exam eligibility average (simple mean of department percentages)
  const eligibilityAvg = Array.isArray(examEligibility) && examEligibility.length > 0
    ? Math.round((examEligibility.reduce((s, e) => s + (e.percentage ?? 0), 0) / examEligibility.length) * 10) / 10
    : 0;

  const eligibilityTrend = (kpis?.eligibility?.trend ?? 'flat') as 'up' | 'down' | 'flat';
  const eligibilityChange = kpis?.eligibility?.change ?? 0;

  // Employment KPI summary
  const employmentKpi = kpis?.employment ?? { value: 0, trend: 'flat', change: 0 };

  return (
    <div className="space-y-8">
      {/* Academic Reports & Analytics */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 flex items-center">
              <BarChart3 className="h-6 w-6 mr-2 text-blue-600" />
              Academic Reports & Analytics
            </h3>
            <p className="text-gray-600 mt-1">Comprehensive performance insights and data analysis</p>
          </div>

          <div className="flex items-center space-x-3">
            <select
              value={analyticsTimeRange}
              onChange={(e) => setAnalyticsTimeRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="3">Last 3 Months</option>
              <option value="6">Last 6 Months</option>
              <option value="12">Last 12 Months</option>
            </select>

            <select
              value={analyticsDepartment}
              onChange={(e) => setAnalyticsDepartment(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">All Departments</option>
              <option value="nas">Natural & Applied Sciences</option>
              <option value="ems">Economic & Management Sciences</option>
              <option value="edu">Education</option>
              <option value="hum">Humanities</option>
            </select>

            <button
              onClick={() => setShowExportModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-blue-600 rounded-lg">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              {getTrendIcon(kpis?.passRate?.trend ?? 'flat')}
            </div>
            <p className="text-blue-600 text-sm font-medium mb-1">Overall Pass Rate</p>
            <p className="text-3xl font-bold text-blue-900 mb-1">{kpis.passRate.value}%</p>
            <p className="text-xs text-blue-700">
              {kpis.passRate.trend === 'up' ? '+' : ''}{(kpis?.passRate?.change ?? 0)}% from last period
            </p>
          </div>

          <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-green-600 rounded-lg">
                <Users className="h-5 w-5 text-white" />
              </div>
              {getTrendIcon(kpis.retention.trend)}
            </div>
            <p className="text-green-600 text-sm font-medium mb-1">Student Retention</p>
            <p className="text-3xl font-bold text-green-900 mb-1">{kpis.retention.value}%</p>
            <p className="text-xs text-green-700">
              {kpis.retention.trend === 'up' ? '+' : ''}{kpis.retention.change}% from last period
            </p>
          </div>

          <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-purple-600 rounded-lg">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              {getTrendIcon(kpis.eligibility.trend)}
            </div>
            <p className="text-purple-600 text-sm font-medium mb-1">Exam Eligibility</p>
            <p className="text-3xl font-bold text-purple-900 mb-1">{kpis.eligibility.value}%</p>
            <p className="text-xs text-purple-700">
              {kpis.eligibility.trend === 'up' ? '+' : ''}{kpis.eligibility.change}% from last period
            </p>
          </div>

          <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-6 rounded-lg border border-orange-200">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-orange-600 rounded-lg">
                <Award className="h-5 w-5 text-white" />
              </div>
              {getTrendIcon(kpis.employment.trend)}
            </div>
            <p className="text-orange-600 text-sm font-medium mb-1">Employment Rate</p>
            <p className="text-3xl font-bold text-orange-900 mb-1">{kpis.employment.value}%</p>
            <p className="text-xs text-orange-700">
              {kpis.employment.trend === 'up' ? '+' : ''}{kpis.employment.change}% from last period
            </p>
          </div>
        </div>

        {/* Charts and Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Enrollment Trends */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                <Activity className="h-5 w-5 mr-2 text-blue-600" />
                Enrollment Trends
              </h4>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded mr-1" />
                  Enrollments
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded mr-1" />
                  Graduations
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {enrollmentTrends.map((trend, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 w-20">{trend.period}</span>
                  <div className="flex-1 mx-4">
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                        <div
                          className="bg-blue-500 h-4 rounded-full"
                          style={{ width: `${Math.min(100, (trend.enrollments / 600) * 100)}%` }}
                        />
                        <div
                          className="bg-green-500 h-4 rounded-full absolute top-0"
                          style={{ width: `${Math.min(100, (trend.graduations / 600) * 100)}%`, opacity: 0.7 }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-blue-600">{trend.enrollments}</div>
                    <div className="text-sm font-medium text-green-600">{trend.graduations}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Retention Analysis */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-green-600" />
                Student Retention Analysis
              </h4>
              <Info className="h-4 w-4 text-gray-400" />
            </div>

            <div className="space-y-4">
              {retentionAnalysis.map((retention, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 w-16">{retention.year}</span>
                  <div className="flex-1 mx-4">
                    <div className="bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${
                          retention.rate >= 85 ? 'bg-green-500' :
                          retention.rate >= 75 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(100, retention.rate)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${getPerformanceColor(retention.rate, 'rate')}`}>
                      {retention.rate}%
                    </div>
                    <div className="text-xs text-gray-500">{retention.students} students</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Department Performance Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h4 className="text-lg font-semibold text-gray-900 flex items-center">
              <Building className="h-5 w-5 mr-2 text-purple-600" />
              Department Performance Analysis
            </h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Students</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pass Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg GPA</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completion Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trend</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {departmentPerformance.map((dept, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{dept.name}</div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatNumber(dept.students)}</div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${getPerformanceColor(dept.passRate, 'rate')}`}>
                        {dept.passRate}%
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${getPerformanceColor(dept.avgGPA, 'gpa')}`}>
                        {dept.avgGPA}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${getPerformanceColor(dept.completion, 'rate')}`}>
                        {dept.completion}%
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      {getTrendIcon(dept.trend)}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPerformanceBadge(dept.passRate, 'rate')}`}>
                        {dept.passRate >= 80 ? 'Excellent' : dept.passRate >= 70 ? 'Good' : 'Needs Attention'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Course Analytics Grid */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h4 className="text-lg font-semibold text-gray-900 flex items-center">
              <BookOpen className="h-5 w-5 mr-2 text-indigo-600" />
              Course Performance Analytics
            </h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enrolled</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pass Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dropout Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {courseAnalytics.map((course, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{course.name}</div>
                        <div className="text-sm text-gray-500">{course.code}</div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{course.enrolled}</div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`text-sm font-medium ${getPerformanceColor(course.passRate, 'rate')}`}>
                          {course.passRate}%
                        </div>
                        <div className="ml-2 w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              course.passRate >= 80 ? 'bg-green-500' :
                              course.passRate >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(100, course.passRate)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${getPerformanceColor(course.avgScore, 'score')}`}>
                        {course.avgScore}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${
                        course.dropoutRate <= 5 ? 'text-green-600' :
                        course.dropoutRate <= 8 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {course.dropoutRate}%
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        course.passRate >= 80 && course.dropoutRate <= 5 ? 'bg-green-100 text-green-800' :
                        course.passRate >= 70 && course.dropoutRate <= 8 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {course.passRate >= 80 && course.dropoutRate <= 5 ? 'Excellent' :
                         course.passRate >= 70 && course.dropoutRate <= 8 ? 'Good' : 'Needs Attention'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Exam Eligibility Status */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900 flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
              Exam Eligibility Status by Department
            </h4>
            <div className="text-sm text-gray-500">Based on 50% coursework threshold</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {examEligibility.map((dept, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-medium text-gray-900">{dept.department}</h5>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPerformanceBadge(dept.percentage, 'rate')}`}>
                    {dept.percentage}%
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Eligible Students</span>
                    <span className="font-medium text-green-600">{dept.eligible}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Students</span>
                    <span className="font-medium text-gray-900">{dept.total}</span>
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${
                        dept.percentage >= 85 ? 'bg-green-500' :
                        dept.percentage >= 75 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, dept.percentage)}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-red-600">Not Eligible: {dept.total - dept.eligible}</span>
                    <span className="text-green-600">Eligible: {dept.eligible}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actionable Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Areas Needing Attention */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
              <h4 className="text-lg font-semibold text-red-900">Areas Needing Attention</h4>
            </div>

            <div className="space-y-4">
              {/* Worst departments */}
              <div>
                <h5 className="text-sm font-medium text-red-800 mb-2">Departments with lowest pass rates</h5>
                {worstDepts.length === 0 ? (
                  <p className="text-sm text-gray-600">No departments flagged.</p>
                ) : (
                  <ul className="space-y-2">
                    {worstDepts.map((d, i) => (
                      <li key={i} className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-red-500 rounded-full mt-2" />
                        <div>
                          <div className="text-sm font-medium text-red-900">{d.name}</div>
                          <div className="text-xs text-red-700">Pass rate: {d.passRate}% • Completion: {d.completion}%</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Concerning courses */}
              <div>
                <h5 className="text-sm font-medium text-red-800 mb-2">Courses with high dropout / low pass</h5>
                {concerningCourses.length === 0 ? (
                  <p className="text-sm text-gray-600">No courses currently flagged.</p>
                ) : (
                  <ul className="space-y-2">
                    {concerningCourses.map((c, i) => (
                      <li key={i} className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-red-500 rounded-full mt-2" />
                        <div>
                          <div className="text-sm font-medium text-red-900">{c.name} {c.code ? `(${c.code})` : ''}</div>
                          <div className="text-xs text-red-700">Dropout: {c.dropoutRate}% • Pass: {c.passRate}%</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Exam eligibility summary */}
              <div>
                <h5 className="text-sm font-medium text-red-800 mb-2">Exam Eligibility</h5>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-red-900">Avg eligibility: {eligibilityAvg}%</div>
                    <div className="text-xs text-red-700">Across {examEligibility.length} departments</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${eligibilityTrend === 'down' ? 'text-red-600' : eligibilityTrend === 'up' ? 'text-green-600' : 'text-gray-600'}`}>
                      {eligibilityTrend === 'up' ? '+' : eligibilityTrend === 'down' ? '-' : ''}{Math.abs(eligibilityChange)}%
                    </div>
                    <div className="text-xs text-gray-500">{eligibilityTrend === 'down' ? 'Decline' : eligibilityTrend === 'up' ? 'Improving' : 'Stable'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Success Stories */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <Zap className="h-5 w-5 text-green-600 mr-2" />
              <h4 className="text-lg font-semibold text-green-900">Success Stories</h4>
            </div>

            <div className="space-y-4">
              {/* Top departments */}
              <div>
                <h5 className="text-sm font-medium text-green-800 mb-2">Top performing departments</h5>
                {topDepts.length === 0 ? (
                  <p className="text-sm text-gray-600">No departments found.</p>
                ) : (
                  <ul className="space-y-2">
                    {topDepts.map((d, i) => (
                      <li key={i} className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2" />
                        <div>
                          <div className="text-sm font-medium text-green-900">{d.name}</div>
                          <div className="text-xs text-green-700">Pass rate: {d.passRate}% • Completion: {d.completion}%</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Top courses */}
              <div>
                <h5 className="text-sm font-medium text-green-800 mb-2">Top courses</h5>
                {topCourses.length === 0 ? (
                  <p className="text-sm text-gray-600">No courses to highlight.</p>
                ) : (
                  <ul className="space-y-2">
                    {topCourses.map((c, i) => (
                      <li key={i} className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2" />
                        <div>
                          <div className="text-sm font-medium text-green-900">{c.name} {c.code ? `(${c.code})` : ''}</div>
                          <div className="text-xs text-green-700">Pass: {c.passRate}% • Dropout: {c.dropoutRate}%</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Employment summary */}
              <div>
                <h5 className="text-sm font-medium text-green-800 mb-2">Employment</h5>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-green-900">{employmentKpi.value}% employed</div>
                    <div className="text-xs text-gray-500">Trend: {employmentKpi.trend}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${employmentKpi.trend === 'up' ? 'text-green-600' : employmentKpi.trend === 'down' ? 'text-red-600' : 'text-gray-600'}`}>
                      {employmentKpi.trend === 'up' ? '+' : employmentKpi.trend === 'down' ? '-' : ''}{Math.abs(employmentKpi.change ?? 0)}%
                    </div>
                    <div className="text-xs text-gray-500">Compared to previous period</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div> {/* end actionable insights */}
      </div> {/* end main card */}
    </div>
  );
};


  const renderSchedule = () => (
  <div className="space-y-6">
    <div className="w-full py-8">
      <div className="px-4 sm:px-6 lg:px-8">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-green-800 font-medium">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <Calendar className="h-8 w-8 text-purple-600" />
                <h1 className="text-3xl font-bold text-gray-900">Academic Schedule</h1>
              </div>
              <p className="text-gray-600">Manage lectures, exams, meetings, and events across the institution.</p>
            </div>
            <div className="flex space-x-3">
              <button 
  onClick={() => {
    resetForm();
    setShowAddModal(true); // ✅ this will display the modal
  }}
  className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
>
  <Plus className="h-4 w-4 mr-2" />
  Add Event
</button>
              <button
                onClick={exportSchedule}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Schedule
              </button>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            {/* View Controls */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => navigateWeek('prev')}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-lg font-semibold text-gray-900 min-w-[200px] text-center">
                  {weekDates[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - {' '}
                  {weekDates[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </h2>
                <button
                  onClick={() => navigateWeek('next')}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                Today
              </button>
            </div>

            {/* Filters */}
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm appearance-none bg-white"
                >
                  <option value="all">All Types</option>
                  <option value="lecture">Lectures</option>
                  <option value="meeting">Meetings</option>
                  <option value="event">Events</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-8">
          {/* Calendar Header */}
          <div className="grid grid-cols-8 border-b border-gray-200">
            <div className="p-4 bg-gray-50 border-r border-gray-200">
              <span className="text-sm font-medium text-gray-600">Time</span>
            </div>
            {weekDates.map((date, index) => (
              <div key={index} className="p-4 bg-gray-50 border-r border-gray-200 last:border-r-0 text-center">
                <div className="text-sm font-medium text-gray-900">
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className="text-lg font-bold text-gray-900 mt-1">
                  {date.getDate()}
                </div>
              </div>
            ))}
          </div>

          {/* Calendar Body */}
          <div className="grid grid-cols-8">
            {/* Time slots */}
            <div className="border-r border-gray-200">
              {Array.from({ length: 12 }, (_, i) => i + 8).map(hour => (
                <div key={hour} className="h-20 border-b border-gray-200 p-2 text-xs text-gray-500">
                  {hour.toString().padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Days */}
            {weekDates.map((date, dayIndex) => (
              <div key={dayIndex} className="border-r border-gray-200 last:border-r-0">
                {Array.from({ length: 12 }, (_, i) => i + 8).map(hour => {
                  const dateStr = formatDate(date);
                  const eventsForSlot = getEventsForDate(dateStr).filter(event => {
                    const eventHour = parseInt(event.startTime.split(':')[0]);
                    return eventHour === hour;
                  });

                  return (
                    <div key={hour} className="h-20 border-b border-gray-200 p-1 relative">
                      {eventsForSlot.map(event => (
                        <div
                          key={event.id}
                          onClick={() => {
                            setSelectedEvent(event);
                            setShowEventModal(true);
                          }}
                          className={`absolute inset-1 rounded p-1 cursor-pointer border-l-4 ${getEventColor(event.type)} hover:shadow-md transition-shadow`}
                        >
                          <div className="text-xs font-medium truncate">{event.title}</div>
                          <div className="text-xs opacity-75 truncate">{event.venue}</div>
                          <div className="text-xs opacity-75">{event.startTime}-{event.endTime}</div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Events List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">All Events ({filteredEvents.length})</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {filteredEvents.map(event => (
              <div key={event.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${getEventColor(event.type).split(' ')[0]}`}></div>
                    <div>
                      <h4 className="font-medium text-gray-900">{event.title}</h4>
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                        <span className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          {new Date(event.date).toLocaleDateString()}
                        </span>
                        <span className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          {event.startTime} - {event.endTime}
                        </span>
                        <span className="flex items-center">
                          <MapPin className="h-4 w-4 mr-1" />
                          {event.venue}
                        </span>
                        {event.course && (
                          <span className="flex items-center">
                            <BookOpen className="h-4 w-4 mr-1" />
                            {event.course}
                          </span>
                        )}
                        {event.attendees && (
                          <span className="flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            {event.attendees}/{event.maxAttendees}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(event.status)}`}>
                      {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                    </span>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => {
                          setSelectedEvent(event);
                          setShowEventModal(true);
                        }}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(event)}
                        className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                        title="Edit Event"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(event)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete Event"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {filteredEvents.length === 0 && (
              <div className="p-12 text-center">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No events found matching your criteria.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Event Details Modal */}
    {showEventModal && selectedEvent && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Event Details</h3>
            <button
              onClick={() => setShowEventModal(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Event Information</h4>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-600">Title:</span>
                    <p className="text-gray-900">{selectedEvent.title}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Type:</span>
                    <p className="text-gray-900 capitalize">{selectedEvent.type}</p>
                  </div>
                  {selectedEvent.course && (
                    <div>
                      <span className="text-sm font-medium text-gray-600">Course:</span>
                      <p className="text-gray-900">{selectedEvent.course}</p>
                    </div>
                  )}
                  {selectedEvent.lecturer && (
                    <div>
                      <span className="text-sm font-medium text-gray-600">Lecturer:</span>
                      <p className="text-gray-900">{selectedEvent.lecturer}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-sm font-medium text-gray-600">Status:</span>
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedEvent.status)}`}>
                      {selectedEvent.status.charAt(0).toUpperCase() + selectedEvent.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Schedule & Location</h4>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-600">Date:</span>
                    <p className="text-gray-900">{new Date(selectedEvent.date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Time:</span>
                    <p className="text-gray-900">{selectedEvent.startTime} - {selectedEvent.endTime}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Venue:</span>
                    <p className="text-gray-900">{selectedEvent.venue}</p>
                  </div>
                  {selectedEvent.attendees && (
                    <div>
                      <span className="text-sm font-medium text-gray-600">Attendance:</span>
                      <p className="text-gray-900">{selectedEvent.attendees}/{selectedEvent.maxAttendees} attendees</p>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${(selectedEvent.attendees / (selectedEvent.maxAttendees || 1)) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {selectedEvent.description && (
              <div className="mt-6">
                <h4 className="font-semibold text-gray-900 mb-2">Description</h4>
                <p className="text-gray-700">{selectedEvent.description}</p>
              </div>
            )}
          </div>
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg flex justify-end space-x-3">
            <button
              onClick={() => setShowEventModal(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                setShowEventModal(false);
                openEditModal(selectedEvent);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Edit Event
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Add Event Modal */}
    {showAddModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      {/* Modal header */}
      <div className="flex justify-between items-center p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Add New Event</h3>
        <button
          onClick={() => setShowAddModal(false)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Form */}
      
      <form onSubmit={handleAddEvent} className="p-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Event Title *</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter event title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Event Type *</label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="lecture">Lecture</option>
                    <option value="meeting">Meeting</option>
                    <option value="event">Event</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Venue *</label>
                    <input
                      name="venue"
                      value={formData.venue}
                      onChange={handleInputChange}
                      onFocus={() => setShowVenueSuggestions(formData.venue.trim().length > 0)}
                      onBlur={() => setTimeout(() => setShowVenueSuggestions(false), 150)}
                      placeholder="Start typing venue..."
                      autoComplete="off"
                      required
                      className="w-full px-3 py-2 border rounded"
                    />
                    {showVenueSuggestions && filteredVenueSuggestions.length > 0 && (
                      <ul className="absolute z-50 left-0 right-0 bg-white border rounded-md mt-1 max-h-48 overflow-auto shadow">
                        {filteredVenueSuggestions.map(v => (
                          <li key={v} onMouseDown={(e) => e.preventDefault()} onClick={() => handleSelectVenue(v)} className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm">
                            {v}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Time *</label>
                  <input
                    type="time"
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Time *</label>
                  <input
                    type="time"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Lecturer input with suggestions */}
                {formData.type === 'lecture' && (
                  <div className="relative">
                    <label className="block text-sm font-medium mb-1">Lecturer</label>
                    <input
                      name="lecturer"
                      value={formData.lecturer}
                      onChange={handleInputChange}
                      onFocus={() => setShowLecturerSuggestions(formData.lecturer.trim().length > 0)}
                      onBlur={() => setTimeout(() => setShowLecturerSuggestions(false), 150)}
                      autoComplete="off"
                      placeholder="Start typing lecturer name..."
                      className="w-full px-3 py-2 border rounded"
                    />
                    {showLecturerSuggestions && filteredLecturerSuggestions.length > 0 && (
                      <ul className="absolute z-50 left-0 right-0 bg-white border rounded-md mt-1 max-h-48 overflow-auto shadow">
                        {filteredLecturerSuggestions.map(l => (
                          <li
                            key={l.id}
                            onMouseDown={(ev) => ev.preventDefault()}
                            onClick={() => handleSelectLecturer(l)}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                          >
                            <div className="font-medium">{l.firstName} {l.lastName}</div>
                            <div className="text-xs text-gray-500">{l.department} • {l.email}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Attendees</label>
                  <input
                    type="number"
                    name="maxAttendees"
                    value={formData.maxAttendees}
                    onChange={handleInputChange}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter event description (optional)"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg flex justify-end space-x-3">
                            <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                            <button type="submit" onClick={(e) => handleAddEvent(e)} disabled={isSubmitting} className="px-4 py-2 bg-purple-600 text-white rounded">
                              {isSubmitting ? 'Creating...' : (<><Save className="h-4 w-4 mr-2 inline" />Create Event</>)}
                            </button>
                          </div>
          </form>
    </div>
  </div>
)}

    {/* Edit Event Modal */}
    {showEditModal && editingEvent && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Edit Event</h3>
            <button
              onClick={() => setShowEditModal(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <form onSubmit={handleEditEvent} className="p-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Event Title *</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter event title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Event Type *</label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="lecture">Lecture</option>
                    <option value="meeting">Meeting</option>
                    <option value="event">Event</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Venue *</label>
                    <input
                      name="venue"
                      value={formData.venue}
                      onChange={handleInputChange}
                      onFocus={() => setShowVenueSuggestions(formData.venue.trim().length > 0)}
                      onBlur={() => setTimeout(() => setShowVenueSuggestions(false), 150)}
                      autoComplete="off"
                      placeholder="Start typing venue..."
                      required
                      className="w-full px-3 py-2 border rounded"
                    />
                    {showVenueSuggestions && filteredVenueSuggestions.length > 0 && (
                      <ul className="absolute z-50 left-0 right-0 bg-white border rounded-md mt-1 max-h-48 overflow-auto shadow">
                        {filteredVenueSuggestions.map(v => (
                          <li key={v} onMouseDown={(e) => e.preventDefault()} onClick={() => handleSelectVenue(v)} className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm">
                            {v}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Time *</label>
                  <input
                    type="time"
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Time *</label>
                  <input
                    type="time"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Lecturer input with suggestions (prepopulated) */}
                  {formData.type === 'lecture' && (
                    <div className="relative">
                      <label className="block text-sm font-medium mb-1">Lecturer</label>
                      <input
                        name="lecturer"
                        value={formData.lecturer}
                        onChange={handleInputChange}
                        onFocus={() => setShowLecturerSuggestions(formData.lecturer.trim().length > 0)}
                        onBlur={() => setTimeout(() => setShowLecturerSuggestions(false), 150)}
                        autoComplete="off"
                        placeholder="Start typing lecturer name..."
                        className="w-full px-3 py-2 border rounded"
                      />
                      {showLecturerSuggestions && filteredLecturerSuggestions.length > 0 && (
                        <ul className="absolute z-50 left-0 right-0 bg-white border rounded-md mt-1 max-h-48 overflow-auto shadow">
                          {filteredLecturerSuggestions.map(l => (
                            <li key={l.id} onMouseDown={(ev) => ev.preventDefault()} onClick={() => handleSelectLecturer(l)} className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm">
                              <div className="font-medium">{l.firstName} {l.lastName}</div>
                              <div className="text-xs text-gray-500">{l.department} • {l.email}</div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Attendees</label>
                  <input
                    type="number"
                    name="maxAttendees"
                    value={formData.maxAttendees}
                    onChange={handleInputChange}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter event description (optional)"
                />
              </div>
            </div>
          </form>
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg flex justify-end space-x-3">
            <button
              onClick={() => setShowEditModal(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleEditEvent}
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Update Event
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Delete Confirmation Modal */}
    {showDeleteModal && eventToDelete && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-md w-full">
          <div className="flex justify-between items-center p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Delete Event</h3>
            <button
              onClick={() => setShowDeleteModal(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div>
                <h4 className="font-medium text-gray-900">Are you sure?</h4>
                <p className="text-sm text-gray-600">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-gray-700">
              You are about to delete the event "<strong>{eventToDelete.title}</strong>"
              scheduled for {new Date(eventToDelete.date).toLocaleDateString()}
              at {eventToDelete.startTime}.
            </p>
          </div>
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg flex justify-end space-x-3">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteEvent}
              disabled={isSubmitting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Event
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);

  

  {/* Generic Delete Confirmation Modal */}
{showDeleteModal && entityToDelete && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg max-w-md w-full">
      <div className="flex justify-between items-center p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Delete {deleteEntityType ? deleteEntityType.charAt(0).toUpperCase() + deleteEntityType.slice(1) : 'Item'}
        </h3>
        <button onClick={handleCancelDelete} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="p-6">
        <div className="flex items-center space-x-3 mb-4">
          <AlertTriangle className="h-8 w-8 text-red-600" />
          <div>
            <h4 className="font-medium text-gray-900">Are you sure?</h4>
            <p className="text-sm text-gray-600">This action cannot be undone.</p>
          </div>
        </div>

        {/* Details by entity type */}
        <div className="mb-4 text-sm text-gray-800 space-y-1">
          {deleteEntityType === 'faculty' && (
            <>
              <p><strong>Faculty:</strong> {entityToDelete.name}</p>
              <p><strong>Code:</strong> {entityToDelete.code}</p>
              <p className="text-xs text-gray-500">Established: {entityToDelete.established}</p>
            </>
          )}

          {deleteEntityType === 'lecturer' && (
            <>
              <p><strong>Lecturer:</strong> {entityToDelete.firstName} {entityToDelete.lastName}</p>
              <p><strong>Lecturer #:</strong> {entityToDelete.lecturerNumber}</p>
              <p className="text-xs text-gray-500">Email: {entityToDelete.email}</p>
            </>
          )}

          {deleteEntityType === 'department' && (
            <>
              <p><strong>Department:</strong> {entityToDelete.name}</p>
              <p><strong>Code:</strong> {entityToDelete.code}</p>
              <p className="text-xs text-gray-500">Faculty: {entityToDelete.faculty}</p>
            </>
          )}

          {deleteEntityType === 'student' && (
            <>
              <p><strong>Student:</strong> {entityToDelete.firstName} {entityToDelete.lastName}</p>
              <p><strong>Student #:</strong> {entityToDelete.studentNumber}</p>
              <p className="text-xs text-gray-500">Email: {entityToDelete.email}</p>
            </>
          )}

          {deleteEntityType === 'course' && (
            <>
              <p><strong>Course:</strong> {entityToDelete.name}</p>
              <p><strong>Code:</strong> {entityToDelete.code}</p>
              <p className="text-xs text-gray-500">Program: {entityToDelete.program}</p>
            </>
          )}

          {deleteEntityType === 'program' && (
            <>
              <p><strong>Program:</strong> {entityToDelete.name}</p>
              <p><strong>Code:</strong> {entityToDelete.code}</p>
              <p className="text-xs text-gray-500">Faculty: {entityToDelete.faculty}</p>
            </>
          )}
        </div>

        <p className="text-gray-700 mb-4">
          Deleting this {deleteEntityType} will remove it from the system and cannot be undone.
          Make sure there are no dependent records (departments, programs, courses) attached.
        </p>
      </div>

      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg flex justify-end space-x-3">
        <button
          onClick={handleCancelDelete}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          disabled={isDeleting}
        >
          Cancel
        </button>
        <button
          onClick={handleConfirmDeleteEntity}
          disabled={isDeleting}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {isDeleting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Deleting...
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete {deleteEntityType}
            </>
          )}
        </button>
      </div>
    </div>
  </div>
)}

  const tabs = [
    { id: 'dashboard', name: 'Dashboard', icon: BarChart3 },
    { id: 'students', name: 'Students', icon: Users },
    { id: 'lecturers', name: 'Lecturers', icon: User },
    { id: 'courses', name: 'Courses', icon: BookOpen },
    { id: 'programs', name: 'Programs', icon: Award },
    { id: 'departments', name: 'Departments', icon: Boxes },
    { id: 'faculties', name: 'Faculties', icon: Building },
    { id: 'schedule', name: 'Schedule', icon: Calendar },
    { id: 'reports', name: 'Reports', icon: FileText }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Message display (banner/toast/card) */}
      {message && <MessageDisplay message={message} onClose={() => setMessage(null)} />}

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <GraduationCap className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-2xl font-bold text-gray-900">Trackademy</span>
              <span className="ml-4 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">Admin Portal</span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsExportModalOpen(true)}
                className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors"
              >
                <Download className="h-4 w-4" />
                <span className="text-sm">Export Data</span>
              </button>
              <button
                onClick={() => navigate('/admin/settings')}
                className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors"
              >
                <Settings className="h-4 w-4" />
                <span className="text-sm">Settings</span>
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
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSearchTerm('');
                    setFilterStatus('');
                    setFilterDepartment('');
                  }}
                  className={`w-full flex items-center px-6 py-3 text-left hover:bg-gray-50 transition-colors ${
                    activeTab === tab.id ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600' : 'text-gray-700'
                  }`}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8 overflow-auto h-[calc(100vh-64px)]">
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'students' && renderStudents()}
          {activeTab === 'lecturers' && renderLecturers()}
          {activeTab === 'courses' && renderCourses()}
          {activeTab === 'programs' && renderPrograms()}
          {activeTab === 'departments' && renderDepartments()}
          {activeTab === 'faculties' && renderFaculties()}
          {activeTab === 'schedule' && renderSchedule()}
          {activeTab === 'reports' && renderReports()}
        </div>
      </div>

      {/* Modals */}

      {/* Alert Details Modal */}
      {alertModal.isOpen && alertModal.alert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{alertModal.alert.title}</h3>
              <button
                onClick={() => setAlertModal({ isOpen: false, alert: null })}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Priority:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    alertModal.alert.priority === 'High' ? 'bg-red-100 text-red-800' :
                    alertModal.alert.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {alertModal.alert.priority}
                  </span>
                </div>
                {alertModal.alert.deadline && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Deadline:</span>
                    <span className="text-sm text-gray-900">{alertModal.alert.deadline}</span>
                  </div>
                )}
              </div>
              <p className="text-gray-700 mb-4">{alertModal.alert.details}</p>
              {alertModal.alert.courses && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">Affected Courses:</h4>
                  <div className="flex flex-wrap gap-2">
                    {alertModal.alert.courses.map((course: string, index: number) => (
                      <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                        {course}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {alertModal.alert.students && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">Affected Students:</h4>
                  <div className="flex flex-wrap gap-2">
                    {alertModal.alert.students.slice(0, 5).map((student: string, index: number) => (
                      <span key={index} className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                        {student}
                      </span>
                    ))}
                    {alertModal.alert.students.length > 5 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">
                        +{alertModal.alert.students.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ViewModal
        isOpen={viewModal.isOpen}
        onClose={() => setViewModal({ isOpen: false, data: null, type: null })}
        data={viewModal.data}
        type={viewModal.type}
      />
      
      <FacultyModal
        isOpen={isFacultyModalOpen}
        onClose={() => {
          setIsFacultyModalOpen(false);
          setEditFaculty(undefined);
        }}
        faculty={editFaculty}
        onSave={handleSaveFaculty}
      />

      <LecturerModal
        isOpen={isLecturerModalOpen}
        onClose={() => {
          setIsLecturerModalOpen(false);
          setEditLecturer(undefined);
        }}
        lecturer={editLecturer}
        onSave={handleSaveLecturer}
      />

      <StudentModal
        isOpen={isStudentModalOpen}
        onClose={() => {
          setIsStudentModalOpen(false);
          setEditStudent(undefined);
        }}
        student={editStudent}
        onSave={handleSaveStudent}
      />

      <DepartmentModal
        isOpen={isDepartmentModalOpen}
        onClose={() => {
          setIsDepartmentModalOpen(false);
          setEditDepartment(undefined);
        }}
        department={editDepartment}
        onSave={handleSaveDepartment}
      />

      <ProgramModal
        isOpen={isProgramModalOpen}
        onClose={() => {
          setIsProgramModalOpen(false);
          setEditProgram(undefined);
        }}
        program={editProgram}
        onSave={handleSaveProgram}
      />

      <CourseModal
        isOpen={isCourseModalOpen}
        onClose={() => {
          setIsCourseModalOpen(false);
          setEditCourse(undefined);
        }}
        course={editCourse}
        onSave={handleSaveCourse}
      />

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

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
      {/* Generic Delete Confirmation Modal */}
      {showDeleteModal && entityToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Delete {deleteEntityType ? deleteEntityType.charAt(0).toUpperCase() + deleteEntityType.slice(1) : 'Item'}
              </h3>
              <button onClick={handleCancelDelete} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <AlertTriangle className="h-8 w-8 text-red-600" />
                <div>
                  <h4 className="font-medium text-gray-900">Are you sure?</h4>
                  <p className="text-sm text-gray-600">This action cannot be undone.</p>
                </div>
              </div>

              {/* Details by entity type */}
              <div className="mb-4 text-sm text-gray-800 space-y-1">
                {deleteEntityType === 'faculty' && (
                  <>
                    <p><strong>Faculty:</strong> {entityToDelete.name}</p>
                    <p><strong>Code:</strong> {entityToDelete.code}</p>
                    <p className="text-xs text-gray-500">Established: {entityToDelete.established}</p>
                  </>
                )}

                {deleteEntityType === 'lecturer' && (
                  <>
                    <p><strong>Lecturer:</strong> {entityToDelete.firstName} {entityToDelete.lastName}</p>
                    <p><strong>Lecturer #:</strong> {entityToDelete.lecturerNumber}</p>
                    <p className="text-xs text-gray-500">Email: {entityToDelete.email}</p>
                  </>
                )}

                {deleteEntityType === 'department' && (
                  <>
                    <p><strong>Department:</strong> {entityToDelete.name}</p>
                    <p><strong>Code:</strong> {entityToDelete.code}</p>
                    <p className="text-xs text-gray-500">Faculty: {entityToDelete.faculty}</p>
                  </>
                )}

                {deleteEntityType === 'student' && (
                  <>
                    <p><strong>Student:</strong> {entityToDelete.firstName} {entityToDelete.lastName}</p>
                    <p><strong>Student #:</strong> {entityToDelete.studentNumber}</p>
                    <p className="text-xs text-gray-500">Email: {entityToDelete.email}</p>
                  </>
                )}

                {deleteEntityType === 'course' && (
                  <>
                    <p><strong>Course:</strong> {entityToDelete.name}</p>
                    <p><strong>Code:</strong> {entityToDelete.code}</p>
                    <p className="text-xs text-gray-500">Program: {entityToDelete.program}</p>
                  </>
                )}

                {deleteEntityType === 'program' && (
                  <>
                    <p><strong>Program:</strong> {entityToDelete.name}</p>
                    <p><strong>Code:</strong> {entityToDelete.code}</p>
                    <p className="text-xs text-gray-500">Faculty: {entityToDelete.faculty}</p>
                  </>
                )}
              </div>

              <p className="text-gray-700 mb-4">
                Deleting this {deleteEntityType} will remove it from the system and cannot be undone.
                Make sure there are no dependent records (departments, programs, courses) attached.
              </p>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg flex justify-end space-x-3">
              <button
                onClick={handleCancelDelete}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteEntity}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete {deleteEntityType}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;