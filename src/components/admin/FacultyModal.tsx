import React, { useEffect, useRef, useState } from 'react';
import {
  Building,
  Mail,
  Phone,
  MapPin,
  DollarSign,
  Calendar,
  Save,
  X,
  AlertCircle,
  User
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface FacultyModalProps {
  isOpen: boolean;
  onClose: () => void;
  faculty?: any;
  onSave: (facultyData: any) => void | Promise<void>;
}

const FacultyModal: React.FC<FacultyModalProps> = ({ isOpen, onClose, faculty, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    head: '', // plain text
    email: '',
    phone: '',
    location: '',
    established: new Date().getFullYear().toString(),
    budget: '',
    status: 'active',
    description: '',
    vision: '',
    mission: '',
    students: 0,
    lecturers: 0,
    courses: 0
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // UI banners
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // current signed-in user id (for created_by / updated_by)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // mounted ref to avoid setState on unmounted components
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Avoid double-fetch bookkeeping (optional)
  const coursesFetchedRef = useRef(false);

  // Fetch courses (kept separate so failures here don't interfere with auth detection)
  useEffect(() => {
    let cancelled = false;

    const fetchCourses = async () => {
      try {
        // You can optionally guard here to avoid re-fetches in dev if you really want
        // if (coursesFetchedRef.current) return;

        const { data, error, status } = await supabase
          .from('courses')
          .select(`
            id,
            name,
            code,
            credits,
            semester,
            year_level,
            status,
            program:programs!courses_program_id_fkey (
              id,
              name,
              code,
              level,
              department:departments!programs_department_id_fkey (
                id,
                name,
                code,
                faculty:faculties!departments_faculty_id_fkey (
                  id,
                  name,
                  code
                )
              )
            ),
            lecturer:lecturers!courses_lecturer_id_fkey (
              id,
              lecturer_number,
              position,
              specialization,
              profile:profiles!lecturers_profile_id_fkey (
                full_name
              )
            )
          `);

        if (error) {
          // 404 often means the table/view doesn't exist
          if (status === 404) {
            console.warn('Courses fetch returned 404. Check that the courses table/view and any nested views exist.');
            if (!cancelled && mountedRef.current) {
              setErrorBanner('Some analytics or courses resources are missing (404). Check your DB for missing views/tables.');
            }
          } else {
            console.error('Supabase courses fetch error:', error);
            if (!cancelled && mountedRef.current) {
              setErrorBanner('Failed to fetch courses. Check console for details.');
            }
          }
        } else {
          if (!cancelled) {
            console.log('Courses:', data);
            // if you want to store courses in state, you can set it here
            // setCourses(data ?? []);
          }
        }

        coursesFetchedRef.current = true;
      } catch (err) {
        console.error('Unexpected error fetching courses:', err);
        if (!cancelled && mountedRef.current) setErrorBanner('Unexpected error fetching courses.');
      }
    };

    fetchCourses();

    return () => {
      cancelled = true;
    };
  }, []);

  // Detect current user and listen for auth changes (supports v2 and falls back to v1 and localStorage)
  useEffect(() => {
    let isMounted = true;
    let unsub: (() => void) | null = null;

    const detectUserOnce = async () => {
      try {
        const authAny = (supabase as any).auth;

        // v2: try getSession()
        if (authAny?.getSession) {
          try {
            const ses = await authAny.getSession();
            const maybeUser = ses?.data?.session?.user ?? ses?.data?.user;
            if (maybeUser?.id && isMounted) {
              setCurrentUserId(maybeUser.id);
              return;
            }
          } catch (e) {
            // ignore local getSession error - we'll try other approaches
          }

          // set up listener for changes (v2)
          try {
            if (authAny?.onAuthStateChange) {
              const { data } = authAny.onAuthStateChange((event: any, session: any) => {
                const user = session?.user ?? null;
                if (user && user.id && isMounted) setCurrentUserId(user.id);
                if (!user && isMounted) setCurrentUserId(null);
              });
              unsub = data?.unsubscribe ?? (() => {});
            }
          } catch (e) {
            // ignore listener setup errors
          }
        }

        // v1: getUser()
        if (authAny?.getUser) {
          try {
            const res = await authAny.getUser();
            const maybeUser = res?.data?.user ?? res?.data;
            if (maybeUser?.id && isMounted) {
              setCurrentUserId(maybeUser.id);
              return;
            }
          } catch {
            // ignore
          }
        }

        // older clients: auth.user / auth.session
        try {
          const maybeUser =
            typeof authAny?.user === 'function' ? authAny.user() : authAny?.user;
          if (maybeUser?.id && isMounted) {
            setCurrentUserId(maybeUser.id);
            return;
          }

          const maybeSession =
            typeof authAny?.session === 'function' ? authAny.session() : authAny?.session;
          const sessUser = maybeSession?.user ?? maybeSession?.data?.user;
          if (sessUser?.id && isMounted) {
            setCurrentUserId(sessUser.id);
            return;
          }
        } catch {
          // ignore
        }

        // fallback to localStorage (your Login saves a minimal user object)
        try {
          const raw = localStorage.getItem('user');
          if (raw) {
            const parsed = JSON.parse(raw);
            const fallbackId = parsed?.userId ?? parsed?.user_id ?? parsed?.id ?? null;
            if (fallbackId && isMounted) {
              setCurrentUserId(String(fallbackId));
              return;
            }
          }
        } catch {
          // ignore
        }

        if (isMounted) setCurrentUserId(null);
      } catch (err) {
        console.warn('Error detecting current user id', err);
        if (isMounted) setCurrentUserId(null);
      }
    };

    detectUserOnce();

    return () => {
      isMounted = false;
      if (typeof unsub === 'function') {
        try {
          unsub();
        } catch {}
      }
    };
  }, []);

  // populate when editing / opening
  useEffect(() => {
    if (!isOpen) return;

    if (faculty) {
      setFormData({
        name: faculty.name || '',
        code: faculty.code || '',
        head: faculty.head_name || faculty.head || '',
        email: faculty.email || '',
        phone: faculty.phone || '',
        location: faculty.location || '',
        established: faculty.established_year ? String(faculty.established_year) : (faculty.established ? String(faculty.established) : new Date().getFullYear().toString()),
        budget: (faculty.annual_budget ?? faculty.budget) != null ? String(faculty.annual_budget ?? faculty.budget) : '',
        status: faculty.status || 'active',
        description: faculty.description || '',
        vision: faculty.vision || '',
        mission: faculty.mission || '',
        students: faculty.students != null ? Number(faculty.students) : 0,
        lecturers: faculty.lecturers != null ? Number(faculty.lecturers) : 0,
        courses: faculty.courses != null ? Number(faculty.courses) : 0
      });
    } else {
      setFormData({
        name: '',
        code: '',
        head: '',
        email: '',
        phone: '',
        location: '',
        established: new Date().getFullYear().toString(),
        budget: '',
        status: 'active',
        description: '',
        vision: '',
        mission: '',
        students: 0,
        lecturers: 0,
        courses: 0
      });
    }

    setErrors({});
    setErrorBanner(null);
    setSuccessMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faculty, isOpen]);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.name?.trim()) newErrors.name = 'Faculty name is required';
    if (!formData.code?.trim()) newErrors.code = 'Faculty code is required';
    else if (String(formData.code).length > 40) newErrors.code = 'Faculty code must be 40 characters or less';
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(formData.email))) newErrors.email = 'Please enter a valid email address';
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

  // save to DB + call parent onSave safely
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorBanner(null);
    setSuccessMessage(null);

    if (!currentUserId) {
      setErrorBanner('You must be signed in to create or update faculties.');
      return;
    }

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const payload: any = {
        name: String(formData.name).trim(),
        code: String(formData.code).trim(),
        head_name: formData.head ? String(formData.head).trim() : null,
        email: formData.email ? String(formData.email).trim() : null,
        phone: formData.phone ? String(formData.phone).trim() : null,
        location: formData.location ? String(formData.location).trim() : null,
        established_year: formData.established ? Number(formData.established) : null,
        annual_budget: formData.budget === '' ? null : Number(formData.budget),
        status: formData.status || 'active',
        description: formData.description ? String(formData.description).trim() : null,
        vision: formData.vision ? String(formData.vision).trim() : null,
        mission: formData.mission ? String(formData.mission).trim() : null,
        updated_by: currentUserId
      };

      let saved: any = null;
      if (faculty && faculty.id) {
        const { data, error } = await supabase
          .from('faculties')
          .update(payload)
          .eq('id', faculty.id)
          .select()
          .single();
        if (error) throw error;
        saved = data;
      } else {
        payload.created_by = currentUserId;
        const { data, error } = await supabase
          .from('faculties')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        saved = data;
      }

      // Build normalized object for parent
      const facultyForParent = {
        id: saved.id,
        name: saved.name,
        code: saved.code,
        head_name: saved.head_name ?? saved.head ?? '',
        email: saved.email ?? null,
        phone: saved.phone ?? null,
        location: saved.location ?? null,
        established_year: saved.established_year ?? null,
        annual_budget: saved.annual_budget ?? null,
        status: saved.status ?? 'active',
        description: saved.description ?? null,
        vision: saved.vision ?? null,
        mission: saved.mission ?? null,
        created_by: saved.created_by ?? null,
        updated_by: saved.updated_by ?? null
      };

      // allow parent to be sync or async
      try {
        const maybe = (onSave as any)(facultyForParent);
        if (maybe && typeof maybe.then === 'function') await maybe;
      } catch (parentErr: any) {
        console.error('Parent onSave threw:', parentErr);
        // show a friendly message but do not crash
        setErrorBanner(`Saved to DB but parent handler failed: ${parentErr?.message ?? String(parentErr)}`);
        return;
      }

      if (!mountedRef.current) return;
      setSuccessMessage(faculty ? 'Faculty updated successfully.' : 'Faculty created successfully.');

      // brief success display then close (avoid calling setState after unmount)
      setTimeout(() => {
        if (!mountedRef.current) return;
        try {
          onClose();
        } catch (err) {
          console.error('Error calling onClose():', err);
        }
      }, 700);
    } catch (err: any) {
      console.error('Error saving faculty:', err);
      // supabase error objects often have message/details
      const msg = err?.message ?? (err?.error ? String(err.error) : String(err));
      setErrorBanner(`Failed to save faculty: ${msg}`);
    } finally {
      if (mountedRef.current) setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Building className="h-6 w-6 text-blue-600" />
            <h3 className="text-xl font-semibold text-gray-900">{faculty ? 'Edit Faculty' : 'Add New Faculty'}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6" noValidate>
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
                <div className="text-sm">{errorBanner}</div>
              </div>
              <button type="button" onClick={() => setErrorBanner(null)} className="text-red-600 underline text-sm">Dismiss</button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic info */}
            <div className="md:col-span-2">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center"><Building className="h-5 w-5 mr-2" />Basic Information</h4>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Faculty Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name ?? ''}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name ? 'border-red-300' : 'border-gray-300'}`}
                placeholder="e.g., Faculty of Natural & Applied Sciences"
                required
              />
              {errors.name && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.name}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Faculty Code *</label>
              <input
                type="text"
                name="code"
                value={formData.code ?? ''}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.code ? 'border-red-300' : 'border-gray-300'}`}
                placeholder="e.g., NAS"
                maxLength={40}
                required
              />
              {errors.code && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.code}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Faculty Head</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input
                  name="head"
                  value={formData.head ?? ''}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.head ? 'border-red-300' : 'border-gray-300'}`}
                  placeholder="e.g., Prof. Jane Doe"
                />
              </div>
              {errors.head && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.head}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select name="status" value={formData.status ?? 'active'} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Contact */}
            <div className="md:col-span-2 mt-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center"><Mail className="h-5 w-5 mr-2" />Contact Information</h4>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input type="email" name="email" value={formData.email ?? ''} onChange={handleInputChange} className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.email ? 'border-red-300' : 'border-gray-300'}`} placeholder="faculty@university.edu" />
              </div>
              {errors.email && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.email}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input type="tel" name="phone" value={formData.phone ?? ''} onChange={handleInputChange} className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="+1 (555) 123-4567" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input type="text" name="location" value={formData.location ?? ''} onChange={handleInputChange} className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., Administration Building, 2nd Floor" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Established Year</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input type="number" name="established" value={formData.established ?? ''} onChange={handleInputChange} min={1900} max={new Date().getFullYear()} className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.established ? 'border-red-300' : 'border-gray-300'}`} placeholder="e.g., 1995" />
              </div>
              {errors.established && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.established}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Annual Budget</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input type="number" name="budget" value={formData.budget ?? ''} onChange={handleInputChange} className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.budget ? 'border-red-300' : 'border-gray-300'}`} placeholder="e.g., 100000.00" />
              </div>
              {errors.budget && <div className="mt-1 flex items-center text-red-600 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{errors.budget}</div>}
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea name="description" value={formData.description ?? ''} onChange={handleInputChange} rows={3} maxLength={4000} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Describe the faculty's focus, activities, and scope..." />
            </div>

            {/* Vision */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Vision Statement</label>
              <textarea name="vision" value={formData.vision ?? ''} onChange={handleInputChange} rows={2} maxLength={2000} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter the faculty's vision statement..." />
            </div>

            {/* Mission */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Mission Statement</label>
              <textarea name="mission" value={formData.mission ?? ''} onChange={handleInputChange} rows={2} maxLength={2000} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter the faculty's mission statement..." />
            </div>

          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={isSubmitting || !currentUserId} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2" title={!currentUserId ? 'Sign in to create or update faculties' : ''}>
            <Save className="h-4 w-4" />
            <span>{isSubmitting ? (faculty ? 'Updating...' : 'Saving...') : (faculty ? 'Update Faculty' : 'Create Faculty')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FacultyModal;
