import { ipcMain, app } from 'electron'
import fs from 'fs'
import path from 'path'
import { detectNinjasageProject } from '../services/project-service'

export function registerProjectIpc() {
  ipcMain.handle('project:detect', async (_event, dir?: string) => {
    const startDir = dir || path.resolve(app.getAppPath(), '..')
    let current = startDir
    for (let i = 0; i < 8; i++) {
      try {
        const result = detectNinjasageProject(current)
        if (result) return result
      } catch {}
      const parent = path.dirname(current)
      if (parent === current) break
      current = parent
    }
    return null
  })

  ipcMain.handle('project:detectFromSwf', async (_event, swfPath: string) => {
    const dir = path.dirname(swfPath)
    let current = dir
    for (let i = 0; i < 5; i++) {
      const result = detectNinjasageProject(current)
      if (result) return result
      const parent = path.dirname(current)
      if (parent === current) break
      current = parent
    }
    return null
  })

  ipcMain.handle('project:getTemplates', async () => {
    return Object.entries(PROJECT_TEMPLATES).map(([id, tmpl]) => ({
      id,
      name: tmpl.name,
      description: tmpl.description
    }))
  })

  ipcMain.handle('project:createTemplate', async (_event, projectRoot: string, projectName: string, templateId: string = 'basic') => {
    try {
      const template = PROJECT_TEMPLATES[templateId as keyof typeof PROJECT_TEMPLATES] || PROJECT_TEMPLATES.basic
      
      for (const folder of template.folders) {
        fs.mkdirSync(path.join(projectRoot, folder), { recursive: true })
      }
      
      for (const [filePath, contentFn] of Object.entries(template.files)) {
        const content = typeof contentFn === 'function' ? contentFn(projectName) : contentFn
        fs.writeFileSync(path.join(projectRoot, filePath), content, 'utf8')
      }
      
      return true
    } catch (err) {
      console.error('Failed to create project template:', err)
      return false
    }
  })

  ipcMain.handle('project:readAsconfig', async (_event, projectRoot: string) => {
    const filePath = path.join(projectRoot, 'asconfig.json')
    if (fs.existsSync(filePath)) {
      try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'))
      } catch (err) {
        console.error('Failed to parse asconfig.json:', err)
        return null
      }
    }
    return null
  })

  ipcMain.handle('panels:list', async (_event, dirPath: string) => {
    try {
      if (!fs.existsSync(dirPath)) return []
      const files = fs.readdirSync(dirPath, { withFileTypes: true })
      return files
        .filter(f => f.isFile() && f.name.toLowerCase().endsWith('.swf'))
        .map(f => {
          const fullPath = path.join(dirPath, f.name)
          const stat = fs.statSync(fullPath)
          return {
            name: f.name,
            path: fullPath,
            size: stat.size,
            mtime: stat.mtimeMs
          }
        })
    } catch (err) {
      console.error('Failed to list panels:', err)
      return []
    }
  })

  ipcMain.handle('panels:writeCode', async (_event, filePath: string, content: string) => {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, content, 'utf8')
      return true
    } catch (err) {
      console.error('Failed to write panel code:', err)
      return false
    }
  })

  ipcMain.handle('panels:readCode', async (_event, filePath: string) => {
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8')
      }
      return ''
    } catch (err) {
      console.error('Failed to read panel code:', err)
      return ''
    }
  })
}

const PROJECT_TEMPLATES = {
  basic: {
    name: 'Basic AS3 Project',
    description: 'Template dasar dengan Main.as dan konfigurasi minimal',
    files: {
      'src/Main.as': (name: string) => `package {
    import flash.display.Sprite;
    import flash.text.TextField;
    import flash.text.TextFormat;

    [SWF(width="800", height="600", backgroundColor="#070b13", frameRate="60")]
    public class Main extends Sprite {
        public function Main() {
            var txt:TextField = new TextField();
            txt.defaultTextFormat = new TextFormat("Arial", 28, 0xFFFFFF, true);
            txt.text = "Hello ${name}!";
            txt.width = 400;
            txt.x = 250;
            txt.y = 250;
            addChild(txt);
        }
    }
}`,
      'asconfig.json': (name: string) => JSON.stringify({
        compilerOptions: {
          "source-path": ["src"],
          "output": `build/${name}.swf`,
          "target-player": "32.0",
          "static-link-runtime-shared-libraries": true
        },
        files: ["src/Main.as"]
      }, null, 2),
      '.wayangide/settings.json': (name: string) => JSON.stringify({
        "workspace.projectName": name,
        "compiler.sdkPath": "",
        "compiler.defaultMain": "src/Main.as",
        "compiler.defaultOutput": `build/${name}.swf`
      }, null, 2)
    },
    folders: ['src', 'build', '.wayangide']
  },
  wayangide: {
    name: 'WayangIDE Mod',
    description: 'Template untuk WayangIDE dengan struktur folder lengkap',
    files: {
      'src/Main.as': (name: string) => `package {
    import flash.display.Sprite;
    import flash.events.Event;

    [SWF(width="800", height="600", backgroundColor="#070b13", frameRate="60")]
    public class Main extends Sprite {
        public function Main() {
            if (stage) init();
            else addEventListener(Event.ADDED_TO_STAGE, init);
        }
        
        private function init(e:Event = null):void {
            removeEventListener(Event.ADDED_TO_STAGE, init);
            trace("${name} mod loaded!");
        }
    }
}`,
      'asconfig.json': (name: string) => JSON.stringify({
        compilerOptions: {
          "source-path": ["src"],
          "output": `build/${name}.swf`,
          "target-player": "32.0",
          "static-link-runtime-shared-libraries": true
        },
        files: ["src/Main.as"]
      }, null, 2),
      '.wayangide/settings.json': (name: string) => JSON.stringify({
        "workspace.projectName": name,
        "compiler.sdkPath": "",
        "compiler.defaultMain": "src/Main.as",
        "compiler.defaultOutput": `build/${name}.swf`,
        "workspace.assetSwfPaths": "client/assets/assets.swf"
      }, null, 2),
      'src/classes/.gitkeep': '',
      'src/skills/.gitkeep': '',
      'src/items/.gitkeep': '',
      'src/enemy/.gitkeep': ''
    },
    folders: ['src', 'src/classes', 'src/skills', 'src/items', 'src/enemy', 'build', '.wayangide']
  },
  empty: {
    name: 'Empty Project',
    description: 'Project kosong tanpa file sample',
    files: {
      'asconfig.json': (name: string) => JSON.stringify({
        compilerOptions: {
          "source-path": ["src"],
          "output": `build/${name}.swf`,
          "target-player": "32.0",
          "static-link-runtime-shared-libraries": true
        },
        files: []
      }, null, 2),
      '.wayangide/settings.json': (name: string) => JSON.stringify({
        "workspace.projectName": name,
        "compiler.sdkPath": "",
        "compiler.defaultMain": "",
        "compiler.defaultOutput": `build/${name}.swf`
      }, null, 2)
    },
    folders: ['src', 'build', '.wayangide']
  }
}
