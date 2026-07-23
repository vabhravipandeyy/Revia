import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Bell, Clock3, Eye, MessageCircleHeart, Moon, Smartphone, Sparkles, Zap } from 'lucide-react';
import { ChatSimulationSettings } from '../types';
import { cn } from '@/lib/utils';

interface SettingsProps {
  settings: ChatSimulationSettings;
  onUpdate: (settings: ChatSimulationSettings) => void;
  theme: 'light' | 'dark';
}

const DEFAULT_SETTINGS: ChatSimulationSettings = {
  realisticMode: true,
  minResponseDelaySeconds: 10,
  maxResponseDelaySeconds: 20,
  autoScrollToLatest: true,
  spontaneousEnabled: true,
  spontaneousFrequency: 'medium',
  lateNightMessagesEnabled: false,
};

const FREQUENCY_OPTIONS: { value: ChatSimulationSettings['spontaneousFrequency']; label: string; description: string }[] = [
  { value: 'low', label: 'Rare', description: 'Very occasional, feels like a random thought' },
  { value: 'medium', label: 'Natural', description: 'Balanced, like a real friend texting' },
  { value: 'high', label: 'Active', description: 'More frequent, emotionally present' },
];

export default function Settings({ settings, onUpdate, theme }: SettingsProps) {
  const updateSetting = <K extends keyof ChatSimulationSettings>(
    key: K,
    value: ChatSimulationSettings[K]
  ) => {
    const nextSettings = {
      ...settings,
      [key]: value,
    };

    if (key === 'minResponseDelaySeconds' && nextSettings.maxResponseDelaySeconds < nextSettings.minResponseDelaySeconds) {
      nextSettings.maxResponseDelaySeconds = nextSettings.minResponseDelaySeconds;
    }

    if (key === 'maxResponseDelaySeconds' && nextSettings.minResponseDelaySeconds > nextSettings.maxResponseDelaySeconds) {
      nextSettings.minResponseDelaySeconds = nextSettings.maxResponseDelaySeconds;
    }

    onUpdate(nextSettings);
  };

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto h-full overflow-auto">
      <header>
        <h2 className={cn("text-3xl font-bold tracking-tight transition-colors duration-500", theme === 'dark' ? "text-white" : "text-slate-900")}>Settings</h2>
        <p className={cn("transition-colors duration-500", theme === 'dark' ? "text-white/60" : "text-slate-500")}>Control how real and how patient your companions feel in chat.</p>
      </header>

      <div className="grid grid-cols-1 gap-8">
        {/* Chat Simulation Card */}
        <Card className={cn("transition-all duration-500", theme === 'dark' ? "glass border-white/5 bg-[#111b21]/40" : "bg-white border-[#F0E7FF] shadow-xl shadow-black/[0.02]")}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-neon-blue" />
              <CardTitle className={theme === 'dark' ? "text-white" : "text-slate-900"}>Chat Simulation</CardTitle>
            </div>
            <CardDescription className={theme === 'dark' ? "text-white/60" : "text-slate-500"}>Make replies feel more human, less instant, and closer to the persona cadence.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className={cn("transition-colors duration-500", theme === 'dark' ? "text-[#e9edf0]" : "text-slate-900")}>Realistic Reply Timing</Label>
                <p className={cn("text-xs transition-colors duration-500", theme === 'dark' ? "text-white/60" : "text-slate-500")}>Delay replies in a more human way instead of showing them instantly.</p>
              </div>
              <Switch
                checked={settings.realisticMode}
                onCheckedChange={(checked) => updateSetting('realisticMode', checked)}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className={cn("transition-colors duration-500", theme === 'dark' ? "text-[#e9edf0]" : "text-slate-900")}>Minimum Reply Delay</Label>
                  <p className={cn("text-xs transition-colors duration-500", theme === 'dark' ? "text-white/60" : "text-slate-500")}>Shortest wait before a persona sends a response.</p>
                </div>
                <span className={cn("text-xs font-bold transition-colors duration-500", theme === 'dark' ? "text-white/80" : "text-slate-600")}>{settings.minResponseDelaySeconds}s</span>
              </div>
              <input
                type="range"
                value={settings.minResponseDelaySeconds}
                min={5}
                max={30}
                step={1}
                onChange={(event) => updateSetting('minResponseDelaySeconds', Number(event.target.value))}
                className="w-full"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className={cn("transition-colors duration-500", theme === 'dark' ? "text-[#e9edf0]" : "text-slate-900")}>Maximum Reply Delay</Label>
                  <p className={cn("text-xs transition-colors duration-500", theme === 'dark' ? "text-white/60" : "text-slate-500")}>Upper timing window for more natural delayed replies.</p>
                </div>
                <span className={cn("text-xs font-bold transition-colors duration-500", theme === 'dark' ? "text-white/80" : "text-slate-600")}>{settings.maxResponseDelaySeconds}s</span>
              </div>
              <input
                type="range"
                value={settings.maxResponseDelaySeconds}
                min={settings.minResponseDelaySeconds}
                max={30}
                step={1}
                onChange={(event) => updateSetting('maxResponseDelaySeconds', Number(event.target.value))}
                className="w-full"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className={cn("transition-colors duration-500", theme === 'dark' ? "text-[#e9edf0]" : "text-slate-900")}>Auto-scroll To Latest</Label>
                <p className={cn("text-xs transition-colors duration-500", theme === 'dark' ? "text-white/60" : "text-slate-500")}>Stay pinned to the newest messages only when you want to.</p>
              </div>
              <Switch
                checked={settings.autoScrollToLatest}
                onCheckedChange={(checked) => updateSetting('autoScrollToLatest', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Spontaneous Messages Card */}
        <Card className={cn("transition-all duration-500", theme === 'dark' ? "glass border-white/5 bg-[#111b21]/40" : "bg-white border-[#F0E7FF] shadow-xl shadow-black/[0.02]")}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <MessageCircleHeart className="w-5 h-5 text-pink-400" />
              <CardTitle className={theme === 'dark' ? "text-white" : "text-slate-900"}>Spontaneous Messages</CardTitle>
            </div>
            <CardDescription className={theme === 'dark' ? "text-white/60" : "text-slate-500"}>
              Let your personas reach out to you naturally — like a real person who suddenly thought of you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className={cn("transition-colors duration-500", theme === 'dark' ? "text-[#e9edf0]" : "text-slate-900")}>Enable Spontaneous Messages</Label>
                <p className={cn("text-xs transition-colors duration-500", theme === 'dark' ? "text-white/60" : "text-slate-500")}>
                  Personas will send you messages on their own when they feel it's natural.
                </p>
              </div>
              <Switch
                checked={settings.spontaneousEnabled}
                onCheckedChange={(checked) => updateSetting('spontaneousEnabled', checked)}
              />
            </div>

            {settings.spontaneousEnabled && (
              <>
                <div className="space-y-3">
                  <Label className={cn("flex items-center gap-2 transition-colors duration-500", theme === 'dark' ? "text-[#e9edf0]" : "text-slate-900")}>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Message Frequency
                  </Label>
                  <div className="grid grid-cols-3 gap-3">
                    {FREQUENCY_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => updateSetting('spontaneousFrequency', option.value)}
                        className={cn(
                          "relative rounded-xl border px-4 py-3 text-left transition-all duration-200",
                          settings.spontaneousFrequency === option.value
                            ? 'border-pink-400/50 bg-pink-500/10 shadow-[0_0_15px_rgba(236,72,153,0.1)]'
                            : (theme === 'dark'
                                ? 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8 text-white'
                                : 'border-[#F0E7FF] bg-[#F7F7F8] hover:border-[#DDD3F1] hover:bg-white text-slate-800')
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Zap className={cn("w-3 h-3", settings.spontaneousFrequency === option.value ? 'text-pink-400' : (theme === 'dark' ? 'text-white/40' : 'text-slate-400'))} />
                          <span className={cn(
                            "text-sm font-semibold transition-colors duration-200",
                            settings.spontaneousFrequency === option.value
                              ? 'text-pink-300'
                              : (theme === 'dark' ? 'text-white' : 'text-slate-900')
                          )}>
                            {option.label}
                          </span>
                        </div>
                        <p className={cn(
                          "text-[10px] leading-tight transition-colors duration-200",
                          theme === 'dark' ? "text-white/50" : "text-slate-500"
                        )}>{option.description}</p>
                        {settings.spontaneousFrequency === option.value && (
                          <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-pink-400 shadow-[0_0_8px_rgba(236,72,153,0.5)]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className={cn("flex items-center gap-2 transition-colors duration-500", theme === 'dark' ? "text-[#e9edf0]" : "text-slate-900")}>
                      <Moon className="w-3.5 h-3.5 text-indigo-400" />
                      Late Night Messages
                    </Label>
                    <p className={cn("text-xs transition-colors duration-500", theme === 'dark' ? "text-white/60" : "text-slate-500")}>
                      Allow personas to send soft, emotional messages late at night (10pm–1am).
                    </p>
                  </div>
                  <Switch
                    checked={settings.lateNightMessagesEnabled}
                    onCheckedChange={(checked) => updateSetting('lateNightMessagesEnabled', checked)}
                  />
                </div>

                <div className={cn(
                  "rounded-2xl border px-4 py-4 text-sm space-y-2 transition-all duration-500",
                  theme === 'dark'
                    ? "border-pink-500/10 bg-pink-500/5 text-white/70"
                    : "border-pink-200/60 bg-pink-50/40 text-slate-700"
                )}>
                  <p className={cn(
                    "font-medium flex items-center gap-2 transition-colors duration-200",
                    theme === 'dark' ? "text-pink-300/80" : "text-pink-600"
                  )}>
                    <MessageCircleHeart className="w-4 h-4" />
                    How spontaneous messages work
                  </p>
                  <ul className={cn(
                    "space-y-1.5 text-xs leading-relaxed pl-6 list-disc transition-colors duration-200",
                    theme === 'dark' ? "text-white/60" : "text-slate-500"
                  )}>
                    <li>Messages trigger only after natural inactivity periods (2+ hours)</li>
                    <li>Each message references past conversations and emotional context</li>
                    <li>Anti-repetition system ensures no message feels scripted or repeated</li>
                    <li>Time-of-day awareness adjusts tone (soft at night, playful in morning)</li>
                    <li>Cooldown prevents multiple spontaneous messages within 4 hours</li>
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Conversation Comfort Card */}
        <Card className={cn("transition-all duration-500", theme === 'dark' ? "glass border-white/5 bg-[#111b21]/40" : "bg-white border-[#F0E7FF] shadow-xl shadow-black/[0.02]")}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Eye className="w-5 h-5 text-neon-purple" />
              <CardTitle className={theme === 'dark' ? "text-white" : "text-slate-900"}>Conversation Comfort</CardTitle>
            </div>
            <CardDescription className={theme === 'dark' ? "text-white/60" : "text-slate-500"}>These controls tune how much the UI stays anchored while you read older messages.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className={cn(
              "rounded-2xl border px-4 py-4 text-sm transition-all duration-500",
              theme === 'dark'
                ? "border-white/10 bg-white/5 text-white/60"
                : "border-[#F0E7FF] bg-[#F7F7F8] text-slate-600"
            )}>
              When auto-scroll is off, the chat will stop jumping to the bottom while you are reading older messages. New replies still appear once you go back near the latest messages.
            </div>
            <div className={cn(
              "rounded-2xl border px-4 py-4 text-sm transition-all duration-500",
              theme === 'dark'
                ? "border-white/10 bg-white/5 text-white/60"
                : "border-[#F0E7FF] bg-[#F7F7F8] text-slate-600"
            )}>
              Realtime delivery uses the selected persona cadence together with your reply timing window, so messages can feel live while still landing after a human-like pause.
            </div>
          </CardContent>
        </Card>

        {/* Quick Reset Card */}
        <Card className={cn("transition-all duration-500", theme === 'dark' ? "glass border-white/5 bg-[#111b21]/40" : "bg-white border-[#F0E7FF] shadow-xl shadow-black/[0.02]")}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-neon-pink" />
              <CardTitle className={theme === 'dark' ? "text-white" : "text-slate-900"}>Quick Reset</CardTitle>
            </div>
            <CardDescription className={theme === 'dark' ? "text-white/60" : "text-slate-500"}>Go back to the default delayed reply behavior anytime.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div className={cn("flex items-center gap-3 text-sm transition-colors duration-500", theme === 'dark' ? "text-white/60" : "text-slate-500")}>
              <Clock3 className="w-4 h-4" />
              Default range keeps replies feeling human instead of instant.
            </div>
            <Button 
              variant="outline" 
              className={cn("transition-all duration-500", theme === 'dark' ? "border-white/10 hover:bg-white/5 text-white" : "border-[#F0E7FF] hover:bg-[#F7F7F8]")} 
              onClick={() => onUpdate(DEFAULT_SETTINGS)}
            >
              Reset to Defaults
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
