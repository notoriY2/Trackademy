// src/components/admin/StudentModal.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Phone,
  Users,
  BookOpen,
  Save,
  X,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Faculty { id: string; name: string; code?: string }
interface Department { id: string; name: string; faculty_id: string; code?: string }
interface Program { id: string; name: string; department_id: string; faculty_id?: string; code?: string }

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student?: any;
  onSave: (studentData: any) => void;
}

const StudentModal: React.FC<StudentModalProps> = ({ isOpen, onClose, student, onSave }) => {
  const navigate = useNavigate();
  const [isEditMode, setIsEditMode] = useState(false);

  // fetched lists
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);

  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  // --- Form state ---
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    gender: '',
    idNumber: '',
    maritalStatus: '',
    homeLanguage: '',
    citizenship: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    address: '',
    studentNumber: '',
    faculty: '',
    department: '',
    program: '',
    yearOfStudy: '1',
    emergencyContact: '',
    emergencyPhone: ''
  });

  // Track whether the email field was edited by the user to avoid overwriting a personal email
  const [emailTouched, setEmailTouched] = useState(false);


  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // UI notifications (modern banners)
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Email/password generation rules
  const makeEmailFromStudentNumber = (studentNumber: string) => {
    if (!studentNumber) return '';
    //  "12345678" -> "12345678@spu.ac.za"
    return `${studentNumber}@spu.ac.za`;
  };

  // *** Updated: password is now full studentNumber + @spu123 (not last 6) ***
  const makePasswordFromStudentNumber = (studentNumber: string) => {
    if (!studentNumber) return '';
    return `${studentNumber}@spu123`;
  };

  // Fetch meta data from DB
  useEffect(() => {
    let mounted = true;
    const fetchMeta = async () => {
      setIsLoadingMeta(true);
      setMetaError(null);
      try {
        const { data: fdata, error: ferr } = await supabase
          .from('faculties')
          .select('id,name,code')
          .order('name');
        if (ferr) throw ferr;

        const { data: ddata, error: derr } = await supabase
          .from('departments')
          .select('id,name,faculty_id,code')
          .order('name');
        if (derr) throw derr;

        const { data: pdata, error: perr } = await supabase
          .from('programs')
          .select('id,name,department_id,faculty_id,code')
          .order('name');
        if (perr) throw perr;

        if (!mounted) return;
        setFaculties(fdata ?? []);
        setDepartments(ddata ?? []);
        setPrograms(pdata ?? []);
      } catch (err: any) {
        console.error('Failed to load faculties/departments/programs', err);
        setMetaError(err?.message || 'Failed to load metadata');
      } finally {
        if (mounted) setIsLoadingMeta(false);
      }
    };

    fetchMeta();
    return () => { mounted = false; };
  }, []);

  // when studentNumber changes (only when creating new record), auto-set email
  // NOTE: don't overwrite a personal email that the user has already typed. We track
  // whether the email input was touched and only auto-fill when it has NOT been touched.
  useEffect(() => {
    if (isEditMode) return; // keep existing email when editing
    if (emailTouched) return; // don't overwrite if user edited the email field

    if (!formData.email || formData.email.trim() === '') {
      const newEmail = makeEmailFromStudentNumber(formData.studentNumber);
      setFormData(prev => ({ ...prev, email: newEmail }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.studentNumber, isEditMode, emailTouched]);

  // Trying to be tolerant of existing data (maps names -> ids)
  const findFacultyIdByName = (nameOrId?: string) => {
    if (!nameOrId) return '';
    if (faculties.some(f => f.id === nameOrId)) return nameOrId;
    const found = faculties.find(f => f.name.toLowerCase() === String(nameOrId).toLowerCase());
    return found ? found.id : '';
  };
  const findDepartmentIdByName = (nameOrId?: string) => {
    if (!nameOrId) return '';
    if (departments.some(d => d.id === nameOrId)) return nameOrId;
    const found = departments.find(d => d.name.toLowerCase() === String(nameOrId).toLowerCase());
    return found ? found.id : '';
  };
  const findProgramIdByName = (nameOrId?: string) => {
    if (!nameOrId) return '';
    if (programs.some(p => p.id === nameOrId)) return nameOrId;
    const found = programs.find(p => p.name.toLowerCase() === String(nameOrId).toLowerCase());
    return found ? found.id : '';
  };

  // Populate form when editing
  // Populate form when editing — replace your current useEffect that sets formData from `student`
useEffect(() => {
  let mounted = true;

  const populateForEdit = async () => {
    setIsEditMode(!!student);

    if (!student) {
      // reset to blank form when no student
      setFormData({
        firstName: '',
        lastName: '',
        gender: '',
        idNumber: '',
        maritalStatus: '',
        homeLanguage: '',
        citizenship: '',
        email: '',
        phone: '',
        dateOfBirth: '',
        address: '',
        studentNumber: '',
        faculty: '',
        department: '',
        program: '',
        yearOfStudy: '1',
        emergencyContact: '',
        emergencyPhone: ''
      });
      setEmailTouched(false);
      setErrors({});
      setErrorBanner(null);
      setSuccessMessage(null);
      return;
    }

    // quick local mapping from the prop (useful when DB fetch fails or missing columns)
    const fallback = {
      firstName: student.firstName || '',
      lastName: student.lastName || '',
      gender: student.gender || '',
      idNumber: student.idNumber || '',
      maritalStatus: student.maritalStatus || '',
      homeLanguage: student.homeLanguage || '',
      citizenship: student.citizenship || '',
      email: student.email || '',
      phone: student.phone || '',
      dateOfBirth: student.dateOfBirth || '',
      address: student.address || '',
      studentNumber: student.studentNumber || '',
      faculty: student.faculty || '',
      department: student.department || '',
      program: student.program || '',
      yearOfStudy: student.yearOfStudy ? String(student.yearOfStudy) : '1',
      emergencyContact: student.emergencyContact || '',
      emergencyPhone: student.emergencyPhone || ''
    };

    // try to enrich/fill from DB
    try {
      // determine identifiers we can use
      const studentId = (student as any)?.studentId ?? (student as any)?.student_id ?? (student as any)?.id ?? null;
      const studentNumberProp = (student as any)?.studentNumber ?? (student as any)?.student_number ?? null;
      const profileIdProp = (student as any)?.profileId ?? (student as any)?.profile_id ?? null;

      // 1) fetch students row if possible
      let studentRow: any = null;
      if (studentId) {
        const { data, error } = await supabase.from('students').select('*').eq('id', studentId).maybeSingle();
        if (!error && data) studentRow = data;
      } else if (studentNumberProp) {
        const { data, error } = await supabase.from('students').select('*').eq('student_number', studentNumberProp).maybeSingle();
        if (!error && data) studentRow = data;
      }

      // 2) fetch profile row (if we have profile_id or studentRow.profile_id)
      let profileRow: any = null;
      const profileId = profileIdProp ?? studentRow?.profile_id ?? null;
      if (profileId) {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', profileId).maybeSingle();
        if (!error && data) profileRow = data;
      }

      // 3) fetch user email (users table) if profile has user_id
      let userEmail: string | null = null;
      if (profileRow?.user_id) {
        const { data, error } = await supabase.from('users').select('email').eq('id', profileRow.user_id).maybeSingle();
        if (!error && data) userEmail = data.email ?? null;
      }

      // 4) build final populated form using DB values first, then prop fallbacks
      const populated = {
        firstName: profileRow?.first_name ?? profileRow?.full_name?.split(' ')[0] ?? fallback.firstName,
        lastName: profileRow?.last_name ?? (profileRow?.full_name ? profileRow.full_name.split(' ').slice(1).join(' ') : '') ?? fallback.lastName,
        gender: student.gender ?? profileRow?.gender ?? fallback.gender,
idNumber: student.idNumber ?? profileRow?.id_number ?? fallback.idNumber,
maritalStatus: student.maritalStatus ?? profileRow?.marital_status ?? fallback.maritalStatus,
homeLanguage: student.homeLanguage ?? profileRow?.home_language ?? profileRow?.preferred_language ?? fallback.homeLanguage,
citizenship: student.citizenship ?? profileRow?.citizenship ?? fallback.citizenship,
dateOfBirth: student.dateOfBirth ?? profileRow?.date_of_birth ?? fallback.dateOfBirth,
        email: student.email ?? userEmail ?? profileRow?.email ?? fallback.email,
        phone: student.phone ?? profileRow?.phone ?? studentRow?.phone ?? fallback.phone,
        address: student.address ?? profileRow?.address ?? fallback.address,
        studentNumber: student.studentNumber ?? studentRow?.student_number ?? fallback.studentNumber,
        // map program/faculty/department to IDs when possible:
        faculty: findFacultyIdByName(student.faculty ?? (studentRow && (studentRow.faculty ?? '')) ?? ''),
        department: findDepartmentIdByName(student.department ?? (studentRow && (studentRow.department ?? '')) ?? ''),
        // program in DB may be program_id (uuid) — map by id or name
        program: findProgramIdByName(student.program ?? studentRow?.program_id ?? studentRow?.program ?? ''),
        yearOfStudy: student.yearOfStudy ? String(student.yearOfStudy) : (studentRow?.year_of_study ? String(studentRow.year_of_study) : '1'),
        emergencyContact: student.emergencyContact ?? studentRow?.emergency_contact_name ?? fallback.emergencyContact,
        emergencyPhone: student.emergencyPhone ?? studentRow?.emergency_contact_phone ?? fallback.emergencyPhone
      };

      if (!mounted) return;
      setFormData(populated);
      setEmailTouched(!!(populated.email && populated.email.trim()));
    } catch (err) {
      console.error('Failed to populate student edit form', err);
      // fallback to provided student prop values if DB enrichment failed
      if (mounted) {
        setFormData({
          firstName: fallback.firstName,
          lastName: fallback.lastName,
          gender: fallback.gender,
          idNumber: fallback.idNumber,
          maritalStatus: fallback.maritalStatus,
          homeLanguage: fallback.homeLanguage,
          citizenship: fallback.citizenship,
          email: fallback.email,
          phone: fallback.phone,
          dateOfBirth: fallback.dateOfBirth,
          address: fallback.address,
          studentNumber: fallback.studentNumber,
          faculty: findFacultyIdByName(fallback.faculty),
          department: findDepartmentIdByName(fallback.department),
          program: findProgramIdByName(fallback.program),
          yearOfStudy: fallback.yearOfStudy,
          emergencyContact: fallback.emergencyContact,
          emergencyPhone: fallback.emergencyPhone
        });
        setEmailTouched(!!fallback.email);
      }
    }

    setErrors({});
    setErrorBanner(null);
    setSuccessMessage(null);
  };

  populateForEdit();

  return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [student, isOpen, faculties, departments, programs]);

  // Derived dependent lists
  const filteredDepartments = departments.filter(d => !formData.faculty || d.faculty_id === formData.faculty);
  const filteredPrograms = programs.filter(p => !formData.department || p.department_id === formData.department);

  // Validation (keeps your rules)
  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.firstName || !formData.firstName.trim()) newErrors.firstName = 'Student first name is required';
    if (!formData.lastName || !formData.lastName.trim()) newErrors.lastName = 'Student last name is required';
    if (!formData.gender || !formData.gender.trim()) newErrors.gender = 'Gender is required';
    if (!formData.idNumber || !formData.idNumber.trim()) newErrors.idNumber = 'ID number is required';
    else if (!/^\d{6,13}$/.test(formData.idNumber)) newErrors.idNumber = 'Please enter a valid ID number';
    if (!formData.dateOfBirth || !formData.dateOfBirth.trim()) newErrors.dateOfBirth = 'Date of birth is required';

    if (!formData.email || !formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Please enter a valid email address';

    if (!formData.phone || !formData.phone.trim()) newErrors.phone = 'Phone number is required';
    else if (!/^\+?\d{7,15}$/.test(formData.phone)) newErrors.phone = 'Please enter a valid phone number';

    if (!formData.address || !formData.address.trim()) newErrors.address = 'Address is required';

    if (!formData.studentNumber.trim()) newErrors.studentNumber = "Student number is required";

    if (!formData.faculty) newErrors.faculty = 'Faculty is required';
    if (!formData.department) newErrors.department = 'Department is required';
    if (!formData.program) newErrors.program = 'Program is required';

    if (!formData.yearOfStudy || isNaN(Number(formData.yearOfStudy))) newErrors.yearOfStudy = 'Year of study must be a number';

    if (!formData.emergencyContact || !formData.emergencyContact.trim()) newErrors.emergencyContact = 'Emergency contact is required';
    if (!formData.emergencyPhone || !formData.emergencyPhone.trim()) newErrors.emergencyPhone = 'Emergency phone is required';
    else if (!/^\+?\d{7,15}$/.test(formData.emergencyPhone)) newErrors.emergencyPhone = 'Please enter a valid emergency phone number';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // handle changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    // mark email as touched when the user edits the email field so we don't overwrite it later
    if (name === 'email') {
      setEmailTouched(true);
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

    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  }; 

  // Submit: create user/profile/student via RPC (server-side hashing)
  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setErrorBanner(null);
  setSuccessMessage(null);

  if (!validateForm()) return;
  setIsSubmitting(true);

  // detect existing student's PK (try several common prop names)
  const existingStudentId = (student as any)?.studentId ?? (student as any)?.student_id ?? (student as any)?.id ?? null;

  // mapped values used for both create & update
  const selectedProgramId = formData.program || null;
  const generatedPassword = makePasswordFromStudentNumber(formData.studentNumber);

  try {
    // 1) EDIT/UPDATE flow
    if (isEditMode && existingStudentId) {
      // load student to find profile_id
      const { data: studentRow, error: studentRowErr } = await supabase
        .from('students')
        .select('id, profile_id, student_number')
        .eq('id', existingStudentId)
        .maybeSingle();

      if (studentRowErr || !studentRow) {
        console.error('Failed to load student row', studentRowErr);
        setErrorBanner('Failed to load student record for update.');
        setIsSubmitting(false);
        return;
      }
      const profileId = studentRow.profile_id;

      // ensure student number uniqueness (profiles.user_number) excluding this profile
      const { data: dupProfile, error: dupProfileErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_number', formData.studentNumber)
        .neq('id', profileId)
        .limit(1)
        .maybeSingle();

      if (dupProfileErr) {
        console.error('Dup check error (profiles)', dupProfileErr);
        setErrorBanner('Failed to verify student number uniqueness.');
        setIsSubmitting(false);
        return;
      }
      if (dupProfile) {
        setErrorBanner('Student number already exists.');
        setIsSubmitting(false);
        return;
      }

      // 1a) Update profiles (personal/contact fields + address + new personal fields)
      const profileUpdate: any = {
  user_number: formData.studentNumber,
  first_name: formData.firstName || null,
  last_name: formData.lastName || null,
  full_name: `${(formData.firstName || '').trim()} ${(formData.lastName || '').trim()}`.trim() || null,
  phone: formData.phone || null,
  address: formData.address || null,
  date_of_birth: formData.dateOfBirth || null,
  id_number: formData.idNumber || null,
  gender: formData.gender || null,
  marital_status: formData.maritalStatus || null,
  home_language: formData.homeLanguage || null,
  citizenship: formData.citizenship || null
};


      const { data: updatedProfile, error: updateProfileErr } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', profileId)
        .select()
        .maybeSingle();

      if (updateProfileErr) {
        console.error('Failed to update profile', updateProfileErr);
        setErrorBanner(`Failed to update profile: ${updateProfileErr.message}`);
        setIsSubmitting(false);
        return;
      }

      // 1b) Optionally update users.email (users table holds email in your schema)
      if (formData.email && formData.email.trim()) {
        // get user_id from profile (we already have updatedProfile if returned)
        const userId = updatedProfile?.user_id ?? (await supabase.from('profiles').select('user_id').eq('id', profileId).maybeSingle()).data?.user_id;
        if (userId) {
          const { error: updateUserEmailErr } = await supabase
            .from('users')
            .update({ email: formData.email.trim() })
            .eq('id', userId);
          if (updateUserEmailErr) {
            // non-fatal but log it
            console.warn('Failed to update users.email', updateUserEmailErr);
          }
        }
      }

      // 1c) Update students (student-specific fields). Note: do NOT write address here.
      const studentsUpdate: any = {
  student_number: formData.studentNumber,
  program_id: selectedProgramId,
  year_of_study: Number(formData.yearOfStudy),
  emergency_contact_name: formData.emergencyContact || null,
  emergency_contact_phone: formData.emergencyPhone || null
};


      const { data: updatedStudentRow, error: updateStudentErr } = await supabase
  .from('students')
  .update(studentsUpdate)
  .eq('id', existingStudentId)
  .select()
  .maybeSingle();

      if (updateStudentErr) {
        console.error('Failed to update students', updateStudentErr);
        setErrorBanner(`Failed to update student: ${updateStudentErr.message}`);
        setIsSubmitting(false);
        return;
      }

      // Build updated object for UI
      const updatedStudent = {
        ...formData,
        faculty: faculties.find(f => f.id === formData.faculty)?.name ?? formData.faculty,
        department: departments.find(d => d.id === formData.department)?.name ?? formData.department,
        program: programs.find(p => p.id === formData.program)?.name ?? formData.program,
        yearOfStudy: Number(formData.yearOfStudy),
        studentId: updatedStudentRow?.id ?? existingStudentId,
        profileId
      };

      onSave(updatedStudent);
      setSuccessMessage('Student updated successfully.');
      setTimeout(() => { setSuccessMessage(null); onClose(); }, 1200);
      return;
    }

    // 2) CREATE flow (only runs when NOT edit mode)
    // choose email to use (prefer personal entered email)
    const emailToUse = formData.email && formData.email.trim()
      ? formData.email.trim()
      : makeEmailFromStudentNumber(formData.studentNumber);

    const rpcPayload = {
  // core identifiers
  p_student_number: formData.studentNumber,
  p_first_name: formData.firstName,
  p_last_name: formData.lastName,

  // contact
  p_phone: formData.phone || null,
  p_email: emailToUse,

  // personal info (→ profiles)
  p_date_of_birth: formData.dateOfBirth || null,
  p_address: formData.address || null,
  p_id_number: formData.idNumber || null,
  p_gender: formData.gender || null,
  p_marital_status: formData.maritalStatus || null,
  p_home_language: formData.homeLanguage || null,
  p_citizenship: formData.citizenship || null,

  // academic info (→ students)
  p_program_id: selectedProgramId,
  p_year_of_study: Number(formData.yearOfStudy),
  p_emergency_contact: formData.emergencyContact || null,
  p_emergency_phone: formData.emergencyPhone || null,

  // password for user account
  p_plain_password: generatedPassword
};



    const { data: rpcData, error: rpcError } = await supabase.rpc('auth_create_local_student', rpcPayload);

    if (rpcError) {
      console.error('RPC error', rpcError);
      const details = rpcError?.details ? ` — ${rpcError.details}` : '';
      setErrorBanner(`Failed to create student: ${rpcError.message}${details}`);
      setIsSubmitting(false);
      return;
    }

    // verify profile exists (optional) and ensure address + new fields saved on profile
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    const profileId = row?.profile_id ?? null;

    // If RPC didn't insert address or other profile fields for some reason, patch it now (idempotent)
    if (profileId) {
      const profilePatch: any = {
        address: formData.address || null,
        date_of_birth: formData.dateOfBirth || null,
        id_number: formData.idNumber || null,
        gender: formData.gender || null,
        marital_status: formData.maritalStatus || null,
        home_language: formData.homeLanguage || null,
        citizenship: formData.citizenship || null
      };
      // only patch if at least one value present
      try {
        const { error: patchErr } = await supabase
          .from('profiles')
          .update(profilePatch)
          .eq('id', profileId);
        if (patchErr) {
          console.warn('Failed to patch profile after RPC:', patchErr);
        }
      } catch (err) {
        console.warn('Patch profile error (non-fatal)', err);
      }
    }

    // Also try to lookup profile if RPC didn't return it
    let profileCheck: any = null;
    if (!profileId) {
      const { data: pch, error: pchErr } = await supabase
        .from('profiles')
        .select('id, user_id')
        .eq('user_number', formData.studentNumber)
        .maybeSingle();
      if (!pchErr) profileCheck = pch;
    }

    const createdStudent = {
      ...formData,
      faculty: faculties.find(f => f.id === formData.faculty)?.name ?? formData.faculty,
      department: departments.find(d => d.id === formData.department)?.name ?? formData.department,
      program: programs.find(p => p.id === formData.program)?.name ?? formData.program,
      yearOfStudy: Number(formData.yearOfStudy),
      userId: row?.user_id ?? profileCheck?.user_id,
      profileId: row?.profile_id ?? profileCheck?.id,
      studentId: row?.student_id ?? null
    };

    onSave(createdStudent);
    setSuccessMessage('Student created successfully.');
    setTimeout(() => { setSuccessMessage(null); onClose(); }, 1200);
  } catch (err: any) {
    console.error('Unexpected error:', err);
    setErrorBanner(err?.message || 'Unexpected error');
  } finally {
    setIsSubmitting(false);
  }
};




  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Users className="h-6 w-6 text-blue-600" />
            <h3 className="text-xl font-semibold text-gray-900">
              {student ? 'Edit Student' : 'Add New Student'}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Success / Error banners */}
          {successMessage && (
            <div className="mb-4 p-3 rounded-md bg-green-50 border border-green-200 text-green-800 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172 4.707 7.879a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8z" clipRule="evenodd"/></svg>
                <span className="font-medium">{successMessage}</span>
              </div>
            </div>
          )}

          {errorBanner && (
            <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-800 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">{errorBanner}</span>
              </div>
              <button onClick={() => setErrorBanner(null)} type="button" className="text-red-600 underline text-sm">Dismiss</button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Information */}
            <div className="md:col-span-2">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Basic Information
              </h4>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                First Name *
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter first name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Name *
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter last name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gender
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ID Number
              </label>
              <input
                type="text"
                name="idNumber"
                value={formData.idNumber}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter ID number"
              />
              {errors.idNumber && (
                <div className="mt-1 flex items-center text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.idNumber}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Marital Status
              </label>
              <select
                name="maritalStatus"
                value={formData.maritalStatus}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select status</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Home Language
              </label>
              <input
                type="text"
                name="homeLanguage"
                value={formData.homeLanguage}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter home language"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Citizenship
              </label>
              <input
                type="text"
                name="citizenship"
                value={formData.citizenship}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter citizenship"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date of Birth
              </label>
              <input
                type="date"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.dateOfBirth && (
                <div className="mt-1 flex items-center text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.dateOfBirth}
                </div>
              )}
            </div>

            {/* Contact Information */}
            <div className="md:col-span-2 mt-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Mail className="h-5 w-5 mr-2" />
                Contact Information
              </h4>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.email ? 'border-red-300' : 'border-gray-300'}`}
                placeholder="you@personal-email.com"
              />
              {errors.email && (
                <div className="mt-1 flex items-center text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4 mr-1" />{errors.email}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+27 71 234 5678"
              />
              {errors.phone && (
                <div className="mt-1 flex items-center text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4 mr-1" />{errors.phone}
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter home address"
              />
              {errors.address && (
                <div className="mt-1 flex items-center text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4 mr-1" />{errors.address}
                </div>
              )}
            </div>

            {/* Academic Information - DEPENDENT DROPDOWNS */}
            <div className="md:col-span-2 mt-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <BookOpen className="h-5 w-5 mr-2" />
                Academic Information
              </h4>
            </div>

            <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Student Number
      </label>
      <input
        type="text"
        name="studentNumber"
        value={formData.studentNumber}
        onChange={handleInputChange}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="e.g., 202501234"
      />
    </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Faculty</label>
              <select
                name="faculty"
                value={formData.faculty}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.faculty ? 'border-red-300' : 'border-gray-300'}`}
              >
                <option value="">Select Faculty</option>
                {faculties.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              {errors.faculty && (
                <div className="mt-1 flex items-center text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4 mr-1" />{errors.faculty}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
              <select
                name="department"
                value={formData.department}
                onChange={handleInputChange}
                disabled={!formData.faculty}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.department ? 'border-red-300' : 'border-gray-300'} ${!formData.faculty ? 'bg-gray-50' : ''}`}
              >
                <option value="">{formData.faculty ? 'Select Department' : 'Select Faculty first'}</option>
                {filteredDepartments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              {errors.department && (
                <div className="mt-1 flex items-center text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4 mr-1" />{errors.department}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Program</label>
              <select
                name="program"
                value={formData.program}
                onChange={handleInputChange}
                disabled={!formData.department}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.program ? 'border-red-300' : 'border-gray-300'} ${!formData.department ? 'bg-gray-50' : ''}`}
              >
                <option value="">{formData.department ? 'Select Program' : 'Select Department first'}</option>
                {filteredPrograms.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {errors.program && (
                <div className="mt-1 flex items-center text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4 mr-1" />{errors.program}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Year of Study</label>
              <select
                name="yearOfStudy"
                value={formData.yearOfStudy}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>
              {errors.yearOfStudy && (
                <div className="mt-1 flex items-center text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4 mr-1" />{errors.yearOfStudy}
                </div>
              )}
            </div>

            {/* Emergency Contact */}
            <div className="md:col-span-2 mt-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Phone className="h-5 w-5 mr-2" />
                Emergency Contact
              </h4>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Emergency Contact Name</label>
              <input
                type="text"
                name="emergencyContact"
                value={formData.emergencyContact}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter contact name"
              />
              {errors.emergencyContact && (
                <div className="mt-1 flex items-center text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4 mr-1" />{errors.emergencyContact}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Emergency Contact Phone</label>
              <input
                type="tel"
                name="emergencyPhone"
                value={formData.emergencyPhone}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+27 82 123 4567"
              />
              {errors.emergencyPhone && (
                <div className="mt-1 flex items-center text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4 mr-1" />{errors.emergencyPhone}
                </div>
              )}
            </div>

          </div>

          {/* Submit Button */}
          <div className="mt-8 flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => onClose()}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>{isSubmitting ? (isEditMode ? 'Updating...' : 'Registering...') : (isEditMode ? 'Update Student' : 'Register Student')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudentModal;
