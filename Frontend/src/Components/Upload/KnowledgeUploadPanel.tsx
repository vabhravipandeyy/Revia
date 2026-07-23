import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  Check,
  FileImage,
  FileText,
  LoaderCircle,
  Sparkles,
  Type,
  Upload,
  X,
} from 'lucide-react';
import {
  BehavioralInputState,
  UploadedKnowledgeFile,
  UploadMode,
} from '@/src/types';
import {
  createUploadSession,
  ensureAuthenticatedUpload,
  uploadFileToS3,
} from '@/src/services/uploadService';
import { ApiError } from '@/src/utils/apiFetch';

type UploadedFilesSetter = React.Dispatch<React.SetStateAction<UploadedKnowledgeFile[]>>;

interface KnowledgeUploadPanelProps {
  mode: UploadMode | null;
  rawText: string;
  behavioralInput: BehavioralInputState;
  uploadedFiles: UploadedKnowledgeFile[];
  onModeChange: (mode: UploadMode) => void;
  onRawTextChange: (value: string) => void;
  onBehavioralChange: (value: BehavioralInputState) => void;
  onUploadedFilesChange: UploadedFilesSetter;
  theme?: 'light' | 'dark';
}

const FILE_TYPES = [
  'text/plain',
  'text/csv',
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];

const PERSONALITY_TAGS = [
  'Calm',
  'Analytical',
  'Warm',
  'Playful',
  'Direct',
  'Curious',
  'Patient',
  'Reflective',
];

const TONE_OPTIONS = ['Supportive', 'Professional', 'Casual', 'Reflective', 'High-energy'];

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileKind(file: File) {
  if (file.type.startsWith('image/')) {
    return 'image';
  }

  if (file.type === 'text/plain' || file.type === 'text/csv') {
    return 'text';
  }

  return 'document';
}

async function buildLocalPreview(file: File) {
  const kind = getFileKind(file);

  if (kind === 'image') {
    return {
      previewUrl: URL.createObjectURL(file),
    };
  }

  if (kind === 'text') {
    const previewText = (await file.text()).slice(0, 320);
    return { previewText };
  }

  return {};
}

export default function KnowledgeUploadPanel({
  mode,
  rawText,
  behavioralInput,
  uploadedFiles,
  onModeChange,
  onRawTextChange,
  onBehavioralChange,
  onUploadedFilesChange,
  theme = 'dark',
}: KnowledgeUploadPanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const rawTextRef = useRef<HTMLTextAreaElement | null>(null);
  const behavioralNotesRef = useRef<HTMLTextAreaElement | null>(null);

  const hasSuccessfulUpload = uploadedFiles.some(file => file.status === 'success');
  const isUploading = uploadedFiles.some(file => file.status === 'uploading');

  useEffect(() => {
    if (!rawTextRef.current) {
      return;
    }

    rawTextRef.current.style.height = '0px';
    rawTextRef.current.style.height = `${Math.max(rawTextRef.current.scrollHeight, 180)}px`;
  }, [rawText]);

  useEffect(() => {
    if (!behavioralNotesRef.current) {
      return;
    }

    behavioralNotesRef.current.style.height = '0px';
    behavioralNotesRef.current.style.height = `${Math.max(behavioralNotesRef.current.scrollHeight, 180)}px`;
  }, [behavioralInput.notes]);

  useEffect(() => {
    return () => {
      uploadedFiles.forEach(file => {
        if (file.previewUrl) {
          URL.revokeObjectURL(file.previewUrl);
        }
      });
    };
  }, [uploadedFiles]);

  const modeCards = useMemo(
    () => [
      {
        id: 'upload' as UploadMode,
        label: 'Upload File',
        description: 'TXT, CSV, PDF, and image files with direct S3 transfer.',
        icon: Upload,
      },
      {
        id: 'paste' as UploadMode,
        label: 'Paste Raw Text',
        description: 'Drop in plain transcript text for future parsing.',
        icon: Type,
      },
      {
        id: 'behavioral' as UploadMode,
        label: 'Behavioral Input',
        description: 'Capture tone, personality, and response direction.',
        icon: Sparkles,
      },
    ],
    []
  );

  const updateUploadedFile = (localId: string, updates: Partial<UploadedKnowledgeFile>) => {
    onUploadedFilesChange(current =>
      current.map(file => (file.id === localId ? { ...file, ...updates } : file))
    );
  };

  const removeUploadedFile = (fileId: string) => {
    onUploadedFilesChange(current => {
      const fileToRemove = current.find(item => item.id === fileId);
      if (fileToRemove?.previewUrl) {
        URL.revokeObjectURL(fileToRemove.previewUrl);
      }

      return current.filter(item => item.id !== fileId);
    });
  };

  const validateFiles = (files: File[]) => {
    const invalidFile = files.find(file => !FILE_TYPES.includes(file.type));

    if (invalidFile) {
      throw new Error('Only TXT, CSV, PDF, and image files are supported.');
    }
  };

  const uploadSingleFile = async (file: File) => {
    ensureAuthenticatedUpload();

    const localId = crypto.randomUUID();
    const preview = await buildLocalPreview(file);

    onUploadedFilesChange(current => [
      {
        id: localId,
        fileId: '',
        name: file.name,
        size: file.size,
        type: file.type,
        url: '',
        progress: 3,
        status: 'uploading',
        ...preview,
      },
      ...current,
    ]);

    try {
      const session = await createUploadSession({
        fileName: file.name,
        fileType: file.type,
      });

      updateUploadedFile(localId, {
        fileId: session.fileId,
        url: session.fileUrl,
        progress: 12,
      });

      await uploadFileToS3(session.uploadUrl, file, progress => {
        updateUploadedFile(localId, { progress: Math.max(progress, 12) });
      });

      updateUploadedFile(localId, {
        progress: 100,
        status: 'success',
      });

      setPanelError(null);
    } catch (error) {
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : 'Upload failed. Please try again.';

      updateUploadedFile(localId, {
        progress: 0,
        status: 'error',
        error: message,
      });

      setPanelError(message);
    }
  };

  const handleFiles = async (incomingFiles: File[]) => {
    if (incomingFiles.length === 0) {
      return;
    }

    try {
      validateFiles(incomingFiles);
      setPanelError(null);
      await Promise.all(incomingFiles.map(uploadSingleFile));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed. Please try again.';
      setPanelError(message);
    }
  };

  const selectedModeContent = () => {
    if (mode === 'upload') {
      return (
        <motion.div
          key="upload-mode"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          className="space-y-5"
        >
          <div
            onDragOver={event => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={event => {
              event.preventDefault();
              setIsDragging(false);
              const droppedFiles = Array.from(event.dataTransfer.files ?? []) as File[];
              void handleFiles(droppedFiles);
            }}
            className={cn(
              'relative overflow-hidden rounded-[28px] border px-6 py-8 sm:px-8 sm:py-10 transition-all duration-300',
              theme === 'dark'
                ? 'border-white/5 bg-[#111b21] hover:border-white/10'
                : 'border-[#E7E7EC] bg-white hover:-translate-y-0.5 hover:shadow-[0_30px_70px_-40px_rgba(24,39,75,0.45)] before:absolute before:inset-0 before:bg-[linear-gradient(135deg,rgba(120,131,255,0.12),rgba(130,207,199,0.12),rgba(255,255,255,0.6))] before:opacity-0 before:transition-opacity hover:before:opacity-100',
              isDragging && (theme === 'dark' ? 'border-white/20' : 'border-[#7A8DFF] shadow-[0_30px_70px_-40px_rgba(60,93,199,0.45)] before:opacity-100')
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.csv,.pdf,image/png,image/jpeg,image/jpg,image/webp,image/gif,text/plain,text/csv,application/pdf"
              hidden
              onChange={event => {
                const files = Array.from(event.target.files ?? []) as File[];
                void handleFiles(files);
                event.target.value = '';
              }}
            />

            <div className="relative z-10 flex flex-col items-center gap-4 text-center">
              <div className={cn(
                "flex h-14 w-14 items-center justify-center rounded-2xl border transition-all",
                theme === 'dark' ? "border-white/10 bg-[#202c33] text-white" : "border-white/70 bg-white/90 text-[#24324D] shadow-[0_18px_30px_-24px_rgba(24,39,75,0.65)]"
              )}>
                <Upload className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <h3 className={cn("text-[15px] font-semibold tracking-[0.02em]", theme === 'dark' ? "text-white" : "text-black")}>
                  Drop knowledge sources here
                </h3>
                <p className={cn("mx-auto max-w-lg text-[12px] leading-6 sm:text-[13px]", theme === 'dark' ? "text-white/60" : "text-[#6F7281]")}>
                  Direct-to-S3 upload with secure pre-signed URLs. Supported: TXT, CSV, PDF, and image files.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "rounded-full border px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition-all",
                  theme === 'dark' 
                    ? "border-white/10 bg-white/5 text-white hover:border-white/20 hover:bg-white/10" 
                    : "border-[#E4E5EC] bg-white text-[#1B1F2A] hover:border-[#BFC6D7] hover:shadow-[0_16px_30px_-26px_rgba(24,39,75,0.75)]"
                )}
              >
                Select Files
              </button>
            </div>
          </div>

          <AnimatePresence>
            {panelError && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center gap-3 rounded-2xl border border-[#F0D3D7] bg-[#FFF8F8] px-4 py-3 text-[12px] text-[#8A3B42]"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{panelError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-3">
            <AnimatePresence>
              {uploadedFiles.map(file => (
                <motion.div
                  key={file.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={cn("rounded-[24px] border px-4 py-4 transition-colors duration-500", theme === 'dark' ? "border-white/5 bg-[#111b21] shadow-xl" : "border-[#ECECF2] bg-white shadow-[0_24px_50px_-42px_rgba(24,39,75,0.5)]")}
                >
                  <div className="flex items-start gap-4">
                    <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl transition-colors", theme === 'dark' ? "bg-[#202c33]" : "bg-[#F7F8FB]")}>
                      {file.previewUrl ? (
                        <img src={file.previewUrl} alt={file.name} className="h-full w-full object-cover" />
                      ) : file.type.startsWith('image/') ? (
                        <FileImage className={cn("h-5 w-5", theme === 'dark' ? "text-[#8696a0]" : "text-[#6E758A]")} />
                      ) : (
                        <FileText className={cn("h-5 w-5", theme === 'dark' ? "text-[#8696a0]" : "text-[#6E758A]")} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={cn("truncate text-[13px] font-semibold", theme === 'dark' ? "text-white" : "text-black")}>{file.name}</p>
                          <div className={cn("mt-1 flex items-center gap-2 text-[11px]", theme === 'dark' ? "text-white/40" : "text-[#777B88]")}>
                            <span>{formatFileSize(file.size)}</span>
                            <span className={cn("h-1 w-1 rounded-full", theme === 'dark' ? "bg-white/10" : "bg-[#CFD3DE]")} />
                            <span className="uppercase">{file.type.split('/')[1] || 'file'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {file.status === 'uploading' && (
                            <LoaderCircle className="h-4 w-4 animate-spin text-[#475467]" />
                          )}
                          {file.status === 'success' && (
                            <motion.div
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ECFDF3] text-[#067647]"
                            >
                              <Check className="h-4 w-4" />
                            </motion.div>
                          )}
                          {file.status === 'error' && (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFF4F4] text-[#B42318]">
                              <AlertCircle className="h-4 w-4" />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeUploadedFile(file.id)}
                            className={cn("rounded-full p-1.5 transition-colors", theme === 'dark' ? "text-[#8696a0] hover:bg-[#202c33] hover:text-white" : "text-[#9EA3B3] hover:bg-[#F4F5F9] hover:text-black")}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className={cn("h-2 overflow-hidden rounded-full transition-colors", theme === 'dark' ? "bg-white/5" : "bg-[#EEF1F6]")}>
                          <motion.div
                            className={cn(
                              'h-full rounded-full',
                              file.status === 'error'
                                ? 'bg-[#F97066]'
                                : file.status === 'success'
                                  ? 'bg-[linear-gradient(90deg,#76D0B6,#5FA6FF)]'
                                  : 'bg-[linear-gradient(90deg,#6E82FF,#86D0C8)]'
                            )}
                            animate={{ width: `${file.progress}%` }}
                          />
                        </div>
                        <div className={cn("flex items-center justify-between text-[11px]", theme === 'dark' ? "text-white/40" : "text-[#777B88]")}>
                          <span>
                            {file.status === 'uploading' && 'Uploading to secure storage'}
                            {file.status === 'success' && 'Ready for downstream processing'}
                            {file.status === 'error' && (file.error || 'Upload failed')}
                          </span>
                          <span>{file.progress}%</span>
                        </div>
                      </div>

                      {file.previewText && (
                        <div className={cn("rounded-2xl border px-4 py-3 text-[12px] leading-6 transition-colors duration-500", theme === 'dark' ? "border-white/5 bg-[#202c33]/50 text-white/60" : "border-[#EEF1F6] bg-[#FBFCFE] text-[#535869]")}>
                          <p className="line-clamp-4 whitespace-pre-wrap">{file.previewText}</p>
                        </div>
                      )}

                      {file.fileId && (
                        <p className={cn("text-[10px] uppercase tracking-[0.18em]", theme === 'dark' ? "text-white/30" : "text-[#98A2B3]")}>
                          File ID {file.fileId}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      );
    }

    if (mode === 'paste') {
      return (
        <motion.div
          key="paste-mode"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          className={cn("rounded-[28px] border p-6 transition-all duration-500", theme === 'dark' ? "bg-[#111b21] border-white/5" : "bg-white border-[#ECECF2] shadow-[0_28px_60px_-46px_rgba(24,39,75,0.5)]")}
        >
          <div className="mb-4 space-y-2">
            <p className={cn("text-[11px] font-semibold uppercase tracking-[0.2em]", theme === 'dark' ? "text-white/30" : "text-[#98A2B3]")}>
              Raw Context
            </p>
            <h3 className={cn("text-[16px] font-semibold tracking-tight", theme === 'dark' ? "text-white" : "text-black")}>
              Paste transcripts or notes
            </h3>
            <p className={cn("max-w-xl text-[12px] leading-6 sm:text-[13px]", theme === 'dark' ? "text-white/60" : "text-[#667085]")}>
              Ideal for imported conversations, research notes, or OCR-ready text that you want to structure later.
            </p>
          </div>
          <textarea
            ref={rawTextRef}
            value={rawText}
            onChange={event => onRawTextChange(event.target.value)}
            placeholder="Paste transcripts, notes, or summaries here..."
            className={cn(
              "w-full resize-none rounded-[24px] border px-5 py-4 text-[14px] leading-7 outline-none transition-all duration-500",
              theme === 'dark'
                ? "bg-[#202c33] border-white/10 text-white focus:border-white"
                : "bg-[#FCFCFE] border-[#E6E8F0] text-black focus:border-[#A0A8BE] focus:bg-white focus:shadow-[0_20px_50px_-38px_rgba(24,39,75,0.55)]"
            )}
          />
        </motion.div>
      );
    }

    if (mode === 'behavioral') {
      return (
        <motion.div
          key="behavioral-mode"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          className={cn("space-y-5 rounded-[28px] border p-6 transition-all duration-500", theme === 'dark' ? "bg-[#111b21] border-white/5" : "bg-white border-[#ECECF2] shadow-[0_28px_60px_-46px_rgba(24,39,75,0.5)]")}
        >
          <div className="space-y-2">
            <p className={cn("text-[11px] font-semibold uppercase tracking-[0.2em]", theme === 'dark' ? "text-white/30" : "text-[#98A2B3]")}>
              Behavioral Signature
            </p>
            <h3 className={cn("text-[16px] font-semibold tracking-tight", theme === 'dark' ? "text-white" : "text-black")}>
              Define tone and personality anchors
            </h3>
            <p className={cn("max-w-xl text-[12px] leading-6 sm:text-[13px]", theme === 'dark' ? "text-white/60" : "text-[#667085]")}>
              Capture how the persona should sound, respond, and hold emotional context. This is future-ready for chat parsing.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-[minmax(0,220px)_1fr]">
            <div className="space-y-2">
              <label className={cn("text-[11px] font-semibold uppercase tracking-[0.18em]", theme === 'dark' ? "text-white/40" : "text-[#98A2B3]")}>
                Tone
              </label>
              <div className="relative">
                <select
                  value={behavioralInput.tone}
                  onChange={event =>
                    onBehavioralChange({
                      ...behavioralInput,
                      tone: event.target.value,
                    })
                  }
                  className={cn(
                    "w-full appearance-none rounded-[20px] border px-4 py-3 text-[13px] font-medium outline-none transition-all",
                    theme === 'dark'
                      ? "bg-[#202c33] border-white/10 text-white focus:border-white"
                      : "bg-[#FCFCFE] border-[#E4E7EC] text-black focus:border-[#A0A8BE] focus:bg-white"
                  )}
                >
                  {TONE_OPTIONS.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <label className={cn("text-[11px] font-semibold uppercase tracking-[0.18em]", theme === 'dark' ? "text-white/40" : "text-[#98A2B3]")}>
                Personality Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {PERSONALITY_TAGS.map(tag => {
                  const selected = behavioralInput.personalityTags.includes(tag);

                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        onBehavioralChange({
                          ...behavioralInput,
                          personalityTags: selected
                            ? behavioralInput.personalityTags.filter(item => item !== tag)
                            : [...behavioralInput.personalityTags, tag],
                        })
                      }
                      className={cn(
                        'rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] transition-all',
                        selected
                          ? (theme === 'dark' ? 'border-white bg-white text-black' : 'border-[#182230] bg-[#182230] text-white shadow-[0_20px_40px_-28px_rgba(24,34,48,0.7)]')
                          : (theme === 'dark' ? 'border-white/10 bg-white/5 text-[#8696a0] hover:border-white/20 hover:text-white' : 'border-[#E4E7EC] bg-white text-[#667085] hover:border-[#BFC6D7] hover:text-black')
                      )}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className={cn("text-[11px] font-semibold uppercase tracking-[0.18em]", theme === 'dark' ? "text-white/40" : "text-[#98A2B3]")}>
              Guidance Notes
            </label>
            <textarea
              ref={behavioralNotesRef}
              value={behavioralInput.notes}
              onChange={event =>
                onBehavioralChange({
                  ...behavioralInput,
                  notes: event.target.value,
                })
              }
              placeholder="Describe speech cadence, taboo phrases, emotional guardrails, or response habits..."
              className={cn(
                "w-full resize-none rounded-[24px] border px-5 py-4 text-[14px] leading-7 outline-none transition-all duration-500",
                theme === 'dark'
                  ? "bg-[#202c33] border-white/10 text-white focus:border-white"
                  : "bg-[#FCFCFE] border-[#E6E8F0] text-black focus:border-[#A0A8BE] focus:bg-white focus:shadow-[0_20px_50px_-38px_rgba(24,39,75,0.55)]"
              )}
            />
          </div>
        </motion.div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {modeCards.map((card, index) => {
          const selected = mode === card.id;

          return (
            <motion.button
              key={card.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              whileHover={{ y: -3, scale: 1.01 }}
              whileTap={{ scale: 0.995 }}
              type="button"
              onClick={() => onModeChange(card.id)}
              className={cn(
                'relative overflow-hidden rounded-[26px] border px-5 py-5 text-left transition-all duration-500',
                theme === 'dark'
                  ? (selected
                      ? 'border-white/20 bg-white/10 shadow-[0_35px_70px_-42px_rgba(0,0,0,0.55)]'
                      : 'border-white/5 bg-[#111b21] hover:border-white/10 hover:shadow-[0_30px_70px_-48px_rgba(0,0,0,0.45)]')
                  : (selected
                      ? 'border-[#D9DEE9] bg-[linear-gradient(180deg,#ffffff,#f8faff)] shadow-[0_35px_70px_-42px_rgba(24,39,75,0.55)]'
                      : 'border-[#ECECF2] bg-white hover:border-[#D9DEE9] hover:shadow-[0_30px_70px_-48px_rgba(24,39,75,0.45)]')
              )}
            >
              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <div
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-2xl border transition-all',
                      selected
                        ? (theme === 'dark' ? 'border-white/20 bg-white/10 text-white' : 'border-white/70 bg-white/90 text-[#182230]')
                        : (theme === 'dark' ? 'border-white/5 bg-[#202c33] text-[#8696a0]' : 'border-[#EFF1F5] bg-[#F8F9FC] text-[#6E758A]')
                    )}
                  >
                    <card.icon className="h-4 w-4" />
                  </div>
                  <div
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full border transition-all',
                      selected
                        ? (theme === 'dark' ? 'border-white bg-white text-black' : 'border-[#182230] bg-[#182230] text-white')
                        : (theme === 'dark' ? 'border-white/10 bg-white/5 text-transparent' : 'border-[#D0D5DD] bg-white text-transparent')
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className={cn("text-[14px] font-semibold tracking-tight", theme === 'dark' ? "text-white" : "text-black")}>{card.label}</h3>
                  <p className={cn("text-[12px] leading-6", theme === 'dark' ? "text-white/60" : "text-[#667085]")}>{card.description}</p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">{selectedModeContent()}</AnimatePresence>

      <div className={cn(
        "rounded-[24px] border px-4 py-4 text-[12px] leading-6 transition-all duration-500",
        theme === 'dark'
          ? "bg-[#111b21] border-white/5 text-white/50"
          : "bg-[#FBFCFE] border-[#ECECF2] text-[#667085]"
      )}>
        {mode === 'upload' && (
          <span>
            Files stay user-scoped through JWT-authenticated upload sessions. The frontend only receives a pre-signed URL and never any AWS credentials.
          </span>
        )}
        {mode === 'paste' && (
          <span>
            Raw text stays ready for future OCR cleanup, chunking, and conversational parsing without changing this UI flow.
          </span>
        )}
        {mode === 'behavioral' && (
          <span>
            Behavioral input can later feed persona tuning, response steering, and memory extraction without changing the data contract.
          </span>
        )}
        {!mode && (
          <span>Select one source mode to continue. You can refine or replace it later without breaking the creation flow.</span>
        )}
      </div>

      {mode === 'upload' && hasSuccessfulUpload && !isUploading && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-[24px] border border-[#D6F5E6] bg-[#F6FFFA] px-4 py-3 text-[12px] text-[#067647]"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ECFDF3]"
          >
            <Check className="h-4 w-4" />
          </motion.div>
          <span>Upload complete. File IDs are stored and ready for the next pipeline step.</span>
        </motion.div>
      )}
    </div>
  );
}
