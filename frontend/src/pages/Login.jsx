import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

function Login() {
  const { role } = useParams(); // 'candidate' or 'recruiter'
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [verificationInfo, setVerificationInfo] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const endpoint = isLogin ? 'login' : 'signup';
      const payload = { role, email, password };
      
      if (!isLogin) {
        payload.name = name;
        if (role === 'recruiter') {
          payload.companyName = companyName;
          payload.verificationInfo = verificationInfo;
        }
      }

      const res = await fetch(`http://localhost:5001/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.message || 'Error occurred');
        return;
      }
      
      // Simulate authentication navigation
    if (role === 'candidate') {
        navigate('/candidate/upload');
        } else {
        navigate('/recruiter/dashboard');
        }
    } catch (err) {
      alert("Failed to connect to server");
      console.error(err);
    }
  };

  const handleSkipVerification = async (e) => {
    e.preventDefault();
    if (!email || !password || !name) {
      alert("Please fill in your name, email, and password to continue.");
      return;
    }
    
    // Clear out verification fields to ensure they are skipped
    setCompanyName('');
    setVerificationInfo('');
    
    // Submit the form normally to allow backend account creation
    const syntheticEvent = { preventDefault: () => {} };
    await handleSubmit(syntheticEvent);
  };

  const isRecruiter = role === 'recruiter';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 flex flex-col">
      <header className="flex justify-between items-center py-5 px-6 md:px-12 bg-white shadow-sm shrink-0">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold text-indigo-500 no-underline">
          <span className="w-8 h-8 flex items-center justify-center bg-indigo-500 text-white rounded-lg text-lg">✓</span>
          <span>SkillVerify</span>
        </Link>
        <Link to="/" className="text-slate-500 hover:text-indigo-500 font-medium">← Back to Home</Link>
      </header>

      <main className="flex-1 flex justify-center items-center py-12 px-6">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 md:p-10 shadow-xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">
              {isLogin ? 'Welcome Back' : 'Create an Account'}
            </h1>
            <p className="text-slate-500">
              {isLogin 
                ? `Sign in to your ${isRecruiter ? 'recruiter' : 'candidate'} account` 
                : `Sign up as a ${isRecruiter ? 'recruiter' : 'candidate'} to get started`}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input 
                  type="text" 
                  required 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder="John Doe"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <input 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {!isLogin && isRecruiter && (
              <div className="pt-4 mt-2 border-t border-slate-100">
                <h3 className="text-sm font-semibold text-slate-800 mb-3">Verification Details (Optional)</h3>
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                    <input 
                      type="text" 
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                      placeholder="Acme Corp"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">LinkedIn / Company Website</label>
                    <input 
                      type="text" 
                      value={verificationInfo}
                      onChange={(e) => setVerificationInfo(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                      placeholder="https://"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-3">
              <button 
                type="submit" 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex justify-center items-center gap-2"
              >
                {isLogin ? 'Sign In' : 'Create Account'}
              </button>
              
              {!isLogin && isRecruiter && (
                 <button 
                  type="button" 
                  onClick={handleSkipVerification}
                  className="w-full bg-white hover:bg-slate-50 text-slate-600 border border-slate-300 font-medium py-3 px-4 rounded-lg transition-colors flex justify-center items-center gap-2"
                >
                  Skip Verification & Continue
                </button>
              )}
            </div>
          </form>

          <div className="mt-8 text-center text-slate-500 text-sm">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
            <button 
              onClick={() => setIsLogin(!isLogin)} 
              className="text-indigo-600 font-semibold hover:underline bg-transparent border-none cursor-pointer"
            >
              {isLogin ? 'Sign Up' : 'Log In'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Login;
