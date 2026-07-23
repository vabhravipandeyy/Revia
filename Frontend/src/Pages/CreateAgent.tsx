import React, { useState, useRef, useEffect } from 'react';
import {
  Agent,
  BehavioralInputState,
  Gender,
  UploadedKnowledgeFile,
  UploadMode,
} from '@/src/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserPlus, 
  ArrowLeft, 
  ArrowRight, 
  Plus,
  Trash2,
  Zap,
  Search,
  MoreVertical,
  Check,
  Edit2,
  X,
  ChevronDown,
  Info,
  ShieldAlert,
  Camera,
  Pin,
  PinOff,
  Archive,
  Library,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import KnowledgeUploadPanel from '@/src/components/upload/KnowledgeUploadPanel';
import PersonaAvatarImage from '@/src/components/PersonaAvatarImage';
import {
  createPersona,
  mapPersonaToAgent,
  updatePersona as updatePersonaRequest,
} from '@/src/services/personaService';
import {
  createUploadSession,
  ensureAuthenticatedUpload,
  uploadFileToS3,
} from '@/src/services/uploadService';

interface PersonaItemProps {
  agent: Agent;
  activePersonaId: string | null;
  activeMenu: string | null;
  setActivePersonaId: (id: string) => void;
  setActiveMenu: (id: string | null) => void;
  handleEdit: (agent: Agent) => void;
  onDeleteAgent: (id: string) => void;
  onTogglePin: (id: string) => void;
  onToggleArchive: (id: string) => void;
  formData: any;
  theme?: 'light' | 'dark';
}

const PersonaItem: React.FC<PersonaItemProps> = ({ 
  agent, 
  activePersonaId, 
  activeMenu, 
  setActivePersonaId, 
  setActiveMenu,
  handleEdit,
  onDeleteAgent,
  onTogglePin,
  onToggleArchive,
  formData,
  theme
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ x: 4 }}
      onClick={() => setActivePersonaId(agent.id)}
      className={cn(
        "group p-3 sm:p-4 rounded-2xl cursor-pointer transition-all flex items-center justify-between relative",
        theme === 'dark'
          ? (activePersonaId === agent.id ? "bg-[#202c33] text-white shadow-lg" : "hover:bg-[#202c33]/50 text-[#8696a0]")
          : (activePersonaId === agent.id ? "bg-[#FAFAFA] shadow-[0_8px_20px_-10px_rgba(0,0,0,0.05)] text-black" : "hover:bg-[#FAFAFA]/70 text-[#111111]"),
        activeMenu === agent.id && "z-[80]"
      )}
    >
      <div className="flex items-center gap-3 sm:gap-5 min-w-0">
        <div className={cn("w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center overflow-hidden shrink-0 transition-transform group-hover:scale-105 shadow-sm border", theme === 'dark' ? "bg-[#111b21] border-white/5" : "bg-[#FAFAFA] border-[#F0F0F0]")}>
          {agent.avatar || formData.profileImage ? (
            <PersonaAvatarImage
              src={agent.avatar || formData.profileImage}
              name={agent.name}
              className="w-full h-full"
              imgClassName="w-full h-full object-cover"
              fallbackClassName={cn("w-full h-full flex items-center justify-center", theme === 'dark' ? "bg-[#2a3942]" : "bg-gray-50")}
            />
          ) : (
            <div className={cn("w-full h-full flex items-center justify-center", theme === 'dark' ? "bg-[#2a3942]" : "bg-gray-50")}>
              <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 text-[#CCCCCC]" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <h4 className={cn(
              "text-[13px] sm:text-[14px] font-bold truncate transition-colors",
              theme === 'dark' ? (activePersonaId === agent.id ? "text-white" : "text-[#e9edf0]") : (activePersonaId === agent.id ? "text-black" : "text-[#111111]")
            )}>{agent.name}</h4>
            {agent.isPinned && <Pin className={cn("w-2.5 h-2.5", theme === 'dark' ? "text-white fill-white" : "text-black fill-black")} />}
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <div className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              (agent.status as string) === 'online' || (agent.status as string) === 'ready' ? "bg-green-500" : 
              (agent.status as string) === 'busy' ? "bg-amber-500" : 
              (agent.status as string) === 'SYNTHESIZING' ? "bg-blue-500 animate-pulse" : (theme === 'dark' ? "bg-[#2a3942]" : "bg-[#DDDDDD]")
            )} />
            <span className={cn("text-[10px] sm:text-[11px] font-medium truncate", theme === 'dark' ? "text-[#8696a0]" : "text-[#888888]")}>
              {(agent.status as string) === 'SYNTHESIZING' ? 'Synthesizing...' : agent.tagline || 'Persona'}
            </span>
          </div>
        </div>
      </div>
      <div className="relative">
        <button 
          onClick={(e) => { 
            e.preventDefault();
            e.stopPropagation(); 
            setActiveMenu(activeMenu === agent.id ? null : agent.id); 
          }}
          className={cn(
            "p-1.5 sm:p-2 transition-all rounded-full border border-transparent",
            theme === 'dark' ? "text-[#8696a0] hover:text-white hover:bg-[#202c33]" : "text-[#CCCCCC] hover:text-black hover:bg-gray-200/50",
            activeMenu === agent.id && (theme === 'dark' ? "bg-[#202c33] text-white" : "bg-gray-200/50 text-black")
          )}
        >
          <MoreVertical className="w-3.5 h-3.5 sm:w-4 h-4" />
        </button>
        <AnimatePresence>
          {activeMenu === agent.id && (
            <>
              {/* Backdrop specialized for this open menu */}
              <div 
                className="fixed inset-0 z-[65]" 
                onClick={(e) => { 
                  e.preventDefault();
                  e.stopPropagation(); 
                  setActiveMenu(null); 
                }}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className={cn("absolute right-0 top-full mt-1 w-40 sm:w-48 rounded-xl shadow-[0_20px_50px_-15px_rgba(0,0,0,0.15)] p-1 z-[80] overflow-hidden origin-top-right border", theme === 'dark' ? "bg-[#111b21] border-[#222e35] text-[#e9edf0]" : "bg-white border-[#E5E7EB]")}
              >
               {[
                 { label: 'Edit', icon: Edit2, onClick: () => handleEdit(agent) },
                 { label: agent.isPinned ? 'Unpin' : 'Pin', icon: agent.isPinned ? PinOff : Pin, onClick: () => onTogglePin(agent.id) },
                 { label: agent.isArchived ? 'Unarchive' : 'Archive', icon: Archive, onClick: () => onToggleArchive(agent.id) },
                 { label: 'Delete', icon: Trash2, danger: true, onClick: () => { if(window.confirm('Delete this persona?')) { onDeleteAgent(agent.id); } } },
               ].map((item) => (
                 <button
                   key={item.label}
                   onClick={(e) => { 
                     e.preventDefault();
                     e.stopPropagation(); 
                     item.onClick();
                     setActiveMenu(null);
                   }}
                   className={cn(
                     "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[11px] font-bold transition-all text-left",
                     item.danger ? (theme === 'dark' ? "text-red-500 hover:bg-red-950/20" : "text-red-500 hover:bg-red-50") : (theme === 'dark' ? "text-[#e9edf0] hover:bg-[#202c33]" : "text-black hover:bg-[#FAFAFA]")
                   )}
                 >
                   <item.icon className="w-3.5 h-3.5" strokeWidth={2.5} />
                   {item.label}
                 </button>
               ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface CreateAgentProps {
  agents: Agent[];
  onAddAgent: (agent: Agent) => void;
  onUpdateAgent: (agent: Agent) => void;
  onDeleteAgent: (agentId: string) => void;
  onTogglePin: (agentId: string) => void;
  onToggleArchive: (agentId: string) => void;
  onLaunchAgentChat?: (agentId: string) => void;
  theme?: 'light' | 'dark';
}

const TRAITS = ['Caring', 'Funny', 'Sarcastic', 'Calm', 'Loyal', 'Deep thinker', 'Flirty', 'Serious', 'Stoic', 'Empathetic'];
const RELATIONS = ['Partner', 'Best Friend', 'Soulmate', 'Ex', 'Sibling', 'Parent', 'Mentor', 'Rival'];
const LANGUAGES = ['English', 'Hindi', 'Hinglish'];
const REPLY_SPEEDS = ['Instant', 'Fast', 'Normal', 'Slow', 'Random'];
const DEFAULT_BEHAVIORAL_INPUT: BehavioralInputState = {
  tone: 'Supportive',
  personalityTags: [],
  notes: '',
};

const STEP_TITLES = [
  '',
  'Identity',
  'Relationship',
  'Communication',
  'Visual Evidence',
  'Profile Identity',
  'Personality Traits',
  'Advanced Mapping',
  'Final Review',
  'Manifestation',
  'Synthesis Complete'
];

const PremiumInput = ({ label, className, theme, ...rest }: React.ComponentProps<typeof Input> & { label: string, theme?: 'light' | 'dark' }) => {
  return (
    <div className="space-y-2.5 group">
      <Label className={cn("text-[11px] font-sans font-bold uppercase tracking-[0.15em] ml-1 transition-colors", theme === 'dark' ? "text-[#8696a0] group-focus-within:text-white" : "text-[#AAAAAA] group-focus-within:text-black")}>
        {label}
      </Label>
      <div className={cn("relative rounded-xl overflow-hidden transition-all border", theme === 'dark' ? "bg-[#202c33] border-[#222e35] group-focus-within:border-primary" : "bg-white border-[#E5E7EB] group-focus-within:border-black group-focus-within:shadow-[0_0_0_1px_rgba(0,0,0,1)]")}>
        <Input 
          {...rest}
          className={cn(
            "h-12 border-transparent rounded-xl px-5 font-sans font-medium text-[14px] outline-none focus-visible:ring-0 placeholder:text-[#BBBBBB] transition-all",
            theme === 'dark' ? "bg-[#202c33] text-[#e9edf0] placeholder:text-[#8696a0]" : "bg-white text-black placeholder:text-[#BBBBBB]",
            className
          )}
        />
      </div>
    </div>
  );
};

const CustomDropdown = ({ value, options, onChange, label, theme }: { value: string, options: string[], onChange: (val: any) => void, label: string, theme?: 'light' | 'dark' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="w-full" ref={containerRef}>
      <Label className={cn("text-[11px] font-sans font-bold uppercase tracking-[0.15em] ml-1 mb-2.5 block", theme === 'dark' ? "text-[#8696a0]" : "text-[#AAAAAA]")}>{label}</Label>
      <div className="relative w-full">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full h-12 rounded-xl px-5 text-[14px] font-sans font-medium flex items-center justify-between transition-all relative overflow-hidden group border",
            theme === 'dark'
              ? "bg-[#202c33] border-[#222e35] text-[#e9edf0] hover:bg-[#2a3942]"
              : "bg-white border-[#E5E7EB] text-black hover:bg-[#FAFAFA]",
            isOpen && (theme === 'dark' ? "border-primary" : "border-black shadow-[0_0_0_1px_rgba(0,0,0,1)]")
          )}
        >
          <span className="capitalize relative z-10">{value}</span>
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300 relative z-10", theme === 'dark' ? "text-[#8696a0]" : "text-[#AAAAAA]", isOpen && "rotate-180")} />
        </button>
        
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0, y: -4 }}
              animate={{ height: 'auto', opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={cn("absolute z-50 top-full left-0 right-0 mt-2 rounded-xl shadow-xl overflow-hidden py-1 border", theme === 'dark' ? "bg-[#111b21] border-[#222e35] text-[#e9edf0]" : "bg-white border-[#E5E7EB] text-black")}
            >
              {options.map((opt) => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => { onChange(opt.toLowerCase()); setIsOpen(false); }}
                  className={cn(
                    "w-full px-5 py-1 text-left text-[14px] font-sans transition-all flex items-center justify-between",
                    value.toLowerCase() === opt.toLowerCase() 
                      ? (theme === 'dark' ? "bg-[#202c33] text-white font-semibold" : "bg-[#FAFAFA] text-black font-semibold") 
                      : (theme === 'dark' ? "text-[#8696a0] hover:bg-[#202c33] hover:text-[#e9edf0]" : "text-[#666666] hover:bg-[#FAFAFA] hover:text-black")
                  )}
                >
                  <span className="capitalize">{opt}</span>
                  {value.toLowerCase() === opt.toLowerCase() && <div className={cn("w-1.5 h-1.5 rounded-full", theme === 'dark' ? "bg-white" : "bg-black")} />}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default function CreateAgent({ 
  agents, 
  onAddAgent, 
  onUpdateAgent, 
  onDeleteAgent, 
  onTogglePin, 
  onToggleArchive,
  onLaunchAgentChat,
  theme
}: CreateAgentProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [generatedAgent, setGeneratedAgent] = useState<Agent | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isProfileImageUploading, setIsProfileImageUploading] = useState(false);
  const [profileImageUploadError, setProfileImageUploadError] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: 'female' as Gender,
    language: 'English',
    relation: 'Partner',
    traits: [] as string[],
    sliders: {
      humor: 50,
      emotion: 50,
    },
    chatHistory: '',
    commMethod: null as UploadMode | null,
    behavioralInput: DEFAULT_BEHAVIORAL_INPUT,
    autonomousPings: true,
    uploadedFiles: [] as UploadedKnowledgeFile[],
    images: [] as string[],
    profileImage: '' as string,
    profileImagePreview: '' as string,
    behaviorRule: '',
    replySpeed: 'Normal',
    agreed: false
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const profileImageInputRef = useRef<HTMLInputElement | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const isStepValid = (step: number) => {
    switch (step) {
      case 1: return !!formData.name && !!formData.age;
      case 2: return !!formData.relation;
      case 3:
        if (!formData.commMethod) {
          return false;
        }

        if (formData.commMethod === 'upload') {
          return formData.uploadedFiles.some(file => file.status === 'success');
        }

        if (formData.commMethod === 'paste') {
          return formData.chatHistory.trim().length > 0;
        }

        return (
          formData.behavioralInput.notes.trim().length > 0 ||
          formData.behavioralInput.personalityTags.length > 0
        );
      case 9: return formData.agreed;
      default: return true;
    }
  };

  const clearKnowledgeUploadState = (files: UploadedKnowledgeFile[]) => {
    files.forEach(file => {
      if (file.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }
    });
  };

  const resetForm = () => {
    clearKnowledgeUploadState(formData.uploadedFiles);
    setCurrentStep(1);
    setIsEditing(false);
    setEditingAgentId(null);
    setProfileImageUploadError(null);
    setIsProfileImageUploading(false);
    setFormData({
      name: '',
      age: '',
      gender: 'female',
      language: 'English',
      relation: 'Partner',
      traits: [],
      sliders: { humor: 50, emotion: 50 },
      chatHistory: '',
      commMethod: null,
      behavioralInput: { ...DEFAULT_BEHAVIORAL_INPUT },
      autonomousPings: true,
      uploadedFiles: [],
      images: [],
      profileImage: '',
      profileImagePreview: '',
      behaviorRule: '',
      replySpeed: 'Normal',
      agreed: false
    });
  };

  const scrollToTop = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const nextStep = () => {
    if (currentStep < 10 && isStepValid(currentStep)) {
      setCurrentStep(currentStep + 1);
      scrollToTop();
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      scrollToTop();
    }
  };

  const toggleTrait = (trait: string) => {
    setFormData(prev => ({
      ...prev,
      traits: prev.traits.includes(trait) 
        ? prev.traits.filter(t => t !== trait)
        : [...prev.traits, trait]
      }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const newImages = files.map(f => URL.createObjectURL(f as File));
      setFormData(prev => ({ ...prev, images: [...prev.images, ...newImages] }));
    }
  };

  const handleProfileImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setProfileImageUploadError('Please choose a valid image file.');
      e.target.value = '';
      return;
    }

    const previousImage = formData.profileImage;
    const previousPreviewImage = formData.profileImagePreview;
    const previewUrl = URL.createObjectURL(file);

    setProfileImageUploadError(null);
    setSubmitError(null);
    setIsProfileImageUploading(true);
    setFormData(prev => ({
      ...prev,
      profileImagePreview: previewUrl,
    }));

    void (async () => {
      try {
        ensureAuthenticatedUpload();

        const { uploadUrl, fileUrl, fileViewUrl } = await createUploadSession({
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
        });

        await uploadFileToS3(uploadUrl, file);

        setFormData(prev => ({
          ...prev,
          profileImage: fileUrl,
          profileImagePreview: fileViewUrl || previewUrl,
        }));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to upload avatar. Please try again.';

        setFormData(prev => ({
          ...prev,
          profileImage: previousImage,
          profileImagePreview: previousPreviewImage,
        }));
        setProfileImageUploadError(message);
      } finally {
        setIsProfileImageUploading(false);
        e.target.value = '';
      }
    })();
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  };

  const openProfileImagePicker = () => {
    if (isProfileImageUploading) {
      return;
    }

    profileImageInputRef.current?.click();
  };

  const handleSubmit = async () => {
    if (!formData.agreed) return;
    setIsLoading(true);
    setSubmitError(null);

    try {
      const payload = {
        name: formData.name || 'Untitled Persona',
        age: parseInt(formData.age) || undefined,
        gender: formData.gender,
        language: formData.language,
        traits: formData.traits,
        speakingStyle:
          formData.commMethod === 'behavioral'
            ? formData.behavioralInput.personalityTags
            : formData.traits,
        emotionalTone: formData.behavioralInput.tone.toLowerCase(),
        relationshipType: formData.relation,
        replyBehavior: formData.replySpeed,
        modelProvider: 'groq',
        personaConfig: {
          avatar: formData.profileImage || undefined,
          rawText: formData.chatHistory,
          uploadedFileIds: formData.uploadedFiles
            .filter(file => file.status === 'success')
            .map(file => file.fileId),
          behavioralNotes: formData.behavioralInput.notes,
          profileImage: formData.profileImage,
          knowledgeMode: formData.commMethod,
          autonomousPings: formData.autonomousPings,
          behaviorRule: formData.behaviorRule,
        },
      };

      const response =
        isEditing && editingAgentId
          ? await updatePersonaRequest(editingAgentId, payload)
          : await createPersona(payload);

      const agentData = mapPersonaToAgent(response.persona);

      if (isEditing) {
        onUpdateAgent(agentData);
      } else {
        onAddAgent(agentData);
      }

      setGeneratedAgent(agentData);
      setIsEditing(false);
      setEditingAgentId(null);
      setCurrentStep(10);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save persona';
      setSubmitError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (agent: Agent) => {
    clearKnowledgeUploadState(formData.uploadedFiles);
    setIsEditing(true);
    setEditingAgentId(agent.id);
    setCurrentStep(1);
    setProfileImageUploadError(null);
    setIsProfileImageUploading(false);
    
    // Parse personality and tagline to restore form data as much as possible
    const taglineParts = (agent.tagline || '').split(' • ');
    
    setFormData({
      name: agent.name,
      age: agent.age?.toString() || '',
      gender: (agent.gender === 'Boy' ? 'male' : agent.gender === 'Girl' ? 'female' : agent.gender) as Gender,
      language: taglineParts[1] || 'English',
      relation: taglineParts[0] || 'Partner',
      traits: agent.personality.split(', ').filter(t => t.length > 0),
      sliders: { humor: 50, emotion: 50 },
      chatHistory: '',
      commMethod: 'behavioral',
      behavioralInput: {
        tone: 'Supportive',
        personalityTags: [],
        notes: agent.description || '',
      },
      autonomousPings: true,
      uploadedFiles: [],
      images: [],
      profileImage: agent.avatar,
      profileImagePreview: agent.avatar,
      behaviorRule: '',
      replySpeed: 'Normal',
      agreed: false
    });
    setActiveMenu(null);
  };

  return (
    <div className={cn("flex h-full font-sans overflow-hidden transition-colors duration-300", theme === 'dark' ? "bg-[#0b141a]" : "bg-white")}>
      
      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className={cn("fixed inset-0 backdrop-blur-[2px] z-[40] lg:hidden", theme === 'dark' ? "bg-black/60" : "bg-black/40")}
          />
        )}
      </AnimatePresence>
      
      {/* Left Sidebar */}
      <aside className={cn(
        "w-[300px] flex flex-col h-full shrink-0 z-[45] transition-all duration-500 ease-[0.16, 1, 0.3, 1] lg:translate-x-0 lg:shadow-none border-r",
        theme === 'dark' ? "border-[#222e35] bg-[#111b21]" : "border-[#F0F0F0] bg-white",
        isSidebarOpen ? (theme === 'dark' ? "fixed inset-y-0 left-0 translate-x-0 bg-[#111b21] shadow-2xl shadow-black/80" : "fixed inset-y-0 left-0 translate-x-0 bg-white shadow-2xl") : "fixed inset-y-0 left-0 -translate-x-full lg:static lg:flex"
      )}>
        <div className="p-8 pb-6 shrink-0 space-y-6">
           <div className="flex items-center justify-between">
              <h2 className={cn("text-[14px] font-serif font-black tracking-tight uppercase", theme === 'dark' ? "text-white" : "text-black")}>Personas</h2>
              <div className={cn("text-[9px] font-sans font-black border px-2.5 py-1 rounded-full uppercase tracking-widest", theme === 'dark' ? "text-white/40 border-white/5 bg-[#202c33]" : "text-black/40 border-black/5 bg-[#FAFAFA]")}>{agents.length} TOTAL</div>
           </div>
           <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#CCCCCC] transition-colors group-focus-within:text-black" strokeWidth={2.5} />
              <input 
                type="text"
                placeholder="Search matrix..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={cn("w-full h-11 border-none rounded-2xl pl-10 pr-4 text-[13px] font-sans font-medium outline-none transition-all focus:ring-1 placeholder:text-[#8696a0]", theme === 'dark' ? "bg-[#202c33] text-[#e9edf0] focus:bg-[#2a3942] focus:ring-primary/20" : "bg-[#FAFAFA] hover:bg-[#F5F5F5] text-black focus:bg-white focus:ring-black/5")}
              />
           </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-5 space-y-10 pb-10">
           {/* Pinned Section */}
           {agents.filter(a => a.isPinned && !a.isArchived).length > 0 && (
             <div className="space-y-3">
               <div className="flex items-center justify-between px-3 text-[10px] font-black text-[#BBBBBB] uppercase tracking-[0.2em]">
                 <span>Pinned</span>
                 <Pin className="w-3 h-3 opacity-30" />
               </div>
               <div className="space-y-1 sm:space-y-2">
                 <AnimatePresence>
                   {agents.filter(a => a.isPinned && !a.isArchived && a.name.toLowerCase().includes(searchQuery.toLowerCase())).map((agent) => (
                     <PersonaItem 
                      key={agent.id} 
                      agent={agent} 
                      activePersonaId={activePersonaId} 
                      activeMenu={activeMenu}
                      setActivePersonaId={(id) => { setActivePersonaId(id); setIsSidebarOpen(false); }}
                      setActiveMenu={setActiveMenu}
                      handleEdit={(agent) => { handleEdit(agent); setIsSidebarOpen(false); }}
                      onDeleteAgent={onDeleteAgent}
                      onTogglePin={onTogglePin}
                      onToggleArchive={onToggleArchive}
                      formData={formData}
                      theme={theme}
                     />
                    ))}
                 </AnimatePresence>
               </div>
             </div>
           )}

           {/* Active Section */}
           <div className="space-y-3">
             <div className="px-3 text-[10px] font-black text-[#BBBBBB] uppercase tracking-[0.2em]">
               Active
             </div>
             <div className="space-y-1 sm:space-y-2">
               <AnimatePresence>
                 {agents.filter(a => !a.isPinned && !a.isArchived && a.name.toLowerCase().includes(searchQuery.toLowerCase())).map((agent) => (
                   <PersonaItem 
                    key={agent.id} 
                    agent={agent} 
                    activePersonaId={activePersonaId} 
                    activeMenu={activeMenu}
                    setActivePersonaId={(id) => { setActivePersonaId(id); setIsSidebarOpen(false); }}
                    setActiveMenu={setActiveMenu}
                    handleEdit={(agent) => { handleEdit(agent); setIsSidebarOpen(false); }}
                    onDeleteAgent={onDeleteAgent}
                    onTogglePin={onTogglePin}
                    onToggleArchive={onToggleArchive}
                    formData={formData}
                    theme={theme}
                   />
                 ))}
                 {activePersonaId && !agents.find(a => a.id === activePersonaId) && (
                   <PersonaItem 
                    agent={{ id: activePersonaId, name: formData.name || 'Untitled', status: 'SYNTHESIZING', avatar: '' } as any} 
                    activePersonaId={activePersonaId} 
                    activeMenu={activeMenu}
                    setActivePersonaId={(id) => { setActivePersonaId(id); setIsSidebarOpen(false); }}
                    setActiveMenu={setActiveMenu}
                    handleEdit={(agent) => { handleEdit(agent); setIsSidebarOpen(false); }}
                    onDeleteAgent={onDeleteAgent}
                    onTogglePin={onTogglePin}
                    onToggleArchive={onToggleArchive}
                    formData={formData}
                    theme={theme}
                   />
                 )}
               </AnimatePresence>
             </div>
           </div>

           {/* Archived Section */}
           {agents.filter(a => a.isArchived).length > 0 && (
             <div className="space-y-3">
               <div className="px-3 text-[10px] font-black text-[#BBBBBB] uppercase tracking-[0.2em]">
                 Archived
               </div>
               <div className="space-y-1 sm:space-y-2">
                 <AnimatePresence>
                   {agents.filter(a => a.isArchived && a.name.toLowerCase().includes(searchQuery.toLowerCase())).map((agent) => (
                     <PersonaItem 
                      key={agent.id} 
                      agent={agent} 
                      activePersonaId={activePersonaId} 
                      activeMenu={activeMenu}
                      setActivePersonaId={(id) => { setActivePersonaId(id); setIsSidebarOpen(false); }}
                      setActiveMenu={setActiveMenu}
                      handleEdit={(agent) => { handleEdit(agent); setIsSidebarOpen(false); }}
                      onDeleteAgent={onDeleteAgent}
                      onTogglePin={onTogglePin}
                      onToggleArchive={onToggleArchive}
                      formData={formData}
                      theme={theme}
                     />
                   ))}
                 </AnimatePresence>
               </div>
             </div>
           )}
        </div>

        <div className={cn("p-6 shrink-0 border-t backdrop-blur-md", theme === 'dark' ? "border-[#222e35] bg-[#111b21]/50" : "border-[#F5F5F7] bg-[#FAFAFA]/50")}>
           <Button 
            onClick={() => { resetForm(); setIsSidebarOpen(false); }}
            variant="ghost"
            className={cn("w-full h-11 rounded-2xl font-black uppercase tracking-[0.15em] text-[10px] transition-all flex items-center justify-center gap-2 group shadow-[0_4px_12px_rgba(0,0,0,0.03)] hover:shadow-lg active:scale-[0.98] border", theme === 'dark' ? "bg-[#202c33] border-white/5 text-[#e9edf0] hover:bg-[#2a3942] hover:text-white hover:border-[#222e35]" : "bg-white border-[#E5E7EB] text-black hover:bg-black hover:text-white hover:border-black hover:shadow-black/10")}
           >
             <Plus className="w-3.5 h-3.5 transition-transform group-hover:rotate-90" strokeWidth={3} />
             New Persona
           </Button>
        </div>
      </aside>

      {/* Main Area */}
      <main className={cn("flex-1 flex flex-col h-full relative overflow-hidden transition-colors duration-300", theme === 'dark' ? "bg-[#0b141a]" : "bg-white")}>
        {/* Header - Mobile Optimized */}
        <header className={cn("h-14 sm:h-20 px-3 sm:px-16 flex items-center justify-between shrink-0 z-20 border-b transition-colors duration-300", theme === 'dark' ? "border-[#222e35] bg-[#111b21]" : "border-[#F0F0F0] bg-white")}>
           <div className="flex items-center gap-2 sm:gap-10 overflow-hidden">
              <Button 
                variant="ghost" 
                onClick={() => setIsSidebarOpen(true)}
                className={cn("lg:hidden px-2.5 h-9 rounded-xl active:scale-95 transition-all flex items-center gap-2 group border shadow-sm", theme === 'dark' ? "text-[#e9edf0] bg-[#202c33] border-white/5 hover:bg-[#2a3942]" : "text-[#111111] hover:bg-[#F7F7F8] border-[#F0E7FF] bg-white")}
              >
                <Library className="w-4 h-4 text-primary" />
                <span className="text-[9px] font-black uppercase tracking-[0.1em] hidden xs:block">Models</span>
              </Button>
              <h1 className={cn("text-[18px] sm:text-[28px] font-serif font-black tracking-tighter shrink-0", theme === 'dark' ? "text-white" : "text-black")}>Rekindle.</h1>
              <div className={cn("h-5 sm:h-8 w-px hidden sm:block", theme === 'dark' ? "bg-[#222e35]" : "bg-[#F5F5F5]")} />
              <div className="flex items-center gap-2 sm:gap-6 overflow-hidden">
                 {isEditing && (
                    <div className="flex items-center gap-2 shrink-0">
                       <Button 
                         variant="ghost" 
                         onClick={resetForm}
                         className={cn("hidden sm:flex text-[10px] sm:text-[11px] font-sans font-bold uppercase tracking-widest px-2 sm:px-4 h-7 sm:h-8 rounded-lg", theme === 'dark' ? "text-[#8696a0] hover:text-red-400 hover:bg-red-950/20" : "text-[#AAAAAA] hover:text-red-500 hover:bg-red-50")}
                       >
                         Cancel
                       </Button>
                       <Button 
                         onClick={handleSubmit}
                         className={cn("text-[9px] sm:text-[11px] px-2.5 sm:px-5 h-7 sm:h-9 rounded-lg font-sans font-black uppercase tracking-widest shadow-lg transition-all flex items-center gap-1.5 hover:-translate-y-0.5", theme === 'dark' ? "bg-white text-black hover:bg-zinc-200 shadow-white/5" : "bg-black text-white hover:bg-black/90 shadow-black/10")}
                       >
                         <Zap className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                         Update
                       </Button>
                    </div>
                 )}
                 <span className={cn("text-[8px] sm:text-[11px] font-sans font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] truncate max-w-[60px] sm:max-w-none", theme === 'dark' ? "text-[#8696a0]" : "text-[#CCCCCC]")}>{STEP_TITLES[currentStep]}</span>
                 <div className={cn("h-0.5 w-8 sm:w-20 rounded-full overflow-hidden shrink-0 hidden min-[400px]:block", theme === 'dark' ? "bg-[#202c33]" : "bg-[#F5F5F5]")}>
                    <motion.div 
                      className={cn("h-full shadow-[0_0_10px_rgba(0,0,0,0.1)]", theme === 'dark' ? "bg-primary" : "bg-black")}
                      animate={{ width: `${(currentStep / 10) * 100}%` }}
                      transition={{ type: 'spring', stiffness: 50, damping: 20 }}
                    />
                 </div>
              </div>
           </div>
           
           <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end leading-tight mr-2">
                <span className={cn("text-[10px] font-black uppercase tracking-widest", theme === 'dark' ? "text-white" : "text-black")}>Preview</span>
                <span className="text-[8px] font-medium text-[#AAAAAA]">Auto-save active</span>
              </div>
              <div className={cn("w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center overflow-hidden hover:scale-105 transition-transform cursor-pointer group border", theme === 'dark' ? "bg-[#202c33] border-white/5" : "bg-[#F7F7F8] border-[#EEEEEE]")}>
                  <div className={cn("w-full h-full flex items-center justify-center transition-colors", theme === 'dark' ? "bg-[#202c33]/80 group-hover:bg-[#2a3942]" : "bg-gradient-to-br from-purple-50 to-pink-50 group-hover:from-purple-100 group-hover:to-pink-100")}>
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  </div>
              </div>
           </div>
        </header>

        {/* Builder Area - Mobile Friendly Padding */}
        <div ref={scrollRef} className={cn("flex-1 overflow-y-auto no-scrollbar scroll-smooth transition-colors duration-300", theme === 'dark' ? "bg-[#0b141a]" : "bg-white")}>
           <div className="max-w-[1100px] w-full pt-8 sm:pt-12 pb-32 px-6 sm:px-16 relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, y: 30, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.98 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-10 sm:space-y-16"
                >
                  
                  {/* Step 1: Identity */}
                  {currentStep === 1 && (
                    <section className="space-y-8 sm:space-y-12 max-w-3xl">
                      <div className="space-y-4 sm:space-y-6">
                        <motion.h2 
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={cn("text-[28px] sm:text-[32px] font-serif font-black tracking-tight", theme === 'dark' ? "text-white" : "text-black")}
                        >
                          Identity
                        </motion.h2>
                        <motion.p 
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 }}
                          className={cn("text-[15px] sm:text-[17px] font-sans font-bold leading-relaxed italic border-l-4 pl-4 sm:pl-6", theme === 'dark' ? "text-[#8696a0] border-white" : "text-muted-foreground border-black")}
                        >
                          Tell us who this person is.
                        </motion.p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 sm:gap-y-8">
                        <PremiumInput theme={theme} label="NAME" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Persona name" />
                        <PremiumInput theme={theme} label="AGE" type="text" inputMode="numeric" placeholder="Age" value={formData.age} onChange={e => setFormData(p => ({ ...p, age: e.target.value.replace(/\D/g, '') }))} />
                        <CustomDropdown theme={theme} label="GENDER" value={formData.gender} options={['Female', 'Male', 'Non-Binary']} onChange={val => setFormData(p => ({ ...p, gender: val }))} />
                        <CustomDropdown theme={theme} label="LANGUAGE" value={formData.language} options={LANGUAGES} onChange={val => setFormData(p => ({ ...p, language: val }))} />
                      </div>
                    </section>
                  )}

                  {/* Step 2: Relationship */}
                  {currentStep === 2 && (
                    <section className="space-y-8 sm:space-y-10 max-w-3xl">
                      <div className="space-y-4">
                        <h2 className={cn("text-[24px] sm:text-[28px] font-serif font-black tracking-tight uppercase", theme === 'dark' ? "text-white" : "text-black")}>Relationship</h2>
                        <b className={cn("text-[14px] sm:text-[15px] font-sans leading-relaxed block", theme === 'dark' ? "text-[#8696a0]" : "text-muted-foreground")}>What is your relation with them?</b>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                        <CustomDropdown theme={theme} label="BOND TYPE" value={formData.relation} options={RELATIONS} onChange={val => setFormData(p => ({ ...p, relation: val }))} />
                        <div className={cn("p-6 sm:p-8 border rounded-2xl flex flex-col gap-3 sm:gap-4", theme === 'dark' ? "border-[#222e35] bg-[#111b21]" : "border-[#F0F0F0] bg-[#FAFAFA]")}>
                           <span className="text-[10px] sm:text-[11px] font-sans font-bold uppercase tracking-widest text-[#999999]">Contextual Note</span>
                           <p className={cn("text-[12px] sm:text-[13px] font-sans leading-relaxed", theme === 'dark' ? "text-[#8696a0]" : "text-muted-foreground")}>This parameter influences the emotional proximity and linguistic familiarity used during synthesis.</p>
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Step 3: Communication */}
                  {currentStep === 3 && (
                    <section className="space-y-8 sm:space-y-10 max-w-2xl">
                      <div className="space-y-4">
                        <h2 className={cn("text-[24px] sm:text-[28px] font-serif font-black tracking-tight uppercase", theme === 'dark' ? "text-white" : "text-black")}>Communication</h2>
                        <b className={cn("text-[14px] sm:text-[16px] font-sans leading-relaxed block tracking-tight", theme === 'dark' ? "text-white/80" : "text-black")}>Choose one premium input channel to shape the persona knowledge base.</b>
                      </div>

                      <KnowledgeUploadPanel
                        theme={theme}
                        mode={formData.commMethod}
                        rawText={formData.chatHistory}
                        behavioralInput={formData.behavioralInput}
                        uploadedFiles={formData.uploadedFiles}
                        onModeChange={(mode) =>
                          setFormData(previous => ({
                            ...previous,
                            commMethod: mode,
                          }))
                        }
                        onRawTextChange={(value) =>
                          setFormData(previous => ({
                            ...previous,
                            chatHistory: value,
                          }))
                        }
                        onBehavioralChange={(value) =>
                          setFormData(previous => ({
                            ...previous,
                            behavioralInput: value,
                          }))
                        }
                        onUploadedFilesChange={(value) =>
                          setFormData(previous => ({
                            ...previous,
                            uploadedFiles:
                              typeof value === 'function' ? value(previous.uploadedFiles) : value,
                          }))
                        }
                      />
                    </section>
                  )}

                  {/* Step 4: Visual Evidence */}
                  {currentStep === 4 && (
                    <section className="space-y-8 sm:space-y-10 max-w-3xl">
                      <div className="space-y-3 sm:space-y-4">
                        <h2 className={cn("text-[24px] sm:text-[28px] font-serif font-black tracking-tight uppercase", theme === 'dark' ? "text-white" : "text-black")}>Visuals</h2>
                        <b className={cn("text-[14px] sm:text-[15px] font-sans leading-relaxed block", theme === 'dark' ? "text-[#8696a0]" : "text-muted-foreground")}>Upload some photos if you have any.</b>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                        {formData.images.map((img, i) => (
                           <motion.div 
                             key={i} 
                             initial={{ opacity: 0, scale: 0.9 }}
                             animate={{ opacity: 1, scale: 1 }}
                             transition={{ delay: i * 0.05 }}
                             className={cn("relative aspect-square rounded-2xl overflow-hidden group border shadow-sm", theme === 'dark' ? "border-[#222e35]" : "border-[#F0F0F0]")}
                           >
                              <img src={img} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                              <button onClick={() => removeImage(i)} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                           </motion.div>
                        ))}
                        <label className={cn("aspect-square rounded-2xl border border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group", theme === 'dark' ? "border-[#222e35] hover:bg-[#202c33] hover:border-white/20" : "border-[#E5E7EB] hover:bg-[#FAFAFA] hover:border-black/20")}>
                           <Plus className={cn("w-5 h-5 transition-transform group-hover:rotate-90", theme === 'dark' ? "text-[#8696a0]" : "text-[#CCCCCC]")} />
                           <span className={cn("text-[10px] sm:text-[11px] font-sans font-bold uppercase tracking-widest", theme === 'dark' ? "text-[#8696a0]" : "text-[#AAAAAA]")}>Attach</span>
                           <input type="file" multiple hidden onChange={handleImageUpload} accept="image/*" />
                        </label>
                      </div>
                    </section>
                  )}

                  {/* Step 5: Profile Identity */}
                  {currentStep === 5 && (
                    <section className="space-y-8 sm:space-y-10 max-w-3xl">
                      <div className="space-y-3 sm:space-y-4">
                        <h2 className={cn("text-[24px] sm:text-[28px] font-serif font-black tracking-tight uppercase", theme === 'dark' ? "text-white" : "text-black")}>Avatar</h2>
                        <b className={cn("text-[14px] sm:text-[15px] font-sans leading-relaxed block", theme === 'dark' ? "text-[#8696a0]" : "text-muted-foreground")}>Pick a profile photo for the persona.</b>
                      </div>
                      <div className="flex flex-col items-center sm:items-start gap-8 sm:gap-10">
                         <div className="relative group w-40 h-40 sm:w-48 sm:h-48">
                            <button
                              type="button"
                              onClick={openProfileImagePicker}
                              className={cn("w-full h-full rounded-2xl overflow-hidden border flex items-center justify-center relative shadow-sm group-hover:shadow-md transition-shadow text-left", theme === 'dark' ? "border-[#222e35] bg-[#111b21]" : "border-[#E5E7EB] bg-[#FAFAFA]")}
                            >
                               {formData.profileImagePreview || formData.profileImage ? (
                                   <PersonaAvatarImage
                                     src={formData.profileImagePreview || formData.profileImage}
                                     name={formData.name || 'Persona'}
                                     className="w-full h-full"
                                     imgClassName="w-full h-full object-cover"
                                     fallbackClassName={cn("w-full h-full flex items-center justify-center", theme === 'dark' ? "bg-[#111b21]" : "bg-[#FAFAFA]")}
                                   />
                               ) : (
                                  <UserPlus className={cn("w-8 h-8", theme === 'dark' ? "text-[#8696a0]" : "text-[#DDDDDD]")} />
                               )}
                               {isProfileImageUploading && (
                                 <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px] flex items-center justify-center">
                                   <div className="rounded-full border border-white/20 bg-white/15 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                                     Uploading...
                                   </div>
                                 </div>
                               )}
                            </button>
                            <button
                              type="button"
                              onClick={openProfileImagePicker}
                              className="absolute inset-0 bg-black/40 rounded-2xl flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-[2px]"
                              disabled={isProfileImageUploading}
                            >
                               <Camera className="w-6 h-6 text-white mb-2" />
                               <span className="text-[10px] sm:text-[11px] font-sans font-bold uppercase tracking-widest text-white">
                                 {isProfileImageUploading ? 'Syncing' : 'Upload'}
                               </span>
                            </button>
                            <input
                              ref={profileImageInputRef}
                              type="file"
                              hidden
                              onChange={handleProfileImageUpload}
                              accept="image/png,image/jpeg,image/webp,image/gif,image/jpg"
                              disabled={isProfileImageUploading}
                            />
                         </div>
                         <div className="max-w-xs space-y-2 text-center sm:text-left">
                           <p className={cn("text-[12px] sm:text-[13px] font-sans leading-relaxed italic", theme === 'dark' ? "text-[#8696a0]" : "text-muted-foreground")}>Select a high-resolution image that aligns with the persona's vibe.</p>
                           <Button
                             type="button"
                             variant="outline"
                             onClick={openProfileImagePicker}
                             disabled={isProfileImageUploading}
                             className={cn("mt-2 rounded-xl border px-4 text-[10px] font-black uppercase tracking-[0.18em]", theme === 'dark' ? "border-[#222e35] bg-[#202c33] text-[#e9edf0] hover:bg-[#2a3942]" : "border-[#E5E7EB] bg-white text-black hover:bg-[#FAFAFA]")}
                           >
                             {formData.profileImage ? 'Change Avatar' : 'Choose Avatar'}
                           </Button>
                           {profileImageUploadError && (
                             <p className="text-[11px] font-semibold text-[#B04D58] leading-relaxed">
                               {profileImageUploadError}
                             </p>
                           )}
                           {formData.profileImage && !profileImageUploadError && (
                             <p className={cn("text-[11px] font-semibold leading-relaxed", theme === 'dark' ? "text-[#8696a0]" : "text-[#6A6A73]")}>
                               Avatar saved from your secure upload flow and ready for the dashboard card.
                             </p>
                           )}
                          </div>
                       </div>
                       
                       <div className="space-y-6 pt-8 border-t border-dashed border-[#EEEEEE] dark:border-[#222e35]">
                          <span className={cn("text-[11px] font-sans font-bold uppercase tracking-[0.15em] block", theme === 'dark' ? "text-[#8696a0]" : "text-[#AAAAAA]")}>Or Choose a Default Avatar</span>
                          <div className="grid grid-cols-4 sm:grid-cols-8 gap-4">
                             {[
                                { name: 'Aisha', path: '/photos/aisha_01.png' },
                                { name: 'Aarav', path: '/photos/AARAV.png' },
                                { name: 'Rhea', path: '/photos/RIYA_02.png' },
                                { name: 'Ethan', path: '/photos/ETHAN.png' },
                                { name: 'Meera', path: '/photos/MEERA_03.png' },
                                { name: 'Kian', path: '/photos/KABIR.png' },
                                { name: 'Zoya', path: '/photos/ZOYA_04.png' },
                                { name: 'Elena', path: '/photos/ELENA_05.png' }
                             ].map((avatar) => {
                                const isSelected = formData.profileImage === avatar.path || formData.profileImagePreview === avatar.path;
                                return (
                                  <button
                                    key={avatar.name}
                                    type="button"
                                    onClick={() => setFormData(p => ({ ...p, profileImage: avatar.path, profileImagePreview: avatar.path }))}
                                    className={cn(
                                      "relative aspect-square rounded-2xl overflow-hidden border transition-all duration-300 hover:scale-105 active:scale-95 group",
                                      isSelected 
                                        ? "border-primary ring-2 ring-primary/20 scale-105" 
                                        : (theme === 'dark' ? "border-[#222e35] bg-[#111b21] hover:border-white/20" : "border-[#E5E7EB] bg-[#FAFAFA] hover:border-black/20")
                                    )}
                                  >
                                     <img 
                                       src={avatar.path} 
                                       alt={avatar.name} 
                                       className="w-full h-full object-cover"
                                     />
                                     <div className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-[9px] font-bold text-white uppercase tracking-wider">{avatar.name}</span>
                                     </div>
                                     {isSelected && (
                                        <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center shadow-md">
                                           <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />
                                        </div>
                                     )}
                                  </button>
                                );
                             })}
                          </div>
                       </div>
                    </section>
                  )}                  {/* Step 6: Personality Traits */}
                  {currentStep === 6 && (
                    <section className="space-y-8 sm:space-y-10 max-w-3xl">
                      <div className="space-y-3 sm:space-y-4">
                        <h2 className={cn("text-[24px] sm:text-[28px] font-serif font-black tracking-tight uppercase", theme === 'dark' ? "text-white" : "text-black")}>Personality</h2>
                        <b className={cn("text-[14px] sm:text-[16px] font-sans leading-relaxed block", theme === 'dark' ? "text-white/80" : "text-black")}>Select how they behave and think.</b>
                      </div>
                      <div className="space-y-8 sm:space-y-12">
                         <div className="flex flex-wrap gap-2 sm:gap-2.5">
                            {TRAITS.map(t => (
                              <button
                                key={t}
                                onClick={() => toggleTrait(t)}
                                className={cn(
                                  "px-4 sm:px-6 py-2 sm:py-2.5 rounded-full text-[10px] sm:text-[11px] font-sans font-bold uppercase tracking-widest border transition-all",
                                  formData.traits.includes(t) 
                                    ? (theme === 'dark' ? "bg-white text-black border-white shadow-md shadow-white/5" : "bg-black text-white border-black shadow-md shadow-black/5") 
                                    : (theme === 'dark' ? "bg-[#202c33] text-[#8696a0] border-[#222e35] hover:text-white hover:bg-[#2a3942]" : "bg-white text-[#AAAAAA] border-[#E5E7EB] hover:text-black hover:border-black/20")
                                )}
                              >
                                {t}
                              </button>
                            ))}
                         </div>
                         <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 sm:gap-y-10 p-6 sm:p-8 rounded-2xl border shadow-sm", theme === 'dark' ? "bg-[#111b21] border-[#222e35]" : "bg-[#FAFAFA] border-[#F0F0F0]")}>
                            {[
                               { id: 'humor', label: 'Humor Density' },
                               { id: 'emotion', label: 'Resonance Depth' },
                            ].map(slider => (
                              <div key={slider.id} className="space-y-4 sm:space-y-6">
                                 <div className="flex justify-between items-center text-[10px] sm:text-[11px] font-sans font-bold uppercase tracking-[0.15em] text-[#999999]">
                                    <span>{slider.label}</span>
                                    <span className={cn("font-semibold", theme === 'dark' ? "text-white" : "text-black")}>{formData.sliders[slider.id as keyof typeof formData.sliders]}%</span>
                                 </div>
                                 <div className={cn("relative h-1.5 w-full rounded-full overflow-visible", theme === 'dark' ? "bg-[#202c33]" : "bg-[#E5E7EB]")}>
                                      <motion.div className={cn("h-full rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)]", theme === 'dark' ? "bg-white" : "bg-black")} animate={{ width: `${formData.sliders[slider.id as keyof typeof formData.sliders]}%` }} />
                                      <input type="range" min="0" max="100" value={formData.sliders[slider.id as keyof typeof formData.sliders]} onChange={e => setFormData(p => ({ ...p, sliders: { ...p.sliders, [slider.id]: parseInt(e.target.value) } }))} className="absolute inset-0 opacity-0 cursor-pointer h-full w-full" />
                                      <div 
                                        className={cn("absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full shadow-md pointer-events-none transition-transform group-active:scale-110 border-2", theme === 'dark' ? "bg-[#0b141a] border-white" : "bg-white border-black")} 
                                        style={{ left: `calc(${formData.sliders[slider.id as keyof typeof formData.sliders]}% - 7px)` }}
                                      />
                                 </div>
                              </div>
                            ))}
                         </div>
                      </div>
                    </section>
                  )}

                  {/* Step 7: Advanced Mapping */}
                  {currentStep === 7 && (
                    <section className="space-y-8 sm:space-y-10 max-w-3xl">
                       <div className="space-y-3 sm:space-y-4">
                        <h2 className={cn("text-[24px] sm:text-[28px] font-serif font-bold tracking-tight uppercase", theme === 'dark' ? "text-white" : "text-black")}>Advanced Mapping</h2>
                        <p className={cn("text-[14px] sm:text-[15px] font-sans font-semibold leading-relaxed", theme === 'dark' ? "text-[#8696a0]" : "text-muted-foreground")}>Set some special rules and reply speed.</p>
                      </div>
                      <div className="space-y-8 sm:space-y-12">
                        <div className="space-y-3 sm:space-y-4">
                           <Label className="text-[10px] sm:text-[11px] font-sans font-bold uppercase tracking-[0.15em] text-[#AAAAAA] ml-1">DIRECTIVE INTERFACE</Label>
                           <textarea 
                             value={formData.behaviorRule} 
                             onChange={e => setFormData(p => ({ ...p, behaviorRule: e.target.value }))} 
                             placeholder="Ex: Never use emojis, keep replies concise and analytical..." 
                             className={cn("w-full h-32 sm:h-40 border rounded-2xl p-4 sm:p-6 font-sans text-[13px] sm:text-[14px] font-medium resize-none outline-none transition-colors", theme === 'dark' ? "bg-[#202c33] border-[#222e35] text-[#e9edf0] focus:border-white placeholder:text-[#8696a0]" : "bg-white border-[#E5E7EB] text-black focus:border-black placeholder:text-[#BBBBBB]")} 
                           />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 items-start">
                          <CustomDropdown theme={theme} label="TEMPORAL CADENCE" value={formData.replySpeed} options={REPLY_SPEEDS} onChange={val => setFormData(p => ({ ...p, replySpeed: val }))} />
                           <div className="space-y-3 sm:space-y-4">
                              <Label className="text-[10px] sm:text-[11px] font-sans font-bold uppercase tracking-[0.15em] text-[#AAAAAA] ml-1">AUTONOMY NODE</Label>
                              <div className={cn("flex items-center justify-between p-4 sm:p-6 rounded-2xl border", theme === 'dark' ? "bg-[#111b21] border-[#222e35]" : "bg-[#FAFAFA] border-[#F0F0F0]")}>
                                 <div className="space-y-0.5">
                                    <span className={cn("text-[13px] sm:text-[14px] font-sans font-semibold block", theme === 'dark' ? "text-white" : "text-black")}>Autonomous Pings</span>
                                    <p className={cn("text-[11px] sm:text-[12px] font-sans", theme === 'dark' ? "text-[#8696a0]" : "text-muted-foreground")}>Allow persona to initiate interactions.</p>
                                 </div>
                                 <Switch 
                                   className={cn("scale-90 sm:scale-100", theme === 'dark' ? "data-[state=checked]:bg-white data-[state=unchecked]:bg-zinc-700" : "data-[state=checked]:bg-black")} 
                                   checked={formData.autonomousPings}
                                   onCheckedChange={(val) => setFormData(p => ({ ...p, autonomousPings: val }))}
                                  />
                              </div>
                           </div>
                        </div>
                      </div>
                    </section>
                  )}
                  {/* Step 8: Final Review */}
                  {currentStep === 8 && (
                    <section className="space-y-8 sm:space-y-10 max-w-3xl">
                       <div className="space-y-3 sm:space-y-4">
                        <h2 className={cn("text-[24px] sm:text-[28px] font-serif font-bold tracking-tight uppercase", theme === 'dark' ? "text-white" : "text-black")}>Review</h2>
                        <p className={cn("text-[14px] sm:text-[15px] font-sans font-semibold leading-relaxed", theme === 'dark' ? "text-[#8696a0]" : "text-muted-foreground")}>Check everything before we start.</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 sm:gap-y-10">
                         {[
                           { label: 'Identity', value: `${formData.name}, ${formData.age}, ${formData.gender}` },
                           { label: 'Bond', value: formData.relation },
                           { label: 'Language', value: formData.language },
                           { label: 'Traits', value: formData.traits.join(', ') || 'Default' },
                           {
                             label: 'Synthesis',
                             value:
                               formData.commMethod === 'upload'
                                 ? `${formData.uploadedFiles.filter(file => file.status === 'success').length} Uploaded Sources`
                                 : formData.commMethod === 'paste'
                                   ? 'Raw Text Input'
                                   : formData.commMethod === 'behavioral'
                                     ? 'Behavioral Input'
                                     : 'Not Set',
                           },
                           { label: 'Cadence', value: `${formData.replySpeed}` },
                         ].map((item, i) => (
                           <div key={i} className={cn("space-y-1.5 sm:space-y-2 border-b pb-4 sm:pb-6", theme === 'dark' ? "border-[#222e35]" : "border-[#F5F5F5]")}>
                              <p className={cn("text-[10px] sm:text-[11px] font-sans font-bold uppercase tracking-widest", theme === 'dark' ? "text-[#8696a0]" : "text-[#CCCCCC]")}>{item.label}</p>
                              <p className={cn("text-[14px] sm:text-[16px] font-sans font-semibold truncate", theme === 'dark' ? "text-white" : "text-black")}>{item.value}</p>
                           </div>
                         ))}
                      </div>
                    </section>
                  )}
                   {/* Step 9: Manifestation */}
                   {currentStep === 9 && (
                     <section className="space-y-8 sm:space-y-12 py-4 sm:py-10 w-full animate-in fade-in slide-in-from-bottom-8 duration-1000">
                        <div className="space-y-4 sm:space-y-6">
                           <h2 className={cn("text-[28px] sm:text-[32px] font-serif font-black tracking-tight uppercase", theme === 'dark' ? "text-white" : "text-black")}>Manifestation</h2>
                           <b className={cn("text-[14px] sm:text-[16px] font-sans leading-relaxed italic block", theme === 'dark' ? "text-white/80" : "text-black")}>Please read and agree to these rules before we begin.</b>
                        </div>
 
                       <div className="space-y-8 sm:space-y-10 w-full max-w-none">
                          <div className={cn("p-6 sm:p-12 rounded-[32px] sm:rounded-[48px] text-[14px] sm:text-[16px] font-sans font-medium leading-relaxed space-y-6 sm:space-y-8 max-h-[400px] sm:max-h-[550px] overflow-y-auto no-scrollbar scroll-smooth shadow-2xl", theme === 'dark' ? "bg-[#111b21] border border-[#222e35] text-white" : "bg-black text-white")}>
                            <p>1. This AI persona is a digital approximation derived from historical interaction data and behavioral modeling.</p>
                            <p>2. You confirm that you have the ethical right or explicit permission to recreate this specific identity matrix.</p>
                            <p>3. The manifestation is intended for therapeutic, nostalgic, or creative use and must not be used for malicious impersonation.</p>
                            <p>4. Emotional boundary acknowledgment: This simulation does not possess real consciousness or persistent physical existence.</p>
                            <p>5. Data usage: All provided logs are processed locally for synthesis and handled according to privacy protocols.</p>
                            <p>6. You agree to hold the platform harmless from any emotional impact or dependency resulting from the simulation.</p>
                          </div>
 
                          <div className="space-y-6">
                              <div 
                                className="flex items-center gap-4 sm:gap-5 cursor-pointer group"
                                onClick={() => setFormData(p => ({ ...p, agreed: !p.agreed }))}
                              >
                                 <div className={cn(
                                   "w-6 h-6 rounded-lg border transition-all flex items-center justify-center shrink-0",
                                   formData.agreed 
                                     ? (theme === 'dark' ? "bg-white border-white" : "bg-black border-black") 
                                     : (theme === 'dark' ? "border-[#222e35] group-hover:border-[#8696a0]" : "border-[#E5E7EB] group-hover:border-[#AAAAAA]")
                                 )}>
                                    {formData.agreed && <Check className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", theme === 'dark' ? "text-black" : "text-white")} strokeWidth={4} />}
                                 </div>
                                 <span className={cn("text-[11px] sm:text-[13px] font-sans font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] transition-colors leading-tight", formData.agreed ? (theme === 'dark' ? "text-white" : "text-black") : (theme === 'dark' ? "text-[#8696a0]" : "text-[#CCCCCC]"))}>I confirm ethical synthesis, data permissions and simulation nature</span>
                              </div>
                          </div>
 
                          <Button 
                            className={cn("w-full h-14 sm:h-16 rounded-2xl font-sans font-bold uppercase text-[11px] sm:text-[12px] tracking-[0.2em] sm:tracking-[0.3em] transition-all active:scale-[0.98] disabled:opacity-20 mt-4 sm:mt-8 shadow-xl", theme === 'dark' ? "bg-white text-black hover:bg-white/90 shadow-white/5" : "bg-black text-white hover:bg-black/90 shadow-black/10")}
                            onClick={handleSubmit}
                            disabled={!formData.agreed || isLoading}
                          >
                            {isLoading ? 'Synthesizing...' : 'Initialize Synthesis'}
                          </Button>
 
                          {isLoading && (
                            <motion.div 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="flex items-center justify-center gap-3"
                            >
                               <div className={cn("w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-bounce [animation-delay:-0.3s]", theme === 'dark' ? "bg-white" : "bg-black")} />
                               <div className={cn("w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-bounce [animation-delay:-0.15s]", theme === 'dark' ? "bg-white" : "bg-black")} />
                               <div className={cn("w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-bounce", theme === 'dark' ? "bg-white" : "bg-black")} />
                            </motion.div>
                          )}
                       </div>
                     </section>
                   )}
                  {/* Step 10: Synthesis Complete */}
                  {currentStep === 10 && (
                    <section className="flex flex-col items-center justify-center min-h-[50vh] sm:min-h-[60vh] py-10 sm:py-20 w-full animate-in fade-in zoom-in duration-700">
                       <motion.div 
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={cn("w-full max-w-md border rounded-[32px] sm:rounded-[40px] p-8 sm:p-12 flex flex-col items-center text-center space-y-8 sm:space-y-10 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] relative overflow-hidden", theme === 'dark' ? "bg-[#111b21] border-[#222e35]" : "bg-white border-[#F0F0F0]")}
                       >
                          <div className={cn("absolute top-0 left-0 w-full h-1.5 sm:h-2", theme === 'dark' ? "bg-white" : "bg-black")} />
                          
                          <motion.div 
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', damping: 12, delay: 0.3 }}
                            className={cn("w-16 h-16 sm:w-20 sm:h-20 rounded-[24px] sm:rounded-[28px] flex items-center justify-center relative shadow-xl shadow-black/20", theme === 'dark' ? "bg-white" : "bg-black")}
                          >
                             <Check className={cn("w-6 h-6 sm:w-8 sm:h-8", theme === 'dark' ? "text-black" : "text-white")} strokeWidth={4} />
                          </motion.div>

                          <div className="space-y-3 sm:space-y-4">
                             <h2 className={cn("text-[28px] sm:text-[36px] font-serif font-black tracking-tight", theme === 'dark' ? "text-white" : "text-black")}>Manifested.</h2>
                             <b className={cn("text-[15px] sm:text-[18px] font-sans leading-relaxed block px-2 sm:px-4", theme === 'dark' ? "text-[#8696a0]" : "text-muted-foreground")}>
                                The persona <span className={cn("underline underline-offset-8", theme === 'dark' ? "text-white decoration-white/20" : "text-black decoration-black/20")}>{formData.name}</span> is ready for interaction.
                             </b>
                          </div>

                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="w-full pt-2 sm:pt-4"
                          >
                            <Button 
                              onClick={() => generatedAgent && onLaunchAgentChat?.(generatedAgent.id)}
                              className={cn("w-full h-14 sm:h-16 rounded-2xl font-sans font-bold uppercase text-[11px] sm:text-[12px] tracking-[0.3em] sm:tracking-[0.4em] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl", theme === 'dark' ? "bg-white text-black hover:bg-white/90 shadow-white/5" : "bg-black text-white hover:bg-black/90 shadow-black/20")}
                            >
                               Launch Persona
                            </Button>
                          </motion.div>
                       </motion.div>
                    </section>
                  )}
                </motion.div>
              </AnimatePresence>
           </div>
        </div>

        {submitError && (
          <div className="px-6 sm:px-16 pb-3">
            <div className="rounded-2xl border border-[#F2D8DA] bg-[#FFF7F7] px-4 py-3 text-[12px] text-[#8E4047]">
              {submitError}
            </div>
          </div>
        )}

        {/* Action Bar - Mobile Optimized */}
        <footer className={cn("h-20 sm:h-24 px-6 sm:px-16 border-t flex items-center justify-between z-20 shrink-0", theme === 'dark' ? "border-[#222e35] bg-[#111b21]" : "border-[#F5F5F5] bg-white")}>
           <Button 
            onClick={prevStep} 
            disabled={currentStep === 1 || currentStep === 10 || isLoading || isProfileImageUploading} 
            variant="ghost" 
            className={cn("h-10 sm:h-12 rounded-xl px-4 sm:px-10 text-[10px] sm:text-[11px] font-sans font-bold uppercase tracking-[0.2em] transition-all", theme === 'dark' ? "text-[#8696a0] hover:text-white hover:bg-[#202c33]" : "text-[#AAAAAA] hover:text-black hover:bg-[#FAFAFA]")}
           >
              Back
           </Button>
           
           <div className="flex-1 flex justify-center sm:justify-start sm:pl-12 sm:pr-12">
              <div className="flex gap-1.5 sm:gap-2">
                 {Array.from({ length: 10 }).map((_, i) => (
                   <div 
                    key={i} 
                    className={cn(
                      "h-1 rounded-full transition-all duration-700",
                      currentStep === i + 1 
                        ? (theme === 'dark' ? "bg-white w-6 sm:w-10 shadow-[0_0_8px_rgba(255,255,255,0.15)]" : "bg-black w-6 sm:w-10 shadow-[0_0_8px_rgba(0,0,0,0.1)]") 
                        : i + 1 < currentStep 
                          ? (theme === 'dark' ? "bg-white/40 w-2 sm:w-4" : "bg-black/10 w-2 sm:w-4") 
                          : (theme === 'dark' ? "bg-white/10 w-2 sm:w-4" : "bg-[#F0F0F0] w-2 sm:w-4")
                    )} 
                   />
                 ))}
              </div>
           </div>

           <Button 
            onClick={nextStep} 
            disabled={!isStepValid(currentStep) || currentStep >= 9 || isLoading || isProfileImageUploading} 
            className={cn(
              "h-10 sm:h-12 rounded-xl px-6 sm:px-12 text-[10px] sm:text-[11px] font-sans font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] transition-all active:scale-95 disabled:opacity-20",
              theme === 'dark' 
                ? "bg-white text-black hover:bg-white/90 shadow-xl shadow-white/5" 
                : "bg-black text-white hover:bg-black/90 shadow-xl shadow-black/10",
              (currentStep >= 9 || !isStepValid(currentStep)) && "opacity-20"
            )}
           >
              {currentStep === 9 ? 'Initialize' : 'Continue'}
           </Button>
        </footer>
      </main>
    </div>
  );
}
