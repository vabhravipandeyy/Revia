import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { resendSignupOtp, verifySignup } from '@/src/services/authService';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';

interface RegisterProps {
  onRegister: (
    email: string,
    password: string,
    profile: {
      name: string;
      username: string;
      gender: string;
      age: number;
      bio?: string;
    }
  ) => Promise<void>;
  onNavigateToLogin: () => void;
}

export default function Register({ onRegister, onNavigateToLogin }: RegisterProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [verificationOtp, setVerificationOtp] = useState('');
  const [isAwaitingVerification, setIsAwaitingVerification] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    gender: 'Male',
    age: '',
    password: '',
    confirmPassword: '',
  });

  const passwordChecks = {
    minLength: formData.password.length >= 8,
    uppercase: /[A-Z]/.test(formData.password),
    lowercase: /[a-z]/.test(formData.password),
    number: /\d/.test(formData.password),
  };

  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  const getFriendlySignupError = (message: string) => {
    if (message.toLowerCase().includes('password does not meet cognito policy requirements')) {
      return 'Password must be at least 8 characters and include 1 uppercase letter, 1 lowercase letter, and 1 number.';
    }

    if (message.toLowerCase().includes('user already exists')) {
      return 'An account with this email already exists.';
    }

    return message;
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 100;
        return prev + 1;
      });
    }, 15);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!isPasswordValid) {
      setError('Password must be at least 8 characters and include 1 uppercase letter, 1 lowercase letter, and 1 number.');
      return;
    }

    setIsSubmitting(true);

    try {
      await onRegister(formData.email, formData.password, {
        name: formData.name,
        username: formData.username,
        gender: formData.gender.toLowerCase(),
        age: Number(formData.age),
        bio: 'Digital explorer passionate about technology and meaningful conversations.',
      });
      setIsAwaitingVerification(true);
      setSuccessMessage('Verification OTP sent to your email. Enter it below to verify your account.');
    } catch (err) {
      setError(
        err instanceof Error
          ? getFriendlySignupError(err.message)
          : 'Signup failed'
      );
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    setSuccessMessage('');
    setIsVerifyingOtp(true);

    try {
      await verifySignup(formData.email, verificationOtp);
      setSuccessMessage('Account verified successfully. Redirecting to login...');
      setIsVerifyingOtp(false);
      setTimeout(() => {
        onNavigateToLogin();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setIsVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setSuccessMessage('');
    setIsResendingOtp(true);

    try {
      await resendSignupOtp(formData.email);
      setSuccessMessage('Verification OTP sent again to your email.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend OTP');
    } finally {
      setIsResendingOtp(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] font-sans selection:bg-white selection:text-black antialiased">
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black px-6"
          >
            {/* Grid Background in Loader */}
            <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
            
            <div className="max-w-xl w-full text-center space-y-8 relative z-10">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }}
                className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-white/80"
              >
                <span className="text-xs font-black uppercase tracking-[0.35em]">Revia</span>
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                className="text-2xl md:text-3xl font-light tracking-tight text-white/90"
              >
                Talk to Someone Who <span className="text-neutral-500">Understands</span> You
              </motion.h2>
              
              <div className="w-full max-w-xs mx-auto h-[1px] bg-white/10 relative overflow-hidden">
                <motion.div 
                  className="absolute inset-y-0 left-0 bg-[#8B5CF6]"
                  initial={{ width: "0%" }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="min-h-screen flex flex-col md:flex-row bg-[#0A0A0A]"
          >
            {/* LEFT SIDE: Narrative Section */}
            <section className="relative w-full md:w-1/2 min-h-[20vh] md:min-h-screen flex flex-col items-center justify-center p-8 md:p-12 lg:p-24 overflow-hidden bg-white text-black shrink-0">
              <div className="relative z-10 max-w-xl text-center md:text-left">
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="mb-6 inline-flex items-center gap-3 rounded-full border border-neutral-200 bg-white px-4 py-2 shadow-sm"
                >
                  <span className="text-sm md:text-base font-black uppercase tracking-[0.32em] text-neutral-500">Revia Platform</span>
                </motion.div>
                <motion.h1 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                  className="text-3xl md:text-5xl lg:text-7xl font-semibold tracking-tight leading-[1.05] text-black mb-4 md:mb-8"
                >
                  Not Just AI. <span className="bg-gradient-to-br from-neutral-400 to-neutral-700 bg-clip-text text-transparent">Someone</span> to Talk To.
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className="text-neutral-500 text-sm md:text-xl max-w-md leading-relaxed font-normal mx-auto md:mx-0 hidden md:block"
                >
                  Revia helps people build trusted AI companionship with secure, human-feeling conversations.
                </motion.p>
              </div>

              {/* Background Shapes */}
              <div className="absolute inset-0 z-0">
                <motion.div 
                  animate={{ 
                    scale: [1, 1.1, 1],
                    x: [0, 10, 0]
                  }}
                  transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                  className="absolute -bottom-1/4 -right-1/4 w-[90%] h-[90%] bg-neutral-100 rounded-[100%] blur-[120px] opacity-70"
                />
              </div>
              <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] bg-[size:6rem_6rem]" />
            </section>

            {/* RIGHT SIDE: Authentication Section */}
            <section className="flex-1 flex flex-col items-center justify-center py-12 md:py-16 px-6 md:px-12 lg:px-24 bg-black relative min-h-screen md:min-h-screen">
              <div className="absolute inset-0 pointer-events-none">
                {/* Decorative Oval Glow */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 2, ease: "easeOut" }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-white/[0.02] rounded-[100%] blur-[120px]"
                />

                {/* Drifting Particles */}
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-px h-32 bg-gradient-to-b from-transparent via-white/10 to-transparent"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                    }}
                    animate={{
                      y: [-150, 150],
                      opacity: [0, 0.5, 0],
                    }}
                    transition={{
                      duration: 8 + Math.random() * 7,
                      repeat: Infinity,
                      delay: Math.random() * 5,
                      ease: "linear",
                    }}
                  />
                ))}
                <motion.div 
                  animate={{ backgroundPosition: ["0% 0%", "100% 100%"] }}
                  transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:5rem_5rem] pointer-events-none" 
                />
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full max-w-md z-10 my-auto"
              >
                <button 
                  onClick={onNavigateToLogin}
                  className="flex items-center gap-2 text-neutral-600 hover:text-white transition-all mb-8 group text-[11px] font-bold uppercase tracking-[0.3em] md:static self-start"
                >
                  <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                  Back to login
                </button>

                <div className="space-y-8">
                  <div className="space-y-2 text-center md:text-left">
                    <motion.h2 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                      className="text-3xl font-semibold tracking-tight text-white leading-none"
                    >
                      Create Account
                    </motion.h2>
                    <p className="text-neutral-500 font-medium text-base">Start your journey on Revia with a secure, verified account.</p>
                  </div>
                  
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {!isAwaitingVerification ? (
                      <>
                    <div className="space-y-5">
                      <div className="grid grid-cols-2 gap-x-6">
                        <div className="space-y-1 group">
                          <Label htmlFor="name" className="text-[9px] font-bold uppercase tracking-[0.3em] text-neutral-400 block transition-colors group-focus-within:text-white">Full Name</Label>
                        <Input 
                          id="name" 
                          autoComplete="name"
                          placeholder="Jane Doe" 
                            className="border-x-0 border-t-0 rounded-none bg-transparent hover:bg-transparent focus:bg-transparent px-1 pb-2 h-auto text-base border-white/10 focus:border-white/60 transition-all text-white placeholder:text-neutral-700 focus-visible:ring-0"
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            required 
                          />
                        </div>
                        <div className="space-y-1 group">
                          <Label htmlFor="username" className="text-[9px] font-bold uppercase tracking-[0.3em] text-neutral-400 block transition-colors group-focus-within:text-white">Username</Label>
                        <Input 
                          id="username" 
                          autoComplete="username"
                          placeholder="jane_ai" 
                            className="border-x-0 border-t-0 rounded-none bg-transparent hover:bg-transparent focus:bg-transparent px-1 pb-2 h-auto text-base border-white/10 focus:border-white/60 transition-all text-white placeholder:text-neutral-700 focus-visible:ring-0"
                            value={formData.username}
                            onChange={(e) => setFormData({...formData, username: e.target.value})}
                            required 
                          />
                        </div>
                      </div>

                      <div className="space-y-1 group">
                        <Label htmlFor="email" className="text-[9px] font-bold uppercase tracking-[0.3em] text-neutral-400 block transition-colors group-focus-within:text-white">Email Address</Label>
                        <Input 
                          id="email" 
                          type="email" 
                          autoComplete="email"
                          autoCapitalize="none"
                          autoCorrect="off"
                          placeholder="name@example.com" 
                          className="border-x-0 border-t-0 rounded-none bg-transparent hover:bg-transparent focus:bg-transparent px-1 pb-2 h-auto text-base border-white/10 focus:border-white/60 transition-all text-white placeholder:text-neutral-700 focus-visible:ring-0"
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          required 
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-x-6">
                        <div className="space-y-1 group">
                          <Label htmlFor="gender" className="text-[9px] font-bold uppercase tracking-[0.3em] text-neutral-400 block transition-colors group-focus-within:text-white">Gender</Label>
                          <Select value={formData.gender} onValueChange={(val) => setFormData({...formData, gender: val})}>
                            <SelectTrigger className="border-x-0 border-t-0 rounded-none bg-transparent hover:bg-transparent focus:bg-transparent px-1 pb-3 h-auto text-lg border-white/10 focus:border-white/60 ring-0 transition-all text-white shadow-none ring-offset-0 focus:ring-offset-0 group-focus-within:border-white/60 min-h-[48px]">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent className="bg-neutral-900 border-white/10 text-white min-w-[14rem] shadow-2xl p-2 overflow-hidden">
                              <SelectItem value="Male" className="rounded-md transition-all duration-200 focus:bg-white/10 focus:text-white data-[highlighted]:bg-white/10 data-[highlighted]:text-white cursor-pointer py-3 px-3">
                                <span className="font-medium text-sm">Male</span>
                              </SelectItem>
                              <SelectItem value="Female" className="rounded-md transition-all duration-200 focus:bg-white/10 focus:text-white data-[highlighted]:bg-white/10 data-[highlighted]:text-white cursor-pointer py-3 px-3">
                                <span className="font-medium text-sm">Female</span>
                              </SelectItem>
                              <SelectItem value="Non-binary" className="rounded-md transition-all duration-200 focus:bg-white/10 focus:text-white data-[highlighted]:bg-white/10 data-[highlighted]:text-white cursor-pointer py-3 px-3">
                                <span className="font-medium text-sm">Non-binary</span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1 group">
                          <Label htmlFor="age" className="text-[9px] font-bold uppercase tracking-[0.3em] text-neutral-400 block transition-colors group-focus-within:text-white">Age</Label>
                          <Input 
                            id="age" 
                            type="text"
                            inputMode="numeric"
                            placeholder="24" 
                            className="border-x-0 border-t-0 rounded-none bg-transparent hover:bg-transparent focus:bg-transparent px-1 pb-2 h-auto text-base border-white/10 focus:border-white/60 transition-all text-white placeholder:text-neutral-700 focus-visible:ring-0"
                            value={formData.age}
                            onChange={(e) => setFormData({...formData, age: e.target.value.replace(/\D/g, '')})}
                            required 
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-6">
                        <div className="space-y-1 group">
                          <Label htmlFor="password" className="text-[9px] font-bold uppercase tracking-[0.3em] text-neutral-400 block transition-colors group-focus-within:text-white">Password</Label>
                          <div className="relative">
                            <Input 
                              id="password" 
                              type={showPassword ? "text" : "password"} 
                              autoComplete="new-password"
                              placeholder="••••••••"
                              className="border-x-0 border-t-0 rounded-none bg-transparent hover:bg-transparent focus:bg-transparent px-1 pb-2 h-auto text-base border-white/10 focus:border-white/60 transition-all text-white placeholder:text-neutral-700 focus-visible:ring-0"
                              value={formData.password}
                              onChange={(e) => setFormData({...formData, password: e.target.value})}
                              required 
                            />
                            <button 
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-0 bottom-2 text-neutral-600 hover:text-white transition-all px-1"
                            >
                              <motion.div 
                                animate={{ rotate: showPassword ? 180 : 0, scale: showPassword ? 1.1 : 1 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                              >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </motion.div>
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1 group">
                          <Label htmlFor="confirm-password" className="text-[9px] font-bold uppercase tracking-[0.3em] text-neutral-400 block transition-colors group-focus-within:text-white">Confirm</Label>
                          <div className="relative">
                            <Input 
                              id="confirm-password" 
                              type={showConfirmPassword ? "text" : "password"} 
                              autoComplete="new-password"
                              placeholder="••••••••"
                              className="border-x-0 border-t-0 rounded-none bg-transparent hover:bg-transparent focus:bg-transparent px-1 pb-2 h-auto text-base border-white/10 focus:border-white/60 transition-all text-white placeholder:text-neutral-700 focus-visible:ring-0"
                              value={formData.confirmPassword}
                              onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                              required 
                            />
                            <button 
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-0 bottom-2 text-neutral-600 hover:text-white transition-all px-1"
                            >
                              <motion.div 
                                animate={{ rotate: showConfirmPassword ? 180 : 0, scale: showConfirmPassword ? 1.1 : 1 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                              >
                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </motion.div>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400 mb-2">
                          Password Requirements
                        </p>
                        <div className="space-y-1 text-[11px] font-medium">
                          <p className={passwordChecks.minLength ? 'text-emerald-400' : 'text-neutral-500'}>
                            At least 8 characters
                          </p>
                          <p className={passwordChecks.uppercase ? 'text-emerald-400' : 'text-neutral-500'}>
                            At least 1 uppercase letter
                          </p>
                          <p className={passwordChecks.lowercase ? 'text-emerald-400' : 'text-neutral-500'}>
                            At least 1 lowercase letter
                          </p>
                          <p className={passwordChecks.number ? 'text-emerald-400' : 'text-neutral-500'}>
                            At least 1 number
                          </p>
                        </div>
                      </div>
                    </div>

                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm text-red-400 font-medium"
                      >
                        {error}
                      </motion.p>
                    )}

                    {successMessage && (
                      <motion.p
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm text-emerald-400 font-medium"
                      >
                        {successMessage}
                      </motion.p>
                    )}
                    
                    <div className="pt-6">
                      <Button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="group w-full h-12 rounded-full bg-white text-black hover:bg-neutral-200 font-bold text-base transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl hover:shadow-white/10 active:scale-[0.98] shadow-xl shadow-white/5 relative overflow-hidden"
                      >
                        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-black/5 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                        {isSubmitting ? (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center gap-3"
                          >
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="tracking-widest uppercase text-[10px] font-bold">Creating Account</span>
                          </motion.div>
                        ) : (
                          "Create account"
                        )}
                      </Button>
                    </div>
                      </>
                    ) : (
                      <div className="space-y-5">
                        <div className="space-y-1 group">
                          <Label htmlFor="verification-otp" className="text-[9px] font-bold uppercase tracking-[0.3em] text-neutral-400 block transition-colors group-focus-within:text-white">Verification OTP</Label>
                          <Input
                            id="verification-otp"
                            inputMode="numeric"
                            placeholder="Enter email OTP"
                            className="border-x-0 border-t-0 rounded-none bg-transparent hover:bg-transparent focus:bg-transparent px-1 pb-2 h-auto text-base border-white/10 focus:border-white/60 transition-all text-white placeholder:text-neutral-700 focus-visible:ring-0"
                            value={verificationOtp}
                            onChange={(e) => setVerificationOtp(e.target.value)}
                            required
                          />
                        </div>

                        <div className="flex gap-3 pt-2">
                          <Button
                            type="button"
                            onClick={handleResendOtp}
                            disabled={isResendingOtp || isVerifyingOtp}
                            className="flex-1 h-12 rounded-full bg-transparent border border-white/10 text-white hover:bg-white/5 font-bold text-sm"
                          >
                            {isResendingOtp ? (
                              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span className="tracking-widest uppercase text-[10px] font-bold">Sending</span>
                              </motion.div>
                            ) : (
                              'Resend OTP'
                            )}
                          </Button>
                          <Button
                            type="button"
                            onClick={handleVerifyOtp}
                            disabled={isVerifyingOtp || isResendingOtp}
                            className="flex-1 h-12 rounded-full bg-white text-black hover:bg-neutral-200 font-bold text-sm"
                          >
                            {isVerifyingOtp ? (
                              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span className="tracking-widest uppercase text-[10px] font-bold">Verifying</span>
                              </motion.div>
                            ) : (
                              'Verify Account'
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </form>
                </div>
              </motion.div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
