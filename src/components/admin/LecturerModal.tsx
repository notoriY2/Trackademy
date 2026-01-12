// src/components/admin/LecturerModal.tsx
import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Award,
  Calendar,
  BookOpen,
  Save,
  X,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface FacultyRow { id: string; name: string; code?: string }

interface LecturerModalProps {
  isOpen: boolean;
  onClose: () => void;
  lecturer?: any; // incoming prop may be partial (from localStorage / parent list)
  onSave: (lecturerData: any) => void;
}

const LECTURER_FAC_TABLE = 'lecturer_faculties'; // matches the CREATE TABLE you provided
const uuidRegex = /^[0-9a-fA-F-]{36}$/;

const LecturerModal: React.FC<LecturerModalProps> = ({ isOpen, onClose, lecturer, onSave }) => {
  // fetched faculties (from DB)
  const [facultiesFromDb, setFacultiesFromDb] = useState<FacultyRow[]>([]);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);

  // fetched authoritative lecturer (when editing)
  const [fetchedLecturer, setFetchedLecturer] = useState<any | null>(null);

  const [formData, setFormData] = useState<any>({
    firstName: '',
    lastName: '',
    lecturerNumber: '',
    email: '',
    phone: '',
    faculties: [] as string[], // store faculty ids (uuid)
    position: '',
    qualification: '',
    specialization: '',
    officeLocation: '',
    startDate: '',
    status: 'active',
    courses: 0,
    students: 0,
    experience: '',
    researchAreas: '',
    publications: 0
  });

  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // UI banners
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // local mode + email touched tracking
  const [isEditMode, setIsEditMode] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  const positions = [
    'Assistant Lecturer',
    'Lecturer',
    'Senior Lecturer',
    'Associate Professor',
    'Professor',
    'Head of Department',
    'Dean'
  ];

  const qualifications = [
    "Bachelor's Degree",
    "Master's Degree",
    'PhD',
    'Post-Doctoral',
    'Professional Certification'
  ];

  // fetch faculties from DB once
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setIsLoadingMeta(true);
      setMetaError(null);
      try {
        const { data, error } = await supabase
          .from('faculties')
          .select('id,name,code')
          .order('name');

        if (error) throw error;
        if (!mounted) return;
        setFacultiesFromDb(data ?? []);
      } catch (err: any) {
        console.error('Failed to load faculties', err);
        setMetaError(err?.message || 'Failed to load faculties');
      } finally {
        if (mounted) setIsLoadingMeta(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  // helper to resolve faculty id
  const findFacultyIdByNameOrId = (s?: string) => {
    if (!s) return '';
    if (facultiesFromDb.some(f => f.id === s)) return s;
    const found = facultiesFromDb.find(f => f.name.toLowerCase() === String(s).toLowerCase());
    return found ? found.id : '';
  };

  // helper: normalize many shapes of incoming lecturer.faculties
  const normalizeLecturerFaculties = (raw: any): string[] => {
    if (!raw) return [];
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      // try parse JSON array
      if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || trimmed.includes('","')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) raw = parsed;
        } catch (e) {
          // fallback: comma-separated
          return trimmed.split(',').map(s => s.trim()).filter(Boolean);
        }
      } else {
        // comma-separated fallback
        return trimmed.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    if (Array.isArray(raw)) {
      return raw.map(item => {
        if (!item) return '';
        if (typeof item === 'string') return item;
        if (typeof item === 'object') {
          return item.id ?? item.value ?? item.name ?? '';
        }
        return String(item);
      }).filter(Boolean);
    }
    if (typeof raw === 'object') {
      return [raw.id ?? raw.name ?? ''].filter(Boolean);
    }
    return [];
  };

  // Fetch authoritative lecturer + profile + user email + faculty relations when opening modal
  useEffect(() => {
    // set edit mode early so auto-fill doesn't run while we fetch
    setIsEditMode(!!lecturer);

    if (!isOpen) {
      setFetchedLecturer(null);
      return;
    }

    if (!lecturer) {
      // create mode -> reset
      setFormData({
        firstName: '',
        lastName: '',
        lecturerNumber: '',
        email: '',
        phone: '',
        faculties: [] as string[],
        position: '',
        qualification: '',
        specialization: '',
        officeLocation: '',
        startDate: '',
        status: 'active',
        courses: 0,
        students: 0,
        experience: '',
        researchAreas: '',
        publications: 0
      });
      setErrors({});
      setErrorBanner(null);
      setSuccessMessage(null);
      setEmailTouched(false);
      return;
    }

    let mounted = true;
    const fetchFullLecturer = async () => {
      try {
        // 1) get lecturer with profile
        const { data: fetched, error } = await supabase
          .from('lecturers')
          .select('*, profile:profiles(*)')
          .eq('id', lecturer.id)
          .maybeSingle();

        if (error) {
          console.warn('[LecturerModal] fetchFullLecturer - lecturers select failed:', error);
          // fallback to using provided lecturer prop
        }

        // 2) fetch faculty relations (junction table) if available
        let facultyIds: string[] = [];
        if (fetched && fetched.id) {
          try {
            const { data: lfRows, error: lfErr } = await supabase
              .from(LECTURER_FAC_TABLE)
              .select('faculty_id')
              .eq('lecturer_id', fetched.id);

            if (!lfErr && Array.isArray(lfRows)) {
              facultyIds = lfRows.map((r: any) => r.faculty_id).filter(Boolean);
            }
          } catch (e) {
            // ignore - permissions or table missing
            console.debug('[LecturerModal] lecturer_faculties fetch ignored:', e);
          }
        }

        // 3) fetch user email if we have profile.user_id
        let userEmail = '';
        const source = fetched ?? lecturer;
        const profileUserId = fetched?.profile?.user_id ?? source?.profile?.user_id ?? source?.profile_user_id ?? null;
        if (profileUserId) {
          try {
            const { data: userRow, error: userErr } = await supabase
              .from('users')
              .select('email')
              .eq('id', profileUserId)
              .maybeSingle();
            if (!userErr && userRow?.email) {
              userEmail = userRow.email;
            }
          } catch (e) {
            console.debug('[LecturerModal] users.email fetch ignored:', e);
          }
        }

        // 4) derive names, phone and faculties
        const phone =
          fetched?.profile?.phone ??
          source?.profile?.phone ??
          source?.phone ??
          source?.phone_number ??
          source?.phoneNumber ??
          '';

        const firstName =
          fetched?.profile?.first_name ??
          source?.profile?.first_name ??
          source?.firstName ??
          source?.first_name ??
          (source?.profile?.full_name ? String(source.profile.full_name).split(' ')[0] : '') ??
          '';

        const lastName =
          fetched?.profile?.last_name ??
          source?.profile?.last_name ??
          source?.lastName ??
          source?.last_name ??
          (source?.profile?.full_name ? String(source.profile.full_name).split(' ').slice(1).join(' ') : '') ??
          '';

        // prefer explicit junction table facultyIds; otherwise normalize from source
        const rawFacs = facultyIds.length
          ? facultyIds
          : normalizeLecturerFaculties(source?.faculties ?? source?.profile?.faculties ?? source?.faculty_ids ?? []);

        // resolve names -> ids when needed
        const resolvedFacultyIds: string[] = [];
        rawFacs.forEach((f: string) => {
          const resolved = findFacultyIdByNameOrId(f);
          if (resolved) resolvedFacultyIds.push(resolved);
        });

        if (!mounted) return;

        setFetchedLecturer(fetched ?? lecturer);

        setFormData({
          firstName: firstName || '',
          lastName: lastName || '',
          lecturerNumber: source?.lecturer_number ?? source?.lecturerNumber ?? source?.profile?.user_number ?? '',
          // prefer actual user email (personal) if available, else leave blank so user can enter personal email
          email: userEmail || source?.email || '',
          phone,
          faculties: resolvedFacultyIds,
          position: source?.position ?? '',
          qualification: source?.qualification ?? '',
          specialization: source?.specialization ?? '',
          officeLocation: source?.office_location ?? source?.officeLocation ?? '',
          startDate: source?.start_date ? String(source.start_date).slice(0,10) : (source?.startDate || ''),
          status: source?.status ?? 'active',
          courses: source?.courses ?? 0,
          students: source?.students ?? 0,
          experience: source?.experience ?? '',
          researchAreas: source?.research_areas ?? source?.researchAreas ?? '',
          publications: source?.publications_count ?? source?.publications ?? 0
        });

        // because we set a real personal email from users table (when available),
        // mark emailTouched so the create-mode auto-email-filler won't overwrite it.
        setEmailTouched(!!userEmail);

        setIsEditMode(true);
        setErrors({});
        setErrorBanner(null);
        setSuccessMessage(null);
      } catch (err) {
        console.error('[LecturerModal] fetchFullLecturer unexpected', err);
      }
    };

    fetchFullLecturer();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, lecturer, facultiesFromDb]);

  // Auto-fill email from lecturer number only in CREATE mode and only if user hasn't touched email
  useEffect(() => {
    if (isEditMode) return; // don't auto-fill when editing
    if (emailTouched) return;

    if (!formData.email || formData.email.trim() === '') {
      const newEmail = makeEmailFromLecturerNumber(formData.lecturerNumber);
      setFormData((prev: any) => ({ ...prev, email: newEmail }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.lecturerNumber, isEditMode, emailTouched]);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.firstName || !String(formData.firstName).trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName || !String(formData.lastName).trim()) newErrors.lastName = 'Last name is required';

    if (!formData.lecturerNumber || !String(formData.lecturerNumber).trim()) newErrors.lecturerNumber = 'Lecturer number is required';
    else if (String(formData.lecturerNumber).length > 32) newErrors.lecturerNumber = 'Lecturer number must be 32 characters or less';

    if (!Array.isArray(formData.faculties) || formData.faculties.length === 0) newErrors.faculties = 'At least one faculty must be selected';

    if (!formData.position || !String(formData.position).trim()) newErrors.position = 'Position is required';
    if (!formData.qualification || !String(formData.qualification).trim()) newErrors.qualification = 'Qualification is required';

    if (formData.email && String(formData.email).trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(formData.email))) newErrors.email = 'Please enter a valid email address';
    }

    if (formData.phone && String(formData.phone).trim()) {
      if (!/^\+?\d{7,15}$/.test(String(formData.phone))) newErrors.phone = 'Please enter a valid phone number';
    }

    if (formData.startDate && String(formData.startDate).trim()) {
      const parsed = Date.parse(String(formData.startDate));
      if (isNaN(parsed)) newErrors.startDate = 'Please enter a valid start date';
    }

    if (formData.status && !['active','inactive','on_leave'].includes(String(formData.status))) newErrors.status = 'Invalid status';

    const numericChecks: Array<{ key: string; value: any; label: string }> = [
      { key: 'courses', value: formData.courses, label: 'Courses' },
      { key: 'students', value: formData.students, label: 'Students' },
      { key: 'publications', value: formData.publications, label: 'Publications' }
    ];
    numericChecks.forEach(check => {
      if (check.value === '' || check.value === null || check.value === undefined) return;
      const num = Number(check.value);
      if (Number.isNaN(num) || !Number.isInteger(num) || num < 0) newErrors[check.key] = `${check.label} must be a whole number ≥ 0`;
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const numericKeys = ['courses','students','publications'];

    if (name === 'email') setEmailTouched(true);

    setFormData((prev: any) => ({
      ...prev,
      [name]: numericKeys.includes(name) ? (value === '' ? '' : Number(value)) : value
    }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleFacultyToggle = (facultyIdOrName: string) => {
    setFormData((prev: any) => {
      const prevFacs: string[] = Array.isArray(prev.faculties) ? prev.faculties.slice() : [];
      const idx = prevFacs.indexOf(facultyIdOrName);
      if (idx >= 0) {
        prevFacs.splice(idx, 1);
      } else {
        prevFacs.push(facultyIdOrName);
      }
      return { ...prev, faculties: prevFacs };
    });
    if (errors.faculties) setErrors(prev => ({ ...prev, faculties: '' }));
  };

  const makeEmailFromLecturerNumber = (ln: string) => {
    if (!ln) return '';
    return `${ln.toLowerCase()}@spu.ac.za`;
  };

  const makePasswordFromLecturerNumber = (ln: string) => {
    if (!ln) return '';
    return `${ln}@spu123`;
  };

  // Sync lecturer -> faculties junction table (safe no-op if table missing)
  const syncLecturerFaculties = async (lecturerId: string, newFacultyIds: string[]) => {
    if (!lecturerId) return;
    if (!Array.isArray(newFacultyIds)) newFacultyIds = [];

    // head-check
    try {
      const { error: headErr } = await supabase
        .from(LECTURER_FAC_TABLE)
        .select('lecturer_id')
        .limit(1);

      if (headErr) {
        console.debug('[LecturerModal] junction table not available, skipping faculty sync:', headErr.message);
        return;
      }
    } catch (e) {
      console.debug('[LecturerModal] junction table head-check failed (skip sync)', e);
      return;
    }

    try {
      const { data: existingRows, error: existingErr } = await supabase
        .from(LECTURER_FAC_TABLE)
        .select('id,faculty_id')
        .eq('lecturer_id', lecturerId);

      if (existingErr) {
        console.warn('[LecturerModal] failed reading lecturer_faculties:', existingErr);
        return;
      }

      const existingIds = Array.isArray(existingRows) ? existingRows.map((r: any) => r.faculty_id) : [];

      const toAdd = newFacultyIds.filter((id: string) => id && !existingIds.includes(id));
      const toRemove = existingRows
        .filter((r: any) => r && r.faculty_id && !newFacultyIds.includes(r.faculty_id))
        .map((r: any) => r.id);

      if (toRemove.length) {
        await supabase
          .from(LECTURER_FAC_TABLE)
          .delete()
          .in('id', toRemove);
      }

      if (toAdd.length) {
        const inserts = toAdd.map(fid => ({ lecturer_id: lecturerId, faculty_id: fid, created_at: new Date().toISOString() }));
        await supabase
          .from(LECTURER_FAC_TABLE)
          .insert(inserts);
      }

      console.debug('[LecturerModal] faculty sync complete', { toAdd, toRemove });
    } catch (err) {
      console.error('[LecturerModal] syncLecturerFaculties unexpected', err);
    }
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorBanner(null);

    try {
      // Duplicate-check
      if (!isEditMode) {
        const { data: existing, error: existingErr } = await supabase
          .from('lecturers')
          .select('id, lecturer_number')
          .eq('lecturer_number', formData.lecturerNumber)
          .maybeSingle();

        if (existingErr) {
          console.error('[LecturerModal] duplicate-check error:', existingErr);
          setErrorBanner(`Failed to check existing lecturer number: ${existingErr.message}`);
          setIsSubmitting(false);
          return;
        }
        if (existing) {
          setErrorBanner(`Lecturer number "${formData.lecturerNumber}" already exists (id=${existing.id}).`);
          setIsSubmitting(false);
          return;
        }
      } else {
        const originalNumber = fetchedLecturer?.lecturer_number ?? lecturer?.lecturer_number ?? lecturer?.lecturerNumber;
        if (String(formData.lecturerNumber) !== String(originalNumber)) {
          let q: any = supabase
            .from('lecturers')
            .select('id, lecturer_number')
            .eq('lecturer_number', formData.lecturerNumber);
          if (fetchedLecturer?.id) q = q.neq('id', fetchedLecturer.id);
          const { data: existing, error: existingErr } = await q.maybeSingle();

          if (existingErr) {
            console.error('[LecturerModal] duplicate-check error (edit):', existingErr);
            setErrorBanner(`Failed to check existing lecturer number: ${existingErr.message}`);
            setIsSubmitting(false);
            return;
          }
          if (existing) {
            setErrorBanner(`Lecturer number "${formData.lecturerNumber}" already exists (id=${existing.id}).`);
            setIsSubmitting(false);
            return;
          }
        }
      }

      if (isEditMode) {
        // UPDATE profile
        try {
          const profileId = fetchedLecturer?.profile?.id ?? fetchedLecturer?.profile_id ?? lecturer?.profile_id ?? lecturer?.profile?.id;
          if (!profileId) {
            console.warn('[LecturerModal] No profile_id found on lecturer object; skipping profile update.');
          } else {
            const profileUpdate: any = {
              first_name: formData.firstName || null,
              last_name: formData.lastName || null,
              phone: formData.phone || null,
              full_name: `${formData.firstName || ''} ${formData.lastName || ''}`.trim() || null,
              updated_at: new Date().toISOString()
            };

            const { error: profileErr } = await supabase
              .from('profiles')
              .update(profileUpdate)
              .eq('id', profileId);

            if (profileErr) {
              console.error('[LecturerModal] profiles update error:', profileErr);
              setErrorBanner(`Failed to update profile: ${profileErr.message}`);
              setIsSubmitting(false);
              return;
            }
          }
        } catch (err: any) {
          console.error('[LecturerModal] profile update unexpected error:', err);
          setErrorBanner(`Failed to update profile: ${err?.message ?? String(err)}`);
          setIsSubmitting(false);
          return;
        }

        // UPDATE lecturer row
        try {
          const updatePayload: any = {
            lecturer_number: formData.lecturerNumber,
            position: formData.position || null,
            qualification: formData.qualification || null,
            specialization: formData.specialization || null,
            office_location: formData.officeLocation || null,
            start_date: formData.startDate ? formData.startDate : null,
            status: formData.status || 'active',
            experience: formData.experience || null,
            research_areas: formData.researchAreas || null,
            publications_count: Number(formData.publications) || 0,
            updated_at: new Date().toISOString()
          };

          const { data: updatedLecturerRows, error: updErr } = await supabase
            .from('lecturers')
            .update(updatePayload)
            .eq('id', fetchedLecturer?.id ?? lecturer?.id)
            .select('*');

          if (updErr) {
            console.error('[LecturerModal] lecturers update error:', updErr);
            setErrorBanner(`Failed to update lecturer: ${updErr.message}`);
            setIsSubmitting(false);
            return;
          }

          // sync faculties
          try {
            await syncLecturerFaculties(fetchedLecturer?.id ?? lecturer?.id, formData.faculties);
          } catch (e) {
            console.warn('[LecturerModal] faculty sync failed (non-fatal)', e);
          }
        } catch (err: any) {
          console.error('[LecturerModal] lecturers update unexpected error:', err);
          setErrorBanner(`Failed to update lecturer: ${err?.message ?? String(err)}`);
          setIsSubmitting(false);
          return;
        }

        const savedLecturer = {
          ...formData,
          id: fetchedLecturer?.id ?? lecturer?.id,
          profileId: fetchedLecturer?.profile?.id ?? fetchedLecturer?.profile_id ?? lecturer?.profile_id ?? null
        };

        setSuccessMessage('Lecturer updated successfully.');
        onSave(savedLecturer);
        setTimeout(() => {
          setSuccessMessage(null);
          onClose();
        }, 1200);
      } else {
        // CREATE: call RPC (unchanged)
        const generatedPassword = makePasswordFromLecturerNumber(formData.lecturerNumber);

        const rpcPayload: any = {
          p_lecturer_number: formData.lecturerNumber,
          p_first_name: formData.firstName,
          p_last_name: formData.lastName,
          p_phone: formData.phone || null,
          p_email: formData.email || null,
          p_position: formData.position || null,
          p_qualification: formData.qualification || null,
          p_specialization: formData.specialization || null,
          p_office_location: formData.officeLocation || null,
          p_start_date: formData.startDate ? formData.startDate : null,
          p_status: formData.status || 'active',
          p_experience: formData.experience || null,
          p_research_areas: formData.researchAreas || null,
          p_publications_count: Number(formData.publications) || 0,
          p_plain_password: generatedPassword
        };

        if (Array.isArray(formData.faculties) && formData.faculties.length > 0) {
          const uuids = formData.faculties.filter((f: string) => typeof f === 'string' && uuidRegex.test(f));
          rpcPayload.p_faculty_ids = uuids.length ? uuids : null;
        } else {
          rpcPayload.p_faculty_ids = null;
        }

        const { data: rpcData, error: rpcError } = await supabase.rpc('auth_create_local_lecturer', rpcPayload);

        if (rpcError) {
          const messageParts = [rpcError.message];
          if ((rpcError as any).details) messageParts.push(String((rpcError as any).details));
          if ((rpcError as any).hint) messageParts.push(String((rpcError as any).hint));
          const banner = messageParts.filter(Boolean).join(' — ');
          setErrorBanner(`Failed to create lecturer: ${banner}`);
          console.error('[LecturerModal] rpcError full:', rpcError);
          setIsSubmitting(false);
          return;
        }

        const { data: checkLecturer, error: checkLecturerErr } = await supabase
          .from('lecturers')
          .select('id, profile_id, lecturer_number')
          .eq('lecturer_number', formData.lecturerNumber)
          .maybeSingle();

        if (checkLecturerErr) {
          setErrorBanner(`Created but verification failed: ${checkLecturerErr.message}`);
          setIsSubmitting(false);
          return;
        }

        if (!checkLecturer) {
          setErrorBanner('No lecturer record found after creation. Check SQL function permissions and logs.');
          setIsSubmitting(false);
          return;
        }

        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        const createdLecturer = {
          ...formData,
          id: row?.lecturer_id ?? checkLecturer.id,
          userId: row?.user_id ?? null,
          profileId: row?.profile_id ?? checkLecturer.profile_id ?? null
        };

        // sync faculties on create
        try {
          await syncLecturerFaculties(createdLecturer.id, formData.faculties);
        } catch (e) {
          console.warn('[LecturerModal] faculty sync (create) failed (non-fatal)', e);
        }

        onSave(createdLecturer);
        setSuccessMessage('Lecturer created successfully.');
        setTimeout(() => {
          setSuccessMessage(null);
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      console.error('[LecturerModal] unexpected error:', err);
      const text = err?.message ?? JSON.stringify(err);
      setErrorBanner(`Unexpected error: ${text}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <User className="h-6 w-6 text-blue-600" />
            <h3 className="text-xl font-semibold text-gray-900">
              {lecturer ? 'Edit Lecturer' : 'Add New Lecturer'}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
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

          {errorBanner && (
            <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-800 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">{errorBanner}</span>
              </div>
              <button type="button" onClick={() => setErrorBanner(null)} className="text-red-600 underline text-sm">Dismiss</button>
            </div>
          )}

          {/* body of form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Info */}
            <div className="md:col-span-2">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <User className="h-5 w-5 mr-2" />
                Basic Information
              </h4>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                required
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.firstName ? 'border-red-300' : 'border-gray-300'}`}
                placeholder="Enter first name"
              />
              {errors.firstName && <div className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 mr-1" />{errors.firstName}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                required
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.lastName ? 'border-red-300' : 'border-gray-300'}`}
                placeholder="Enter last name"
              />
              {errors.lastName && <div className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 mr-1" />{errors.lastName}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Lecturer Number *</label>
              <input
                type="text"
                name="lecturerNumber"
                value={formData.lecturerNumber}
                onChange={handleInputChange}
                required
                maxLength={32}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.lecturerNumber ? 'border-red-300' : 'border-gray-300'}`}
                placeholder="e.g., LEC001"
              />
              {errors.lecturerNumber && <div className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 mr-1" />{errors.lecturerNumber}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.email ? 'border-red-300' : 'border-gray-300'}`}
                  placeholder="personal@example.com"
                />
              </div>
              {errors.email && <div className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 mr-1" />{errors.email}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {errors.phone && <div className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 mr-1" />{errors.phone}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Office Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="officeLocation"
                  value={formData.officeLocation}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Professional Information */}
            <div className="md:col-span-2 mt-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <BookOpen className="h-5 w-5 mr-2" />
                Professional Information
              </h4>
            </div>

            {/* Faculties */}
            <div className={`md:col-span-2 border rounded-lg p-3 max-h-40 overflow-y-auto ${errors.faculties ? 'border-red-300' : 'border-gray-300'}`}>
              <label className="block text-sm font-medium text-gray-700 mb-2">Faculties *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {isLoadingMeta && <div className="text-sm text-gray-500">Loading faculties...</div>}
                {!isLoadingMeta && facultiesFromDb.length === 0 && <div className="text-sm text-gray-500">No faculties found</div>}
                {facultiesFromDb.map(f => {
                  const checked = Array.isArray(formData.faculties) && formData.faculties.includes(f.id);
                  return (
                    <label key={f.id} className="flex items-center space-x-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleFacultyToggle(f.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span>{f.name}</span>
                    </label>
                  );
                })}
              </div>
              {errors.faculties && <div className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 mr-1" />{errors.faculties}</div>}
              <p className="text-xs text-gray-500 mt-2">Select one or more faculties</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Position *</label>
              <select
                name="position"
                value={formData.position}
                onChange={handleInputChange}
                required
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.position ? 'border-red-300' : 'border-gray-300'}`}
              >
                <option value="">Select Position</option>
                {positions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              {errors.position && <div className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 mr-1" />{errors.position}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Highest Qualification *</label>
              <div className="relative">
                <Award className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <select
                  name="qualification"
                  value={formData.qualification}
                  onChange={handleInputChange}
                  required
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.qualification ? 'border-red-300' : 'border-gray-300'}`}
                >
                  <option value="">Select Qualification</option>
                  {qualifications.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
              {errors.qualification && <div className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 mr-1" />{errors.qualification}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Specialization</label>
              <input type="text" name="specialization" value={formData.specialization} onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., Machine Learning" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input type="date" name="startDate" value={formData.startDate} onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {errors.startDate && <div className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 mr-1" />{errors.startDate}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select name="status" value={formData.status} onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on_leave">On Leave</option>
              </select>
              {errors.status && <div className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 mr-1" />{errors.status}</div>}
            </div>

            {/* Additional Info */}
            <div className="md:col-span-2 mt-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h4>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Experience</label>
              <textarea name="experience" value={formData.experience} onChange={handleInputChange} rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Research Areas</label>
              <textarea name="researchAreas" value={formData.researchAreas} onChange={handleInputChange} rows={2}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* submit */}
          <div className="mt-8 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2">
              <Save className="h-4 w-4" />
              <span>{isSubmitting ? (lecturer ? 'Updating...' : 'Saving...') : (lecturer ? 'Update Lecturer' : 'Create Lecturer')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LecturerModal;
