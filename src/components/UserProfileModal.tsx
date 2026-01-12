// src/components/UserProfileModal.tsx
import React, { useEffect, useState } from 'react';
import { X, User, Lock, Image as ImageIcon, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    name: string;
    userNumber: string;
    role: string;
    email?: string;
  };
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose, user }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [activeSection, setActiveSection] = useState<'profile' | 'password'>('profile');

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  // profile row info resolved from DB
  const [profileId, setProfileId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setLoadingProfile(true);
    (async () => {
      try {
        // find profile by user_number
        const { data, error } = await supabase
          .from('profiles')
          .select('id, user_id, avatar_url, first_name, last_name')
          .eq('user_number', user.userNumber)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setProfileId(data.id);
          setUserId(data.user_id);
        } else {
          setProfileId(null);
          setUserId(null);
        }
      } catch (err: any) {
        console.error('Failed to load profile', err);
        setMessage('Failed to load profile data');
        setMessageType('error');
      } finally {
        setLoadingProfile(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user.userNumber]);

  if (!isOpen) return null;

  const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage(text);
    setMessageType(type);
    window.setTimeout(() => setMessage(''), 4000);
  };

  const getExtension = (name: string) => {
    const idx = name.lastIndexOf('.');
    return idx >= 0 ? name.slice(idx + 1) : 'png';
  };

  // ---------- Password change ----------
  const handlePasswordChange = async () => {
    // validations
    if (!currentPassword || !newPassword || !confirmPassword) {
      showMessage('Please fill in all password fields', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showMessage('New passwords do not match', 'error');
      return;
    }
    if (newPassword.length < 8) {
      showMessage('Password must be at least 8 characters', 'error');
      return;
    }
    if (!userId) {
      showMessage('Unable to determine user identity', 'error');
      return;
    }

    setIsSaving(true);
    try {
      // Call RPC we created on server-side
      const { data, error } = await supabase.rpc('auth_change_password', {
        p_user_id: userId,
        p_current_password: currentPassword,
        p_new_password: newPassword
      });

      if (error) throw error;

      // RPC returns true on success
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showMessage('Password updated successfully', 'success');
    } catch (err: any) {
      console.error('Password change failed', err);
      // show friendly message when RPC raises specific errors
      const text = err?.message ?? 'Failed to update password';
      showMessage(text, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ---------- UI ----------
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">Profile Settings</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {message && (
            <div
              className={`mb-4 p-3 rounded-lg ${
                messageType === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message}
            </div>
          )}

          <div className="flex space-x-1 mb-6 border-b">
            <button
              onClick={() => setActiveSection('profile')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeSection === 'profile' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <User className="h-4 w-4 inline mr-2" />
              Profile Info
            </button>
            <button
              onClick={() => setActiveSection('password')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeSection === 'password' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Lock className="h-4 w-4 inline mr-2" />
              Change Password
            </button>
          </div>

          {activeSection === 'profile' && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h4 className="text-xl font-semibold text-gray-900">{user.name}</h4>
                <p className="text-gray-600">{user.userNumber}</p>
                <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full capitalize">
                  {user.role}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <input type="text" value={user.name} disabled className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">User Number</label>
                  <input type="text" value={user.userNumber} disabled className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                  <input type="text" value={user.role} disabled className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 capitalize" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input type="email" value={user.email || `${user.userNumber}@university.edu`} disabled className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500" />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'password' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">Update your password to keep your account secure</p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter current password" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter new password" />
                <p className="text-xs text-gray-500 mt-1">Password must be at least 8 characters</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Confirm new password" />
              </div>

              <button onClick={handlePasswordChange} disabled={isSaving} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2">
                <Save className="h-4 w-4" />
                <span>{isSaving ? 'Updating...' : 'Update Password'}</span>
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg flex justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
