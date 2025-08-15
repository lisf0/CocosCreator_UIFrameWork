"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.methods = void 0;
exports.load = load;
exports.unload = unload;
const cc_1 = require("cc");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const package_json_1 = __importDefault(require("../package.json"));
const Const_1 = __importDefault(require("./Const"));
const ProjectPath = Editor.Project.path;
// 临时在当前模块增加编辑器内的模块为搜索路径，为了能够正常 require 到 cc 模块，后续版本将优化调用方式
// module.paths.push(join(Editor.App.path, 'node_modules'));
// 当前版本需要在 module.paths 修改后才能正常使用 cc 模块
// 并且如果希望正常显示 cc 的定义，需要手动将 engine 文件夹里的 cc.d.ts 添加到插件的 tsconfig 里
// 当前版本的 cc 定义文件可以在当前项目的 temp/declarations/cc.d.ts 找到
// import { director } from 'cc';
/**
 * @en Registration method for the main process of Extension
 * @zh 为扩展的主进程的注册方法
 */
exports.methods = {
    /**
     * @en A method that can be triggered by message
     * @zh 通过 message 触发的方法
     */
    showLog() {
        console.log('Hello World');
    },
    bindRoot() {
        //@ts-ignore cce 没找到有声明,所以此处使用ts忽略
        let NodeRoot = cce.Scene.rootNode;
        this.bind(NodeRoot);
    },
    async bindNode() {
        var nodeIds = Editor.Selection.getSelected('node');
        if (nodeIds == null || nodeIds.length == 0 || nodeIds[0] == null || nodeIds[0] == "") {
            console.log('Please select a node.');
            return null;
        }
        if (nodeIds.length > 1) {
            console.log('Please select only one node.');
            return null;
        }
        const scene = cc_1.director.getScene();
        if (scene) {
            for (let index = 0; index < nodeIds.length; index++) {
                const id = nodeIds[index];
                let node = this.findNodeByUUID(id, cc_1.director.getScene());
                await this.bind(node);
            }
        }
    },
    async bind(NodeRoot) {
        //@ts-ignore 
        const comp = NodeRoot.getComponent(ab.Component);
        if (!comp) {
            console.warn(`${NodeRoot.name} 没有挂载 继承自ABComponent 脚本`);
            return;
        }
        let configPath = path_1.default.join(ProjectPath, Const_1.default.ConfigUrl);
        let config = Const_1.default.DefaultConfig;
        if (fs_1.default.existsSync(configPath)) {
            console.log(`正在读取配置文件: ${ProjectPath}/${Const_1.default.ConfigUrl} 请稍等.`);
            let content = fs_1.default.readFileSync(`${ProjectPath}/${Const_1.default.ConfigUrl}`, { encoding: 'utf-8' });
            if (!content) {
                console.warn(`读取配置文件失败:${ProjectPath}/${Const_1.default.ConfigUrl}`);
                return;
            }
            config = JSON.parse(content);
        }
        // @ts-ignore
        const scriptUuid = comp.__scriptUuid;
        let ComponentScriptPath = await Editor.Message.request('asset-db', 'query-path', scriptUuid);
        console.log(ComponentScriptPath);
        if (ComponentScriptPath == null || ComponentScriptPath.length <= 0) {
            console.warn(`获取组件路径失败!`);
            return;
        }
        ComponentScriptPath = ComponentScriptPath.replace(/\\/g, "/");
        // let ProjectDir = Editor.Project.path;
        let UIComName = this.getABComponentName(NodeRoot);
        let AutoScriptName = `${UIComName}_Auto`;
        let AutoScriptPath = ``;
        const getAutoScriptPath = (config) => {
            let tempPath = "";
            let matchPath = `${ProjectPath}/${config.RootDir}`.replace(/\\/g, "/");
            if (config.ScriptsDir.startsWith("assets/")) {
                matchPath = `${ProjectPath}/${config.ScriptsDir}`.replace(/\\/g, "/");
            }
            if (ComponentScriptPath.startsWith(matchPath)) {
                if (config.ScriptsDir.startsWith("assets/")) {
                    tempPath = `${ProjectPath}/${config.ScriptsDir}/${Const_1.default.AutoScriptsDirName}/${AutoScriptName}.ts`.replace(/\\/g, "/");
                }
                else {
                    tempPath = `${ProjectPath}/${config.RootDir}/${config.ScriptsDir}/${Const_1.default.AutoScriptsDirName}/${AutoScriptName}.ts`.replace(/\\/g, "/");
                }
            }
            return tempPath;
        };
        if (Array.isArray(config)) {
            for (let index = 0; index < config.length; index++) {
                const element = config[index];
                AutoScriptPath = getAutoScriptPath(element);
                if (AutoScriptPath != "") {
                    break;
                }
            }
        }
        else {
            AutoScriptPath = getAutoScriptPath(config);
        }
        if (AutoScriptPath.length <= 0) {
            console.warn(`获取保存路径失败,请检查配置内容:${ProjectPath}/${Const_1.default.ConfigUrl}!`);
            return;
        }
        let nodeMaps = {}, importMaps = {};
        this.findNodes(NodeRoot, nodeMaps, importMaps, true);
        let _str_import = ``;
        for (let key in importMaps) {
            _str_import += `import ${key} from "${this.getImportPath(importMaps[key], AutoScriptPath)}"\n`;
        }
        let _cc_comps = [];
        let _str_content = ``;
        for (let key in nodeMaps) {
            let type = nodeMaps[key][0];
            let arr = type.split(".");
            if (arr[0] == "cc") {
                if (_cc_comps.indexOf(arr[1]) == -1) {
                    _cc_comps.push(arr[1]);
                }
                type = arr[1];
            }
            _str_content += `\t@property(${type})\n\t${key}: ${type} | null = null;\n`;
        }
        let _str_cc_comps = _cc_comps.length > 0 ? ', ' + _cc_comps.join(", ") : '';
        let strScript = `${_str_import}
import { _decorator, Component${_str_cc_comps} } from 'cc';
const { ccclass, property } = _decorator;

@ccclass("${AutoScriptName}")
export default class ${AutoScriptName} extends Component {
${_str_content} 
}`;
        let dbScriptPath = AutoScriptPath.replace(ProjectPath.replace(/\\/g, "/"), "db:/");
        this.saveFile(dbScriptPath, strScript);
        try {
            await Editor.Message.request('asset-db', 'refresh-asset', dbScriptPath);
            let autoComp = this.getComponent(NodeRoot, AutoScriptName);
            if (!autoComp) {
                const shortcuts = package_json_1.default.contributions.shortcuts.map(v => v.win).join(' / ');
                if (!cc_1.js.getClassByName(AutoScriptName)) {
                    console.info(`请再执行一次 ${shortcuts}`);
                    return;
                }
                await Editor.Message.request('scene', 'create-component', { uuid: NodeRoot.uuid, component: AutoScriptName });
                // autoComp = this.getComponent(NodeRoot, AutoScriptName);  // ↑并不会实时附加上去
                console.info(`请再执行一次 ${shortcuts}`);
                return;
            }
            for (let key in nodeMaps) {
                let options = {
                    uuid: NodeRoot.uuid,
                    path: `__comps__.${this.getComponentIndex(NodeRoot, AutoScriptName)}.${key}`,
                    dump: {
                        type: nodeMaps[key][0],
                        value: {
                            uuid: nodeMaps[key][1],
                        }
                    }
                };
                if (options.dump.type != Const_1.default.SeparatorMap.Node) {
                    let appendComp = this.getComponent(this.findNodeByUUID(nodeMaps[key][1], NodeRoot), options.dump.type);
                    if (appendComp) {
                        options.dump.value = {
                            uuid: appendComp.uuid
                        };
                    }
                }
                Editor.Message.request('scene', 'set-property', options);
            }
            console.log(AutoScriptName + '.ts 生成成功');
        }
        catch (error) {
            console.log(error);
        }
    },
    saveFile(ScriptPath, strScript) {
        return new Promise(async (resolve, reject) => {
            const result = await Editor.Message.request('asset-db', 'create-asset', ScriptPath, strScript, { overwrite: true });
            //   console.log('create‑or‑save 结果：', result);
            resolve(result);
        });
    },
    /** 计算相对路径 */
    getImportPath(exportPath, currPath) {
        exportPath = exportPath.replace(/\\/g, "/").substr(0, exportPath.lastIndexOf("."));
        currPath = currPath.replace(/\\/g, "/");
        let tmp = "./";
        let start, end;
        let exportStr = exportPath.split("/");
        let currStr = currPath.split("/");
        for (end = 0; end < exportStr.length; ++end) {
            if (exportStr[end] != currStr[end]) {
                break;
            }
        }
        for (start = end + 1; start < currStr.length; ++start) {
            tmp += "../";
        }
        for (start = end; start < exportStr.length; ++start) {
            tmp += `${exportStr[start]}/`;
        }
        tmp = tmp.substr(0, tmp.length - 1);
        return tmp;
    },
    /** 获得Component的类名 */
    getComponentName(com) {
        let arr = com.name.match(/<.*>$/);
        if (arr && arr.length > 0) {
            return arr[0].slice(1, -1);
        }
        return com.name;
    },
    getABComponentName(node) {
        //@ts-ignore 
        let coms = node.getComponents(ab.Component);
        // 优先取UI开头的组件
        for (let index = 0; index < coms.length; index++) {
            let name = this.getComponentName(coms[index]);
            if (name && name.startsWith("UI") && !name.endsWith("_Auto")) {
                return name;
            }
        }
        // 找不到UI开头的组件
        for (let index = 0; index < coms.length; index++) {
            let name = this.getComponentName(coms[index]);
            if (name && !name.endsWith("_Auto")) {
                return name;
            }
        }
        return null;
    },
    /**
     * 获取节点的组件
     * 解决因调用 Editor.Message.request('asset-db', 'refresh-asset' 后 将无法通过cc的getComponent来获得组件
     */
    getComponent(node, name) {
        let com = null;
        if (typeof name == "string") {
            com = node.components.find(item => item.name == `${node.name}<${name}>`);
        }
        if (com == null) {
            com = node.getComponent(name);
        }
        return com;
    },
    /**
     * 获取组件下标
     * @param node
     * @param name
     * @returns
     */
    getComponentIndex(node, name) {
        let index = node.components.findIndex(item => item.name == `${node.name}<${name}>`);
        return index;
    },
    findNodeByUUID(uuid, rootNode) {
        if (rootNode.uuid == uuid) {
            return rootNode;
        }
        for (let i = 0; i < rootNode.children.length; i++) {
            let node = this.findNodeByUUID(uuid, rootNode.children[i]);
            if (node) {
                return node;
            }
        }
        return null;
    },
    async findNodes(node, _nodeMaps, _importMaps, isRoot) {
        let name = node.name;
        if (!isRoot && this.checkNodePrefix(name)) {
            // 获得这个组件的类型 和 名称
            let names = this.getPrefixNames(name);
            if (names === null || names.length !== 2) {
                console.log(`${name} 命令不规范, 请使用_Label$xxx的格式!, 或者是在SysDefine中没有定义`);
                return;
            }
            let type = Const_1.default.SeparatorMap[names[0]] || names[0];
            let value = names[1];
            if (value.endsWith(Const_1.default.STANDARD_End)) {
                value = value.substring(0, value.length - Const_1.default.STANDARD_End.length);
            }
            // 进入到这里， 就表示可以绑定了
            if (_nodeMaps[value]) {
                console.log("出现了重名字段:", value);
            }
            _nodeMaps[value] = [type, node.uuid];
            // 检查是否是自定义组件
            let comp = node.getComponent(type);
            if (!_importMaps[type] && type.indexOf("cc.") === -1 && comp) {
                // @ts-ignore
                const scriptUuid = comp.__scriptUuid;
                const info = await Editor.Message.request('asset-db', 'query-asset-info', scriptUuid);
                if (info) {
                    // console.log('资源 URL:', info.url);
                    let componentPath = info.url;
                    componentPath = componentPath.replace(/\s*/g, "").replace(/\\/g, "/");
                    _importMaps[type] = componentPath;
                }
            }
        }
        if (isRoot || this.checkBindChildren(name)) {
            // 绑定子节点
            node.children.forEach(async (target) => {
                await this.findNodes(target, _nodeMaps, _importMaps, false);
            });
        }
    },
    /** 检测前缀是否符合绑定规范 */
    checkNodePrefix(name) {
        if (name[0] !== Const_1.default.STANDARD_Prefix) {
            return false;
        }
        return true;
    },
    /** 检查后缀 */
    checkBindChildren(name) {
        if (name[name.length - 1] !== Const_1.default.STANDARD_End) {
            return true;
        }
        return false;
    },
    /** 获得类型和name */
    getPrefixNames(name) {
        if (name === null) {
            return '';
        }
        return name.substr(1, name.length).split(Const_1.default.STANDARD_Separator);
    }
};
/**
 * @en Method Triggered on Extension Startup
 * @zh 扩展启动时触发的方法
 */
function load() { }
/**
 * @en Method triggered when uninstalling the extension
 * @zh 卸载扩展时触发的方法
 */
function unload() { }
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zb3VyY2Uvc2NlbmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBbVpBLG9CQUEwQjtBQU0xQix3QkFBNEI7QUF6WjVCLDJCQUFtRDtBQUNuRCw0Q0FBb0I7QUFDcEIsZ0RBQXdCO0FBQ3hCLG1FQUEwQztBQUMxQyxvREFBNEI7QUFFNUIsTUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7QUFFeEMsMkRBQTJEO0FBQzNELDREQUE0RDtBQUU1RCx1Q0FBdUM7QUFDdkMsaUVBQWlFO0FBQ2pFLHFEQUFxRDtBQUNyRCxpQ0FBaUM7QUFFakM7OztHQUdHO0FBQ1UsUUFBQSxPQUFPLEdBQTRDO0lBQzVEOzs7T0FHRztJQUNILE9BQU87UUFDSCxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFHRCxRQUFRO1FBQ0osa0NBQWtDO1FBQ2xDLElBQUksUUFBUSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDO1FBQ2xDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDeEIsQ0FBQztJQUVELEtBQUssQ0FBQyxRQUFRO1FBQ1YsSUFBSSxPQUFPLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFbkQsSUFBSSxPQUFPLElBQUksSUFBSSxJQUFJLE9BQU8sQ0FBQyxNQUFNLElBQUksQ0FBQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDO1lBQ25GLE9BQU8sQ0FBQyxHQUFHLENBQUMsdUJBQXVCLENBQUMsQ0FBQztZQUNyQyxPQUFPLElBQUksQ0FBQztRQUNoQixDQUFDO1FBRUQsSUFBSSxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxD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QUMsSUFBWTtRQUN4QixJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxlQUFLLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDcEMsT0FBTyxLQUFLLENBQUM7UUFDakIsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFDRCxXQUFXO0lBQ1gsaUJBQWlCLENBQUMsSUFBWTtRQUMxQixJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxLQUFLLGVBQUssQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUMvQyxPQUFPLElBQUksQ0FBQztRQUNoQixDQUFDO1FBQ0QsT0FBTyxLQUFLLENBQUM7SUFDakIsQ0FBQztJQUNELGdCQUFnQjtJQUNoQixjQUFjLENBQUMsSUFBWTtRQUN2QixJQUFJLElBQUksS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUNoQixPQUFPLEVBQUUsQ0FBQztRQUNkLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFLLENBQUMsZUFBSyxDQUFDLGtCQUFrQixDQUFDLENBQUM7SUFDdkUsQ0FBQztDQUNKLENBQUM7QUFFRjs7O0dBR0c7QUFDSCxTQUFnQixJQUFJLEtBQUssQ0FBQztBQUUxQjs7O0dBR0c7QUFDSCxTQUFnQixNQUFNLEtBQUssQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbXBvbmVudCwgZGlyZWN0b3IsIGpzLCBOb2RlIH0gZnJvbSAnY2MnO1xyXG5pbXBvcnQgZnMgZnJvbSBcImZzXCI7XHJcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xyXG5pbXBvcnQgcGFja2FnZUpTT04gZnJvbSAnLi4vcGFja2FnZS5qc29uJztcclxuaW1wb3J0IENvbnN0IGZyb20gXCIuL0NvbnN0XCI7XHJcblxyXG5jb25zdCBQcm9qZWN0UGF0aCA9IEVkaXRvci5Qcm9qZWN0LnBhdGg7XHJcblxyXG4vLyDkuLTml7blnKjlvZPliY3mqKHlnZflop7liqDnvJbovpHlmajlhoXnmoTmqKHlnZfkuLrmkJzntKLot6/lvoTvvIzkuLrkuobog73lpJ/mraPluLggcmVxdWlyZSDliLAgY2Mg5qih5Z2X77yM5ZCO57ut54mI5pys5bCG5LyY5YyW6LCD55So5pa55byPXHJcbi8vIG1vZHVsZS5wYXRocy5wdXNoKGpvaW4oRWRpdG9yLkFwcC5wYXRoLCAnbm9kZV9tb2R1bGVzJykpO1xyXG5cclxuLy8g5b2T5YmN54mI5pys6ZyA6KaB5ZyoIG1vZHVsZS5wYXRocyDkv67mlLnlkI7miY3og73mraPluLjkvb/nlKggY2Mg5qih5Z2XXHJcbi8vIOW5tuS4lOWmguaenOW4jOacm+ato+W4uOaYvuekuiBjYyDnmoTlrprkuYnvvIzpnIDopoHmiYvliqjlsIYgZW5naW5lIOaWh+S7tuWkuemHjOeahCBjYy5kLnRzIOa3u+WKoOWIsOaPkuS7tueahCB0c2NvbmZpZyDph4xcclxuLy8g5b2T5YmN54mI5pys55qEIGNjIOWumuS5ieaWh+S7tuWPr+S7peWcqOW9k+WJjemhueebrueahCB0ZW1wL2RlY2xhcmF0aW9ucy9jYy5kLnRzIOaJvuWIsFxyXG4vLyBpbXBvcnQgeyBkaXJlY3RvciB9IGZyb20gJ2NjJztcclxuXHJcbi8qKlxyXG4gKiBAZW4gUmVnaXN0cmF0aW9uIG1ldGhvZCBmb3IgdGhlIG1haW4gcHJvY2VzcyBvZiBFeHRlbnNpb25cclxuICogQHpoIOS4uuaJqeWxleeahOS4u+i/m+eoi+eahOazqOWGjOaWueazlVxyXG4gKi9cclxuZXhwb3J0IGNvbnN0IG1ldGhvZHM6IHsgW2tleTogc3RyaW5nXTogKC4uLmFueTogYW55KSA9PiBhbnkgfSA9IHtcclxuICAgIC8qKlxyXG4gICAgICogQGVuIEEgbWV0aG9kIHRoYXQgY2FuIGJlIHRyaWdnZXJlZCBieSBtZXNzYWdlXHJcbiAgICAgKiBAemgg6YCa6L+HIG1lc3NhZ2Ug6Kem5Y+R55qE5pa55rOVXHJcbiAgICAgKi9cclxuICAgIHNob3dMb2coKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ0hlbGxvIFdvcmxkJyk7XHJcbiAgICB9LFxyXG5cclxuXHJcbiAgICBiaW5kUm9vdCgpIHtcclxuICAgICAgICAvL0B0cy1pZ25vcmUgY2NlIOayoeaJvuWIsOacieWjsOaYjizmiYDku6XmraTlpITkvb/nlKh0c+W/veeVpVxyXG4gICAgICAgIGxldCBOb2RlUm9vdCA9IGNjZS5TY2VuZS5yb290Tm9kZTtcclxuICAgICAgICB0aGlzLmJpbmQoTm9kZVJvb3QpO1xyXG4gICAgfSxcclxuXHJcbiAgICBhc3luYyBiaW5kTm9kZSgpIHtcclxuICAgICAgICB2YXIgbm9kZUlkcyA9IEVkaXRvci5TZWxlY3Rpb24uZ2V0U2VsZWN0ZWQoJ25vZGUnKTtcclxuXHJcbiAgICAgICAgaWYgKG5vZGVJZHMgPT0gbnVsbCB8fCBub2RlSWRzLmxlbmd0aCA9PSAwIHx8IG5vZGVJZHNbMF0gPT0gbnVsbCB8fCBub2RlSWRzWzBdID09IFwiXCIpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ1BsZWFzZSBzZWxlY3QgYSBub2RlLicpO1xyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChub2RlSWRzLmxlbmd0aCA+IDEpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ1BsZWFzZSBzZWxlY3Qgb25seSBvbmUgbm9kZS4nKTtcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKClcclxuICAgICAgICBpZiAoc2NlbmUpIHtcclxuICAgICAgICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IG5vZGVJZHMubGVuZ3RoOyBpbmRleCsrKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBpZCA9IG5vZGVJZHNbaW5kZXhdO1xyXG4gICAgICAgICAgICAgICAgbGV0IG5vZGUgPSB0aGlzLmZpbmROb2RlQnlVVUlEKGlkLCBkaXJlY3Rvci5nZXRTY2VuZSgpKTtcclxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuYmluZChub2RlKTtcclxuXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9LFxyXG5cclxuICAgIGFzeW5jIGJpbmQoTm9kZVJvb3Q6IE5vZGUpIHtcclxuXHJcbiAgICAgICAgLy9AdHMtaWdub3JlIFxyXG4gICAgICAgIGNvbnN0IGNvbXAgPSBOb2RlUm9vdC5nZXRDb21wb25lbnQoYWIuQ29tcG9uZW50KTtcclxuXHJcbiAgICAgICAgaWYgKCFjb21wKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgJHtOb2RlUm9vdC5uYW1lfSDmsqHmnInmjILovb0g57un5om/6IeqQUJDb21wb25lbnQg6ISa5pysYCk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBjb25maWdQYXRoID0gcGF0aC5qb2luKFByb2plY3RQYXRoLCBDb25zdC5Db25maWdVcmwpO1xyXG4gICAgICAgIGxldCBjb25maWcgPSBDb25zdC5EZWZhdWx0Q29uZmlnO1xyXG4gICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGNvbmZpZ1BhdGgpKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGDmraPlnKjor7vlj5bphY3nva7mlofku7Y6ICR7UHJvamVjdFBhdGh9LyR7Q29uc3QuQ29uZmlnVXJsfSDor7fnqI3nrYkuYCk7XHJcbiAgICAgICAgICAgIGxldCBjb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKGAke1Byb2plY3RQYXRofS8ke0NvbnN0LkNvbmZpZ1VybH1gLCB7IGVuY29kaW5nOiAndXRmLTgnIH0pO1xyXG4gICAgICAgICAgICBpZiAoIWNvbnRlbnQpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUud2Fybihg6K+75Y+W6YWN572u5paH5Lu25aSx6LSlOiR7UHJvamVjdFBhdGh9LyR7Q29uc3QuQ29uZmlnVXJsfWApO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNvbmZpZyA9IEpTT04ucGFyc2UoY29udGVudCk7XHJcbiAgICAgICAgfVxyXG5cclxuXHJcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxyXG4gICAgICAgIGNvbnN0IHNjcmlwdFV1aWQgPSBjb21wLl9fc2NyaXB0VXVpZDtcclxuICAgICAgICBsZXQgQ29tcG9uZW50U2NyaXB0UGF0aCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LXBhdGgnLCBzY3JpcHRVdWlkKVxyXG5cclxuICAgICAgICBjb25zb2xlLmxvZyhDb21wb25lbnRTY3JpcHRQYXRoKTtcclxuXHJcbiAgICAgICAgaWYgKENvbXBvbmVudFNjcmlwdFBhdGggPT0gbnVsbCB8fCBDb21wb25lbnRTY3JpcHRQYXRoLmxlbmd0aCA8PSAwKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUud2Fybihg6I635Y+W57uE5Lu26Lev5b6E5aSx6LSlIWApO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIENvbXBvbmVudFNjcmlwdFBhdGggPSBDb21wb25lbnRTY3JpcHRQYXRoLnJlcGxhY2UoL1xcXFwvZywgXCIvXCIpO1xyXG5cclxuICAgICAgICAvLyBsZXQgUHJvamVjdERpciA9IEVkaXRvci5Qcm9qZWN0LnBhdGg7XHJcbiAgICAgICAgbGV0IFVJQ29tTmFtZSA9IHRoaXMuZ2V0QUJDb21wb25lbnROYW1lKE5vZGVSb290KTtcclxuICAgICAgICBsZXQgQXV0b1NjcmlwdE5hbWUgPSBgJHtVSUNvbU5hbWV9X0F1dG9gO1xyXG4gICAgICAgIGxldCBBdXRvU2NyaXB0UGF0aCA9IGBgO1xyXG5cclxuICAgICAgICBjb25zdCBnZXRBdXRvU2NyaXB0UGF0aCA9IChjb25maWc6IGFueSkgPT4ge1xyXG5cclxuICAgICAgICAgICAgbGV0IHRlbXBQYXRoID0gXCJcIjtcclxuXHJcbiAgICAgICAgICAgIGxldCBtYXRjaFBhdGggPSBgJHtQcm9qZWN0UGF0aH0vJHtjb25maWcuUm9vdERpcn1gLnJlcGxhY2UoL1xcXFwvZywgXCIvXCIpXHJcbiAgICAgICAgICAgIGlmIChjb25maWcuU2NyaXB0c0Rpci5zdGFydHNXaXRoKFwiYXNzZXRzL1wiKSkge1xyXG4gICAgICAgICAgICAgICAgbWF0Y2hQYXRoID0gYCR7UHJvamVjdFBhdGh9LyR7Y29uZmlnLlNjcmlwdHNEaXJ9YC5yZXBsYWNlKC9cXFxcL2csIFwiL1wiKVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoQ29tcG9uZW50U2NyaXB0UGF0aC5zdGFydHNXaXRoKG1hdGNoUGF0aCkpIHtcclxuICAgICAgICAgICAgICAgIGlmIChjb25maWcuU2NyaXB0c0Rpci5zdGFydHNXaXRoKFwiYXNzZXRzL1wiKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRlbXBQYXRoID0gYCR7UHJvamVjdFBhdGh9LyR7Y29uZmlnLlNjcmlwdHNEaXJ9LyR7Q29uc3QuQXV0b1NjcmlwdHNEaXJOYW1lfS8ke0F1dG9TY3JpcHROYW1lfS50c2AucmVwbGFjZSgvXFxcXC9nLCBcIi9cIik7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHRlbXBQYXRoID0gYCR7UHJvamVjdFBhdGh9LyR7Y29uZmlnLlJvb3REaXJ9LyR7Y29uZmlnLlNjcmlwdHNEaXJ9LyR7Q29uc3QuQXV0b1NjcmlwdHNEaXJOYW1lfS8ke0F1dG9TY3JpcHROYW1lfS50c2AucmVwbGFjZSgvXFxcXC9nLCBcIi9cIik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHRlbXBQYXRoO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoY29uZmlnKSkge1xyXG4gICAgICAgICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgY29uZmlnLmxlbmd0aDsgaW5kZXgrKykge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgZWxlbWVudCA9IGNvbmZpZ1tpbmRleF07XHJcbiAgICAgICAgICAgICAgICBBdXRvU2NyaXB0UGF0aCA9IGdldEF1dG9TY3JpcHRQYXRoKGVsZW1lbnQpO1xyXG4gICAgICAgICAgICAgICAgaWYgKEF1dG9TY3JpcHRQYXRoICE9IFwiXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIEF1dG9TY3JpcHRQYXRoID0gZ2V0QXV0b1NjcmlwdFBhdGgoY29uZmlnKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChBdXRvU2NyaXB0UGF0aC5sZW5ndGggPD0gMCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYOiOt+WPluS/neWtmOi3r+W+hOWksei0pSzor7fmo4Dmn6XphY3nva7lhoXlrrk6JHtQcm9qZWN0UGF0aH0vJHtDb25zdC5Db25maWdVcmx9IWApO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuXHJcbiAgICAgICAgbGV0IG5vZGVNYXBzOiB7IFtrZXk6IHN0cmluZ106IHN0cmluZ1tdIH0gPSB7fSwgaW1wb3J0TWFwczogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSA9IHt9O1xyXG4gICAgICAgIHRoaXMuZmluZE5vZGVzKE5vZGVSb290LCBub2RlTWFwcywgaW1wb3J0TWFwcywgdHJ1ZSk7XHJcblxyXG4gICAgICAgIGxldCBfc3RyX2ltcG9ydCA9IGBgO1xyXG4gICAgICAgIGZvciAobGV0IGtleSBpbiBpbXBvcnRNYXBzKSB7XHJcbiAgICAgICAgICAgIF9zdHJfaW1wb3J0ICs9IGBpbXBvcnQgJHtrZXl9IGZyb20gXCIke3RoaXMuZ2V0SW1wb3J0UGF0aChpbXBvcnRNYXBzW2tleV0sIEF1dG9TY3JpcHRQYXRoKX1cIlxcbmA7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGxldCBfY2NfY29tcHM6IHN0cmluZ1tdID0gW107XHJcbiAgICAgICAgbGV0IF9zdHJfY29udGVudCA9IGBgO1xyXG4gICAgICAgIGZvciAobGV0IGtleSBpbiBub2RlTWFwcykge1xyXG4gICAgICAgICAgICBsZXQgdHlwZSA9IG5vZGVNYXBzW2tleV1bMF07XHJcbiAgICAgICAgICAgIGxldCBhcnIgPSB0eXBlLnNwbGl0KFwiLlwiKTtcclxuICAgICAgICAgICAgaWYgKGFyclswXSA9PSBcImNjXCIpIHtcclxuICAgICAgICAgICAgICAgIGlmIChfY2NfY29tcHMuaW5kZXhPZihhcnJbMV0pID09IC0xKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgX2NjX2NvbXBzLnB1c2goYXJyWzFdKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHR5cGUgPSBhcnJbMV07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgX3N0cl9jb250ZW50ICs9IGBcXHRAcHJvcGVydHkoJHt0eXBlfSlcXG5cXHQke2tleX06ICR7dHlwZX0gfCBudWxsID0gbnVsbDtcXG5gO1xyXG4gICAgICAgIH1cclxuICAgICAgICBsZXQgX3N0cl9jY19jb21wcyA9IF9jY19jb21wcy5sZW5ndGggPiAwID8gJywgJyArIF9jY19jb21wcy5qb2luKFwiLCBcIikgOiAnJztcclxuXHJcbiAgICAgICAgbGV0IHN0clNjcmlwdCA9IGAke19zdHJfaW1wb3J0fVxyXG5pbXBvcnQgeyBfZGVjb3JhdG9yLCBDb21wb25lbnQke19zdHJfY2NfY29tcHN9IH0gZnJvbSAnY2MnO1xyXG5jb25zdCB7IGNjY2xhc3MsIHByb3BlcnR5IH0gPSBfZGVjb3JhdG9yO1xyXG5cclxuQGNjY2xhc3MoXCIke0F1dG9TY3JpcHROYW1lfVwiKVxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyAke0F1dG9TY3JpcHROYW1lfSBleHRlbmRzIENvbXBvbmVudCB7XHJcbiR7X3N0cl9jb250ZW50fSBcclxufWA7XHJcblxyXG4gICAgICAgIGxldCBkYlNjcmlwdFBhdGggPSBBdXRvU2NyaXB0UGF0aC5yZXBsYWNlKFByb2plY3RQYXRoLnJlcGxhY2UoL1xcXFwvZywgXCIvXCIpLCBcImRiOi9cIik7XHJcbiAgICAgICAgdGhpcy5zYXZlRmlsZShkYlNjcmlwdFBhdGgsIHN0clNjcmlwdClcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdyZWZyZXNoLWFzc2V0JywgZGJTY3JpcHRQYXRoKTtcclxuXHJcbiAgICAgICAgICAgIGxldCBhdXRvQ29tcCA9IHRoaXMuZ2V0Q29tcG9uZW50KE5vZGVSb290LCBBdXRvU2NyaXB0TmFtZSk7XHJcbiAgICAgICAgICAgIGlmICghYXV0b0NvbXApIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHNob3J0Y3V0cyA9IHBhY2thZ2VKU09OLmNvbnRyaWJ1dGlvbnMuc2hvcnRjdXRzLm1hcCh2ID0+IHYud2luKS5qb2luKCcgLyAnKTtcclxuICAgICAgICAgICAgICAgIGlmICghanMuZ2V0Q2xhc3NCeU5hbWUoQXV0b1NjcmlwdE5hbWUpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5pbmZvKGDor7flho3miafooYzkuIDmrKEgJHtzaG9ydGN1dHN9YCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnY3JlYXRlLWNvbXBvbmVudCcsIHsgdXVpZDogTm9kZVJvb3QudXVpZCwgY29tcG9uZW50OiBBdXRvU2NyaXB0TmFtZSB9KTtcclxuICAgICAgICAgICAgICAgIC8vIGF1dG9Db21wID0gdGhpcy5nZXRDb21wb25lbnQoTm9kZVJvb3QsIEF1dG9TY3JpcHROYW1lKTsgIC8vIOKGkeW5tuS4jeS8muWunuaXtumZhOWKoOS4iuWOu1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5pbmZvKGDor7flho3miafooYzkuIDmrKEgJHtzaG9ydGN1dHN9YCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZvciAobGV0IGtleSBpbiBub2RlTWFwcykge1xyXG5cclxuICAgICAgICAgICAgICAgIGxldCBvcHRpb25zID0ge1xyXG4gICAgICAgICAgICAgICAgICAgIHV1aWQ6IE5vZGVSb290LnV1aWQsXHJcbiAgICAgICAgICAgICAgICAgICAgcGF0aDogYF9fY29tcHNfXy4ke3RoaXMuZ2V0Q29tcG9uZW50SW5kZXgoTm9kZVJvb3QsIEF1dG9TY3JpcHROYW1lKX0uJHtrZXl9YCxcclxuICAgICAgICAgICAgICAgICAgICBkdW1wOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IG5vZGVNYXBzW2tleV1bMF0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1dWlkOiBub2RlTWFwc1trZXldWzFdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmR1bXAudHlwZSAhPSBDb25zdC5TZXBhcmF0b3JNYXAuTm9kZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBhcHBlbmRDb21wID0gdGhpcy5nZXRDb21wb25lbnQodGhpcy5maW5kTm9kZUJ5VVVJRChub2RlTWFwc1trZXldWzFdLCBOb2RlUm9vdCksIG9wdGlvbnMuZHVtcC50eXBlKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoYXBwZW5kQ29tcCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmR1bXAudmFsdWUgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1dWlkOiBhcHBlbmRDb21wLnV1aWRcclxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywgb3B0aW9ucyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY29uc29sZS5sb2coQXV0b1NjcmlwdE5hbWUgKyAnLnRzIOeUn+aIkOaIkOWKnycpO1xyXG5cclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhlcnJvcik7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICBzYXZlRmlsZShTY3JpcHRQYXRoOiBzdHJpbmcsIHN0clNjcmlwdDogc3RyaW5nKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGFzeW5jIChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoXHJcbiAgICAgICAgICAgICAgICAnYXNzZXQtZGInLFxyXG4gICAgICAgICAgICAgICAgJ2NyZWF0ZS1hc3NldCcsXHJcbiAgICAgICAgICAgICAgICBTY3JpcHRQYXRoLFxyXG4gICAgICAgICAgICAgICAgc3RyU2NyaXB0LFxyXG4gICAgICAgICAgICAgICAgeyBvdmVyd3JpdGU6IHRydWUgfVxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAvLyAgIGNvbnNvbGUubG9nKCdjcmVhdGXigJFvcuKAkXNhdmUg57uT5p6c77yaJywgcmVzdWx0KTtcclxuICAgICAgICAgICAgcmVzb2x2ZShyZXN1bHQpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKiog6K6h566X55u45a+56Lev5b6EICovXHJcbiAgICBnZXRJbXBvcnRQYXRoKGV4cG9ydFBhdGg6IHN0cmluZywgY3VyclBhdGg6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICAgICAgZXhwb3J0UGF0aCA9IGV4cG9ydFBhdGgucmVwbGFjZSgvXFxcXC9nLCBcIi9cIikuc3Vic3RyKDAsIGV4cG9ydFBhdGgubGFzdEluZGV4T2YoXCIuXCIpKTtcclxuICAgICAgICBjdXJyUGF0aCA9IGN1cnJQYXRoLnJlcGxhY2UoL1xcXFwvZywgXCIvXCIpO1xyXG4gICAgICAgIGxldCB0bXAgPSBcIi4vXCI7XHJcbiAgICAgICAgbGV0IHN0YXJ0OiBudW1iZXIsIGVuZDogbnVtYmVyO1xyXG4gICAgICAgIGxldCBleHBvcnRTdHIgPSBleHBvcnRQYXRoLnNwbGl0KFwiL1wiKTtcclxuICAgICAgICBsZXQgY3VyclN0ciA9IGN1cnJQYXRoLnNwbGl0KFwiL1wiKTtcclxuICAgICAgICBmb3IgKGVuZCA9IDA7IGVuZCA8IGV4cG9ydFN0ci5sZW5ndGg7ICsrZW5kKSB7XHJcbiAgICAgICAgICAgIGlmIChleHBvcnRTdHJbZW5kXSAhPSBjdXJyU3RyW2VuZF0pIHtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZvciAoc3RhcnQgPSBlbmQgKyAxOyBzdGFydCA8IGN1cnJTdHIubGVuZ3RoOyArK3N0YXJ0KSB7XHJcbiAgICAgICAgICAgIHRtcCArPSBcIi4uL1wiO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmb3IgKHN0YXJ0ID0gZW5kOyBzdGFydCA8IGV4cG9ydFN0ci5sZW5ndGg7ICsrc3RhcnQpIHtcclxuICAgICAgICAgICAgdG1wICs9IGAke2V4cG9ydFN0cltzdGFydF19L2A7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRtcCA9IHRtcC5zdWJzdHIoMCwgdG1wLmxlbmd0aCAtIDEpO1xyXG4gICAgICAgIHJldHVybiB0bXA7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKiDojrflvpdDb21wb25lbnTnmoTnsbvlkI0gKi9cclxuICAgIGdldENvbXBvbmVudE5hbWUoY29tOiBDb21wb25lbnQpOiBzdHJpbmcge1xyXG4gICAgICAgIGxldCBhcnIgPSBjb20ubmFtZS5tYXRjaCgvPC4qPiQvKTtcclxuICAgICAgICBpZiAoYXJyICYmIGFyci5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBhcnJbMF0uc2xpY2UoMSwgLTEpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gY29tLm5hbWU7XHJcbiAgICB9LFxyXG5cclxuICAgIGdldEFCQ29tcG9uZW50TmFtZShub2RlOiBOb2RlKSB7XHJcblxyXG4gICAgICAgIC8vQHRzLWlnbm9yZSBcclxuICAgICAgICBsZXQgY29tcyA9IG5vZGUuZ2V0Q29tcG9uZW50cyhhYi5Db21wb25lbnQpO1xyXG5cclxuICAgICAgICAvLyDkvJjlhYjlj5ZVSeW8gOWktOeahOe7hOS7tlxyXG4gICAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBjb21zLmxlbmd0aDsgaW5kZXgrKykge1xyXG4gICAgICAgICAgICBsZXQgbmFtZSA9IHRoaXMuZ2V0Q29tcG9uZW50TmFtZShjb21zW2luZGV4XSk7XHJcbiAgICAgICAgICAgIGlmIChuYW1lICYmIG5hbWUuc3RhcnRzV2l0aChcIlVJXCIpICYmICFuYW1lLmVuZHNXaXRoKFwiX0F1dG9cIikpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBuYW1lO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDmib7kuI3liLBVSeW8gOWktOeahOe7hOS7tlxyXG4gICAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBjb21zLmxlbmd0aDsgaW5kZXgrKykge1xyXG4gICAgICAgICAgICBsZXQgbmFtZSA9IHRoaXMuZ2V0Q29tcG9uZW50TmFtZShjb21zW2luZGV4XSk7XHJcbiAgICAgICAgICAgIGlmIChuYW1lICYmICFuYW1lLmVuZHNXaXRoKFwiX0F1dG9cIikpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBuYW1lO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuXHJcblxyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIOiOt+WPluiKgueCueeahOe7hOS7tlxyXG4gICAgICog6Kej5Yaz5Zug6LCD55SoIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3JlZnJlc2gtYXNzZXQnIOWQjiDlsIbml6Dms5XpgJrov4djY+eahGdldENvbXBvbmVudOadpeiOt+W+l+e7hOS7tlxyXG4gICAgICovXHJcbiAgICBnZXRDb21wb25lbnQobm9kZTogTm9kZSwgbmFtZTogYW55KSB7XHJcbiAgICAgICAgbGV0IGNvbSA9IG51bGw7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBuYW1lID09IFwic3RyaW5nXCIpIHtcclxuICAgICAgICAgICAgY29tID0gbm9kZS5jb21wb25lbnRzLmZpbmQoaXRlbSA9PiBpdGVtLm5hbWUgPT0gYCR7bm9kZS5uYW1lfTwke25hbWV9PmApO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoY29tID09IG51bGwpIHtcclxuICAgICAgICAgICAgY29tID0gbm9kZS5nZXRDb21wb25lbnQobmFtZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBjb207XHJcbiAgICB9LFxyXG4gICAgLyoqXHJcbiAgICAgKiDojrflj5bnu4Tku7bkuIvmoIdcclxuICAgICAqIEBwYXJhbSBub2RlIFxyXG4gICAgICogQHBhcmFtIG5hbWUgXHJcbiAgICAgKiBAcmV0dXJucyBcclxuICAgICAqL1xyXG4gICAgZ2V0Q29tcG9uZW50SW5kZXgobm9kZTogTm9kZSwgbmFtZTogc3RyaW5nKSB7XHJcbiAgICAgICAgbGV0IGluZGV4ID0gbm9kZS5jb21wb25lbnRzLmZpbmRJbmRleChpdGVtID0+IGl0ZW0ubmFtZSA9PSBgJHtub2RlLm5hbWV9PCR7bmFtZX0+YCk7XHJcbiAgICAgICAgcmV0dXJuIGluZGV4O1xyXG4gICAgfSxcclxuXHJcblxyXG4gICAgZmluZE5vZGVCeVVVSUQodXVpZDogc3RyaW5nLCByb290Tm9kZTogTm9kZSk6IGFueSB7XHJcbiAgICAgICAgaWYgKHJvb3ROb2RlLnV1aWQgPT0gdXVpZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gcm9vdE5vZGU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJvb3ROb2RlLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGxldCBub2RlID0gdGhpcy5maW5kTm9kZUJ5VVVJRCh1dWlkLCByb290Tm9kZS5jaGlsZHJlbltpXSk7XHJcbiAgICAgICAgICAgIGlmIChub2RlKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbm9kZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgIH0sXHJcblxyXG4gICAgYXN5bmMgZmluZE5vZGVzKG5vZGU6IE5vZGUsIF9ub2RlTWFwczogeyBba2V5OiBzdHJpbmddOiBzdHJpbmdbXSB9LCBfaW1wb3J0TWFwczogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSwgaXNSb290OiBib29sZWFuKSB7XHJcbiAgICAgICAgbGV0IG5hbWUgPSBub2RlLm5hbWU7XHJcbiAgICAgICAgaWYgKCFpc1Jvb3QgJiYgdGhpcy5jaGVja05vZGVQcmVmaXgobmFtZSkpIHtcclxuICAgICAgICAgICAgLy8g6I635b6X6L+Z5Liq57uE5Lu255qE57G75Z6LIOWSjCDlkI3np7BcclxuICAgICAgICAgICAgbGV0IG5hbWVzID0gdGhpcy5nZXRQcmVmaXhOYW1lcyhuYW1lKTtcclxuICAgICAgICAgICAgaWYgKG5hbWVzID09PSBudWxsIHx8IG5hbWVzLmxlbmd0aCAhPT0gMikge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYCR7bmFtZX0g5ZG95Luk5LiN6KeE6IyDLCDor7fkvb/nlKhfTGFiZWwkeHh455qE5qC85byPISwg5oiW6ICF5piv5ZyoU3lzRGVmaW5l5Lit5rKh5pyJ5a6a5LmJYCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgbGV0IHR5cGUgPSBDb25zdC5TZXBhcmF0b3JNYXBbbmFtZXNbMF1dIHx8IG5hbWVzWzBdO1xyXG4gICAgICAgICAgICBsZXQgdmFsdWUgPSBuYW1lc1sxXTtcclxuICAgICAgICAgICAgaWYgKHZhbHVlLmVuZHNXaXRoKENvbnN0LlNUQU5EQVJEX0VuZCkpIHtcclxuICAgICAgICAgICAgICAgIHZhbHVlID0gdmFsdWUuc3Vic3RyaW5nKDAsIHZhbHVlLmxlbmd0aCAtIENvbnN0LlNUQU5EQVJEX0VuZC5sZW5ndGgpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyDov5vlhaXliLDov5nph4zvvIwg5bCx6KGo56S65Y+v5Lul57uR5a6a5LqGXHJcbiAgICAgICAgICAgIGlmIChfbm9kZU1hcHNbdmFsdWVdKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIuWHuueOsOS6humHjeWQjeWtl+autTpcIiwgdmFsdWUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIF9ub2RlTWFwc1t2YWx1ZV0gPSBbdHlwZSwgbm9kZS51dWlkXTtcclxuXHJcbiAgICAgICAgICAgIC8vIOajgOafpeaYr+WQpuaYr+iHquWumuS5iee7hOS7tlxyXG4gICAgICAgICAgICBsZXQgY29tcCA9IG5vZGUuZ2V0Q29tcG9uZW50KHR5cGUpO1xyXG4gICAgICAgICAgICBpZiAoIV9pbXBvcnRNYXBzW3R5cGVdICYmIHR5cGUuaW5kZXhPZihcImNjLlwiKSA9PT0gLTEgJiYgY29tcCkge1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcclxuICAgICAgICAgICAgICAgIGNvbnN0IHNjcmlwdFV1aWQgPSBjb21wLl9fc2NyaXB0VXVpZDtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgc2NyaXB0VXVpZCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoaW5mbykge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKCfotYTmupAgVVJMOicsIGluZm8udXJsKTtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgY29tcG9uZW50UGF0aCA9IGluZm8udXJsO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRQYXRoID0gY29tcG9uZW50UGF0aC5yZXBsYWNlKC9cXHMqL2csIFwiXCIpLnJlcGxhY2UoL1xcXFwvZywgXCIvXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIF9pbXBvcnRNYXBzW3R5cGVdID0gY29tcG9uZW50UGF0aDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGlzUm9vdCB8fCB0aGlzLmNoZWNrQmluZENoaWxkcmVuKG5hbWUpKSB7XHJcbiAgICAgICAgICAgIC8vIOe7keWumuWtkOiKgueCuVxyXG4gICAgICAgICAgICBub2RlLmNoaWxkcmVuLmZvckVhY2goYXN5bmMgKHRhcmdldDogTm9kZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5maW5kTm9kZXModGFyZ2V0LCBfbm9kZU1hcHMsIF9pbXBvcnRNYXBzLCBmYWxzZSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgLyoqIOajgOa1i+WJjee8gOaYr+WQpuespuWQiOe7keWumuinhOiMgyAqL1xyXG4gICAgY2hlY2tOb2RlUHJlZml4KG5hbWU6IHN0cmluZykge1xyXG4gICAgICAgIGlmIChuYW1lWzBdICE9PSBDb25zdC5TVEFOREFSRF9QcmVmaXgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH0sXHJcbiAgICAvKiog5qOA5p+l5ZCO57yAICovXHJcbiAgICBjaGVja0JpbmRDaGlsZHJlbihuYW1lOiBzdHJpbmcpIHtcclxuICAgICAgICBpZiAobmFtZVtuYW1lLmxlbmd0aCAtIDFdICE9PSBDb25zdC5TVEFOREFSRF9FbmQpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH0sXHJcbiAgICAvKiog6I635b6X57G75Z6L5ZKMbmFtZSAqL1xyXG4gICAgZ2V0UHJlZml4TmFtZXMobmFtZTogc3RyaW5nKSB7XHJcbiAgICAgICAgaWYgKG5hbWUgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgcmV0dXJuICcnO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbmFtZS5zdWJzdHIoMSwgbmFtZS5sZW5ndGgpLnNwbGl0KENvbnN0LlNUQU5EQVJEX1NlcGFyYXRvcik7XHJcbiAgICB9XHJcbn07XHJcblxyXG4vKipcclxuICogQGVuIE1ldGhvZCBUcmlnZ2VyZWQgb24gRXh0ZW5zaW9uIFN0YXJ0dXBcclxuICogQHpoIOaJqeWxleWQr+WKqOaXtuinpuWPkeeahOaWueazlVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGxvYWQoKSB7IH1cclxuXHJcbi8qKlxyXG4gKiBAZW4gTWV0aG9kIHRyaWdnZXJlZCB3aGVuIHVuaW5zdGFsbGluZyB0aGUgZXh0ZW5zaW9uXHJcbiAqIEB6aCDljbjovb3mianlsZXml7bop6blj5HnmoTmlrnms5VcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiB1bmxvYWQoKSB7IH1cclxuIl19