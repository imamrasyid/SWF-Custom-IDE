import { useAppStore } from '../../stores/app-store'
import ExplorerModule from '../../modules/explorer/ExplorerModule'
import ScriptSwapperModule from '../../modules/script-swapper/ScriptSwapperModule'
import AssetForgeModule from '../../modules/asset-forge/AssetForgeModule'
import SwfBuilderModule from '../../modules/swf-builder/SwfBuilderModule'
import GameDataEditorModule from '../../modules/game-data-editor/GameDataEditorModule'
import CodeEditorModule from '../../modules/code-editor/CodeEditorModule'
import SettingsModule from '../../modules/settings/SettingsModule'
import DependencyModule from '../../modules/dependency/DependencyModule'
import AmfBuilderModule from '../../modules/amf-builder/AmfBuilderModule'
import SimulatorModule from '../../modules/simulator/SimulatorModule'
import SoundStudioModule from '../../modules/sound-studio/SoundStudioModule'
import PanelStudioModule from '../../modules/panel-studio/PanelStudioModule'

const modules: Record<string, React.FC> = {
  explorer: ExplorerModule,
  'script-swapper': ScriptSwapperModule,
  'asset-forge': AssetForgeModule,
  'swf-builder': SwfBuilderModule,
  'game-data-editor': GameDataEditorModule,
  'code-editor': CodeEditorModule,
  'settings': SettingsModule,
  dependency: DependencyModule,
  'amf-builder': AmfBuilderModule,
  simulator: SimulatorModule,
  'sound-studio': SoundStudioModule,
  'panel-studio': PanelStudioModule
}


export default function ContentPanel() {
  const activeModule = useAppStore((s) => s.activeModule)
  const Module = activeModule ? modules[activeModule] : null

  return (
    <div className="content-panel">
      {Module ? <Module /> : null}
    </div>
  )
}
