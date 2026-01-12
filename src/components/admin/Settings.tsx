// src/components/admin/Settings.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Settings as SettingsIcon,
  ArrowLeft,
  Save,
  UserCog,
  Globe,
  BookOpen,
  Shield,
  Database
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

type InstitutionRow = {
  id: string;
  institution_name: string;
  institution_code: string;
  academic_year: string;
  default_semester: string | null;
  timezone: string | null;
  language: string | null;
};

type AcademicRow = {
  id: string;
  passing_grade_percent: string | number | null;
  max_credits_per_semester: number | null;
  attendance_requirement_percent: string | number | null;
  exam_eligibility_threshold_percent: string | number | null;
  grading_scale: string | null;
  allow_late_enrollment: boolean | null;
};

const Settings: React.FC = () => {
  const navigate = useNavigate();

  // row ids for each table (null if not present)
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [academicId, setAcademicId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // admin management
  const [adminUserNumber, setAdminUserNumber] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminMessage, setAdminMessage] = useState('');
  const [adminError, setAdminError] = useState('');
  const [currentAdmins, setCurrentAdmins] = useState<any[]>([]);

  // consolidated settings state (no "mock" defaults)
  const [settings, setSettings] = useState({
    general: {
      institutionName: '',
      institutionCode: '',
      academicYear: '',
      defaultSemester: '',
      timezone: '',
      language: ''
    },
    academic: {
      passingGrade: '',
      maxCreditsPerSemester: '',
      attendanceRequirement: '',
      examEligibilityThreshold: '',
      gradingScale: '',
      allowLateEnrollment: false
    },
  });

  // helper: read current user id from localStorage (Login component should set this)
  const getCurrentUserId = (): string | null => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      const u = JSON.parse(raw);
      return u?.userId ?? null;
    } catch {
      return null;
    }
  };

  // load admins (users with role 'admin') with profile join
  const loadAdmins = async () => {
    try {
      const res = await supabase
        .from('users')
        .select('id, email, role, created_at, profiles(first_name,last_name,user_number)')
        .eq('role', 'admin')
        .order('created_at', { ascending: false });

      if ((res as any).error) throw (res as any).error;
      const data = (res as any).data || [];
      setCurrentAdmins(data);
    } catch (err: any) {
      console.error('Error loading admins:', err);
    }
  };

  // load rows from each settings table
  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    const loadAll = async () => {
      try {
        const [
          instRes,
          acadRes
        ] = await Promise.all([
          supabase.from('institution_settings').select('*').limit(1),
          supabase.from('academic_policies').select('*').limit(1)
        ]);

        if (!mounted) return;

        const instError = (instRes as any).error;
        const acadError = (acadRes as any).error;


        const instData = (instRes as any).data as InstitutionRow[] | null;
        const acadData = (acadRes as any).data as AcademicRow[] | null;

        if (Array.isArray(instData) && instData.length > 0) {
          const r = instData[0];
          setInstitutionId(r.id);
          setSettings(prev => ({
            ...prev,
            general: {
              institutionName: r.institution_name ?? '',
              institutionCode: r.institution_code ?? '',
              academicYear: r.academic_year ?? '',
              defaultSemester: r.default_semester ?? '',
              timezone: r.timezone ?? '',
              language: r.language ?? ''
            }
          }));
        }

        if (Array.isArray(acadData) && acadData.length > 0) {
          const r = acadData[0];
          setAcademicId(r.id);
          setSettings(prev => ({
            ...prev,
            academic: {
              passingGrade: r.passing_grade_percent != null ? String(r.passing_grade_percent) : '',
              maxCreditsPerSemester: r.max_credits_per_semester != null ? String(r.max_credits_per_semester) : '',
              attendanceRequirement: r.attendance_requirement_percent != null ? String(r.attendance_requirement_percent) : '',
              examEligibilityThreshold: r.exam_eligibility_threshold_percent != null ? String(r.exam_eligibility_threshold_percent) : '',
              gradingScale: r.grading_scale ?? '',
              allowLateEnrollment: !!r.allow_late_enrollment
            }
          }));
        }
        // load admin users
        await loadAdmins();
      } catch (err: any) {
        console.error('Unexpected error loading settings:', err);
        if (mounted) setErrorMessage('Unexpected error loading settings.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadAll();

    return () => {
      mounted = false;
    };
  }, []);

  // generic onChange
  const handleInputChange = (section: string, field: string, value: string | boolean) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...(prev as any)[section],
        [field]: value
      }
    }));
  };

  // validation before save (basic)
  const validateForSave = () => {
    setErrorMessage('');
    const g = settings.general;
    if (!g.institutionName || g.institutionName.trim().length < 2) {
      setErrorMessage('Please provide a valid Institution Name.');
      return false;
    }
    if (!g.institutionCode || g.institutionCode.trim().length < 1) {
      setErrorMessage('Please provide a valid Institution Code.');
      return false;
    }
    // Additional validations can be added here
    return true;
  };

  // persist all sections (update if id exists, insert otherwise)
  const handleSave = async () => {
    if (!validateForSave()) return;

    setIsSaving(true);
    setErrorMessage('');
    setSaveMessage('');

    const userId = getCurrentUserId();

    try {
      // institution_settings
      const instPayload = {
        institution_name: settings.general.institutionName || null,
        institution_code: settings.general.institutionCode || null,
        academic_year: settings.general.academicYear || null,
        default_semester: settings.general.defaultSemester || null,
        timezone: settings.general.timezone || null,
        language: settings.general.language || null,
        updated_by: userId
      };

      if (institutionId) {
        const res = await supabase.from('institution_settings').update(instPayload).eq('id', institutionId).limit(1);
        if ((res as any).error) throw (res as any).error;
      } else {
        const res = await supabase.from('institution_settings').insert({ ...instPayload, created_by: userId }).select().limit(1);
        if ((res as any).error) throw (res as any).error;
        const data = (res as any).data;
        if (Array.isArray(data) && data[0]?.id) setInstitutionId(data[0].id);
      }

      // academic_policies
      const acadPayload = {
        passing_grade_percent: settings.academic.passingGrade === '' ? null : Number(settings.academic.passingGrade),
        max_credits_per_semester: settings.academic.maxCreditsPerSemester === '' ? null : Number(settings.academic.maxCreditsPerSemester),
        attendance_requirement_percent: settings.academic.attendanceRequirement === '' ? null : Number(settings.academic.attendanceRequirement),
        exam_eligibility_threshold_percent: settings.academic.examEligibilityThreshold === '' ? null : Number(settings.academic.examEligibilityThreshold),
        grading_scale: settings.academic.gradingScale || null,
        allow_late_enrollment: !!settings.academic.allowLateEnrollment,
        updated_by: userId
      };

      if (academicId) {
        const res = await supabase.from('academic_policies').update(acadPayload).eq('id', academicId).limit(1);
        if ((res as any).error) throw (res as any).error;
      } else {
        const res = await supabase.from('academic_policies').insert({ ...acadPayload, created_by: userId }).select().limit(1);
        if ((res as any).error) throw (res as any).error;
        const data = (res as any).data;
        if (Array.isArray(data) && data[0]?.id) setAcademicId(data[0].id);
      }
      setSaveMessage('Settings saved successfully.');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err: any) {
      console.error('Save failed', err);
      setErrorMessage(err?.message || 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  // Admin assignment: find profile by user_number then update users.role
  const handleAssignAdmin = async () => {
    setAdminError('');
    setAdminMessage('');

    const userNumber = adminUserNumber.trim();
    if (!userNumber) {
      setAdminError('Please enter a user number.');
      return;
    }

    setAdminLoading(true);
    try {
      // find profile
      const profRes = await supabase.from('profiles').select('user_id,user_number,first_name,last_name').eq('user_number', userNumber).maybeSingle();
      if ((profRes as any).error) throw (profRes as any).error;
      const profile = (profRes as any).data;
      if (!profile) {
        setAdminError('User not found with this user number.');
        return;
      }

      // update user role
      const upd = await supabase.from('users').update({ role: 'admin' }).eq('id', profile.user_id);
      if ((upd as any).error) throw (upd as any).error;

      setAdminMessage(`Successfully assigned admin role to ${userNumber}.`);
      setAdminUserNumber('');
      await loadAdmins();
      setTimeout(() => setAdminMessage(''), 3000);
    } catch (err: any) {
      console.error('Error assigning admin:', err);
      setAdminError(err?.message || 'Failed to assign admin role.');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleRemoveAdmin = async (userId: string, userNumber: string) => {
    if (!window.confirm(`Are you sure you want to remove admin privileges from ${userNumber}?`)) return;

    try {
      const { error } = await supabase.from('users').update({ role: 'student' }).eq('id', userId);
      if (error) throw error;
      setAdminMessage(`Successfully removed admin role from ${userNumber}.`);
      await loadAdmins();
      setTimeout(() => setAdminMessage(''), 3000);
    } catch (err: any) {
      console.error('Error removing admin:', err);
      setAdminError(err?.message || 'Failed to remove admin role.');
    }
  };

  // UI
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="w-full">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center px-4 sm:px-6 lg:px-8">
              <GraduationCap className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-2xl font-bold text-gray-900">Trackademy</span>
              <span className="ml-4 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">Admin</span>
            </div>
            <div className="px-4 sm:px-6 lg:px-8">
              <button
                onClick={() => navigate('/admin-dashboard')}
                className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm">Back to Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="w-full py-8">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <SettingsIcon className="h-8 w-8 text-orange-600" />
              <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
            </div>
            <p className="text-gray-600">Configure  academic policies settings.</p>
          </div>

          {saveMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <p className="text-green-800 font-medium">{saveMessage}</p>
              </div>
            </div>
          )}
          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <p className="text-red-800 font-medium">{errorMessage}</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                {[
                  { id: 'general', name: 'General', icon: Globe },
                  { id: 'academic', name: 'Academic', icon: BookOpen },
                  { id: 'admins', name: 'Admin Management', icon: UserCog }
                ].map(tab => {
                  const Icon = tab.icon;
                  // keep simple local state for active tab
                  return (
                    <TabButton key={tab.id} id={tab.id} icon={Icon} label={tab.name} />
                  );
                })}
              </nav>
            </div>

            <div className="p-6">
              {/* Tab content controlled by internal URL hash (fallback) */}
              <SettingsTabs
                settings={settings}
                onChange={handleInputChange}
                adminState={{
                  adminUserNumber,
                  setAdminUserNumber,
                  adminLoading,
                  adminMessage,
                  adminError,
                  currentAdmins,
                  handleAssignAdmin,
                  handleRemoveAdmin
                }}
              />
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
              <div className="flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={isSaving || isLoading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <Save className="h-4 w-4" />
                  <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white bg-opacity-80 p-4 rounded-lg shadow">
            <div className="text-sm text-gray-700">Loading settings…</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;

/**
 * Small helper components below keep the main component tidy.
 * They are intentionally colocated in this file so you can drop this file in as-is.
 */

function TabButton({ id, icon: Icon, label }: { id: string; icon: any; label: string }) {
  // using hash in URL to persist user's tab choice if they navigate
  const [, setHash] = useState<string>(window.location.hash.slice(1) || 'general');
  const active = (window.location.hash.slice(1) || 'general') === id;

  const onClick = () => {
    window.location.hash = id;
    setHash(id);
    // simple re-render trick
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };

  return (
    <button
      onClick={onClick}
      className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
        active ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

function SettingsTabs({
  settings,
  onChange,
  adminState
}: any) {
  const [activeTab, setActiveTab] = useState<string>(window.location.hash.slice(1) || 'general');

  useEffect(() => {
    const handler = () => setActiveTab(window.location.hash.slice(1) || 'general');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  if (activeTab === 'general') {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900">General Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Institution Name</label>
            <input
              type="text"
              value={settings.general.institutionName}
              onChange={(e) => onChange('general', 'institutionName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder=""
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Institution Code</label>
            <input
              type="text"
              value={settings.general.institutionCode}
              onChange={(e) => onChange('general', 'institutionCode', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder=""
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year</label>
            <input
              type="text"
              value={settings.general.academicYear}
              onChange={(e) => onChange('general', 'academicYear', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 2025-2026"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Semester</label>
            <select
              value={settings.general.defaultSemester}
              onChange={(e) => onChange('general', 'defaultSemester', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select --</option>
              <option value="Semester 1">Semester 1</option>
              <option value="Semester 2">Semester 2</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
            <select
              value={settings.general.timezone}
              onChange={(e) => onChange('general', 'timezone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select --</option>
              <option value="UTC">UTC</option>
              <option value="UTC-5">UTC-5</option>
              <option value="UTC+2">UTC+2</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
            <select
              value={settings.general.language}
              onChange={(e) => onChange('general', 'language', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select --</option>
              <option value="English">English</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
            </select>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'academic') {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900">Academic Policies</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Passing Grade (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={settings.academic.passingGrade}
              onChange={(e) => onChange('academic', 'passingGrade', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Max Credits Per Semester</label>
            <input
              type="number"
              min={0}
              max={100}
              value={settings.academic.maxCreditsPerSemester}
              onChange={(e) => onChange('academic', 'maxCreditsPerSemester', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Exam Eligibility Threshold (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={settings.academic.examEligibilityThreshold}
              onChange={(e) => onChange('academic', 'examEligibilityThreshold', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Grading Scale</label>
            <select
              value={settings.academic.gradingScale}
              onChange={(e) => onChange('academic', 'gradingScale', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select --</option>
              <option value="Percentage">Percentage (0-100)</option>
              <option value="GPA">GPA (0.0-4.0)</option>
              <option value="Letter">Letter (A-F)</option>
            </select>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'admins') {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Admin Management</h3>
          <p className="text-sm text-gray-600">Assign or remove admin privileges using user numbers.</p>
        </div>

        {adminState.adminMessage && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <p className="text-green-800 font-medium">{adminState.adminMessage}</p>
            </div>
          </div>
        )}

        {adminState.adminError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <p className="text-red-800 font-medium">{adminState.adminError}</p>
            </div>
          </div>
        )}

        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Assign New Admin</h4>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Enter user number (e.g., STU001, LEC001)"
              value={adminState.adminUserNumber}
              onChange={(e) => adminState.setAdminUserNumber(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') adminState.handleAssignAdmin();
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={adminState.handleAssignAdmin}
              disabled={adminState.adminLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <UserCog className="h-4 w-4" />
              <span>{adminState.adminLoading ? 'Assigning...' : 'Assign Admin'}</span>
            </button>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Current Admins</h4>
          {adminState.currentAdmins.length === 0 ? (
            <p className="text-gray-500 text-sm">No admins found.</p>
          ) : (
            <div className="space-y-2">
              {adminState.currentAdmins.map((admin: any) => {
                const profile = Array.isArray(admin.profiles) && admin.profiles.length > 0 ? admin.profiles[0] : null;
                const name = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'No profile';
                const userNumber = profile?.user_number ?? '—';
                return (
                  <div
                    key={admin.id}
                    className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <UserCog className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{name || admin.email}</p>
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <span>{userNumber}</span>
                          {admin.email && (
                            <>
                              <span>•</span>
                              <span>{admin.email}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => adminState.handleRemoveAdmin(admin.id, userNumber)}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                    >
                      Remove Admin
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
