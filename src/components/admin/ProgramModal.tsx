// src/components/admin/ProgramModal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Building,
  Calendar,
  BookOpen,
  Users,
  Clock,
  DollarSign,
  FileText,
  Save,
  X,
  AlertCircle,
  Boxes
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
  program?: any;
  onSave: (programData: any) => void;
}

type FacultyRow = { id: string; name: string; code?: string };
type DepartmentRow = { id: string; name: string; faculty_id: string; code?: string };

const ProgramModal: React.FC<ProgramModalProps> = ({ isOpen, onClose, program, onSave }) => {
  // DB lists
  const [faculties, setFaculties] = useState<FacultyRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  // current signed-in user id (optional — now *not* required to save)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    faculty: '', // id
    department: '', // id
    level: '',
    duration: '',
    credits: '',
    tuitionFee: '',
    coordinator: '',
    maxStudents: '100',
    applicationDeadline: '',
    startDate: '',
    accreditation: '',
    deliveryMode: 'Full-time',
    status: 'active',
    description: '',
    admissionRequirements: '',
    careerProspects: '',
    vision: '',
    mission: '',
    enrolledStudents: 0,
    established: new Date().getFullYear().toString()
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // reference lists that remain local-ish
  const programLevels = useMemo(
    () => [
      'Certificate',
      'Higher Certificate',
      'Diploma',
      'Advanced Diploma',
      "Bachelor's Degree",
      "Bachelor's Honours",
      'Postgraduate Diploma',
      "Master's Degree",
      'Doctoral Degree'
    ],
    []
  );
  const deliveryModes = useMemo(() => ['Full-time', 'Part-time', 'Distance Learning', 'Online', 'Blended', 'Block Release'], []);

  // load faculties & departments from DB
  useEffect(() => {
    let mounted = true;
    const loadMeta = async () => {
      setIsLoadingMeta(true);
      setMetaError(null);
      try {
        const [fRes, dRes] = await Promise.all([
          supabase.from('faculties').select('id,name,code').order('name'),
          supabase.from('departments').select('id,name,faculty_id,code').order('name')
        ]);

        if (!mounted) return;

        if (fRes.error) throw fRes.error;
        if (dRes.error) throw dRes.error;

        setFaculties(fRes.data ?? []);
        setDepartments(dRes.data ?? []);
      } catch (err: any) {
        console.error('Failed to load program meta:', err);
        setMetaError(err?.message || 'Failed to load metadata from DB');
      } finally {
        if (mounted) setIsLoadingMeta(false);
      }
    };

    loadMeta();
    return () => { mounted = false; };
  }, []);

  // robust current user detection (supabase auth session or localStorage fallback)
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

  // populate form when editing or opening
  useEffect(() => {
    if (!isOpen) return;

    if (program) {
      // tolerant mapping if program has names rather than ids
      const findFacultyId = (val?: string) => {
        if (!val) return '';
        const byId = faculties.find(f => f.id === val);
        if (byId) return byId.id;
        const byName = faculties.find(f => f.name?.toLowerCase() === val.toLowerCase());
        return byName ? byName.id : '';
      };
      const findDepartmentId = (val?: string) => {
        if (!val) return '';
        const byId = departments.find(d => d.id === val);
        if (byId) return byId.id;
        const byName = departments.find(d => d.name?.toLowerCase() === val.toLowerCase());
        return byName ? byName.id : '';
      };

      setFormData({
        name: program.name || '',
        code: program.code || '',
        faculty: findFacultyId(program.faculty_id || program.faculty) || '',
        department: findDepartmentId(program.department_id || program.department) || '',
        level: program.level || '',
        duration: program.duration || '',
        credits: (program.total_credits ?? program.credits ?? '')?.toString() || '',
        tuitionFee: (program.annual_tuition_fee ?? program.tuitionFee ?? '')?.toString() || '',
        coordinator: program.coordinator || '',
        maxStudents: (program.max_students ?? program.maxStudents ?? 100)?.toString(),
        applicationDeadline: program.application_deadline ? String(program.application_deadline).slice(0,10) : '',
        startDate: program.start_date ? String(program.start_date).slice(0,10) : '',
        accreditation: program.accreditation || '',
        deliveryMode: program.delivery_mode || 'Full-time',
        status: program.status || 'active',
        description: program.description || '',
        admissionRequirements: program.admission_requirements || program.admissionRequirements || '',
        careerProspects: program.career_prospects || program.careerProspects || '',
        vision: program.vision || '',
        mission: program.mission || '',
        enrolledStudents: program.enrolled_students ?? program.enrolledStudents ?? 0,
        established: (program.established_year ?? program.established ?? new Date().getFullYear()).toString()
      });
    } else {
      // reset
      setFormData({
        name: '',
        code: '',
        faculty: '',
        department: '',
        level: '',
        duration: '',
        credits: '',
        tuitionFee: '',
        coordinator: '',
        maxStudents: '100',
        applicationDeadline: '',
        startDate: '',
        accreditation: '',
        deliveryMode: 'Full-time',
        status: 'active',
        description: '',
        admissionRequirements: '',
        careerProspects: '',
        vision: '',
        mission: '',
        enrolledStudents: 0,
        established: new Date().getFullYear().toString()
      });
    }

    setErrors({});
    setErrorBanner(null);
    setSuccessMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program, isOpen, faculties, departments]);

  // filtered departments
  const filteredDepartments = useMemo(() => departments.filter(d => !formData.faculty || d.faculty_id === formData.faculty), [departments, formData.faculty]);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.name.trim()) newErrors.name = 'Program name is required';
    if (!formData.code.trim()) newErrors.code = 'Program code is required';
    else if (formData.code.length > 50) newErrors.code = 'Program code must be 50 characters or less';

    if (!formData.faculty || !formData.faculty.trim()) newErrors.faculty = 'Faculty is required';
    if (!formData.department || !formData.department.trim()) newErrors.department = 'Department is required';
    else {
      const dep = departments.find(d => d.id === formData.department);
      if (!dep) newErrors.department = 'Department must be valid';
      else if (formData.faculty && dep.faculty_id !== formData.faculty) newErrors.department = 'Selected department does not belong to chosen faculty';
    }

    if (!formData.level.trim()) newErrors.level = 'Program level is required';
    if (!formData.duration.trim()) newErrors.duration = 'Duration is required';

    if (formData.credits && isNaN(Number(formData.credits))) newErrors.credits = 'Credits must be a valid number';
    if (formData.tuitionFee && isNaN(Number(formData.tuitionFee))) newErrors.tuitionFee = 'Tuition fee must be a valid number';
    if (formData.maxStudents && (isNaN(Number(formData.maxStudents)) || Number(formData.maxStudents) <= 0)) newErrors.maxStudents = 'Maximum students must be a valid positive number';
    if (formData.established && (isNaN(Number(formData.established)) || Number(formData.established) < 1900 || Number(formData.established) > new Date().getFullYear())) {
      newErrors.established = 'Please enter a valid year';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === 'faculty') {
      setFormData(prev => ({ ...prev, faculty: value, department: '' }));
      setErrors(prev => ({ ...prev, faculty: '', department: '' }));
      return;
    }

    if (name === 'department') {
      setFormData(prev => ({ ...prev, department: value }));
      setErrors(prev => ({ ...prev, department: '' }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // NOTE: Creating/updating programs no longer *requires* a signed in user.
    // If a user is signed in, we will populate created_by/updated_by.
    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrorBanner(null);
    setSuccessMessage(null);

    try {
      // build payload mapped to programs table
      const payload: any = {
        department_id: formData.department,
        faculty_id: formData.faculty,
        name: String(formData.name).trim(),
        code: String(formData.code).trim(),
        level: formData.level || null,
        duration: formData.duration || null,
        total_credits: formData.credits === '' ? null : (Number(formData.credits) || null),
        delivery_mode: formData.deliveryMode || null,
        max_students: formData.maxStudents ? Number(formData.maxStudents) : null,
        annual_tuition_fee: formData.tuitionFee === '' ? null : Number(formData.tuitionFee),
        application_deadline: formData.applicationDeadline || null,
        start_date: formData.startDate || null,
        accreditation: formData.accreditation || null,
        established_year: formData.established ? Number(formData.established) : null,
        status: formData.status || 'active',
        description: formData.description || null,
        admission_requirements: formData.admissionRequirements || null,
        career_prospects: formData.careerProspects || null,
        vision: formData.vision || null,
        mission: formData.mission || null
      };

      // attach updated_by only when we have a signed-in user
      if (currentUserId) payload.updated_by = currentUserId;

      let res;
      if (program && program.id) {
        // update
        res = await supabase
          .from('programs')
          .update(payload)
          .eq('id', program.id)
          .select()
          .single();
      } else {
        // on create attach created_by only if currentUserId exists
        if (currentUserId) payload.created_by = currentUserId;
        res = await supabase
          .from('programs')
          .insert([payload])
          .select()
          .single();
      }

      if (res.error) {
        console.error('Supabase error saving program:', res.error);
        setErrorBanner(`Failed to save program: ${res.error.message}${res.error.details ? ' — ' + res.error.details : ''}`);
        setIsSubmitting(false);
        return;
      }

      const saved = res.data;

      // prepare friendly object for parent
      const facultyObj = faculties.find(f => f.id === formData.faculty);
      const departmentObj = departments.find(d => d.id === formData.department);

      const programForParent = {
        id: saved.id,
        name: saved.name,
        code: saved.code,
        faculty: facultyObj?.name ?? formData.faculty,
        department: departmentObj?.name ?? formData.department,
        level: saved.level,
        duration: saved.duration,
        total_credits: saved.total_credits,
        delivery_mode: saved.delivery_mode,
        max_students: saved.max_students,
        annual_tuition_fee: saved.annual_tuition_fee,
        application_deadline: saved.application_deadline,
        start_date: saved.start_date,
        accreditation: saved.accreditation,
        established_year: saved.established_year,
        status: saved.status,
        description: saved.description,
        admission_requirements: saved.admission_requirements,
        career_prospects: saved.career_prospects,
        vision: saved.vision,
        mission: saved.mission
      };

      setSuccessMessage(program ? 'Program updated successfully.' : 'Program created successfully.');
      onSave(programForParent);

      // auto-close after short delay
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 800);
    } catch (err: any) {
      console.error('Unexpected error saving program:', err);
      setErrorBanner(err?.message || 'Unexpected error while saving program');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Award className="h-6 w-6 text-blue-600" />
            <h3 className="text-xl font-semibold text-gray-900">{program ? 'Edit Program' : 'Add New Program'}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close">
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

          {(errorBanner || metaError) && (
            <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-800 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5" />
                <div className="text-sm">
                  <div>{errorBanner}</div>
                  {metaError && <div className="mt-1 text-xs text-gray-600">Meta load error: {metaError}</div>}
                </div>
              </div>
              <button onClick={() => { setErrorBanner(null); setMetaError(null); }} type="button" className="text-red-600 underline text-sm">Dismiss</button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic */}
            <div className="md:col-span-2">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Award className="h-5 w-5 mr-2" />
                Program Information
              </h4>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Program Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name ? 'border-red-300' : 'border-gray-300'}`}
                placeholder="e.g., Bachelor of Science in Computer Science"
              />
              {errors.name && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.name}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Program Code *</label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.code ? 'border-red-300' : 'border-gray-300'}`}
                placeholder="e.g., BSC-CS"
                maxLength={50}
              />
              {errors.code && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.code}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Faculty *</label>
              <div className="relative">
                <Building className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <select
                  name="faculty"
                  value={formData.faculty}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.faculty ? 'border-red-300' : 'border-gray-300'}`}
                >
                  <option value="">{isLoadingMeta ? 'Loading faculties...' : 'Select Faculty'}</option>
                  {faculties.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              {errors.faculty && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.faculty}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Department *</label>
              <div className="relative">
                <Boxes className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  disabled={!formData.faculty}
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.department ? 'border-red-300' : 'border-gray-300'} ${!formData.faculty ? 'bg-gray-50' : ''}`}
                >
                  <option value="">{formData.faculty ? 'Select Department' : 'Select Faculty first'}</option>
                  {filteredDepartments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              {errors.department && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.department}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Program Level *</label>
              <div className="relative">
                <Award className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <select name="level" value={formData.level} onChange={handleInputChange} className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.level ? 'border-red-300' : 'border-gray-300'}`}>
                  <option value="">Select Level</option>
                  {programLevels.map(level => <option key={level} value={level}>{level}</option>)}
                </select>
              </div>
              {errors.level && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.level}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration *</label>
              <div className="relative">
                <Clock className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input type="text" name="duration" value={formData.duration} onChange={handleInputChange} placeholder="e.g., 3 years" className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.duration ? 'border-red-300' : 'border-gray-300'}`} />
              </div>
              {errors.duration && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.duration}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Total Credits</label>
              <div className="relative">
                <BookOpen className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input type="number" name="credits" value={formData.credits} onChange={handleInputChange} min={0} placeholder="e.g., 480" className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.credits ? 'border-red-300' : 'border-gray-300'}`} />
              </div>
              {errors.credits && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.credits}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Mode</label>
              <select name="deliveryMode" value={formData.deliveryMode} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                {deliveryModes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Maximum Students</label>
              <div className="relative">
                <Users className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input name="maxStudents" value={formData.maxStudents} onChange={handleInputChange} type="number" min={1} className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.maxStudents ? 'border-red-300' : 'border-gray-300'}`} />
              </div>
              {errors.maxStudents && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.maxStudents}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Annual Tuition Fee</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input name="tuitionFee" value={formData.tuitionFee} onChange={handleInputChange} type="number" min={0} placeholder="Enter fee amount" className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.tuitionFee ? 'border-red-300' : 'border-gray-300'}`} />
              </div>
              {errors.tuitionFee && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.tuitionFee}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Application Deadline</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input type="date" name="applicationDeadline" value={formData.applicationDeadline} onChange={handleInputChange} className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Program Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input type="date" name="startDate" value={formData.startDate} onChange={handleInputChange} className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Accreditation</label>
              <input name="accreditation" value={formData.accreditation} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., SAQA, CHE" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Established Year</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input name="established" value={formData.established} onChange={handleInputChange} type="number" min={1900} max={new Date().getFullYear()} placeholder="e.g., 1995" className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.established ? 'border-red-300' : 'border-gray-300'}`} />
              </div>
              {errors.established && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.established}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select name="status" value={formData.status} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Enrolled (if editing) */}
            {program && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Enrolled Students</label>
                <div className="relative">
                  <Users className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  <input name="enrolledStudents" value={String(formData.enrolledStudents)} onChange={handleInputChange} type="number" min={0} className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Program Description</label>
              <textarea name="description" value={formData.description} onChange={handleInputChange} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Describe the program's objectives, curriculum, and learning outcomes..." />
            </div>

            <div className="md:col-span-2 mt-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Additional Details
              </h4>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Admission Requirements</label>
              <textarea name="admissionRequirements" value={formData.admissionRequirements} onChange={handleInputChange} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="List the admission requirements, prerequisites, and qualifications needed..." />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Career Prospects</label>
              <textarea name="careerProspects" value={formData.careerProspects} onChange={handleInputChange} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Describe career opportunities and job prospects for graduates..." />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Vision Statement</label>
              <textarea name="vision" value={formData.vision} onChange={handleInputChange} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter the program's vision statement..." />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={isSubmitting} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2" title={currentUserId ? '' : 'You can create/update without signing in; signed-in users are recorded in created_by/updated_by.'}>
            <Save className="h-4 w-4" />
            <span>{isSubmitting ? (program ? 'Updating...' : 'Saving...') : (program ? 'Update Program' : 'Create Program')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProgramModal;
