// src/components/admin/DepartmentModal.tsx
import React, { useEffect, useState } from 'react';
import {
  Boxes,
  Save,
  X,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface DepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  department?: any;
  onSave: (departmentData: any) => void;
}

type FacultyRow = { id: string; name: string; code?: string };

const DepartmentModal: React.FC<DepartmentModalProps> = ({ isOpen, onClose, department, onSave }) => {
  // DB-backed faculties
  const [faculties, setFaculties] = useState<FacultyRow[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  // current signed-in user id (optional — now not required to save)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    faculty: '', // faculty id
    head: '',
    location: '',
    established: new Date().getFullYear().toString(),
    budget: '',
    status: 'active',
    description: '',
    vision: '',
    mission: '',
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Load faculties from DB
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setIsLoadingMeta(true);
      setMetaError(null);
      try {
        const { data, error } = await supabase.from('faculties').select('id,name,code').order('name');
        if (!mounted) return;
        if (error) throw error;
        setFaculties(data ?? []);
      } catch (err: any) {
        console.error('Failed to load faculties:', err);
        setMetaError(err?.message || 'Failed to load faculties from DB');
      } finally {
        if (mounted) setIsLoadingMeta(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  // detect current user (tries supabase auth session)
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

  // populate when editing / opening; tolerant mapping for faculty (accepts id or name)
  useEffect(() => {
    if (!isOpen) return;

    if (department) {
      const findFacultyId = (val?: string) => {
        if (!val) return '';
        // try id match
        const byId = faculties.find(f => f.id === val);
        if (byId) return byId.id;
        // try name match (case-insensitive)
        const byName = faculties.find(f => f.name?.toLowerCase() === val.toLowerCase());
        return byName ? byName.id : '';
      };

      setFormData({
        name: department.name || '',
        code: department.code || '',
        faculty: findFacultyId(department.faculty_id || department.faculty) || '',
        head: department.head || '',
        location: department.location || '',
        established: department.established_year ? String(department.established_year) : (department.established ? String(department.established) : new Date().getFullYear().toString()),
        budget: department.budget != null ? String(department.budget) : '',
        status: department.status || 'active',
        description: department.description || '',
        vision: department.vision || '',
        mission: department.mission || ''
      });
    } else {
      setFormData({
        name: '',
        code: '',
        faculty: '',
        head: '',
        location: '',
        established: new Date().getFullYear().toString(),
        budget: '',
        status: 'active',
        description: '',
        vision: '',
        mission: ''
      });
    }

    setErrors({});
    setErrorBanner(null);
    setSuccessMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department, isOpen, faculties]);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.name.trim()) newErrors.name = 'Department name is required';
    if (!formData.code.trim()) newErrors.code = 'Department code is required';
    else if (formData.code.length > 20) newErrors.code = 'Department code must be 20 characters or less';

    if (!formData.faculty || !formData.faculty.trim()) newErrors.faculty = 'Faculty is required';
    else {
      const found = faculties.find(f => f.id === formData.faculty);
      if (!found) newErrors.faculty = 'Selected faculty is invalid';
    }
    if (formData.budget && isNaN(Number(formData.budget))) newErrors.budget = 'Budget must be a valid number';

    if (formData.established && (isNaN(Number(formData.established)) || Number(formData.established) < 1900 || Number(formData.established) > new Date().getFullYear())) {
      newErrors.established = 'Please enter a valid year';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Creating/updating departments no longer requires a signed in user.
    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrorBanner(null);
    setSuccessMessage(null);

    try {
      const payload: any = {
        faculty_id: formData.faculty,
        name: String(formData.name).trim(),
        code: String(formData.code).trim(),
        location: formData.location || null,
        established_year: formData.established ? Number(formData.established) : null,
        budget: formData.budget === '' ? null : Number(formData.budget),
        status: formData.status || 'active',
        description: formData.description || null,
        vision: formData.vision || null,
        mission: formData.mission || null
      };

      // attach updated_by only when we have a signed-in user
      if (currentUserId) payload.updated_by = currentUserId;

      let res;
      if (department && department.id) {
        // update
        res = await supabase
          .from('departments')
          .update(payload)
          .eq('id', department.id)
          .select()
          .single();
      } else {
        // on create attach created_by only if currentUserId exists
        if (currentUserId) payload.created_by = currentUserId;
        res = await supabase
          .from('departments')
          .insert([payload])
          .select()
          .single();
      }

      if (res.error) {
        console.error('Supabase error saving department:', res.error);
        setErrorBanner(`Failed to save department: ${res.error.message}${res.error.details ? ' — ' + res.error.details : ''}`);
        setIsSubmitting(false);
        return;
      }

      const saved = res.data;

      // Prepare object for parent: map faculty id to name if possible
      const facultyObj = faculties.find(f => f.id === (saved.faculty_id ?? formData.faculty));
      const departmentForParent = {
        id: saved.id,
        name: saved.name,
        code: saved.code,
        faculty: facultyObj?.name ?? saved.faculty_id,
        faculty_id: saved.faculty_id,
        email: saved.email,
        phone: saved.phone,
        location: saved.location,
        established_year: saved.established_year,
        budget: saved.budget,
        status: saved.status,
        description: saved.description,
        vision: saved.vision,
        mission: saved.mission
      };

      setSuccessMessage(department ? 'Department updated successfully.' : 'Department created successfully.');
      onSave(departmentForParent);

      // auto-close
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 800);
    } catch (err: any) {
      console.error('Unexpected error saving department:', err);
      setErrorBanner(err?.message || 'Unexpected error while saving department');
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
            <Boxes className="h-6 w-6 text-blue-600" />
            <h3 className="text-xl font-semibold text-gray-900">{department ? 'Edit Department' : 'Add New Department'}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close modal">
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
            {/* Basic Information */}
            <div className="md:col-span-2">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Boxes className="h-5 w-5 mr-2" />
                Basic Information
              </h4>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Department Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name ? 'border-red-300' : 'border-gray-300'}`}
                placeholder="e.g., Computer Science"
              />
              {errors.name && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.name}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Department Code *</label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.code ? 'border-red-300' : 'border-gray-300'}`}
                placeholder="e.g., CS"
                maxLength={20}
              />
              {errors.code && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.code}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Faculty *</label>
              <div className="relative">
                <Boxes className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select name="status" value={formData.status} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe the department's focus, activities, and scope..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Established Year</label>
              <input name="established" value={formData.established} onChange={handleInputChange} type="number" min={1900} max={new Date().getFullYear()} className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.established ? 'border-red-300' : 'border-gray-300'}`} placeholder="e.g., 1995" />
              {errors.established && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.established}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Budget</label>
              <input name="budget" value={formData.budget} onChange={handleInputChange} type="number" min={0} className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.budget ? 'border-red-300' : 'border-gray-300'}`} placeholder="e.g., 100000.00" />
              {errors.budget && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.budget}</div>}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Vision Statement</label>
              <textarea name="vision" value={formData.vision} onChange={handleInputChange} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter the department's vision statement..." />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg flex justify-end space-x-3 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2">
              <Save className="h-4 w-4" />
              <span>{isSubmitting ? (department ? 'Updating...' : 'Saving...') : (department ? 'Update Department' : 'Create Department')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DepartmentModal;
