import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Boxes, Eye, EyeOff, ArrowLeft, Globe } from 'lucide-react';

export default function LoginPage() {
  const { login, signup, forgotPassword } = useAuth();
  const [mode, setMode] = useState('login');
  const [formData, setFormData] = useState({ name: '', email: '', password: '', departmentId: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(formData.email, formData.password);
      } else if (mode === 'signup') {
        if (!formData.name) throw new Error('Name is required');
        await signup(formData);
      } else if (mode === 'forgot') {
        await forgotPassword(formData.email);
        setSuccess('If an account exists with this email, a reset link has been sent.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const set = (key, val) => setFormData(p => ({ ...p, [key]: val }));

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 overflow-hidden relative">

      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-gradient-to-tr from-cyan-500 to-indigo-500 rounded-full blur-[120px] opacity-20 animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full blur-[120px] opacity-15 animate-pulse" style={{ animationDelay: '2s' }} />


      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
        backgroundSize: '32px 32px'
      }} />
      
      <div className="relative w-full max-w-[420px] z-10">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4 shadow-xl shadow-primary/20 border border-white/10 hover:rotate-6 transition-transform duration-300">
            <Globe className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Sinton Agency</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Enterprise Asset Flow</p>
        </div>

        {/* Glassmorphic Card */}
        <div className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-2xl p-8 shadow-2xl shadow-black/40">
          <h2 className="text-lg font-semibold text-foreground mb-1">
            {mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset password'}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === 'login' ? 'Sign in to manage your assets' 
              : mode === 'signup' ? 'Sign up creates an Employee account' 
              : 'Enter your email to receive a reset link'}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-600 dark:text-emerald-400">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => set('name', e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring placeholder:text-muted-foreground focus:scale-[1.01] hover:border-border/80 transition-all duration-200"
                  placeholder="John Doe"
                  required
                />
              </div>
            )}

            {mode !== 'forgot' || mode === 'forgot' ? (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => set('email', e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring placeholder:text-muted-foreground focus:scale-[1.01] hover:border-border/80 transition-all duration-200"
                  placeholder="name@company.com"
                  required
                />
              </div>
            ) : null}

            {mode !== 'forgot' && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={e => set('password', e.target.value)}
                    className="w-full h-10 px-3 pr-10 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring placeholder:text-muted-foreground focus:scale-[1.01] hover:border-border/80 transition-all duration-200"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'login' && (
              <div className="flex justify-end">
                <button type="button" onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }}
                  className="text-xs text-accent hover:underline active:scale-95 transition-transform">
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 shadow-sm"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </span>
              ) : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === 'login' ? (
              <>
                New here?{' '}
                <button onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}
                  className="text-accent font-medium hover:underline">
                  Create an account
                </button>
              </>
            ) : (
              <button onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                className="inline-flex items-center gap-1 text-accent font-medium hover:underline">
                <ArrowLeft className="w-3 h-3" /> Back to sign in
              </button>
            )}
          </div>
        </div>

        {/* Demo credentials */}
        <div className="mt-4 p-4 bg-card/60 border border-border rounded-xl space-y-2">
          <p className="text-xs font-semibold text-foreground text-center">Demo Credentials (Password: Password123! or Admin123!)</p>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="p-1.5 bg-muted/40 rounded border border-border/50 text-center">
              <span className="font-bold text-foreground block mb-0.5">Admin</span>
              <span className="font-mono text-muted-foreground block truncate">admin@company.com</span>
              <span className="font-mono text-foreground font-semibold">Admin123!</span>
            </div>
            <div className="p-1.5 bg-muted/40 rounded border border-border/50 text-center">
              <span className="font-bold text-foreground block mb-0.5">Asset Manager</span>
              <span className="font-mono text-muted-foreground block truncate flex-1 min-w-0">marcus.webb@company.com</span>
              <span className="font-mono text-foreground font-semibold">Password123!</span>
            </div>
            <div className="p-1.5 bg-muted/40 rounded border border-border/50 text-center">
              <span className="font-bold text-foreground block mb-0.5">Dept Head</span>
              <span className="font-mono text-muted-foreground block truncate">james.park@company.com</span>
              <span className="font-mono text-foreground font-semibold">Password123!</span>
            </div>
            <div className="p-1.5 bg-muted/40 rounded border border-border/50 text-center">
              <span className="font-bold text-foreground block mb-0.5">Employee</span>
              <span className="font-mono text-muted-foreground block truncate">nina.okafor@company.com</span>
              <span className="font-mono text-foreground font-semibold">Password123!</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
