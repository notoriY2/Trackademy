import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

const LoadingScreen: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/home');
    }, 6000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center">
      <div className="text-center">
        <div className="flex justify-center mb-8">
          <div className="relative">
            <GraduationCap className="h-24 w-24 text-white animate-pulse" />
            <div className="absolute inset-0 h-24 w-24 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
        <h1 className="text-6xl font-bold text-white mb-4 animate-fade-in">
          Trackademy
        </h1>
        <p className="text-xl text-blue-100 animate-fade-in-delay">
          Academic Excellence Management System
        </p>
        <div className="mt-8 flex justify-center">
          <div className="flex space-x-2">
            <div className="w-3 h-3 bg-white rounded-full animate-bounce"></div>
            <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
      
      <style >{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fade-in {
          animation: fade-in 1s ease-out;
        }
        
        .animate-fade-in-delay {
          animation: fade-in 1s ease-out 0.5s both;
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;