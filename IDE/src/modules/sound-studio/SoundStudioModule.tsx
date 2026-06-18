import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../../stores/app-store'
import { useToast } from '../../hooks/useToast'
import { Music, Play, Pause, Upload, Volume2, SkipBack } from 'lucide-react'

type AudioTag = {
  id: number
  name: string
  size: number
}

export default function SoundStudioModule() {
  const swfData = useAppStore((s) => s.swfData)
  const swfPath = useAppStore((s) => s.swfPath)
  const isLoading = useAppStore((s) => s.isLoading)
  const { show } = useToast()

  const [soundTags, setSoundTags] = useState<AudioTag[]>([])
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Filter and load audio tags from swfData
  useEffect(() => {
    if (swfData && swfData.tags) {
      const audio = swfData.tags
        .filter((t: any) => t.type.toLowerCase().startsWith('definesound'))
        .map((t: any) => ({
          id: t.id,
          name: t.name || `Sound (id: ${t.id})`,
          size: t.size || 0
        }))
      setSoundTags(audio)
      if (audio.length > 0 && selectedTagId === null) {
        setSelectedTagId(audio[0].id)
      }
    } else {
      setSoundTags([])
      setSelectedTagId(null)
    }
  }, [swfData])

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      stopAudio()
    }
  }, [])

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      // Clean up event listeners
      if ((audioRef.current as any).__cleanup) {
        (audioRef.current as any).__cleanup()
      }
      audioRef.current.removeAttribute('src')
      audioRef.current.load()
      audioRef.current = null
    }
    setIsPlaying(false)
    setCurrentTime(0)
  }

  const handlePlay = async () => {
    if (!swfPath || selectedTagId === null) return

    if (audioRef.current && isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      return
    }

    if (audioRef.current && !isPlaying) {
      audioRef.current.play()
      setIsPlaying(true)
      return
    }

    // Clean up any existing audio before creating a new one
    stopAudio()

    show('Extracting audio track...', 'info', 1000)
    try {
      const dataUrl = await window.electronAPI.extractSound(swfPath, selectedTagId)
      if (dataUrl) {
        const audio = new Audio(dataUrl)
        audio.volume = volume

        const onLoadedMetadata = () => setDuration(audio.duration)
        const onTimeUpdate = () => setCurrentTime(audio.currentTime)
        const onEnded = () => { setIsPlaying(false); setCurrentTime(0) }

        audio.addEventListener('loadedmetadata', onLoadedMetadata)
        audio.addEventListener('timeupdate', onTimeUpdate)
        audio.addEventListener('ended', onEnded)

        // Store cleanup function for later removal
        audioRef.current = audio
        ;(audio as any).__cleanup = () => {
          audio.removeEventListener('loadedmetadata', onLoadedMetadata)
          audio.removeEventListener('timeupdate', onTimeUpdate)
          audio.removeEventListener('ended', onEnded)
        }

        audio.play()
        setIsPlaying(true)
      } else {
        show('Failed to extract audio track', 'error')
      }
    } catch (err: any) {
      show(`Audio error: ${err.message || err}`, 'error')
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value)
    setVolume(newVol)
    if (audioRef.current) {
      audioRef.current.volume = newVol
    }
  }

  const handleReplaceSound = async () => {
    if (!swfPath || selectedTagId === null) return

    const filePath = await window.electronAPI.openAsFile()
    if (filePath) {
      stopAudio()
      useAppStore.setState({ isLoading: true, loadingStatus: 'Replacing audio tag...', loadingLogs: [] })
      try {
        const success = await window.electronAPI.replaceTag(swfPath, selectedTagId, filePath)
        if (success) {
          show('Audio replaced successfully!', 'success')
          await useAppStore.getState().loadSwf(swfPath, true)
        } else {
          show('Failed to replace audio tag', 'error')
        }
      } catch (err: any) {
        show(`Error: ${err.message}`, 'error')
      } finally {
        useAppStore.setState({ isLoading: false })
      }
    }
  }

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00'
    const mins = Math.floor(time / 60)
    const secs = Math.floor(time % 60)
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  return (
    <div className="module animate-slide-in-right flex flex-col h-full min-h-0 space-y-4 text-slate-200">
      <div>
        <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Music className="text-indigo-400" size={24} />
          <span>Sound Studio</span>
        </h2>
        <p className="module-desc">Play and replace audio assets embedded within the active SWF file</p>
      </div>

      {soundTags.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 border border-slate-900 bg-slate-950/20 rounded-2xl select-none">
          <Music size={40} className="text-slate-700 mb-2" />
          <span className="text-xs text-slate-500 italic">No audio tracks detected in this SWF</span>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-3 gap-6 min-h-0 overflow-hidden">
          {/* Left: list of audio tags */}
          <div className="col-span-1 border-r border-slate-900/40 pr-4 flex flex-col h-full min-h-0">
            <span className="text-xs font-extrabold uppercase text-slate-400 mb-2.5 pl-1">Audio Tracks ({soundTags.length})</span>
            <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
              {soundTags.map((tag) => (
                <div
                  key={tag.id}
                  onClick={() => {
                    stopAudio()
                    setSelectedTagId(tag.id)
                  }}
                  className={`p-3 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center justify-between border ${
                    selectedTagId === tag.id
                      ? 'bg-indigo-650/15 border-indigo-500/35 text-indigo-300'
                      : 'bg-slate-950/25 border-slate-900/60 text-slate-400 hover:bg-slate-900/40 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate min-w-0">
                    <Music size={13} className={selectedTagId === tag.id ? 'text-indigo-400' : 'text-slate-500'} />
                    <span className="truncate">{tag.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-600 font-mono ml-2 shrink-0">{formatSize(tag.size)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Audio Player and Controller */}
          <div className="col-span-2 flex flex-col gap-4">
            <div className="flex-1 bg-slate-950/35 border border-slate-900/60 rounded-2xl p-6 flex flex-col items-center justify-center relative">
              <div className="w-24 h-24 rounded-full bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 animate-pulse">
                <Music size={40} />
              </div>
              <h3 className="text-sm font-bold text-slate-200 tracking-wide text-center truncate max-w-sm">
                {soundTags.find(t => t.id === selectedTagId)?.name || 'Select a track'}
              </h3>
              <p className="text-[10px] text-slate-500 font-mono mt-1">
                ID: {selectedTagId} | Type: DefineSound
              </p>

              {/* Progress seeker */}
              <div className="w-full max-w-xs mt-6 flex items-center gap-3">
                <span className="text-[10px] font-mono text-slate-500">{formatTime(currentTime)}</span>
                <div className="flex-1 h-1.5 bg-slate-900 rounded-full overflow-hidden relative">
                  <div
                    className="absolute left-0 top-0 h-full bg-indigo-500 transition-all duration-100"
                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-slate-500">{formatTime(duration)}</span>
              </div>

              {/* Playback Controls */}
              <div className="flex items-center gap-4 mt-6">
                <button
                  onClick={stopAudio}
                  disabled={!isPlaying}
                  className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center hover:bg-slate-850 hover:text-white text-slate-400 disabled:opacity-40 transition-all cursor-pointer"
                  title="Stop"
                >
                  <SkipBack size={16} />
                </button>
                <button
                  onClick={handlePlay}
                  disabled={isLoading || selectedTagId === null}
                  className="w-12 h-12 rounded-full bg-indigo-650 hover:bg-indigo-600 text-white flex items-center justify-center active:scale-95 shadow-xl transition-all cursor-pointer"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
                </button>
              </div>

              {/* Volume Controller */}
              <div className="flex items-center gap-2 mt-6">
                <Volume2 size={13} className="text-slate-500" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-24 accent-indigo-500 h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Replacement Actions */}
            <div className="bg-[#0b0f1a] border border-slate-900/60 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-200">Replace Audio Track</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Upload a new MP3 or WAV file to replace this tag in the SWF</p>
              </div>
              <button
                onClick={handleReplaceSound}
                disabled={isLoading || selectedTagId === null}
                className="btn btn-primary flex items-center gap-2 px-4 py-2 font-bold text-xs cursor-pointer"
              >
                <Upload size={14} />
                <span>Upload & Replace</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
