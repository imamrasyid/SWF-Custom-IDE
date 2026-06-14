import { Files, Search, Hammer, Settings, LogOut, Network, Play, Database, Layout, Info } from 'lucide-react'
import { useAppStore } from '../../stores/app-store'

export default function ActivityBar() {
  const activityTab = useAppStore((s) => s.activityTab)
  const activeModule = useAppStore((s) => s.activeModule)
  const isSidebarOpen = useAppStore((s) => s.isSidebarOpen)
  const setActivityTab = useAppStore((s) => s.setActivityTab)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const closeSwf = useAppStore((s) => s.closeSwf)
  const swfPath = useAppStore((s) => s.swfPath)
  const projectRoot = useAppStore((s) => s.projectRoot)

  const handleTabClick = (tab: 'explorer' | 'search' | 'builder' | 'settings') => {
    if (activityTab === tab && isSidebarOpen) {
      toggleSidebar(false)
    } else {
      setActivityTab(tab)
    }
  }

  return (
    <div className="activity-bar">
      <div className="flex flex-col items-center w-full">
        {/* SWF Explorer */}
        <button
          onClick={() => handleTabClick('explorer')}
          className={`activity-bar-btn group ${activityTab === 'explorer' && isSidebarOpen && activeModule !== 'dependency' && activeModule !== 'simulator' && activeModule !== 'game-data-editor' && activeModule !== 'panel-studio' ? 'active' : ''}`}
        >
          <Files size={20} />
          <span className="activity-bar-tooltip">SWF Explorer</span>
        </button>

        {/* Global Search */}
        <button
          onClick={() => handleTabClick('search')}
          className={`activity-bar-btn group ${activityTab === 'search' && isSidebarOpen && activeModule !== 'dependency' && activeModule !== 'simulator' && activeModule !== 'game-data-editor' && activeModule !== 'panel-studio' ? 'active' : ''}`}
        >
          <Search size={20} />
          <span className="activity-bar-tooltip">Search & Replace</span>
        </button>

        {/* SWF Builder */}
        <button
          onClick={() => handleTabClick('builder')}
          className={`activity-bar-btn group ${activityTab === 'builder' && isSidebarOpen && activeModule !== 'dependency' && activeModule !== 'simulator' && activeModule !== 'game-data-editor' && activeModule !== 'panel-studio' ? 'active' : ''}`}
        >
          <Hammer size={20} />
          <span className="activity-bar-tooltip">SWF Builder (Compiler)</span>
        </button>

        {/* Dependency Graph */}
        {swfPath && (
          <button
            onClick={() => {
              useAppStore.getState().setActiveModule('dependency')
              useAppStore.getState().toggleSidebar(false)
            }}
            className={`activity-bar-btn group ${activeModule === 'dependency' ? 'active' : ''}`}
          >
            <Network size={20} />
            <span className="activity-bar-tooltip">Dependency Graph</span>
          </button>
        )}

        {/* Live Simulator */}
        {swfPath && (
          <button
            onClick={() => {
              useAppStore.getState().setActiveModule('simulator')
              useAppStore.getState().toggleSidebar(false)
            }}
            className={`activity-bar-btn group ${activeModule === 'simulator' ? 'active' : ''}`}
          >
            <Play size={20} />
            <span className="activity-bar-tooltip">Live Simulator</span>
          </button>
        )}

        {/* Panel Studio */}
        {(swfPath || projectRoot) && (
          <button
            onClick={() => {
              useAppStore.getState().setActiveModule('panel-studio')
              useAppStore.getState().toggleSidebar(false)
            }}
            className={`activity-bar-btn group ${activeModule === 'panel-studio' ? 'active' : ''}`}
          >
            <Layout size={20} />
            <span className="activity-bar-tooltip">Panel Studio</span>
          </button>
        )}

        {/* Game Data Editor */}
        {(swfPath || projectRoot) && (
          <button
            onClick={() => {
              useAppStore.getState().setActiveModule('game-data-editor')
              useAppStore.getState().toggleSidebar(false)
            }}
            className={`activity-bar-btn group ${activeModule === 'game-data-editor' ? 'active' : ''}`}
          >
            <Database size={20} />
            <span className="activity-bar-tooltip">Game Data Editor</span>
          </button>
        )}
      </div>

      <div className="flex flex-col items-center w-full">
        {/* Settings */}
        <button
          onClick={() => handleTabClick('settings')}
          className={`activity-bar-btn group ${activityTab === 'settings' && isSidebarOpen && activeModule !== 'dependency' && activeModule !== 'simulator' && activeModule !== 'panel-studio' ? 'active' : ''}`}
        >
          <Settings size={20} />
          <span className="activity-bar-tooltip">Settings</span>
        </button>

        {/* About */}
        <button
          onClick={() => {
            useAppStore.getState().setActiveModule('about')
            useAppStore.getState().toggleSidebar(false)
          }}
          className={`activity-bar-btn group ${activeModule === 'about' ? 'active' : ''}`}
        >
          <Info size={20} />
          <span className="activity-bar-tooltip">About</span>
        </button>

        {/* Close/Eject SWF (bottom) */}
        {swfPath && (
          <button
            onClick={() => closeSwf()}
            className="activity-bar-btn group text-red-500 hover:text-red-400 hover:bg-red-950/20"
          >
            <LogOut size={20} />
            <span className="activity-bar-tooltip">Close SWF File</span>
          </button>
        )}
      </div>
    </div>
  )
}
