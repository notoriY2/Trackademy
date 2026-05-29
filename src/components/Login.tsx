// src/components/Login.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, User, Lock, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

const Login: React.FC = () => {
  const [userNumber, setUserNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Call the Postgres RPC which validates password server-side using crypt()
      const { data, error: rpcError } = await supabase
        .rpc('auth_local_signin', { p_user_number: userNumber, p_password: password });

      if (rpcError) {
        console.error('RPC error:', rpcError);
        setError('Login failed — server error.');
        setIsLoading(false);
        return;
      }

      // rpc returns an array of rows; take first
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        setError('Invalid credentials. Please check your user number and password.');
        setIsLoading(false);
        return;
      }

      const { user_id, profile_id, role, full_name } = row as any;

      // Save minimal session info to localStorage (you can expand later)
      localStorage.setItem('user', JSON.stringify({
        userId: user_id,
        profileId: profile_id,
        userNumber,
        role,
        name: full_name ?? userNumber
      }));

      // Navigate to role dashboard
      if (role === 'student') navigate('/student-dashboard');
      else if (role === 'lecturer') navigate('/lecturer-dashboard');
      else if (role === 'admin') navigate('/admin-dashboard');
      else navigate('/home');

    } catch (err) {
      console.error(err);
      setError('Unexpected error during login.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <GraduationCap className="h-12 w-12 text-blue-600" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Sign in to Trackademy
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your credentials to access your dashboard
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="userNumber" className="block text-sm font-medium text-gray-700 mb-2">
                User Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="userNumber"
                  name="userNumber"
                  type="text"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., STU001, LEC001, ADM001"
                  value={userNumber}
                  onChange={(e) => setUserNumber(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          <div className="mt-8 border-t border-gray-200 pt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Demo Credentials:</h3>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Student:</span>
                <span>202502664 / 202502664@spu123</span>
              </div>
              <div className="flex justify-between">
                <span>Lecturer:</span>
                <span>202302664 / 202302664@spu123</span>
              </div>
              <div className="flex justify-between">
                <span>Admin:</span>
                <span>ADM001 / admin123</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={() => navigate('/home')}
            className="text-blue-600 hover:text-blue-500 text-sm font-medium"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
