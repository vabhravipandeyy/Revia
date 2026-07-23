import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { confirmPasswordReset, requestPasswordReset } from '@/src/services/authService';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

interface LoginProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onNavigateToRegister: () => void;
}

export default function Login({ onLogin, onNavigateToRegister }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [hasSentOtp, setHasSentOtp] = useState(false);
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false);

  const forgotPasswordChecks = {
    minLength: forgotNewPassword.length >= 8,
    uppercase: /[A-Z]/.test(forgotNewPassword),
    lowercase: /[a-z]/.test(forgotNewPassword),
    number: /\d/.test(forgotNewPassword),
  };

  const isForgotPasswordValid = Object.values(forgotPasswordChecks).every(Boolean);

  const getFriendlyPasswordError = (message: string) => {
    if (message.toLowerCase().includes('password does not meet cognito policy requirements')) {
      return 'Password must be at least 8 characters and include 1 uppercase letter, 1 lowercase letter, and 1 number.';
    }

    return message;
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2500);

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 100;
        return prev + 1;
      });
    }, 20);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setIsSubmitting(false);
    }
  };

  const handleForgotPasswordRequest = async () => {
    setForgotError('');
    setForgotSuccess('');
    setIsForgotSubmitting(true);

    try {
      await requestPasswordReset(forgotEmail || email);
      setHasSentOtp(true);
      setForgotSuccess('OTP sent to your email.');
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  const handleForgotPasswordConfirm = async () => {
    setForgotError('');
    setForgotSuccess('');

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('Passwords do not match');
      return;
    }

    if (!isForgotPasswordValid) {
      setForgotError('Password must be at least 8 characters and include 1 uppercase letter, 1 lowercase letter, and 1 number.');
      return;
    }

    setIsForgotSubmitting(true);

    try {
      await confirmPasswordReset(forgotEmail || email, forgotOtp, forgotNewPassword);
      setForgotSuccess('Password reset successful. You can log in now.');
      setTimeout(() => {
        setIsForgotPasswordOpen(false);
        setHasSentOtp(false);
        setForgotOtp('');
        setForgotNewPassword('');
        setForgotConfirmPassword('');
        setForgotError('');
      }, 1200);
    } catch (err) {
      setForgotError(
        err instanceof Error
          ? getFriendlyPasswordError(err.message)
          : 'Failed to reset password'
      );
    } finally {
      setIsForgotSubmitting(false);
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
            transition={{ duration: 1, ease: "easeInOut" }}
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
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
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
            transition={{ duration: 1 }}
            className="min-h-screen flex flex-col md:flex-row bg-[#0A0A0A]"
          >
            {/* LEFT SIDE: Visual Content */}
            <section className="relative w-full md:w-1/2 min-h-[20vh] md:min-h-screen flex flex-col items-center justify-center p-8 md:p-12 lg:p-24 overflow-hidden bg-white shrink-0">
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
                  Talk to Someone Who <span className="bg-gradient-to-br from-neutral-400 to-neutral-700 bg-clip-text text-transparent">Understands</span> You
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className="text-neutral-500 text-sm md:text-xl max-w-md leading-relaxed font-normal mx-auto md:mx-0 hidden md:block"
                >
                  An AI companion that listens and responds like a real human. Built for meaningful connection.
                </motion.p>
              </div>

              {/* Background Shapes */}
              <div className="absolute inset-0 z-0">
                <motion.div 
                  animate={{ 
                    scale: [1, 1.05, 1],
                    rotate: [0, 5, 0]
                  }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute top-1/4 -left-1/4 w-[80%] h-[80%] bg-neutral-100 rounded-[100%] blur-[120px] opacity-70"
                />
              </div>

              {/* Decorative Subtle Grid */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] bg-[size:6rem_6rem]" />
            </section>

            {/* RIGHT SIDE: Authentication */}
            <section className="flex-1 flex flex-col items-center justify-center py-12 md:py-16 px-8 md:px-12 lg:px-24 bg-black relative min-h-screen">
              {/* Animated Background Elements */}
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
                {/* Subtle Moving Grid */}
                <motion.div 
                  animate={{ 
                    backgroundPosition: ["0% 0%", "100% 100%"] 
                  }}
                  transition={{ 
                    duration: 120, 
                    repeat: Infinity, 
                    ease: "linear" 
                  }}
                  className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:5rem_5rem]" 
                />
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full max-w-sm z-10 my-auto"
              >
                <div className="space-y-12">
                  <div className="space-y-4">
                    <motion.h2 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                      className="text-4xl font-semibold tracking-tight text-white"
                    >
                      Welcome Back
                    </motion.h2>
                    <motion.p 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                      className="text-neutral-500 font-medium text-lg"
                    >
                      Let's continue where you left off
                    </motion.p>
                  </div>
                  
                  <form onSubmit={handleSubmit} className="space-y-10">
                    <div className="space-y-8">
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="space-y-3 group"
                      >
                        <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400 block transition-colors group-focus-within:text-white">Email Address</Label>
                        <Input 
                          id="email" 
                          type="email" 
                          autoComplete="email"
                          autoCapitalize="none"
                          autoCorrect="off"
                          placeholder="name@example.com" 
                          className="border-x-0 border-t-0 rounded-none bg-transparent hover:bg-transparent focus:bg-transparent px-1 pb-4 h-auto text-lg border-white/10 focus:border-white/60 transition-all text-white placeholder:text-neutral-800 focus-visible:ring-0"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required 
                        />
                      </motion.div>
                      
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="space-y-3 group"
                      >
                        <div className="flex items-center justify-between">
                          <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400 transition-colors group-focus-within:text-white">Password</Label>
                          <button
                            type="button"
                            className="text-[10px] uppercase tracking-widest text-neutral-500 hover:text-white transition-colors font-medium"
                            onClick={() => {
                              setForgotEmail(email);
                              setIsForgotPasswordOpen(true);
                            }}
                          >
                            Lost?
                          </button>
                        </div>
                        <div className="relative group">
                          <Input 
                            id="password" 
                            type={showPassword ? "text" : "password"} 
                            autoComplete="current-password"
                            className="border-x-0 border-t-0 rounded-none bg-transparent hover:bg-transparent focus:bg-transparent px-1 pb-4 h-auto text-lg border-white/10 focus:border-white/60 transition-all text-white pr-10 focus-visible:ring-0"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required 
                          />
                          <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-0 bottom-4 text-neutral-600 hover:text-white transition-all px-1"
                          >
                            <motion.div 
                              animate={{ rotate: showPassword ? 180 : 0, scale: showPassword ? 1.1 : 1 }}
                              transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            >
                              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </motion.div>
                          </button>
                        </div>
                      </motion.div>
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
                    
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8, delay: 0.4 }}
                      className="space-y-8"
                    >
                      <Button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="group w-full h-14 rounded-full bg-white text-black hover:bg-neutral-200 font-bold text-base transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-white/5 relative overflow-hidden"
                      >
                        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-black/5 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                        {isSubmitting ? (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center gap-3"
                          >
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="tracking-widest uppercase text-[10px] font-bold">Authenticating</span>
                          </motion.div>
                        ) : (
                          "Login"
                        )}
                      </Button>
                      
                      <div className="text-[12px] text-center font-medium">
                        <span className="text-neutral-600">Don't have an account? </span>
                        <button 
                          type="button"
                          onClick={onNavigateToRegister}
                          className="text-white hover:underline underline-offset-8 decoration-white/20 transition-all ml-1 hover:text-neutral-200"
                        >
                          Create account
                        </button>
                      </div>
                    </motion.div>
                  </form>
                </div>
              </motion.div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
        <DialogContent className="max-w-md rounded-[28px] border border-white/10 bg-[#111111] p-0 text-white shadow-2xl">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-xl font-semibold text-white">Reset Password</DialogTitle>
            <DialogDescription className="text-sm text-neutral-400">
              Get an OTP on email and reset your password securely.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-6 pt-2 space-y-5">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Email</Label>
              <Input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="h-12 rounded-2xl border-white/10 bg-white/5 text-white placeholder:text-neutral-600"
                placeholder="name@example.com"
              />
            </div>

            {!hasSentOtp ? (
              <Button
                type="button"
                onClick={handleForgotPasswordRequest}
                disabled={isForgotSubmitting}
                className="w-full h-12 rounded-2xl bg-white text-black hover:bg-neutral-200 font-bold"
              >
                {isForgotSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send OTP'}
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">OTP</Label>
                  <Input
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value)}
                    className="h-12 rounded-2xl border-white/10 bg-white/5 text-white placeholder:text-neutral-600"
                    placeholder="Enter OTP"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">New Password</Label>
                  <Input
                    type="password"
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    className="h-12 rounded-2xl border-white/10 bg-white/5 text-white placeholder:text-neutral-600"
                    placeholder="New password"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Confirm Password</Label>
                  <Input
                    type="password"
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    className="h-12 rounded-2xl border-white/10 bg-white/5 text-white placeholder:text-neutral-600"
                    placeholder="Confirm password"
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400 mb-2">
                    Password Requirements
                  </p>
                  <div className="space-y-1 text-[11px] font-medium">
                    <p className={forgotPasswordChecks.minLength ? 'text-emerald-400' : 'text-neutral-500'}>
                      At least 8 characters
                    </p>
                    <p className={forgotPasswordChecks.uppercase ? 'text-emerald-400' : 'text-neutral-500'}>
                      At least 1 uppercase letter
                    </p>
                    <p className={forgotPasswordChecks.lowercase ? 'text-emerald-400' : 'text-neutral-500'}>
                      At least 1 lowercase letter
                    </p>
                    <p className={forgotPasswordChecks.number ? 'text-emerald-400' : 'text-neutral-500'}>
                      At least 1 number
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleForgotPasswordRequest}
                    disabled={isForgotSubmitting}
                    className="flex-1 h-12 rounded-2xl border-white/10 bg-transparent text-white hover:bg-white/5"
                  >
                    Resend OTP
                  </Button>
                  <Button
                    type="button"
                    onClick={handleForgotPasswordConfirm}
                    disabled={isForgotSubmitting}
                    className="flex-1 h-12 rounded-2xl bg-white text-black hover:bg-neutral-200 font-bold"
                  >
                    {isForgotSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset Password'}
                  </Button>
                </div>
              </div>
            )}

            {forgotError && <p className="text-sm text-red-400 font-medium">{forgotError}</p>}
            {forgotSuccess && <p className="text-sm text-emerald-400 font-medium">{forgotSuccess}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
