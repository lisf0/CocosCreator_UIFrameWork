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
        let ComFileName = path_1.default.basename(ComponentScriptPath, ".ts");
        if (UIComName != ComFileName) {
            console.warn(`组件名[${UIComName}]与脚本文件名[${ComFileName}]不一致,请确认代码内的组件名是否正确!`);
            return;
        }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zb3VyY2Uvc2NlbmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBeVpBLG9CQUEwQjtBQU0xQix3QkFBNEI7QUEvWjVCLDJCQUFtRDtBQUNuRCw0Q0FBb0I7QUFDcEIsZ0RBQXdCO0FBQ3hCLG1FQUEwQztBQUMxQyxvREFBNEI7QUFFNUIsTUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7QUFFeEMsMkRBQTJEO0FBQzNELDREQUE0RDtBQUU1RCx1Q0FBdUM7QUFDdkMsaUVBQWlFO0FBQ2pFLHFEQUFxRDtBQUNyRCxpQ0FBaUM7QUFFakM7OztHQUdHO0FBQ1UsUUFBQSxPQUFPLEdBQTRDO0lBQzVEOzs7T0FHRztJQUNILE9BQU87UUFDSCxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFHRCxRQUFRO1FBQ0osa0NBQWtDO1FBQ2xDLElBQUksUUFBUSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDO1FBQ2xDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDeEIsQ0FBQztJQUVELEtBQUssQ0FBQyxRQUFRO1FBQ1YsSUFBSSxPQUFPLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFbkQsSUFBSSxPQUFPLElBQUksSUFBSSxJQUFJLE9BQU8sQ0FBQyxNQUFNLElBQUksQ0FBQyxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDO1lBQ25GLE9BQU8sQ0FBQyxHQUFHLENBQUMsdUJBQXVCLENBQUMsQ0FBQztZQUNyQyxPQUFPLElBQUksQ0FBQztRQUNoQixDQUFDO1FBRUQsSUFBSSxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxD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QUFRLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxNQUFZLEVBQUUsRUFBRTtnQkFDekMsTUFBTSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ2hFLENBQUMsQ0FBQyxDQUFDO1FBQ1AsQ0FBQztJQUNMLENBQUM7SUFFRCxtQkFBbUI7SUFDbkIsZUFBZSxDQUFDLElBQVk7UUFDeEIsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssZUFBSyxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQ3BDLE9BQU8sS0FBSyxDQUFDO1FBQ2pCLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNoQixDQUFDO0lBQ0QsV0FBVztJQUNYLGlCQUFpQixDQUFDLElBQVk7UUFDMUIsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsS0FBSyxlQUFLLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDL0MsT0FBTyxJQUFJLENBQUM7UUFDaEIsQ0FBQztRQUNELE9BQU8sS0FBSyxDQUFDO0lBQ2pCLENBQUM7SUFDRCxnQkFBZ0I7SUFDaEIsY0FBYyxDQUFDLElBQVk7UUFDdkIsSUFBSSxJQUFJLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDaEIsT0FBTyxFQUFFLENBQUM7UUFDZCxDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLGVBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0lBQ3ZFLENBQUM7Q0FDSixDQUFDO0FBRUY7OztHQUdHO0FBQ0gsU0FBZ0IsSUFBSSxLQUFLLENBQUM7QUFFMUI7OztHQUdHO0FBQ0gsU0FBZ0IsTUFBTSxLQUFLLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb21wb25lbnQsIGRpcmVjdG9yLCBqcywgTm9kZSB9IGZyb20gJ2NjJztcclxuaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcclxuaW1wb3J0IHBhY2thZ2VKU09OIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XHJcbmltcG9ydCBDb25zdCBmcm9tIFwiLi9Db25zdFwiO1xyXG5cclxuY29uc3QgUHJvamVjdFBhdGggPSBFZGl0b3IuUHJvamVjdC5wYXRoO1xyXG5cclxuLy8g5Li05pe25Zyo5b2T5YmN5qih5Z2X5aKe5Yqg57yW6L6R5Zmo5YaF55qE5qih5Z2X5Li65pCc57Si6Lev5b6E77yM5Li65LqG6IO95aSf5q2j5bi4IHJlcXVpcmUg5YiwIGNjIOaooeWdl++8jOWQjue7reeJiOacrOWwhuS8mOWMluiwg+eUqOaWueW8j1xyXG4vLyBtb2R1bGUucGF0aHMucHVzaChqb2luKEVkaXRvci5BcHAucGF0aCwgJ25vZGVfbW9kdWxlcycpKTtcclxuXHJcbi8vIOW9k+WJjeeJiOacrOmcgOimgeWcqCBtb2R1bGUucGF0aHMg5L+u5pS55ZCO5omN6IO95q2j5bi45L2/55SoIGNjIOaooeWdl1xyXG4vLyDlubbkuJTlpoLmnpzluIzmnJvmraPluLjmmL7npLogY2Mg55qE5a6a5LmJ77yM6ZyA6KaB5omL5Yqo5bCGIGVuZ2luZSDmlofku7blpLnph4znmoQgY2MuZC50cyDmt7vliqDliLDmj5Lku7bnmoQgdHNjb25maWcg6YeMXHJcbi8vIOW9k+WJjeeJiOacrOeahCBjYyDlrprkuYnmlofku7blj6/ku6XlnKjlvZPliY3pobnnm67nmoQgdGVtcC9kZWNsYXJhdGlvbnMvY2MuZC50cyDmib7liLBcclxuLy8gaW1wb3J0IHsgZGlyZWN0b3IgfSBmcm9tICdjYyc7XHJcblxyXG4vKipcclxuICogQGVuIFJlZ2lzdHJhdGlvbiBtZXRob2QgZm9yIHRoZSBtYWluIHByb2Nlc3Mgb2YgRXh0ZW5zaW9uXHJcbiAqIEB6aCDkuLrmianlsZXnmoTkuLvov5vnqIvnmoTms6jlhozmlrnms5VcclxuICovXHJcbmV4cG9ydCBjb25zdCBtZXRob2RzOiB7IFtrZXk6IHN0cmluZ106ICguLi5hbnk6IGFueSkgPT4gYW55IH0gPSB7XHJcbiAgICAvKipcclxuICAgICAqIEBlbiBBIG1ldGhvZCB0aGF0IGNhbiBiZSB0cmlnZ2VyZWQgYnkgbWVzc2FnZVxyXG4gICAgICogQHpoIOmAmui/hyBtZXNzYWdlIOinpuWPkeeahOaWueazlVxyXG4gICAgICovXHJcbiAgICBzaG93TG9nKCkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdIZWxsbyBXb3JsZCcpO1xyXG4gICAgfSxcclxuXHJcblxyXG4gICAgYmluZFJvb3QoKSB7XHJcbiAgICAgICAgLy9AdHMtaWdub3JlIGNjZSDmsqHmib7liLDmnInlo7DmmI4s5omA5Lul5q2k5aSE5L2/55SodHPlv73nlaVcclxuICAgICAgICBsZXQgTm9kZVJvb3QgPSBjY2UuU2NlbmUucm9vdE5vZGU7XHJcbiAgICAgICAgdGhpcy5iaW5kKE5vZGVSb290KTtcclxuICAgIH0sXHJcblxyXG4gICAgYXN5bmMgYmluZE5vZGUoKSB7XHJcbiAgICAgICAgdmFyIG5vZGVJZHMgPSBFZGl0b3IuU2VsZWN0aW9uLmdldFNlbGVjdGVkKCdub2RlJyk7XHJcblxyXG4gICAgICAgIGlmIChub2RlSWRzID09IG51bGwgfHwgbm9kZUlkcy5sZW5ndGggPT0gMCB8fCBub2RlSWRzWzBdID09IG51bGwgfHwgbm9kZUlkc1swXSA9PSBcIlwiKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdQbGVhc2Ugc2VsZWN0IGEgbm9kZS4nKTtcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAobm9kZUlkcy5sZW5ndGggPiAxKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdQbGVhc2Ugc2VsZWN0IG9ubHkgb25lIG5vZGUuJyk7XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpXHJcbiAgICAgICAgaWYgKHNjZW5lKSB7XHJcbiAgICAgICAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBub2RlSWRzLmxlbmd0aDsgaW5kZXgrKykge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgaWQgPSBub2RlSWRzW2luZGV4XTtcclxuICAgICAgICAgICAgICAgIGxldCBub2RlID0gdGhpcy5maW5kTm9kZUJ5VVVJRChpZCwgZGlyZWN0b3IuZ2V0U2NlbmUoKSk7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmJpbmQobm9kZSk7XHJcblxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICBhc3luYyBiaW5kKE5vZGVSb290OiBOb2RlKSB7XHJcblxyXG4gICAgICAgIC8vQHRzLWlnbm9yZSBcclxuICAgICAgICBjb25zdCBjb21wID0gTm9kZVJvb3QuZ2V0Q29tcG9uZW50KGFiLkNvbXBvbmVudCk7XHJcblxyXG4gICAgICAgIGlmICghY29tcCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYCR7Tm9kZVJvb3QubmFtZX0g5rKh5pyJ5oyC6L29IOe7p+aJv+iHqkFCQ29tcG9uZW50IOiEmuacrGApO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgY29uZmlnUGF0aCA9IHBhdGguam9pbihQcm9qZWN0UGF0aCwgQ29uc3QuQ29uZmlnVXJsKTtcclxuICAgICAgICBsZXQgY29uZmlnID0gQ29uc3QuRGVmYXVsdENvbmZpZztcclxuICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhjb25maWdQYXRoKSkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhg5q2j5Zyo6K+75Y+W6YWN572u5paH5Lu2OiAke1Byb2plY3RQYXRofS8ke0NvbnN0LkNvbmZpZ1VybH0g6K+356iN562JLmApO1xyXG4gICAgICAgICAgICBsZXQgY29udGVudCA9IGZzLnJlYWRGaWxlU3luYyhgJHtQcm9qZWN0UGF0aH0vJHtDb25zdC5Db25maWdVcmx9YCwgeyBlbmNvZGluZzogJ3V0Zi04JyB9KTtcclxuICAgICAgICAgICAgaWYgKCFjb250ZW50KSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYOivu+WPlumFjee9ruaWh+S7tuWksei0pToke1Byb2plY3RQYXRofS8ke0NvbnN0LkNvbmZpZ1VybH1gKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjb25maWcgPSBKU09OLnBhcnNlKGNvbnRlbnQpO1xyXG4gICAgICAgIH1cclxuXHJcblxyXG4gICAgICAgIC8vIEB0cy1pZ25vcmVcclxuICAgICAgICBjb25zdCBzY3JpcHRVdWlkID0gY29tcC5fX3NjcmlwdFV1aWQ7XHJcbiAgICAgICAgbGV0IENvbXBvbmVudFNjcmlwdFBhdGggPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1wYXRoJywgc2NyaXB0VXVpZClcclxuXHJcbiAgICAgICAgY29uc29sZS5sb2coQ29tcG9uZW50U2NyaXB0UGF0aCk7XHJcblxyXG4gICAgICAgIGlmIChDb21wb25lbnRTY3JpcHRQYXRoID09IG51bGwgfHwgQ29tcG9uZW50U2NyaXB0UGF0aC5sZW5ndGggPD0gMCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYOiOt+WPlue7hOS7tui3r+W+hOWksei0pSFgKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBDb21wb25lbnRTY3JpcHRQYXRoID0gQ29tcG9uZW50U2NyaXB0UGF0aC5yZXBsYWNlKC9cXFxcL2csIFwiL1wiKTtcclxuXHJcbiAgICAgICAgLy8gbGV0IFByb2plY3REaXIgPSBFZGl0b3IuUHJvamVjdC5wYXRoO1xyXG4gICAgICAgIGxldCBVSUNvbU5hbWUgPSB0aGlzLmdldEFCQ29tcG9uZW50TmFtZShOb2RlUm9vdCk7XHJcbiAgICAgICAgbGV0IENvbUZpbGVOYW1lID0gcGF0aC5iYXNlbmFtZShDb21wb25lbnRTY3JpcHRQYXRoLCBcIi50c1wiKVxyXG4gICAgICAgIGlmIChVSUNvbU5hbWUgIT0gQ29tRmlsZU5hbWUpIHtcclxuICAgICAgICAgICAgY29uc29sZS53YXJuKGDnu4Tku7blkI1bJHtVSUNvbU5hbWV9XeS4juiEmuacrOaWh+S7tuWQjVske0NvbUZpbGVOYW1lfV3kuI3kuIDoh7Qs6K+356Gu6K6k5Luj56CB5YaF55qE57uE5Lu25ZCN5piv5ZCm5q2j56GuIWApO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgQXV0b1NjcmlwdE5hbWUgPSBgJHtVSUNvbU5hbWV9X0F1dG9gO1xyXG4gICAgICAgIGxldCBBdXRvU2NyaXB0UGF0aCA9IGBgO1xyXG5cclxuICAgICAgICBjb25zdCBnZXRBdXRvU2NyaXB0UGF0aCA9IChjb25maWc6IGFueSkgPT4ge1xyXG5cclxuICAgICAgICAgICAgbGV0IHRlbXBQYXRoID0gXCJcIjtcclxuXHJcbiAgICAgICAgICAgIGxldCBtYXRjaFBhdGggPSBgJHtQcm9qZWN0UGF0aH0vJHtjb25maWcuUm9vdERpcn1gLnJlcGxhY2UoL1xcXFwvZywgXCIvXCIpXHJcbiAgICAgICAgICAgIGlmIChjb25maWcuU2NyaXB0c0Rpci5zdGFydHNXaXRoKFwiYXNzZXRzL1wiKSkge1xyXG4gICAgICAgICAgICAgICAgbWF0Y2hQYXRoID0gYCR7UHJvamVjdFBhdGh9LyR7Y29uZmlnLlNjcmlwdHNEaXJ9YC5yZXBsYWNlKC9cXFxcL2csIFwiL1wiKVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoQ29tcG9uZW50U2NyaXB0UGF0aC5zdGFydHNXaXRoKG1hdGNoUGF0aCkpIHtcclxuICAgICAgICAgICAgICAgIGlmIChjb25maWcuU2NyaXB0c0Rpci5zdGFydHNXaXRoKFwiYXNzZXRzL1wiKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRlbXBQYXRoID0gYCR7UHJvamVjdFBhdGh9LyR7Y29uZmlnLlNjcmlwdHNEaXJ9LyR7Q29uc3QuQXV0b1NjcmlwdHNEaXJOYW1lfS8ke0F1dG9TY3JpcHROYW1lfS50c2AucmVwbGFjZSgvXFxcXC9nLCBcIi9cIik7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHRlbXBQYXRoID0gYCR7UHJvamVjdFBhdGh9LyR7Y29uZmlnLlJvb3REaXJ9LyR7Y29uZmlnLlNjcmlwdHNEaXJ9LyR7Q29uc3QuQXV0b1NjcmlwdHNEaXJOYW1lfS8ke0F1dG9TY3JpcHROYW1lfS50c2AucmVwbGFjZSgvXFxcXC9nLCBcIi9cIik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHRlbXBQYXRoO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoY29uZmlnKSkge1xyXG4gICAgICAgICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgY29uZmlnLmxlbmd0aDsgaW5kZXgrKykge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgZWxlbWVudCA9IGNvbmZpZ1tpbmRleF07XHJcbiAgICAgICAgICAgICAgICBBdXRvU2NyaXB0UGF0aCA9IGdldEF1dG9TY3JpcHRQYXRoKGVsZW1lbnQpO1xyXG4gICAgICAgICAgICAgICAgaWYgKEF1dG9TY3JpcHRQYXRoICE9IFwiXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIEF1dG9TY3JpcHRQYXRoID0gZ2V0QXV0b1NjcmlwdFBhdGgoY29uZmlnKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChBdXRvU2NyaXB0UGF0aC5sZW5ndGggPD0gMCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYOiOt+WPluS/neWtmOi3r+W+hOWksei0pSzor7fmo4Dmn6XphY3nva7lhoXlrrk6JHtQcm9qZWN0UGF0aH0vJHtDb25zdC5Db25maWdVcmx9IWApO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuXHJcbiAgICAgICAgbGV0IG5vZGVNYXBzOiB7IFtrZXk6IHN0cmluZ106IHN0cmluZ1tdIH0gPSB7fSwgaW1wb3J0TWFwczogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSA9IHt9O1xyXG4gICAgICAgIHRoaXMuZmluZE5vZGVzKE5vZGVSb290LCBub2RlTWFwcywgaW1wb3J0TWFwcywgdHJ1ZSk7XHJcblxyXG4gICAgICAgIGxldCBfc3RyX2ltcG9ydCA9IGBgO1xyXG4gICAgICAgIGZvciAobGV0IGtleSBpbiBpbXBvcnRNYXBzKSB7XHJcbiAgICAgICAgICAgIF9zdHJfaW1wb3J0ICs9IGBpbXBvcnQgJHtrZXl9IGZyb20gXCIke3RoaXMuZ2V0SW1wb3J0UGF0aChpbXBvcnRNYXBzW2tleV0sIEF1dG9TY3JpcHRQYXRoKX1cIlxcbmA7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGxldCBfY2NfY29tcHM6IHN0cmluZ1tdID0gW107XHJcbiAgICAgICAgbGV0IF9zdHJfY29udGVudCA9IGBgO1xyXG4gICAgICAgIGZvciAobGV0IGtleSBpbiBub2RlTWFwcykge1xyXG4gICAgICAgICAgICBsZXQgdHlwZSA9IG5vZGVNYXBzW2tleV1bMF07XHJcbiAgICAgICAgICAgIGxldCBhcnIgPSB0eXBlLnNwbGl0KFwiLlwiKTtcclxuICAgICAgICAgICAgaWYgKGFyclswXSA9PSBcImNjXCIpIHtcclxuICAgICAgICAgICAgICAgIGlmIChfY2NfY29tcHMuaW5kZXhPZihhcnJbMV0pID09IC0xKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgX2NjX2NvbXBzLnB1c2goYXJyWzFdKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHR5cGUgPSBhcnJbMV07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgX3N0cl9jb250ZW50ICs9IGBcXHRAcHJvcGVydHkoJHt0eXBlfSlcXG5cXHQke2tleX06ICR7dHlwZX0gfCBudWxsID0gbnVsbDtcXG5gO1xyXG4gICAgICAgIH1cclxuICAgICAgICBsZXQgX3N0cl9jY19jb21wcyA9IF9jY19jb21wcy5sZW5ndGggPiAwID8gJywgJyArIF9jY19jb21wcy5qb2luKFwiLCBcIikgOiAnJztcclxuXHJcbiAgICAgICAgbGV0IHN0clNjcmlwdCA9IGAke19zdHJfaW1wb3J0fVxyXG5pbXBvcnQgeyBfZGVjb3JhdG9yLCBDb21wb25lbnQke19zdHJfY2NfY29tcHN9IH0gZnJvbSAnY2MnO1xyXG5jb25zdCB7IGNjY2xhc3MsIHByb3BlcnR5IH0gPSBfZGVjb3JhdG9yO1xyXG5cclxuQGNjY2xhc3MoXCIke0F1dG9TY3JpcHROYW1lfVwiKVxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyAke0F1dG9TY3JpcHROYW1lfSBleHRlbmRzIENvbXBvbmVudCB7XHJcbiR7X3N0cl9jb250ZW50fSBcclxufWA7XHJcblxyXG4gICAgICAgIGxldCBkYlNjcmlwdFBhdGggPSBBdXRvU2NyaXB0UGF0aC5yZXBsYWNlKFByb2plY3RQYXRoLnJlcGxhY2UoL1xcXFwvZywgXCIvXCIpLCBcImRiOi9cIik7XHJcbiAgICAgICAgdGhpcy5zYXZlRmlsZShkYlNjcmlwdFBhdGgsIHN0clNjcmlwdClcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdyZWZyZXNoLWFzc2V0JywgZGJTY3JpcHRQYXRoKTtcclxuXHJcbiAgICAgICAgICAgIGxldCBhdXRvQ29tcCA9IHRoaXMuZ2V0Q29tcG9uZW50KE5vZGVSb290LCBBdXRvU2NyaXB0TmFtZSk7XHJcbiAgICAgICAgICAgIGlmICghYXV0b0NvbXApIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHNob3J0Y3V0cyA9IHBhY2thZ2VKU09OLmNvbnRyaWJ1dGlvbnMuc2hvcnRjdXRzLm1hcCh2ID0+IHYud2luKS5qb2luKCcgLyAnKTtcclxuICAgICAgICAgICAgICAgIGlmICghanMuZ2V0Q2xhc3NCeU5hbWUoQXV0b1NjcmlwdE5hbWUpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5pbmZvKGDor7flho3miafooYzkuIDmrKEgJHtzaG9ydGN1dHN9YCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnY3JlYXRlLWNvbXBvbmVudCcsIHsgdXVpZDogTm9kZVJvb3QudXVpZCwgY29tcG9uZW50OiBBdXRvU2NyaXB0TmFtZSB9KTtcclxuICAgICAgICAgICAgICAgIC8vIGF1dG9Db21wID0gdGhpcy5nZXRDb21wb25lbnQoTm9kZVJvb3QsIEF1dG9TY3JpcHROYW1lKTsgIC8vIOKGkeW5tuS4jeS8muWunuaXtumZhOWKoOS4iuWOu1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5pbmZvKGDor7flho3miafooYzkuIDmrKEgJHtzaG9ydGN1dHN9YCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGZvciAobGV0IGtleSBpbiBub2RlTWFwcykge1xyXG5cclxuICAgICAgICAgICAgICAgIGxldCBvcHRpb25zID0ge1xyXG4gICAgICAgICAgICAgICAgICAgIHV1aWQ6IE5vZGVSb290LnV1aWQsXHJcbiAgICAgICAgICAgICAgICAgICAgcGF0aDogYF9fY29tcHNfXy4ke3RoaXMuZ2V0Q29tcG9uZW50SW5kZXgoTm9kZVJvb3QsIEF1dG9TY3JpcHROYW1lKX0uJHtrZXl9YCxcclxuICAgICAgICAgICAgICAgICAgICBkdW1wOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IG5vZGVNYXBzW2tleV1bMF0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1dWlkOiBub2RlTWFwc1trZXldWzFdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmR1bXAudHlwZSAhPSBDb25zdC5TZXBhcmF0b3JNYXAuTm9kZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBhcHBlbmRDb21wID0gdGhpcy5nZXRDb21wb25lbnQodGhpcy5maW5kTm9kZUJ5VVVJRChub2RlTWFwc1trZXldWzFdLCBOb2RlUm9vdCksIG9wdGlvbnMuZHVtcC50eXBlKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoYXBwZW5kQ29tcCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmR1bXAudmFsdWUgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1dWlkOiBhcHBlbmRDb21wLnV1aWRcclxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywgb3B0aW9ucyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY29uc29sZS5sb2coQXV0b1NjcmlwdE5hbWUgKyAnLnRzIOeUn+aIkOaIkOWKnycpO1xyXG5cclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhlcnJvcik7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICBzYXZlRmlsZShTY3JpcHRQYXRoOiBzdHJpbmcsIHN0clNjcmlwdDogc3RyaW5nKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGFzeW5jIChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoXHJcbiAgICAgICAgICAgICAgICAnYXNzZXQtZGInLFxyXG4gICAgICAgICAgICAgICAgJ2NyZWF0ZS1hc3NldCcsXHJcbiAgICAgICAgICAgICAgICBTY3JpcHRQYXRoLFxyXG4gICAgICAgICAgICAgICAgc3RyU2NyaXB0LFxyXG4gICAgICAgICAgICAgICAgeyBvdmVyd3JpdGU6IHRydWUgfVxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAvLyAgIGNvbnNvbGUubG9nKCdjcmVhdGXigJFvcuKAkXNhdmUg57uT5p6c77yaJywgcmVzdWx0KTtcclxuICAgICAgICAgICAgcmVzb2x2ZShyZXN1bHQpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKiog6K6h566X55u45a+56Lev5b6EICovXHJcbiAgICBnZXRJbXBvcnRQYXRoKGV4cG9ydFBhdGg6IHN0cmluZywgY3VyclBhdGg6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICAgICAgZXhwb3J0UGF0aCA9IGV4cG9ydFBhdGgucmVwbGFjZSgvXFxcXC9nLCBcIi9cIikuc3Vic3RyKDAsIGV4cG9ydFBhdGgubGFzdEluZGV4T2YoXCIuXCIpKTtcclxuICAgICAgICBjdXJyUGF0aCA9IGN1cnJQYXRoLnJlcGxhY2UoL1xcXFwvZywgXCIvXCIpO1xyXG4gICAgICAgIGxldCB0bXAgPSBcIi4vXCI7XHJcbiAgICAgICAgbGV0IHN0YXJ0OiBudW1iZXIsIGVuZDogbnVtYmVyO1xyXG4gICAgICAgIGxldCBleHBvcnRTdHIgPSBleHBvcnRQYXRoLnNwbGl0KFwiL1wiKTtcclxuICAgICAgICBsZXQgY3VyclN0ciA9IGN1cnJQYXRoLnNwbGl0KFwiL1wiKTtcclxuICAgICAgICBmb3IgKGVuZCA9IDA7IGVuZCA8IGV4cG9ydFN0ci5sZW5ndGg7ICsrZW5kKSB7XHJcbiAgICAgICAgICAgIGlmIChleHBvcnRTdHJbZW5kXSAhPSBjdXJyU3RyW2VuZF0pIHtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZvciAoc3RhcnQgPSBlbmQgKyAxOyBzdGFydCA8IGN1cnJTdHIubGVuZ3RoOyArK3N0YXJ0KSB7XHJcbiAgICAgICAgICAgIHRtcCArPSBcIi4uL1wiO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmb3IgKHN0YXJ0ID0gZW5kOyBzdGFydCA8IGV4cG9ydFN0ci5sZW5ndGg7ICsrc3RhcnQpIHtcclxuICAgICAgICAgICAgdG1wICs9IGAke2V4cG9ydFN0cltzdGFydF19L2A7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRtcCA9IHRtcC5zdWJzdHIoMCwgdG1wLmxlbmd0aCAtIDEpO1xyXG4gICAgICAgIHJldHVybiB0bXA7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKiDojrflvpdDb21wb25lbnTnmoTnsbvlkI0gKi9cclxuICAgIGdldENvbXBvbmVudE5hbWUoY29tOiBDb21wb25lbnQpOiBzdHJpbmcge1xyXG4gICAgICAgIGxldCBhcnIgPSBjb20ubmFtZS5tYXRjaCgvPC4qPiQvKTtcclxuICAgICAgICBpZiAoYXJyICYmIGFyci5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBhcnJbMF0uc2xpY2UoMSwgLTEpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gY29tLm5hbWU7XHJcbiAgICB9LFxyXG5cclxuICAgIGdldEFCQ29tcG9uZW50TmFtZShub2RlOiBOb2RlKSB7XHJcblxyXG4gICAgICAgIC8vQHRzLWlnbm9yZSBcclxuICAgICAgICBsZXQgY29tcyA9IG5vZGUuZ2V0Q29tcG9uZW50cyhhYi5Db21wb25lbnQpO1xyXG5cclxuICAgICAgICAvLyDkvJjlhYjlj5ZVSeW8gOWktOeahOe7hOS7tlxyXG4gICAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBjb21zLmxlbmd0aDsgaW5kZXgrKykge1xyXG4gICAgICAgICAgICBsZXQgbmFtZSA9IHRoaXMuZ2V0Q29tcG9uZW50TmFtZShjb21zW2luZGV4XSk7XHJcbiAgICAgICAgICAgIGlmIChuYW1lICYmIG5hbWUuc3RhcnRzV2l0aChcIlVJXCIpICYmICFuYW1lLmVuZHNXaXRoKFwiX0F1dG9cIikpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBuYW1lO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDmib7kuI3liLBVSeW8gOWktOeahOe7hOS7tlxyXG4gICAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBjb21zLmxlbmd0aDsgaW5kZXgrKykge1xyXG4gICAgICAgICAgICBsZXQgbmFtZSA9IHRoaXMuZ2V0Q29tcG9uZW50TmFtZShjb21zW2luZGV4XSk7XHJcbiAgICAgICAgICAgIGlmIChuYW1lICYmICFuYW1lLmVuZHNXaXRoKFwiX0F1dG9cIikpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBuYW1lO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuXHJcblxyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIOiOt+WPluiKgueCueeahOe7hOS7tlxyXG4gICAgICog6Kej5Yaz5Zug6LCD55SoIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3JlZnJlc2gtYXNzZXQnIOWQjiDlsIbml6Dms5XpgJrov4djY+eahGdldENvbXBvbmVudOadpeiOt+W+l+e7hOS7tlxyXG4gICAgICovXHJcbiAgICBnZXRDb21wb25lbnQobm9kZTogTm9kZSwgbmFtZTogYW55KSB7XHJcbiAgICAgICAgbGV0IGNvbSA9IG51bGw7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBuYW1lID09IFwic3RyaW5nXCIpIHtcclxuICAgICAgICAgICAgY29tID0gbm9kZS5jb21wb25lbnRzLmZpbmQoaXRlbSA9PiBpdGVtLm5hbWUgPT0gYCR7bm9kZS5uYW1lfTwke25hbWV9PmApO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoY29tID09IG51bGwpIHtcclxuICAgICAgICAgICAgY29tID0gbm9kZS5nZXRDb21wb25lbnQobmFtZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBjb207XHJcbiAgICB9LFxyXG4gICAgLyoqXHJcbiAgICAgKiDojrflj5bnu4Tku7bkuIvmoIdcclxuICAgICAqIEBwYXJhbSBub2RlIFxyXG4gICAgICogQHBhcmFtIG5hbWUgXHJcbiAgICAgKiBAcmV0dXJucyBcclxuICAgICAqL1xyXG4gICAgZ2V0Q29tcG9uZW50SW5kZXgobm9kZTogTm9kZSwgbmFtZTogc3RyaW5nKSB7XHJcbiAgICAgICAgbGV0IGluZGV4ID0gbm9kZS5jb21wb25lbnRzLmZpbmRJbmRleChpdGVtID0+IGl0ZW0ubmFtZSA9PSBgJHtub2RlLm5hbWV9PCR7bmFtZX0+YCk7XHJcbiAgICAgICAgcmV0dXJuIGluZGV4O1xyXG4gICAgfSxcclxuXHJcblxyXG4gICAgZmluZE5vZGVCeVVVSUQodXVpZDogc3RyaW5nLCByb290Tm9kZTogTm9kZSk6IGFueSB7XHJcbiAgICAgICAgaWYgKHJvb3ROb2RlLnV1aWQgPT0gdXVpZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gcm9vdE5vZGU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJvb3ROb2RlLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGxldCBub2RlID0gdGhpcy5maW5kTm9kZUJ5VVVJRCh1dWlkLCByb290Tm9kZS5jaGlsZHJlbltpXSk7XHJcbiAgICAgICAgICAgIGlmIChub2RlKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbm9kZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgIH0sXHJcblxyXG4gICAgYXN5bmMgZmluZE5vZGVzKG5vZGU6IE5vZGUsIF9ub2RlTWFwczogeyBba2V5OiBzdHJpbmddOiBzdHJpbmdbXSB9LCBfaW1wb3J0TWFwczogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSwgaXNSb290OiBib29sZWFuKSB7XHJcbiAgICAgICAgbGV0IG5hbWUgPSBub2RlLm5hbWU7XHJcbiAgICAgICAgaWYgKCFpc1Jvb3QgJiYgdGhpcy5jaGVja05vZGVQcmVmaXgobmFtZSkpIHtcclxuICAgICAgICAgICAgLy8g6I635b6X6L+Z5Liq57uE5Lu255qE57G75Z6LIOWSjCDlkI3np7BcclxuICAgICAgICAgICAgbGV0IG5hbWVzID0gdGhpcy5nZXRQcmVmaXhOYW1lcyhuYW1lKTtcclxuICAgICAgICAgICAgaWYgKG5hbWVzID09PSBudWxsIHx8IG5hbWVzLmxlbmd0aCAhPT0gMikge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYCR7bmFtZX0g5ZG95Luk5LiN6KeE6IyDLCDor7fkvb/nlKhfTGFiZWwkeHh455qE5qC85byPISwg5oiW6ICF5piv5ZyoU3lzRGVmaW5l5Lit5rKh5pyJ5a6a5LmJYCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgbGV0IHR5cGUgPSBDb25zdC5TZXBhcmF0b3JNYXBbbmFtZXNbMF1dIHx8IG5hbWVzWzBdO1xyXG4gICAgICAgICAgICBsZXQgdmFsdWUgPSBuYW1lc1sxXTtcclxuICAgICAgICAgICAgaWYgKHZhbHVlLmVuZHNXaXRoKENvbnN0LlNUQU5EQVJEX0VuZCkpIHtcclxuICAgICAgICAgICAgICAgIHZhbHVlID0gdmFsdWUuc3Vic3RyaW5nKDAsIHZhbHVlLmxlbmd0aCAtIENvbnN0LlNUQU5EQVJEX0VuZC5sZW5ndGgpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyDov5vlhaXliLDov5nph4zvvIwg5bCx6KGo56S65Y+v5Lul57uR5a6a5LqGXHJcbiAgICAgICAgICAgIGlmIChfbm9kZU1hcHNbdmFsdWVdKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIuWHuueOsOS6humHjeWQjeWtl+autTpcIiwgdmFsdWUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIF9ub2RlTWFwc1t2YWx1ZV0gPSBbdHlwZSwgbm9kZS51dWlkXTtcclxuXHJcbiAgICAgICAgICAgIC8vIOajgOafpeaYr+WQpuaYr+iHquWumuS5iee7hOS7tlxyXG4gICAgICAgICAgICBsZXQgY29tcCA9IG5vZGUuZ2V0Q29tcG9uZW50KHR5cGUpO1xyXG4gICAgICAgICAgICBpZiAoIV9pbXBvcnRNYXBzW3R5cGVdICYmIHR5cGUuaW5kZXhPZihcImNjLlwiKSA9PT0gLTEgJiYgY29tcCkge1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcclxuICAgICAgICAgICAgICAgIGNvbnN0IHNjcmlwdFV1aWQgPSBjb21wLl9fc2NyaXB0VXVpZDtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgc2NyaXB0VXVpZCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoaW5mbykge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKCfotYTmupAgVVJMOicsIGluZm8udXJsKTtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgY29tcG9uZW50UGF0aCA9IGluZm8udXJsO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRQYXRoID0gY29tcG9uZW50UGF0aC5yZXBsYWNlKC9cXHMqL2csIFwiXCIpLnJlcGxhY2UoL1xcXFwvZywgXCIvXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIF9pbXBvcnRNYXBzW3R5cGVdID0gY29tcG9uZW50UGF0aDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGlzUm9vdCB8fCB0aGlzLmNoZWNrQmluZENoaWxkcmVuKG5hbWUpKSB7XHJcbiAgICAgICAgICAgIC8vIOe7keWumuWtkOiKgueCuVxyXG4gICAgICAgICAgICBub2RlLmNoaWxkcmVuLmZvckVhY2goYXN5bmMgKHRhcmdldDogTm9kZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5maW5kTm9kZXModGFyZ2V0LCBfbm9kZU1hcHMsIF9pbXBvcnRNYXBzLCBmYWxzZSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgLyoqIOajgOa1i+WJjee8gOaYr+WQpuespuWQiOe7keWumuinhOiMgyAqL1xyXG4gICAgY2hlY2tOb2RlUHJlZml4KG5hbWU6IHN0cmluZykge1xyXG4gICAgICAgIGlmIChuYW1lWzBdICE9PSBDb25zdC5TVEFOREFSRF9QcmVmaXgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH0sXHJcbiAgICAvKiog5qOA5p+l5ZCO57yAICovXHJcbiAgICBjaGVja0JpbmRDaGlsZHJlbihuYW1lOiBzdHJpbmcpIHtcclxuICAgICAgICBpZiAobmFtZVtuYW1lLmxlbmd0aCAtIDFdICE9PSBDb25zdC5TVEFOREFSRF9FbmQpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH0sXHJcbiAgICAvKiog6I635b6X57G75Z6L5ZKMbmFtZSAqL1xyXG4gICAgZ2V0UHJlZml4TmFtZXMobmFtZTogc3RyaW5nKSB7XHJcbiAgICAgICAgaWYgKG5hbWUgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgcmV0dXJuICcnO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbmFtZS5zdWJzdHIoMSwgbmFtZS5sZW5ndGgpLnNwbGl0KENvbnN0LlNUQU5EQVJEX1NlcGFyYXRvcik7XHJcbiAgICB9XHJcbn07XHJcblxyXG4vKipcclxuICogQGVuIE1ldGhvZCBUcmlnZ2VyZWQgb24gRXh0ZW5zaW9uIFN0YXJ0dXBcclxuICogQHpoIOaJqeWxleWQr+WKqOaXtuinpuWPkeeahOaWueazlVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGxvYWQoKSB7IH1cclxuXHJcbi8qKlxyXG4gKiBAZW4gTWV0aG9kIHRyaWdnZXJlZCB3aGVuIHVuaW5zdGFsbGluZyB0aGUgZXh0ZW5zaW9uXHJcbiAqIEB6aCDljbjovb3mianlsZXml7bop6blj5HnmoTmlrnms5VcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiB1bmxvYWQoKSB7IH1cclxuIl19